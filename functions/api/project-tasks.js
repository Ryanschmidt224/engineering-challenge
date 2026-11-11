import {projectAllowed,canEditProject} from "./projects.js";
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
const validId=x=>typeof x==="string"&&/^[a-zA-Z0-9_-]{1,100}$/.test(x);
export async function onRequest({request,env}){
 const project=new URL(request.url).searchParams.get("project");
 if(!await projectAllowed(env,project,request))return json({error:"Project unavailable"},403);
 if(!env.PHOTOS)return json({error:"Storage unavailable"},503);
 const key="project-tasks/v1/"+project+".json";
 const existing=await env.PHOTOS.get(key);
 const saved=existing?await existing.json():{revision:0,tasks:[],readiness:{}};
 if(request.method==="GET")return json({revision:saved.revision||0,tasks:saved.tasks||[],readiness:saved.readiness||{}});
 if(request.method!=="PUT")return json({error:"Method not allowed"},405);
 if(!await canEditProject(request,env,project))return json({error:"Sign in to save project tasks"},401);
 const data=await request.json().catch(()=>null);
 if(!data||!Array.isArray(data.tasks)||data.tasks.length>300||typeof data.readiness!=="object"||!data.readiness||Array.isArray(data.readiness))return json({error:"Invalid task data"},400);
 if(data.expectedRevision!==(saved.revision||0))return json({error:"Tasks changed elsewhere; refresh before saving",revision:saved.revision||0},409);
 const seen=new Set();
 const tasks=[];
 for(const task of data.tasks){
  if(!task||!validId(task.id)||seen.has(task.id)||typeof task.title!=="string"||!task.title.trim()||task.title.length>200||typeof task.note!=="string"||task.note.length>3000||typeof task.path!=="string"||task.path.length>250||typeof task.stepId!=="string"||task.stepId.length>100||typeof task.done!=="boolean")return json({error:"Invalid task"},400);
  seen.add(task.id);tasks.push({id:task.id,title:task.title.trim(),note:task.note,path:task.path,stepId:task.stepId,done:task.done});
 }
 const readiness={};
 for(const [key,value] of Object.entries(data.readiness)){
  if(Object.keys(readiness).length>=1000||!validId(key)||typeof value!=="boolean")return json({error:"Invalid readiness item"},400);
  readiness[key]=value;
 }
 const next={revision:(saved.revision||0)+1,tasks,readiness};
 await env.PHOTOS.put(key,JSON.stringify(next),{httpMetadata:{contentType:"application/json"}});
 return json(next);
}
