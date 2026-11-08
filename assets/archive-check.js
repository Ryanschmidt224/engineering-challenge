/* Browser-only integrity validation of Building Schmidt archives.
 * No requests or uploads: project data stays on the user's computer. */
(function(){
 "use strict";
 const MAX_OBJECTS=1500,MAX_TOTAL=72*1024*1024,MAX_SINGLE=24*1024*1024;
 const supported=new Set(["launcher","linear","robot","buck","motorlab","coiltest"]);
 const safeKey=key=>typeof key==="string"&&key.length<=1000&&
  !/[\\\x00-\x1f\x7f]/.test(key)&&
  key.split("/").every(segment=>segment!==""&&segment!=="."&&segment!=="..");
 const allowed=(project,key)=>safeKey(key)&&[
  project+"/","assembly-pages/"+project+"/","workspaces/"+project+"/",
  "part-workspaces/"+project+"/","harnesses/"+project+"/","drawings/"+project+"/",
  "component-thumbnails/"+project+"/",
  "part-files/"+project+"/","part-pages/"+project+"/"
 ].some(prefix=>key.startsWith(prefix))||
 ["trees/"+project+".json","components/"+project+".json","libraries/wires.json","libraries/common-parts.json","libraries/purchased-parts.json"].includes(key);
 async function inspect(file,project){
  if(!supported.has(project))throw Error("Unknown project");
  if(!window.crypto?.subtle)throw Error("A secure browser connection is required for checksum verification");
  if(file.size>MAX_TOTAL*1.45)throw Error("Archive exceeds the current size limit");
  const archive=JSON.parse(await file.text());
  if(archive.format!=="building-schmidt-project"||archive.schemaVersion!==1||
     archive.projectId!==project||!Array.isArray(archive.objects)||
     archive.objects.length>MAX_OBJECTS||archive.objectCount!==archive.objects.length)
   throw Error("This is not a supported archive for the current project");
  const seen=new Set();let total=0;
  for(const entry of archive.objects){
   if(typeof entry.key!=="string"||!allowed(project,entry.key)||seen.has(entry.key)||
      !Number.isInteger(entry.size)||entry.size<0||entry.size>MAX_SINGLE||
      typeof entry.sha256!=="string"||! /^[a-f0-9]{64}$/.test(entry.sha256)||
      typeof entry.data!=="string")throw Error("Invalid archive item");
   seen.add(entry.key);
   total+=entry.size;if(total>MAX_TOTAL)throw Error("Archive exceeds the current size limit");
   let binary;
   try{binary=atob(entry.data)}catch{throw Error("Invalid encoded item: "+entry.key)}
   if(binary.length!==entry.size)throw Error("Item length mismatch: "+entry.key);
   const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
   const digest=new Uint8Array(await window.crypto.subtle.digest("SHA-256",bytes));
   const checksum=[...digest].map(n=>n.toString(16).padStart(2,"0")).join("");
   if(checksum!==entry.sha256)throw Error("Checksum mismatch: "+entry.key);
  }
  if(total!==archive.totalBytes)throw Error("Archive size total does not match");
  return {projectId:project,objectCount:seen.size,totalBytes:total};
 }
 window.BSArchiveCheck={inspect};
})();