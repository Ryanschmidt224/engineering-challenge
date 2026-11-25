import {exportProject} from "./project-backup.js";
import {projectEngineSchemaReady} from "./project-engine-migrations.js";

// Scheduled engine backups reuse the normal export stream unchanged. They are
// append-only: never overwritten, rotated or deleted here, and restored only
// through the normal "Restore project backup" copy flow.
export const ENGINE_BACKUP_PREFIX="automatic-backups/engine/";
const PART=8*1024*1024; // R2 multipart parts must be ≥5 MiB except the last.
const key=(projectId,date)=>ENGINE_BACKUP_PREFIX+projectId+"/"+date.toISOString().slice(0,19).replace(/:/g,"-")+"Z-"+crypto.randomUUID()+".bsproject";
const BACKUP_ID=/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z-[a-f0-9-]{36}$/;

async function latestBackup(photos,projectId){
 const prefix=ENGINE_BACKUP_PREFIX+projectId+"/";let cursor,latest=null;
 for(;;){
  const page=await photos.list({prefix,limit:1000,include:["customMetadata"],...(cursor?{cursor}:{})});
  for(const object of page.objects)if(!latest||object.key>latest.key)latest=object;
  if(!page.truncated)return latest;
  if(!page.cursor||page.cursor===cursor)throw Error("Backup listing is incomplete.");cursor=page.cursor;
 }
}

// Stream the export into R2 without holding the whole backup in memory. Small
// backups use one put; larger ones use multipart, aborted on any failure.
async function storeStream(photos,objectKey,stream,metadata){
 const reader=stream.getReader();let buffered=[],size=0,total=0,upload=null,parts=[];
 const take=()=>{const bytes=new Uint8Array(size);let at=0;for(const chunk of buffered){bytes.set(chunk,at);at+=chunk.length;}buffered=[];size=0;return bytes;};
 const options={httpMetadata:{contentType:"application/x-ndjson"},customMetadata:metadata};
 try{
  for(;;){
   const {done,value}=await reader.read();
   if(value){buffered.push(value);size+=value.length;total+=value.length;}
   while(size>=PART){
    const all=take(),part=all.subarray(0,PART),rest=all.subarray(PART);
    if(rest.length){buffered=[rest];size=rest.length;}
    upload||=await photos.createMultipartUpload(objectKey,options);
    parts.push(await upload.uploadPart(parts.length+1,part));
   }
   if(done)break;
  }
  if(!upload){
   const written=await photos.put(objectKey,take(),{...options,onlyIf:{etagDoesNotMatch:"*"}});
   if(written===null)throw Error("A backup with this name already exists; nothing was overwritten.");
  }else{
   if(size)parts.push(await upload.uploadPart(parts.length+1,take()));
   await upload.complete(parts);
  }
  return total;
 }catch(error){
  await reader.cancel().catch(()=>{});
  if(upload)await upload.abort().catch(()=>{});
  throw error;
 }
}

// Confirms the stored object is complete: exact size, the expected project
// manifest first, and the export's final "complete" marker last.
async function verifyStored(photos,objectKey,projectId,expectedSize){
 const head=await photos.head(objectKey);
 if(!head||head.size!==expectedSize)throw Error("The stored backup failed its size check.");
 const object=await photos.get(objectKey),reader=object.body.getReader(),decoder=new TextDecoder("utf-8",{fatal:true});
 let first=null,buffer="",last="";
 try{
  for(;;){
   const {done,value}=await reader.read();if(done)break;
   buffer+=decoder.decode(value,{stream:true});
   if(first===null){const at=buffer.indexOf("\n");if(at!==-1)first=buffer.slice(0,at);}
   const end=buffer.lastIndexOf("\n",buffer.length-2);if(end!==-1)buffer=buffer.slice(end+1);
  }
  buffer+=decoder.decode();last=buffer.trim();
 }finally{reader.releaseLock();}
 const manifest=first&&JSON.parse(first);
 if(manifest?.type!=="manifest"||!manifest.manifest)throw Error("The stored backup has no manifest.");
 if(manifest.manifest.project?.id!==projectId)throw Error("The stored backup names a different project.");
 if(JSON.parse(last||"null")?.type!=="complete")throw Error("The stored backup is incomplete.");
}

export async function backupEngineProjects(env,date=new Date()){
 // Dormant until the engine is enabled for this deployment and its schema is
 // current. Read-only check: a scheduled run never migrates storage.
 if(env.NEW_PROJECT_ENGINE!=="1"||!env.PHOTOS||!await projectEngineSchemaReady(env.WORKSHOP_DB))return [];
 const projects=(await env.WORKSHOP_DB.prepare("SELECT * FROM engine_projects WHERE restore_job_id IS NULL ORDER BY created_at,id").all()).results,summary=[];
 for(const project of projects){
  try{
   const previous=await latestBackup(env.PHOTOS,project.id);
   if(previous?.customMetadata?.revision===project.revision){summary.push({project:project.id,status:"unchanged",key:previous.key});continue;}
   const objectKey=key(project.id,date),response=await exportProject(env,project);
   const size=await storeStream(env.PHOTOS,objectKey,response.body,{project:project.id,revision:project.revision,backupDate:date.toISOString(),format:"bsproject"});
   await verifyStored(env.PHOTOS,objectKey,project.id,size);
   summary.push({project:project.id,status:"saved",key:objectKey,bytes:size});
  }catch(error){
   const reason=String(error?.message||error);console.error("Automatic engine backup failed",project.id,reason);
   summary.push({project:project.id,status:"failed",reason});
  }
 }
 return summary;
}

// Owner-only list and download, routed from the engine API (already behind
// the engine gate and owner sign-in). No delete or overwrite endpoint exists.
export async function automaticBackupsResponse(env,project,backupId=null){
 const prefix=ENGINE_BACKUP_PREFIX+project.id+"/";
 if(backupId!==null){
  if(!BACKUP_ID.test(backupId))return Response.json({error:"Invalid backup ID."},{status:400});
  const object=await env.PHOTOS.get(prefix+backupId+".bsproject");
  if(!object)return Response.json({error:"Backup not found."},{status:404});
  return new Response(object.body,{headers:{"content-type":"application/x-ndjson","content-disposition":"attachment; filename=\"project-"+project.id+"-"+backupId+".bsproject\"","cache-control":"private, no-store","x-content-type-options":"nosniff"}});
 }
 const backups=[];let cursor;
 for(;;){
  const page=await env.PHOTOS.list({prefix,limit:1000,include:["customMetadata"],...(cursor?{cursor}:{})});
  for(const object of page.objects)backups.push({id:object.key.slice(prefix.length).replace(/\.bsproject$/,""),date:object.customMetadata?.backupDate||null,size:object.size});
  if(!page.truncated)break;if(!page.cursor||page.cursor===cursor)throw Error("Backup listing is incomplete.");cursor=page.cursor;
 }
 backups.sort((a,b)=>b.id.localeCompare(a.id));
 return Response.json({backups,retention:"append-only",storage:"same Cloudflare R2 bucket"},{headers:{"cache-control":"private, no-store"}});
}
