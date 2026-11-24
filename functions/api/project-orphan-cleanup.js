import {statement,uuid} from "./project-state.js";
export {inventoryProjectOrphans,validateOrphanInventory} from "./project-orphan-inventory.js";
export {claimInactiveRestore} from "./project-restore-activity.js";
import {CURRENT_ENGINE_SCHEMA_SQL,openRestoreOperation} from "./project-restore-guards.js";

// Only operational rows from a completed, receipted recovery are eligible here.
// This shared cleanup owner will also host the separately reviewed abandoned-job,
// upload, Workshop-copy and frozen-value sweep. It never deletes engineering rows.
export async function cleanupCompletedRestore(db,{projectId,actorId,operationId}){
 if(!uuid(projectId)||!uuid(operationId)||typeof actorId!=="string"||!actorId)throw Error("Provide a scoped completed recovery.");
 const eligible=`${CURRENT_ENGINE_SCHEMA_SQL} AND EXISTS(SELECT 1 FROM engine_restore_jobs j JOIN engine_operations o ON o.project_id=j.project_id AND o.actor_id=j.actor_id AND o.operation_id=j.operation_id JOIN engine_projects p ON p.id=j.project_id WHERE j.id=? AND j.project_id=? AND j.actor_id=? AND j.operation_id=? AND j.state='complete' AND ${openRestoreOperation()} AND p.owner_id=j.actor_id AND p.restore_job_id IS NULL AND json_extract(o.result,'$.restored')=1)`;
 const jobs=(await statement(db,"SELECT id FROM engine_restore_jobs WHERE project_id=? AND actor_id=? AND operation_id=? AND state='complete'",projectId,actorId,operationId).all()).results;let removed=0;
 for(const job of jobs){
  for(;;){
   // Delete by key without returning metadata. Bound both rows and stored bytes;
   // allow one larger supported row so cleanup always makes forward progress.
   const result=await statement(db,`DELETE FROM engine_restore_rows WHERE job_id=? AND (table_name,row_id) IN(SELECT table_name,row_id FROM (SELECT p.*,SUM(length(CAST(data AS BLOB))+256) OVER(ORDER BY table_name,row_id) AS bytes,ROW_NUMBER() OVER(ORDER BY table_name,row_id) AS n FROM (SELECT table_name,row_id,data FROM engine_restore_rows WHERE job_id=? ORDER BY table_name,row_id LIMIT 250) p) WHERE bytes<=524288 OR n=1) AND ${eligible}`,job.id,job.id,job.id,projectId,actorId,operationId).run();
   removed+=result.meta.changes;if(!result.meta.changes)break;
  }
 }
 return {removed};
}

export async function tryCompletedRestoreCleanup(db,input){
 try{await cleanupCompletedRestore(db,input);}catch(error){
  // Publication and receipt already committed. Do not turn a successful recovery
  // into a false failure: exact retry will attempt cleanup again.
  console.error("Completed recovery staging cleanup deferred; published data and receipt are retained.",error);
 }
}
