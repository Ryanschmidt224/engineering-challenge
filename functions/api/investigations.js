import {isAdmin} from "./auth.js";
const projects=new Set(["launcher","linear","robot","buck","motorlab","coiltest"]);
const uuid=/^[a-f0-9-]{36}$/i;
const idPattern=/^[a-zA-Z0-9_-]{1,80}$/;
const filePattern=/^recipe-files\/(?:launcher|linear|robot|buck|motorlab|coiltest)\/[a-f0-9-]{36}\.(?:jpg|jpeg|png|webp|gif|heic|heif|pdf|dwg|dxf|sldprt|sldasm|step|stp|stl|igs|iges|x_t|x_b|obj|3mf|doc|docx|xls|xlsx|txt|csv|zip)$/;
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const validText=(v,max)=>typeof v==="string"&&v.length<=max;
const statuses=new Set(["investigating","resolved","unresolved"]);
const types=new Set(["observation","theory","attempt","result","lesson"]);
const scopes=new Set(["assembly","part","step"]);
const trim=(text,max)=>String(text||"").trim().slice(0,max);
export async function handleInvestigations(request,env){
 const url=new URL(request.url),project=url.searchParams.get("project");
 if(!projects.has(project))return json({error:"Invalid project"},400);
 if(!env.PHOTOS)return json({error:"Storage unavailable"},503);
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
 }else if(data.action==="append"){
  record=records.find(item=>item.id===data.id);
  const entry=data.entry;
  if(!record)return json({error:"Investigation not found"},404);
  if(!entry||!types.has(entry.type)||!validText(entry.text,5000)||!entry.text.trim()||
     !Array.isArray(entry.files||[])||(entry.files||[]).length>12||
     !(entry.files||[]).every(file=>typeof file==="string"&&filePattern.test(file)&&file.startsWith("recipe-files/"+project+"/"))||
     !validText(entry.fileName||"",120))return json({error:"Invalid investigation entry"},400);
  if((record.entries||[]).length>=100)return json({error:"Too many entries in investigation"},413);
  const next={id:crypto.randomUUID(),type:entry.type,text:entry.text.trim(),
   files:[...new Set(entry.files||[])],fileName:trim(entry.fileName,120),createdAt:new Date().toISOString()};
  changed=records.map(item=>item.id===record.id?{...item,entries:[...(item.entries||[]),next]}:item);
 }else if(data.action==="status"){
  record=records.find(item=>item.id===data.id);
  if(!record||!statuses.has(data.status))return json({error:"Invalid investigation status"},400);
  const next={id:crypto.randomUUID(),type:"result",text:"Status changed to "+data.status+".",
   files:[],fileName:"",createdAt:new Date().toISOString()};
  changed=records.map(item=>item.id===record.id?{...item,status:data.status,entries:[...(item.entries||[]),next]}:item);
 }else return json({error:"Invalid action"},400);
 const nextRevision=crypto.randomUUID();
 const conditions=object?.etag?{onlyIf:{etagMatches:object.etag}}:{onlyIf:{etagDoesNotMatch:"*"}};
 const result=await env.PHOTOS.put(key,JSON.stringify({records:changed,revision:nextRevision}),conditions);
 if(result===null)return json({error:"Another edit was saved first. Reload and try again."},409);
 return json({ok:true,revision:nextRevision,records:changed});
}
