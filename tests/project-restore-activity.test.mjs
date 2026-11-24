import {test} from "node:test";
import assert from "node:assert/strict";
import {TestD1} from "./helpers/d1.mjs";
import {fixture,upload} from "./helpers/project-workspace.mjs";
import {initializeProjectEngine,PROJECT_ENGINE_SCHEMA_VERSION} from "../functions/api/project-engine-migrations.js";
import {restoreStaging} from "../functions/api/project-restore-staging.js";
import {claimInactiveRestore,inventoryProjectOrphans} from "../functions/api/project-orphan-cleanup.js";
import {touchRestoreActivity,restoreRetirementStatus,RESTORE_INACTIVITY_MS} from "../functions/api/project-restore-activity.js";
import {handleProjectWorkspace} from "../functions/api/project-workspace-api.js";
import {commitProjectCommand} from "../functions/api/project-command.js";
const id=()=>crypto.randomUUID(),base="https://preview.example.test/api/project-engine/projects/",now=Date.now(),old=new Date(now-2*RESTORE_INACTIVITY_MS).toISOString();
function seed(db,{projectId=id(),actorId="fixture-owner",operationId=id(),state="staging",activity=old,created=old}={}){
 const jobId=id();db.sqlite.prepare("INSERT INTO engine_restore_jobs(id,project_id,actor_id,operation_id,state,row_count,created_at,last_activity_at) VALUES(?,?,?,?,?,0,?,?)").run(jobId,projectId,actorId,operationId,state,created,activity);return {id:jobId,projectId,actorId,operationId};
}
const job=(db,scope)=>db.sqlite.prepare("SELECT * FROM engine_restore_jobs WHERE id=?").get(scope.id);
const claim=(db,scope,observedActivity=job(db,scope).last_activity_at)=>claimInactiveRestore(db,{jobId:scope.id,actorId:scope.actorId,observedActivity},{now});
const restoreRequest=(backup,project,operation)=>new Request(base+project+"/import-copy?name=Recovered",{method:"POST",headers:{origin:"https://preview.example.test","x-operation-id":operation,"x-project-revision":"new"},body:backup});
const exportOf=async f=>(await handleProjectWorkspace(new Request(base+f.projectId+"/export"),f.env,f.owner)).text();

test("migration 7 gives existing schema-6 jobs a new grace period without rewriting their saved identity",async()=>{
 const db=new TestD1(),batch=db.batch.bind(db);let count=0;try{
  db.batch=async statements=>{if(++count===7)throw Error("SQLITE stop at applied schema 6");return batch(statements);};await assert.rejects(initializeProjectEngine(db),/schema 6/);
  assert.equal((await db.prepare("SELECT MAX(version) AS version FROM project_engine_migrations").first()).version,6);const jobId=id(),projectId=id(),operationId=id();await db.prepare("INSERT INTO engine_restore_jobs(id,project_id,actor_id,operation_id,state,row_count,created_at) VALUES(?,?,?,?,'staging',0,?)").bind(jobId,projectId,"fixture-owner",operationId,old).run();
  db.batch=batch;const before=Date.now();await initializeProjectEngine(db);const saved=job(db,{id:jobId});assert.equal(saved.id,jobId);assert.equal(saved.project_id,projectId);assert.equal(saved.operation_id,operationId);assert.equal(saved.created_at,old);assert.ok(Date.parse(saved.last_activity_at)>=before-1);assert.equal(saved.cleanup_token,null);
  assert.equal((await restoreRetirementStatus(db,saved,"fixture-owner",{now:Date.parse(saved.last_activity_at)+RESTORE_INACTIVITY_MS-1})).claimable,false);
 }finally{db.close();}
});

test("a heartbeat racing a stale cleanup observation wins without a claim or metadata loss",async()=>{
 const db=new TestD1();try{
  await initializeProjectEngine(db);const scope=seed(db),observed=job(db,scope).last_activity_at,prepare=db.prepare.bind(db);let raced=false;
  db.prepare=sql=>{const prepared=prepare(sql);if(!sql.startsWith("UPDATE engine_restore_jobs AS j SET cleanup_token="))return prepared;return {bind(...values){const bound=prepared.bind(...values);return {async run(){raced=true;await touchRestoreActivity(db,scope,now);return bound.run();}};}};};
  await assert.rejects(claim(db,scope,observed),error=>error.status===409);db.prepare=prepare;assert.equal(raced,true);assert.equal(job(db,scope).cleanup_token,null);assert.equal(job(db,scope).last_activity_at,new Date(now).toISOString());
 }finally{db.close();}
});

test("slow metadata progress refreshes activity even before the first bounded staging batch is full",async()=>{
 const db=new TestD1(),clock=Date.now;try{
  await initializeProjectEngine(db);const projectId=id(),operationId=id(),staging=await restoreStaging(db,projectId,"fixture-owner",operationId,file=>file.id,{}),advanced=clock()+31000;Date.now=()=>advanced;
  await staging.add("items",{id:id(),project_id:projectId,name:"Slow upload",part_number:"NR100",kind:"part",source:"custom",fields:"{}",created_at:old});
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM engine_restore_rows WHERE job_id=?").bind(staging.id).first()).n,0);assert.equal(Date.parse(job(db,staging).last_activity_at),advanced);
  assert.equal((await restoreRetirementStatus(db,job(db,staging),"fixture-owner",{now:advanced+RESTORE_INACTIVITY_MS-1})).claimable,false);
 }finally{Date.now=clock;db.close();}
});

test("an acknowledged edit racing retirement is protected even when it uses a different operation ID",async()=>{
 const db=new TestD1();try{
  await initializeProjectEngine(db);const scope=seed(db);db.sqlite.prepare("INSERT INTO engine_projects(id,owner_id,name,revision,created_at,restore_job_id) VALUES(?,?,?,?,?,?)").run(scope.projectId,scope.actorId,"Pending",id(),old,scope.id);const prepare=db.prepare.bind(db);let raced=false;
  db.prepare=sql=>{const prepared=prepare(sql);if(!sql.startsWith("UPDATE engine_restore_jobs AS j SET cleanup_token="))return prepared;return {bind(...values){const bound=prepared.bind(...values);return {async run(){raced=true;await db.batch([db.prepare("INSERT INTO engine_operations(project_id,actor_id,operation_id,request_hash,attempt_id,result,created_at) VALUES(?,?,?,?,?,'{}',?)").bind(scope.projectId,scope.actorId,id(),"acknowledged-edit",id(),old),db.prepare("UPDATE engine_projects SET name='Acknowledged new work' WHERE id=?").bind(scope.projectId)]);return bound.run();}};}};};
  await assert.rejects(claim(db,scope),error=>error.status===409);db.prepare=prepare;assert.equal(raced,true);assert.equal(job(db,scope).cleanup_token,null);assert.equal((await db.prepare("SELECT name FROM engine_projects WHERE id=?").bind(scope.projectId).first()).name,"Acknowledged new work");assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM engine_operations WHERE project_id=?").bind(scope.projectId).first()).n,1);
 }finally{db.close();}
});

test("a retirement claim is scoped and permanent, blocks resumption and prevents a replacement retry job",async()=>{
 const db=new TestD1();try{
  await initializeProjectEngine(db);const scope=seed(db),receipt=await claim(db,scope);assert.ok(receipt.cleanupToken);assert.deepEqual(await claim(db,scope),receipt);
  await assert.rejects(claimInactiveRestore(db,{jobId:scope.id,actorId:"another-owner",observedActivity:old},{now}),error=>error.status===404);
  await assert.rejects(touchRestoreActivity(db,scope,now),error=>error.status===409);await assert.rejects(restoreStaging(db,scope.projectId,scope.actorId,scope.operationId,file=>file.id,{}),error=>error.status===409);
  assert.throws(()=>db.sqlite.prepare("INSERT INTO engine_restore_rows(job_id,table_name,row_id,position,data) VALUES(?,'items',?,0,'{}')").run(scope.id,id()),/RESTORE_OPERATION_RETIRED/);
  assert.throws(()=>seed(db,scope),/RESTORE_OPERATION_RETIRED/);assert.throws(()=>db.sqlite.prepare("UPDATE engine_restore_jobs SET cleanup_token=NULL WHERE id=?").run(scope.id),/RESTORE_OPERATION_RETIRED/);assert.throws(()=>db.sqlite.prepare("DELETE FROM engine_restore_jobs WHERE id=?").run(scope.id),/RESTORE_OPERATION_RETIRED/);
  await assert.rejects(commitProjectCommand(db,{projectId:scope.projectId,actorId:scope.actorId,operationId:scope.operationId,expectedRevision:null,payload:{action:"reuse-as-create"}},w=>{w.insert("engine_projects",{id:scope.projectId,owner_id:scope.actorId,name:"Wrong reuse",revision:w.revision,created_at:w.createdAt});return {};}),error=>error.status===409);
  assert.throws(()=>db.sqlite.prepare("INSERT INTO engine_operations(project_id,actor_id,operation_id,request_hash,attempt_id,result,created_at) VALUES(?,?,?,?,?,'{}',?)").run(scope.projectId,scope.actorId,scope.operationId,"older-writer",id(),old),/RESTORE_OPERATION_RETIRED/);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM engine_restore_jobs").first()).n,1);assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM engine_projects").first()).n,0);
 }finally{db.close();}
});

test("recent peer progress protects the entire recovery operation; a later claim fences every inactive peer",async()=>{
 const db=new TestD1();try{
  await initializeProjectEngine(db);const a=seed(db),b=seed(db,{...a,activity:new Date(now).toISOString()});await assert.rejects(claim(db,a),error=>error.status===409);
  db.sqlite.prepare("UPDATE engine_restore_jobs SET last_activity_at=? WHERE id=?").run(old,b.id);await claim(db,a);await assert.rejects(touchRestoreActivity(db,b,now),error=>error.status===409);assert.throws(()=>db.sqlite.prepare("INSERT INTO engine_restore_rows(job_id,table_name,row_id,position,data) VALUES(?,'items',?,0,'{}')").run(b.id,id()),/RESTORE_OPERATION_RETIRED/);
  const different=seed(db,{projectId:a.projectId,operationId:id()});await touchRestoreActivity(db,different,now);assert.equal(job(db,different).cleanup_token,null);
 }finally{db.close();}
});

test("published targets, foreign owners, completed jobs, stale observations and unknown schema versions cannot be claimed",async()=>{
 const f=await fixture();try{
  await assert.rejects(claim(f.db,seed(f.db,{projectId:f.projectId})),error=>error.status===409);const foreign=id();f.db.sqlite.prepare("INSERT INTO engine_projects(id,owner_id,name,revision,created_at) VALUES(?,'another-owner','Private',?,?)").run(foreign,id(),old);
  await assert.rejects(claim(f.db,seed(f.db,{projectId:foreign})),error=>error.status===409);await assert.rejects(claim(f.db,seed(f.db,{state:"complete"})),error=>error.status===409);
  const acknowledged=seed(f.db);f.db.sqlite.prepare("INSERT INTO engine_projects(id,owner_id,name,revision,created_at,restore_job_id) VALUES(?,?,?,?,?,?)").run(acknowledged.projectId,f.owner.id,"Older acknowledged work",id(),old,acknowledged.id);f.db.sqlite.prepare("INSERT INTO engine_operations(project_id,actor_id,operation_id,request_hash,attempt_id,result,created_at) VALUES(?,?,?,?,?,'{}',?)").run(acknowledged.projectId,f.owner.id,id(),"unrelated-old-edit",id(),old);await assert.rejects(claim(f.db,acknowledged),/committed operation receipt/);assert.equal(job(f.db,acknowledged).cleanup_token,null);
  const scope=seed(f.db);await assert.rejects(claim(f.db,scope,new Date(now-3*RESTORE_INACTIVITY_MS).toISOString()),error=>error.status===409);f.db.sqlite.prepare("INSERT INTO project_engine_migrations(version,applied_at) VALUES(?,'future')").run(PROJECT_ENGINE_SCHEMA_VERSION+1);await assert.rejects(claim(f.db,scope),error=>error.status===409);await assert.rejects(touchRestoreActivity(f.db,scope,now),error=>error.status===409);assert.equal(job(f.db,scope).cleanup_token,null);
 }finally{f.db.close();}
});

test("retirement after loading blocks both current publication and older unguarded SQL without changing the source",async()=>{
 const f=await fixture();try{
  await upload(f,"drawing.step",new TextEncoder().encode("Exact source bytes"));const backup=await exportOf(f),project=id(),operation=id();f.db.sqlite.exec("CREATE TRIGGER pause_retirement_test BEFORE UPDATE OF state ON engine_restore_jobs WHEN NEW.state='complete' BEGIN SELECT RAISE(ABORT,'SQLITE pause before publication'); END");
  assert.notEqual((await handleProjectWorkspace(restoreRequest(backup,project,operation),f.env,f.owner)).status,200);f.db.sqlite.exec("DROP TRIGGER pause_retirement_test");const pending=f.db.sqlite.prepare("SELECT restore_job_id FROM engine_projects WHERE id=?").get(project),scope={id:pending.restore_job_id,projectId:project,actorId:f.owner.id,operationId:operation};f.db.sqlite.prepare("UPDATE engine_restore_jobs SET created_at=?,last_activity_at=? WHERE id=?").run(old,old,scope.id);await claim(f.db,scope);
  const objects=f.env.PHOTOS.objects.size;assert.equal((await handleProjectWorkspace(restoreRequest(backup,project,operation),f.env,f.owner)).status,409);assert.equal(f.env.PHOTOS.objects.size,objects);assert.equal((await handleProjectWorkspace(new Request(base+project+"/state"),f.env,f.owner)).status,404);
  await assert.rejects(f.db.batch([f.db.prepare("INSERT INTO engine_operations(project_id,actor_id,operation_id,request_hash,attempt_id,result,created_at) VALUES(?,?,?,?,?,'{}',?)").bind(project,f.owner.id,id(),"old-version",id(),old),f.db.prepare("UPDATE engine_projects SET restore_job_id=NULL WHERE id=?").bind(project)]),/RESTORE_OPERATION_RETIRED/);
  assert.throws(()=>f.db.sqlite.prepare("UPDATE engine_items SET name='Wrong' WHERE project_id=?").run(project),/RESTORE_OPERATION_RETIRED/);assert.throws(()=>f.db.sqlite.prepare("UPDATE engine_restore_jobs SET state='complete' WHERE id=?").run(scope.id),/RESTORE_OPERATION_RETIRED/);assert.equal(f.db.sqlite.prepare("SELECT COUNT(*) AS n FROM engine_operations WHERE project_id=?").get(project).n,0);
  assert.equal((await handleProjectWorkspace(restoreRequest(backup,id(),id()),f.env,f.owner)).status,200);assert.equal(await exportOf(f),backup);
 }finally{f.db.close();}
});

test("a claim before file transfer prevents a resumed request from writing restored bytes",async()=>{
 const f=await fixture();try{
  await upload(f,"drawing.step",new TextEncoder().encode("Original bytes"));const backup=await exportOf(f),project=id(),operation=id(),prepare=f.db.prepare.bind(f.db),objects=f.env.PHOTOS.objects.size;let retired=false;
  f.db.prepare=sql=>{const prepared=prepare(sql);if(!sql.startsWith("SELECT data FROM engine_restore_rows WHERE job_id=? AND table_name='files'"))return prepared;return {bind(...values){const bound=prepared.bind(...values);return {async first(){if(!retired){retired=true;f.db.sqlite.prepare("UPDATE engine_restore_jobs SET created_at=?,last_activity_at=? WHERE id=?").run(old,old,values[0]);await claim(f.db,{id:values[0],projectId:project,actorId:f.owner.id,operationId:operation});}return bound.first();}};}};};
  const response=await handleProjectWorkspace(restoreRequest(backup,project,operation),f.env,f.owner);f.db.prepare=prepare;assert.equal(response.status,409,await response.clone().text());assert.equal(retired,true);assert.equal(f.env.PHOTOS.objects.size,objects);assert.equal(f.db.sqlite.prepare("SELECT COUNT(*) AS n FROM engine_projects WHERE id=?").get(project).n,0);assert.equal(await exportOf(f),backup);
 }finally{f.db.close();}
});

test("inventory reports observed activity for claimable jobs without exposing tokens or executing claims",async()=>{
 const f=await fixture();try{
  const scope=seed(f.db),before=f.db.sqlite.prepare("SELECT total_changes() AS n").get().n,inspect=()=>inventoryProjectOrphans(f.db,f.env.PHOTOS,f.owner.id,new URLSearchParams({kind:"restores"}),{now});const report=await inspect();assert.equal(report.executable,false);assert.ok(report.candidates.some(row=>row.id===scope.id&&row.action==="inactive_restore_claim"&&row.observedActivity===old));assert.equal(f.db.sqlite.prepare("SELECT total_changes() AS n").get().n,before);
  const receipt=await claim(f.db,scope),retired=await inspect();assert.ok(retired.protected.some(row=>row.id===scope.id&&row.retired));assert.equal(JSON.stringify(retired).includes(receipt.cleanupToken),false);
 }finally{f.db.close();}
});
