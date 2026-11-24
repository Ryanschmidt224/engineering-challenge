import {statement,uuid,ProjectNotFound} from "./project-state.js";
import {CommandConflict} from "./project-command.js";
import {CURRENT_ENGINE_SCHEMA_SQL} from "./project-restore-guards.js";
import {RESTORE_INACTIVITY_MS} from "./project-restore-activity.js";
import {unreferencedStorageKeySQL} from "./project-storage-references.js";

const conflict=()=>new CommandConflict("Storage cleanup no longer matches an empty, retired recovery target. No further objects were removed.");
const stamp=value=>value instanceof Date?value.getTime():typeof value==="string"?Date.parse(value):NaN;
const age=(value,cutoff)=>{const date=stamp(value);return Number.isFinite(date)&&date<=cutoff;};
const oldObject=(head,cutoff)=>typeof head?.etag==="string"&&!!head.etag&&head.etag.length<=240&&Number.isSafeInteger(head.size)&&head.size>=0&&age(head.uploaded,cutoff);
// Internal only: no application HTTP route, scheduled job or live caller.
// Delete only journaled keys of a retired, never-published recovery destination.
// File/key/operation tombstones and attempt receipts must remain permanently.
export async function cleanupRetiredRestoreObjects(db,photos,{jobId,actorId,cleanupToken},{limit=10,cursor="",now=Date.now()}={}){
 if(!uuid(jobId)||!uuid(cleanupToken)||typeof actorId!=="string"||!actorId||!Number.isInteger(limit)||limit<1||limit>25||typeof cursor!=="string")throw Error("Provide an exact retirement receipt and a page size from 1 to 25.");
 const job=await statement(db,"SELECT * FROM engine_restore_jobs WHERE id=? AND actor_id=?",jobId,actorId).first();if(!job)throw new ProjectNotFound("Recovery job not found.");
 if(job.cleanup_token!==cleanupToken||job.state==="complete")throw conflict();
 const prefix=`project-engine/restored/${job.project_id}/${job.operation_id}/`;
 if(cursor&&(!cursor.startsWith(prefix)||!uuid(cursor.slice(prefix.length))))throw Error("Use a cursor from this recovery's storage page.");
 const cutoff=now-RESTORE_INACTIVITY_MS,scope=[jobId,actorId,cleanupToken],cutoffISO=new Date(cutoff).toISOString();
 const target=`${CURRENT_ENGINE_SCHEMA_SQL} AND EXISTS(SELECT 1 FROM engine_restore_jobs j WHERE j.id=? AND j.actor_id=? AND j.cleanup_token=? AND j.state IN('staging','ready') AND NOT EXISTS(SELECT 1 FROM engine_projects WHERE id=j.project_id) AND NOT EXISTS(SELECT 1 FROM engine_operations WHERE project_id=j.project_id) AND NOT EXISTS(SELECT 1 FROM engine_restore_jobs peer WHERE peer.project_id=j.project_id AND peer.actor_id=j.actor_id AND peer.operation_id=j.operation_id AND (peer.state='complete' OR EXISTS(SELECT 1 FROM engine_restore_rows WHERE job_id=peer.id))))`;
 const validate=async()=>{if(!(await statement(db,`SELECT (${target}) AS valid`,...scope).first())?.valid)throw conflict();};
 await validate();
 const rows=(await statement(db,"SELECT * FROM engine_retired_file_keys WHERE job_id=? AND actor_id=? AND cleanup_token=? AND r2_key>? ORDER BY r2_key LIMIT ?",jobId,actorId,cleanupToken,cursor,limit+1).all()).results;
 const page=rows.slice(0,limit),result={jobId,scanned:page.length,deleted:[],absent:[],protected:[],nextCursor:rows.length>limit?page.at(-1).r2_key:null};
 // Catalogue writers generate workshop-v2 keys; they cannot adopt a restored
 // engine key. Existing catalogue roots are nevertheless checked conservatively.
 const catalogue=!!await statement(db,"SELECT 1 AS present FROM sqlite_master WHERE type='table' AND name='workshop_attachments'").first();
 const roots=unreferencedStorageKeySQL("k.r2_key",{catalogue});
 for(const key of page){
  if(key.project_id!==job.project_id||key.operation_id!==job.operation_id||!key.r2_key.startsWith(prefix)||!uuid(key.r2_key.slice(prefix.length)))throw conflict();
  if(!age(job.cleanup_claimed_at,cutoff)||!age(key.created_at,cutoff)){result.protected.push({key:key.r2_key,reason:"Retirement/key journal is younger than 24 hours or its age is unknown."});continue;}
  const observed=await photos.head(key.r2_key);
  if(!observed){await validate();result.absent.push(key.r2_key);continue;}
  if(!oldObject(observed,cutoff)){result.protected.push({key:key.r2_key,reason:"Object age or identity is unknown, or these bytes are younger than 24 hours."});continue;}
  // The root check and durable intent are one D1 statement. JSON triggers then
  // close the root-introduction race before the separate storage deletion.
  await statement(db,`INSERT INTO engine_retired_object_attempts(r2_key,etag,attempt_id,created_at) SELECT k.r2_key,?,?,? FROM engine_retired_file_keys k WHERE k.r2_key=? AND k.job_id=? AND k.actor_id=? AND k.cleanup_token=? AND julianday(k.created_at)<=julianday(?) AND ${target} AND ${roots} ON CONFLICT(r2_key,etag) DO NOTHING`,observed.etag,crypto.randomUUID(),new Date(now).toISOString(),key.r2_key,jobId,actorId,cleanupToken,cutoffISO,...scope).run();
  await validate();
  const admitted=await statement(db,`SELECT 1 AS valid FROM engine_retired_object_attempts a JOIN engine_retired_file_keys k ON k.r2_key=a.r2_key WHERE a.r2_key=? AND a.etag=? AND k.job_id=? AND k.actor_id=? AND k.cleanup_token=? AND ${roots}`,key.r2_key,observed.etag,jobId,actorId,cleanupToken).first();
  if(!admitted){result.protected.push({key:key.r2_key,reason:"Current file, historical, catalogue or staged evidence protects this key, or metadata is invalid."});continue;}
  const current=await photos.head(key.r2_key);
  if(!current){result.absent.push(key.r2_key);continue;}
  if(!oldObject(current,cutoff)||current.etag!==observed.etag||current.size!==observed.size||stamp(current.uploaded)!==stamp(observed.uploaded)){result.protected.push({key:key.r2_key,reason:"Object identity changed during cleanup; inspect it on a later sweep."});continue;}
  await validate();await photos.delete(key.r2_key);result.deleted.push({key:key.r2_key,observedEtag:observed.etag});
 }
 // A page being exhausted does not prove permanent absence. A previously
 // in-flight put can finish later; future sweeps must rescan retained journals.
 return result;
}
