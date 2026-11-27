import {test} from "node:test";
import assert from "node:assert/strict";
import {TestD1} from "./helpers/d1.mjs";
import {TestR2} from "./helpers/r2.mjs";
import {provisionTestAccount} from "./helpers/accounts.mjs";
import {initializeProjectEngine} from "../functions/api/project-engine-migrations.js";
import {commitProjectCommand,canonicalJSON,CommandConflict} from "../functions/api/project-command.js";
import {proveProjectCommands} from "./helpers/project-command-proof.mjs";
import {handleProjectEngine} from "../functions/api/project-engine.js";
import worker from "../worker.js";
import {readFileSync} from "node:fs";
const id=()=>crypto.randomUUID();
test("signed-out engine page keeps its 401 and serves only the sign-in shell",async()=>{
 let assets=0;const env={NEW_PROJECT_ENGINE:"1",PHOTOS:new TestR2(),admin_password:"synthetic-test-only",WORKSHOP_DB:{prepare(){throw Error("No schema or project reads before sign-in");}},ASSETS:{async fetch(request){assets++;assert.equal(new URL(request.url).pathname,"/project-signin.html");return new Response("Sign in on this page");}}};
 const response=await worker.fetch(new Request("https://preview.test/project.html"),env,{});assert.equal(response.status,401);assert.equal(response.headers.get("cache-control"),"no-store");assert.match(await response.text(),/Sign in on this page/);assert.equal(assets,1);assert.equal((await worker.fetch(new Request("https://preview.test/api/project-engine/projects"),env,{})).status,401);assert.equal(assets,1);
});
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
  await initializeProjectEngine(db);
  const run=id(),proof=await proveProjectCommands(db,"fixture-owner",run);assert.equal(proof.ok,true);assert.equal(proof.checks.length,7);
  assert.equal((await proveProjectCommands(db,"fixture-owner",run)).ok,true);
  const initial=await db.prepare("SELECT snapshot FROM engine_configurations WHERE project_id=? AND fingerprint='initial'").bind(run).first();
  const specs=JSON.parse(initial.snapshot).specs;
  assert.equal(specs[0].value,3);
  const revised=await db.prepare("SELECT snapshot FROM engine_configurations WHERE project_id=? AND fingerprint='revised'").bind(run).first();
  const current=await db.prepare("SELECT fields FROM engine_items WHERE project_id=?").bind(run).first();
  assert.deepEqual(JSON.parse(current.fields),JSON.parse(revised.snapshot));assert.equal(JSON.parse(revised.snapshot).specs[0].value,5);
  assert.equal(JSON.parse(revised.snapshot).specs.length,specs.length);
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
test("placement reorder admission checks exact sibling membership even with a fresh project token",async()=>{
 const db=new TestD1();try{
  const {input,result}=await newProject(db),item=id(),a=id(),b=id();
  const seeded=await commitProjectCommand(db,{...input,expectedRevision:result.revision,operationId:id(),payload:{action:"seed-placements"}},w=>{
   w.insert("engine_items",{id:item,project_id:input.projectId,name:"Shared",part_number:"NR100",kind:"part",source:"custom",fields:"{}",created_at:w.createdAt});
   for(const [index,placement]of [a,b].entries())w.insert("engine_occurrences",{id:placement,project_id:input.projectId,item_id:item,sort_order:index});return {};
  });
  const before=(await db.prepare("SELECT id,sort_order FROM engine_occurrences ORDER BY sort_order").all()).results,command={...input,expectedRevision:seeded.revision,operationId:id(),payload:{action:"reorder-placements"}};
  await assert.rejects(commitProjectCommand(db,command,w=>{w.reorderOccurrences(null,[a,id()]);return {};}),CommandConflict);
  assert.deepEqual((await db.prepare("SELECT id,sort_order FROM engine_occurrences ORDER BY sort_order").all()).results,before);assert.equal((await db.prepare("SELECT revision FROM engine_projects").first()).revision,seeded.revision);
  await commitProjectCommand(db,command,w=>{w.reorderOccurrences(null,[b,a]);return {};});assert.deepEqual((await db.prepare("SELECT id FROM engine_occurrences ORDER BY sort_order").all()).results.map(row=>row.id),[b,a]);
 }finally{db.close();}
});
const origin="https://preview.example.test";
const req=(path,method="GET",cookie,body,requestOrigin=origin)=>new Request(origin+path,{method,headers:{origin:requestOrigin,...(cookie?{cookie}:{}),"content-type":"application/json"},...(body?{body:JSON.stringify(body)}:{})});
async function environment(role="admin"){
 const env={NEW_PROJECT_ENGINE:"1",WORKSHOP_DB:new TestD1(),PHOTOS:new TestR2(),admin_password:"synthetic-preview-secret",ASSETS:{fetch:async()=>new Response("Proof page")}};
 const response=await provisionTestAccount(req("/api/accounts","POST",null,{action:"register",email:role+"@example.test",password:"synthetic-preview-password"}),env,{role});
 return {env,cookie:response.headers.get("set-cookie").split(";")[0]};
}
test("Projects require owner sign-in even with no rollout variable configured",async()=>{
 const env={PHOTOS:new TestR2(),admin_password:"synthetic-secret",WORKSHOP_DB:{prepare(){throw Error("No schema access before owner sign-in");}},ASSETS:{fetch:async()=>new Response("Sign in")}};
 for(const path of ["/api/project-engine/projects","/api/project-engine/settings","/project.html","/website-settings.html"])
  assert.equal((await worker.fetch(req(path),env,{})).status,401);
 assert.equal((await handleProjectEngine(req("/api/project-engine/projects"),env)).status,401);
});
test("current configuration needs no rollout flag and retains isolated storage and runtime identity",()=>{
 const config=JSON.parse(readFileSync("wrangler.jsonc","utf8"));assert.equal(config.vars.NEW_PROJECT_ENGINE,undefined);assert.equal(config.limits.cpu_ms,30000);assert.equal(config.previews.limits.cpu_ms,30000);assert.equal(config.previews.vars?.NEW_PROJECT_ENGINE,undefined);
 assert.deepEqual(config.version_metadata,{binding:"CF_VERSION_METADATA"});assert.deepEqual(config.previews.version_metadata,{binding:"CF_VERSION_METADATA"});
 assert.equal(config.d1_databases[0].database_name,"building-schmidt-workshop");assert.equal(config.r2_buckets[0].bucket_name,"building-schmidt-photos");
 assert.match(config.previews.d1_databases[0].database_id,/^[a-f0-9-]{36}$/);assert.equal(config.previews.r2_buckets[0].bucket_name,"building-schmidt-photos-preview");
 assert.notEqual(config.previews.d1_databases[0].database_name,config.d1_databases[0].database_name);
 assert.ok(!config.assets.run_worker_first.includes("/project-engine-proof*"));
});
test("retired proof API is owner-protected and never creates project tables",async()=>{
 const {env,cookie}=await environment();try{
  delete env.NEW_PROJECT_ENGINE;
  const payload={expectedRevision:null,operationId:id()},before=[...env.PHOTOS.objects.keys()];
  assert.equal((await worker.fetch(req("/api/project-engine/proof","POST",null,payload),env,{})).status,401);
  assert.equal((await worker.fetch(req("/api/project-engine/proof","POST",cookie,payload,"https://other.example.test"),env,{})).status,403);
  assert.equal((await worker.fetch(req("/api/project-engine/proof","POST",cookie,payload),env,{})).status,410);
  assert.equal((await env.WORKSHOP_DB.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE name='engine_projects'").first()).count,0);
  assert.deepEqual([...env.PHOTOS.objects.keys()],before);
 }finally{env.WORKSHOP_DB.close();}
});
