import {statement,uuid,ProjectNotFound} from "./project-state.js";
import {CommandConflict} from "./project-command.js";
import {CURRENT_ENGINE_SCHEMA_SQL,openRestoreOperation} from "./project-restore-guards.js";
export const RESTORE_INACTIVITY_MS=24*60*60*1000;
const conflict=()=>new CommandConflict("This recovery changed or was retired after inactivity. Keep the backup and start a new recovered copy.");
export function restoreActivityStatement(db,{id,projectId,actorId,operationId},now=Date.now()){
 return statement(db,`UPDATE engine_restore_jobs AS j SET last_activity_at=? WHERE j.id=? AND j.project_id=? AND j.actor_id=? AND j.operation_id=? AND j.state IN('staging','ready') AND ${openRestoreOperation()} AND ${CURRENT_ENGINE_SCHEMA_SQL}`,new Date(now).toISOString(),id,projectId,actorId,operationId);
}
export async function touchRestoreActivity(db,scope,now=Date.now()){
 const result=await restoreActivityStatement(db,scope,now).run();if(result.meta.changes===1)return;
 const complete=await statement(db,`SELECT 1 AS present FROM engine_restore_jobs j WHERE j.id=? AND j.project_id=? AND j.actor_id=? AND j.operation_id=? AND j.state='complete' AND ${openRestoreOperation()}`,scope.id,scope.projectId,scope.actorId,scope.operationId).first();if(!complete)throw conflict();
}
export async function restoreRetirementStatus(db,job,actorId,{now=Date.now()}={}){
 if(!job||job.actor_id!==actorId)throw new ProjectNotFound("Recovery job not found.");
 if(job.cleanup_token)return {claimable:false,reason:"This recovery operation is already retired; deletion remains disabled."};
 if(job.state==="complete")return {claimable:false,reason:"A completed recovery cannot be retired."};
 const cutoff=now-RESTORE_INACTIVITY_MS;
 if(!Number.isFinite(Date.parse(job.last_activity_at))||!Number.isFinite(Date.parse(job.created_at))||Date.parse(job.last_activity_at)>cutoff||Date.parse(job.created_at)>cutoff)return {claimable:false,reason:"Recovery progress is recent or its activity age is unknown."};
 const project=await statement(db,"SELECT owner_id,restore_job_id FROM engine_projects WHERE id=?",job.project_id).first();
 if(project&&(project.owner_id!==actorId||project.restore_job_id!==job.id))return {claimable:false,reason:"This is not the job's unpublished target; existing projects stay protected."};
 if(await statement(db,"SELECT 1 AS present FROM engine_operations WHERE project_id=? LIMIT 1",job.project_id).first())return {claimable:false,reason:"A committed operation receipt protects this recovery."};
 const peer=await statement(db,"SELECT 1 AS present FROM engine_restore_jobs WHERE project_id=? AND actor_id=? AND operation_id=? AND (cleanup_token IS NOT NULL OR state IN('staging','ready') AND (julianday(last_activity_at) IS NULL OR julianday(created_at) IS NULL OR julianday(last_activity_at)>julianday(?) OR julianday(created_at)>julianday(?))) LIMIT 1",job.project_id,actorId,job.operation_id,new Date(cutoff).toISOString(),new Date(cutoff).toISOString()).first();
 return peer?{claimable:false,reason:"A retry is active or this recovery operation is already retired."}:{claimable:true,observedActivity:job.last_activity_at};
}
// Internal claim primitive only: no HTTP claim/apply route. The separate bounded
// executor requires its exact receipt and never removes storage objects.
// A durable operation tombstone fences older retries as well as the current job.
export async function claimInactiveRestore(db,{jobId,actorId,observedActivity},{now=Date.now()}={}){
 if(!uuid(jobId)||typeof actorId!=="string"||!actorId||typeof observedActivity!=="string")throw Error("Provide a scoped observed recovery job.");
 const job=await statement(db,"SELECT * FROM engine_restore_jobs WHERE id=? AND actor_id=?",jobId,actorId).first();if(!job)throw new ProjectNotFound("Recovery job not found.");
 if(job.cleanup_token)return {jobId,projectId:job.project_id,operationId:job.operation_id,cleanupToken:job.cleanup_token};
 const eligibility=await restoreRetirementStatus(db,job,actorId,{now});if(!eligibility.claimable)throw new CommandConflict(eligibility.reason);
 const cleanupToken=crypto.randomUUID(),cutoff=new Date(now-RESTORE_INACTIVITY_MS).toISOString();
 const result=await statement(db,`UPDATE engine_restore_jobs AS j SET cleanup_token=?,cleanup_claimed_at=? WHERE j.id=? AND j.actor_id=? AND j.last_activity_at=? AND j.state IN('staging','ready') AND ${openRestoreOperation()} AND ${CURRENT_ENGINE_SCHEMA_SQL} AND julianday(j.last_activity_at)<=julianday(?) AND julianday(j.created_at)<=julianday(?) AND NOT EXISTS(SELECT 1 FROM engine_restore_jobs peer WHERE peer.project_id=j.project_id AND peer.actor_id=j.actor_id AND peer.operation_id=j.operation_id AND peer.state IN('staging','ready') AND (julianday(peer.last_activity_at) IS NULL OR julianday(peer.created_at) IS NULL OR julianday(peer.last_activity_at)>julianday(?) OR julianday(peer.created_at)>julianday(?))) AND NOT EXISTS(SELECT 1 FROM engine_operations o WHERE o.project_id=j.project_id) AND (NOT EXISTS(SELECT 1 FROM engine_projects p WHERE p.id=j.project_id) OR EXISTS(SELECT 1 FROM engine_projects p WHERE p.id=j.project_id AND p.owner_id=j.actor_id AND p.restore_job_id=j.id))`,cleanupToken,new Date(now).toISOString(),jobId,actorId,observedActivity,cutoff,cutoff,cutoff,cutoff).run();
 if(result.meta.changes!==1){const winner=await statement(db,"SELECT cleanup_token FROM engine_restore_jobs WHERE id=? AND actor_id=?",jobId,actorId).first();if(winner?.cleanup_token)return {jobId,projectId:job.project_id,operationId:job.operation_id,cleanupToken:winner.cleanup_token};throw conflict();}
 return {jobId,projectId:job.project_id,operationId:job.operation_id,cleanupToken};
}
