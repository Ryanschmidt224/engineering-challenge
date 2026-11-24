import {handleProjectWorkspace} from "./project-workspace-api.js";
import {accountUser} from "./accounts.js";
import {proveProjectCommands} from "./project-engine-proof.js";
const json=(data,status=200)=>Response.json(data,{status,headers:{"cache-control":"private, no-store","x-content-type-options":"nosniff"}});
export const projectEngineEnabled=env=>env.NEW_PROJECT_ENGINE==="1";
export async function handleProjectEngine(request,env){
 // Defense in depth: production must not reach migrations, even on a direct import.
 if(!projectEngineEnabled(env))return json({error:"Not found"},404);
 const owner=await accountUser(request,env);
 if(owner?.role!=="admin")return json({error:"Owner sign-in required"},401);
 const url=new URL(request.url);
 if(request.headers.get("origin")!==url.origin&&!["GET","HEAD"].includes(request.method))return json({error:"Invalid request origin"},403);
 if(url.pathname!=="/api/project-engine/proof"){
  if(!env.WORKSHOP_DB)return json({error:"Preview D1 binding is not configured"},503);
  return handleProjectWorkspace(request,env,owner);
 }
 if(request.method!=="POST")return json({error:"Method not allowed"},405);
 if(!env.WORKSHOP_DB)return json({error:"Preview D1 binding is not configured"},503);
 const raw=await request.text();if(raw.length>2048)return json({error:"Request is too large"},413);
 let body;try{body=JSON.parse(raw);}catch{return json({error:"Use a JSON request"},400);}
 if(!body||typeof body!=="object"||Array.isArray(body)||body.expectedRevision!==null||typeof body.operationId!=="string"||! /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(body.operationId))return json({error:"A new proof needs expectedRevision: null and a UUID operationId."},400);
 try{return json(await proveProjectCommands(env.WORKSHOP_DB,owner.id,body.operationId));}
 catch(error){
  if(error.status===409)return json({error:error.message},409);
  // Keep diagnostics out of the response; a failed proof is not a pass.
  console.error("Project command preview proof failed",error);
  return json({error:"The preview transaction proof failed. Inspect Worker logs; dependent engine work must remain paused."},500);
 }
}
