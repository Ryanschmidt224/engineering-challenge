// Project catalog is separate from engineering records. Archiving never deletes R2 data.
import {isAdmin} from "./auth.js";
import {accountUser} from "./accounts.js";
export const CORE_PROJECTS=Object.freeze([
 {id:"launcher",name:"Foam-dart launcher",description:"Launch a foam dart 50 feet. Flywheels, motors, controls, and testing.",kind:"project",builtIn:true},
 {id:"linear",name:"Electromagnetic linear actuator",description:"Move a magnet using coils. Fields, switching, sensors, and control.",kind:"project",builtIn:true},
 {id:"robot",name:"Robotic arm",description:"Build a multi-axis arm. Motors, kinematics, and software.",kind:"project",builtIn:true},
 {id:"buck",name:"Test a buck converter",description:"Measure voltage and investigate startup failures.",kind:"mini",builtIn:true},
 {id:"motorlab",name:"Control a brushless motor",description:"Use an ESC and measure RPM.",kind:"mini",builtIn:true},
 {id:"coiltest",name:"Switch a coil",description:"Explore magnetic fields and switching.",kind:"mini",builtIn:true}
]);
export const CATALOG_KEY="project-catalog/v1.json";
export const VALID_PROJECT_ID=/^(?:launcher|linear|robot|buck|motorlab|coiltest|p[a-f0-9]{32})$/;
const safeRecords=value=>Array.isArray(value?.projects)?value.projects.filter(p=>p&&typeof p.id==="string"&&VALID_PROJECT_ID.test(p.id)):[];
export async function readCatalog(env){
 if(!env.PHOTOS)throw Error("Project storage unavailable");
 const object=await env.PHOTOS.get(CATALOG_KEY);
 let stored={};
 if(object)stored=JSON.parse(await object.text());
 const records=safeRecords(stored);
 const overrides=new Map(records.map(item=>[item.id,item]));
 const projects=CORE_PROJECTS.map(item=>({...item,...overrides.get(item.id),builtIn:true}));
 for(const item of records)if(!CORE_PROJECTS.some(core=>core.id===item.id))projects.push({...item,builtIn:false});
 return {projects,stored:records,etag:object?.etag??null};
}
export async function projectAllowed(env,id,request){
 if(!VALID_PROJECT_ID.test(String(id||"")))return false;
 // Mini projects and built-in projects work before any catalog is created.
 const {projects}=await readCatalog(env);
 const project=projects.find(project=>project.id===id&&!project.archived);
 if(!project)return false;
 if(project.visibility==="public"||project.builtIn&&project.visibility!=="private")return true;
 if(!request)return false;
 const user=await accountUser(request,env);
 return !!user&&project.ownerId===user.id||await isAdmin(request,env);
}
export async function canEditProject(request,env,id){
 const {projects}=await readCatalog(env);
 const project=projects.find(p=>p.id===id&&!p.archived);
 if(!project)return false;
 const user=await accountUser(request,env);
 return !!user&&project.ownerId===user.id||project.builtIn&&await isAdmin(request,env);
}
export async function projectDetails(request,env,id){
 const {projects}=await readCatalog(env);
 const project=projects.find(p=>p.id===id);
 if(!project)return null;
 const user=await accountUser(request,env);
 const owner=!!user&&user.id===project.ownerId;
 const admin=project.builtIn&&await isAdmin(request,env);
 return {project,owner:owner||admin,user};
}
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
export async function onRequest({request,env}){
 if(!env.PHOTOS)return json({error:"Project storage unavailable"},503);
 const method=request.method;
 if(method==="GET"){
  const includeArchived=new URL(request.url).searchParams.has("includeArchived");
  const {projects}=await readCatalog(env),user=await accountUser(request,env),admin=await isAdmin(request,env);
  return json({projects:projects.filter(p=>(!p.archived||includeArchived&&(p.ownerId===user?.id||p.builtIn&&admin))&&(p.visibility==="public"||p.builtIn&&p.visibility!=="private"||p.ownerId===user?.id||p.builtIn&&admin)).map(p=>({...p,isOwner:p.ownerId===user?.id||p.builtIn&&admin}))});

 }
 if(!["POST","DELETE","PATCH"].includes(method))return json({error:"Method not allowed"},405);
 const user=await accountUser(request,env),admin=await isAdmin(request,env);
 if(!user&&!admin)return json({error:"Sign in to manage projects"},401);
 const input=await request.json().catch(()=>null);
 if(!input||typeof input!=="object")return json({error:"Invalid project request"},400);
 const catalog=await readCatalog(env);
 let updated;
 if(method==="POST"){
  const name=String(input.name||"").trim(),description=String(input.description||"").trim();
  if(!name||name.length>100||description.length>500)return json({error:"Project name must be 1–100 characters and description at most 500"},400);
  const kind=input.kind==="mini"?"mini":"project";
  if(!user)return json({error:"A personal account is required to create a project"},401);
  const project={id:"p"+crypto.randomUUID().replace(/-/g,""),name,description,kind,archived:false,ownerId:user.id,visibility:"private",editMode:"approval"};
  updated=[...catalog.stored,project];
 }else{
  const item=catalog.projects.find(p=>p.id===input.id);
  if(!item)return json({error:"Project not found"},404);
  if(item.ownerId!==user?.id&&!(item.builtIn&&admin))return json({error:"Only the project owner can manage it"},403);
  if(method==="DELETE"&&String(input.confirmName||"").trim()!==item.name)return json({error:"Type the exact project name to confirm removal"},400);
  if(method==="DELETE"&&item.archived)return json({error:"Project is already archived"},409);
  const changed={...item};
  if(method==="DELETE")changed.archived=true;
  else if(input.action==="restore"){
   if(!item.archived)return json({error:"Project is already active"},409);
   changed.archived=false;
  }else{
   if(item.archived)return json({error:"Restore the project before changing settings"},409);
   if(input.visibility!==undefined){
    if(!["private","public","unlisted"].includes(input.visibility))return json({error:"Invalid visibility"},400);
    changed.visibility=input.visibility;
   }
   if(input.editMode!==undefined){
    if(!["locked","approval","collaborative"].includes(input.editMode))return json({error:"Invalid editing mode"},400);
    changed.editMode=input.editMode;
   }
   if(input.name!==undefined){if(typeof input.name!=="string"||!input.name.trim()||input.name.length>100)return json({error:"Invalid project name"},400);changed.name=input.name.trim()}
  }
  delete changed.builtIn;
  updated=[...catalog.stored.filter(p=>p.id!==item.id),changed];
 }
 const condition=catalog.etag?{onlyIf:{etagMatches:catalog.etag}}:{onlyIf:{etagDoesNotMatch:"*"}};
 const saved=await env.PHOTOS.put(CATALOG_KEY,JSON.stringify({schemaVersion:1,projects:updated}),condition);
 if(saved===null)return json({error:"Project list changed. Refresh and retry."},409);
 const {projects}=await readCatalog(env);
 return json({ok:true,projects:projects.filter(p=>!p.archived&&((p.ownerId===user?.id)||(p.visibility==="public")||p.builtIn))});
}
