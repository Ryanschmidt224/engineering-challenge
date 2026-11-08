/* Portable, Cloudflare-independent local project store.
 * Only memory + WebCrypto are needed; use in a browser, desktop webview or Node.
 * Nothing is uploaded automatically. Call download() to persist changes.
 */
(function(root){
 "use strict";
 const safeKey=key=>typeof key==="string"&&key.length<=1000&&
  !/[\\\x00-\x1f\x7f]/.test(key)&&
  key.split("/").every(segment=>segment!==""&&segment!=="."&&segment!=="..");
 const allowed=(p,key)=>{if(!safeKey(key))return false;
  const dirs=[p+"/","assembly-pages/"+p+"/","workspaces/"+p+"/","part-workspaces/"+p+"/",
   "harnesses/"+p+"/","drawings/"+p+"/","component-thumbnails/"+p+"/",
   "part-files/"+p+"/","part-pages/"+p+"/"];
  const files=["trees/"+p+".json","components/"+p+".json",
   "libraries/wires.json","libraries/common-parts.json","libraries/purchased-parts.json"];
  return dirs.some(d=>key.startsWith(d))||files.includes(key);
 };
 const unpack=encoded=>{
  const binary=atob(encoded),bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  return bytes;
 };
 const pack=bytes=>{
  const size=32766;let result="";
  for(let i=0;i<bytes.length;i+=size){
   const chunk=bytes.subarray(i,i+size);let text="";
   for(const byte of chunk)text+=String.fromCharCode(byte);
   result+=btoa(text);
  }
  return result;
 };
 const digest=async bytes=>[...new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))]
  .map(x=>x.toString(16).padStart(2,"0")).join("");
 const encoder=new TextEncoder(),decoder=new TextDecoder();
 async function open(archive){
  if(!archive||archive.format!=="building-schmidt-project"||archive.schemaVersion!==1||
    typeof archive.projectId!=="string"||!Array.isArray(archive.objects)||
    archive.objectCount!==archive.objects.length||archive.objects.length>1500)
   throw Error("Unsupported project format");
  const project=archive.projectId,items=new Map();
  let size=0;
  for(const entry of archive.objects){
   if(!entry||typeof entry.key!=="string"||!allowed(project,entry.key)||items.has(entry.key)||
      !Number.isInteger(entry.size)||entry.size<0||entry.size>24*1024*1024||
      typeof entry.sha256!=="string"||! /^[a-f0-9]{64}$/.test(entry.sha256))
    throw Error("Invalid or duplicate project record");
   const bytes=unpack(entry.data);
   if(bytes.length!==entry.size||await digest(bytes)!==entry.sha256)
    throw Error("Project record checksum mismatch: "+entry.key);
   size+=bytes.length;
   if(size>72*1024*1024)throw Error("Project exceeds current local archive limit");
   items.set(entry.key,{bytes,contentType:entry.contentType||"application/octet-stream",
    httpMetadata:entry.httpMetadata||{},customMetadata:entry.customMetadata||{}});
  }
  if(size!==archive.totalBytes)throw Error("Project total size mismatch");
  const model=()=>root.BSEngineeringCore?.projectModel(project,new Map([...items].map(([key,x])=>[key,x.bytes])))||null;
  const get=key=>{
   const entry=items.get(key);return entry?entry.bytes.slice():null;
  };
  const getJson=key=>{
   const bytes=get(key);if(bytes===null)return null;
   return JSON.parse(decoder.decode(bytes));
  };
  const putBytes=(key,bytes,metadata={})=>{
   if(!allowed(project,key))throw Error("File must belong to this project");
   const data=bytes instanceof Uint8Array?bytes.slice():new Uint8Array(bytes);
   if(data.length>24*1024*1024)throw Error("File too large");
   items.set(key,{bytes:data,contentType:metadata.contentType||"application/octet-stream",
    httpMetadata:metadata.httpMetadata||{},customMetadata:metadata.customMetadata||{}});
  };
  const putJson=(key,value)=>{
   if(!key.endsWith(".json"))throw Error("Expected .json record");
   const prior=items.get(key);
   putBytes(key,encoder.encode(JSON.stringify(value)),{
    contentType:"application/json",httpMetadata:prior?.httpMetadata||{contentType:"application/json"},
    customMetadata:prior?.customMetadata||{}
   });
  };
  const exportArchive=async()=>{
   const objects=[],keys=[...items.keys()].sort();let totalBytes=0;
   for(const key of keys){
    const entry=items.get(key),bytes=entry.bytes;
    totalBytes+=bytes.length;
    if(totalBytes>72*1024*1024)throw Error("Project is too large for this export format");
    objects.push({key,size:bytes.length,sha256:await digest(bytes),contentType:entry.contentType,
     httpMetadata:entry.httpMetadata,customMetadata:entry.customMetadata,data:pack(bytes)});
   }
   return {format:"building-schmidt-project",schemaVersion:1,projectId:project,
    exportedAt:new Date().toISOString(),storage:"local-project",objectCount:objects.length,
    totalBytes,objects};
  };
  const download=async()=>{
   const archive=await exportArchive(),data=JSON.stringify(archive);
   const blob=new Blob([data],{type:"application/json"});
   const url=URL.createObjectURL(blob),a=document.createElement("a");
   a.href=url;a.download=project+"-local.bsproject";
   document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
  };
  return Object.freeze({projectId:project,keys:()=>[...items.keys()],get,getJson,putJson,putBytes,model,exportArchive,download});
 }
 root.BSLocalProject={open};
})(typeof globalThis!=="undefined"?globalThis:window);
