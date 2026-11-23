export const projectNumberKey=value=>String(value).toUpperCase().replace(/(\d+)$/,digits=>digits.replace(/^0+(?=\d)/,""));
// Pure custom-part rules. No DOM, globals, API calls or persistence.
// Occurrence/build fields are deliberately separate from engineering details.
const owns=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const plain=(value,label)=>{if(!value||typeof value!=="object"||Array.isArray(value))throw Error(label+" must be an object.");return value;};
function only(value,allowed,label){for(const key of Object.keys(value))if(!allowed.includes(key))throw Error(label+" does not support "+key+".");}
function text(value,label,max,{required=false,multiline=false}={}){
 if(value===undefined)value="";
 if(typeof value!=="string"||value.length>max||(!multiline&&/[\x00-\x1f\x7f]/.test(value))||/\x00/.test(value))throw Error(label+" must be text of at most "+max+" characters.");
 value=value.trim();if(required&&!value)throw Error(label+" is required.");return value;
}
const boolean=(value,label,defaultValue=false)=>{if(value===undefined)return defaultValue;if(typeof value!=="boolean")throw Error(label+" must be true or false.");return value;};
const textFields={description:["Description",5000],purpose:["Purpose",5000],acceptance:["Acceptance criteria",5000],manufacturer:["Manufacturer",180],mpn:["Manufacturer part number",180]};
export function normalizeCustomItem(input){
 plain(input,"Part details");only(input,["name","short_name","part_number","kind","source","is_tool","fields"],"Part details");
 const kind=input.kind===undefined?"part":input.kind,source=input.source===undefined?"custom":input.source;
 if(!["part","document","code"].includes(kind)||source!=="custom")throw Error("Choose a custom part, document or code item.");
 const fields=input.fields===undefined?{}:plain(input.fields,"Engineering fields");only(fields,[...Object.keys(textFields),"specs"],"Engineering fields");
 const normalized={};
 for(const [key,[label,max]] of Object.entries(textFields))if(owns(fields,key)){
  const value=text(fields[key],label,max,{multiline:["description","purpose","acceptance"].includes(key)});
  if(value)normalized[key]=value; // Empty optional text is absent, not another saved field.
 }
 if(owns(fields,"specs")){
  if(!Array.isArray(fields.specs)||fields.specs.length>100)throw Error("Use at most 100 specification rows.");
  const ids=new Set();
  normalized.specs=fields.specs.map(spec=>{
   plain(spec,"Specification");only(spec,["field_id","label","value","unit"],"Specification");
   const field_id=text(spec.field_id,"Specification ID",100,{required:true});
   if(!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(field_id)||ids.has(field_id))throw Error("Specification IDs must be unique and stable.");ids.add(field_id);
   if(spec.field_id!==field_id)throw Error("Specification IDs cannot contain surrounding whitespace.");
   const row={field_id,label:text(spec.label,"Specification label",100,{required:true}),unit:text(spec.unit,"Specification unit",32)};
   if(owns(spec,"value")){
    const value=spec.value;
    if(value!==null&&!["string","boolean","number"].includes(typeof value)||typeof value==="number"&&!Number.isFinite(value)||typeof value==="string"&&(value.length>5000||value.includes("\0")))throw Error("Specification values must be text, a finite number, true, false or null. Omit value for an unset row.");
    row.value=value===0?0:value;
   }
   return row;
  });
  if(!normalized.specs.length)delete normalized.specs;
 }
 return {name:text(input.name,"Name",180,{required:true}),short_name:text(input.short_name,"Short tree name",20),part_number:text(input.part_number,"Part number",80,{required:true}),kind,source,is_tool:boolean(input.is_tool,"Is a tool"),fields:normalized};
}
export function normalizeOccurrence(input={}){
 plain(input,"Build information");only(input,["quantity","unit","build_status","attention","attention_note","hidden"],"Build information");
 const quantity=input.quantity===undefined?1:input.quantity,build_status=input.build_status===undefined?"not_started":input.build_status;
 if(typeof quantity!=="number"||!Number.isFinite(quantity)||quantity<0)throw Error("Quantity must be zero or greater.");
 if(!["not_started","in_progress","complete"].includes(build_status))throw Error("Choose a valid build status.");
 return {quantity:quantity===0?0:quantity,unit:text(input.unit,"Quantity unit",32)||"pcs",build_status,attention:boolean(input.attention,"Needs attention"),attention_note:text(input.attention_note,"Attention note",2500,{multiline:true}),hidden:boolean(input.hidden,"Hidden in tree")};
}
export function allocatePartNumber(numbering,reserved){
 plain(numbering,"Numbering");const prefix=text(numbering.prefix===undefined?"NR":numbering.prefix,"Number prefix",10),digits=numbering.digits===undefined?3:numbering.digits;
 if(!Number.isInteger(digits)||digits<1||digits>8)throw Error("Use between 1 and 8 part-number digits.");
 if(!Array.isArray(reserved))throw Error("Supply every reserved number, including removed items.");
 const used=new Set(reserved.map(number=>projectNumberKey(text(number,"Reserved part number",80,{required:true}))));
 // Assemblies reserve 1–99. Search holes without changing any existing number.
 for(let sequence=100;sequence<=100+used.size;sequence++){
  const number=prefix+String(sequence).padStart(digits,"0");
  if(!used.has(projectNumberKey(number)))return number;
 }
 throw Error("Unable to allocate a part number.");
}
const same=(a,b)=>a.present===b.present&&Object.is(a.value,b.value)&&a.label===b.label&&a.unit===b.unit;
const side=(object,key)=>owns(object,key)?{present:true,value:object[key]}:{present:false};
export function diffCustomItems(beforeInput,afterInput){
 const before=normalizeCustomItem(beforeInput),after=normalizeCustomItem(afterInput),changes=[];
 const add=(key,label,oldValue,newValue)=>{if(!same(oldValue,newValue))changes.push({key,label,before:oldValue,after:newValue});};
 for(const [key,label] of [["name","Name"],["short_name","Short tree name"],["part_number","Part number"],["kind","Kind"],["is_tool","Is a tool"]])add(key,label,side(before,key),side(after,key));
 for(const [key,[label]] of Object.entries(textFields))add("fields."+key,label,side(before.fields,key),side(after.fields,key));
 const oldSpecs=before.fields.specs||[],newSpecs=after.fields.specs||[],oldMap=new Map(oldSpecs.map(row=>[row.field_id,row])),newMap=new Map(newSpecs.map(row=>[row.field_id,row]));
 const specSide=row=>row?{...side(row,"value"),label:row.label,unit:row.unit}:{present:false};
 for(const id of new Set([...oldMap.keys(),...newMap.keys()]))add("spec:"+id,newMap.get(id)?.label||oldMap.get(id).label,specSide(oldMap.get(id)),specSide(newMap.get(id)));
 // Compare the order of surviving IDs; additions/removals already have rows.
 const oldOrder=oldSpecs.filter(row=>newMap.has(row.field_id)).map(row=>row.field_id),newOrder=newSpecs.filter(row=>oldMap.has(row.field_id)).map(row=>row.field_id);
 const orderLabel=id=>{const row=oldMap.get(id);return oldSpecs.filter(other=>other.label===row.label).length>1?row.label+" (row "+(oldSpecs.findIndex(other=>other.field_id===id)+1)+")":row.label;};
 if(oldOrder.join("\0")!==newOrder.join("\0"))changes.push({key:"spec-order",label:"Specification order",before:{present:true,value:oldOrder.map(orderLabel).join(" → ")},after:{present:true,value:newOrder.map(orderLabel).join(" → ")}});
 return changes;
}
export function formatRevisionValue(side){
 if(!side.present)return side.label?"Value not set":"Not set";
 const value=side.value===null?"Null":side.value===""?"Empty text":side.value===true?"Yes":side.value===false?"No":String(side.value);
 return value+(side.unit?" "+side.unit:"");
}
export function diffProjectItems(before,after,beforeBuild,afterBuild){
 const changes=diffCustomItems(before,after),oldBuild=normalizeOccurrence(beforeBuild),newBuild=normalizeOccurrence(afterBuild);
 const labels={quantity:"Quantity",unit:"Quantity unit",build_status:"Status",attention:"Needs attention",attention_note:"Attention note",hidden:"Hidden in tree"};
 for(const [key,label]of Object.entries(labels))if(!Object.is(oldBuild[key],newBuild[key]))changes.push({key:"build."+key,label,before:{present:true,value:oldBuild[key]},after:{present:true,value:newBuild[key]}});
 return changes;
}
