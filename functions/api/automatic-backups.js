import {PROJECTS,exportProject,inspectArchive} from "./project-archive.js";
import {isAdmin} from "./auth.js";
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const backupPrefix="automatic-backups/";
const scopeKey=(project,id)=>backupPrefix+project+"/"+id+".bsproject";
const validId=s=>typeof s==="string"&&/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z-[a-f0-9-]{36}$/.test(s);
const isProjectRecord=(project,key)=>
 key.startsWith(project+"/")||
 ["assembly-pages/","workspaces/","part-workspaces/","harnesses/","drawings/","component-thumbnails/","part-files/","part-pages/"].some(prefix=>key.startsWith(prefix+project+"/"))||
 key==="trees/"+project+".json"||key==="components/"+project+".json";

/* Weekly append-only checkpoints inside private R2. These are not offsite
   backups and are not transactionally consistent during concurrent edits.
   Never rotate/delete backups automatically without an explicit policy. */
export async function backupAllProjects(env,date=new Date()){
 if(!env.PHOTOS)throw Error("R2 backup bucket unavailable");
 const summary=[];
 for(const project of PROJECTS){
  try{
   const archive=await exportProject(env.PHOTOS,project);
   if(!archive.objects.some(entry=>isProjectRecord(project,entry.key))){
    summary.push({project,status:"empty-project"});continue;
   }
   await inspectArchive(archive,project);
   const id=date.toISOString().slice(0,19).replace(/:/g,"-")+"Z-"+crypto.randomUUID();
   const key=scopeKey(project,id);
   const serialized=JSON.stringify(archive);
   await env.PHOTOS.put(key,serialized,{
    httpMetadata:{contentType:"application/octet-stream"},
    customMetadata:{project,objectCount:String(archive.objectCount),backupDate:date.toISOString()}
   });
   const stored=await env.PHOTOS.get(key);
   if(!stored||stored.size!==new TextEncoder().encode(serialized).length)
    throw Error("Stored backup failed size verification");
   summary.push({project,status:"saved",key,objects:archive.objectCount});
  }catch(error){
   const message=String(error?.message||error);
   console.error("Automatic project backup failed",project,message);
   summary.push({project,status:"failed",reason:message});
  }
 }
 return summary;
}
/* Operator-only listing and downloads. No delete or restore endpoint. */
export async function handleAutomaticBackups(request,env){
 const u=new URL(request.url),project=u.searchParams.get("project"),id=u.searchParams.get("id");
 if(!PROJECTS.includes(project))return json({error:"Unknown project"},400);
 if(!await isAdmin(request,env))return json({error:"Administrator access required"},401);
 if(!env.PHOTOS)return json({error:"Storage unavailable"},503);
 if(request.method!=="GET")return json({error:"Method not allowed"},405);
 if(id!==null){
  if(!validId(id))return json({error:"Invalid backup ID"},400);
  const archive=await env.PHOTOS.get(scopeKey(project,id));
  if(!archive)return json({error:"Backup not found"},404);
  return new Response(archive.body,{headers:{
   "content-type":"application/octet-stream",
   "content-disposition":"attachment; filename=\""+project+"-"+id+".bsproject\"",
   "cache-control":"no-store","x-content-type-options":"nosniff"
  }});
 }
 let cursor,entries=[];
 do{
  const result=await env.PHOTOS.list({prefix:backupPrefix+project+"/",limit:250,cursor,include:["customMetadata"]});
  entries.push(...result.objects.map(object=>({
   id:object.key.slice((backupPrefix+project+"/").length).replace(/\.bsproject$/,""),
   date:object.customMetadata?.backupDate||null,size:object.size,
   count:Number(object.customMetadata?.objectCount||0)
  })));
  if(!result.truncated)break;
  if(!result.cursor||result.cursor===cursor)return json({error:"Backup listing incomplete"},500);
  cursor=result.cursor;
 }while(entries.length<1500);
 entries.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
 return json({project,backups:entries,retention:"append-only",storage:"same Cloudflare R2 bucket"});
}
