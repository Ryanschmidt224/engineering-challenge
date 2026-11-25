import {statement,uuid,ProjectNotFound} from "./project-state.js";
import {CommandConflict} from "./project-command.js";
import {backupColumns} from "./project-backup-schema.js";
import {CURRENT_ENGINE_SCHEMA_SQL} from "./project-restore-guards.js";

const order=["media","file_links","archive_groups","selections","records","events","configurations","steps","occurrences","items","files","snapshot_values"];
const invalid=()=>new CommandConflict("Retired recovery cleanup no longer matches its private target. Nothing further was removed.");
// Internal, bounded and resumable. There is deliberately no HTTP/cron caller.
// This removes private D1 rows only; R2 deletion needs a separate reviewed sweep
// with fresh global reference checks and compatible deployed readers/writers.
export async function cleanupRetiredRestore(db,{jobId,actorId,cleanupToken},{batchBudget=4}={}){
 if(!uuid(jobId)||!uuid(cleanupToken)||typeof actorId!=="string"||!actorId||!Number.isInteger(batchBudget)||batchBudget<1||batchBudget>20)throw Error("Provide an exact retirement receipt and a batch budget from 1 to 20.");
 const job=await statement(db,"SELECT * FROM engine_restore_jobs WHERE id=? AND actor_id=?",jobId,actorId).first();if(!job)throw new ProjectNotFound("Recovery job not found.");
 if(job.cleanup_token!==cleanupToken||job.state==="complete")throw invalid();
 const scope=[jobId,actorId,cleanupToken],projectId=job.project_id;
 const group="SELECT peer.id FROM engine_restore_jobs peer WHERE peer.project_id=j.project_id AND peer.actor_id=j.actor_id AND peer.operation_id=j.operation_id";
 const gate=`${CURRENT_ENGINE_SCHEMA_SQL} AND EXISTS(SELECT 1 FROM engine_restore_jobs j WHERE j.id=? AND j.actor_id=? AND j.cleanup_token=? AND j.state IN('staging','ready') AND NOT EXISTS(SELECT 1 FROM engine_operations WHERE project_id=j.project_id) AND NOT EXISTS(SELECT 1 FROM engine_restore_jobs peer WHERE peer.id IN(${group}) AND peer.state='complete') AND (NOT EXISTS(SELECT 1 FROM engine_projects WHERE id=j.project_id) OR EXISTS(SELECT 1 FROM engine_projects p WHERE p.id=j.project_id AND p.owner_id=j.actor_id AND p.restore_job_id=j.id)))`;
 const peers="SELECT id FROM engine_restore_jobs WHERE project_id=? AND actor_id=? AND operation_id=?",peerValues=[projectId,actorId,job.operation_id];
 let batches=0,removed=0,journaled=0;
 async function valid(){if(!(await statement(db,`SELECT (${gate}) AS valid`,...scope).first())?.valid)throw invalid();}
 async function mutate(sql,...values){
  const result=await db.batch([statement(db,sql,...values),statement(db,`SELECT (${gate}) AS valid`,...scope)]);
  if(!result[1].results[0]?.valid)throw invalid();batches++;return result[0].meta.changes;
 }
 await valid();
 while(batches<batchBudget){
  // Journal keys before deleting either the loaded files or their staged rows.
  // Only this exact target/operation namespace is accepted, never source keys.
  const keys=(await statement(db,`SELECT id,r2_key FROM (SELECT id,r2_key FROM engine_files WHERE project_id=? UNION SELECT row_id AS id,json_extract(data,'$.r2_key') AS r2_key FROM engine_restore_rows WHERE table_name='files' AND job_id IN(${peers})) f WHERE NOT EXISTS(SELECT 1 FROM engine_retired_file_keys k WHERE k.r2_key=f.r2_key) ORDER BY r2_key LIMIT 100`,projectId,...peerValues).all()).results;
  if(keys.length){
   for(const file of keys)if(!uuid(file.id)||file.r2_key!==`project-engine/restored/${projectId}/${job.operation_id}/${file.id}`)throw invalid();
   const serialized=JSON.stringify(keys.map(file=>file.r2_key));
   journaled+=await mutate(`INSERT INTO engine_retired_file_keys(r2_key,job_id,project_id,actor_id,operation_id,cleanup_token,created_at) SELECT value,?,?,?,?,?,? FROM json_each(?) WHERE ${gate} AND NOT EXISTS(SELECT 1 FROM engine_files WHERE project_id!=? AND r2_key=value) ON CONFLICT(r2_key) DO NOTHING`,jobId,projectId,actorId,job.operation_id,cleanupToken,new Date().toISOString(),serialized,...scope,projectId);
   // A conflicting external file root must not silently lose its staging root.
   if((await statement(db,"SELECT COUNT(*) AS n FROM engine_retired_file_keys WHERE job_id=? AND cleanup_token=? AND r2_key IN(SELECT value FROM json_each(?))",jobId,cleanupToken,serialized).first()).n!==keys.length)throw invalid();
   continue;
  }
  let progressed=false;
  for(const table of order){
   if(!await statement(db,`SELECT 1 AS present FROM engine_${table} WHERE project_id=? LIMIT 1`,projectId).first())continue;
   const columns=backupColumns[table].split(" "),bytes=columns.map(column=>`COALESCE(length(CAST(${column} AS BLOB)),0)`).join("+");
   const changed=await mutate(`DELETE FROM engine_${table} WHERE project_id=? AND id IN(SELECT id FROM (SELECT p.*,SUM(bytes+256) OVER(ORDER BY id) AS total,ROW_NUMBER() OVER(ORDER BY id) AS n FROM (SELECT id,${bytes} AS bytes FROM engine_${table} WHERE project_id=? ORDER BY id LIMIT 100) p) WHERE total<=524288 OR n=1) AND ${gate}`,projectId,projectId,...scope);
   removed+=changed;if(changed){progressed=true;break;}if(batches>=batchBudget)break;
  }
  if(progressed)continue;
  if(batches>=batchBudget)break;
  // Header deletion is explicit; FK constraints and the all-tables-empty guard
  // make it impossible for a partial table walk to cascade engineering data.
  const empty=order.map(table=>`NOT EXISTS(SELECT 1 FROM engine_${table} WHERE project_id=?)`).join(" AND ");
  if(await statement(db,"SELECT 1 AS present FROM engine_projects WHERE id=?",projectId).first())removed+=await mutate(`DELETE FROM engine_projects WHERE id=? AND owner_id=? AND restore_job_id=? AND ${empty} AND ${gate}`,projectId,actorId,jobId,...order.map(()=>projectId),...scope);
  if(batches>=batchBudget)break;
  if(!await statement(db,`SELECT 1 AS present FROM engine_restore_rows WHERE job_id IN(${peers}) LIMIT 1`,...peerValues).first())break;
  removed+=await mutate(`DELETE FROM engine_restore_rows WHERE (job_id,table_name,row_id) IN(SELECT job_id,table_name,row_id FROM (SELECT p.*,SUM(length(CAST(data AS BLOB))+256) OVER(ORDER BY job_id,table_name,row_id) AS bytes,ROW_NUMBER() OVER(ORDER BY job_id,table_name,row_id) AS n FROM (SELECT job_id,table_name,row_id,data FROM engine_restore_rows WHERE job_id IN(${peers}) ORDER BY job_id,table_name,row_id LIMIT 100) p) WHERE bytes<=524288 OR n=1) AND NOT EXISTS(SELECT 1 FROM engine_projects WHERE id=?) AND ${gate}`,...peerValues,projectId,...scope);
 }
 await valid();
 const remaining=await statement(db,`SELECT (SELECT COUNT(*) FROM engine_projects WHERE id=?)+(SELECT COUNT(*) FROM engine_restore_rows WHERE job_id IN(${peers})) AS n`,projectId,...peerValues).first();
 return {jobId,projectId,batches,removed,journaled,complete:remaining.n===0,storageDeletion:false};
}
