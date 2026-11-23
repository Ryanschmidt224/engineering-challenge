// Pure record validation, shared by the preview editor and API.
export const recordPrompts=Object.freeze({
 test:{checked:"What was checked?",method:"Method",result:"Result"},
 problem:{happened:"What happened?",cause:"Suspected cause",resolution:"Resolution"},
 note:{text:"Note"},
 change_note:{changed:"What changed?",why:"Why?"}
});
export const recordLabels=Object.freeze({test:"Test",problem:"Problem",note:"Note",change_note:"Change note"});
export function normalizeProjectRecord(input){
 if(!input||typeof input!=="object"||Array.isArray(input)||!Object.hasOwn(recordPrompts,input.type))throw Error("Choose Test, Problem, Note or Change note.");
 const text=(value,max,label)=>{if(value===undefined)return "";if(typeof value!=="string"||value.length>max||value.includes("\0"))throw Error(label+" is too long or invalid.");return value.trim();};
 for(const key of Object.keys(input))if(!["type","title","fields","event_date","fileIds"].includes(key))throw Error("Unknown record field: "+key);
 const fields=input.fields===undefined?{}:input.fields;if(!fields||typeof fields!=="object"||Array.isArray(fields))throw Error("Record fields must be an object.");
 const normalized={};
 for(const key of Object.keys(fields)){
  if(!Object.hasOwn(recordPrompts[input.type],key)&&!(input.type==="problem"&&key==="status"))throw Error("Unknown record prompt: "+key);
  if(key==="status")continue;
  const value=text(fields[key],5000,recordPrompts[input.type][key]);if(value)normalized[key]=value;
 }
 if(input.type==="problem"){
  if(fields.status!==undefined&&!["open","resolved"].includes(fields.status))throw Error("Choose Open or Resolved.");
  normalized.status=fields.status||"open";
 }
 const fileIds=input.fileIds===undefined?[]:input.fileIds;
 if(!Array.isArray(fileIds)||fileIds.length>20||new Set(fileIds).size!==fileIds.length||fileIds.some(id=>typeof id!=="string"||!/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(id)))throw Error("Choose at most 20 distinct uploaded files.");
 if(!Object.entries(normalized).some(([key,value])=>key!=="status"&&!!value)&&!fileIds.length)throw Error("Add at least one meaningful field or attachment.");
 const event_date=text(input.event_date===null?undefined:input.event_date,10,"Event date");
 if(event_date&&(!/^\d{4}-\d{2}-\d{2}$/.test(event_date)||!Number.isFinite(Date.parse(event_date+"T00:00:00Z"))||new Date(event_date+"T00:00:00Z").toISOString().slice(0,10)!==event_date))throw Error("Enter a valid event date, or leave it blank.");
 const first=Object.entries(normalized).find(([key,value])=>key!=="status"&&value)?.[1];
 return {type:input.type,title:text(input.title,180,"Title")||first?.split(/\r?\n/)[0].slice(0,100)||recordLabels[input.type]+" with attachments",fields:normalized,event_date:event_date||null,fileIds:[...fileIds]};
}
