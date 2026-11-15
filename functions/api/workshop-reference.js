// Editable details for public Workshop reference items. All writes require an administrator.
// Reference IDs and authored defaults remain in assets/resources.js.
import {isAdmin} from "./auth.js";
const indexKey="workshop-reference-overrides/v1.json";
const photoKey=id=>"workshop-reference-photos/"+id;
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{"content-type":"application/json","cache-control":"no-store","x-content-type-options":"nosniff"}});
const fields={name:180,subtitle:240,spec:5000,use:3000,caution:3000,manufacturer:160,model:160,partNumber:160,supplier:160,supplierUrl:1200,asin:20,price:80,packageQuantity:80,orderNotes:2000,documentationUrl:1200,notes:5000,category:40,kind:20,familyId:100,familyName:120,typeName:120};
const validId=id=>/^workshop:[a-z0-9-]{2,100}$/.test(String(id||""));
const validUrl=url=>!url||/^https:\/\//i.test(url);
async function read(env){
 const stored=await env.PHOTOS.get(indexKey);
 if(!stored)return {value:{},etag:null};
 const value=JSON.parse(await stored.text());
 if(!value||typeof value!=="object"||Array.isArray(value))throw Error("Invalid Workshop reference index");
 return {value,etag:stored.etag};
}
export async function onRequest({request,env}){
 if(!env.PHOTOS)return json({error:"Workshop storage is unavailable"},503);
 const url=new URL(request.url);
 try{
  const photo=url.searchParams.get("photo");
  if(request.method==="GET"&&photo){
   if(!/^[a-f0-9-]{36}$/.test(photo))return json({error:"Invalid image identifier"},400);
   const {value}=await read(env);
   const published=Object.values(value).some(item=>Array.isArray(item?.photos)&&item.photos.some(entry=>entry.id===photo));
   if(!published)return json({error:"Image not found"},404);
   const object=await env.PHOTOS.get(photoKey(photo));
   if(!object)return json({error:"Image not found"},404);
   return new Response(object.body,{headers:{"content-type":object.httpMetadata?.contentType||"image/jpeg","cache-control":"public, max-age=300","x-content-type-options":"nosniff"}});
  }
  if(request.method==="GET"){
   const {value}=await read(env);
   return json({items:value,canEdit:await isAdmin(request,env)});
  }
  if(!await isAdmin(request,env))return json({error:"Only the website administrator can edit shared Workshop references"},403);
  if(request.headers.get("origin")!==url.origin)return json({error:"Invalid request origin"},403);
  const creating=request.method==="POST"&&request.headers.get("content-type")?.includes("application/json");
  if(request.method==="POST"&&!creating){
   const form=await request.formData().catch(()=>null);
   const file=form?.get("photo");
   if(!file||typeof file.arrayBuffer!=="function"||!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size<1||file.size>5*1024*1024)
    return json({error:"Choose a JPEG, PNG, or WebP photo up to 5 MB"},400);
   const id=crypto.randomUUID();
   await env.PHOTOS.put(photoKey(id),new Uint8Array(await file.arrayBuffer()),{httpMetadata:{contentType:file.type}});
   return json({photo:{id,caption:""}},201);
  }
  if(!creating&&request.method!=="PUT")return json({error:"Method not allowed"},405);
  const body=await request.json().catch(()=>null);
  if(!body||typeof body!=="object"||!body.details||typeof body.details!=="object")
   return json({error:"Item details are required"},400);
  if(!creating&&!validId(body.id))return json({error:"Invalid Workshop reference ID"},400);
  const patch={};
  for(const [name,limit] of Object.entries(fields)){
   const val=body?.details?.[name];
   if(val!==undefined&&typeof val!=="string")return json({error:"Invalid field: "+name},400);
   patch[name]=String(val||"").trim().slice(0,limit);
  }
  if(patch.kind&&!["tool","equipment","component","material","other"].includes(patch.kind))
   return json({error:"Invalid item type"},400);
  if(patch.category&&!["tools","consumables","electronics","hardware","safety"].includes(patch.category))
   return json({error:"Invalid Workshop category"},400);
  if(patch.familyId&&!/^[a-z0-9-]{2,100}$/.test(patch.familyId))
   return json({error:"Invalid product family"},400);
  if(creating&&(!patch.name||!patch.familyId||!patch.category))
   return json({error:"Item name, category and product family are required"},400);
  if(!validUrl(patch.supplierUrl)||!validUrl(patch.documentationUrl))return json({error:"Use HTTPS URLs for supplier and documentation links"},400);
  if(patch.asin&&!/^[A-Za-z0-9]{10}$/.test(patch.asin))return json({error:"Amazon ASIN must contain 10 letters or numbers"},400);
  const rawPhotos=body?.details?.photos||[];
  if(!Array.isArray(rawPhotos)||rawPhotos.length>12)return json({error:"No more than 12 photos per reference"},400);
  const photos=[];
  for(const p of rawPhotos){
   if(!/^[a-f0-9-]{36}$/.test(String(p?.id||"")))return json({error:"Invalid photo ID"},400);
   if(photos.some(x=>x.id===p.id))continue;
   if(!await env.PHOTOS.head(photoKey(p.id)))return json({error:"Photo was not uploaded"},400);
   photos.push({id:p.id,caption:String(p.caption||"").slice(0,180)});
  }
  patch.photos=photos;
  const id=creating?"workshop:custom-"+crypto.randomUUID():body.id;
  // Preserve compatibility with seed references while marking new records as
  // first-class catalog items. Never trust the client to set the created flag.
  for(let attempt=0;attempt<3;attempt++){
   const {value,etag}=await read(env);
   if(Object.keys(value).length>=300&&!(id in value))return json({error:"Workshop index is full"},413);
   const previous=value[id];
   const details={...patch,...((creating||previous?.created)?{created:true}:{})};
   const next={...value,[id]:details};
   const options=etag?{onlyIf:{etagMatches:etag}}:{onlyIf:{etagDoesNotMatch:"*"}};
   const saved=await env.PHOTOS.put(indexKey,JSON.stringify(next),options);
   if(saved)return json({id,details},creating?201:200);
  }
  return json({error:"The catalog changed while saving. Try again."},409);
 }catch(error){
  const reference=crypto.randomUUID();
  console.error("Workshop reference API failure",reference,error?.stack||String(error));
  return json({error:"Unable to save Workshop details. Reference: "+reference},500);
 }
}
