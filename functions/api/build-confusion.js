import {accountUser} from "./accounts.js";
import {projectAllowed,canEditProject} from "./projects.js";
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
const validScope=/^(project|assembly|part|step|section):[a-zA-Z0-9_-]{1,100}$/;
export async function onRequest({request,env}){
 const project=new URL(request.url).searchParams.get("project");
 if(!await projectAllowed(env,project,request))return json({error:"Project unavailable"},403);
 if(!env.PHOTOS)return json({error:"Storage unavailable"},503);
 const prefix="build-confusion/v1/"+project+"/";
 if(request.method==="GET"){
  if(!await canEditProject(request,env,project))return json({error:"Project creator access required"},403);
  const results=new Map();
  let cursor;
  do{
   const page=await env.PHOTOS.list({prefix,limit:500,...(cursor?{cursor}:{})});
   for(const object of page.objects){
    const path=object.key.slice(prefix.length);
    const scope=path.split("/")[0];
    if(!validScope.test(scope))continue;
    const record=await env.PHOTOS.get(object.key);
    if(!record)continue;
    const report=await record.json();
    const tally=results.get(scope)||{scope,count:0,stuck:0,confused:0,comments:[]};
    tally.count++;
    if(report.kind==="stuck")tally.stuck++;else tally.confused++;
    if(report.comment&&tally.comments.length<20)tally.comments.push(report.comment);
    results.set(scope,tally);
   }
   cursor=page.truncated?page.cursor:null;
  }while(cursor);
  return json({reports:[...results.values()].sort((a,b)=>b.count-a.count)});
 }
 if(request.method!=="POST")return json({error:"Method not allowed"},405);
 if(request.headers.get("origin")!==new URL(request.url).origin)return json({error:"Invalid origin"},403);
 const user=await accountUser(request,env);
 if(!user)return json({error:"Sign in to report a problem",loginRequired:true},401);
 const data=await request.json().catch(()=>null);
 if(!data||!validScope.test(data.scope)||!["stuck","confused"].includes(data.kind)||typeof data.comment!=="string"||data.comment.length>1200)return json({error:"Invalid report"},400);
 // One report per location and learner. A second report updates it, rather than inflating counts.
 // The user identifier is never returned to the project creator.
 const key=prefix+data.scope+"/"+user.id+".json";
 await env.PHOTOS.put(key,JSON.stringify({kind:data.kind,comment:data.comment.trim()}),{httpMetadata:{contentType:"application/json"}});
 return json({saved:true});
}
