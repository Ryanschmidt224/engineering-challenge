import {isAdmin} from "./auth.js";
const projects=new Set(["launcher","linear","robot","buck","motorlab","coiltest"]);
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
const emptyResources=()=>({tools:[],calculators:[],parts:[]});
const validateResources=input=>{
 if(input===undefined)return undefined;
 if(!input||typeof input!=="object"||Array.isArray(input))return null;
 const resources=emptyResources();
 for(const key of Object.keys(resources)){
  if(!Array.isArray(input[key])||input[key].length>60)return null;
  const ids=input[key];
  if(ids.some(id=>typeof id!=="string"||! /^[a-zA-Z0-9:-]{1,120}$/.test(id)))return null;
  resources[key]=[...new Set(ids)];
 }
 return resources;
};
// Discrete recipe steps have stable identities so reordering never breaks references.
const validateRecipe=input=>{
 if(input===undefined)return undefined;
 if(!Array.isArray(input)||input.length>150)return null;
 const ids=new Set(),steps=[];
 for(const step of input){
  if(!step||typeof step!=="object"||Array.isArray(step))return null;
  const id=String(step.id||"");
  if(!/^[a-zA-Z0-9_-]{1,80}$/.test(id)||ids.has(id))return null;
  ids.add(id);
  const title=step.title,standard=step.standard,detail=step.detail??"";
  if(typeof title!=="string"||!title.trim()||title.length>180||
    typeof standard!=="string"||standard.length>4000||
    typeof detail!=="string"||detail.length>8000)return null;
  const kind=["action","inspection","measurement","explanation"].includes(step.kind)?step.kind:"action";
  const notes=step.notes??[],photos=step.photos??[];
  if(!Array.isArray(notes)||notes.length>40||notes.some(n=>typeof n!=="string"||n.length>4000)||
     !Array.isArray(photos)||photos.length>30||photos.some(p=>typeof p!=="string"||! /^(?:(?:launcher|linear|robot|buck|motorlab|coiltest)\/[0-9a-f-]{36}\.(?:jpg|png|webp|gif|heic|heif)|recipe-files\/(?:launcher|linear|robot|buck|motorlab|coiltest)\/[0-9a-f-]{36}\.(?:jpg|jpeg|png|webp|gif|heic|heif|pdf|dwg|dxf|sldprt|sldasm|step|stp|stl|igs|iges|x_t|x_b|obj|3mf|doc|docx|xls|xlsx|txt|csv|zip))$/.test(p)))return null;
  const photoNames=step.photoNames??{};
  if(!photoNames||typeof photoNames!=="object"||Array.isArray(photoNames))return null;
  const names={};
  for(const [photoId,name] of Object.entries(photoNames)){
   if(!photos.includes(photoId)||typeof name!=="string"||name.length>120)return null;
   names[photoId]=name;
  }
  steps.push({id,title:title.trim(),standard,detail,kind,notes,photos,photoNames:names});
 }
 return steps;
};
export async function handleWorkspace(request,env){
 const u=new URL(request.url),project=u.searchParams.get("project"),assembly=u.searchParams.get("assembly"),part=u.searchParams.get("part");
 if(!projects.has(project))return json({error:"Invalid project"},400);
 if(part&&assembly)return json({error:"Specify a part or an assembly, not both"},400);
 if(part){
  if(!/^[0-9a-f-]{36}$/i.test(part))return json({error:"Invalid part"},400);
  if(!env.PHOTOS)return json({error:"Storage unavailable"},503);
  const record=await env.PHOTOS.get("components/"+project+".json");
  const parts=record?JSON.parse(await record.text()):[];
  if(!parts.some(item=>item.id===part))return json({error:"Part no longer exists"},404);
 }else if(!assembly||!(assembly==="__root__"||/^[a-zA-Z0-9-]{1,80}$/.test(assembly)))return json({error:"Invalid workspace"},400);
 if(!env.PHOTOS)return json({error:"Storage unavailable"},503);
 const key=part?"part-workspaces/"+project+"/"+part+".json":"workspaces/"+project+"/"+assembly+".json";
 if(request.method==="GET"){
  const obj=await env.PHOTOS.get(key);
  const saved=obj?JSON.parse(await obj.text()):{};
  const {instructions,procedures,notes,...workspace}=saved;
  return json({workspace:{recipe:[],resources:emptyResources(),...workspace,
   history:Array.isArray(workspace.history)?workspace.history.map(({instructions,procedures,notes,...snapshot})=>snapshot):[]}});
 }
 if(request.method!=="PUT")return json({error:"Method not allowed"},405);
 if(!await isAdmin(request,env))return json({error:"Administrator login required"},401);
 const data=await request.json().catch(()=>null);if(!data||typeof data!=="object"||Array.isArray(data))return json({error:"Invalid workspace data"},400);
 const resources=validateResources(data.resources);
 if(resources===null)return json({error:"Invalid linked resources"},400);
 const recipe=validateRecipe(data.recipe);
 if(recipe===null)return json({error:"Invalid recipe steps"},400);
 const existing=await env.PHOTOS.get(key);
 const previous=existing?JSON.parse(await existing.text()):{};
 // Callers that loaded a revision must not silently overwrite a newer one.
 // Clients without the token retain legacy behavior until upgraded.
 if(Object.prototype.hasOwnProperty.call(data,"expectedRevision")&&
    (data.expectedRevision??null)!==(previous.revision??null))
  return json({error:"Instructions were changed elsewhere. Reload before saving.",latestRevision:previous.revision??null},409);
 // Keep recent published edits automatically: no revision numbers or forms to fill out.
 const experiments=data.experiments===undefined?(previous.experiments||[]):data.experiments;
 if(!Array.isArray(experiments)||experiments.length>100||experiments.some(entry=>
  !entry||typeof entry.text!=="string"||!entry.text.trim()||entry.text.length>3000||
  typeof entry.createdAt!=="string"||entry.createdAt.length>50))return json({error:"Invalid experiment notes"},400);
 const workspace={
  recipe:recipe===undefined?(previous.recipe||[]):recipe,
  resources:resources===undefined?(previous.resources||emptyResources()):resources,
  experiments:experiments.map(entry=>({id:typeof entry.id==="string"&&entry.id.length<=80?entry.id:crypto.randomUUID(),
   text:entry.text,createdAt:entry.createdAt}))
 };
 const before={recipe:previous.recipe||[],resources:previous.resources||emptyResources(),experiments:previous.experiments||[]};
 const hasLegacy=["instructions","procedures","notes"].some(field=>Object.hasOwn(previous,field));
 const changed=hasLegacy||JSON.stringify(before)!==JSON.stringify(workspace);
 const history=Array.isArray(previous.history)?previous.history.slice(-19)
  .map(({instructions,procedures,notes,...snapshot})=>snapshot):[];
 if(changed&&existing){
  history.push({savedAt:previous.updatedAt||new Date().toISOString(),revision:previous.revision??null,...before});
 }
 workspace.history=history;workspace.updatedAt=changed?new Date().toISOString():(previous.updatedAt||new Date().toISOString());
 workspace.revision=changed||!previous.revision?crypto.randomUUID():previous.revision;
 // R2 evaluates conditional PUTs atomically. A stale browser tab cannot
 // overwrite a newer revision even when writes race after the initial GET.
 const conditions=existing?.etag?{onlyIf:{etagMatches:existing.etag}}:
  !existing?{onlyIf:{etagDoesNotMatch:"*"}}:undefined;
 const saved=await env.PHOTOS.put(key,JSON.stringify(workspace),conditions);
 if(saved===null)return json({error:"A concurrent update changed these instructions. Reload before saving."},409);
 return json({ok:true,updatedAt:workspace.updatedAt,revision:workspace.revision});
}