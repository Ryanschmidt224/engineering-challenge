import {projectNumberKey} from "../../assets/project-item-model.js";
import {projectTree} from "../../assets/project-tree-model.js";
import {commitProjectCommand,replayProjectCommand,CommandConflict,canonicalJSON,sha256} from "./project-command.js";
import {statement,uuid,text} from "./project-state.js";
import {bytesHash,MAX_ENGINE_FILE} from "./project-engine-files.js";
import {validateSnapshotReferences,verifySnapshotValues} from "./project-snapshot-values.js";
import {backupMetadata,readBackupManifest} from "./project-backup-metadata.js";
import {backupColumns as columns,backupOutline} from "./project-backup-schema.js";
import {restoreStaging,stagedRows,pendingRestore,materializeRestore} from "./project-restore-staging.js";
import {smallBackup,streamedExport} from "./project-backup-stream.js";
import {tryCompletedRestoreCleanup} from "./project-orphan-cleanup.js";
import {assertStorageKeyWritable} from "./project-storage-fence.js";
// Explicit export schema: receipts and concurrency tokens are operational, not
// engineering history. Restore issues a new token and a new import receipt.
export async function projectManifest(db,project){
 const names=Object.keys(columns),result=await db.batch([statement(db,"SELECT id,owner_id,name,revision,prefix,digits,created_at FROM engine_projects WHERE id=? AND restore_job_id IS NULL",project.id),...names.map(name=>statement(db,`SELECT * FROM engine_${name} WHERE project_id=? ORDER BY id`,project.id))]);
 return {format:"building-schmidt-project",version:1,project:result[0].results[0],tables:Object.fromEntries(names.map((name,index)=>[name,result[index+1].results]))};
}
function base64(bytes){let text="";for(let start=0;start<bytes.length;start+=8192)text+=String.fromCharCode(...bytes.subarray(start,start+8192));return btoa(text);}
const line=value=>new TextEncoder().encode(JSON.stringify(value)+"\n");
export async function exportProject(env,project){
 if(!await smallBackup(env.WORKSHOP_DB,project.id))return streamedExport(env,project,manifest=>validateManifest(manifest,project.id));
 const manifest=validateManifest(await projectManifest(env.WORKSHOP_DB,project),project.id);
 await verifySnapshotValues(manifest.tables.snapshot_values);
 const metadata=backupMetadata(manifest);
 async function* archive(){
  for(const entry of metadata)yield line(entry);
  for(const file of manifest.tables.files.filter(row=>row.state==="ready")){
   const object=await env.PHOTOS.get(file.r2_key);if(!object||object.size!==file.size||file.size>MAX_ENGINE_FILE)throw Error("A file is missing or too large; backup is incomplete.");
   const bytes=new Uint8Array(await object.arrayBuffer());if(await bytesHash(bytes)!==file.sha256)throw Error("A file failed verification; backup is incomplete.");
   yield line({type:"file",id:file.id});
   for(let offset=0;offset<bytes.length;offset+=196608)yield line({type:"bytes",data:base64(bytes.subarray(offset,offset+196608))});
   yield line({type:"end_file",id:file.id});
  }
  yield line({type:"complete"});
 }
 const iterator=archive(),stream=new ReadableStream({async pull(controller){try{const next=await iterator.next();if(next.done)controller.close();else controller.enqueue(next.value);}catch(error){controller.error(error);}},async cancel(){await iterator.return();}});
 return new Response(stream,{headers:{"content-type":"application/x-ndjson","content-disposition":"attachment; filename=project-"+project.id+".bsproject","cache-control":"private, no-store","x-content-type-options":"nosniff"}});
}
async function* archiveLines(request){
 const reader=request.body?.getReader();if(!reader)throw Error("Choose a project backup.");const decoder=new TextDecoder("utf-8",{fatal:true});let buffer="",total=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>256*1024*1024)throw Error("This preview restore accepts backups up to 256 MB.");buffer+=decoder.decode(value,{stream:true});let at;while((at=buffer.indexOf("\n"))!==-1){if(at>4*1024*1024)throw Error("Backup metadata is too large.");const raw=buffer.slice(0,at);buffer=buffer.slice(at+1);if(raw)yield JSON.parse(raw);}if(buffer.length>4*1024*1024)throw Error("Backup line is too large.");}buffer+=decoder.decode();if(buffer.trim())throw Error("Backup is incomplete: a line was truncated.");}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
export function validateManifest(manifest,projectId){
 if(manifest?.format!=="building-schmidt-project"||manifest.version!==1||manifest.project?.id!==projectId||!uuid(projectId)||!manifest.tables||typeof manifest.tables!=="object")throw Error("This is not a supported project backup.");
 const project=manifest.project;if(typeof project.name!=="string"||!project.name.trim()||project.name.length>180||typeof project.prefix!=="string"||project.prefix.length>10||!Number.isInteger(project.digits)||project.digits<1||project.digits>8)throw Error("Invalid project settings in backup.");
 if(Object.keys(manifest.tables).some(name=>!Object.hasOwn(columns,name)))throw Error("Backup contains unknown tables.");
 let count=0;
 for(const [name,allowed] of Object.entries(columns)){
  if(["selections","archive_groups","snapshot_values"].includes(name)&&manifest.tables[name]===undefined)manifest.tables[name]=[];
  const list=manifest.tables[name];if(!Array.isArray(list))throw Error("Backup is missing "+name+".");count+=list.length;if(count>100000)throw Error("This preview recovery supports at most 100,000 metadata rows.");
  const ids=new Set();for(const row of list){if(!row||!uuid(row.id)||row.project_id!==projectId||ids.has(row.id)||Object.keys(row).some(key=>!allowed.split(" ").includes(key))||Object.values(row).some(value=>value!==null&&!["string","number"].includes(typeof value)))throw Error("Invalid or duplicate "+name+" row.");ids.add(row.id);}
 }
 const numbers=new Set();for(const item of manifest.tables.items){
  if(typeof item.part_number!=="string"||!item.part_number.trim()||item.part_number.length>80||numbers.has(projectNumberKey(item.part_number)))throw Error("Backup contains an invalid or reused part number.");numbers.add(projectNumberKey(item.part_number));
  if(item.revision_level!==undefined&&(!Number.isSafeInteger(item.revision_level)||item.revision_level<1))throw Error("Invalid part revision level in backup.");
 }
 const tree=projectTree(manifest.tables.items,manifest.tables.occurrences);
 for(const item of manifest.tables.items)if(item.is_assembly!==undefined&&![0,1].includes(item.is_assembly)||item.is_assembly&&(item.kind!=="part"||item.is_tool))throw Error("Invalid subassembly definition in backup.");
 for(const selection of manifest.tables.selections)if(!tree.definitions.has(selection.id)||tree.definitions.get(selection.id).is_assembly)throw Error("Invalid Workshop selection owner in backup.");
 for(const group of manifest.tables.archive_groups){if(!tree.placements.has(group.root_occurrence_id))throw Error("Invalid archive group root.");let members;try{members=JSON.parse(group.members);}catch{throw Error("Invalid archive group members.");}if(!Array.isArray(members)||!members.length||members.length>100||new Set(members.map(row=>row.id)).size!==members.length||members.some(row=>!tree.placements.has(row.id)))throw Error("Invalid archive group members.");}
 if(manifest.tables.occurrences.some(row=>row.archive_group_id&&!manifest.tables.archive_groups.some(group=>group.id===row.archive_group_id)))throw Error("An archived placement is missing its group.");
 const files=new Map(manifest.tables.files.map(file=>[file.id,file]));
 for(const file of files.values())if(!["prepared","ready"].includes(file.state)||file.state==="ready"&&(!Number.isInteger(file.size)||file.size<0||file.size>MAX_ENGINE_FILE||!/^[a-f0-9]{64}$/.test(file.sha256)))throw Error("Invalid file metadata in backup.");
 for(const link of manifest.tables.file_links)if(!files.has(link.file_id)||files.get(link.file_id).state!=="ready")throw Error("A file link has no verified file.");
 validateSnapshotReferences(manifest.tables);
 return manifest;
}
export async function restoreProject(request,env,owner,projectId,{asCopy=false}={}){
 const operationId=request.headers.get("x-operation-id");if(!uuid(projectId)||!uuid(operationId)||request.headers.get("x-project-revision")!=="new")throw Error("Restore requires a new-project revision and operation ID.");
 const iterator=archiveLines(request),cleanup={projectId,actorId:owner.id,operationId};let retryInput=null;try{
 const first=await iterator.next(),header=first.value?.manifest;if(!header?.project||header.format!=="building-schmidt-project"||![1,2].includes(header.version))throw Error("Backup is missing a supported manifest.");
 if(asCopy&&header.project.id===projectId){throw new CommandConflict("A recovered copy requires a different project identity. The existing project was not changed.");}
 const copyName=asCopy?text(new URL(request.url).searchParams.get("name"),180,"New project name",true):null;
 const db=env.WORKSHOP_DB,storageKey=file=>"project-engine/restored/"+projectId+"/"+operationId+"/"+file.id,requestKey={header,asCopy,copyName};
 let staging=null,digest=await sha256(canonicalJSON(header)),outline=backupOutline(header.project);
 const stageRow=async(table,row)=>{
  outline.collect(table,row);if(table==="snapshot_values")await verifySnapshotValues([row]);digest=await sha256(digest+await sha256(canonicalJSON({table,row})));
  if(!staging)staging=await restoreStaging(db,projectId,owner.id,operationId,storageKey,requestKey);
  if(table!=="occurrences")await staging.add(table,row);
 };
 const received=await readBackupManifest(iterator,first.value,Object.keys(columns),header.version===2?stageRow:null);
 const manifest=validateManifest(header.version===2?outline.manifest:received,asCopy?header.project.id:projectId);
 const input={projectId,actorId:owner.id,operationId,expectedRevision:null,payload:{action:asCopy?"restore-project-copy":"restore-project",...(header.version===2?{metadataDigest:digest}: {manifest}),...(asCopy?{copyName}:{})}};
 retryInput=input;
 const replay=await replayProjectCommand(env.WORKSHOP_DB,input);if(replay){await tryCompletedRestoreCleanup(db,cleanup);return replay.result;}
 if(header.version===1){await verifySnapshotValues(manifest.tables.snapshot_values);for(const [table,rows]of Object.entries(manifest.tables))for(const row of rows)await stageRow(table,row);}
 const requestFingerprint=await sha256(canonicalJSON(input.payload));await pendingRestore(db,projectId,owner.id,operationId,requestFingerprint);
 if(!staging)staging=await restoreStaging(db,projectId,owner.id,operationId,storageKey,requestKey);
 const restoredTree=projectTree(manifest.tables.items,manifest.tables.occurrences);
 for(const row of [...manifest.tables.occurrences].sort((a,b)=>restoredTree.path(a).length-restoredTree.path(b).length))await staging.add("occurrences",row,restoredTree.path(row).length);
 await staging.flush();
 const frozen=new Map(manifest.tables.snapshot_values.map(row=>[row.id,row]));
 for await(const event of stagedRows(db,staging.id,"events"))validateSnapshotReferences({events:[event]},frozen);
 const badLinks=await statement(db,"SELECT COUNT(*) AS n FROM engine_restore_rows l LEFT JOIN engine_restore_rows f ON f.job_id=l.job_id AND f.table_name='files' AND f.row_id=json_extract(l.data,'$.file_id') WHERE l.job_id=? AND l.table_name='file_links' AND (f.row_id IS NULL OR json_extract(f.data,'$.state')!='ready')",staging.id).first();if(badLinks.n)throw Error("A file link has no verified file.");
 const needed=new Map(manifest.tables.files.filter(file=>file.state==="ready").map(file=>[file.id,file])),complete=new Set();let current=null,chunks=[],length=0,finished=false;
 for await(const entry of iterator){
  await staging.touch();
  if(finished)throw Error("Backup contains data after its completion marker.");
  if(entry.type==="file"){
   if(current||!needed.has(entry.id)||complete.has(entry.id))throw Error("Backup contains unexpected or duplicate file bytes.");const row=await statement(db,"SELECT data FROM engine_restore_rows WHERE job_id=? AND table_name='files' AND row_id=?",staging.id,entry.id).first();if(!row)throw Error("Backup file metadata is missing.");current=JSON.parse(row.data);chunks=[];length=0;
  }else if(entry.type==="bytes"){
   if(!current||typeof entry.data!=="string"||entry.data.length>262144)throw Error("Invalid file chunk.");
   const decoded=atob(entry.data),chunk=Uint8Array.from(decoded,char=>char.charCodeAt(0));length+=chunk.length;if(length>current.size||length>MAX_ENGINE_FILE)throw Error("File bytes exceed the declared size.");chunks.push(chunk);
  }else if(entry.type==="end_file"){
   if(!current||entry.id!==current.id||length!==current.size)throw Error("Backup file is incomplete.");const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
   if(await bytesHash(bytes)!==current.sha256)throw Error("A file failed its backup hash check.");
   await staging.touch({force:true});const key=storageKey(current);await assertStorageKeyWritable(db,key);const stored=await env.PHOTOS.put(key,bytes,{onlyIf:{etagDoesNotMatch:"*"},httpMetadata:{contentType:current.content_type},customMetadata:{sha256:current.sha256}});
   await assertStorageKeyWritable(db,key);
   if(!stored){const existing=await env.PHOTOS.head(key);if(existing?.customMetadata?.sha256!==current.sha256||existing.size!==current.size)throw new CommandConflict("The restore staging file differs. Retry with a new operation ID.");}
   const verified=await env.PHOTOS.get(key);
   if(!verified||verified.size!==current.size||await bytesHash(new Uint8Array(await verified.arrayBuffer()))!==current.sha256)throw Error("A staged restore file failed byte verification. No project was admitted.");
   complete.add(current.id);current=null;chunks=[];
  }else if(entry.type==="complete"){
   if(current||complete.size!==needed.size)throw Error("Backup is missing file bytes.");finished=true;
  }else throw Error("Unknown backup entry.");
 }
 if(!finished)throw Error("Backup is incomplete: no completion marker.");
 const fingerprint=await staging.seal(input.payload);
 const p=manifest.project,materialized=await materializeRestore(db,staging,projectId,owner.id,operationId,fingerprint,{name:asCopy?copyName:p.name,prefix:p.prefix,digits:p.digits,created_at:asCopy?new Date().toISOString():p.created_at});input.restoreJobId=materialized.id;
 // Every file and materialized row must match before the publication transaction.
 // Interrupted loading leaves a hidden copy that the exact operation can resume.
 const result=await commitProjectCommand(env.WORKSHOP_DB,input,w=>{
  w.require("EXISTS(SELECT 1 FROM engine_restore_jobs WHERE id=? AND project_id=? AND actor_id=? AND fingerprint=? AND state='ready' AND row_count=?)",materialized.id,projectId,owner.id,fingerprint,staging.rowCount);
  w.require("(SELECT COUNT(*) FROM engine_restore_rows WHERE job_id=?)=?",materialized.id,staging.rowCount);w.completeRestore(materialized.id);
  return {projectId,restored:true,...(asCopy?{asCopy:true,sourceProjectId:manifest.project.id}:{}),counts:staging.counts,verifiedFiles:complete.size,recovery:{stagingBatches:staging.batches,materializationBatches:materialized.batches,publicationStatements:3}};
 });
 await tryCompletedRestoreCleanup(db,cleanup);return result;
 }catch(error){
  // Another exact request may publish and clean staging after our initial replay
  // check. Its receipt wins over a resulting missing-row/conflict error.
  if(retryInput){const replay=await replayProjectCommand(env.WORKSHOP_DB,retryInput);if(replay){await tryCompletedRestoreCleanup(env.WORKSHOP_DB,cleanup);return replay.result;}}
  throw error;
 }finally{await iterator.return();}
}
