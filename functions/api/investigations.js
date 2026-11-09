import {isAdmin} from "./auth.js";
const projects=new Set(["launcher","linear","robot","buck","motorlab","coiltest"]);
const uuid=/^[a-f0-9-]{36}$/i;
const idPattern=/^[a-zA-Z0-9_-]{1,80}$/;
const filePattern=/^recipe-files\/(?:launcher|linear|robot|buck|motorlab|coiltest)\/[a-f0-9-]{36}\.(?:jpg|jpeg|png|webp|gif|heic|heif|pdf|dwg|dxf|sldprt|sldasm|step|stp|stl|igs|iges|x_t|x_b|obj|3mf|doc|docx|xls|xlsx|txt|csv|zip)$/;
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const validText=(v,max)=>typeof v==="string"&&v.length<=max;
const statuses=new Set(["investigating","resolved","unresolved"]);
const types=new Set(["observation","theory","attempt","revision","result","lesson"]);
const scopes=new Set(["assembly","part","step"]);
const trim=(text,max)=>String(text||"").trim().slice(0,max);
const validDate=value=>typeof value==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+"T12:00:00Z"))&&new Date(value+"T12:00:00Z").toISOString().slice(0,10)===value;
const entryTypes=new Set(["observation","attempt","lesson","theory","revision","result"]);
const safeEntry=(entry,project)=>entry&&entryTypes.has(entry.type)&&validText(entry.text,5000)&&entry.text.trim()&&
 validDate(entry.date)&&Array.isArray(entry.files||[])&&(entry.files||[]).length<=12&&
 (entry.files||[]).every(file=>typeof file==="string"&&filePattern.test(file)&&file.startsWith("recipe-files/"+project+"/"))&&validText(entry.fileName||"",120);
const normalizedEntry=(entry)=>({id:crypto.randomUUID(),type:entry.type,text:entry.text.trim(),date:entry.date,
 files:[...new Set(entry.files||[])],fileName:trim(entry.fileName,120),createdAt:new Date().toISOString()});
export async function handleInvestigations(request,env){
 const url=new URL(request.url),project=url.searchParams.get("project");
 if(!projects.has(project))return json({error:"Invalid project"},400);
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
 const key="investigations/"+project+".json",object=await env.PHOTOS.get(key);
 const saved=object?JSON.parse(await object.text()):{records:[],revision:null};
 if(request.method==="GET")return json({records:Array.isArray(saved.records)?saved.records:[],revision:saved.revision??null});
 if(request.method!=="POST")return json({error:"Method not allowed"},405);
 if(!await isAdmin(request,env))return json({error:"Administrator login required"},401);
 const data=await request.json().catch(()=>null);
 if(!data||typeof data!=="object"||Array.isArray(data))return json({error:"Invalid request"},400);
 if((data.expectedRevision??null)!==(saved.revision??null))return json({error:"Investigations changed elsewhere. Reload before saving.",revision:saved.revision??null},409);
 const records=Array.isArray(saved.records)?saved.records:[];
 if(records.length>300)return json({error:"Project investigation limit reached"},413);
 let changed,record;
 if(data.action==="create"){
  const scope=data.scope,ownerType=data.ownerType,ownerId=data.ownerId,stepId=data.stepId||"";
  if(!scopes.has(scope)||!validText(data.title,180)||!data.title.trim()||
    !["assembly","part"].includes(ownerType)||!validText(ownerId,80)||
    (ownerType==="part"?!uuid.test(ownerId):ownerId!=="__root__"&&!idPattern.test(ownerId))||
    (scope==="step"?!idPattern.test(stepId):!!stepId)||
    (scope==="part"&&ownerType!=="part")||(scope==="assembly"&&ownerType!=="assembly"))
    return json({error:"Invalid investigation details"},400);
  if(records.length>=300)return json({error:"Project investigation limit reached"},413);
  // Verify the owner still exists rather than accepting orphan investigations.
  if(ownerType==="part"){
   const partsFile=await env.PHOTOS.get("components/"+project+".json");
   const parts=partsFile?JSON.parse(await partsFile.text()):[];
   if(!Array.isArray(parts)||!parts.some(part=>part.id===ownerId))return json({error:"Part no longer exists"},404);
  }else if(ownerId!=="__root__"){
   const treeFile=await env.PHOTOS.get("trees/"+project+".json");
   const tree=treeFile?JSON.parse(await treeFile.text()):[];
   if(!Array.isArray(tree)||!tree.some(node=>node.id===ownerId))return json({error:"Assembly no longer exists"},404);
  }
  record={id:crypto.randomUUID(),scope,ownerType,ownerId,stepId,title:data.title.trim(),
   status:"investigating",entries:[],createdAt:new Date().toISOString()};
  changed=[...records,record];
 }else if(data.action==="archivePart"){
  const partId=data.partId;
  if(!uuid.test(partId)||!validDate(data.date)||!validText(data.reason,2500)||!data.reason.trim())
   return json({error:"Enter a reason and valid revision date"},400);
  const partObject=await env.PHOTOS.get("components/"+project+".json");
  const parts=partObject?JSON.parse(await partObject.text()):[];
  const part=Array.isArray(parts)?parts.find(item=>item.id===partId):null;
  if(!part)return json({error:"Part no longer exists"},404);
  if(records.length>=300)return json({error:"Project investigation limit reached"},413);
  const workspaceObject=await env.PHOTOS.get("part-workspaces/"+project+"/"+partId+".json");
  const workspace=workspaceObject?JSON.parse(await workspaceObject.text()):{};
  const revisionId=crypto.randomUUID();
  const thumbnail=await env.PHOTOS.get("component-thumbnails/"+project+"/"+partId);
  let archivedThumbnail=null;
  if(thumbnail){
   archivedThumbnail="part-revisions/"+project+"/"+partId+"/"+revisionId+"/thumbnail";
   await env.PHOTOS.put(archivedThumbnail,await thumbnail.arrayBuffer(),{
    httpMetadata:{contentType:thumbnail.httpMetadata?.contentType||"image/jpeg"}
   });
  }
  // Capture the original part definition and its instruction/test state before edits.
  // Existing CAD files, drawing objects and uploaded evidence remain immutable in R2.
  const snapshot={part:JSON.parse(JSON.stringify(part)),workspace:JSON.parse(JSON.stringify(workspace)),
   thumbnailKey:archivedThumbnail,archivedAt:new Date().toISOString()};
  if(JSON.stringify(snapshot).length>250000)return json({error:"Part history is too large to snapshot"},413);
  record={id:revisionId,scope:"part",ownerType:"part",ownerId:partId,stepId:"",
   title:"Revision: "+trim(part.name||"Previous part",160),status:"resolved",
   date:data.date,partSnapshot:snapshot,entries:[{id:crypto.randomUUID(),type:"revision",text:data.reason.trim(),
    date:data.date,files:[],fileName:"",createdAt:new Date().toISOString()}],createdAt:new Date().toISOString()};
  changed=[...records,record];
 }else if(data.action==="rename"){
  record=records.find(item=>item.id===data.id);
  if(!record)return json({error:"Investigation not found"},404);
  if(!validText(data.title,180)||!data.title.trim())return json({error:"Invalid investigation title"},400);
  const title=data.title.trim();
  if(title===record.title)return json({ok:true,revision:saved.revision??null,records});
  const audit={id:crypto.randomUUID(),type:"revision",text:"Renamed investigation from \""+record.title+"\" to \""+title+"\".",
   date:new Date().toISOString().slice(0,10),files:[],fileName:"",createdAt:new Date().toISOString()};
  changed=records.map(item=>item.id===record.id?{...item,title,entries:[...(item.entries||[]),audit]}:item);
 }else if(data.action==="appendBatch"){
  record=records.find(item=>item.id===data.id);
  if(!record)return json({error:"Investigation not found"},404);
  const incoming=data.entries;
  if(!Array.isArray(incoming)||!incoming.length||incoming.length>3||incoming.some(item=>!safeEntry(item,project)))
   return json({error:"Invalid investigation update"},400);
  if((record.entries||[]).length+incoming.length>100)return json({error:"Too many entries in investigation"},413);
  changed=records.map(item=>item.id===record.id?{...item,entries:[...(item.entries||[]),...incoming.map(normalizedEntry)]}:item);
 }else if(data.action==="append"){
  record=records.find(item=>item.id===data.id);
  const entry=data.entry;
  if(!record)return json({error:"Investigation not found"},404);
  if(!entry||!types.has(entry.type)||!validText(entry.text,5000)||!entry.text.trim()||
     !Array.isArray(entry.files||[])||(entry.files||[]).length>12||
     !(entry.files||[]).every(file=>typeof file==="string"&&filePattern.test(file)&&file.startsWith("recipe-files/"+project+"/"))||
     !validText(entry.fileName||"",120))return json({error:"Invalid investigation entry"},400);
  if((record.entries||[]).length>=100)return json({error:"Too many entries in investigation"},413);
  const next={...normalizedEntry({...entry,date:validDate(entry.date)?entry.date:new Date().toISOString().slice(0,10)})};
  changed=records.map(item=>item.id===record.id?{...item,entries:[...(item.entries||[]),next]}:item);
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
 return json({ok:true,revision:nextRevision,records:changed});
}
