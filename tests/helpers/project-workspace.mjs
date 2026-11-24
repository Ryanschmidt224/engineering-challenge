import assert from "node:assert/strict";
import {TestD1} from "./d1.mjs";
import {TestR2} from "./r2.mjs";
import {handleProjectWorkspace} from "../../functions/api/project-workspace-api.js";
const id=()=>crypto.randomUUID(),origin="https://preview.example.test";
export async function fixture(){
 const db=new TestD1(),env={WORKSHOP_DB:db,PHOTOS:new TestR2()},owner={id:"fixture-owner"},projectId=id();let revision=null;
 async function call(path="",method="GET",data={},options={}){
  const operationId=options.operationId||id(),expectedRevision=Object.hasOwn(options,"revision")?options.revision:revision;
  const body={...data,expectedRevision,operationId};
  const response=await handleProjectWorkspace(new Request(origin+"/api/project-engine/projects/"+projectId+path,{method,headers:{origin,"content-type":"application/json"},...(method!=="GET"?{body:JSON.stringify(body)}:{})}),env,options.owner||owner);
  const result=await response.json();if(response.ok&&result.revision)revision=result.revision;
  return {status:response.status,result,body};
 }
 const creation=await call("","POST",{name:"Bracket build"});assert.equal(creation.status,200);
 const details={name:"Bracket",fields:{specs:[{field_id:"thickness",label:"Thickness",value:3,unit:"mm"},{field_id:"zero",label:"Offset",value:0},{field_id:"false",label:"Coated",value:false},{field_id:"empty",label:"Finish",value:""},{field_id:"unset",label:"Tolerance"}]}};
 const part=await call("/items","POST",{details});assert.equal(part.status,200,JSON.stringify(part));
 return {db,env,owner,projectId,call,itemId:part.result.itemId,details,revision:()=>revision};
}
export const counts=async db=>({...await db.prepare("SELECT (SELECT COUNT(*) FROM engine_configurations) AS configurations,(SELECT COUNT(*) FROM engine_events) AS events,(SELECT COUNT(*) FROM engine_operations) AS receipts").first()});
export async function upload(f,name,bytes,role="engineering",options={}){
 const prepared=await f.call("/files/prepare","POST",{name,content_type:"application/octet-stream"});assert.equal(prepared.status,200,JSON.stringify(prepared));
 const fileId=prepared.result.fileId,operationId=id(),revision=f.revision();
 const raw=()=>new Request(origin+"/api/project-engine/projects/"+f.projectId+"/files/"+fileId+"/bytes",{method:"PUT",headers:{origin,"x-operation-id":operationId,"x-project-revision":revision},body:bytes});
 const send=()=>handleProjectWorkspace(raw(),f.env,f.owner),response=await send();assert.equal(response.status,200,await response.clone().text());
 assert.equal((await send()).status,200);
 if(options.stop)return {fileId,send,revision};
 const admitted=await f.call("/files/"+fileId+"/admit","POST",{role,...(role==="engineering"?{itemId:f.itemId}:{})});assert.equal(admitted.status,200,JSON.stringify(admitted));
 return {fileId,send,admitted};
}
