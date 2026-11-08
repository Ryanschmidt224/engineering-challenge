import {isAdmin} from "./auth.js";

// Read-only, versioned export and validation-only import. No live record is modified.
// The first format is a lossless JSON envelope with base64 object bodies.
export const PROJECTS=Object.freeze(["launcher","linear","robot","buck","motorlab","coiltest"]);
export const ARCHIVE_FORMAT="building-schmidt-project";
export const ARCHIVE_VERSION=1;
const MAX_OBJECTS=1500;
const MAX_BYTES=72*1024*1024;
const MAX_SINGLE=24*1024*1024;
const json=(value,status=200)=>new Response(JSON.stringify(value),{
 status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}
});
const folders=project=>[
 project+"/",
 "assembly-pages/"+project+"/",
 "workspaces/"+project+"/",
 "part-workspaces/"+project+"/",
 "harnesses/"+project+"/",
 "drawings/"+project+"/",
 "component-thumbnails/"+project+"/"
];
const singles=project=>["trees/"+project+".json","components/"+project+".json",
 "libraries/wires.json","libraries/common-parts.json"];
export const isAllowedKey=(project,key)=>folders(project).some(x=>key.startsWith(x))||singles(project).includes(key);

async function listAll(r2,prefix){
 const keys=[],seen=new Set();
 let cursor,rounds=0;
 do{
  const page=await r2.list({prefix,limit:500,cursor,include:["customMetadata","httpMetadata"]});
  if(!page||!Array.isArray(page.objects))throw Error("Storage listing failed for "+prefix);
  for(const o of page.objects){
   if(seen.has(o.key))throw Error("Storage listing returned duplicate key: "+o.key);
   seen.add(o.key);keys.push(o.key);
  }
  if(!page.truncated)break;
  if(!page.cursor||page.cursor===cursor)throw Error("Storage pagination failed for "+prefix);
  cursor=page.cursor;
  if(++rounds>MAX_OBJECTS)throw Error("Storage listing exceeded safety limit");
 }while(true);
 return keys;
}
async function allKeys(r2,project){
 const keys=new Set();
 for(const prefix of folders(project)){
  for(const key of await listAll(r2,prefix)){
   if(!isAllowedKey(project,key))throw Error("Unexpected key in project storage");
   keys.add(key);
   if(keys.size>MAX_OBJECTS)throw Error("Too many project objects for a single export");
  }
 }
 for(const key of singles(project)){
  if(await r2.head(key))keys.add(key);
 }
 return [...keys].sort();
}
const toBase64=bytes=>{
 let out="";
 for(let i=0;i<bytes.length;i+=32768){
  const chunk=bytes.subarray(i,i+32768);
  let binary="";
  for(const n of chunk)binary+=String.fromCharCode(n);
  out+=btoa(binary);
 }
 // Chunkwise base64 is invalid without grouping lengths divisible by 3.
 return out;
};
const encodeBytes=bytes=>{
 const CHUNK=32766; // divisible by three: concatenated base64 chunks stay valid
 let out="";
 for(let i=0;i<bytes.length;i+=CHUNK){
  const piece=bytes.subarray(i,i+CHUNK);
  let ascii="";for(const n of piece)ascii+=String.fromCharCode(n);
  out+=btoa(ascii);
 }
 return out;
};
const decodeBytes=base64=>{
 if(typeof base64!=="string"||base64.length%4!==0||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64))throw Error("Invalid object encoding");
 const ascii=atob(base64),bytes=new Uint8Array(ascii.length);
 for(let i=0;i<ascii.length;i++)bytes[i]=ascii.charCodeAt(i);
 return bytes;
};
const sha256=async bytes=>{
 const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",bytes));
 return [...digest].map(b=>b.toString(16).padStart(2,"0")).join("");
};
const mimeFor=(key,object)=>{
 if(object?.httpMetadata?.contentType)return object.httpMetadata.contentType;
 if(key.endsWith(".json"))return "application/json";
 if(key.endsWith(".pdf"))return "application/pdf";
 if(key.endsWith(".png"))return "image/png";
 if(key.endsWith(".jpg"))return "image/jpeg";
 return "application/octet-stream";
};
async function exportProject(r2,project){
 const keys=await allKeys(r2,project),objects=[];
 let bytesTotal=0;
 for(const key of keys){
  const object=await r2.get(key);
  if(!object)throw Error("Object disappeared during export: "+key);
  if(object.size>MAX_SINGLE)throw Error("An object exceeds the archive limit: "+key);
  const bytes=new Uint8Array(await object.arrayBuffer());
  if(bytes.length!==object.size)throw Error("Object length changed during export: "+key);
  bytesTotal+=bytes.length;
  if(bytesTotal>MAX_BYTES)throw Error("Project exceeds the current single-download archive limit");
  objects.push({key,size:bytes.length,sha256:await sha256(bytes),
   contentType:mimeFor(key,object),
   customMetadata:object.customMetadata||{},data:encodeBytes(bytes)});
 }
 return {format:ARCHIVE_FORMAT,schemaVersion:ARCHIVE_VERSION,projectId:project,
  exportedAt:new Date().toISOString(),storage:"cloudflare-r2",objectCount:objects.length,
  totalBytes:bytesTotal,objects};
}
async function inspectArchive(archive,expectedProject){
 if(!archive||archive.format!==ARCHIVE_FORMAT||archive.schemaVersion!==ARCHIVE_VERSION||
    !PROJECTS.includes(archive.projectId)||archive.projectId!==expectedProject||
    !Array.isArray(archive.objects)||archive.objects.length>MAX_OBJECTS||
    archive.objectCount!==archive.objects.length)throw Error("Invalid or incompatible project archive");
 const seen=new Set();let total=0;
 for(const obj of archive.objects){
  if(!obj||typeof obj.key!=="string"||!isAllowedKey(expectedProject,obj.key)||
     seen.has(obj.key)||!Number.isInteger(obj.size)||obj.size<0||obj.size>MAX_SINGLE||
     typeof obj.sha256!=="string"||! /^[0-9a-f]{64}$/.test(obj.sha256)||
     typeof obj.contentType!=="string"||obj.contentType.length>150||
     !obj.customMetadata||typeof obj.customMetadata!=="object"||Array.isArray(obj.customMetadata))throw Error("Invalid archived object");
  seen.add(obj.key);total+=obj.size;
  if(total>MAX_BYTES)throw Error("Archive exceeds the safety limit");
  const data=decodeBytes(obj.data);
  if(data.length!==obj.size||await sha256(data)!==obj.sha256)throw Error("Archive checksum mismatch for "+obj.key);
 }
 if(total!==archive.totalBytes)throw Error("Archive total size mismatch");
 return {ok:true,mode:"inspect-only",projectId:expectedProject,schemaVersion:ARCHIVE_VERSION,
  objectCount:seen.size,totalBytes:total,includes:[...seen].filter(k=>k.startsWith("libraries/")),
  warning:"Verified archive only. No data has been restored or changed."};
}
export async function handleProjectArchive(request,env){
 const url=new URL(request.url),project=url.searchParams.get("project");
 if(!PROJECTS.includes(project))return json({error:"Unknown project"},400);
 if(!["GET","POST"].includes(request.method))return json({error:"Method not allowed"},405);
 if(!await isAdmin(request,env))return json({error:"Administrator access required to protect private project data"},401);
 if(!env.PHOTOS)return json({error:"Storage unavailable"},503);
 try{
  if(request.method==="GET"){
   const archive=await exportProject(env.PHOTOS,project);
   const filename="building-schmidt-"+project+"-"+new Date().toISOString().slice(0,10)+".bsproject";
   return new Response(JSON.stringify(archive),{headers:{
    "content-type":"application/vnd.buildingschmidt.project+json; charset=utf-8",
    "content-disposition":"attachment; filename=\""+filename+"\"",
    "cache-control":"no-store","x-content-type-options":"nosniff"
   }});
  }
  if(Number(request.headers.get("content-length")||0)>MAX_BYTES*1.45)return json({error:"Archive upload is too large"},413);
  const raw=await request.text();
  if(raw.length>MAX_BYTES*1.45)return json({error:"Archive upload is too large"},413);
  const archive=JSON.parse(raw);
  return json(await inspectArchive(archive,project));
 }catch(error){
  const msg=String(error?.message||"Archive failed");
  return json({error:msg},/size|large|limit|exceeds/i.test(msg)?413:422);
 }
}
