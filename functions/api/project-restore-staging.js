import {canonicalJSON,sha256,CommandConflict} from "./project-command.js";
import {backupColumns,restoredRow} from "./project-backup-schema.js";
import {statement} from "./project-state.js";

export const RESTORE_BATCH_ROWS=250,RESTORE_BATCH_BYTES=512*1024;
// Seal private staging first, then load actual rows under a hidden project header
// in bounded batches. The final guarded transaction publishes only complete copies.
export async function restoreStaging(db,projectId,actorId,operationId,storageKey){
 const id=crypto.randomUUID(),counts=Object.fromEntries(Object.keys(backupColumns).map(name=>[name,0]));let buffer=[],bytes=0,total=0,batches=0;
 await statement(db,"INSERT INTO engine_restore_jobs(id,project_id,actor_id,operation_id,state,row_count,created_at) VALUES(?,?,?,?,'staging',0,?)",id,projectId,actorId,operationId,new Date().toISOString()).run();
 async function flush(){
  if(!buffer.length)return;const serialized=JSON.stringify(buffer);
  await db.batch([statement(db,"INSERT INTO engine_restore_rows(job_id,table_name,row_id,position,data) SELECT ?,json_extract(value,'$.table'),json_extract(value,'$.id'),json_extract(value,'$.position'),json_extract(value,'$.data') FROM json_each(?) WHERE EXISTS(SELECT 1 FROM engine_restore_jobs WHERE id=? AND project_id=? AND actor_id=? AND state='staging')",id,serialized,id,projectId,actorId)]);
  batches++;buffer=[];bytes=0;
 }
 return {id,counts,get rowCount(){return total;},get batches(){return batches;},
  async add(table,row,position=counts[table]){
   const data=restoredRow(table,row,projectId,storageKey),entry={table,id:row.id,position,data},size=new TextEncoder().encode(JSON.stringify(entry)).length;
   if(size>1500000)throw Error("One restored row exceeds the supported database value size.");
   if(buffer.length&&(buffer.length>=RESTORE_BATCH_ROWS||bytes+size>RESTORE_BATCH_BYTES))await flush();buffer.push(entry);bytes+=size;counts[table]++;total++;
  },flush,
  async seal(payload){await flush();const fingerprint=await sha256(canonicalJSON(payload));const result=await statement(db,"UPDATE engine_restore_jobs SET state='ready',row_count=?,fingerprint=? WHERE id=? AND actor_id=? AND state='staging' AND (SELECT COUNT(*) FROM engine_restore_rows WHERE job_id=?)=?",total,fingerprint,id,actorId,id,total).run();if(result.meta.changes!==1)throw new CommandConflict("The pending recovery changed. Retry the original backup.");return fingerprint;}
 };
}
export async function* stagedRows(db,jobId,table){
 let cursor="";for(;;){const rows=(await statement(db,"SELECT row_id,data FROM engine_restore_rows WHERE job_id=? AND table_name=? AND row_id>? ORDER BY row_id LIMIT 10",jobId,table,cursor).all()).results;if(!rows.length)return;for(const row of rows){cursor=row.row_id;yield JSON.parse(row.data);}}
}
export async function pendingRestore(db,projectId,actorId,operationId,fingerprint){
 const project=await statement(db,"SELECT owner_id,restore_job_id FROM engine_projects WHERE id=?",projectId).first();if(!project)return null;
 const job=project.owner_id===actorId&&project.restore_job_id?await statement(db,"SELECT * FROM engine_restore_jobs WHERE id=? AND project_id=? AND actor_id=? AND operation_id=? AND fingerprint=? AND state='ready'",project.restore_job_id,projectId,actorId,operationId,fingerprint).first():null;
 if(!job)throw new CommandConflict("This project already exists. Existing data will not be replaced; retry the original recovery or choose a new copy.");return job;
}
export async function materializeRestore(db,staging,projectId,actorId,operationId,fingerprint,header){
 let job=await pendingRestore(db,projectId,actorId,operationId,fingerprint);
 if(!job){
  const token=crypto.randomUUID();await db.batch([statement(db,"INSERT INTO engine_projects(id,owner_id,name,prefix,digits,revision,created_at,restore_job_id) SELECT ?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM engine_projects WHERE id=?) AND EXISTS(SELECT 1 FROM engine_restore_jobs WHERE id=? AND project_id=? AND actor_id=? AND operation_id=? AND fingerprint=? AND state='ready')",projectId,actorId,header.name,header.prefix,header.digits,token,header.created_at,staging.id,projectId,staging.id,projectId,actorId,operationId,fingerprint)]);
  job=await pendingRestore(db,projectId,actorId,operationId,fingerprint);if(!job)throw new CommandConflict("The pending recovery could not be opened. Retry the same backup.");
 }
 let batches=0;
 for(const [table,layout]of Object.entries(backupColumns)){
  const columns=layout.split(" "),values=columns.map(column=>column==="project_id"?"?":`json_extract(value,'$.${column}')`);let position=-1,cursor="";
  for(;;){
   const result=(await statement(db,"SELECT * FROM (SELECT p.*,SUM(length(CAST(data AS BLOB))+256) OVER(ORDER BY position,row_id) AS bytes,ROW_NUMBER() OVER(ORDER BY position,row_id) AS n FROM (SELECT row_id,position,data FROM engine_restore_rows WHERE job_id=? AND table_name=? AND (position>? OR position=? AND row_id>?) ORDER BY position,row_id LIMIT 250) p) WHERE bytes<=524288 OR n=1 ORDER BY position,row_id",job.id,table,position,position,cursor).all()).results;
   if(!result.length)break;const serialized="["+result.map(row=>row.data).join(",")+"]";
   await db.batch([statement(db,`INSERT INTO engine_${table}(${columns.join(",")}) SELECT ${values.join(",")} FROM json_each(?) WHERE EXISTS(SELECT 1 FROM engine_projects p JOIN engine_restore_jobs j ON p.restore_job_id=j.id WHERE p.id=? AND p.owner_id=? AND j.id=? AND j.state='ready' AND j.fingerprint=?) ON CONFLICT(project_id,id) DO NOTHING`,projectId,serialized,projectId,actorId,job.id,fingerprint)]);
   batches++;const last=result.at(-1);position=last.position;cursor=last.row_id;
  }
 }
 return {id:job.id,batches};
}
