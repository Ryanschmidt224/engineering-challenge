import {test} from "node:test";
import assert from "node:assert/strict";
import {issueNumber,numberingState} from "../functions/api/numbering.js";
class MemoryR2{
 constructor(){this.map=new Map()}
 async get(key){
  const entry=this.map.get(key);
  return entry?{etag:entry.etag,text:async()=>entry.value}:null;
 }
 async put(key,value,opts={}){
  const current=this.map.get(key),condition=opts.onlyIf||{};
  if(condition.etagMatches&&current?.etag!==condition.etagMatches)return null;
  if(condition.etagDoesNotMatch==="*"&&current)return null;
  const etag=crypto.randomUUID();this.map.set(key,{value,etag});return {etag};
 }
}
test("project numbering reserves numbers 001–099 for assemblies",async()=>{
 const env={PHOTOS:new MemoryR2()},project="launcher";
 assert.equal(await issueNumber(env,project,"assembly","assembly-a"),"NR001");
 assert.equal(await issueNumber(env,project,"assembly","assembly-b"),"NR002");
 assert.equal(await issueNumber(env,project,"part","part-a"),"NR100");
 assert.equal(await issueNumber(env,project,"part","part-b"),"NR101");
 assert.equal(await issueNumber(env,project,"part","part-a"),"NR100");
 await assert.rejects(issueNumber(env,project,"part","part-reserved","NR050"),/reserved for assemblies/);
 await assert.rejects(issueNumber(env,project,"assembly","assembly-invalid","NR103"),/between 1 and 99/);
 await assert.rejects(issueNumber(env,project,"part","part-duplicate","NR101"),/already assigned/);
 assert.equal(await issueNumber(env,project,"part","part-manual","NR140"),"NR140");
 assert.equal(await issueNumber(env,project,"part","part-after-manual"),"NR141");
 const state=await numberingState(env,project);
 assert.equal(state.data.nextAssembly,3);
 assert.equal(state.data.nextPart,142);
});
test("formatting changes affect new numbers but preserve previously issued numbers",async()=>{
 const env={PHOTOS:new MemoryR2()},project="launcher";
 const original=await issueNumber(env,project,"part","legacy");
 const key="project-numbering/"+project+".json";
 const state=await numberingState(env,project);
 state.data.prefix="PR";state.data.digits=5;
 await env.PHOTOS.put(key,JSON.stringify(state.data),{onlyIf:{etagMatches:state.etag}});
 assert.equal(await issueNumber(env,project,"part","legacy"),original);
 assert.equal(await issueNumber(env,project,"part","new"),"PR00101");
 assert.equal(await issueNumber(env,project,"assembly","first"),"PR00001");
});
test("simultaneous allocation never issues one number twice",async()=>{
 const env={PHOTOS:new MemoryR2()},project="launcher";
 const items=await Promise.allSettled(Array.from({length:16},(_,i)=>issueNumber(env,project,"part","parallel-"+i)));
 const assigned=items.filter(x=>x.status==="fulfilled").map(x=>x.value);
 assert.equal(new Set(assigned).size,assigned.length);
 assert.ok(assigned.length>0);
});


test("legacy part and assembly numbers cannot be duplicated",async()=>{
 const env={PHOTOS:new MemoryR2()},project="launcher";
 await env.PHOTOS.put("components/"+project+".json",JSON.stringify([
  {id:"legacy-part",name:"Imported CAD bracket",partNumber:"NR107"}
 ]));
 await env.PHOTOS.put("trees/"+project+".json",JSON.stringify([
  {id:"legacy-assembly",kind:"assembly",name:"Frame",partNumber:"NR003"}
 ]));
 await assert.rejects(issueNumber(env,project,"part","newpart","NR107"),/already assigned/);
 await assert.rejects(issueNumber(env,project,"assembly","newassembly","NR003"),/already assigned/);
 assert.equal(await issueNumber(env,project,"part","newpart","NR108"),"NR108");
 assert.equal(await issueNumber(env,project,"assembly","newassembly","NR004"),"NR004");
});
