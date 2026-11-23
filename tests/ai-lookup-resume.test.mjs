import {test} from "node:test";
import assert from "node:assert/strict";
import {TestR2} from "./helpers/r2.mjs";
import {provisionTestAccount} from "./helpers/accounts.mjs";
import worker from "../worker.js";
const origin="https://lookup.example.test";
const req=(cookie,body={partNumber:"2N7000"},requestOrigin=origin)=>new Request(origin+"/api/workshop-lookup",{method:"POST",headers:{origin:requestOrigin,...(cookie?{cookie}:{}),"content-type":"application/json"},body:JSON.stringify(body)});
async function fixture(){
 const env={PHOTOS:new TestR2(),admin_password:"synthetic-signing-secret",OPENAI_API_KEY:"synthetic-provider-key",AI_LOOKUP_ENABLED:"1"};const provision=await provisionTestAccount(new Request(origin+"/api/accounts",{method:"POST",headers:{origin},body:JSON.stringify({action:"register",email:"owner@example.test",password:"synthetic-owner-password"})}),env,{role:"admin"});
 return {env,cookie:provision.headers.get("set-cookie").split(";")[0]};
}
const answer=()=>Response.json({output:[{type:"message",content:[{type:"output_text",text:JSON.stringify({partNumber:"2N7000",name:"MOSFET",specs:[{name:"Offset",value:0},{name:"Insulated",value:false},{name:"Voltage",value:60,unit:"V"}]})}]}]});
test("explicitly enabled owner lookup reaches provider through Worker; anonymous and wrong-origin requests do not",async t=>{
 const {env,cookie}=await fixture();let calls=0;t.mock.method(globalThis,"fetch",async()=>{calls++;return answer();});
 assert.equal((await worker.fetch(req(),env,{})).status,401);assert.equal((await worker.fetch(req(cookie,undefined,"https://outsider.example.test"),env,{})).status,403);assert.equal(calls,0);
 const response=await worker.fetch(req(cookie),env,{});assert.equal(response.status,200);const result=await response.json();assert.equal(calls,1);assert.equal(result.needsReview,true);assert.deepEqual(result.research.specs.map(row=>row.value),["0","false","60"]);
 const extraction=new Request(origin+"/api/components/extract",{method:"POST",headers:{origin,cookie},body:"{}"});assert.equal((await worker.fetch(extraction,env,{})).status,503);assert.equal(calls,1);
 env.AI_LOOKUP_ENABLED="0";const paused=await worker.fetch(req(cookie),env,{});assert.equal(paused.status,503);assert.equal((await paused.json()).code,"AI_PAUSED");assert.equal(calls,1);
});
test("provider spending cap stops lookup with a useful error, no automatic retry and no secret in diagnostics",async t=>{
 const {env,cookie}=await fixture();let calls=0;const logs=[];t.mock.method(console,"error",(...args)=>logs.push(args.join(" ")));t.mock.method(globalThis,"fetch",async()=>{calls++;return Response.json({error:{code:"project_spend_limit_exceeded",message:"Do not log synthetic-provider-key"}},{status:429});});
 const response=await worker.fetch(req(cookie),env,{});assert.equal(response.status,429);assert.equal((await response.json()).code,"AI_SPEND_LIMIT");assert.equal(calls,1);assert.ok(logs.every(line=>!line.includes("synthetic-provider-key")));
});
test("concurrent requests cannot share the final daily lookup slot; paid failures also consume their reserved attempt",async t=>{
 const {env,cookie}=await fixture(),user=[...env.PHOTOS.objects.keys()].find(key=>key.startsWith("users/")).slice(6,-5),key="workshop-ai-lookup/"+user+"/"+new Date().toISOString().slice(0,10);await env.PHOTOS.put(key,"14");let calls=0;t.mock.method(console,"error",()=>{});t.mock.method(globalThis,"fetch",async()=>{calls++;return Response.json({error:{code:"invalid_api_key"}},{status:401});});
 const result=await Promise.all([worker.fetch(req(cookie),env,{}),worker.fetch(req(cookie),env,{})]);assert.deepEqual(result.map(row=>row.status).sort(),[429,503]);assert.equal(calls,1);assert.equal(await(await env.PHOTOS.get(key)).text(),"15");
 assert.equal((await worker.fetch(req(cookie),env,{})).status,429);assert.equal(calls,1);
});
test("missing preview key fails clearly before spending a lookup attempt",async t=>{
 const {env,cookie}=await fixture();delete env.OPENAI_API_KEY;t.mock.method(globalThis,"fetch",()=>{throw Error("Must not contact provider");});const response=await worker.fetch(req(cookie),env,{});assert.equal(response.status,503);assert.equal((await response.json()).code,"AI_NOT_CONFIGURED");assert.equal([...env.PHOTOS.objects.keys()].filter(key=>key.startsWith("workshop-ai-lookup/")).length,0);
});
