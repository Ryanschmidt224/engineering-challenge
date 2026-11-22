// Shared persistence contract for item layouts and value-free master templates.
export const workshopCategories=new Set([
 "tools","consumables","electronics","hardware","safety","electrical-power","electrical-controllers",
 "electrical-sensors","electrical-switching","electrical-basic","electrical-wiring","electrical-motors",
 "electrical-displays","tools-measurement","tools-making","consumables-assembly","consumables-general",
 "hardware-fasteners","hardware-materials"
]);
const record=value=>!!value&&typeof value==="object"&&!Array.isArray(value);
const fieldSets={
 identity:new Set(["partNumber","featureTreeDescription","manufacturer","name","subtitle","model"]),
 ordering:new Set(["supplier","supplierPartNumber","supplierUrl","asin","price","packageQuantity"]),
 characteristics:new Set(["typeName","spec"]),
 notes:new Set(["use","caution","orderNotes","documentationUrl","notes"])
};
export function cleanLayout(raw={}, {definitionsOnly=false}={}){
 if(!record(raw)||(raw.sections!==undefined&&!record(raw.sections)))return null;
 const sections={},ids=new Set();
 for(const [key,fields] of Object.entries(fieldSets)){
  const entry=raw.sections?.[key]??{};
  if(!record(entry)||(entry.title!==undefined&&typeof entry.title!=="string")||
     (entry.labels!==undefined&&!record(entry.labels))||
     (entry.hiddenFields!==undefined&&!Array.isArray(entry.hiddenFields))||
     (entry.rows!==undefined&&!Array.isArray(entry.rows)))return null;
  const labels={};
  for(const [name,label] of Object.entries(entry.labels||{})){
   if(!fields.has(name)||typeof label!=="string"||label.length>100)return null;
   labels[name]=label.trim();
  }
  const hidden=entry.hiddenFields||[],rows=entry.rows||[];
  if(hidden.length>30||hidden.some(name=>!fields.has(name))||rows.length>30||
     (entry.title||"").length>100)return null;
  const cleaned=[];
  for(const row of rows){
   if(!record(row)||typeof row.label!=="string"||row.label.length>100||
      (row.value!==undefined&&(typeof row.value!=="string"||row.value.length>1000)))return null;
   // Accept IDs emitted by the older item editor as well as current row-UUIDs.
   const id=row.id;
   if(typeof id!=="string"||!/^(?:row-)?[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id)||ids.has(id))return null;
   ids.add(id);
   if(row.label.trim())cleaned.push({id,label:row.label.trim(),value:definitionsOnly?"":row.value||""});
  }
  sections[key]={title:(entry.title||"").trim(),labels,
   hiddenFields:[...new Set(hidden.filter(name=>name!=="name"))],rows:cleaned};
 }
 return {sections};
}
export function cleanProductSections(raw=[], {definitionsOnly=false}={}){
 if(!Array.isArray(raw)||raw.length>16)return null;
 const sections=[],ids=new Set(),fieldIds=new Set();
 const validId=id=>typeof id==="string"&&/^[a-zA-Z0-9_-]{1,64}$/.test(id);
 for(const part of raw){
  if(!record(part)||!validId(part.id)||ids.has(part.id)||typeof part.title!=="string"||
     part.title.length>100||!Array.isArray(part.fields)||part.fields.length>30)return null;
  ids.add(part.id);
  const fields=[];
  for(const f of part.fields){
   if(!record(f)||!validId(f.id)||fieldIds.has(f.id)||typeof f.label!=="string"||
      !f.label.trim()||f.label.length>100||
      !["text","number","select","checkbox","photo","link"].includes(f.type)||
      !["workshop","project"].includes(f.scope)||
      (f.unit!==undefined&&(typeof f.unit!=="string"||f.unit.length>32))||
      (f.value!==undefined&&(typeof f.value!=="string"||f.value.length>1200))||
      (f.options!==undefined&&(!Array.isArray(f.options)||f.options.length>30||
       f.options.some(o=>typeof o!=="string"||o.length>100))))return null;
   fieldIds.add(f.id);
   fields.push({id:f.id,label:f.label.trim(),type:f.type,scope:f.scope,
    unit:(f.unit||"").trim(),value:!definitionsOnly&&f.scope==="workshop"?(f.value||"").trim():"",
    options:(f.options||[]).map(o=>o.trim()).filter(Boolean)});
  }
  sections.push({id:part.id,title:part.title.trim()||"Untitled section",fields});
 }
 return fieldIds.size<=120?sections:null;
}
export function cleanGenericFields(raw=[]){
 if(!Array.isArray(raw)||raw.length>40)return null;
 const seen=new Set(),result=[];
 for(const item of raw){
  if(!record(item)||typeof item.label!=="string"||item.label.length>100||
     (item.unit!==undefined&&(typeof item.unit!=="string"||item.unit.length>32)))return null;
  const label=item.label.trim(),unit=(item.unit||"").trim();
  if(!label||seen.has(label.toLowerCase()))continue;
  seen.add(label.toLowerCase());result.push({label,unit});
 }
 return result;
}
