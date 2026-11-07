import {isAdmin} from "./auth.js";
const projects=new Set(["launcher","linear","robot"]);
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
export async function handleWorkspace(request,env){
 const u=new URL(request.url),project=u.searchParams.get("project"),assembly=u.searchParams.get("assembly");
 if(!projects.has(project)||!assembly||!(assembly==="__root__"||/^[a-zA-Z0-9-]{1,80}$/.test(assembly)))return json({error:"Invalid workspace"},400);
 if(!env.PHOTOS)return json({error:"Storage unavailable"},503);
 const key="workspaces/"+project+"/"+assembly+".json";
 if(request.method==="GET"){const obj=await env.PHOTOS.get(key);return json({workspace:obj?JSON.parse(await obj.text()):{instructions:"",procedures:"",notes:""}})}
 if(request.method!=="PUT")return json({error:"Method not allowed"},405);
 if(!await isAdmin(request,env))return json({error:"Administrator login required"},401);
 const data=await request.json().catch(()=>null);if(!data||["instructions","procedures","notes"].some(k=>typeof data[k]!=="string"||data[k].length>30000))return json({error:"Invalid workspace data"},400);
 const workspace={instructions:data.instructions,procedures:data.procedures,notes:data.notes};await env.PHOTOS.put(key,JSON.stringify(workspace));return json({ok:true});
}