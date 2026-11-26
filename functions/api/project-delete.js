import {commitProjectCommand,canonicalJSON,sha256,CommandConflict} from "./project-command.js";
import {ownedProject,expectedProject,statement,rows,ProjectNotFound} from "./project-state.js";
import {deletionJob,projectDeletionPrefixes} from "./project-delete-status.js";

// Only explicitly admitted projects may enter this path. No generic orphan or
// prefix deletion endpoint is exposed. Each call removes at most 100 objects.
export async function deleteProjectStep(env,owner,input,data){
 const db=env.WORKSHOP_DB,{projectId,actorId,operationId,expectedRevision}=input;
 if(!env.PHOTOS)throw Object.assign(Error("Project storage is unavailable. Nothing has been deleted."),{status:503});
 if(typeof data.name!=="string"||data.name.length>180||expectedRevision===null)throw Error("Enter the exact project name and use its loaded version.");
 const request_hash=await sha256(canonicalJSON({projectId,actorId,expectedRevision,payload:input.payload}));let job=await deletionJob(db,projectId);
 if(job){
  if(job.actor_id!==owner.id)throw new ProjectNotFound();
  if(job.id!==operationId||job.request_hash!==request_hash)throw new CommandConflict("Deletion has already started. Return to Projects and continue that deletion.");
 }else{
  const project=await ownedProject(db,projectId,owner.id);expectedProject(project,input);
  if(data.name!==project.name)throw Error("Type the project name exactly to permanently delete it.");
  const prefixes=projectDeletionPrefixes(projectId).filter(prefix=>prefix.startsWith("project-engine/")),foreign=await statement(db,"SELECT r2_key FROM engine_files WHERE project_id=? AND "+prefixes.map(()=>"substr(r2_key,1,?)<>?").join(" AND ")+" LIMIT 1",projectId,...prefixes.flatMap(prefix=>[prefix.length,prefix])).first();
  if(foreign)throw new CommandConflict("This project has an unexpected storage reference. Deletion needs review; nothing has been deleted.");
  // Legacy Workshop uses are a separate storage model. Do not silently erase
  // reusable/legacy records through an engine-project deletion.
  const workshop=await statement(db,"SELECT name FROM sqlite_master WHERE type='table' AND name='workshop_uses'").first();
  const uses=workshop&&await statement(db,"SELECT id FROM workshop_uses WHERE project_id=? LIMIT 1",projectId).first();
  if(uses)throw new CommandConflict("This project has legacy Workshop uses. Review those references before permanently deleting it.");
  await commitProjectCommand(db,input,w=>{w.insert("engine_project_deletions",{id:operationId,project_id:projectId,actor_id:owner.id,expected_revision:expectedRevision,request_hash,state:"deleting",created_at:w.createdAt});return {projectId,deletionStarted:true};});
  job=await deletionJob(db,projectId);
 }
 return advanceProjectDeletion(env,job);
}

export async function advanceProjectDeletion(env,job){
 const db=env.WORKSHOP_DB,current=job&&await deletionJob(db,job.project_id);
 if(!current||current.id!==job.id||current.actor_id!==job.actor_id)throw new ProjectNotFound("No admitted project deletion was found.");
 job=current;const prefixes=projectDeletionPrefixes(job.project_id);
 try{
  for(const prefix of prefixes){
   // Start afresh after deleting a page; a positional cursor could skip keys
   // when earlier pages disappear. R2 lists are strongly consistent.
   const page=await env.PHOTOS.list({prefix,limit:100});
   if(!Array.isArray(page.objects)||page.objects.some(object=>typeof object.key!=="string"||!object.key.startsWith(prefix))||page.truncated&&!page.objects.length)throw Error("Incomplete project object listing.");
   if(page.objects.length){await env.PHOTOS.delete(page.objects.map(object=>object.key));return {projectId:job.project_id,deleted:false,deleting:true,objectsRemoved:page.objects.length};}
  }
  if(job.state==="complete")return {projectId:job.project_id,deleted:true};
  const guard="EXISTS(SELECT 1 FROM engine_project_deletions WHERE id=? AND project_id=? AND actor_id=? AND state='deleting')",gate=[job.id,job.project_id,job.actor_id];
  const tables=["media","file_links","records","events","configurations","selections","snapshot_values","steps","occurrences","archive_groups","files","items","operations"];
  const writes=tables.map(table=>statement(db,`DELETE FROM engine_${table} WHERE project_id=? AND ${guard}`,job.project_id,...gate));
  writes.push(statement(db,`DELETE FROM engine_restore_rows WHERE job_id IN(SELECT id FROM engine_restore_jobs WHERE project_id=? AND actor_id=?) AND ${guard}`,job.project_id,job.actor_id,...gate));
  writes.push(statement(db,`DELETE FROM engine_projects WHERE id=? AND owner_id=? AND ${guard}`,job.project_id,job.actor_id,...gate));
  writes.push(statement(db,`UPDATE engine_project_deletions SET state='complete',completed_at=? WHERE id=? AND project_id=? AND actor_id=? AND state='deleting'`,new Date().toISOString(),...gate));
  await db.batch(writes);
  const done=await deletionJob(db,job.project_id);if(done?.state!=="complete")throw Error("Deletion did not finish.");
  return {projectId:job.project_id,deleted:true};
 }catch(error){
  console.error("Project deletion paused",job.project_id,error?.name||"StorageError");
  throw Object.assign(Error("Deletion is paused. Some project data may already be removed. Retry deletion to finish; it cannot be undone."),{status:503});
 }
}

// Reuse the existing scheduled invocation, without another schedule or general
// cleanup API. Tombstones also catch objects left by an older in-flight writer.
export async function sweepProjectDeletions(env,{limit=5}={}){
 const jobs=await rows(env.WORKSHOP_DB,"SELECT * FROM engine_project_deletions ORDER BY COALESCE(last_swept_at,created_at),project_id LIMIT ?",limit),results=[];
 for(const job of jobs){
  try{results.push(await advanceProjectDeletion(env,job));}catch{results.push({projectId:job.project_id,deleted:false});}
  await statement(env.WORKSHOP_DB,"UPDATE engine_project_deletions SET last_swept_at=? WHERE id=?",new Date().toISOString(),job.id).run();
 }
 return results;
}
