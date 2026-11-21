// User-owned inventory. Never mix it with the administrator's shared Workshop catalog.
import {accountUser} from "./accounts.js";
import {isAdmin} from "./auth.js";
import {normalizeSpecifications} from "./workshop-specifications.js";
import {projectAllowed} from "./projects.js";
import {resolveFunctionalPart} from "./functional-part-model.js";
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
const inventoryKey=id=>"user-workshop/"+id+"/inventory.json";
const clean=(v,n=160)=>String(v??"").trim().slice(0,n);
const normalize=v=>clean(v,200).toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const allowedStates=new Set(["in_stock","in_use_reusable","committed"]);
const validItem=input=>{
 const name=clean(input?.name,180),category=clean(input?.category,80);
 const specRecords=normalizeSpecifications(input?.specRecords);
 if(specRecords===null)return null;
 if(!name)return null;
 const quantity=input?.quantity===""||input?.quantity===undefined?1:Number(input.quantity);
 if(!Number.isFinite(quantity)||quantity<0||quantity>1000000)return null;
 return {name,category,manufacturer:clean(input.manufacturer,100),model:clean(input.model,120),
  partNumber:clean(input.partNumber,120),featureTreeDescription:clean(input.featureTreeDescription,20),notes:clean(input.notes,1500),
  stockStatus:allowedStates.has(input.stockStatus)?input.stockStatus:"in_stock",
  quantity,unit:clean(input.unit||"pcs",32),kind:["tool","material","component","equipment","other"].includes(input.kind)?input.kind:"other",
  catalogId:clean(input.catalogId,100),photoId:clean(input.photoId,60),specRecords,
  specifications:Array.isArray(input.specifications)?input.specifications.slice(0,25).map(x=>({name:clean(x.name,80),value:clean(x.value,240)})).filter(x=>x.name):[]};
};
async function read(env,user){const object=await env.PHOTOS.get(inventoryKey(user.id));return {items:object?JSON.parse(await object.text()):[],etag:object?.etag};}
function match(bom,items){
 const find=item=>items.filter(x=>{
  if(item.workshopItemId&&x.catalogId===item.workshopItemId)return true;
  if(item.catalogId&&x.catalogId===item.catalogId)return true;
  const manufacturer=normalize(item.manufacturer),model=normalize(item.model);
  if(manufacturer&&model&&manufacturer===normalize(x.manufacturer)&&model===normalize(x.model))return true;
  if(item.partNumber&&normalize(item.partNumber)===normalize(x.partNumber)&&normalize(x.partNumber))return true;
  return normalize(item.name)&&normalize(item.name)===normalize(x.name);
 });
 return bom.filter(p=>!p.generatedFrom&&!p.hideFromBom).map(p=>{
  const matches=find(p),required=Number(p.quantity),known=Number.isFinite(required)&&required>0;
  const unit=p.quantityUnit||"pcs",compatible=matches.filter(x=>(x.unit||"pcs")===unit);
  const inStock=compatible.filter(x=>(x.stockStatus||"in_stock")==="in_stock").reduce((a,x)=>a+x.quantity,0);
  const reusable=compatible.filter(x=>x.stockStatus==="in_use_reusable").reduce((a,x)=>a+x.quantity,0);
  const committed=compatible.filter(x=>x.stockStatus==="committed").reduce((a,x)=>a+x.quantity,0);
  const status=!matches.length?"unknown":!known?"check":compatible.length===0?"check":inStock>=required?"owned":inStock+reusable>=required?"reusable":"short";
  return {id:p.id,name:p.name,required:known?required:null,unit,available:compatible.length?inStock:null,reusable,committed,status,
   matches:matches.map(x=>({id:x.id,name:x.name,quantity:x.quantity,unit:x.unit,stockStatus:x.stockStatus||"in_stock"}))};
 });
}
export async function onRequest({request,env}){
 if(!env.PHOTOS)return json({error:"Workshop storage is unavailable"},503);
 const user=await accountUser(request,env);
 if(!user)return json({error:"Sign in to access your private Workshop"},401);
 const url=new URL(request.url);
 if(request.method==="GET"&&url.searchParams.has("project")){
  const project=url.searchParams.get("project");
  if(!await projectAllowed(env,project,request))return json({error:"Project unavailable"},403);
  const source=await env.PHOTOS.get("components/"+project+".json");
  const bom=(source?JSON.parse(await source.text()):[]).map(resolveFunctionalPart);
  return json({project,comparison:match(bom,(await read(env,user)).items)});
 }
 if(request.method==="GET")return json({items:(await read(env,user)).items,canDelete:await isAdmin(request,env)});
 if(!["POST","PUT","DELETE"].includes(request.method))return json({error:"Method not allowed"},405);
 if(request.headers.get("origin")!==url.origin)return json({error:"Invalid origin"},403);
 const body=await request.json().catch(()=>null);
 if(!body||typeof body!=="object")return json({error:"Invalid item"},400);
 const previous=await read(env,user);let items=previous.items;
 if(request.method==="DELETE"){
  if(!await isAdmin(request,env))return json({error:"Only administrators can delete Workshop items"},403);
  if(typeof body.id!=="string"||!items.some(x=>x.id===body.id))return json({error:"Item not found"},404);
  items=items.filter(x=>x.id!==body.id);
 }else{
  const item=validItem(body);
  if(!item)return json({error:"Enter an item name and a valid nonnegative quantity"},400);
  if(request.method==="POST"){
   if(items.length>=3000)return json({error:"Workshop item limit reached"},400);
   items=[...items,{...item,id:crypto.randomUUID(),createdAt:new Date().toISOString()}];
  }else{
   if(typeof body.id!=="string"||!items.some(x=>x.id===body.id))return json({error:"Item not found"},404);
   items=items.map(x=>x.id===body.id?{...x,...item,id:x.id,createdAt:x.createdAt}:x);
  }
 }
 const condition=previous.etag?{onlyIf:{etagMatches:previous.etag}}:{onlyIf:{etagDoesNotMatch:"*"}};
 const result=await env.PHOTOS.put(inventoryKey(user.id),JSON.stringify(items),condition);
 if(result===null)return json({error:"Your Workshop changed in another tab. Refresh before saving."},409);
 return json({items});
}
