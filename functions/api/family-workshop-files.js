import {isAdmin} from "./auth.js";
import {initializeWorkshop,workshopSnapshot} from "./workshop-db.js";
import {validId} from "../../assets/family-model.js";
import {encodeBytes,sha256} from "./project-archive.js";
import {knowledgeSnapshot} from "./knowledge.js";
import {legacyProjectsReadOnly,legacyReadOnlyResponse} from "./legacy-projects.js";

const prefix="workshop-v2/files/",maxBytes=10*1024*1024;
const json=(data,status=200)=>Response.json(data,{status,headers:{"cache-control":"private, no-store","x-content-type-options":"nosniff"}});
const ownerTables={family:"workshop_families",product:"workshop_products",use:"workshop_uses"};
const extensions=new Set(["jpg","jpeg","png","gif","webp","heic","heif","pdf","dwg","dxf","sldprt","sldasm","step","stp","stl","iges","igs","3mf","zip","csv","txt"]);
async function access(request,env){
 if(!await isAdmin(request,env))return json({error:"Owner sign-in required"},401);
 if(request.method!=="GET"&&request.headers.get("origin")!==new URL(request.url).origin)return json({error:"Invalid request origin"},403);
 if(!env.WORKSHOP_DB||!env.PHOTOS)return json({error:"Workshop storage is not configured"},503);
 await initializeWorkshop(env.WORKSHOP_DB);return null;
}
export async function readWorkshopBytes(request,max=maxBytes){
 if(Number(request.headers.get("content-length"))>max)throw Error("File exceeds 10 MB");
 const reader=request.body?.getReader();if(!reader)throw Error("Choose a nonempty file");
 const chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw Error("File exceeds 10 MB");}chunks.push(value);}}
 finally{reader.releaseLock();}
 if(!size)throw Error("Choose a nonempty file");
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
}
export async function handleFamilyWorkshopFile(request,env){
 const denied=await access(request,env);if(denied)return denied;
 const url=new URL(request.url),id=url.searchParams.get("id");
 if(!validId(id))return json({error:"Invalid file or owner ID"},400);
 if(request.method==="GET"){
  const record=await env.WORKSHOP_DB.prepare("SELECT * FROM workshop_attachments WHERE id=?").bind(id).first();
  if(!record)return json({error:"File not found"},404);
  if(record.url)return Response.redirect(record.url,302);
  const object=await env.PHOTOS.get(record.r2_key);if(!object)return json({error:"File bytes are missing"},404);
  const inline=["image/png","image/jpeg","image/webp","image/gif"].includes(record.media_type);
  return new Response(object.body,{headers:{"content-type":inline?record.media_type:"application/octet-stream","content-disposition":(inline?"inline":"attachment")+"; filename*=UTF-8''"+encodeURIComponent(record.title),"cache-control":"private, no-store","x-content-type-options":"nosniff","content-security-policy":"default-src 'none'; sandbox"}});
 }
 if(request.method!=="POST")return json({error:"Method not allowed"},405);
 const owner=url.searchParams.get("owner");
 if(owner==="use"&&legacyProjectsReadOnly(env))return legacyReadOnlyResponse();
 if(!ownerTables[owner])return json({error:"Choose a family, product or use"},400);
 if(!await env.WORKSHOP_DB.prepare("SELECT id FROM "+ownerTables[owner]+" WHERE id=? AND archived=0").bind(id).first())return json({error:"Save the record before uploading files"},404);
 let name,bytes;
 try{name=decodeURIComponent(request.headers.get("x-file-name")||"");}catch{return json({error:"Invalid filename"},400);}
 if(!name||name.length>180||/[\\/\x00-\x1f]/.test(name))return json({error:"Invalid filename"},400);
 const extension=name.split(".").at(-1).toLowerCase();if(!extensions.has(extension))return json({error:"Choose an image, PDF, CAD, text, CSV or ZIP file"},415);
 try{bytes=await readWorkshopBytes(request);}catch(error){return json({error:error.message},413);}
 const signature=String.fromCharCode(...bytes.subarray(0,12));let mediaType="application/octet-stream";
 if(["jpg","jpeg"].includes(extension)&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)mediaType="image/jpeg";
 else if(extension==="png"&&signature.startsWith("\x89PNG\r\n\x1a\n"))mediaType="image/png";
 else if(extension==="gif"&&/^GIF8[79]a/.test(signature))mediaType="image/gif";
 else if(extension==="webp"&&signature.startsWith("RIFF")&&signature.slice(8)==="WEBP")mediaType="image/webp";
 else if(["jpg","jpeg","png","gif","webp"].includes(extension))return json({error:"Image contents do not match its filename"},415);
 const attachmentId=crypto.randomUUID(),key=prefix+attachmentId;
 const saved=await env.PHOTOS.put(key,bytes,{onlyIf:{etagDoesNotMatch:"*"},httpMetadata:{contentType:mediaType},customMetadata:{filename:name}});
 if(saved===null)return json({error:"Upload ID collision. Try again."},409);
 // The immutable bytes are written first. A metadata failure leaves a recoverable
 // orphan included in Workshop exports, never a record pointing at missing bytes.
 await env.WORKSHOP_DB.prepare("INSERT INTO workshop_attachments(id,"+owner+"_id,kind,title,r2_key,media_type,size) VALUES(?,?,?,?,?,?,?)").bind(attachmentId,id,mediaType.startsWith("image/")?"photo":"document",name,key,mediaType,bytes.length).run();
 return json({id:attachmentId,title:name},201);
}
export async function handleWorkshopExport(request,env){
 const denied=await access(request,env);if(denied)return denied;
 if(request.method!=="GET")return json({error:"Method not allowed"},405);
 // Version 2 adds Knowledge tiles and links to the catalog. Never omit stored data.
 const knowledge=await knowledgeSnapshot(env.WORKSHOP_DB);
 const catalog={...await workshopSnapshot(env.WORKSHOP_DB),knowledge_tiles:knowledge.tiles,knowledge_links:knowledge.links},objects=[];let cursor;
 do{
  const page=await env.PHOTOS.list({prefix,cursor,limit:500});objects.push(...page.objects);
  if(objects.length>10000)return json({error:"Use an operator-level export for more than 10,000 files"},413);
  if(!page.truncated)break;
  if(!page.cursor||page.cursor===cursor)return json({error:"File listing was incomplete; no export was created"},503);cursor=page.cursor;
 }while(true);
 const objectKeys=new Set(objects.map(object=>object.key));
 if(catalog.attachments.some(file=>file.r2_key&&!objectKeys.has(file.r2_key)))return json({error:"An attachment's bytes are missing. Repair it before creating a backup."},409);
 const encoder=new TextEncoder();let totalBytes=0;
 const lines=(async function*(){
  yield {type:"header",format:"buildingschmidt-workshop",version:2,createdAt:new Date().toISOString()};
  yield {type:"catalog",data:catalog};
  for(const entry of objects){
   const object=await env.PHOTOS.get(entry.key);if(!object)throw Error("A file disappeared during export");
   const bytes=new Uint8Array(await object.arrayBuffer());totalBytes+=bytes.length;
   yield {type:"file",key:entry.key,size:bytes.length,sha256:await sha256(bytes),httpMetadata:object.httpMetadata||{},customMetadata:object.customMetadata||{}};
   // Bounded chunks keep large backups from accumulating in the Worker heap.
   for(let offset=0;offset<bytes.length;offset+=196608)yield {type:"data",key:entry.key,offset,data:encodeBytes(bytes.subarray(offset,offset+196608))};
   yield {type:"file-end",key:entry.key};
  }
  yield {type:"complete",fileCount:objects.length,totalBytes};
 })();
 const stream=new ReadableStream({async pull(controller){try{const next=await lines.next();if(next.done)controller.close();else controller.enqueue(encoder.encode(JSON.stringify(next.value)+"\n"));}catch(error){controller.error(error);}},async cancel(){await lines.return();}});
 return new Response(stream,{headers:{"content-type":"application/x-ndjson","content-disposition":"attachment; filename=BuildingSchmidt-Workshop.ndjson","cache-control":"private, no-store","x-content-type-options":"nosniff"}});
}
