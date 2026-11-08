import {isAdmin} from "./auth.js";
import {PROJECTS,inspectArchive,decodeBytes,encodeBytes,sha256} from "./project-archive.js";

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const idPattern=/^[0-9a-f-]{36}$/i;
const MAX_UPLOAD=100*1024*1024;
const prefix=(project,id)=>"recovery-staging/"+project+"/"+id+"/";
const objectKey=(root,key)=>root+"objects/"+encodeURIComponent(key);
async function readStage(bucket,project,id){
 const root=prefix(project,id),stored=await bucket.get(root+"manifest.json");
 if(!stored)throw Error("Recovery manifest missing");
 const manifest=JSON.parse(await stored.text());
 if(manifest.status!=="complete"||manifest.projectId!==project||!Array.isArray(manifest.objects))
  throw Error("Recovery manifest invalid");
 const objects=[];
 for(const entry of manifest.objects){
  const item=await bucket.get(objectKey(root,entry.key));
  if(!item)throw Error("Recovery item missing: "+entry.key);
  const bytes=new Uint8Array(await item.arrayBuffer());
  if(bytes.length!==entry.size||await sha256(bytes)!==entry.sha256)
   throw Error("Recovery checksum mismatch: "+entry.key);
  objects.push({...entry,data:encodeBytes(bytes)});
 }
 const archive={format:"building-schmidt-project",schemaVersion:1,projectId:project,
  exportedAt:manifest.sourceExportedAt,storage:"isolated-recovery-copy",
  objectCount:objects.length,totalBytes:manifest.totalBytes,objects};
 await inspectArchive(archive,project);
 return archive;
}
async function verifyStage(bucket,project,id){
 const root=prefix(project,id);
 const obj=await bucket.get(root+"manifest.json");
 if(!obj)return json({error:"No finalized recovery copy at this ID"},404);
 const manifest=JSON.parse(await obj.text());
 if(manifest.status!=="complete"||manifest.projectId!==project||!Array.isArray(manifest.objects))return json({error:"Invalid recovery manifest"},422);
 let count=0,total=0;
 for(const entry of manifest.objects){
  const stored=await bucket.get(objectKey(root,entry.key));
  if(!stored)return json({error:"Recovery copy missing "+entry.key},422);
  const bytes=new Uint8Array(await stored.arrayBuffer());
  if(bytes.length!==entry.size||await sha256(bytes)!==entry.sha256)return json({error:"Recovery copy checksum mismatch for "+entry.key},422);
  count++;total+=bytes.length;
 }
 if(total!==manifest.totalBytes||count!==manifest.objectCount)return json({error:"Incomplete recovery copy"},422);
 return json({ok:true,projectId:project,id,objectCount:count,totalBytes:total,mode:"isolated-recovery-copy",liveProjectModified:false});
}
export async function handleArchiveStaging(request,env){
 const u=new URL(request.url),project=u.searchParams.get("project"),id=u.searchParams.get("id");
 if(!PROJECTS.includes(project))return json({error:"Unknown project"},400);
 if(!await isAdmin(request,env))return json({error:"Administrator access required"},401);
 if(!env.PHOTOS)return json({error:"Storage unavailable"},503);
 if(request.method==="GET"){
  if(!idPattern.test(id||""))return json({error:"Valid recovery ID required"},400);
  if(u.searchParams.get("download")==="1"){
   try{
    const archived=await readStage(env.PHOTOS,project,id);
    return new Response(JSON.stringify(archived),{headers:{
     "content-type":"application/octet-stream",
     "content-disposition":"attachment; filename=\"recovery-"+project+"-"+id+".bsproject\"",
     "cache-control":"no-store","x-content-type-options":"nosniff"
    }});
   }catch(error){return json({error:String(error.message||error)},422)}
  }
  return verifyStage(env.PHOTOS,project,id);
 }
 if(request.method!=="POST")return json({error:"Method not allowed"},405);
 const size=Number(request.headers.get("content-length")||0);
 if(size>MAX_UPLOAD)return json({error:"Archive upload exceeds limit"},413);
 let archive;
 try{
  const body=await request.text();
  if(body.length>MAX_UPLOAD)return json({error:"Archive upload exceeds limit"},413);
  archive=JSON.parse(body);
  await inspectArchive(archive,project);
 }catch(error){return json({error:"Archive rejected: "+String(error.message||error)},422)}
 // Only create an isolated copy in a fresh random namespace. No live project
 // or global-library record is ever written or removed by this endpoint.
 const recoveryId=crypto.randomUUID(),root=prefix(project,recoveryId);
 const manifest={schemaVersion:1,projectId:project,status:"complete",
  sourceExportedAt:archive.exportedAt||null,createdAt:new Date().toISOString(),
  objectCount:archive.objectCount,totalBytes:archive.totalBytes,
  objects:archive.objects.map(({key,size,sha256,contentType,httpMetadata,customMetadata})=>({key,size,sha256,contentType,httpMetadata,customMetadata}))};
 try{
  for(const entry of archive.objects){
   await env.PHOTOS.put(objectKey(root,entry.key),decodeBytes(entry.data),{
    httpMetadata:{contentType:"application/octet-stream"},
    customMetadata:{originalKey:entry.key.slice(0,700)}
   });
  }
  // Manifest is a final commit marker. Interrupted staging is never reported
  // as successful; incomplete temporary objects do not replace any records.
  await env.PHOTOS.put(root+"manifest.json",JSON.stringify(manifest));
  const result=await verifyStage(env.PHOTOS,project,recoveryId);
  if(result.status!==200)return result;
  return json({ok:true,projectId:project,id:recoveryId,objectCount:manifest.objectCount,
   mode:"isolated-recovery-copy",liveProjectModified:false},201);
 }catch(error){
  return json({error:"Recovery copy incomplete. No live data was changed: "+String(error.message||error)},503);
 }
}
