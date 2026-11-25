import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import {TestD1} from "./helpers/d1.mjs";
import {TestR2} from "./helpers/r2.mjs";
import {provisionTestAccount} from "./helpers/accounts.mjs";
import {initializeProjectEngine,projectEngineSchemaReady,PROJECT_ENGINE_SCHEMA_VERSION} from "../functions/api/project-engine-migrations.js";
import {handleProjectEngine} from "../functions/api/project-engine.js";
import {projectSelectionUses} from "../functions/api/project-selection-uses.js";
import {commitProjectCommand,CommandConflict} from "../functions/api/project-command.js";
const origin="https://preview.example.test",id=()=>crypto.randomUUID();

test("only the validated engine entry invokes schema initialization; Workshop reads remain read-only before setup",async()=>{
 const callers=readdirSync("functions/api").filter(path=>path.endsWith(".js")&&path!=="project-engine-migrations.js"&&/\binitializeProjectEngine\s*\(/.test(readFileSync("functions/api/"+path,"utf8")));assert.deepEqual(callers,["project-workspace-api.js"]);
 const env={NEW_PROJECT_ENGINE:"1",WORKSHOP_DB:new TestD1(),PHOTOS:new TestR2(),admin_password:"synthetic-owner-secret"};try{
  const login=await provisionTestAccount(new Request(origin+"/api/accounts",{method:"POST",headers:{origin},body:JSON.stringify({action:"register",email:"migration-owner@example.test",password:"synthetic-password"})}),env,{role:"admin"}),cookie=login.headers.get("set-cookie").split(";")[0],request=(path,method="GET",body)=>new Request(origin+path,{method,headers:{origin,cookie},...(body?{body:JSON.stringify(body)}:{})});
  assert.deepEqual(await projectSelectionUses(request("/api/workshop"),env),[]);assert.equal(await projectEngineSchemaReady(env.WORKSHOP_DB),false);assert.equal((await env.WORKSHOP_DB.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name LIKE 'engine_%' OR name='project_engine_migrations'").first()).n,0);
  for(const [path,method,body,status]of [["/api/project-engine/proof","GET",null,405],["/api/project-engine/proof","POST",{operationId:id(),expectedRevision:id()},400],["/api/project-engine/projects/invalid","GET",null,404],["/api/project-engine/projects","DELETE",null,405],["/api/project-engine/unknown","GET",null,404],["/api/project-engine/maintenance/orphans","POST",{},405],["/api/project-engine/maintenance/orphans?kind=delete","GET",null,400]])assert.equal((await handleProjectEngine(request(path,method,body),env)).status,status);
  assert.equal((await env.WORKSHOP_DB.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='project_engine_migrations'").first()).n,0);
  assert.equal((await handleProjectEngine(request("/api/project-engine/projects"),env)).status,200);assert.equal(await projectEngineSchemaReady(env.WORKSHOP_DB),true);
  const inventory=await handleProjectEngine(request("/api/project-engine/maintenance/orphans?kind=objects"),env);assert.equal(inventory.status,200);assert.equal((await inventory.json()).dryRun,true);
  const versions=(await env.WORKSHOP_DB.prepare("SELECT * FROM project_engine_migrations ORDER BY version").all()).results;assert.equal(versions.length,PROJECT_ENGINE_SCHEMA_VERSION);
  assert.deepEqual(await projectSelectionUses(request("/api/workshop"),env),[]);assert.deepEqual((await env.WORKSHOP_DB.prepare("SELECT * FROM project_engine_migrations ORDER BY version").all()).results,versions);
  const proof=await handleProjectEngine(request("/api/project-engine/proof","POST",{operationId:id(),expectedRevision:null}),env);assert.equal(proof.status,200,await proof.clone().text());assert.equal((await proof.json()).ok,true);
 }finally{env.WORKSHOP_DB.close();}
});

test("two initializer instances accept another isolate's atomic migration instead of replaying ALTER failures",async()=>{
 const db=new TestD1(),other=new TestD1(db.sqlite),batch=db.batch.bind(db);let raced=false;try{
  db.batch=async statements=>{if(!raced){raced=true;await initializeProjectEngine(other);}return batch(statements);};
  await initializeProjectEngine(db);assert.equal(raced,true);assert.equal(await projectEngineSchemaReady(db),true);assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM project_engine_migrations").first()).n,PROJECT_ENGINE_SCHEMA_VERSION);
 }finally{db.close();}
});

test("a genuine migration failure rolls back, clears in-flight setup and can retry",async()=>{
 const db=new TestD1(),batch=db.batch.bind(db);let calls=0;try{
  db.batch=async statements=>{if(++calls===3)throw Error("SQLITE synthetic migration failure");return batch(statements);};
  await assert.rejects(initializeProjectEngine(db),/synthetic migration failure/);assert.equal(await projectEngineSchemaReady(db),false);assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM project_engine_migrations").first()).n,2);
  db.batch=batch;await initializeProjectEngine(db);assert.equal(await projectEngineSchemaReady(db),true);
 }finally{db.close();}
});

test("an engine that already opened this binding refuses a later unknown schema version",async()=>{
 const db=new TestD1();try{
  await initializeProjectEngine(db);await db.prepare("INSERT INTO project_engine_migrations(version,applied_at) VALUES(?,?)").bind(PROJECT_ENGINE_SCHEMA_VERSION+1,"future").run();assert.equal(await projectEngineSchemaReady(db),false);await assert.rejects(initializeProjectEngine(db),/newer engine version/);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM engine_projects").first()).n,0);
 }finally{db.close();}
});

test("a schema upgrade after entry validation blocks old command admission but an already committed receipt still replays",async()=>{
 const db=new TestD1();try{
  await initializeProjectEngine(db);const projectId=id(),input={projectId,actorId:"fixture-owner",operationId:id(),expectedRevision:null,payload:{action:"create"}},created=await commitProjectCommand(db,input,w=>{w.insert("engine_projects",{id:projectId,owner_id:input.actorId,name:"Preserved",revision:w.revision,created_at:w.createdAt});return {projectId};});
  await db.prepare("INSERT INTO project_engine_migrations(version,applied_at) VALUES(?,?)").bind(PROJECT_ENGINE_SCHEMA_VERSION+1,"future").run();
  assert.deepEqual(await commitProjectCommand(db,input,()=>{throw Error("A replay cannot rebuild writes");}),created);
  await assert.rejects(commitProjectCommand(db,{...input,operationId:id(),expectedRevision:created.revision,payload:{action:"old-version-rename"}},w=>{w.update("engine_projects",{name:"Must not save"},{id:projectId,owner_id:input.actorId});return {};}),CommandConflict);
  assert.equal((await db.prepare("SELECT name FROM engine_projects WHERE id=?").bind(projectId).first()).name,"Preserved");assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM engine_operations").first()).n,1);
 }finally{db.close();}
});
