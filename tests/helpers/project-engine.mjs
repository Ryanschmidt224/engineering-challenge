import assert from "node:assert/strict";
import {TestD1} from "./d1.mjs";
import {TestR2} from "./r2.mjs";
import {handleProjectWorkspace} from "../../functions/api/project-workspace-api.js";
export const engineOrigin="https://preview.example.test";
export async function engineFixture(){
 const db=new TestD1(),env={WORKSHOP_DB:db,PHOTOS:new TestR2()},owner={id:"fixture-owner"},projectId=crypto.randomUUID();let revision=null;
 async function call(path="",method="GET",data={},options={}){
  const input={...data,operationId:options.operationId||crypto.randomUUID(),expectedRevision:Object.hasOwn(options,"revision")?options.revision:revision};
  const response=await handleProjectWorkspace(new Request(engineOrigin+"/api/project-engine/projects/"+projectId+path,{method,headers:{origin:engineOrigin,"content-type":"application/json"},...(method!=="GET"?{body:JSON.stringify(input)}:{})}),env,options.owner||owner);
  const result=await response.json();if(response.ok&&result.revision)revision=result.revision;return {status:response.status,result};
 }
 assert.equal((await call("","POST",{name:"Mixed assembly",prefix:"MX",digits:3})).status,200);
 const add=async(name,{assembly=false,parent=null,quantity=1,...details}={})=>{const result=await call("/items","POST",{details:{name,...details,...(assembly?{is_assembly:true}:{})},parentId:parent,build:{quantity}});assert.equal(result.status,200,JSON.stringify(result));return result.result;};
 return {db,env,owner,projectId,call,add,revision:()=>revision};
}
