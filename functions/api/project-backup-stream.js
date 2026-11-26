import {normalizeOverview} from "../../assets/project-overview-model.js";
import {backupColumns,backupOutline} from "./project-backup-schema.js";
import {statement} from "./project-state.js";
import {validateSnapshotReferences,verifySnapshotValues} from "./project-snapshot-values.js";
import {bytesHash,MAX_ENGINE_FILE} from "./project-engine-files.js";
import {MAX_BACKUP_BYTES,MAX_METADATA_LINE} from "./project-backup-metadata.js";

// Bound each read by both rows and aggregate stored bytes. Keyset pages avoid
// loading an entire record/value table into the Worker's memory.
export async function* backupRows(db,projectId,table){
 const keys=backupColumns[table]?.split(" ");if(!keys)throw Error("Unsupported backup table.");
 const cost=keys.map(key=>`COALESCE(length(CAST(${key} AS BLOB)),0)`).join("+");let cursor="";
 for(;;){
  const result=(await statement(db,`SELECT * FROM (SELECT p.*,SUM(${cost}+512) OVER(ORDER BY id) AS _bytes,ROW_NUMBER() OVER(ORDER BY id) AS _position FROM (SELECT * FROM engine_${table} WHERE project_id=? AND id>? ORDER BY id LIMIT 500) p) WHERE _bytes<=524288 OR _position=1 ORDER BY id`,projectId,cursor).all()).results;
  if(!result.length)return;for(const row of result){cursor=row.id;delete row._bytes;delete row._position;yield row;}
 }
}
export async function smallBackup(db,projectId){
 const stats=await db.batch(Object.entries(backupColumns).map(([table,columns])=>statement(db,`SELECT COUNT(*) AS n,COALESCE(SUM(${columns.split(" ").map(key=>`COALESCE(length(CAST(${key} AS BLOB)),0)`).join("+")}),0) AS bytes FROM engine_${table} WHERE project_id=?`,projectId)));
 return stats.reduce((sum,row)=>sum+row.results[0].bytes*6+row.results[0].n*1024,0)<2*1024*1024;
}
export async function streamedExport(env,project,validateManifest){
 const db=env.WORKSHOP_DB,savedProject=Object.fromEntries(["id","owner_id","owner_name","overview","name","revision","prefix","digits","created_at"].map(key=>[key,key==="owner_name"?project[key]??"Ryan":project[key]])),outline=backupOutline(savedProject);
 const counts=await db.batch(Object.keys(backupColumns).map(table=>statement(db,`SELECT COUNT(*) AS n FROM engine_${table} WHERE project_id=?`,project.id)));
 if(counts.reduce((sum,result)=>sum+result.results[0].n,0)>100000)throw Error("This preview recovery supports at most 100,000 metadata rows.");
 // The topology/number/selection contract stays validated. Large evidence/value
 // tables are checked one row at a time during the streamed metadata pass.
 for(const table of ["items","occurrences","steps","records","selections","archive_groups","files","snapshot_values","media"])for await(const row of backupRows(db,project.id,table))outline.collect(table,row);
 validateManifest(outline.manifest);
 const frozen=new Map(outline.manifest.tables.snapshot_values.map(row=>[row.id,row]));
 for await(const event of backupRows(db,project.id,"events"))validateSnapshotReferences({events:[event]},frozen);
 const badLink=await statement(db,"SELECT COUNT(*) AS n FROM engine_file_links l LEFT JOIN engine_files f ON f.project_id=l.project_id AND f.id=l.file_id WHERE l.project_id=? AND (f.id IS NULL OR f.state!='ready')",project.id).first();if(badLink.n)throw Error("A file link has no verified file.");
 let total=0;const line=value=>{const bytes=new TextEncoder().encode(JSON.stringify(value)+"\n");if(bytes.length>MAX_METADATA_LINE+1)throw Error("Backup line is too large.");total+=bytes.length;if(total>MAX_BACKUP_BYTES)throw Error("Backup exceeds the supported 256 MB size.");return bytes;};
 async function* archive(){
  yield line({type:"manifest",manifest:{format:"building-schmidt-project",version:2,project:savedProject,tableNames:Object.keys(backupColumns)}});
  for(const table of Object.keys(backupColumns))for await(const row of backupRows(db,project.id,table)){
   if(table==="snapshot_values")await verifySnapshotValues([row]);yield line({type:"row",table,row});
  }
  yield line({type:"metadata_complete"});
  for await(const file of backupRows(db,project.id,"files"))if(file.state==="ready"){
   const object=await env.PHOTOS.get(file.r2_key);if(!object||object.size!==file.size||file.size>MAX_ENGINE_FILE)throw Error("A file is missing or too large; backup is incomplete.");
   const bytes=new Uint8Array(await object.arrayBuffer());if(await bytesHash(bytes)!==file.sha256)throw Error("A file failed verification; backup is incomplete.");yield line({type:"file",id:file.id});
   for(let offset=0;offset<bytes.length;offset+=196608){let text="";const chunk=bytes.subarray(offset,offset+196608);for(let start=0;start<chunk.length;start+=8192)text+=String.fromCharCode(...chunk.subarray(start,start+8192));yield line({type:"bytes",data:btoa(text)});}yield line({type:"end_file",id:file.id});
  }
  const current=await statement(db,"SELECT revision FROM engine_projects WHERE id=? AND owner_id=?",project.id,project.owner_id).first();if(current?.revision!==project.revision)throw Error("The project changed during export. Download a new backup after saving finishes.");yield line({type:"complete"});
 }
 const iterator=archive(),stream=new ReadableStream({async pull(controller){try{const next=await iterator.next();if(next.done)controller.close();else controller.enqueue(next.value);}catch(error){controller.error(error);}},async cancel(){await iterator.return();}});
 return new Response(stream,{headers:{"content-type":"application/x-ndjson","content-disposition":"attachment; filename=project-"+project.id+".bsproject","cache-control":"private, no-store","x-content-type-options":"nosniff"}});
}
