import {upgradePracticeRecords} from "./record-upgrades.js";
import {getFamilyProjectPart} from "./workshop-db.js";
import {capturePartRevision} from "./part-revision-snapshot.js";
import {resolveFunctionalPart} from "./functional-part-model.js";
import {projectAllowed,canEditProject,VALID_PROJECT_ID} from "./projects.js";
import {isProjectRecipeFile} from "./recipe-files.js";
const uuid=/^[a-f0-9-]{36}$/i;
const idPattern=/^[a-zA-Z0-9_-]{1,80}$/;
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const validText=(v,max)=>typeof v==="string"&&v.length<=max;
const statuses=new Set(["investigating","resolved","unresolved"]);
const types=new Set(["observation","theory","attempt","revision","result","lesson","note","resolution"]);
const scopes=new Set(["assembly","part","step"]);
const trim=(text,max)=>String(text||"").trim().slice(0,max);
const validDate=value=>typeof value==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+"T12:00:00Z"))&&new Date(value+"T12:00:00Z").toISOString().slice(0,10)===value;
const entryTypes=new Set(["observation","attempt","lesson","theory","revision","result","note","resolution"]);
const legacyFields=["observation","theory","resolution","note"];
const categoryFields={
 test:["theory","attempt","result"],
 revision:["revision","theory","result"],failure:legacyFields,note:["note"],photos:[]
};
const resolutionChoices=new Set(["yes","no","maybe"]);
const safeEntry=(entry,project)=>entry&&entryTypes.has(entry.type)&&(entry.type!=="resolution"||resolutionChoices.has(entry.resolution))&&validText(entry.text,5000)&&(entry.text.trim()||(Array.isArray(entry.files)&&entry.files.length>0)||entry.type==="resolution")&&
 validDate(entry.date)&&Array.isArray(entry.files||[])&&(entry.files||[]).length<=12&&
 (entry.files||[]).every(file=>isProjectRecipeFile(file,project))&&validText(entry.fileName||"",120);
const validNotePhotos=(photos,project)=>Array.isArray(photos)&&photos.length<=12&&
 photos.every(id=>isProjectRecipeFile(id,project));
const validPhotoNames=(names,photos)=>names===undefined||(names&&typeof names==="object"&&!Array.isArray(names)&&
 Object.entries(names).length<=12&&Object.entries(names).every(([id,name])=>
  photos.includes(id)&&validText(name,120)));
const imageAttachment=/\.(?:jpg|jpeg|png|webp|gif|heic|heif)$/i;
const validPhotoEntry=(photos,project)=>validNotePhotos(photos,project)&&
 photos.every(id=>imageAttachment.test(id));
const normalizedEntry=(entry)=>({id:crypto.randomUUID(),type:entry.type,text:entry.text.trim(),date:entry.date,
 files:[...new Set(entry.files||[])],fileName:trim(entry.fileName,120),...(entry.type==="resolution"?{resolution:entry.resolution}:{}),createdAt:new Date().toISOString()});
const validEntries=(entries,fields,project)=>Array.isArray(entries)&&entries.length<=fields.length&&
 entries.every(item=>safeEntry(item,project)&&fields.includes(item.type))&&new Set(entries.map(item=>item.type)).size===entries.length;
// These fields remain in older records after their fixed inputs are retired.
const retiredField={revision:"result",failure:"note",note:"note"};
const validNotes=(notes,project)=>notes===undefined||(Array.isArray(notes)&&notes.length<=30&&notes.every(note=>
 note?.type==="note"&&validText(note.descriptor,180)&&note.descriptor.trim()&&safeEntry(note,project)&&note.text.trim()));
const normalizeNotes=notes=>notes===undefined?{}:{notes:notes.map(note=>({
 ...normalizedEntry(note),descriptor:note.descriptor.trim()
}))};
const entryStatus=entries=>{
 const resolution=entries.find(entry=>entry.type==="resolution");
 return resolution?({yes:"resolved",no:"unresolved",maybe:"investigating"})[resolution.resolution]:"investigating";
};
export async function handleInvestigations(request,env){
 const url=new URL(request.url),project=url.searchParams.get("project");
 if(!await projectAllowed(env,project,request))return json({error:"Invalid project"},400);
 if(!env.PHOTOS)return json({error:"Storage unavailable"},503);
 if(request.method==="GET"&&url.searchParams.has("thumbnail")){
  const requested=url.searchParams.get("thumbnail")||"";
  const prefix="part-revisions/"+project+"/";
  if(!requested.startsWith(prefix)||!new RegExp("^part-revisions/"+project+"/[a-f0-9-]{36}/[a-f0-9-]{36}/thumbnail$","i").test(requested))
   return json({error:"Invalid archived image"},400);
  const image=await env.PHOTOS.get(requested);
  if(!image)return json({error:"Archived image not found"},404);
  return new Response(image.body,{headers:{"content-type":image.httpMetadata?.contentType||"image/jpeg",
   "cache-control":"public, max-age=3600","x-content-type-options":"nosniff"}});
 }
 const key="investigations/"+project+".json";
 let object=await env.PHOTOS.get(key);
 const original=object?await object.text():null;
 let saved=original?JSON.parse(original):{records:[],revision:null};
 if(object&&["GET","POST"].includes(request.method)){
  try{({object,saved}=await upgradePracticeRecords(env,project,object,saved,original));}
  catch{return json({error:"Old records could not be upgraded safely. Retry before editing.",code:"RECORD_UPGRADE_RETRY"},503);}
 }
 if(request.method==="GET"&&url.searchParams.has("revision")){
  if(!await canEditProject(request,env,project))return json({error:"Project owner sign-in required"},403);
  const record=(saved.records||[]).find(record=>record.id===url.searchParams.get("revision")&&record.partSnapshot);
  if(!record)return json({error:"Revision not found"},404);
  if(url.searchParams.has("asset")){
   const index=Number(url.searchParams.get("asset")),assets=record.partSnapshot.assets||[],asset=assets[index];
   if(!Number.isSafeInteger(index)||index<0||!asset||!asset.archive.startsWith("part-revisions/"+project+"/"+record.ownerId+"/"+record.id+"/objects/"))return json({error:"Revision file not found"},404);
   const file=await env.PHOTOS.get(asset.archive);if(!file)return json({error:"Saved revision file is missing"},404);
   const type=file.httpMetadata?.contentType||"application/octet-stream",inline=/^image\/(?:jpeg|png|webp|gif)$/.test(type)&&url.searchParams.get("view")==="1";
   return new Response(file.body,{headers:{"content-type":inline?type:"application/octet-stream","content-disposition":(inline?"inline":"attachment")+"; filename*=UTF-8''"+encodeURIComponent(asset.name||asset.original.split("/").pop()),"cache-control":"private, no-store","x-content-type-options":"nosniff","content-security-policy":"default-src 'none'; sandbox"}});
  }
  return new Response(JSON.stringify(record.partSnapshot,null,2),{headers:{"content-type":"application/json","content-disposition":"attachment; filename=part-revision-"+record.id+".json","cache-control":"private, no-store"}});
 }
 if(request.method==="GET")return json({records:Array.isArray(saved.records)?saved.records:[],revision:saved.revision??null});
 if(request.method!=="POST")return json({error:"Method not allowed"},405);
 if(!await canEditProject(request,env,project))return json({error:"Administrator login required"},401);
 const data=await request.json().catch(()=>null);
 if(!data||typeof data!=="object"||Array.isArray(data))return json({error:"Invalid request"},400);
 const replay=data.action==="createPartRevision"&&(saved.records||[]).find(record=>record.operationId===data.operationId&&record.partSnapshot);
 if(replay){
  if(replay.ownerId!==data.partId||JSON.stringify(replay.revisionRequest)!==JSON.stringify({expectedPartRevision:data.expectedPartRevision??null,expectedWorkspaceRevision:data.expectedWorkspaceRevision??null}))return json({error:"This operation ID was already used for a different revision"},409);
  return json({ok:true,revision:saved.revision??null,records:saved.records,createdId:replay.id});
 }
 if((data.expectedRevision??null)!==(saved.revision??null))return json({error:"Investigations changed elsewhere. Reload before saving.",revision:saved.revision??null},409);
 const records=Array.isArray(saved.records)?saved.records:[];
 if(records.length>300)return json({error:"Project investigation limit reached"},413);
 let changed,record,createdId;
 if(data.action==="create"){
  const scope=data.scope,ownerType=data.ownerType,ownerId=data.ownerId,stepId=data.stepId||"";
  if(!scopes.has(scope)||!validText(data.title,180)||
    (!data.title.trim()&&!["note","photos"].includes(data.category))||
    !["assembly","part"].includes(ownerType)||!validText(ownerId,80)||
    (ownerType==="part"?!uuid.test(ownerId):ownerId!=="__root__"&&!idPattern.test(ownerId))||
    (scope==="step"?!idPattern.test(stepId):!!stepId)||
    (scope==="part"&&ownerType!=="part")||(scope==="assembly"&&ownerType!=="assembly"))
    return json({error:"Invalid investigation details"},400);
  if(!validNotes(data.notes,project)||!validText(data.description??"",5000)||
   (data.photos!==undefined&&!(data.category==="photos"?
     validPhotoEntry(data.photos,project):validNotePhotos(data.photos,project)))||
   !validPhotoNames(data.photoNames,data.photos||[]))
   return json({error:"Invalid notes, description, or photos"},400);
  if(data.category!==undefined&&(typeof data.category!=="string"||!Object.hasOwn(categoryFields,data.category)||!validEntries(data.entries,categoryFields[data.category],project)))
   return json({error:"Invalid record category or fields"},400);
  if(records.length>=300)return json({error:"Project investigation limit reached"},413);
  // One child-entry level under a direct Work Instruction entry. Keep these
  // in the existing record store, identified by a parent record ID.
  const parentRecordId=data.parentRecordId||"";
  if(parentRecordId){
   const parent=records.find(item=>item.id===parentRecordId);
   if(!parent||parent.parentRecordId||parent.scope!=="step"||
      parent.scope!==scope||parent.ownerType!==ownerType||
      parent.ownerId!==ownerId||parent.stepId!==stepId||
      parent.lifecycle==="archived"||parent.archivedAt)
    return json({error:"Cannot add a nested entry to this parent."},400);
  }
  // Verify the owner still exists rather than accepting orphan investigations.
  let ownerImplementation=null;
  if(ownerType==="part"){
   const partsFile=await env.PHOTOS.get("components/"+project+".json");
   const parts=partsFile?JSON.parse(await partsFile.text()):[];
   const part=(Array.isArray(parts)?parts.find(item=>item.id===ownerId):null)||await getFamilyProjectPart(env,project,ownerId);
   if(!part)return json({error:"Part no longer exists"},404);
   const selected=part.familyUse?part:resolveFunctionalPart(part);
   ownerImplementation={id:selected?.productId||selected?.selectedImplementationId||null,
    name:selected?.implementationResolved?selected.implementationName||selected.model||"":""};
  }else if(ownerId!=="__root__"){
   const treeFile=await env.PHOTOS.get("trees/"+project+".json");
   const tree=treeFile?JSON.parse(await treeFile.text()):[];
   if(!Array.isArray(tree)||!tree.some(node=>node.id===ownerId))return json({error:"Assembly no longer exists"},404);
  }
    record={id:crypto.randomUUID(),scope,ownerType,ownerId,stepId,parentRecordId,title:data.title.trim(),
   implementationId:ownerImplementation?.id||null,implementationName:ownerImplementation?.name||"",
   status:"investigating",lifecycle:"active",entries:[],  description:["note","photos"].includes(data.category)?(data.description||"").trim():"",photos:["note","photos"].includes(data.category)?(data.photos||[]):[],
   photoNames:["note","photos"].includes(data.category)?(data.photoNames||{}):{},createdAt:new Date().toISOString()};
  if(data.category!==undefined)Object.assign(record,{category:data.category,date:new Date().toISOString().slice(0,10),
   entries:data.entries.map(normalizedEntry),status:entryStatus(data.entries),...normalizeNotes(data.notes)});
  createdId=record.id;
  changed=[...records,record];
 }else if(data.action==="archiveRecord"){
  record=records.find(item=>item.id===data.id);
  if(!record)return json({error:"Record not found"},404);
  if(record.archivedAt||record.partSnapshot)return json({error:"Record is already archived"},409);
  const note=data.note??"";
  if(!validText(note,2500))return json({error:"Archive note is too long"},400);
  // Server-generated timestamp prevents user clocks from changing archive order.
  const archivedAt=new Date().toISOString();
  changed=records.map(item=>(item.id===record.id||item.parentRecordId===record.id)
   ?{...item,lifecycle:"archived",archivedAt,archiveNote:item.id===record.id?note.trim():"Archived with parent entry."}:item);
 }else if(data.action==="createPartRevision"){
  if(!uuid.test(data.partId)||!uuid.test(data.operationId))return json({error:"Invalid revision command"},400);
  if(records.length>=300)return json({error:"Project investigation limit reached"},413);
  const captured=await capturePartRevision(request,env,project,data,records);
  if(captured.error)return json({error:captured.error},captured.status);
  record=captured.record;createdId=record.id;changed=[...records,record];
 }else if(data.action==="rename"){
  record=records.find(item=>item.id===data.id);
  if(!record)return json({error:"Investigation not found"},404);
  if(!validText(data.title,180)||!data.title.trim())return json({error:"Invalid investigation title"},400);
  const title=data.title.trim();
  if(title===record.title)return json({ok:true,revision:saved.revision??null,records});
  const audit={id:crypto.randomUUID(),type:"revision",text:"Renamed investigation from \""+record.title+"\" to \""+title+"\".",
   date:new Date().toISOString().slice(0,10),files:[],fileName:"",createdAt:new Date().toISOString()};
  changed=records.map(item=>item.id===record.id?{...item,title,entries:[...(item.entries||[]),audit]}:item);
 }else if(data.action==="deleteRecord"){
  record=records.find(item=>item.id===data.id);
  if(!record)return json({error:"Investigation not found"},404);
  changed=records.filter(item=>item.id!==record.id&&item.parentRecordId!==record.id);
 }else if(data.action==="editRecord"){
  record=records.find(item=>item.id===data.id);
  if(!record)return json({error:"Investigation not found"},404);
  if(!validNotes(data.notes,project)||!validText(data.description??"",5000)||
   (data.photos!==undefined&&!(record.category==="photos"?
    validPhotoEntry(data.photos,project):validNotePhotos(data.photos,project)))||
   !validPhotoNames(data.photoNames,data.photos??record.photos??[]))
   return json({error:"Invalid notes, description, or photos"},400);
  const allFields=categoryFields[record.category]||legacyFields;
  const fields=data.notes===undefined?allFields:allFields.filter(type=>type!==retiredField[record.category||"failure"]);
  if(!validText(data.title,180)||(!data.title.trim()&&!["note","photos"].includes(record.category))||!validEntries(data.entries,fields,project))return json({error:"Invalid record details"},400);
  const status=entryStatus(data.entries);
  // Retain older entry types and earlier updates; replace only the latest editable entry per field.
  const previous=record.entries||[];
  const latest=new Map();
  previous.forEach((entry,index)=>{if(fields.includes(entry.type))latest.set(entry.type,index)});
  const retained=previous.filter((entry,index)=>latest.get(entry.type)!==index);
  const entries=[...retained,...data.entries.map(normalizedEntry)];
  if(entries.length>100)return json({error:"Too many entries in investigation"},413);
  changed=records.map(item=>item.id===record.id?{...item,title:data.title.trim(),date:record.date||record.createdAt?.slice(0,10)||new Date().toISOString().slice(0,10),status,entries,...normalizeNotes(data.notes),...(["note","photos"].includes(record.category)?{description:(data.description??record.description??"").trim(),photos:data.photos??record.photos??[],photoNames:data.photoNames??record.photoNames??{}}:{})}:item);
 }else if(data.action==="appendBatch"){
  record=records.find(item=>item.id===data.id);
  if(!record)return json({error:"Investigation not found"},404);
  const incoming=data.entries;
  if(!Array.isArray(incoming)||!incoming.length||incoming.length>5||incoming.some(item=>!safeEntry(item,project)))
   return json({error:"Invalid investigation update"},400);
  if((record.entries||[]).length+incoming.length>100)return json({error:"Too many entries in investigation"},413);
  const resolution=[...incoming].reverse().find(entry=>entry.type==="resolution");
  const status=resolution?({yes:"resolved",no:"unresolved",maybe:"investigating"})[resolution.resolution]:record.status;
  changed=records.map(item=>item.id===record.id?{...item,status,entries:[...(item.entries||[]),...incoming.map(normalizedEntry)]}:item);
 }else if(data.action==="append"){
  record=records.find(item=>item.id===data.id);
  const entry=data.entry;
  if(!record)return json({error:"Investigation not found"},404);
  if(!entry||!types.has(entry.type)||(entry.type==="resolution"&&!resolutionChoices.has(entry.resolution))||!validText(entry.text,5000)||(!entry.text.trim()&&!(Array.isArray(entry.files)&&entry.files.length)&&entry.type!=="resolution")||
     !Array.isArray(entry.files||[])||(entry.files||[]).length>12||
     !(entry.files||[]).every(file=>isProjectRecipeFile(file,project))||
     !validText(entry.fileName||"",120))return json({error:"Invalid investigation entry"},400);
  if((record.entries||[]).length>=100)return json({error:"Too many entries in investigation"},413);
  const next={...normalizedEntry({...entry,date:validDate(entry.date)?entry.date:new Date().toISOString().slice(0,10)})};
  const status=entry.type==="resolution"?({yes:"resolved",no:"unresolved",maybe:"investigating"})[entry.resolution]:record.status;
  changed=records.map(item=>item.id===record.id?{...item,status,entries:[...(item.entries||[]),next]}:item);
 }else if(data.action==="status"){
  record=records.find(item=>item.id===data.id);
  if(!record||!statuses.has(data.status))return json({error:"Invalid investigation status"},400);
  const next={id:crypto.randomUUID(),type:"result",text:"Status changed to "+data.status+".",
   date:new Date().toISOString().slice(0,10),files:[],fileName:"",createdAt:new Date().toISOString()};
  changed=records.map(item=>item.id===record.id?{...item,status:data.status,entries:[...(item.entries||[]),next]}:item);
 }else return json({error:"Invalid action"},400);
 const nextRevision=crypto.randomUUID();
 const conditions=object?.etag?{onlyIf:{etagMatches:object.etag}}:{onlyIf:{etagDoesNotMatch:"*"}};
 const result=await env.PHOTOS.put(key,JSON.stringify({records:changed,revision:nextRevision}),conditions);
 if(result===null)return json({error:"Another edit was saved first. Reload and try again."},409);
 return json({ok:true,revision:nextRevision,records:changed,createdId});
}
