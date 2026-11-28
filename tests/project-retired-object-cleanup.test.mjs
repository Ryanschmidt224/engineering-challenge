import {test} from "node:test";
import assert from "node:assert/strict";
import {fixture,upload} from "./helpers/project-workspace.mjs";
import {claimInactiveRestore,cleanupRetiredRestore,cleanupRetiredRestoreObjects} from "../functions/api/project-orphan-cleanup.js";
import {handleProjectWorkspace} from "../functions/api/project-workspace-api.js";
import {assertStorageKeyWritable} from "../functions/api/project-storage-fence.js";
import {PROJECT_ENGINE_SCHEMA_VERSION} from "../functions/api/project-engine-migrations.js";
import {unreferencedStorageKeySQL} from "../functions/api/project-storage-references.js";
const id=()=>crypto.randomUUID(),day=86400000,old=new Date(Date.now()-3*day).toISOString(),base="https://preview.example.test/api/project-engine/projects/";
const run=(f,sql,...args)=>f.db.sqlite.prepare(sql).run(...args),one=(f,sql,...args)=>f.db.sqlite.prepare(sql).get(...args);
const backup=async f=>(await handleProjectWorkspace(new Request(base+f.projectId+"/export"),f.env,f.owner)).text();
async function retired(f,n=1){
 const jobId=id(),projectId=id(),operationId=id();run(f,"INSERT INTO engine_restore_jobs(id,project_id,actor_id,operation_id,state,row_count,created_at,last_activity_at) VALUES(?,?,?,?,'staging',?,?,?)",jobId,projectId,f.owner.id,operationId,n,old,old);const keys=[];
 for(let position=0;position<n;position++){const file=id(),key=`project-engine/restored/${projectId}/${operationId}/${file}`;keys.push(key);run(f,"INSERT INTO engine_restore_rows(job_id,table_name,row_id,position,data) VALUES(?,'files',?,?,?)",jobId,file,position,JSON.stringify({id:file,r2_key:key}));await f.env.PHOTOS.put(key,"Disposable recovery bytes "+position);}
 const receipt=await claimInactiveRestore(f.db,{jobId,actorId:f.owner.id,observedActivity:old}),input={...receipt,actorId:f.owner.id};while(!(await cleanupRetiredRestore(f.db,input)).complete){}
 return {...input,keys:keys.sort(),now:Date.now()+2*day};
}
const clean=(f,scope,options={})=>cleanupRetiredRestoreObjects(f.db,f.env.PHOTOS,scope,{now:scope.now,...options});
const escaped=value=>value.replaceAll("/","\\u002f");
test("retired storage cleanup is bounded, journaled and repeatable, retaining source bytes and backup compatibility",async()=>{
 const f=await fixture();try{
  await upload(f,"source.dat",new TextEncoder().encode("Immutable source bytes"));await f.call("/items/"+f.itemId+"/records","POST",{record:{type:"note",fields:{text:"Exact saved evidence"}}});await f.call("/items/"+f.itemId+"/revisions","POST",{});const source=await backup(f),scope=await retired(f,3),remove=f.env.PHOTOS.delete.bind(f.env.PHOTOS),calls=[];
  f.env.PHOTOS.delete=async key=>{assert.ok(scope.keys.includes(key));calls.push(key);return remove(key);};f.env.PHOTOS.list=()=>{throw Error("Cleanup must use its exact journal, never a bucket scan");};
  const first=await clean(f,scope,{limit:2});assert.equal(first.deleted.length,2);assert.equal(first.scanned,2);assert.ok(first.nextCursor);const second=await clean(f,scope,{limit:2,cursor:first.nextCursor});assert.equal(second.deleted.length,1);assert.equal(second.nextCursor,null);assert.equal((await clean(f,scope)).absent.length,3);assert.equal(calls.length,3);
  assert.equal(one(f,"SELECT COUNT(*) AS n FROM engine_retired_object_attempts").n,3);assert.equal(one(f,"SELECT COUNT(*) AS n FROM engine_retired_file_keys").n,3);assert.equal(one(f,"SELECT cleanup_token FROM engine_restore_jobs WHERE id=?",scope.jobId).cleanup_token,scope.cleanupToken);assert.equal(await backup(f),source);
  const copy=id(),response=await handleProjectWorkspace(new Request(base+copy+"/import-copy?name=Still recoverable",{method:"POST",headers:{origin:"https://preview.example.test","x-operation-id":id(),"x-project-revision":"new"},body:source}),f.env,f.owner);assert.equal(response.status,200,await response.clone().text());
  assert.throws(()=>run(f,"DELETE FROM engine_retired_object_attempts"),/INTENT_IS_PERMANENT/);await assert.rejects(assertStorageKeyWritable(f.db,scope.keys[0]),error=>error.status===409);
 }finally{f.db.close();}
});
test("young retirement/journals, new objects and unknown object identity never authorize deletion",async()=>{
 const f=await fixture();try{
  const scope=await retired(f),key=scope.keys[0];let calls=0;f.env.PHOTOS.delete=async()=>{calls++;};
  assert.equal((await clean(f,scope,{now:Date.now()})).protected.length,1);const object=f.env.PHOTOS.objects.get(key),created=object.uploaded;
  for(const value of [undefined,new Date(scope.now)]){object.uploaded=value;assert.equal((await clean(f,scope)).protected.length,1);}object.uploaded=created;
  const head=f.env.PHOTOS.head.bind(f.env.PHOTOS);for(const patch of [{etag:""},{size:null},{uploaded:"unknown"}]){f.env.PHOTOS.head=async key=>({...await head(key),...patch});assert.equal((await clean(f,scope)).protected.length,1);}assert.equal(calls,0);assert.equal(one(f,"SELECT COUNT(*) AS n FROM engine_retired_object_attempts").n,0);
 }finally{f.db.close();}
});
test("global escaped historical roots and nested staged evidence prevent deletion admission",async()=>{
 const f=await fixture();try{
  const scope=await retired(f),key=scope.keys[0],fields='{"old_storage_key":"'+escaped(key)+'"}';run(f,"UPDATE engine_items SET fields=? WHERE project_id=? AND id=?",fields,f.projectId,f.itemId);assert.equal((await clean(f,scope)).protected.length,1);run(f,"UPDATE engine_items SET fields='{}' WHERE project_id=? AND id=?",f.projectId,f.itemId);
  const jobId=id();run(f,"INSERT INTO engine_restore_jobs(id,project_id,actor_id,operation_id,state,row_count,created_at) VALUES(?,?,?,?,'staging',1,?)",jobId,id(),"another-owner",id(),old);run(f,"INSERT INTO engine_restore_rows(job_id,table_name,row_id,position,data) VALUES(?,'events',?,0,?)",jobId,id(),JSON.stringify({payload:fields}));assert.equal((await clean(f,scope)).protected.length,1);assert.ok(await f.env.PHOTOS.head(key));assert.equal(one(f,"SELECT COUNT(*) AS n FROM engine_retired_object_attempts").n,0);
 }finally{f.db.close();}
});
test("file and catalogue ownership, plus malformed saved or staged JSON, protect storage",async()=>{
 const f=await fixture();try{
  const scope=await retired(f),key=scope.keys[0];f.db.sqlite.exec("CREATE TABLE workshop_attachments(id TEXT PRIMARY KEY,r2_key TEXT)");run(f,"INSERT INTO workshop_attachments(id,r2_key) VALUES(?,?)",id(),key);assert.equal((await clean(f,scope)).protected.length,1);run(f,"DELETE FROM workshop_attachments");
  // Simulate an inconsistent older writer. The current admission trigger would
  // reject this file, but an already existing foreign metadata root stays safe.
  f.db.sqlite.exec("DROP TRIGGER engine_files_key_fence_insert");const file=id();run(f,"INSERT INTO engine_files(id,project_id,name,content_type,r2_key,state,created_at) VALUES(?,?,'Old foreign root','application/octet-stream',?,'prepared',?)",file,f.projectId,key,old);assert.equal((await clean(f,scope)).protected.length,1);run(f,"DELETE FROM engine_files WHERE project_id=? AND id=?",f.projectId,file);
  run(f,"UPDATE engine_occurrences SET removed_path='{' WHERE project_id=?",f.projectId);assert.equal((await clean(f,scope)).protected.length,1);run(f,"UPDATE engine_occurrences SET removed_path=NULL WHERE project_id=?",f.projectId);
  const jobId=id();run(f,"INSERT INTO engine_restore_jobs(id,project_id,actor_id,operation_id,state,row_count,created_at) VALUES(?,?,?,?,'staging',1,?)",jobId,id(),f.owner.id,id(),old);run(f,"INSERT INTO engine_restore_rows(job_id,table_name,row_id,position,data) VALUES(?,'events',?,0,?)",jobId,id(),JSON.stringify({payload:"{"}));assert.equal((await clean(f,scope)).protected.length,1);assert.equal(one(f,"SELECT COUNT(*) AS n FROM engine_retired_object_attempts").n,0);assert.ok(await f.env.PHOTOS.head(key));
 }finally{f.db.close();}
});
test("a root winning the intent race protects bytes, and a winning intent fences later engine and nested staging roots",async()=>{
 const f=await fixture();try{
  const scope=await retired(f),key=scope.keys[0],prepare=f.db.prepare.bind(f.db);let raced=false;
  f.db.prepare=sql=>{const p=prepare(sql);if(!sql.startsWith("INSERT INTO engine_retired_object_attempts"))return p;return {bind(...values){const b=p.bind(...values);return {async run(){if(!raced){raced=true;run(f,"UPDATE engine_items SET fields=? WHERE project_id=? AND id=?",JSON.stringify({key}),f.projectId,f.itemId);}return b.run();}};}};};assert.equal((await clean(f,scope)).protected.length,1);f.db.prepare=prepare;assert.equal(raced,true);assert.equal(one(f,"SELECT COUNT(*) AS n FROM engine_retired_object_attempts").n,0);run(f,"UPDATE engine_items SET fields='{}' WHERE project_id=? AND id=?",f.projectId,f.itemId);
  const head=f.env.PHOTOS.head.bind(f.env.PHOTOS);let seen=0;f.env.PHOTOS.head=async key=>{if(++seen===2){assert.throws(()=>run(f,"UPDATE engine_items SET fields=? WHERE project_id=? AND id=?",'{"key":"'+escaped(key)+'"}',f.projectId,f.itemId),/RETIRED_STAGING_OBJECT_REFERENCE/);const other=id();run(f,"INSERT INTO engine_restore_jobs(id,project_id,actor_id,operation_id,state,row_count,created_at) VALUES(?,?,?,?,'staging',0,?)",other,id(),f.owner.id,id(),old);assert.throws(()=>run(f,"INSERT INTO engine_restore_rows(job_id,table_name,row_id,position,data) VALUES(?,'events',?,0,?)",other,id(),JSON.stringify({payload:JSON.stringify({key})})),/RETIRED_STAGING_OBJECT_REFERENCE/);}return head(key);};assert.equal((await clean(f,scope)).deleted.length,1);assert.equal(one(f,"SELECT fields FROM engine_items WHERE project_id=? AND id=?",f.projectId,f.itemId).fields,"{}");
 }finally{f.db.close();}
});
test("a changed ETag or upload time is deferred, and late unlinked puts remain discoverable on a new sweep",async()=>{
 const f=await fixture();try{
  const scope=await retired(f),key=scope.keys[0],head=f.env.PHOTOS.head.bind(f.env.PHOTOS),remove=f.env.PHOTOS.delete.bind(f.env.PHOTOS);let seen=0;
  f.env.PHOTOS.head=async key=>{if(++seen===2)await f.env.PHOTOS.put(key,"Changed unlinked bytes");return head(key);};assert.equal((await clean(f,scope)).protected.length,1);assert.ok(await head(key));f.env.PHOTOS.head=head;
  assert.equal((await clean(f,scope)).deleted.length,1);await f.env.PHOTOS.put(key,"Old transfer finished after cleanup");assert.equal((await clean(f,scope,{now:Date.now()})).protected.length,1);assert.equal((await clean(f,scope,{now:scope.now+day})).deleted.length,1);assert.equal(one(f,"SELECT COUNT(*) AS n FROM engine_retired_object_attempts").n,3);assert.equal(await head(key),null);
  f.env.PHOTOS.delete=remove;
 }finally{f.db.close();}
});
test("interrupted object deletion resumes with the same intent and guards ownership, target replacement, receipts and schema",async()=>{
 const f=await fixture();try{
  const scope=await retired(f),remove=f.env.PHOTOS.delete.bind(f.env.PHOTOS);f.env.PHOTOS.delete=async()=>{throw Error("Storage request interrupted");};await assert.rejects(clean(f,scope),/interrupted/);assert.equal(one(f,"SELECT COUNT(*) AS n FROM engine_retired_object_attempts").n,1);f.env.PHOTOS.delete=remove;
  await assert.rejects(clean(f,{...scope,actorId:"foreign"}),error=>error.status===404);await assert.rejects(clean(f,{...scope,cleanupToken:id()}),error=>error.status===409);
  run(f,"INSERT INTO engine_projects(id,owner_id,name,revision,created_at) VALUES(?,?,'Protected new target',?,?)",scope.projectId,f.owner.id,id(),old);await assert.rejects(clean(f,scope),error=>error.status===409);run(f,"DELETE FROM engine_projects WHERE id=?",scope.projectId);
  const operation=id();run(f,"INSERT INTO engine_operations(project_id,actor_id,operation_id,request_hash,attempt_id,result,created_at) VALUES(?,?,?,?,?,'{}',?)",scope.projectId,f.owner.id,operation,"acknowledged",id(),old);await assert.rejects(clean(f,scope),error=>error.status===409);run(f,"DELETE FROM engine_operations WHERE project_id=?",scope.projectId);
  run(f,"INSERT INTO project_engine_migrations(version,applied_at) VALUES(?,'future')",PROJECT_ENGINE_SCHEMA_VERSION+1);await assert.rejects(clean(f,scope),error=>error.status===409);run(f,"DELETE FROM project_engine_migrations WHERE version=?",PROJECT_ENGINE_SCHEMA_VERSION+1);
  assert.equal((await clean(f,scope)).deleted.length,1);assert.equal(one(f,"SELECT COUNT(*) AS n FROM engine_retired_object_attempts").n,1);
 }finally{f.db.close();}
});
test("a partial private graph and unbounded or foreign cursors are refused; JSON root SQL stays within D1 statement size",async()=>{
 const f=await fixture();try{
  const scope=await retired(f);for(const options of [{limit:26},{limit:0},{cursor:`project-engine/restored/${id()}/${id()}/${id()}`}])await assert.rejects(clean(f,scope,options));
  const unfinished=id(),target=id(),operation=id();run(f,"INSERT INTO engine_restore_jobs(id,project_id,actor_id,operation_id,state,row_count,created_at,last_activity_at) VALUES(?,?,?,?,'staging',1,?,?)",unfinished,target,f.owner.id,operation,old,old);run(f,"INSERT INTO engine_restore_rows(job_id,table_name,row_id,position,data) VALUES(?,'items',?,0,'{}')",unfinished,id());const receipt=await claimInactiveRestore(f.db,{jobId:unfinished,actorId:f.owner.id,observedActivity:old});await assert.rejects(clean(f,{...receipt,actorId:f.owner.id,now:scope.now}),error=>error.status===409);
  const peer=id();run(f,"INSERT INTO engine_restore_jobs(id,project_id,actor_id,operation_id,state,row_count,created_at) VALUES(?,?,?,?,'staging',1,?)",peer,scope.projectId,f.owner.id,id(),old);run(f,"INSERT INTO engine_restore_rows(job_id,table_name,row_id,position,data) VALUES(?,'events',?,0,?)",peer,id(),JSON.stringify({payload:JSON.stringify({key:scope.keys[0]})}));assert.equal((await clean(f,scope)).protected.length,1);assert.ok(new TextEncoder().encode(unreferencedStorageKeySQL("k.r2_key",{catalogue:true})).length<40000);
 }finally{f.db.close();}
});
