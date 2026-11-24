import {exportProject,restoreProject} from "./project-backup.js";
import {prepareFile,uploadFile,admitFile,downloadFile} from "./project-engine-files.js";
import {initializeProjectEngine} from "./project-engine-migrations.js";
import {replayProjectCommand} from "./project-command.js";
import {uuid,rows,statement,decode,ownedProject,expectedProject,itemContext,workspaceState,ProjectNotFound} from "./project-state.js";
import * as commands from "./project-workspace-commands.js";
import {historyPage,eventDetail} from "./project-history.js";
import {placeExisting,editPlacement,lifePreview,changePlacementLife,reorderPlacements} from "./project-placements.js";
import {workshopChoices,createWorkshopItem,selectWorkshopProduct} from "./project-workshop.js";
import {projectBOM} from "../../assets/project-tree-model.js";
export const engineJSON=(data,status=200)=>Response.json(data,{status,headers:{"cache-control":"private, no-store","x-content-type-options":"nosniff"}});
export async function commandBody(request,max=256000){
 const raw=await request.text();if(raw.length>max)throw Object.assign(Error("Request is too large."),{status:413});
 let body;try{body=JSON.parse(raw);}catch{throw Object.assign(Error("Use a JSON request."),{status:400});}
 if(!body||typeof body!=="object"||Array.isArray(body)||!uuid(body.operationId)||body.expectedRevision!==null&&!uuid(body.expectedRevision))throw Object.assign(Error("Provide a UUID operationId and the loaded expectedRevision."),{status:400});
 return body;
}
// A replay is resolved before domain reads (including number allocation). The
// route and target are fingerprinted so another action cannot reuse a receipt.
export async function handleProjectWorkspace(request,env,owner){
 const url=new URL(request.url),base="/api/project-engine/projects",path=url.pathname.slice(base.length).split("/").filter(Boolean),method=request.method,db=env.WORKSHOP_DB;
 if(!url.pathname.startsWith(base)||url.pathname!==base&&url.pathname[base.length]!=="/")return engineJSON({error:"Not found"},404);
 let body;
 try{
  const importing=method==="POST"&&path.length===2&&["import","import-copy"].includes(path[1]);
  if(!["GET","POST","PATCH","PUT"].includes(method))return engineJSON({error:"Method not allowed"},405);
  if(!importing&&!["GET","PUT"].includes(method))body=await commandBody(request);
  if(path.length&&!uuid(path[0]))throw new ProjectNotFound();
  await initializeProjectEngine(db);
  if(!path.length){if(method!=="GET")return engineJSON({error:"Method not allowed"},405);return engineJSON({projects:await rows(db,"SELECT * FROM engine_projects WHERE owner_id=? AND restore_job_id IS NULL ORDER BY name,id",owner.id)});}
  const projectId=path[0];
  if(importing)return engineJSON(await restoreProject(request,env,owner,projectId,{asCopy:path[1]==="import-copy"}));
  let input;
  if(body){
   const {operationId,expectedRevision,...data}=body;
   input={projectId,actorId:owner.id,operationId,expectedRevision,payload:{method,path:url.pathname,data}};
   const replay=await replayProjectCommand(db,input);if(replay)return engineJSON(replay.result);
   body=data;
   if(path.length===1&&method==="POST")return engineJSON(await commands.createProject(db,input,body));
  }
  const project=await ownedProject(db,projectId,owner.id);
  if(input)expectedProject(project,input);
  const [,area,id,action]=path;
  if(method==="PUT"&&area==="files"&&path.length===4&&action==="bytes")return engineJSON(await uploadFile(request,env,owner,project,id));
  if(method==="GET"){
   if(area==="catalog"&&path.length===2)return engineJSON(await workshopChoices(db,url.searchParams));
   if(area==="bom"&&path.length===2){const state=await workspaceState(db,project);return engineJSON({rows:projectBOM(state.items,state.occurrences,url.searchParams.get("occurrence")||null)});}
   if(area==="occurrences"&&path.length===4&&["archive-preview","restore-preview"].includes(action))return engineJSON(await lifePreview(db,project,id,action==="restore-preview"));
   if(area==="export"&&path.length===2)return await exportProject(env,project);
   if(area==="files"&&path.length===3)return await downloadFile(env,project,id,url.searchParams.get("inline")==="1");
   if(path.length===2&&area==="state")return engineJSON(await workspaceState(db,project));
   if(area==="history"&&path.length===2)return engineJSON(await historyPage(db,projectId,url.searchParams));
   if(area==="history"&&path.length===3)return engineJSON(await eventDetail(db,projectId,id));
   if(area==="configurations"&&path.length===3&&uuid(id)){
    const row=decode(await statement(db,"SELECT * FROM engine_configurations WHERE project_id=? AND id=?",projectId,id).first());if(!row)throw new ProjectNotFound("Configuration not found.");return engineJSON(row);
   }
   if(area==="items"&&path.length===4&&action==="restore-preview")return engineJSON(await commands.restorePreview(db,project,id,url.searchParams.get("occurrence")));
  }else{
   if(area==="workshop-items"&&path.length===2&&method==="POST")return engineJSON(await createWorkshopItem(env,input,project,body));
   if(area==="occurrences"){
    if(path.length===4&&method==="POST"&&action==="reorder")return engineJSON(await reorderPlacements(db,input,project,id,body));
    if(path.length===3&&method==="PATCH")return engineJSON(await editPlacement(db,input,project,id,body));
    if(path.length===4&&method==="POST"&&["archive","restore"].includes(action))return engineJSON(await changePlacementLife(db,input,project,id,action==="restore",body));
   }
   if(area==="files"&&method==="POST"){
    if(path.length===3&&id==="prepare")return engineJSON(await prepareFile(db,input,project,body));
    if(path.length===4&&action==="admit")return engineJSON(await admitFile(db,env,input,project,id,body));
   }
   if(path.length===1&&method==="PATCH")return engineJSON(await commands.editProject(db,input,project,body));
   if(area==="items"){
    if(path.length===2&&method==="POST")return engineJSON(await commands.createItem(db,input,project,body));
    if(path.length===3&&method==="PATCH")return engineJSON(await commands.editItem(db,input,project,id,body));
    if(path.length===4&&method==="POST"){
     if(action==="placements")return engineJSON(await placeExisting(db,input,project,id,body));
     if(action==="selection")return engineJSON(await selectWorkshopProduct(env,input,project,id,body));
     if(action==="revisions")return engineJSON(await commands.editItem(db,input,project,id,body,{revision:true}));
     if(action==="duplicate")return engineJSON(await commands.createItem(db,input,project,body,{from:await itemContext(db,projectId,id)}));
     if(["archive","restore"].includes(action))return engineJSON(await commands.changeItemLife(db,input,project,id,action==="restore",body));
     if(action==="steps")return engineJSON(await commands.createStep(db,input,project,id,body));
     if(action==="records")return engineJSON(await commands.createRecord(db,input,project,id,body));
    }
    if(path.length===5&&method==="POST"&&action==="steps"&&path[4]==="reorder")return engineJSON(await commands.reorderSteps(db,input,project,id,body));
   }
   if(area==="steps"){
    if(path.length===3&&method==="PATCH")return engineJSON(await commands.editStep(db,input,project,id,body));
    if(path.length===4&&method==="POST"&&["retire","restore"].includes(action))return engineJSON(await commands.changeStepLife(db,input,project,id,action==="restore",body));
   }
   if(area==="records"&&path.length===3&&method==="PATCH")return engineJSON(await commands.editRecord(db,input,project,id,body));
  }
  return engineJSON({error:"Not found"},404);
 }catch(error){
  if(error.status)return engineJSON({error:error.message},error.status);
  // D1/internal failures never disclose queries, bindings or file keys.
  if(/D1_|SQLITE|constraint|FOREIGN KEY|database|no such|syntax error/i.test(error.message)){console.error("Project workspace command failed",error);return engineJSON({error:"The save failed. Your draft is retained; retry the same save."},500);}
  return engineJSON({error:error.message},400);
 }
}
