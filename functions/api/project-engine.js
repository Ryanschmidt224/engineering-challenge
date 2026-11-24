import {handleProjectWorkspace} from "./project-workspace-api.js";
import {accountUser} from "./accounts.js";
const json=(data,status=200)=>Response.json(data,{status,headers:{"cache-control":"private, no-store","x-content-type-options":"nosniff"}});
export const projectEngineEnabled=env=>env.NEW_PROJECT_ENGINE==="1";
export async function handleProjectEngine(request,env){
 // Defense in depth: production must not reach migrations, even on a direct import.
 if(!projectEngineEnabled(env))return json({error:"Not found"},404);
 const owner=await accountUser(request,env);
 if(owner?.role!=="admin")return json({error:"Owner sign-in required"},401);
 const url=new URL(request.url);
 if(request.headers.get("origin")!==url.origin&&!["GET","HEAD"].includes(request.method))return json({error:"Invalid request origin"},403);
 if(url.pathname==="/api/project-engine/environment"&&request.method==="GET"){
  const version=env.CF_VERSION_METADATA;if(!version?.id)return json({error:"Preview version metadata is unavailable"},503);
  return json({versionId:version.id,versionTag:version.tag||null,createdAt:version.timestamp||null});
 }
 if(!env.WORKSHOP_DB)return json({error:"Preview D1 binding is not configured"},503);
 return handleProjectWorkspace(request,env,owner);
}
