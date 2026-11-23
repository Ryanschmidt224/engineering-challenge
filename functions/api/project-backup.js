import {projectNumberKey} from "../../assets/project-item-model.js";
import {commitProjectCommand,replayProjectCommand,CommandConflict} from "./project-command.js";
import {statement,uuid} from "./project-state.js";
import {bytesHash,MAX_ENGINE_FILE} from "./project-engine-files.js";
// Explicit export schema: receipts and concurrency tokens are operational, not
// engineering history. Restore issues a new token and a new import receipt.
const columns={
 items:"id project_id name short_name part_number kind source is_tool fields created_at revision_level",
 occurrences:"id project_id item_id quantity unit build_status attention attention_note hidden sort_order removed_at removed_path",
 steps:"id project_id item_id title body sort_order retired_at retired_path created_at",
 configurations:"id project_id item_id fingerprint snapshot created_at",
 records:"id project_id item_id step_id configuration_id type title fields event_date step_snapshot created_at updated_at",
 events:"id project_id item_id type title summary payload created_at",
 files:"id project_id name content_type r2_key state size sha256 created_at",
 file_links:"id project_id file_id item_id record_id event_id configuration_id role active"
};
export async function projectManifest(db,project){
 const names=Object.keys(columns),result=await db.batch([statement(db,"SELECT * FROM engine_projects WHERE id=?",project.id),...names.map(name=>statement(db,`SELECT * FROM engine_${name} WHERE project_id=? ORDER BY id`,project.id))]);
 return {format:"building-schmidt-project",version:1,project:result[0].results[0],tables:Object.fromEntries(names.map((name,index)=>[name,result[index+1].results]))};
}
function base64(bytes){let text="";for(let start=0;start<bytes.length;start+=8192)text+=String.fromCharCode(...bytes.subarray(start,start+8192));return btoa(text);}
const line=value=>new TextEncoder().encode(JSON.stringify(value)+"\n");
export async function exportProject(env,project){
 const manifest=validateManifest(await projectManifest(env.WORKSHOP_DB,project),project.id);
 if(JSON.stringify({type:"manifest",manifest}).length>4*1024*1024)throw Error("Backup metadata exceeds this preview restore limit. Export was stopped before producing an incomplete backup.");
 async function* archive(){
  yield line({type:"manifest",manifest});
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
  const list=manifest.tables[name];if(!Array.isArray(list))throw Error("Backup is missing "+name+".");count+=list.length;if(count>10000)throw Error("This preview restore accepts at most 10,000 rows.");
  const ids=new Set();for(const row of list){if(!row||!uuid(row.id)||row.project_id!==projectId||ids.has(row.id)||Object.keys(row).some(key=>!allowed.split(" ").includes(key))||Object.values(row).some(value=>value!==null&&!["string","number"].includes(typeof value)))throw Error("Invalid or duplicate "+name+" row.");ids.add(row.id);}
 }
 const numbers=new Set();for(const item of manifest.tables.items){
  if(typeof item.part_number!=="string"||!item.part_number.trim()||item.part_number.length>80||numbers.has(projectNumberKey(item.part_number)))throw Error("Backup contains an invalid or reused part number.");numbers.add(projectNumberKey(item.part_number));
  if(item.revision_level!==undefined&&(!Number.isSafeInteger(item.revision_level)||item.revision_level<1))throw Error("Invalid part revision level in backup.");
 }
 const files=new Map(manifest.tables.files.map(file=>[file.id,file]));
 for(const file of files.values())if(!["prepared","ready"].includes(file.state)||file.state==="ready"&&(!Number.isInteger(file.size)||file.size<0||file.size>MAX_ENGINE_FILE||!/^[a-f0-9]{64}$/.test(file.sha256)))throw Error("Invalid file metadata in backup.");
 for(const link of manifest.tables.file_links)if(!files.has(link.file_id)||files.get(link.file_id).state!=="ready")throw Error("A file link has no verified file.");
 return manifest;
}
export async function restoreProject(request,env,owner,projectId){
 const operationId=request.headers.get("x-operation-id");if(!uuid(operationId)||request.headers.get("x-project-revision")!=="new")throw Error("Restore requires a new-project revision and operation ID.");
 const iterator=archiveLines(request),first=await iterator.next();if(first.value?.type!=="manifest")throw Error("Backup is missing its manifest.");
 const manifest=validateManifest(first.value.manifest,projectId),input={projectId,actorId:owner.id,operationId,expectedRevision:null,payload:{action:"restore-project",manifest}};
 const replay=await replayProjectCommand(env.WORKSHOP_DB,input);if(replay){await iterator.return();return replay.result;}
 if(await statement(env.WORKSHOP_DB,"SELECT id FROM engine_projects WHERE id=?",projectId).first()){await iterator.return();throw new CommandConflict("This project already exists. Restore into an empty preview target; existing data will not be replaced.");}
 const needed=new Map(manifest.tables.files.filter(file=>file.state==="ready").map(file=>[file.id,file])),complete=new Set();let current=null,chunks=[],length=0,finished=false;
 const storageKey=file=>"project-engine/restored/"+operationId+"/"+file.id;
 for await(const entry of iterator){
  if(finished)throw Error("Backup contains data after its completion marker.");
  if(entry.type==="file"){
   if(current||!needed.has(entry.id)||complete.has(entry.id))throw Error("Backup contains unexpected or duplicate file bytes.");current=needed.get(entry.id);chunks=[];length=0;
  }else if(entry.type==="bytes"){
   if(!current||typeof entry.data!=="string"||entry.data.length>262144)throw Error("Invalid file chunk.");
   const decoded=atob(entry.data),chunk=Uint8Array.from(decoded,char=>char.charCodeAt(0));length+=chunk.length;if(length>current.size||length>MAX_ENGINE_FILE)throw Error("File bytes exceed the declared size.");chunks.push(chunk);
  }else if(entry.type==="end_file"){
   if(!current||entry.id!==current.id||length!==current.size)throw Error("Backup file is incomplete.");const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
   if(await bytesHash(bytes)!==current.sha256)throw Error("A file failed its backup hash check.");
   const key=storageKey(current),stored=await env.PHOTOS.put(key,bytes,{onlyIf:{etagDoesNotMatch:"*"},httpMetadata:{contentType:current.content_type},customMetadata:{sha256:current.sha256}});
   if(!stored){const existing=await env.PHOTOS.head(key);if(existing?.customMetadata?.sha256!==current.sha256||existing.size!==current.size)throw new CommandConflict("The restore staging file differs. Retry with a new operation ID.");}
   const verified=await env.PHOTOS.get(key);
   if(!verified||verified.size!==current.size||await bytesHash(new Uint8Array(await verified.arrayBuffer()))!==current.sha256)throw Error("A staged restore file failed byte verification. No project was admitted.");
   complete.add(current.id);current=null;chunks=[];
  }else if(entry.type==="complete"){
   if(current||complete.size!==needed.size)throw Error("Backup is missing file bytes.");finished=true;
  }else throw Error("Unknown backup entry.");
 }
 if(!finished)throw Error("Backup is incomplete: no completion marker.");
 // Metadata becomes visible in one guarded transaction only after every file
 // hash passes. A failed import leaves only unreachable staging objects.
 return commitProjectCommand(env.WORKSHOP_DB,input,w=>{
  const p=manifest.project;w.insert("engine_projects",{id:projectId,owner_id:owner.id,name:p.name,prefix:p.prefix,digits:p.digits,revision:w.revision,created_at:p.created_at});
  for(const name of Object.keys(columns))for(const original of manifest.tables[name]){
   const row={...original};if(name==="files")row.r2_key=storageKey(row);w.insert("engine_"+name,row);
  }
  return {projectId,restored:true,counts:Object.fromEntries(Object.entries(manifest.tables).map(([name,list])=>[name,list.length])),verifiedFiles:complete.size};
 });
}
