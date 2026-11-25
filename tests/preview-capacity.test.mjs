import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker.js";
import {TestD1} from "./helpers/d1.mjs";
import {TestR2} from "./helpers/r2.mjs";
import {provisionTestAccount} from "./helpers/accounts.mjs";
import {runPreviewCapacity} from "../scripts/preview-capacity.mjs";

const source="https://feature-capacity-test-engineering-challenge.ryanschmidt224.workers.dev",target="https://preview-capacity-test-engineering-challenge.ryanschmidt224.workers.dev",account="a".repeat(32),token="synthetic-capacity-control-plane-token";
async function platform(t){
 const envs=[],cookies=[];
 for(const origin of [source,target]){
  const env={NEW_PROJECT_ENGINE:"1",WORKSHOP_DB:new TestD1(),PHOTOS:new TestR2(),CF_VERSION_METADATA:{id:crypto.randomUUID()},admin_password:"synthetic-capacity-fixture-secret"};envs.push(env);t.after(()=>env.WORKSHOP_DB.close());
  const login=await provisionTestAccount(new Request(origin+"/api/accounts",{method:"POST",headers:{origin},body:JSON.stringify({action:"register",email:"owner@example.test",password:"synthetic-capacity-password"})}),env,{role:"admin"});
  cookies.push(login.headers.get("set-cookie").split(";")[0]);
 }
 let unsafe=false,writes=0;
 const fetcher=async(url,options={})=>{
  const parsed=new URL(url),request=new Request(url,options);
  if(parsed.hostname==="api.cloudflare.com"){
   assert.equal(request.headers.get("authorization"),"Bearer "+token);
   const index=envs.findIndex(env=>parsed.pathname.endsWith("/"+env.CF_VERSION_METADATA.id));assert.notEqual(index,-1);
   return Response.json({success:true,result:{id:envs[index].CF_VERSION_METADATA.id,resources:{bindings:[{name:"WORKSHOP_DB",type:"d1",database_id:unsafe||index===0?"3314f42f-7c04-4798-99dc-b5b97c4fb82f":"d761ae08-64f2-4130-8cfa-f596e8e89b80"},{name:"PHOTOS",type:"r2_bucket",bucket_name:"building-schmidt-photos-preview"},{name:"NEW_PROJECT_ENGINE",type:"plain_text",text:"1"}]}}});
  }
  assert.equal(request.headers.get("authorization"),null);
  if(parsed.hostname==="buildingschmidt.com")return worker.fetch(request,{...envs[0],NEW_PROJECT_ENGINE:undefined},{});
  const index=parsed.origin===source?0:parsed.origin===target?1:-1;assert.notEqual(index,-1);if(request.method!=="GET")writes++;
  const response=await worker.fetch(request,envs[index],{}),headers=new Headers(response.headers);headers.set("cf-ray","synthetic-platform-ray");
  return new Response(response.body,{status:response.status,headers});
 };
 return {envs,options:{source,target,account,token,sourceCookie:cookies[0],targetCookie:cookies[1],fetcher},unsafe(){unsafe=true;},writes:()=>writes};
}

test("capacity runner measures real handlers, six complete revisions and independent recovery without exposing credentials",async t=>{
 const f=await platform(t),checkpoints=[];
 const report=await runPreviewCapacity(f.options,{recordCounts:[3000],onCheckpoint:async value=>checkpoints.push(value.phase)});
 assert.equal(report.ok,true,JSON.stringify(report.failure));assert.equal(report.functionalAcceptance.ok,true);
 assert.equal(report.functionalAcceptance.legacyReadOnly.length,2);for(const check of report.functionalAcceptance.legacyReadOnly)assert.equal(check.rejectedStatus,409);
 const sample=report.scenarios[0];assert.equal(sample.ok,true);assert.equal(sample.recordCount,3000);assert.equal(sample.ordinarySaveSamplesMs.length,5);
 assert.equal(sample.revisionSamples.length,6);assert.equal(new Set(sample.revisionSamples.map(row=>row.snapshotSha256)).size,6);
 assert.ok(sample.frozenValueRows>=6000);assert.equal(sample.counts.records,3000);assert.equal(sample.restoreProof.counts.records,3000);
 assert.equal(sample.restoreProof.targetWasAbsent,true);assert.equal(sample.restoreProof.files[0].size,3*1024*1024);
 assert.equal(sample.restoreRequests.length,2);assert.ok(sample.restoreRequests[0].recovery.materializationBatches>1);
 assert.equal(sample.sourceIntegrity.backupSha256,sample.backupSha256);assert.ok(sample.firstRevisionRequestUpperBoundMs>=0);
 assert.ok(sample.requests.some(row=>row.phase==="revision-3000-1"&&row.cfRay==="synthetic-platform-ray"&&row.status===200));
 assert.ok(checkpoints.includes("scenario-passed-3000"));assert.match(report.productionReadiness,/Not decided/);
 const encoded=JSON.stringify(report);for(const secret of [token,f.options.sourceCookie,f.options.targetCookie])assert.equal(encoded.includes(secret),false);
 for(const env of f.envs)assert.equal(env.PHOTOS.uploads.size,0);
});

test("capacity runner refuses a shared recovery database before creating any proof projects",async t=>{
 const f=await platform(t);f.unsafe();const report=await runPreviewCapacity(f.options,{recordCounts:[1000]});
 assert.equal(report.ok,false);assert.equal(report.failure.phase,"preflight");assert.equal(report.scenarios.length,0);assert.equal(f.writes(),0);
 for(const env of f.envs)assert.equal(env.WORKSHOP_DB.sqlite.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='engine_projects'").get().n,0);
});

test("capacity startup failures and untrusted exception text never put credentials into a report",async()=>{
 const secrets=["sensitive-test-read-token","sensitive-source-session","sensitive-target-session"];let requests=0;
 const report=await runPreviewCapacity({source,target,account,token:secrets[0],sourceCookie:secrets[1],targetCookie:secrets[2],fetcher:async()=>{requests++;throw Error(secrets.join(" "));}},{recordCounts:[1000]});
 assert.equal(report.ok,false);assert.equal(requests,1);assert.equal(report.scenarios.length,0);
 for(const secret of secrets)assert.equal(JSON.stringify(report).includes(secret),false);
 const invalid=await runPreviewCapacity({source,target,account,fetcher:async()=>{throw Error("Must not call");}},{recordCounts:[10001]});
 assert.equal(invalid.ok,false);assert.equal(invalid.failure.phase,"preflight");
});
