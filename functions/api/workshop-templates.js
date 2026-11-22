// Reusable, category-scoped Workshop layout templates.
// Templates store field definitions and layout only, never item/product values.
import {isAdmin} from "./auth.js";
const key="workshop-templates/v1.json";
const respond=(payload,status=200)=>new Response(JSON.stringify(payload),{
 status,headers:{"content-type":"application/json","cache-control":"no-store"}
});
const validId=id=>typeof id==="string"&&/^tpl-[0-9a-f-]{36}$/.test(id);
const allowedSections=new Set(["identity","ordering","characteristics","notes"]);
const fieldsBySection={
 identity:new Set(["partNumber","featureTreeDescription","manufacturer","name","subtitle","model"]),
 ordering:new Set(["supplier","supplierPartNumber","supplierUrl","asin","price","packageQuantity"]),
 characteristics:new Set(["typeName","spec"]),
 notes:new Set(["use","caution","orderNotes","documentationUrl","notes"])
};
function cleanLayout(raw){
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return null;
 const sections={};
 if(raw.sections&&(!raw.sections||typeof raw.sections!=="object"||Array.isArray(raw.sections)))return null;
 for(const key of allowedSections){
  const value=raw.sections?.[key]||{};
  if(!value||typeof value!=="object"||Array.isArray(value))return null;
  const labels={};
  for(const [field,label] of Object.entries(value.labels||{})){
   if(!fieldsBySection[key].has(field)||typeof label!=="string")return null;
   labels[field]=label.trim().slice(0,100);
  }
  const hidden=Array.isArray(value.hiddenFields)?value.hiddenFields:[];
  if(hidden.length>30||hidden.some(field=>!fieldsBySection[key].has(field)))return null;
  const rows=Array.isArray(value.rows)?value.rows:[];
  if(rows.length>30)return null;
  const cleaned=[];
  for(const row of rows){
   if(!row||typeof row!=="object"||typeof row.label!=="string")return null;
   if(!row.label.trim())continue;
   cleaned.push({id:typeof row.id==="string"&&/^row-[0-9a-f-]{36}$/.test(row.id)?row.id:"row-"+crypto.randomUUID(),
    label:row.label.trim().slice(0,100),value:""});
  }
  sections[key]={title:String(value.title||"").trim().slice(0,100),
   labels,hiddenFields:[...new Set(hidden.filter(field=>field!=="name"))],rows:cleaned};
 }
 return {sections};
}
function cleanBuilderSections(raw){
 if(!Array.isArray(raw)||raw.length>16)return null;
 const sections=[],ids=new Set(),fieldIds=new Set();
 for(const section of raw){
  if(!section||typeof section!=="object"||typeof section.id!=="string"||
     !/^[a-zA-Z0-9_-]{1,64}$/.test(section.id)||ids.has(section.id)||
     typeof section.title!=="string"||section.title.length>100||
     !Array.isArray(section.fields)||section.fields.length>30)return null;
  ids.add(section.id);
  const fields=[];
  for(const field of section.fields){
   if(!field||typeof field!=="object"||typeof field.id!=="string"||
      !/^[a-zA-Z0-9_-]{1,64}$/.test(field.id)||fieldIds.has(field.id)||
      typeof field.label!=="string"||!field.label.trim()||field.label.length>100||
      !["text","number","select","checkbox","photo","link"].includes(field.type)||
      !["workshop","project"].includes(field.scope)||
      (field.unit!==undefined&&(typeof field.unit!=="string"||field.unit.length>32))||
      (field.options!==undefined&&(!Array.isArray(field.options)||field.options.length>30||
       field.options.some(option=>typeof option!=="string"||option.length>100))))return null;
   fieldIds.add(field.id);
   fields.push({id:field.id,label:field.label.trim(),type:field.type,
    scope:field.scope,unit:String(field.unit||"").slice(0,32),
    value:"",options:Array.isArray(field.options)?field.options:[]});
  }
  sections.push({id:section.id,title:section.title.trim()||"Untitled section",fields});
 }
 return fieldIds.size<=120?sections:null;
}
function cleanGenericFields(raw){
 if(!Array.isArray(raw)||raw.length>40)return null;
 const seen=new Set(),result=[];
 for(const item of raw){
  if(!item||typeof item.label!=="string"||(item.unit!==undefined&&typeof item.unit!=="string"))return null;
  const label=item.label.trim().slice(0,100),unit=String(item.unit||"").trim().slice(0,32);
  if(!label||seen.has(label.toLowerCase()))continue;
  seen.add(label.toLowerCase());result.push({label,unit});
 }
 return result;
}
async function read(env){
 const obj=await env.PHOTOS.get(key);
 return {value:obj?await obj.json():{},etag:obj?.etag||null};
}
export async function onRequest({request,env}){
 if(!env.PHOTOS)return respond({error:"Workshop storage unavailable"},503);
 const url=new URL(request.url);
 const {value:initial}=await read(env);
 if(request.method==="GET"){
  return respond({templates:Object.values(initial).sort((a,b)=>a.category.localeCompare(b.category)||a.name.localeCompare(b.name))});
 }
 if(!await isAdmin(request,env))return respond({error:"Owner access is required to edit Workshop templates"},403);
 if(request.headers.get("origin")!==url.origin)return respond({error:"Invalid request origin"},403);
 if(!["POST","PUT","DELETE"].includes(request.method))return respond({error:"Method not allowed"},405);
 const body=await request.json().catch(()=>null);
 if(!body||typeof body!=="object")return respond({error:"Invalid template request"},400);
 const deleting=request.method==="DELETE";
 const id=request.method==="POST"?"tpl-"+crypto.randomUUID():body.id;
 if(!validId(id))return respond({error:"Invalid template ID"},400);
 let payload;
 if(!deleting){
  const name=String(body.name||"").trim().slice(0,90);
  const category=String(body.category||"").trim().slice(0,60);
  if(!name||!/^[a-z][a-z0-9-]{0,59}$/.test(category))return respond({error:"Choose a template name and category"},400);
  const layout=cleanLayout(body.tableLayout),genericFields=cleanGenericFields(body.genericFields||[]),productSections=cleanBuilderSections(body.productSections||[]);
  if(!layout||!genericFields||!productSections)return respond({error:"Invalid template fields or layout"},400);
  payload={id,name,category,tableLayout:layout,genericFields,productSections};
 }
 for(let attempt=0;attempt<3;attempt++){
  const {value,etag}=await read(env);
  if(request.method!=="POST"&&!value[id])return respond({error:"Template not found. Refresh the template list."},404);
  if(request.method!=="POST"&&(!Object.hasOwn(body,"expectedRevision")||
     (body.expectedRevision??null)!==(value[id].revision??null)))
   return respond({error:"This template changed since you opened it. Your draft has not been saved. Reload the template before trying again.",code:"TEMPLATE_CONFLICT",revision:value[id].revision??null},409);
  if(request.method==="POST"&&Object.keys(value).length>=300)return respond({error:"Template limit reached"},413);
  if(!deleting&&Object.values(value).some(item=>item.id!==id&&item.category===payload.category&&item.name.toLowerCase()===payload.name.toLowerCase()))
   return respond({error:"This category already has a template with that name"},409);
  const next={...value};
  if(deleting)delete next[id];
  else next[id]={...payload,updatedAt:new Date().toISOString(),revision:crypto.randomUUID()};
  const outcome=await env.PHOTOS.put(key,JSON.stringify(next),{
   ...(etag?{onlyIf:{etagMatches:etag}}:{onlyIf:{etagDoesNotMatch:"*"}}),
   httpMetadata:{contentType:"application/json"}
  });
  if(outcome)return respond({template:next[id]||null,deleted:deleting});
 }
 return respond({error:"Template changed during save. Retry."},409);
}
