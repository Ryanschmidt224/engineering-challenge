/* Building Schmidt engineering core.
 * Pure functions only: no DOM, Cloudflare, network, filesystem, or timers.
 * Works in browser, a Node process, or a future desktop host.
 */
(function(root,factory){
 const api=factory();
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 if(root)root.BSEngineeringCore=api;
})(typeof globalThis!=="undefined"?globalThis:null,function(){
 "use strict";
 const SCHEMA_VERSION=1;
 const PROJECT_IDS=Object.freeze(["launcher","linear","robot","buck","motorlab","coiltest"]);
 const asText=x=>typeof x==="string"?x:"";
 const jsonRecord=(bytes,decoder)=>{
  try{return JSON.parse(decoder(bytes))}catch{return null}
 };
 const unique=items=>[...new Set(items)];
 // A BOM occurrence is not a part definition. Separate without changing legacy IDs
 // or rewriting any stored object.
 function projectModel(projectId, records, options={}){
  if(!PROJECT_IDS.includes(projectId))throw Error("Unsupported project");
  const get=key=>records instanceof Map?records.get(key):records[key];
  const parse=key=>{
   const raw=get(key);
   if(raw==null)return null;
   if(typeof raw==="object"&&!ArrayBuffer.isView(raw)&&!(raw instanceof ArrayBuffer))return raw;
   if(typeof raw==="string")return jsonRecord(raw,x=>x);
   const text=options.decode||((x)=>new TextDecoder().decode(x));
   return jsonRecord(raw,text);
  };
  const parts=parse("components/"+projectId+".json")||[];
  const tree=parse("trees/"+projectId+".json")||[];
  if(!Array.isArray(parts)||!Array.isArray(tree))throw Error("Malformed stored project data");
  const definitions=[],occurrences=[],ids=new Set(),errors=[];
  for(const item of parts){
   if(!item||typeof item!=="object"||typeof item.id!=="string"||ids.has(item.id)){
    errors.push("Duplicate or missing part ID");continue;
   }
   ids.add(item.id);
   const definitionId=item.sharedPartRef||("legacy:"+projectId+":"+item.id);
   definitions.push({
    id:definitionId,legacyPartId:item.id,name:asText(item.name),
    manufacturer:asText(item.manufacturer),model:asText(item.model),
    category:asText(item.category),specifications:Array.isArray(item.specifications)?item.specifications:[],
    source:{projectId,partId:item.id}
   });
   occurrences.push({
    id:"occurrence:"+projectId+":"+item.id,partDefinitionId:definitionId,
    legacyPartId:item.id,assemblyId:item.assemblyId??null,
    quantity:item.quantity??null,unit:item.quantityUnit||"pcs",
    generatedFrom:item.generatedFrom||null,sharedPartRef:item.sharedPartRef||null
   });
  }
  for(const occurrence of occurrences){
   if(occurrence.generatedFrom&&!ids.has(occurrence.generatedFrom))
    errors.push("Missing source part "+occurrence.generatedFrom);
  }
  return {
   schemaVersion:SCHEMA_VERSION,id:projectId,assemblies:tree,
   partDefinitions:definitions,bomOccurrences:occurrences,errors,
   // Data in records is the canonical payload: this is an immutable *view*
   // rather than a lossy conversion or a migration.
   legacyKeys:["components/"+projectId+".json","trees/"+projectId+".json"]
  };
 }
 function validateRecipe(steps){
  if(!Array.isArray(steps)||steps.length>150)return {ok:false,error:"Invalid recipe"};
  const ids=new Set();
  for(const step of steps){
   if(!step||typeof step.id!=="string"||!/^[a-zA-Z0-9_-]{1,80}$/.test(step.id)||
     ids.has(step.id)||typeof step.title!=="string"||!step.title.trim())
    return {ok:false,error:"Duplicate or invalid recipe step"};
   ids.add(step.id);
  }
  return {ok:true,count:steps.length};
 }
 const canonicalPartIdentity=item=>{
  const asin=asText(item.asin).trim().toLowerCase();
  if(asin)return "asin:"+asin;
  const manufacturer=asText(item.manufacturer).trim().toLowerCase();
  const model=asText(item.model).trim().toLowerCase();
  return manufacturer&&model?"model:"+manufacturer+":"+model:
   "name:"+asText(item.name).trim().toLowerCase()+"|"+manufacturer+"|"+model;
 };
 // Verify that identical part definitions can be referenced from many BOM lines.
 const groupedDefinitions=definitions=>{
  const byId=new Map();
  for(const item of definitions){
   if(!byId.has(item.id))byId.set(item.id,item);
  }
  return [...byId.values()];
 };
 return Object.freeze({SCHEMA_VERSION,PROJECT_IDS,projectModel,validateRecipe,canonicalPartIdentity,groupedDefinitions,unique});
});
