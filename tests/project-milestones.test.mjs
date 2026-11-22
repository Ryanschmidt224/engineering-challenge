import {provisionTestAccount} from "./helpers/accounts.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import {handleAccounts} from "../functions/api/accounts.js";
import {onRequest as handleProjects} from "../functions/api/projects.js";
import {handleProjectMilestones} from "../functions/api/project-milestones.js";
import "../assets/archive-layout.js";
import {readFileSync} from "node:fs";

const origin="https://milestones.test";
class Bucket{
 constructor(){this.data=new Map()}
 async get(key){const value=this.data.get(key);return value?{
  etag:value.etag,text:async()=>value.text
 }:null}
 async put(key,value,options={}){
  const prev=this.data.get(key);
  if(options.onlyIf?.etagDoesNotMatch==="*"&&prev)return null;
  if(options.onlyIf?.etagMatches&&prev?.etag!==options.onlyIf.etagMatches)return null;
  const entry={text:String(value),etag:crypto.randomUUID()};
  this.data.set(key,entry);return {etag:entry.etag};
 }
}
async function fixture(){
 const env={PHOTOS:new Bucket(),admin_password:"fixture-secret"};
 const request=(path,method="GET",body,cookie="",requestOrigin=origin)=>new Request(origin+path,{
  method,headers:{...(method!=="GET"?{origin:requestOrigin}:{}),
   ...(body?{"content-type":"application/json"}:{}),...(cookie?{cookie}:{})},
  ...(body?{body:JSON.stringify(body)}:{})
 });
 const register=await provisionTestAccount(request("/api/accounts","POST",{
  action:"register",email:"milestone-author@example.test",password:"valid-milestone-test-password"
 }),env);
 assert.equal(register.status,201);
 const owner=register.headers.get("set-cookie").split(";")[0];
 const created=await handleProjects({request:request("/api/projects","POST",{name:"Intent check"},owner),env});
 assert.equal(created.status,200);
 const id=(await created.json()).projects.find(p=>p.name==="Intent check").id;
 const url="/api/project-milestones?project="+id;
 const call=(method,body,cookie=owner,requestOrigin=origin)=>handleProjectMilestones(request(url,method,body,cookie,requestOrigin),env);
 return {call,env,id,owner,request,url};
}
const intent={action:"createIntent",expectedRevision:null,
 objective:"Launch a dart 50 feet",successCriteria:"10 consecutive shots at 50 feet",
 plan:"Two opposing flywheels"};
const milestone=(revision,overrides={})=>({action:"addMilestone",expectedRevision:revision,
 whatHappened:"Prototype launched dart 34 feet",
 significance:"Motor speed is insufficient to reach the original goal",...overrides});
const reply=async response=>({status:response.status,data:await response.json()});

test("initial project intent is immutable and milestones append only after deliberate saves",async()=>{
 const {call,env,id}=await fixture();
 const empty=await reply(await call("GET"));
 assert.deepEqual(empty.data,{originalIntent:null,milestones:[],revision:null});
 const created=await reply(await call("POST",intent));
 assert.equal(created.status,201);
 assert.ok(created.data.record.id);
 assert.ok(created.data.record.createdAt);
 const repeated=await reply(await call("POST",{...intent,expectedRevision:created.data.revision}));
 assert.equal(repeated.status,409);
 const recorded=await reply(await call("POST",milestone(created.data.revision)));
 assert.equal(recorded.status,201);
 assert.equal(recorded.data.record.sequence,1);
 const saved=await reply(await call("GET"));
 assert.equal(saved.data.originalIntent.successCriteria,"10 consecutive shots at 50 feet");
 assert.equal(saved.data.originalIntent.preExistingMilestones,0);
 assert.equal(saved.data.milestones.length,1);
 assert.equal(saved.data.milestones[0].significance,"Motor speed is insufficient to reach the original goal");
 const stored=JSON.parse(await (await env.PHOTOS.get("project-milestones/"+id+".json")).text());
 assert.equal(stored.originalIntent.id,created.data.record.id);
 assert.equal(stored.milestones[0].id,recorded.data.record.id);
 for(const method of ["PATCH","PUT","DELETE"]){
  assert.equal((await call(method,{action:"delete",id:recorded.data.record.id})).status,405);
 }
});

test("significance is required; no activity is automatically recorded; intent is optional",async()=>{
 const {call}=await fixture();
 const incomplete=await reply(await call("POST",milestone(null,{significance:""})));
 assert.equal(incomplete.status,400);
 const empty=await reply(await call("GET"));
 assert.equal(empty.data.milestones.length,0);
 const solo=await reply(await call("POST",milestone(null)));
 assert.equal(solo.status,201);
 const created=await reply(await call("POST",{
  action:"createIntent",expectedRevision:solo.data.revision,
  objective:"",successCriteria:"Visible proof of concept",plan:""
 }));
 assert.equal(created.status,201);
 const after=await reply(await call("GET"));
 assert.equal(after.data.milestones.length,1);
 assert.equal(after.data.originalIntent.objective,"");
 assert.equal(after.data.originalIntent.preExistingMilestones,1);
});

test("concurrent editors cannot silently overwrite a saved milestone",async()=>{
 const {call}=await fixture();
 const first=await reply(await call("POST",milestone(null)));
 assert.equal(first.status,201);
 assert.equal((await call("POST",milestone(null,{whatHappened:"Stale draft"}))).status,409);
 const second=await reply(await call("POST",milestone(first.data.revision,{whatHappened:"Second experiment"})));
 assert.equal(second.status,201);
 assert.equal((await reply(await call("GET"))).data.milestones.length,2);
});

test("cross-project access, unauthorized editing and cross-site writes are rejected",async()=>{
 const {call,env,id,request,url}=await fixture();
 assert.equal((await call("POST",milestone(null),"")).status,404);
 assert.equal((await call("POST",milestone(null),undefined,"https://another.site")).status,403);
 const unrelated=await handleProjectMilestones(request("/api/project-milestones?project=p00000000000000000000000000000000"),env);
 assert.equal(unrelated.status,404);
 const original=await reply(await call("GET"));
 assert.equal(original.data.originalIntent,null);
});

test("linked test/revision/failure and archive sources are verified in the same project",async()=>{
 const {call,env,id}=await fixture();
 const sourceId="a1414141-1111-4444-8888-141414141414";
 const archiveId="b2525252-2222-4444-8888-252525252525";
 const wrongId="c3636363-3333-4444-8888-363636363636";
 await env.PHOTOS.put("investigations/"+id+".json",JSON.stringify({records:[
  {id:sourceId,category:"test",title:"Flywheel speed test",ownerType:"assembly",ownerId:"__root__",stepId:"check"},
  {id:wrongId,category:"note",title:"Not a milestone source",ownerType:"assembly",ownerId:"__root__"}
 ]}));
 await env.PHOTOS.put("assembly-archives/"+id+"/manifests/"+archiveId+".json",JSON.stringify({
  id:archiveId,project:id,state:"archived",kind:"part",name:"Original flywheel",
  originPath:[{name:"Robot"},{name:"Launcher"},{name:"Original flywheel"}]
 }));
 const saved=await reply(await call("POST",milestone(null,{source:{kind:"investigation",id:sourceId}})));
 assert.equal(saved.status,201);
 assert.equal(saved.data.record.source.category,"test");
 assert.equal(saved.data.record.source.title,"Flywheel speed test");
 assert.equal(saved.data.record.source.ownerId,"__root__");
 const archive=await reply(await call("POST",milestone(saved.data.revision,{source:{kind:"archive",id:archiveId}})));
 assert.equal(archive.status,201);
 assert.equal(archive.data.record.source.category,"part");
 assert.deepEqual(archive.data.record.source.originPath,["Robot","Launcher","Original flywheel"]);
 assert.equal((await call("POST",milestone(archive.data.revision,{source:{kind:"investigation",id:wrongId}}))).status,400);
 assert.equal((await call("POST",milestone(archive.data.revision,{source:{kind:"archive",id:sourceId}}))).status,400);
 assert.equal((await reply(await call("GET"))).data.milestones.length,2);
});

test("milestones are included in project exports, never editable, and source UI is opt-in",()=>{
 assert.ok(globalThis.BSArchiveLayout.singles("launcher").includes("project-milestones/launcher.json"));
 const frontend=readFileSync(new URL("../assets/project-milestones.js",import.meta.url),"utf8");
 const tree=readFileSync(new URL("../assets/site-assembly.js",import.meta.url),"utf8");
 const entries=readFileSync(new URL("../assets/investigations.js",import.meta.url),"utf8");
 const index=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 assert.match(frontend,/Why is this significant to the project\?/);
 assert.match(frontend,/No original intent recorded/);
 assert.match(frontend,/const state=\{refresh,openMilestone/);
 assert.match(tree,/root\.querySelector\("\.assembly-archive-milestone-option"\)\?\.remove\(\)/);
 assert.match(entries,/btn\("Add to Project Milestones"/);
 assert.match(index,/assets\/project-milestones\.js/);
});
