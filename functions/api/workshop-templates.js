// Reusable, category-scoped Workshop layout templates.
// Templates store field definitions and layout only, never item/product values.
import {accountUser} from "./accounts.js";
import {cleanLayout,cleanProductSections,cleanGenericFields,workshopCategories} from "./workshop-template-schema.js";
const key="workshop-templates/v1.json";
const respond=(payload,status=200)=>new Response(JSON.stringify(payload),{
 status,headers:{"content-type":"application/json","cache-control":"no-store"}
});
const validId=id=>typeof id==="string"&&/^tpl-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);
async function read(env){
 const obj=await env.PHOTOS.get(key);
 const value=obj?JSON.parse(await obj.text()):{};
 if(!value||typeof value!=="object"||Array.isArray(value))throw Error("Invalid template index");
 return {value,etag:obj?.etag||null};
}
async function handle({request,env}){
 if(!env.PHOTOS)return respond({error:"Workshop storage unavailable"},503);
 const url=new URL(request.url);
 if(request.method==="GET"){
  const {value}=await read(env);
  // A damaged entry must not prevent the remaining catalog from opening.
  const templates=Object.values(value).filter(item=>item&&validId(item.id)&&
   typeof item.name==="string"&&typeof item.category==="string"&&
   cleanLayout(item.tableLayout)&&cleanProductSections(item.productSections)&&cleanGenericFields(item.genericFields));
  return respond({templates:templates.sort((a,b)=>a.category.localeCompare(b.category)||a.name.localeCompare(b.name))});
 }
 const user=await accountUser(request,env),admin=user?.role==="admin";
 if(!user&&!admin)return respond({error:"Sign in to edit Workshop templates"},401);
 if(request.headers.get("origin")!==url.origin)return respond({error:"Invalid request origin"},403);
 if(!["POST","PUT","DELETE"].includes(request.method))return respond({error:"Method not allowed"},405);
 // Bound decoded input even when Content-Length is missing or incorrect.
 const reader=request.body?.getReader();
 let size=0,chunks=[];
 if(reader)try{
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
   if(size>256*1024){await reader.cancel();return respond({error:"Template request exceeds 256 KB"},413)}
   chunks.push(value);}
 }finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let offset=0;
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
 let body;try{body=JSON.parse(new TextDecoder().decode(bytes))}catch{}
 if(!body||typeof body!=="object"||Array.isArray(body))return respond({error:"Invalid template request"},400);
 const deleting=request.method==="DELETE";
 const id=request.method==="POST"?"tpl-"+crypto.randomUUID():body.id;
 if(!validId(id))return respond({error:"Invalid template ID"},400);
 if(request.method!=="POST"&&(!Object.hasOwn(body,"expectedRevision")||
    !(body.expectedRevision===null||typeof body.expectedRevision==="string")))
  return respond({error:"Reload this template before saving or deleting it.",code:"REVISION_REQUIRED"},428);
 let payload;
 if(!deleting){
  if(typeof body.name!=="string"||body.name.length>90||typeof body.category!=="string"||body.category.length>60)
   return respond({error:"Invalid template name or category"},400);
  const name=body.name.trim();
  const category=body.category.trim();
  if(!name||!workshopCategories.has(category))return respond({error:"Choose a template name and category"},400);
  const layout=cleanLayout(body.tableLayout,{definitionsOnly:true}),genericFields=cleanGenericFields(body.genericFields),productSections=cleanProductSections(body.productSections,{definitionsOnly:true});
  if(!layout||!genericFields||!productSections)return respond({error:"Invalid template fields or layout"},400);
  payload={id,name,category,tableLayout:layout,genericFields,productSections};
 }
 for(let attempt=0;attempt<3;attempt++){
  const {value,etag}=await read(env);
  if(request.method!=="POST"&&!value[id])return respond({error:"Template not found. Refresh the template list."},404);
  if(request.method!=="POST"&&(body.expectedRevision??null)!==(value[id].revision??null))
   return respond({error:"This template changed since you opened it. Your draft is kept; reopen the saved template before retrying.",code:"REVISION_CONFLICT"},409);
  if(request.method==="POST"&&Object.keys(value).length>=300)return respond({error:"Template limit reached"},413);
  if(!deleting&&Object.values(value).some(item=>item&&item.id!==id&&item.category===payload.category&&typeof item.name==="string"&&item.name.toLowerCase()===payload.name.toLowerCase()))
   return respond({error:"This category already has a template with that name"},409);
  const next={...value};
  if(deleting)delete next[id];
  else next[id]={...payload,revision:crypto.randomUUID(),updatedAt:new Date().toISOString()};
  const outcome=await env.PHOTOS.put(key,JSON.stringify(next),{
   ...(etag?{onlyIf:{etagMatches:etag}}:{onlyIf:{etagDoesNotMatch:"*"}}),
   httpMetadata:{contentType:"application/json"}
  });
  if(outcome)return respond({template:next[id]||null,deleted:deleting});
 }
 return respond({error:"Template changed during save. Retry."},409);
}

export async function onRequest(context){
 try{return await handle(context)}catch(error){
  console.error("Workshop template storage failure",error);
  return respond({error:"Workshop templates are temporarily unavailable. Your draft is kept; try again."},503);
 }
}
