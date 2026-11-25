import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker.js";
import {TestR2} from "./helpers/r2.mjs";
import {TestD1} from "./helpers/d1.mjs";
import {provisionTestAccount} from "./helpers/accounts.mjs";
import {workshopSnapshot} from "../functions/api/workshop-db.js";

const origin="https://readonly.example.test";
async function fixture(t){
 const env={PHOTOS:new TestR2(),WORKSHOP_DB:new TestD1(),admin_password:"synthetic-readonly-secret"};
 t.after(()=>env.WORKSHOP_DB.close());
 const login=await provisionTestAccount(new Request(origin+"/api/accounts",{method:"POST",headers:{origin},body:JSON.stringify({action:"register",email:"owner@example.test",password:"synthetic-test-password"})}),env,{role:"admin"});
 const cookie=login.headers.get("set-cookie").split(";")[0];
 const call=(path,method="GET",body,headers={})=>worker.fetch(new Request(origin+path,{method,headers:{origin,cookie,"content-type":"application/json",...headers},...(body!==undefined?{body:typeof body==="string"?body:JSON.stringify(body)}:{})}),env,{});
 return {env,call};
}
const storedBytes=env=>[...env.PHOTOS.objects].map(([key,value])=>[key,[...value.bytes],value.etag]);

test("engine activation blocks legacy mutations before any project or file write, including old-tab retries",async t=>{
 const {env,call}=await fixture(t);env.NEW_PROJECT_ENGINE="1";
 const paths=["projects","numbering","tree","wires","harness","workspace","components","components/photo","part-files","project-files","part-pages","part-code","unstructured-notes","investigations","assembly-archive","project-milestones","recipe-files","photo-annotations","project/archive","project/staging","project/backups","drawings","photos","photo"];
 const before=storedBytes(env);
 for(const path of paths)for(const method of ["POST","PUT","PATCH","DELETE"]){
  for(let attempt=0;attempt<2;attempt++){
   const response=await call("/api/"+path+"?project=launcher",method,{});
   assert.equal(response.status,409,method+" "+path);
   assert.equal((await response.json()).code,"LEGACY_READ_ONLY");
   assert.match(response.headers.get("cache-control"),/no-store/);
  }
 }
 assert.deepEqual(storedBytes(env),before);
 assert.equal(env.WORKSHOP_DB.sqlite.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table'").get().n,0);
 // The private boundary still runs first; read-only mode is not an auth bypass.
 assert.equal((await call("/api/tree?project=launcher","PUT",{}, {cookie:""})).status,401);
 assert.equal((await call("/api/tree?project=launcher","PUT",{}, {origin:"https://other.example.test"})).status,403);
});

test("legacy reads and exports preserve exact Practice records and all stored source bytes",async t=>{
 const {env,call}=await fixture(t);
 const record={id:"old-practice",category:"practice",title:"Keep this evidence",scope:"step",ownerType:"assembly",ownerId:"__root__",stepId:"s",entries:[{id:"old-entry",type:"attempt",text:"Original result",files:[]}]};
 const raw=JSON.stringify({records:[record],revision:"old-revision"},null,2);
 await env.PHOTOS.put("investigations/launcher.json",raw);
 await env.PHOTOS.put("trees/launcher.json",JSON.stringify([{id:"old-assembly",name:"Original assembly",parentId:null}]));
 const partId=crypto.randomUUID(),fileId=crypto.randomUUID(),drawing=new Uint8Array([0,255,42,10,13]);
 await env.PHOTOS.put("components/launcher.json",JSON.stringify([{id:partId,name:"Legacy bracket"}]));
 await env.PHOTOS.put("part-files/launcher/"+partId+"/"+fileId+".step",drawing,{customMetadata:{filename:"original.step"}});
 env.NEW_PROJECT_ENGINE="1";const before=storedBytes(env);
 const catalog=await (await call("/api/projects")).json();assert.equal(catalog.readOnly,true);assert.equal(catalog.projects.length,3);
 const history=await call("/api/investigations?project=launcher");assert.equal(history.status,200);
 assert.deepEqual((await history.json()).records,[record]);
 assert.equal((await call("/api/tree?project=launcher")).status,200);
 const download=await call("/api/part-files?project=launcher&id="+partId+"&file="+fileId);assert.equal(download.status,200);
 assert.deepEqual(new Uint8Array(await download.arrayBuffer()),drawing);
 const exported=await call("/api/project/archive?project=launcher");assert.equal(exported.status,200);await exported.arrayBuffer();
 assert.equal(await (await env.PHOTOS.get("investigations/launcher.json")).text(),raw);
 assert.deepEqual(storedBytes(env),before,"GET must not upgrade Practice records or create migration backups");
});

test("Workshop remains editable while legacy uses and use-owned attachments cannot change",async t=>{
 const {env,call}=await fixture(t);await call("/api/workshop");
 const use={id:crypto.randomUUID(),project_id:"launcher",family_id:"f-resistor",purpose:"Original use",quantity:1,unit:"pcs",field_values:{}};
 const attachment={id:crypto.randomUUID(),owner_type:"use",owner_id:use.id,title:"Original link",url:"https://example.test/reference"};
 assert.equal((await call("/api/workshop","POST",{entity:"use",record:use,expectedRevision:null,expectedFamilyRevision:1})).status,200);
 assert.equal((await call("/api/workshop","POST",{entity:"attachment",record:attachment,expectedRevision:null})).status,200);
 const before=await workshopSnapshot(env.WORKSHOP_DB),bytes=storedBytes(env);env.NEW_PROJECT_ENGINE="1";
 for(const [method,input] of [
  ["POST",{entity:"use",record:{...use,purpose:"Must not save"},expectedRevision:1,expectedFamilyRevision:1}],
  ["PATCH",{entity:"use",id:use.id,archived:true,expectedRevision:1}],
  ["POST",{entity:"attachment",record:{...attachment,id:crypto.randomUUID()},expectedRevision:null}],
  ["POST",{entity:"attachment",record:{...attachment,owner_type:"family",owner_id:"f-resistor"},expectedRevision:1}],
  ["PATCH",{entity:"attachment",id:attachment.id,archived:true,expectedRevision:1}]
 ]){
  const response=await call("/api/workshop",method,input);assert.equal(response.status,409);assert.equal((await response.json()).code,"LEGACY_READ_ONLY");
 }
 const deniedUpload=await call("/api/workshop/file?owner=use&id="+use.id,"POST","bytes",{"x-file-name":"notes.txt"});
 assert.equal(deniedUpload.status,409);assert.deepEqual(await workshopSnapshot(env.WORKSHOP_DB),before);assert.deepEqual(storedBytes(env),bytes);
 assert.equal((await call("/api/workshop/file?id="+attachment.id)).status,302,"existing use links remain readable");
 assert.equal((await call("/api/workshop","POST",{entity:"product",record:{id:crypto.randomUUID(),family_id:"f-resistor",name:"New catalog product",field_values:{}},expectedRevision:null,expectedFamilyRevision:1})).status,200);
 assert.equal((await call("/api/workshop/file?owner=family&id=f-resistor","POST","catalog bytes",{"x-file-name":"notes.txt"})).status,201);
 assert.deepEqual((await workshopSnapshot(env.WORKSHOP_DB)).uses,before.uses);
});

test("engine saves and owner sign-in remain available; engine-off legacy editing is unchanged",async t=>{
 const {env,call}=await fixture(t);
 assert.equal((await (await call("/api/projects")).json()).readOnly,false);
 const oldSave=await call("/api/projects","PATCH",{id:"launcher",name:"Legacy saved before activation"});assert.equal(oldSave.status,200);
 env.NEW_PROJECT_ENGINE="1";
 assert.equal((await call("/api/accounts")).status,200);
 const projectId=crypto.randomUUID(),operationId=crypto.randomUUID();
 const input={name:"New engine project",operationId,expectedRevision:null};
 const first=await call("/api/project-engine/projects/"+projectId,"POST",input);assert.equal(first.status,200,await first.clone().text());
 const receipt=await first.json();
 const retry=await call("/api/project-engine/projects/"+projectId,"POST",input);assert.equal(retry.status,200);assert.deepEqual(await retry.json(),receipt);
 const after=await (await call("/api/projects")).json();assert.equal(after.projects.find(p=>p.id==="launcher").name,"Legacy saved before activation");
});
