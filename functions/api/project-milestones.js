import {projectAllowed,canEditProject,VALID_PROJECT_ID} from "./projects.js";

const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{
 "content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"
}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const keyFor=project=>"project-milestones/"+project+".json";
const empty=()=>({schemaVersion:1,originalIntent:null,milestones:[],revision:null});
const textValue=(value,max)=>typeof value==="string"&&value.length<=max?value.trim():null;
const getJSON=async object=>object?JSON.parse(await object.text()):empty();
const has=(object,field)=>Object.prototype.hasOwnProperty.call(object,field);
const guardRevision=(data,saved)=>{
 if(!has(data,"expectedRevision")||(data.expectedRevision??null)!==(saved.revision??null))
  return json({error:"Project milestones changed in another tab. Refresh and try again.",revision:saved.revision??null},409);
 return null;
};
async function resolveSource(bucket,project,source){
 if(source===null||source===undefined)return null;
 if(!source||typeof source!=="object"||Array.isArray(source)||!uuid.test(source.id||""))
  throw Error("Invalid linked source");
 if(source.kind==="investigation"){
  const object=await bucket.get("investigations/"+project+".json");
  const records=object?JSON.parse(await object.text()).records||[]:[];
  const record=records.find(item=>item.id===source.id);
  if(!record)throw Error("The original test, revision or failure no longer exists. Remove the source link to save your reflection.");
  if(!["test","revision","failure"].includes(record.category))
   throw Error("Only tests, revisions and failures can be linked to milestones");
  return {kind:"investigation",id:record.id,title:String(record.title||record.category||"Record").slice(0,180),
   category:record.category,ownerType:record.ownerType,ownerId:record.ownerId,stepId:record.stepId||""};
 }
 if(source.kind==="archive"){
  const object=await bucket.get("assembly-archives/"+project+"/manifests/"+source.id+".json");
  if(!object)throw Error("The archived part no longer exists. Remove the source link to save your reflection.");
  const record=JSON.parse(await object.text());
  if(record.id!==source.id||record.project!==project||record.state==="prepared")
   throw Error("The archived source could not be verified");
  return {kind:"archive",id:record.id,title:String(record.name||"Archived item").slice(0,180),
   category:record.kind==="part"?"part":"assembly",
   originPath:Array.isArray(record.originPath)?record.originPath.map(x=>String(x.name||"").slice(0,180)).slice(0,24):[]};
 }
 throw Error("Unknown linked source");
}

// Only GET and append actions are offered. No PATCH, PUT, DELETE or overwrite API.
export async function handleProjectMilestones(request,env){
 const url=new URL(request.url),project=url.searchParams.get("project");
 if(!env.PHOTOS)return json({error:"Project storage unavailable"},503);
 if(!VALID_PROJECT_ID.test(String(project||""))||!await projectAllowed(env,project,request))
  return json({error:"Project not found"},404);
 if(!["GET","POST"].includes(request.method))return json({error:"Milestones can only be appended, not edited or deleted"},405);
 if(request.method==="POST"){
  if(request.headers.get("origin")!==url.origin)return json({error:"Invalid request origin"},403);
  if(!await canEditProject(request,env,project))return json({error:"Project owner access required"},403);
 }
 const key=keyFor(project),object=await env.PHOTOS.get(key),saved=await getJSON(object);
 if(!saved||!Array.isArray(saved.milestones))return json({error:"Project milestones storage is invalid"},500);
 if(request.method==="GET")return json({originalIntent:saved.originalIntent||null,
  milestones:saved.milestones,revision:saved.revision??null});
 const input=await request.json().catch(()=>null);
 if(!input||typeof input!=="object"||Array.isArray(input))return json({error:"Invalid milestone data"},400);
 const conflict=guardRevision(input,saved);if(conflict)return conflict;
 const at=new Date().toISOString();
 let record,next;
 if(input.action==="createIntent"){
  if(saved.originalIntent)return json({error:"Original intent is already recorded and cannot be replaced. Add a milestone for later changes."},409);
  const objective=textValue(input.objective,2000),successCriteria=textValue(input.successCriteria,2000),plan=textValue(input.plan,3000);
  if([objective,successCriteria,plan].some(v=>v===null)||![objective,successCriteria,plan].some(Boolean))
   return json({error:"Enter at least one original intention, success criterion or initial plan."},400);
  record={id:crypto.randomUUID(),createdAt:at,objective,successCriteria,plan};
  next={...saved,originalIntent:record};
 }else if(input.action==="addMilestone"){
  if(!saved.originalIntent)return json({error:"Record an original project intent before adding milestones."},409);
  if(saved.milestones.length>=250)return json({error:"Maximum 250 significant milestones per project"},413);
  const what=textValue(input.whatHappened,3000),significance=textValue(input.significance,2000);
  if(!what||!significance)return json({error:"Describe what happened and why it is significant to the project."},400);
  let source;
  try{source=await resolveSource(env.PHOTOS,project,input.source)}
  catch(error){return json({error:error.message},400)}
  record={id:crypto.randomUUID(),createdAt:at,whatHappened:what,significance,
   sequence:saved.milestones.length+1,...(source?{source}:{})};
  next={...saved,milestones:[...saved.milestones,record]};
 }else return json({error:"Unknown milestone action"},400);
 next.schemaVersion=1;
 next.revision=crypto.randomUUID();
 // Conditional R2 writes prevent two tabs from silently losing an entry.
 const savedObject=await env.PHOTOS.put(key,JSON.stringify(next),{
  onlyIf:object?.etag?{etagMatches:object.etag}:{etagDoesNotMatch:"*"},
  httpMetadata:{contentType:"application/json"}
 });
 if(savedObject===null)return json({error:"Another milestone was saved first. Refresh and retry.",revision:saved.revision??null},409);
 return json({ok:true,record,revision:next.revision},201);
}
