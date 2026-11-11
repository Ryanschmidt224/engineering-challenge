import {accountUser} from "./accounts.js";
import {projectAllowed} from "./projects.js";
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
export async function onRequest({request,env}){
 const project=new URL(request.url).searchParams.get("project");
 if(!await projectAllowed(env,project,request))return json({error:"Project unavailable"},403);
 const user=await accountUser(request,env);
 if(!user)return json({error:"Sign in to use My Build",loginRequired:true},401);
 if(!env.PHOTOS)return json({error:"Storage unavailable"},503);
 const key="my-build/v1/"+user.id+"/"+project+".json";
 const obj=await env.PHOTOS.get(key);
 const saved=obj?await obj.json():{revision:0,entries:{}};
 if(request.method==="GET")return json(saved);
 if(request.method!=="PUT")return json({error:"Method not allowed"},405);
 if(request.headers.get("origin")!==new URL(request.url).origin)return json({error:"Invalid origin"},403);
 const data=await request.json().catch(()=>null);
 if(!data||typeof data!=="object"||Array.isArray(data)||!Number.isInteger(data.revision)||data.revision!==(saved.revision||0)||!data.entries||typeof data.entries!=="object"||Array.isArray(data.entries))return json({error:"Your build changed. Refresh before saving.",conflict:true},409);
 const entries={};
 const validKey=/^(project|assembly|part|step):[a-zA-Z0-9_-]{1,100}$/;
 for(const [id,entry] of Object.entries(data.entries)){
  if(Object.keys(entries).length>=600||!validKey.test(id)||!entry||typeof entry!=="object"||Array.isArray(entry)||typeof entry.note!=="string"||entry.note.length>4000||!["not_started","in_progress","complete"].includes(entry.progress)||!Array.isArray(entry.tasks)||entry.tasks.length>40)return json({error:"Invalid build entry"},400);
  const tasks=[];
  for(const task of entry.tasks){
   if(!task||typeof task.id!=="string"||!/^t[a-zA-Z0-9_-]{1,80}$/.test(task.id)||typeof task.text!=="string"||!task.text.trim()||task.text.length>220||typeof task.done!=="boolean")return json({error:"Invalid task"},400);
   tasks.push({id:task.id,text:task.text.trim(),done:task.done});
  }
  entries[id]={note:entry.note,progress:entry.progress,tasks};
 }
 const next={revision:data.revision+1,entries};
 await env.PHOTOS.put(key,JSON.stringify(next),{httpMetadata:{contentType:"application/json"}});
 return json(next);
}
