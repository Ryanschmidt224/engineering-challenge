// Owner-only preview acceptance test. No R2 writes, no legacy readers, no purge.
// This is the sole initial caller of the foundation until real D1 proof passes.
import {initializeProjectEngine} from "./project-engine-migrations.js";
import {commitProjectCommand,canonicalJSON,sha256,CommandConflict} from "./project-command.js";
const tables=["engine_projects","engine_items","engine_occurrences","engine_configurations","engine_events","engine_operations"];
const check=(condition,message)=>{if(!condition)throw Error("Preview transaction proof failed: "+message);};
async function stableId(run,label){const hash=await sha256(run+"/"+label);return hash.slice(0,8)+"-"+hash.slice(8,12)+"-4"+hash.slice(13,16)+"-a"+hash.slice(17,20)+"-"+hash.slice(20,32);}
export async function proveProjectCommands(db,actorId,runId){
 await initializeProjectEngine(db);
 const projectId=runId,itemId=await stableId(runId,"item"),occurrenceId=await stableId(runId,"occurrence");
 const input=async(label,expectedRevision,payload)=>({projectId,actorId,operationId:await stableId(runId,label),expectedRevision,payload});
 const create=await input("project",null,{action:"create-proof-project"});
 const project=await commitProjectCommand(db,create,w=>{
  w.insert("engine_projects",{id:projectId,owner_id:actorId,name:"Disposable command proof",revision:w.revision,prefix:"NR",digits:4,created_at:w.createdAt});
  return {projectId};
 });
 const initial=await input("item",project.revision,{action:"create-proof-item",thickness:3});
 const initialConfig=await stableId(runId,"initial-config");
 const created=await commitProjectCommand(db,initial,w=>{
  const fields={specs:[{field_id:"thickness",label:"Thickness",value:3,unit:"mm"},{field_id:"zero",label:"Zero",value:0,unit:""},{field_id:"false",label:"False",value:false,unit:""},{field_id:"empty",label:"Empty",value:"",unit:""},{field_id:"unset",label:"Unset",unit:""}]};
  w.insert("engine_items",{id:itemId,project_id:projectId,name:"Proof bracket",part_number:"NR0100",kind:"part",source:"custom",fields:JSON.stringify(fields),created_at:w.createdAt});
  w.insert("engine_occurrences",{id:occurrenceId,project_id:projectId,item_id:itemId,quantity:1});
  w.insert("engine_configurations",{id:initialConfig,project_id:projectId,item_id:itemId,fingerprint:"initial",snapshot:JSON.stringify(fields),created_at:w.createdAt});
  return {itemId,configurationId:initialConfig};
 });
 const snapshot=async()=>{
  const result=await db.batch(tables.map(table=>db.prepare(`SELECT * FROM ${table} WHERE ${table==="engine_projects"?"id":"project_id"}=? ORDER BY ${table==="engine_operations"?"operation_id":"id"}`).bind(projectId)));
  return canonicalJSON(result.map(response=>response.results));
 };
 const rejected=async(command,build,ErrorType=CommandConflict)=>{
  const before=await snapshot();let caught;
  try{await commitProjectCommand(db,command,build);}catch(error){caught=error;}
  check(caught instanceof ErrorType,"expected rejection");
  if(ErrorType===Error)check(!(caught instanceof CommandConflict)&&/FOREIGN KEY/i.test(caught.message),"late failure must reach the SQL constraint");check(await snapshot()===before,"a rejected command changed rows");
 };
 const insertEvent=(w,id,selectedItem=itemId)=>w.insert("engine_events",{id,project_id:projectId,item_id:selectedItem,type:"revision",title:"Proof revision",payload:JSON.stringify({before:3,after:5}),created_at:w.createdAt});
 const stale=await input("stale",crypto.randomUUID(),{action:"stale-save"});
 const staleEvent=await stableId(runId,"stale-event");
 await rejected(stale,w=>{w.update("engine_items",{name:"Must not persist"},{project_id:projectId,id:itemId});insertEvent(w,staleEvent);return {};});
 const extraGuard=await input("guard",created.revision,{action:"missing-child"});
 await rejected(extraGuard,w=>{w.update("engine_items",{name:"Must not persist"},{project_id:projectId,id:crypto.randomUUID()});insertEvent(w,staleEvent);return {};});
 const revision=await input("revision",created.revision,{action:"save-revision",thickness:5});
 const configId=await stableId(runId,"revised-config"),eventId=await stableId(runId,"revision-event");
 let callbackRuns=0;
 const revise=w=>{
  callbackRuns++;
  w.update("engine_items",{fields:JSON.stringify({specs:[{field_id:"thickness",label:"Thickness",value:5,unit:"mm"}]})},{project_id:projectId,id:itemId});
  w.insert("engine_configurations",{id:configId,project_id:projectId,item_id:itemId,fingerprint:"revised",snapshot:JSON.stringify({thickness:5}),created_at:w.createdAt});
  insertEvent(w,eventId);return {itemId,configurationId:configId,eventId};
 };
 const saved=await commitProjectCommand(db,revision,revise);
 const beforeRetry=await snapshot(),retry=await commitProjectCommand(db,revision,revise);
 check(canonicalJSON(retry)===canonicalJSON(saved)&&await snapshot()===beforeRetry&&callbackRuns<=1,"lost-response retry wrote twice");
 await rejected({...revision,payload:{action:"save-revision",thickness:7}},revise);
 const late=await input("late-failure",saved.revision,{action:"late-constraint-failure"});
 const failedConfig=await stableId(runId,"failed-config"),failedEvent=await stableId(runId,"failed-event");
 await rejected(late,w=>{
  w.update("engine_items",{name:"Must roll back"},{project_id:projectId,id:itemId});
  w.insert("engine_configurations",{id:failedConfig,project_id:projectId,item_id:itemId,fingerprint:"rollback",snapshot:"{}",created_at:w.createdAt});
  insertEvent(w,failedEvent,"missing-item");return {};
 },Error);
 const final=await db.batch([
  db.prepare("SELECT COUNT(*) AS count FROM engine_events WHERE project_id=?").bind(projectId),
  db.prepare("SELECT COUNT(*) AS count FROM engine_configurations WHERE project_id=?").bind(projectId),
  db.prepare("SELECT COUNT(*) AS count FROM engine_operations WHERE project_id=?").bind(projectId)
 ]);
 check(final[0].results[0].count===1&&final[1].results[0].count===2&&final[2].results[0].count===3,"unexpected durable counts");
 return {ok:true,projectId,checkedAt:new Date().toISOString(),checks:[
  "Initial project, item, occurrence and configuration commit together",
  "Stale admission leaves header, item, configurations, events and receipts unchanged",
  "Missing dependent row blocks every write, including the receipt",
  "Successful revision creates exactly one event and configuration",
  "Lost-response retry returns the original result without rerunning writes",
  "Same operation ID with different content returns 409 without writes",
  "Late foreign-key failure rolls back earlier writes and its receipt"
 ],counts:{events:1,configurations:2,receipts:3},storage:"D1 binding supplied by the deployment; no R2 objects written"};
}
