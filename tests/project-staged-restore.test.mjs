import {test} from "node:test";
import assert from "node:assert/strict";
import {fixture,upload} from "./helpers/project-workspace.mjs";
import {handleProjectWorkspace} from "../functions/api/project-workspace-api.js";
import {commitProjectCommand,CommandConflict} from "../functions/api/project-command.js";
import {cleanupCompletedRestore} from "../functions/api/project-orphan-cleanup.js";
const origin="https://preview.example.test",base=origin+"/api/project-engine/projects/",id=()=>crypto.randomUUID();
const request=(backup,project,operation,name="Recovered large project")=>new Request(base+project+"/import-copy?"+new URLSearchParams({name}),{method:"POST",headers:{origin,"x-operation-id":operation,"x-project-revision":"new"},body:backup});
const backupOf=async f=>{const response=await handleProjectWorkspace(new Request(base+f.projectId+"/export"),f.env,f.owner);assert.equal(response.status,200,await response.clone().text());return response.text();};
async function assertHidden(f,project){
 const listed=await(await handleProjectWorkspace(new Request(base),f.env,f.owner)).json();assert.equal(listed.projects.some(row=>row.id===project),false);
 for(const path of ["/state","/history","/bom","/export","/files/"+id()])assert.equal((await handleProjectWorkspace(new Request(base+project+path),f.env,f.owner)).status,404,path);
 assert.equal((await handleProjectWorkspace(new Request(base+project+"/state"),f.env,{id:"another-owner"})).status,404);
}

test("3000 revised records plus drawings export above the old row/metadata limits and recover every historical revision",async()=>{
 const f=await fixture();try{
  const file=await upload(f,"source-drawing.step",new TextEncoder().encode("Original drawing bytes")),revisions=[];
  for(let n=0;n<3000;n++){
   const response=await f.call("/items/"+f.itemId+"/records","POST",{record:{type:"note",title:"Observation "+n,fields:{text:"Observation "+n+" "+"s".repeat(2200)}}});assert.equal(response.status,200);
   if([9,999,2999].includes(n)){const revision=await f.call("/items/"+f.itemId+"/revisions","POST",{entryDetails:{whatChanged:"At "+(n+1)+" records"}});assert.equal(revision.status,200,JSON.stringify(revision));revisions.push({event:revision.result.eventId,snapshot:(await f.call("/history/"+revision.result.eventId)).result.event.payload.snapshot});}
  }
  const backup=await backupOf(f);assert.equal(JSON.parse(backup.split("\n")[0]).manifest.version,2);assert.ok(Buffer.byteLength(backup)>16*1024*1024,"The fixture exceeds the former total metadata limit");
  const project=id(),operation=id(),batch=f.db.batch.bind(f.db);let hiddenChecks=0,maxStatements=0;
  f.db.batch=async statements=>{maxStatements=Math.max(maxStatements,statements.length);const result=await batch(statements),pending=f.db.sqlite.prepare("SELECT restore_job_id FROM engine_projects WHERE id=?").get(project);if(pending?.restore_job_id){hiddenChecks++;await assertHidden(f,project);}return result;};
  const response=await handleProjectWorkspace(request(backup,project,operation),f.env,f.owner);assert.equal(response.status,200,await response.clone().text());const result=await response.json();f.db.batch=batch;
  assert.ok(Object.values(result.counts).reduce((a,b)=>a+b,0)>10000);assert.ok(result.recovery.stagingBatches>1);assert.ok(result.recovery.materializationBatches>1);assert.equal(result.recovery.publicationStatements,3);assert.equal(maxStatements,3,"Large restores never need thousands of statements in one batch");assert.ok(hiddenChecks>1);
  assert.equal(f.db.sqlite.prepare("SELECT count(*) AS n FROM engine_restore_rows r JOIN engine_restore_jobs j ON j.id=r.job_id WHERE j.project_id=?").get(project).n,0,"Completed recovery does not retain a second metadata copy");
  const state=await(await handleProjectWorkspace(new Request(base+project+"/state"),f.env,f.owner)).json();assert.equal(state.records.length,3000);assert.equal(state.project.restore_job_id,null);
  for(const revision of revisions){const detail=await(await handleProjectWorkspace(new Request(base+project+"/history/"+revision.event),f.env,f.owner)).json();assert.deepEqual(detail.event.payload.snapshot,revision.snapshot);}
  assert.equal(await(await handleProjectWorkspace(new Request(base+project+"/files/"+file.fileId),f.env,f.owner)).text(),"Original drawing bytes");assert.deepEqual(await(await handleProjectWorkspace(request(backup,project,operation),f.env,f.owner)).json(),result);assert.equal(await backupOf(f),backup);
  const streamed=await handleProjectWorkspace(new Request(base+f.projectId+"/export"),f.env,f.owner),reader=streamed.body.getReader();await reader.read();await f.call("","PATCH",{name:"Changed during export"});await assert.rejects(async()=>{for(;;){const next=await reader.read();if(next.done)break;}},/changed during export/);reader.releaseLock();
 }finally{f.db.close();}
});

test("interrupted phase-1 metadata staging reuses its rows; changed retry content cannot poison the original backup",async()=>{
 const f=await fixture();try{
  for(let n=0;n<300;n++)assert.equal((await f.call("/items/"+f.itemId+"/records","POST",{record:{type:"note",title:"Observation "+n,fields:{text:"s".repeat(2200)}}})).status,200);
  const backup=await backupOf(f),lines=backup.trimEnd().split("\n"),end=lines.findIndex(line=>JSON.parse(line).type==="metadata_complete");assert.ok(end>500);
  const project=id(),operation=id(),truncated=lines.slice(0,Math.floor(end/2)).join("\n")+"\n";
  assert.equal((await handleProjectWorkspace(request(truncated,project,operation),f.env,f.owner)).status,400);await assertHidden(f,project);
  const job=f.db.sqlite.prepare("SELECT * FROM engine_restore_jobs WHERE project_id=?").get(project),staged=f.db.sqlite.prepare("SELECT count(*) AS n FROM engine_restore_rows WHERE job_id=?").get(job.id).n;assert.equal(job.state,"staging");assert.ok(staged>0);
  const altered=lines.map(line=>{const entry=JSON.parse(line);if(entry.type==="row"&&entry.table==="records")entry.row.title="Changed retry";return JSON.stringify(entry)+"\n";}).join("");
  assert.equal((await handleProjectWorkspace(request(altered,project,operation),f.env,f.owner)).status,409);assert.equal(f.db.sqlite.prepare("SELECT count(*) AS n FROM engine_restore_rows WHERE job_id=?").get(job.id).n,staged,"Conflicting batches add no mixed metadata");
  const response=await handleProjectWorkspace(request(backup,project,operation),f.env,f.owner);assert.equal(response.status,200,await response.clone().text());const result=await response.json();
  assert.equal(f.db.sqlite.prepare("SELECT count(*) AS n FROM engine_restore_jobs WHERE project_id=?").get(project).n,1);assert.equal(f.db.sqlite.prepare("SELECT state FROM engine_restore_jobs WHERE id=?").get(job.id).state,"complete");assert.equal(f.db.sqlite.prepare("SELECT count(*) AS n FROM engine_restore_rows WHERE job_id=?").get(job.id).n,0);
  assert.equal((await(await handleProjectWorkspace(new Request(base+project+"/state"),f.env,f.owner)).json()).records.length,300);
  f.db.sqlite.prepare("UPDATE engine_restore_jobs SET id=? WHERE id=?").run(id(),job.id); // Previous previews used random job identities.
  assert.deepEqual(await(await handleProjectWorkspace(request(backup,project,operation),f.env,f.owner)).json(),result);assert.equal(f.db.sqlite.prepare("SELECT count(*) AS n FROM engine_restore_jobs WHERE project_id=?").get(project).n,1);assert.equal(f.db.sqlite.prepare("SELECT count(*) AS n FROM engine_restore_rows").get().n,0);assert.equal(await backupOf(f),backup);
 }finally{f.db.close();}
});

test("completed cleanup is scoped, bounded and retryable without changing the recovery receipt or engineering bytes",async()=>{
 const f=await fixture();try{
  await upload(f,"drawing.step",new TextEncoder().encode("Exact drawing bytes"));const backup=await backupOf(f),project=id(),operation=id(),prepare=f.db.prepare.bind(f.db);let failed=false;
  f.db.prepare=sql=>{if(sql.startsWith("DELETE FROM engine_restore_rows")){failed=true;throw Error("SQLITE synthetic cleanup interruption");}return prepare(sql);};
  const response=await handleProjectWorkspace(request(backup,project,operation),f.env,f.owner);assert.equal(response.status,200,await response.clone().text());const result=await response.json();f.db.prepare=prepare;assert.equal(failed,true);
  const count=()=>f.db.sqlite.prepare("SELECT count(*) AS n FROM engine_restore_rows r JOIN engine_restore_jobs j ON r.job_id=j.id WHERE j.project_id=?").get(project).n;assert.ok(count()>0);
  assert.deepEqual(await cleanupCompletedRestore(f.db,{projectId:project,actorId:"another-owner",operationId:operation}),{removed:0});assert.deepEqual(await cleanupCompletedRestore(f.db,{projectId:project,actorId:f.owner.id,operationId:id()}),{removed:0});assert.ok(count()>0);
  const execute=f.db.prepare.bind(f.db);let deletes=0;f.db.prepare=sql=>{const prepared=execute(sql);if(!sql.startsWith("DELETE FROM engine_restore_rows"))return prepared;return {bind(...values){const bound=prepared.bind(...values);return {async run(){const result=await bound.run();assert.ok(result.meta.changes<=250);deletes++;return result;}};}};};
  assert.deepEqual(await(await handleProjectWorkspace(request(backup,project,operation),f.env,f.owner)).json(),result);f.db.prepare=execute;assert.ok(deletes>0);assert.equal(count(),0);
  const state=await(await handleProjectWorkspace(new Request(base+project+"/state"),f.env,f.owner)).json();assert.equal(await(await handleProjectWorkspace(new Request(base+project+"/files/"+state.files[0].id),f.env,f.owner)).text(),"Exact drawing bytes");assert.equal(f.db.sqlite.prepare("SELECT count(*) AS n FROM engine_operations WHERE project_id=?").get(project).n,1);assert.equal(await backupOf(f),backup);
 }finally{f.db.close();}
});

test("a racing exact recovery returns the committed receipt even when its peer has already cleaned staging",async()=>{
 const f=await fixture();try{
  await upload(f,"drawing.step",new TextEncoder().encode("Shared exact request bytes"));const backup=await backupOf(f),project=id(),operation=id(),prepare=f.db.prepare.bind(f.db);let raced=false,peer;
  f.db.prepare=sql=>{const prepared=prepare(sql);if(!sql.startsWith("SELECT data FROM engine_restore_rows WHERE job_id=? AND table_name='files'"))return prepared;return {bind(...values){const bound=prepared.bind(...values);return {async first(){if(!raced){raced=true;const response=await handleProjectWorkspace(request(backup,project,operation),f.env,f.owner);assert.equal(response.status,200,await response.clone().text());peer=await response.json();}return bound.first();}};}};};
  const response=await handleProjectWorkspace(request(backup,project,operation),f.env,f.owner);assert.equal(response.status,200,await response.clone().text());assert.equal(raced,true);assert.deepEqual(await response.json(),peer);f.db.prepare=prepare;
  assert.equal(f.db.sqlite.prepare("SELECT count(*) AS n FROM engine_operations WHERE project_id=?").get(project).n,1);assert.equal(f.db.sqlite.prepare("SELECT count(*) AS n FROM engine_restore_rows").get().n,0);assert.equal(await backupOf(f),backup);
 }finally{f.db.close();}
});

test("an older sealed job with different JSON property ordering resumes without replacing its historical values",async()=>{
 const f=await fixture();try{
  await upload(f,"drawing.step",new TextEncoder().encode("Earlier preview bytes"));const backup=await backupOf(f),project=id(),operation=id();
  f.db.sqlite.exec("CREATE TRIGGER pause_old_restore BEFORE UPDATE OF state ON engine_restore_jobs WHEN NEW.state='complete' BEGIN SELECT RAISE(ABORT,'SQLITE simulate earlier interrupted preview'); END");assert.notEqual((await handleProjectWorkspace(request(backup,project,operation),f.env,f.owner)).status,200);f.db.sqlite.exec("DROP TRIGGER pause_old_restore");
  const job=f.db.sqlite.prepare("SELECT restore_job_id FROM engine_projects WHERE id=?").get(project).restore_job_id,trigger=f.db.sqlite.prepare("SELECT sql FROM sqlite_master WHERE name='engine_restore_rows_update'").get().sql;
  f.db.sqlite.exec("DROP TRIGGER engine_restore_rows_update");for(const row of f.db.sqlite.prepare("SELECT table_name,row_id,data FROM engine_restore_rows WHERE job_id=?").all(job))f.db.sqlite.prepare("UPDATE engine_restore_rows SET data=? WHERE job_id=? AND table_name=? AND row_id=?").run(JSON.stringify(Object.fromEntries(Object.entries(JSON.parse(row.data)).reverse())),job,row.table_name,row.row_id);f.db.sqlite.exec(trigger);
  const response=await handleProjectWorkspace(request(backup,project,operation),f.env,f.owner);assert.equal(response.status,200,await response.clone().text());assert.equal(f.db.sqlite.prepare("SELECT count(*) AS n FROM engine_restore_jobs WHERE project_id=?").get(project).n,1);assert.equal(f.db.sqlite.prepare("SELECT count(*) AS n FROM engine_restore_rows WHERE job_id=?").get(job).n,0);
  const state=await(await handleProjectWorkspace(new Request(base+project+"/state"),f.env,f.owner)).json();assert.equal(await(await handleProjectWorkspace(new Request(base+project+"/files/"+state.files[0].id),f.env,f.owner)).text(),"Earlier preview bytes");assert.equal(await backupOf(f),backup);
 }finally{f.db.close();}
});

test("an interrupted materialization stays invisible and resumes with the original operation without touching the source",async()=>{
 const f=await fixture();try{
  await f.call("/items/"+f.itemId+"/records","POST",{record:{type:"note",fields:{text:"Source evidence"}}});await f.call("/items/"+f.itemId+"/revisions","POST",{});const backup=await backupOf(f),project=id(),operation=id(),batch=f.db.batch.bind(f.db);let interrupted=false;
  f.db.batch=async statements=>{const result=await batch(statements);if(!interrupted&&f.db.sqlite.prepare("SELECT count(*) AS n FROM engine_items WHERE project_id=?").get(project).n){interrupted=true;throw Error("SQLITE synthetic materialization interruption");}return result;};
  const failed=await handleProjectWorkspace(request(backup,project,operation),f.env,f.owner);assert.notEqual(failed.status,200);f.db.batch=batch;assert.equal(interrupted,true);await assertHidden(f,project);
  const pending=f.db.sqlite.prepare("SELECT * FROM engine_projects WHERE id=?").get(project);assert.ok(pending.restore_job_id);assert.equal(f.db.sqlite.prepare("SELECT count(*) AS n FROM engine_operations WHERE project_id=?").get(project).n,0);
  assert.throws(()=>f.db.sqlite.prepare("UPDATE engine_restore_rows SET data='{}' WHERE job_id=?").run(pending.restore_job_id),/RESTORE_STAGE_SEALED/);
  await assert.rejects(commitProjectCommand(f.db,{projectId:project,actorId:f.owner.id,operationId:id(),expectedRevision:pending.revision,payload:{action:"normal-write-must-not-touch-recovery"}},w=>{w.update("engine_projects",{name:"Wrong"},{id:project,owner_id:f.owner.id});return {};}),CommandConflict);
  assert.equal((await handleProjectWorkspace(request(backup,project,operation,"Different content"),f.env,f.owner)).status,409);await assertHidden(f,project);
  const resumed=await handleProjectWorkspace(request(backup,project,operation),f.env,f.owner);assert.equal(resumed.status,200,await resumed.clone().text());const state=await(await handleProjectWorkspace(new Request(base+project+"/state"),f.env,f.owner)).json();assert.equal(state.items.length,1);assert.equal(state.records.length,1);assert.equal(await backupOf(f),backup);
 }finally{f.db.close();}
});

test("a failed publication never exposes a fully loaded copy and a retry publishes exactly one receipt",async()=>{
 const f=await fixture();try{
  await upload(f,"drawing.step",new TextEncoder().encode("Bytes"));const backup=await backupOf(f),project=id(),operation=id();
  f.db.sqlite.exec("CREATE TRIGGER fail_restore_publish BEFORE UPDATE OF state ON engine_restore_jobs WHEN NEW.state='complete' BEGIN SELECT RAISE(ABORT,'SQLITE synthetic publication failure'); END");
  const response=await handleProjectWorkspace(request(backup,project,operation),f.env,f.owner);assert.notEqual(response.status,200);await assertHidden(f,project);assert.equal(f.db.sqlite.prepare("SELECT count(*) AS n FROM engine_items WHERE project_id=?").get(project).n,1);assert.equal(f.db.sqlite.prepare("SELECT count(*) AS n FROM engine_operations WHERE project_id=?").get(project).n,0);
  f.db.sqlite.exec("DROP TRIGGER fail_restore_publish");const recovered=await handleProjectWorkspace(request(backup,project,operation),f.env,f.owner);assert.equal(recovered.status,200,await recovered.clone().text());assert.equal(f.db.sqlite.prepare("SELECT count(*) AS n FROM engine_operations WHERE project_id=?").get(project).n,1);assert.equal(await backupOf(f),backup);
 }finally{f.db.close();}
});

test("a partial copy with mismatched rows cannot be published on retry",async()=>{
 const f=await fixture();try{
  const backup=await backupOf(f),project=id(),operation=id();f.db.sqlite.exec("CREATE TRIGGER pause_restore_publish BEFORE UPDATE OF state ON engine_restore_jobs WHEN NEW.state='complete' BEGIN SELECT RAISE(ABORT,'SQLITE pause'); END");
  assert.notEqual((await handleProjectWorkspace(request(backup,project,operation),f.env,f.owner)).status,200);f.db.sqlite.exec("DROP TRIGGER pause_restore_publish");f.db.sqlite.prepare("UPDATE engine_items SET name='Unexpected value' WHERE project_id=?").run(project);
  assert.equal((await handleProjectWorkspace(request(backup,project,operation),f.env,f.owner)).status,409);await assertHidden(f,project);assert.equal(f.db.sqlite.prepare("SELECT count(*) AS n FROM engine_operations WHERE project_id=?").get(project).n,0);
 }finally{f.db.close();}
});

test("export refuses the remaining row bound and streamed recovery requires every original metadata table",async()=>{
 const f=await fixture();try{
  const backup=JSON.parse((await backupOf(f)).split("\n")[0]).manifest,project=id();
  const incomplete=[{type:"manifest",manifest:{format:backup.format,version:2,project:backup.project,tableNames:Object.keys(backup.tables).filter(name=>name!=="records")}},...Object.entries(backup.tables).filter(([name])=>name!=="records").flatMap(([table,rows])=>rows.map(row=>({type:"row",table,row}))),{type:"metadata_complete"},{type:"complete"}].map(entry=>JSON.stringify(entry)+"\n").join("");
  assert.equal((await handleProjectWorkspace(request(incomplete,project,id()),f.env,f.owner)).status,400);assert.equal(f.db.sqlite.prepare("SELECT count(*) AS n FROM engine_projects WHERE id=?").get(project).n,0);
  f.db.sqlite.prepare("WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<100001) INSERT INTO engine_events(id,project_id,item_id,type,title,summary,payload,created_at) SELECT printf('%08x-0000-4000-8000-000000000000',i),?,?,'note','Bound probe','','{}','2026-11-24' FROM n").run(f.projectId,f.itemId);
  const refused=await handleProjectWorkspace(new Request(base+f.projectId+"/export"),f.env,f.owner);assert.equal(refused.status,400);assert.match(await refused.text(),/100,000 metadata rows/);
 }finally{f.db.close();}
});
