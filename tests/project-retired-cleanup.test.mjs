import {test} from "node:test";
import assert from "node:assert/strict";
import {fixture,upload} from "./helpers/project-workspace.mjs";
import {handleProjectWorkspace} from "../functions/api/project-workspace-api.js";
import {claimInactiveRestore,cleanupRetiredRestore} from "../functions/api/project-orphan-cleanup.js";
import {assertStorageKeyWritable} from "../functions/api/project-storage-fence.js";
import {PROJECT_ENGINE_SCHEMA_VERSION} from "../functions/api/project-engine-migrations.js";
import {backupColumns} from "../functions/api/project-backup-schema.js";
const id=()=>crypto.randomUUID(),base="https://preview.example.test/api/project-engine/projects/",old=new Date(Date.now()-3*24*60*60*1000).toISOString();
const query=(f,sql,...args)=>f.db.sqlite.prepare(sql).get(...args);
const run=(f,sql,...args)=>f.db.sqlite.prepare(sql).run(...args);
const exportOf=async f=>(await handleProjectWorkspace(new Request(base+f.projectId+"/export"),f.env,f.owner)).text();
function seed(f,{projectId=id(),operationId=id()}={}){
 const jobId=id();run(f,"INSERT INTO engine_restore_jobs(id,project_id,actor_id,operation_id,state,row_count,created_at,last_activity_at) VALUES(?,?,?,?,'staging',0,?,?)",jobId,projectId,f.owner.id,operationId,old,old);return {jobId,projectId,operationId};
}
async function retire(f,scope){return claimInactiveRestore(f.db,{jobId:scope.jobId,actorId:f.owner.id,observedActivity:old});}
async function pending(f){
 await upload(f,"drawing.step",new TextEncoder().encode("Exact engineering bytes"));
 assert.equal((await f.call("/items/"+f.itemId+"/records","POST",{record:{type:"note",title:"Frozen evidence",fields:{text:"Preserve this in the source"}}})).status,200);
 assert.equal((await f.call("/items/"+f.itemId+"/revisions","POST",{entryDetails:{whatChanged:"Saved evidence and drawing"}})).status,200);
 const backup=await exportOf(f),projectId=id(),operationId=id();
 f.db.sqlite.exec("CREATE TRIGGER pause_cleanup_test BEFORE UPDATE OF state ON engine_restore_jobs WHEN NEW.state='complete' BEGIN SELECT RAISE(ABORT,'SQLITE pause'); END");
 const response=await handleProjectWorkspace(new Request(base+projectId+"/import-copy?name=Unpublished",{method:"POST",headers:{origin:"https://preview.example.test","x-operation-id":operationId,"x-project-revision":"new"},body:backup}),f.env,f.owner);assert.notEqual(response.status,200);f.db.sqlite.exec("DROP TRIGGER pause_cleanup_test");
 const {restore_job_id:jobId}=query(f,"SELECT restore_job_id FROM engine_projects WHERE id=?",projectId);run(f,"UPDATE engine_restore_jobs SET created_at=?,last_activity_at=? WHERE id=?",old,old,jobId);return {jobId,projectId,operationId,backup};
}
test("retired private cleanup resumes in bounded batches, retains keys and source bytes, and never publishes",async()=>{
 const f=await fixture();try{
  const scope=await pending(f),item=query(f,"SELECT id FROM engine_items WHERE project_id=?",scope.projectId);
  for(let n=0;n<240;n++)run(f,"INSERT INTO engine_steps(id,project_id,item_id,title,body,sort_order,created_at) VALUES(?,?,?,'Large instruction',?,?,?)",id(),scope.projectId,item.id,"x".repeat(9000),n,old);
  const receipt=await retire(f,scope),input={...receipt,actorId:f.owner.id},objects=[...f.env.PHOTOS.objects.keys()];let result,calls=0,stepsRemoved=0;
  do{const before=query(f,"SELECT COUNT(*) AS n FROM engine_steps WHERE project_id=?",scope.projectId).n;result=await cleanupRetiredRestore(f.db,input,{batchBudget:1});const after=query(f,"SELECT COUNT(*) AS n FROM engine_steps WHERE project_id=?",scope.projectId).n;assert.ok(before-after<=58,"512 KB row window is respected");stepsRemoved+=before-after;assert.equal(result.batches,1);assert.ok(result.removed<=100);assert.equal(result.storageDeletion,false);assert.ok(++calls<60);}while(!result.complete);
  assert.equal(stepsRemoved,240);for(const name of Object.keys(backupColumns))assert.equal(query(f,`SELECT COUNT(*) AS n FROM engine_${name} WHERE project_id=?`,scope.projectId).n,0);
  assert.equal(query(f,"SELECT COUNT(*) AS n FROM engine_restore_rows WHERE job_id=?",scope.jobId).n,0);assert.equal(query(f,"SELECT cleanup_token FROM engine_restore_jobs WHERE id=?",scope.jobId).cleanup_token,receipt.cleanupToken);
  const journal=query(f,"SELECT * FROM engine_retired_file_keys WHERE job_id=?",scope.jobId);assert.equal(journal.r2_key,objects.find(key=>key.includes(scope.projectId)));assert.equal(journal.cleanup_token,receipt.cleanupToken);
  assert.deepEqual([...f.env.PHOTOS.objects.keys()],objects);assert.equal(await exportOf(f),scope.backup);assert.equal((await cleanupRetiredRestore(f.db,input,{batchBudget:1})).complete,true);
  await assert.rejects(assertStorageKeyWritable(f.db,journal.r2_key),error=>error.status===409);assert.throws(()=>run(f,"DELETE FROM engine_retired_file_keys WHERE job_id=?",scope.jobId),/RETIRED_KEY_IS_PERMANENT/);
  assert.equal((await handleProjectWorkspace(new Request(base+scope.projectId+"/state"),f.env,f.owner)).status,404);
 }finally{f.db.close();}
});
test("staging-only retirement journals peer file keys before removing rows, without deleting storage",async()=>{
 const f=await fixture();try{
  const a=seed(f),b=seed(f,a),file=id(),key=`project-engine/restored/${a.projectId}/${a.operationId}/${file}`;
  for(const scope of [a,b])run(f,"INSERT INTO engine_restore_rows(job_id,table_name,row_id,position,data) VALUES(?,'files',?,0,?)",scope.jobId,file,JSON.stringify({id:file,r2_key:key}));await f.env.PHOTOS.put(key,"Staged bytes");
  const receipt=await retire(f,a);let result;do{result=await cleanupRetiredRestore(f.db,{...receipt,actorId:f.owner.id},{batchBudget:2});}while(!result.complete);
  assert.equal(query(f,"SELECT COUNT(*) AS n FROM engine_restore_rows WHERE job_id IN(?,?)",a.jobId,b.jobId).n,0);assert.equal(query(f,"SELECT COUNT(*) AS n FROM engine_retired_file_keys WHERE r2_key=?",key).n,1);assert.ok(await f.env.PHOTOS.head(key));
  assert.throws(()=>run(f,"INSERT INTO engine_restore_rows(job_id,table_name,row_id,position,data) VALUES(?,'files',?,0,?)",b.jobId,file,JSON.stringify({id:file,r2_key:key})),/RETIRED/);
 }finally{f.db.close();}
});
test("cleanup requires the exact owner and token, and cannot delete a published, replaced or foreign target",async()=>{
 const f=await fixture();try{
  const scope=seed(f),receipt=await retire(f,scope),input={...receipt,actorId:f.owner.id};
  await assert.rejects(cleanupRetiredRestore(f.db,{...input,actorId:"foreign"}),error=>error.status===404);await assert.rejects(cleanupRetiredRestore(f.db,{...input,cleanupToken:id()}),error=>error.status===409);
  for(const owner of [f.owner.id,"foreign"]){run(f,"INSERT INTO engine_projects(id,owner_id,name,revision,created_at) VALUES(?,?,'Protected',?,?)",scope.projectId,owner,id(),old);await assert.rejects(cleanupRetiredRestore(f.db,input),error=>error.status===409);assert.equal(query(f,"SELECT name FROM engine_projects WHERE id=?",scope.projectId).name,"Protected");run(f,"DELETE FROM engine_projects WHERE id=?",scope.projectId);}
  const replacement=seed(f,{projectId:scope.projectId});run(f,"INSERT INTO engine_projects(id,owner_id,name,revision,created_at,restore_job_id) VALUES(?,?,'New operation',?,?,?)",scope.projectId,f.owner.id,id(),old,replacement.jobId);await assert.rejects(cleanupRetiredRestore(f.db,input),error=>error.status===409);assert.ok(query(f,"SELECT id FROM engine_projects WHERE id=?",scope.projectId));
 }finally{f.db.close();}
});
test("an unrelated receipt racing a deletion protects every private row",async()=>{
 const f=await fixture();try{
  const scope=await pending(f),receipt=await retire(f,scope),batch=f.db.batch.bind(f.db);let raced=false;
  f.db.batch=async statements=>{if(!raced){raced=true;run(f,"INSERT INTO engine_operations(project_id,actor_id,operation_id,request_hash,attempt_id,result,created_at) VALUES(?,?,?,?,?,'{}',?)",scope.projectId,f.owner.id,id(),"acknowledged-edit",id(),old);}return batch(statements);};
  await assert.rejects(cleanupRetiredRestore(f.db,{...receipt,actorId:f.owner.id}),error=>error.status===409);assert.equal(raced,true);assert.ok(query(f,"SELECT id FROM engine_projects WHERE id=?",scope.projectId));assert.ok(query(f,"SELECT id FROM engine_items WHERE project_id=?",scope.projectId));assert.equal(query(f,"SELECT COUNT(*) AS n FROM engine_retired_file_keys").n,0);
 }finally{f.db.close();}
});
test("unknown schemas and non-target file namespaces fail closed before metadata removal",async()=>{
 const f=await fixture();try{
  const scope=seed(f),file=id();run(f,"INSERT INTO engine_restore_rows(job_id,table_name,row_id,position,data) VALUES(?,'files',?,0,?)",scope.jobId,file,JSON.stringify({id:file,r2_key:`project-engine/files/${f.projectId}/${file}`}));const receipt=await retire(f,scope),input={...receipt,actorId:f.owner.id};
  await assert.rejects(cleanupRetiredRestore(f.db,input),error=>error.status===409);assert.equal(query(f,"SELECT COUNT(*) AS n FROM engine_restore_rows WHERE job_id=?",scope.jobId).n,1);
  run(f,"INSERT INTO project_engine_migrations(version,applied_at) VALUES(?,'future')",PROJECT_ENGINE_SCHEMA_VERSION+1);await assert.rejects(cleanupRetiredRestore(f.db,input),error=>error.status===409);assert.equal(query(f,"SELECT COUNT(*) AS n FROM engine_retired_file_keys").n,0);
 }finally{f.db.close();}
});
test("retired keys fence old file and restore-row admission even after their hidden project is gone",async()=>{
 const f=await fixture();try{
  const scope=seed(f),file=id(),key=`project-engine/restored/${scope.projectId}/${scope.operationId}/${file}`;run(f,"INSERT INTO engine_restore_rows(job_id,table_name,row_id,position,data) VALUES(?,'files',?,0,?)",scope.jobId,file,JSON.stringify({id:file,r2_key:key}));const receipt=await retire(f,scope);
  while(!(await cleanupRetiredRestore(f.db,{...receipt,actorId:f.owner.id})).complete){}
  assert.throws(()=>run(f,"INSERT INTO engine_files(id,project_id,name,content_type,r2_key,state,created_at) VALUES(?,?,'Wrong reuse','application/octet-stream',?,'prepared',?)",id(),f.projectId,key,old),/ENGINE_STORAGE_KEY_RETIRED/);
  const other=seed(f);assert.throws(()=>run(f,"INSERT INTO engine_restore_rows(job_id,table_name,row_id,position,data) VALUES(?,'files',?,0,?)",other.jobId,file,JSON.stringify({id:file,r2_key:key})),/ENGINE_STORAGE_KEY_RETIRED/);
  const uploaded=await upload(f,"Normal file",new TextEncoder().encode("Still writable"));assert.ok(uploaded.fileId);
 }finally{f.db.close();}
});
test("a restore put already in flight can leave fenced bytes but cannot publish or report success",async()=>{
 const f=await fixture();try{
  await upload(f,"source.step",new TextEncoder().encode("Source remains exact"));const backup=await exportOf(f),projectId=id(),operationId=id(),put=f.env.PHOTOS.put.bind(f.env.PHOTOS);let retired=false,key;
  f.env.PHOTOS.put=async (storageKey,bytes,options)=>{
   if(storageKey.startsWith(`project-engine/restored/${projectId}/`)&&!retired){retired=true;key=storageKey;const {id:jobId}=query(f,"SELECT id FROM engine_restore_jobs WHERE project_id=? AND operation_id=?",projectId,operationId);run(f,"UPDATE engine_restore_jobs SET created_at=?,last_activity_at=? WHERE id=?",old,old,jobId);const receipt=await retire(f,{jobId});assert.equal((await cleanupRetiredRestore(f.db,{...receipt,actorId:f.owner.id},{batchBudget:1})).journaled,1);}
   return put(storageKey,bytes,options);
  };
  const response=await handleProjectWorkspace(new Request(base+projectId+"/import-copy?name=Late transfer",{method:"POST",headers:{origin:"https://preview.example.test","x-operation-id":operationId,"x-project-revision":"new"},body:backup}),f.env,f.owner);
  assert.equal(retired,true);assert.equal(response.status,409);assert.ok(await f.env.PHOTOS.head(key));await assert.rejects(assertStorageKeyWritable(f.db,key),error=>error.status===409);assert.equal(query(f,"SELECT COUNT(*) AS n FROM engine_projects WHERE id=?",projectId).n,0);assert.equal(query(f,"SELECT COUNT(*) AS n FROM engine_operations WHERE project_id=?",projectId).n,0);assert.equal(await exportOf(f),backup);
 }finally{f.db.close();}
});
test("an interrupted private cleanup resumes without losing its permanent file journal",async()=>{
 const f=await fixture();try{
  const scope=await pending(f),receipt=await retire(f,scope),input={...receipt,actorId:f.owner.id};await cleanupRetiredRestore(f.db,input,{batchBudget:1});const batch=f.db.batch.bind(f.db);let fail=true;
  f.db.batch=async statements=>{if(fail){fail=false;throw Error("SQLITE interrupted cleanup");}return batch(statements);};await assert.rejects(cleanupRetiredRestore(f.db,input),/interrupted cleanup/);assert.equal(query(f,"SELECT COUNT(*) AS n FROM engine_retired_file_keys WHERE job_id=?",scope.jobId).n,1);assert.ok(query(f,"SELECT id FROM engine_projects WHERE id=?",scope.projectId));
  let result;do{result=await cleanupRetiredRestore(f.db,input);}while(!result.complete);assert.equal(query(f,"SELECT COUNT(*) AS n FROM engine_retired_file_keys WHERE job_id=?",scope.jobId).n,1);assert.equal(await exportOf(f),scope.backup);
 }finally{f.db.close();}
});
