#!/usr/bin/env node
/* Lossless local archive repair/restore, independent of Cloudflare or browser.
 * Never overwrites an existing directory or project archive.
 * Usage:
 *   node scripts/project-archive-cli.mjs verify example.bsproject
 *   node scripts/project-archive-cli.mjs restore example.bsproject ./recovered-project
 *   node scripts/project-archive-cli.mjs pack ./recovered-project ./new-project.bsproject
 */
import {readFile,writeFile,mkdir,rename,stat,rm} from "node:fs/promises";
import {dirname,basename,resolve,join,sep} from "node:path";
import {createHash,randomUUID} from "node:crypto";

const MAX_BYTES=72*1024*1024,MAX_SINGLE=24*1024*1024,MAX_OBJECTS=1500;
const projects=new Set(["launcher","linear","robot","buck","motorlab","coiltest"]);
const forbidden=/[\\\x00-\x1f\x7f]/;
const isAllowed=(p,key)=>{
 if(typeof key!=="string"||!key||key.length>1000||forbidden.test(key)||
    !key.split("/").every(x=>x&&x!=="."&&x!==".."))return false;
 const prefixes=[p+"/","assembly-pages/"+p+"/","workspaces/"+p+"/","part-workspaces/"+p+"/",
  "harnesses/"+p+"/","drawings/"+p+"/","component-thumbnails/"+p+"/","part-files/"+p+"/","part-pages/"+p+"/"];
 const singles=["trees/"+p+".json","components/"+p+".json",
  "libraries/wires.json","libraries/common-parts.json","libraries/purchased-parts.json"];
 return prefixes.some(x=>key.startsWith(x))||singles.includes(key);
};
const hex=data=>createHash("sha256").update(data).digest("hex");
const strictDecode=encoded=>{
 if(typeof encoded!=="string"||encoded.length%4!==0||
   !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded))
  throw Error("Invalid base64 payload");
 const bytes=Buffer.from(encoded,"base64");
 if(bytes.toString("base64")!==encoded)throw Error("Noncanonical base64 payload");
 return bytes;
};
async function archiveFromFile(filename){
 const info=await stat(filename);
 if(info.size>MAX_BYTES*1.45)throw Error("Archive exceeds current size limit");
 return JSON.parse(await readFile(filename,"utf8"));
}
function validate(archive){
 if(!archive||archive.format!=="building-schmidt-project"||
    archive.schemaVersion!==1||!projects.has(archive.projectId)||
    !Array.isArray(archive.objects)||archive.objects.length>MAX_OBJECTS||
    archive.objectCount!==archive.objects.length)throw Error("Invalid archive manifest");
 const seen=new Set(),files=new Map();let total=0;
 for(const item of archive.objects){
  if(!item||!isAllowed(archive.projectId,item.key)||seen.has(item.key)||
     !Number.isInteger(item.size)||item.size<0||item.size>MAX_SINGLE||
     typeof item.sha256!=="string"||!/^[0-9a-f]{64}$/.test(item.sha256))
   throw Error("Invalid key, duplicate ID or metadata in archive");
  seen.add(item.key);
  const bytes=strictDecode(item.data);
  if(bytes.length!==item.size||hex(bytes)!==item.sha256)
   throw Error("Checksum or length mismatch: "+item.key);
  total+=bytes.length;if(total>MAX_BYTES)throw Error("Project exceeds archive limit");
  files.set(item.key,bytes);
 }
 if(total!==archive.totalBytes)throw Error("Archive total does not match object lengths");
 // File and directory conflicts cannot be recovered losslessly to a filesystem.
 for(const key of files.keys()){
  const parts=key.split("/");
  for(let i=1;i<parts.length;i++)if(files.has(parts.slice(0,i).join("/")))
   throw Error("Conflicting file/directory records: "+key);
 }
 return {files,projectId:archive.projectId,objectCount:seen.size,totalBytes:total};
}
async function exists(path){try{await stat(path);return true}catch(e){if(e.code==="ENOENT")return false;throw e}}
async function restore(filename,destination){
 const archive=await archiveFromFile(filename),verified=validate(archive);
 const target=resolve(destination);
 if(await exists(target))throw Error("Destination already exists; refusing overwrite: "+target);
 const root=dirname(target),tmp=join(root,"."+basename(target)+".restoring-"+randomUUID());
 await mkdir(root,{recursive:true});
 await mkdir(tmp,{recursive:false});
 try{
  const records=join(tmp,"records");
  for(const [key,bytes] of verified.files){
   const location=resolve(records,...key.split("/"));
   if(!location.startsWith(records+sep))throw Error("Unsafe recovered file path");
   await mkdir(dirname(location),{recursive:true});
   await writeFile(location,bytes,{flag:"wx"});
  }
  await writeFile(join(tmp,"source-archive.json"),JSON.stringify(archive),{flag:"wx"});
  await writeFile(join(tmp,"README.txt"),"Building Schmidt recovered project. Records are in ./records/. Use 'pack' to create a new .bsproject after local changes. Do not replace the source archive unless you have verified the new one.\n",{flag:"wx"});
  // Verify contents on disk before atomically publishing the new directory.
  for(const [key,bytes] of verified.files){
   const onDisk=await readFile(resolve(records,...key.split("/")));
   if(hex(onDisk)!==hex(bytes))throw Error("Recovered file did not verify: "+key);
  }
  if(await exists(target))throw Error("Destination appeared during restore; refusing overwrite");
  await rename(tmp,target);
  return verified;
 }catch(e){await rm(tmp,{recursive:true,force:true});throw e}
}
async function pack(source,destination){
 const root=resolve(source),target=resolve(destination);
 if(await exists(target))throw Error("Output already exists; refusing overwrite");
 const original=JSON.parse(await readFile(join(root,"source-archive.json"),"utf8"));
 validate(original);
 const items=[];let total=0;
 for(const item of original.objects){
  const location=resolve(root,"records",...item.key.split("/"));
  if(!location.startsWith(resolve(root,"records")+sep))throw Error("Invalid file path");
  const data=await readFile(location);
  if(data.length>MAX_SINGLE)throw Error("File exceeds archive limit: "+item.key);
  total+=data.length;if(total>MAX_BYTES)throw Error("Project too large");
  items.push({...item,size:data.length,sha256:hex(data),data:data.toString("base64")});
 }
 const archive={...original,exportedAt:new Date().toISOString(),storage:"local-files",
  totalBytes:total,objectCount:items.length,objects:items};
 validate(archive);
 await mkdir(dirname(target),{recursive:true});
 const tmp=target+".writing-"+randomUUID();
 try{
  await writeFile(tmp,JSON.stringify(archive),{flag:"wx"});
  validate(await archiveFromFile(tmp));
  if(await exists(target))throw Error("Output already exists; refusing overwrite");
  await rename(tmp,target);
 }catch(e){await rm(tmp,{force:true});throw e}
 return {projectId:archive.projectId,totalBytes:archive.totalBytes,objectCount:items.length};
}
async function main(){
 const [action,first,second]=process.argv.slice(2);
 if(!first||!["verify","restore","pack"].includes(action)||action!=="verify"&&!second){
  console.error("Usage: verify <archive> | restore <archive> <new directory> | pack <restored directory> <new archive>");
  process.exitCode=2;return;
 }
 const result=action==="verify"?validate(await archiveFromFile(first)):
  action==="restore"?await restore(first,second):await pack(first,second);
 console.log(JSON.stringify({ok:true,action,projectId:result.projectId,
  objects:result.objectCount,bytes:result.totalBytes,
  destination:action==="verify"?undefined:resolve(second)},null,2));
}
main().catch(error=>{console.error("Archive operation failed:",error.message);process.exitCode=1});
