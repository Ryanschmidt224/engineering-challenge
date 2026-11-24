import {statement,uuid} from "./project-state.js";
import {validId} from "../../assets/family-model.js";
import {restoreRetirementStatus,RESTORE_INACTIVITY_MS} from "./project-restore-activity.js";

export const ORPHAN_MINIMUM_AGE=RESTORE_INACTIVITY_MS;
const jsonColumns={items:["fields"],occurrences:["removed_path"],steps:["retired_path"],configurations:["snapshot"],records:["fields","step_snapshot"],events:["payload"],selections:["snapshot","requirements"],archive_groups:["members"],snapshot_values:["snapshot"]};
const page=(rows,limit,kind)=>{const last=rows[limit-1];return {rows:rows.slice(0,limit),nextCursor:rows.length>limit?kind==="restores"?last.id:last.id+":"+last.project_id:null};};
const oldEnough=(created,cutoff)=>typeof created==="string"&&Number.isFinite(Date.parse(created))&&Date.parse(created)<=cutoff;
async function references(db,targets,{global=false}={}){
 if(!targets.length)return new Set();const values=JSON.stringify([...new Set(targets.map(row=>row.value))]),projects=JSON.stringify([...new Set(targets.map(row=>row.projectId))]),found=new Set();
 // JSON-tree atoms preserve escaped IDs/keys. Substring matching raw JSON can
 // miss a valid historical reference encoded with Unicode escapes.
 const results=await db.batch(Object.entries(jsonColumns).flatMap(([table,columns])=>columns.map(column=>statement(db,`SELECT t.project_id,j.atom AS reference FROM engine_${table} t CROSS JOIN json_tree(CASE WHEN json_valid(t.${column}) THEN t.${column} ELSE 'null' END) j WHERE ${global?"1":"t.project_id IN(SELECT value FROM json_each(?))"} AND j.type='text' AND j.atom IN(SELECT value FROM json_each(?)) UNION ALL SELECT t.project_id,NULL AS reference FROM engine_${table} t WHERE ${global?"1":"t.project_id IN(SELECT value FROM json_each(?))"} AND t.${column} IS NOT NULL AND NOT json_valid(t.${column})`,...(global?[values]:[projects,values]),...(global?[]:[projects])))));
 for(const result of results)for(const row of result.results){if(row.reference===null)throw Object.assign(Error("Saved metadata is not valid JSON; orphan inventory is incomplete. Nothing was changed."),{status:409});found.add(global?row.reference:row.project_id+":"+row.reference);}
 return found;
}
function settings(params){
 const kind=params.get("kind")||"restores",cursor=params.get("cursor")||"",limit=params.has("limit")?Number(params.get("limit")):25;
 const cursorValid=!cursor||kind==="objects"||(kind==="restores"?uuid(cursor):cursor.split(":").length===2&&cursor.split(":").every(uuid));
 if(!["restores","files","values","objects"].includes(kind)||!Number.isInteger(limit)||limit<1||limit>50||cursor.length>2048||cursor.includes("\0")||!cursorValid)throw Object.assign(Error("Choose an orphan inventory kind, a valid cursor and a page size from 1 to 50."),{status:400});
 return {kind,cursor,limit};
}
export const validateOrphanInventory=settings;
export async function inventoryProjectOrphans(db,photos,actorId,params,{now=Date.now()}={}){
 const {kind,cursor,limit}=settings(params),cutoff=now-ORPHAN_MINIMUM_AGE,result={dryRun:true,executable:false,kind,minimumAgeHours:24,checkedAt:new Date(now).toISOString(),candidates:[],protected:[],nextCursor:null};
 if(kind==="objects")return objectInventory(db,photos,actorId,{cursor,limit,cutoff,result});
 const sql=kind==="restores"
  ?"SELECT j.*,(SELECT COUNT(*) FROM engine_restore_rows r WHERE r.job_id=j.id) AS staged_rows,p.owner_id AS target_owner,p.restore_job_id FROM engine_restore_jobs j LEFT JOIN engine_projects p ON p.id=j.project_id WHERE j.actor_id=? AND j.id>? ORDER BY j.id LIMIT ?"
  :kind==="files"
  ?"SELECT f.id,f.project_id,f.r2_key,f.created_at,p.revision FROM engine_files f JOIN engine_projects p ON p.id=f.project_id WHERE p.owner_id=? AND p.restore_job_id IS NULL AND f.state='prepared' AND (f.id>? OR f.id=? AND f.project_id>?) ORDER BY f.id,f.project_id LIMIT ?"
  :"SELECT v.id,v.project_id,v.kind,v.created_at,p.revision FROM engine_snapshot_values v JOIN engine_projects p ON p.id=v.project_id WHERE p.owner_id=? AND p.restore_job_id IS NULL AND (v.id>? OR v.id=? AND v.project_id>?) ORDER BY v.id,v.project_id LIMIT ?";
 const [rowCursor="",projectCursor=""]=cursor.split(":"),all=(await statement(db,sql,...(kind==="restores"?[actorId,cursor,limit+1]:[actorId,rowCursor,rowCursor,projectCursor,limit+1])).all()).results,selected=page(all,limit,kind);result.nextCursor=selected.nextCursor;result.scanned=selected.rows.length;
 const roots=kind==="restores"?new Set():await references(db,selected.rows.map(row=>({projectId:row.project_id,value:row.id})));
 const linked=kind==="files"?new Set((await statement(db,"SELECT DISTINCT project_id,file_id FROM engine_file_links WHERE file_id IN(SELECT value FROM json_each(?))",JSON.stringify(selected.rows.map(row=>row.id))).all()).results.map(row=>row.project_id+":"+row.file_id)):new Set();
 for(const row of selected.rows){
  const entry={id:row.id,projectId:row.project_id,...(row.revision?{expectedRevision:row.revision}:{}),...(row.r2_key?{key:row.r2_key}:{}),...(kind==="restores"?{state:row.state,stagedRows:row.staged_rows,lastActivityAt:row.last_activity_at,retired:!!row.cleanup_token}: {})};
  let reason=!oldEnough(row.created_at,cutoff)?"Younger than 24 hours or age is unknown.":null,action=kind==="restores"?"completed_staging":kind==="files"?"prepared_upload_metadata":"unreferenced_frozen_value";
  if(kind==="restores"){
   if(row.state!=="complete"){const status=await restoreRetirementStatus(db,row,actorId,{now});reason=status.claimable?null:status.reason;if(status.claimable){action="inactive_restore_claim";entry.observedActivity=status.observedActivity;}}
   else if(row.target_owner!==actorId||row.restore_job_id)reason="The target is not a published project owned by this operator.";
   else if(!row.staged_rows)reason="No completed staging remains.";
   else if(!await statement(db,"SELECT 1 AS present FROM engine_operations WHERE project_id=? AND actor_id=? AND operation_id=? AND json_extract(result,'$.restored')=1",row.project_id,actorId,row.operation_id).first())reason="No successful import receipt protects this cleanup.";
  }else if(roots.has(row.project_id+":"+row.id)||linked.has(row.project_id+":"+row.id))reason="Retained by saved engineering metadata or attachment ownership.";
  if(!reason&&kind==="files"){
   const object=await photos.head(row.r2_key);if(object&&!oldEnough(object.uploaded instanceof Date?object.uploaded.toISOString():object.uploaded,cutoff))reason="The upload is recent or its object age is unknown.";
  }
  if(reason)result.protected.push({...entry,reason});else result.candidates.push({...entry,action});
 }
 return result;
}
function objectOwner(key){
 const parts=key.split("/");if(parts[0]!=="project-engine"||!uuid(parts[2]))return null;
 if(parts[1]==="files"&&parts.length===4&&uuid(parts[3]))return {projectId:parts[2],operationId:null};
 if(["workshop","restored"].includes(parts[1])&&parts.length===5&&uuid(parts[3])&&(parts[1]==="restored"?uuid(parts[4]):validId(parts[4])))return {projectId:parts[2],operationId:parts[3]};return null;
}
async function objectInventory(db,photos,actorId,{cursor,limit,cutoff,result}){
 const listed=await photos.list({prefix:"project-engine/",limit,...(cursor?{cursor}:{})});if(listed.truncated&&!listed.cursor)throw Error("Object inventory is incomplete: storage omitted its continuation cursor.");
 result.nextCursor=listed.truncated?listed.cursor:null;result.scanned=listed.objects.length;
 const scoped=listed.objects.map(object=>({object,owner:objectOwner(object.key)})).filter(row=>row.owner),ids=JSON.stringify([...new Set(scoped.map(row=>row.owner.projectId))]),keys=JSON.stringify(scoped.map(row=>row.object.key));
 const results=await db.batch([statement(db,"SELECT id,owner_id,restore_job_id,revision FROM engine_projects WHERE id IN(SELECT value FROM json_each(?))",ids),statement(db,"SELECT project_id,actor_id,operation_id,state FROM engine_restore_jobs WHERE project_id IN(SELECT value FROM json_each(?)) AND state!='complete'",ids),statement(db,"SELECT r2_key FROM engine_files WHERE r2_key IN(SELECT value FROM json_each(?))",keys),statement(db,"SELECT DISTINCT json_extract(r.data,'$.r2_key') AS r2_key FROM engine_restore_rows r JOIN engine_restore_jobs j ON j.id=r.job_id WHERE r.table_name='files' AND j.state!='complete' AND json_extract(r.data,'$.r2_key') IN(SELECT value FROM json_each(?))",keys)]);
 const projects=new Map(results[0].results.map(row=>[row.id,row])),jobs=results[1].results,owned=scoped.filter(row=>projects.has(row.owner.projectId)?projects.get(row.owner.projectId).owner_id===actorId:jobs.some(job=>job.project_id===row.owner.projectId&&job.actor_id===actorId&&job.operation_id===row.owner.operationId)),stored=new Set([...results[2].results,...results[3].results].map(row=>row.r2_key)),roots=await references(db,owned.map(row=>({projectId:row.owner.projectId,value:row.object.key})),{global:true});
 // Workshop can be unused in an engine-only database; inspection must not run
 // its migrations just to check catalogue attachment ownership.
 if(await statement(db,"SELECT 1 AS present FROM sqlite_master WHERE type='table' AND name='workshop_attachments'").first())for(const row of(await statement(db,"SELECT r2_key FROM workshop_attachments WHERE r2_key IN(SELECT value FROM json_each(?))",keys).all()).results)stored.add(row.r2_key);
 for(const {object,owner}of owned){
  const project=projects.get(owner.projectId),entry={key:object.key,projectId:owner.projectId,etag:object.etag,...(project?.revision?{expectedRevision:project.revision}:{})};
  let reason=!oldEnough(object.uploaded instanceof Date?object.uploaded.toISOString():object.uploaded,cutoff)?"Younger than 24 hours or age is unknown.":null;
  if(!project||project.restore_job_id||jobs.some(job=>job.project_id===owner.projectId&&job.operation_id===owner.operationId))reason="An incomplete restore or unknown project owner protects these bytes.";
  else if(stored.has(object.key)||roots.has(object.key))reason="Retained by file metadata, a recovery job or historical evidence.";
  if(reason)result.protected.push({...entry,reason});else result.candidates.push({...entry,action:"unreferenced_object"});
 }
 return result;
}
