import {test} from "node:test";
import assert from "node:assert/strict";
import worker from "../worker.js";
import {TestD1} from "./helpers/d1.mjs";
import {TestR2} from "./helpers/r2.mjs";
import {provisionTestAccount} from "./helpers/accounts.mjs";
import {runPreviewAcceptance,verifyBindings,previewTransport,previewOrigin} from "../scripts/preview-acceptance.mjs";
const source="https://feature-proof-test-engineering-challenge.ryanschmidt224.workers.dev",target="https://preview-proof-test-engineering-challenge.ryanschmidt224.workers.dev",account="a".repeat(32),token="disposable-control-plane-test-token";
const databases=["3314f42f-7c04-4798-99dc-b5b97c4fb82f","d761ae08-64f2-4130-8cfa-f596e8e89b80"];
const bindings=id=>[{name:"WORKSHOP_DB",type:"d1",database_id:id},{name:"PHOTOS",type:"r2_bucket",bucket_name:"building-schmidt-photos-preview"},{name:"NEW_PROJECT_ENGINE",type:"plain_text",text:"1"}];
async function fixture(){
 const envs=[],cookies=[];for(const origin of [source,target]){
  const env={NEW_PROJECT_ENGINE:"1",WORKSHOP_DB:new TestD1(),PHOTOS:new TestR2(),CF_VERSION_METADATA:{id:crypto.randomUUID()},admin_password:"disposable-fixture-signing-secret"};envs.push(env);
  const response=await provisionTestAccount(new Request(origin+"/api/accounts",{method:"POST",headers:{origin},body:JSON.stringify({action:"register",email:"owner@example.test",password:"disposable-preview-test-password"})}),env,{role:"admin"});assert.equal(response.status,201);cookies.push(response.headers.get("set-cookie").split(";")[0]);
 }
 let unsafe=false,writes=0;
 const fetcher=async(url,options={})=>{
  const parsed=new URL(url),request=new Request(url,options);
  if(parsed.hostname==="api.cloudflare.com"){
   assert.equal(request.headers.get("authorization"),"Bearer "+token);const index=envs.findIndex(env=>parsed.pathname.endsWith("/"+env.CF_VERSION_METADATA.id));assert.notEqual(index,-1);
   return Response.json({success:true,result:{id:envs[index].CF_VERSION_METADATA.id,resources:{bindings:bindings(unsafe&&index===1?databases[0]:databases[index])}}});
  }
  assert.equal(request.headers.get("authorization"),null);
  if(parsed.hostname==="buildingschmidt.com")return worker.fetch(request,{...envs[0],NEW_PROJECT_ENGINE:undefined});
  const index=parsed.origin===source?0:parsed.origin===target?1:-1;assert.notEqual(index,-1);if(request.method!=="GET")writes++;
  return worker.fetch(request,envs[index],{waitUntil:promise=>promise.catch(()=>{})});
 };
 return {envs,options:{source,target,account,token,sourceCookie:cookies[0],targetCookie:cookies[1],fetcher},unsafe:()=>unsafe=true,writes:()=>writes,close:()=>envs.forEach(env=>env.WORKSHOP_DB.close())};
}
test("script verifies actual version bindings before running the same foundation, custom and assembly proofs with independent restore",async()=>{
 const f=await fixture();try{const result=await runPreviewAcceptance(f.options);assert.equal(result.ok,true);assert.equal(result.foundation.checks.length,7);assert.equal(result.proofs.length,2);for(const proof of result.proofs){assert.equal(proof.source.ok,true);assert.equal(proof.restore.ok,true);assert.equal(proof.sourceIntegrity.ok,true);assert.equal(proof.restore.targetWasAbsent,true);assert.equal(proof.source.backupSha256,proof.sourceIntegrity.backupSha256);assert.deepEqual(proof.source.counts,proof.restore.counts);}const json=JSON.stringify(result);for(const secret of [token,f.options.sourceCookie,f.options.targetCookie])assert.equal(json.includes(secret),false);}finally{f.close();}
});
test("acceptance requires both session cookies before any network request and never attempts password login",async()=>{
 let calls=0;const fetcher=async()=>{calls++;throw Error("No network request is allowed without both sessions.");};
 for(const cookies of [{},{sourceCookie:"source-only"},{targetCookie:"target-only"}])await assert.rejects(runPreviewAcceptance({source,target,account,token,fetcher,...cookies}),/session/);
 assert.equal(calls,0);
});
test("a same-database recovery binding rejects before any proof writes",async()=>{
 const f=await fixture();try{f.unsafe();await assert.rejects(runPreviewAcceptance(f.options),/D1 binding/);assert.equal(f.writes(),0);for(const env of f.envs)assert.equal(env.WORKSHOP_DB.sqlite.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name='engine_projects'").get().n,0);}finally{f.close();}
});
test("transport and binding checks refuse production destinations, cross-origin credentials, duplicate bindings and non-preview buckets",async()=>{
 assert.throws(()=>previewOrigin("https://buildingschmidt.com"));assert.throws(()=>previewOrigin(source+"/project.html"));
 let called=false;const transport=previewTransport(source,"disposable-cookie",async()=>{called=true;});await assert.rejects(transport(target+"/api/accounts"),/another origin/);assert.equal(called,false);
 const list=bindings(databases[0]);assert.deepEqual(verifyBindings({resources:{bindings:Object.fromEntries(list.map(({name,...binding})=>[name,binding]))}},databases[0]),{WORKSHOP_DB:databases[0],PHOTOS:"building-schmidt-photos-preview",NEW_PROJECT_ENGINE:"1"});
 assert.throws(()=>verifyBindings({resources:{bindings:[...list,list[0]]}},databases[0]),/duplicate/);list[1].bucket_name="building-schmidt-photos";assert.throws(()=>verifyBindings({resources:{bindings:list}},databases[0]),/R2 binding/);
});
