import {test} from "node:test";
import assert from "node:assert/strict";
import {TestD1} from "./helpers/d1.mjs";
import {TestR2} from "./helpers/r2.mjs";
import {provisionTestAccount} from "./helpers/accounts.mjs";
import {initializeProjectEngine} from "../functions/api/project-engine-migrations.js";
import {commitProjectCommand,canonicalJSON,CommandConflict} from "../functions/api/project-command.js";
import {proveProjectCommands} from "../functions/api/project-engine-proof.js";
import {handleProjectEngine} from "../functions/api/project-engine.js";
import worker from "../worker.js";
import {readFileSync} from "node:fs";
const id=()=>crypto.randomUUID();
const newProject=async db=>{
 await initializeProjectEngine(db);
 const projectId=id(),actorId="fixture-owner",input={projectId,actorId,operationId:id(),expectedRevision:null,payload:{action:"create"}};
 const result=await commitProjectCommand(db,input,w=>{w.insert("engine_projects",{id:projectId,owner_id:actorId,name:"Fixture",revision:w.revision,created_at:w.createdAt});return {projectId};});
 return {input,result};
};
test("canonical request fingerprints preserve JSON type and unset distinctions",()=>{
 assert.equal(canonicalJSON({b:0,a:false}),canonicalJSON({a:false,b:0}));
 for(const [a,b] of [[0,false],["",null],[{}, {value:null}],[{}, {value:""}],[{}, {value:false}]])assert.notEqual(canonicalJSON(a),canonicalJSON(b));
 for(const value of [NaN,Infinity,undefined,()=>0])assert.throws(()=>canonicalJSON(value));
});
test("guarded command proof exercises real SQL and can replay its retained dataset",async()=>{
 const db=new TestD1();try{
  const run=id(),proof=await proveProjectCommands(db,"fixture-owner",run);assert.equal(proof.ok,true);assert.equal(proof.checks.length,7);
  assert.equal((await proveProjectCommands(db,"fixture-owner",run)).ok,true);
  const initial=await db.prepare("SELECT snapshot FROM engine_configurations WHERE project_id=? AND fingerprint='initial'").bind(run).first();
  const specs=JSON.parse(initial.snapshot).specs;
  assert.equal(specs[1].value,0);assert.equal(specs[2].value,false);assert.equal(specs[3].value,"");assert.equal(Object.hasOwn(specs[4],"value"),false);
 }finally{db.close();}
});
test("concurrent stale writers and identical retries admit one durable result",async()=>{
 const db=new TestD1();try{
  const {input,result}=await newProject(db);const command={...input,expectedRevision:result.revision,operationId:id(),payload:{action:"rename",name:"New"}};
  const build=w=>{w.update("engine_projects",{name:"New"},{id:input.projectId,owner_id:input.actorId});return {name:"New"};};
  const results=await Promise.all([commitProjectCommand(db,command,build),commitProjectCommand(db,command,build)]);assert.deepEqual(results[0],results[1]);
  assert.equal((await db.prepare("SELECT COUNT(*) AS count FROM engine_operations").first()).count,2);
  await assert.rejects(commitProjectCommand(db,{...command,operationId:id()},build),CommandConflict);
  assert.equal((await db.prepare("SELECT name FROM engine_projects").first()).name,"New");
 }finally{db.close();}
});
test("failed batch can retry with the same operation ID; no-op and cross-project builders write nothing",async()=>{
 const db=new TestD1();try{
  const {input,result}=await newProject(db);const command={...input,expectedRevision:result.revision,operationId:id(),payload:{action:"rename"}};
  await assert.rejects(commitProjectCommand(db,command,w=>{w.update("engine_projects",{name:"Must roll back"},{id:input.projectId,owner_id:input.actorId});w.insert("engine_events",{id:id(),project_id:input.projectId,item_id:"missing",type:"note",title:"Failure",payload:"{}",created_at:w.createdAt});return {};}));
  assert.equal((await db.prepare("SELECT name FROM engine_projects").first()).name,"Fixture");
  const success=await commitProjectCommand(db,command,w=>{w.update("engine_projects",{name:"Recovered"},{id:input.projectId,owner_id:input.actorId});return {};});
  const before=(await db.prepare("SELECT COUNT(*) AS count FROM engine_operations").first()).count;
  await assert.rejects(commitProjectCommand(db,{...command,expectedRevision:success.revision,operationId:id()},()=>({})),/unchanged save/);
  await assert.rejects(commitProjectCommand(db,{...command,operationId:id()},w=>{w.insert("engine_projects",{id:id(),owner_id:input.actorId,revision:w.revision,name:"Other",created_at:w.createdAt});return {};}),/another project/);
  assert.equal((await db.prepare("SELECT COUNT(*) AS count FROM engine_operations").first()).count,before);
 }finally{db.close();}
});
test("a command cannot accidentally update every item in a project",async()=>{
 const db=new TestD1();try{
  const {input,result}=await newProject(db);
  const command={...input,operationId:id(),expectedRevision:result.revision,payload:{action:"invalid-broad-update"}};
  const before=await db.prepare("SELECT revision FROM engine_projects").first();
  await assert.rejects(commitProjectCommand(db,command,w=>{w.update("engine_items",{name:"Must not run"},{project_id:input.projectId});return {};}),/exact row ID/);
  assert.deepEqual(await db.prepare("SELECT revision FROM engine_projects").first(),before);
  assert.equal((await db.prepare("SELECT COUNT(*) AS count FROM engine_operations").first()).count,1);
 }finally{db.close();}
});
const origin="https://preview.example.test";
const req=(path,method="GET",cookie,body,requestOrigin=origin)=>new Request(origin+path,{method,headers:{origin:requestOrigin,...(cookie?{cookie}:{}),"content-type":"application/json"},...(body?{body:JSON.stringify(body)}:{})});
async function environment(role="admin"){
 const env={NEW_PROJECT_ENGINE:"1",WORKSHOP_DB:new TestD1(),PHOTOS:new TestR2(),admin_password:"synthetic-preview-secret",ASSETS:{fetch:async()=>new Response("Proof page")}};
 const response=await provisionTestAccount(req("/api/accounts","POST",null,{action:"register",email:role+"@example.test",password:"synthetic-preview-password"}),env,{role});
 return {env,cookie:response.headers.get("set-cookie").split(";")[0]};
}
test("production flag denies routes before auth, migrations and static assets",async()=>{
 const unavailable={get(){throw Error("Production storage must not be accessed");}};
 const env={PHOTOS:unavailable,WORKSHOP_DB:unavailable,ASSETS:{fetch(){throw Error("Static proof page must not be served");}}};
 for(const path of ["/api/project-engine","/api/project-engine/proof","/api/project-engine/files/1","/project-engine-proof","/project-engine-proof.html","/project-engine-proof/"]){
  assert.equal((await worker.fetch(req(path),env,{})).status,404);
 }
 assert.equal((await handleProjectEngine(req("/api/project-engine/proof","POST"),env)).status,404);
 const config=JSON.parse(readFileSync("wrangler.jsonc","utf8"));assert.equal(config.vars?.NEW_PROJECT_ENGINE,undefined);assert.equal(config.previews.vars.NEW_PROJECT_ENGINE,"1");
 assert.notEqual(config.previews.d1_databases[0].database_name,config.d1_databases[0].database_name);
 assert.ok(config.assets.run_worker_first.includes("/project-engine-proof*"));
});
test("preview proof needs owner, same origin and valid write tokens; no R2 objects change",async()=>{
 const {env,cookie}=await environment();try{
  const payload={expectedRevision:null,operationId:id()};
  for(const path of ["/api/project-engine/proof","/api/project-engine/files/1","/project-engine-proof.html"])assert.equal((await worker.fetch(req(path),env,{})).status,401);
  assert.equal((await worker.fetch(req("/api/project-engine/proof","POST",cookie,payload,"https://other.example.test"),env,{})).status,403);
  assert.equal((await worker.fetch(req("/api/project-engine/proof","POST",cookie,{}),env,{})).status,400);
  assert.equal((await env.WORKSHOP_DB.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE name='engine_projects'").first()).count,0);
  const keys=[...env.PHOTOS.objects.keys()],response=await worker.fetch(req("/api/project-engine/proof","POST",cookie,payload),env,{});
  assert.equal(response.status,200);assert.equal((await response.json()).ok,true);assert.deepEqual([...env.PHOTOS.objects.keys()],keys);
 }finally{env.WORKSHOP_DB.close();}
 const member=await environment("member");try{assert.equal((await worker.fetch(req("/api/project-engine/proof","POST",member.cookie,{expectedRevision:null,operationId:id()}),member.env,{})).status,401);}finally{member.env.WORKSHOP_DB.close();}
});

test("malformed preview proof input returns 400 before any migration",async()=>{
 const {env,cookie}=await environment();try{
  for(const raw of ["null","[]","false","42",'"text"',"{",JSON.stringify({expectedRevision:null,operationId:"invalid"})]){
   const request=new Request(origin+"/api/project-engine/proof",{method:"POST",headers:{origin,cookie,"content-type":"application/json"},body:raw});
   assert.equal((await worker.fetch(request,env,{})).status,400,raw);
  }
  assert.equal((await env.WORKSHOP_DB.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE name='project_engine_migrations'").first()).count,0);
 }finally{env.WORKSHOP_DB.close();}
});
