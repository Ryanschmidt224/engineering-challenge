// Operator/CI fixture only; scripts/ and tests/ are excluded from Worker assets.
// The database is always disposable in-memory SQLite, never a remote D1 handle.
import {fixture,upload} from "../tests/helpers/project-workspace.mjs";
import {exportProject} from "../functions/api/project-backup.js";

export async function makeCapacityFixture(recordCount){
 if(!Number.isInteger(recordCount)||recordCount<1||recordCount>10000)throw Error("Use 1–10,000 synthetic records.");
 const f=await fixture();
 try{
  const renamed=await f.call("","PATCH",{name:"Preview capacity "+recordCount+" records "+f.projectId.slice(0,8)});
  if(renamed.status!==200)throw Error("Local capacity fixture could not be named.");
  const drawing=await upload(f,"capacity-drawing.step",new Uint8Array(3*1024*1024).fill(65));
  for(let index=0;index<recordCount;index++){
   const result=await f.call("/items/"+f.itemId+"/records","POST",{record:{type:"note",title:"Capacity observation "+index,fields:{text:"Synthetic capacity observation "+index+" "+"n".repeat(600)}}});
   if(result.status!==200)throw Error("Local capacity fixture record creation failed.");
  }
  const project=(await f.call("/state")).result.project;
  const response=await exportProject(f.env,project),backup=await response.text();
  return {projectId:f.projectId,itemId:f.itemId,drawingId:drawing.fileId,recordCount,backup};
 }finally{f.db.close();}
}
