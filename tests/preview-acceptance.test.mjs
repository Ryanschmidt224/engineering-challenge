import {test} from "node:test";
import assert from "node:assert/strict";
import worker from "../worker.js";
import {TestD1} from "./helpers/d1.mjs";
import {TestR2} from "./helpers/r2.mjs";
import {provisionTestAccount} from "./helpers/accounts.mjs";
import {runPreviewAcceptance,verifyBindings,previewTransport,previewOrigin,verifyLegacyReadOnly} from "../scripts/preview-acceptance.mjs";
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
   assert.equal(parsed.pathname,"/client/v4/accounts/"+account+"/workers/workers/engineering-challenge/previews/"+(index===0?"feature-proof-test":"preview-proof-test")+"/deployments/"+envs[index].CF_VERSION_METADATA.id);
   assert.equal(request.method,"GET");
   return Response.json({success:true,result:{id:envs[index].CF_VERSION_METADATA.id,limits:{cpu_ms:30000},env:Object.fromEntries(bindings(unsafe&&index===1?databases[0]:databases[index]).map(({name,...binding})=>[name,binding]))}});
  }
  assert.equal(request.headers.get("authorization"),null);
  if(parsed.hostname==="buildingschmidt.com")return worker.fetch(request,{...envs[0],NEW_PROJECT_ENGINE:undefined});
  const index=parsed.origin===source?0:parsed.origin===target?1:-1;assert.notEqual(index,-1);if(request.method!=="GET")writes++;
  return worker.fetch(request,envs[index],{waitUntil:promise=>promise.catch(()=>{})});
 };
 return {envs,options:{source,target,account,token,sourceCookie:cookies[0],targetCookie:cookies[1],fetcher},unsafe:()=>unsafe=true,writes:()=>writes,close:()=>envs.forEach(env=>env.WORKSHOP_DB.close())};
}
test("script verifies actual version bindings before running the same foundation, custom and assembly proofs with independent restore",async()=>{
 const f=await fixture();try{const result=await runPreviewAcceptance(f.options);assert.equal(result.ok,true);assert.deepEqual(result.deployments.map(row=>row.cpuLimitMs),[30000,30000]);assert.equal(result.foundation.checks.length,7);assert.equal(result.proofs.length,2);for(const proof of result.proofs){assert.equal(proof.source.ok,true);assert.equal(proof.restore.ok,true);assert.equal(proof.sourceIntegrity.ok,true);assert.equal(proof.restore.targetWasAbsent,true);assert.equal(proof.source.backupSha256,proof.sourceIntegrity.backupSha256);assert.deepEqual(proof.source.counts,proof.restore.counts);}const json=JSON.stringify(result);for(const secret of [token,f.options.sourceCookie,f.options.targetCookie])assert.equal(json.includes(secret),false);}finally{f.close();}
});
test("deployed legacy acceptance reads the catalog, rejects a harmless save and detects a missing server boundary",async()=>{
 const f=await fixture();try{
  const before=await f.envs[0].PHOTOS.list(),transport=previewTransport(source,f.options.sourceCookie,f.options.fetcher),report=await verifyLegacyReadOnly(transport);
  assert.equal(report.ok,true);assert.equal(report.rejectedStatus,409);assert.equal(report.code,"LEGACY_READ_ONLY");assert.match(report.catalogSha256,/^[a-f0-9]{64}$/);assert.deepEqual(await f.envs[0].PHOTOS.list(),before);
  const calls=[];await assert.rejects(verifyLegacyReadOnly(async(path,options={})=>{calls.push({path,...options});return options.method==="PATCH"?Response.json({error:"Invalid project request"},{status:400}):Response.json({readOnly:true,projects:[]});}),/save boundary/);
  assert.deepEqual(JSON.parse(calls[1].body),{visibility:"public"});assert.equal(calls.length,2);
 }finally{f.close();}
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
 const list=bindings(databases[0]);assert.deepEqual(verifyBindings({env:Object.fromEntries(list.map(({name,...binding})=>[name,binding]))},databases[0]),{WORKSHOP_DB:databases[0],PHOTOS:"building-schmidt-photos-preview",NEW_PROJECT_ENGINE:"1"});
 assert.throws(()=>verifyBindings({env:[...list,list[0]]},databases[0]),/duplicate/);list[1].bucket_name="building-schmidt-photos";assert.throws(()=>verifyBindings({env:list},databases[0]),/R2 binding/);
});

test("a missing or mismatched Preview deployment stops before proof writes without falling back to production versions",async()=>{
 for(const mode of ["missing","mismatched"]){
  const f=await fixture();let lookups=0;
  try{
   const fetcher=async(url,options={})=>{
    if(new URL(url).hostname!=="api.cloudflare.com")return f.options.fetcher(url,options);
    lookups++;assert.match(new URL(url).pathname,/\/previews\/feature-proof-test\/deployments\//);
    if(mode==="missing")return Response.json({errors:[{message:token}]},{status:404});
    const response=await f.options.fetcher(url,options),body=await response.json();
    body.result.id=crypto.randomUUID();return Response.json(body);
   };
   await assert.rejects(runPreviewAcceptance({...f.options,fetcher}),/Preview deployment verification failed/);
   assert.equal(lookups,1);assert.equal(f.writes(),0);
  }finally{f.close();}
 }
});
