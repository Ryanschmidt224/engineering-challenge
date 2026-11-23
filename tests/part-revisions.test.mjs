import {test} from "node:test";
import assert from "node:assert/strict";
import worker from "../worker.js";
import {TestR2} from "./helpers/r2.mjs";
import {provisionTestAccount} from "./helpers/accounts.mjs";
import {exportProject,inspectArchive} from "../functions/api/project-archive.js";
import {TestD1} from "./helpers/d1.mjs";
const origin="https://revision.example.test",project="launcher",id=()=>crypto.randomUUID();
async function fixture(){
 const env={PHOTOS:new TestR2(),admin_password:"synthetic-revision-test-signing-secret"};
 const login=await provisionTestAccount(new Request(origin+"/api/accounts",{method:"POST",headers:{origin},body:JSON.stringify({action:"register",email:"revision@example.test",password:"synthetic-revision-password"})}),env,{role:"admin"});
 const cookie=login.headers.get("set-cookie").split(";")[0],part={id:id(),name:"Bracket",partNumber:"100",partType:"custom",revision:"part-r1",specifications:[{name:"Thickness",value:"3 mm"}]};
 const record={id:id(),ownerType:"part",ownerId:part.id,scope:"step",stepId:"test-step",category:"test",title:"Load test",lifecycle:"active",entries:[{id:id(),type:"result",text:"Held 2 kg",files:[]}]};
 const workspace={revision:"workspace-r1",recipe:[{id:"test-step",title:"Test the bracket",detail:"Check deflection",notes:["Keep the fixture square"]}]};
 const partKey="components/launcher.json",workspaceKey="part-workspaces/launcher/"+part.id+".json",storeKey="investigations/launcher.json";
 await env.PHOTOS.put(partKey,JSON.stringify([part]));await env.PHOTOS.put(workspaceKey,JSON.stringify(workspace));await env.PHOTOS.put(storeKey,JSON.stringify({records:[record],revision:"records-r1"}));
 const call=(path,body,auth=true)=>worker.fetch(new Request(origin+path,{method:body?"POST":"GET",headers:{origin,...(auth?{cookie}:{})},...(body?{body:JSON.stringify(body)}:{})}),env,{});
 const command={action:"createPartRevision",partId:part.id,operationId:id(),expectedRevision:"records-r1",expectedPartRevision:part.revision,expectedWorkspaceRevision:workspace.revision};
 return {env,part,record,workspace,partKey,workspaceKey,storeKey,call,command,cookie};
}
test("revision freezes the saved part, instructions, tests and file bytes without moving or editing the working part",async()=>{
 const f=await fixture(),{env,call,command}=f;
 const drawing="drawings/launcher/part/"+f.part.id+"/"+id()+".pdf",photo="recipe-files/launcher/"+id()+".png";
 f.workspace.recipe[0].photos=[photo];await env.PHOTOS.put(f.workspaceKey,JSON.stringify(f.workspace));
 await env.PHOTOS.put(drawing,"%PDF-original",{customMetadata:{filename:"Bracket A.pdf"}});await env.PHOTOS.put(photo,"original-photo",{httpMetadata:{contentType:"image/png"}});
 const originals=await Promise.all([f.partKey,f.workspaceKey,drawing,photo].map(async key=>[key,(await env.PHOTOS.get(key)).etag]));
 const response=await call("/api/investigations?project=launcher",command);assert.equal(response.status,200,await response.clone().text());
 const saved=await response.json(),revision=saved.records.find(record=>record.partSnapshot),snapshot=revision.partSnapshot;
 assert.equal(revision.lifecycle,"revision");assert.equal(revision.date,new Date().toISOString().slice(0,10));assert.equal(snapshot.part.specifications[0].value,"3 mm");assert.deepEqual(snapshot.workspace,f.workspace);assert.deepEqual(snapshot.records,[f.record]);assert.deepEqual(saved.records.find(record=>record.id===f.record.id),f.record);
 for(const [key,etag] of originals)assert.equal((await env.PHOTOS.get(key)).etag,etag,"source stays unchanged: "+key);
 await env.PHOTOS.put(drawing,"%PDF-new");await env.PHOTOS.delete(photo);
 const index=snapshot.assets.findIndex(asset=>asset.original===drawing),url="/api/investigations?"+new URLSearchParams({project,revision:revision.id,asset:String(index)});
 const bytes=await call(url);assert.equal(await bytes.text(),"%PDF-original");assert.match(bytes.headers.get("content-disposition"),/Bracket%20A.pdf/);assert.equal(bytes.headers.get("cache-control"),"private, no-store");
 const metadata=await (await call("/api/investigations?"+new URLSearchParams({project,revision:revision.id,download:"1"}))).json();assert.deepEqual(metadata,snapshot);
 assert.equal((await call(url,null,false)).status,401);
 assert.equal((await call(url.replace("asset="+index,"asset=9999"))).status,404);
 const archive=await exportProject(env.PHOTOS,project);await inspectArchive(archive,project);for(const asset of snapshot.assets)assert.ok(archive.objects.some(object=>object.key===asset.archive),"backup includes "+asset.archive);
 const staged=await call("/api/project/staging?project=launcher",archive);assert.equal(staged.status,201);const restored=await(await call("/api/project/staging?"+new URLSearchParams({project,id:(await staged.json()).id,download:"1"}))).json();await inspectArchive(restored,project);for(const asset of snapshot.assets)assert.equal(restored.objects.find(object=>object.key===asset.archive).sha256,archive.objects.find(object=>object.key===asset.archive).sha256);
});
test("Workshop-backed revisions freeze resolved facts and locally stored Workshop files without changing the reusable source",async t=>{
 const f=await fixture();f.env.WORKSHOP_DB=new TestD1();t.after(()=>f.env.WORKSHOP_DB.close());
 const product={id:id(),family_id:"f-resistor",name:"Zero-ohm link",manufacturer:"Example",mpn:"EX-0",field_values:{"f-resistor-resistance":0},supplier_links:[]};
 assert.equal((await f.call("/api/workshop",{entity:"product",record:product,expectedRevision:null,expectedFamilyRevision:1})).status,200);
 const use={id:id(),project_id:project,family_id:product.family_id,product_id:product.id,purpose:"Jumper",quantity:1,unit:"pcs",field_values:{},notes:"Keep the test points accessible"};
 assert.equal((await f.call("/api/workshop",{entity:"use",record:use,expectedRevision:null,expectedFamilyRevision:1})).status,200);
 const attachment=id(),key="workshop-v2/files/"+attachment;
 await f.env.PHOTOS.put(key,"original-data",{customMetadata:{filename:"datasheet.pdf"}});
 await f.env.WORKSHOP_DB.prepare("INSERT INTO workshop_attachments(id,product_id,kind,title,r2_key,media_type,size) VALUES(?,?,?,?,?,?,?)").bind(attachment,product.id,"document","datasheet.pdf",key,"application/octet-stream",13).run();
 const command={...f.command,partId:use.id,expectedPartRevision:"1",expectedWorkspaceRevision:null};
 const response=await f.call("/api/investigations?project=launcher",command);assert.equal(response.status,200,await response.clone().text());const saved=(await response.json()).records.find(record=>record.partSnapshot).partSnapshot;
 assert.equal(saved.part.model,"EX-0");assert.equal(saved.part.specifications.find(field=>field.name==="Resistance").value,"0 Ω");assert.ok(saved.assets.some(asset=>asset.original===key&&asset.name==="datasheet.pdf"));
 assert.equal((await f.env.WORKSHOP_DB.prepare("SELECT revision FROM workshop_uses WHERE id=?").bind(use.id).first()).revision,1);assert.equal(await(await f.env.PHOTOS.get(key)).text(),"original-data");
});
test("a lost-response retry returns the same revision and operation reuse with another body is refused",async()=>{
 const f=await fixture();const first=await (await f.call("/api/investigations?project=launcher",f.command)).json(),copies=(await f.env.PHOTOS.list({prefix:"part-revisions/launcher/"})).objects.length;
 const retry=await f.call("/api/investigations?project=launcher",f.command);assert.equal(retry.status,200);const replay=await retry.json();assert.equal(replay.createdId,first.createdId);assert.equal(replay.revision,first.revision);assert.equal(replay.records.length,2);assert.equal((await f.env.PHOTOS.list({prefix:"part-revisions/launcher/"})).objects.length,copies);
 assert.equal((await f.call("/api/investigations?project=launcher",{...f.command,expectedPartRevision:"another"})).status,409);
});
test("stale part, workspace and record versions reject without publishing a revision",async()=>{
 for(const key of ["expectedPartRevision","expectedWorkspaceRevision","expectedRevision"]){
  const f=await fixture(),response=await f.call("/api/investigations?project=launcher",{...f.command,[key]:"stale"});assert.equal(response.status,409,key);assert.equal((await (await f.env.PHOTOS.get(f.storeKey)).json()).records.length,1);
 }
});
test("failed file verification and concurrent source changes leave current data and historical records intact",async()=>{
 for(const failure of ["verification","source-change","missing-attachment"]){
  const f=await fixture(),put=f.env.PHOTOS.put.bind(f.env.PHOTOS),get=f.env.PHOTOS.get.bind(f.env.PHOTOS);
  if(failure==="verification")f.env.PHOTOS.get=async key=>key.startsWith("part-revisions/")?null:get(key);
  else if(failure==="source-change")f.env.PHOTOS.put=async(key,value,options)=>{const result=await put(key,value,options);if(key.startsWith("part-revisions/"))await put(f.workspaceKey,JSON.stringify({...f.workspace,revision:"concurrent"}));return result;};
  else {f.workspace.recipe[0].photos=["recipe-files/launcher/"+id()+".png"];await put(f.workspaceKey,JSON.stringify(f.workspace));}
  assert.equal((await f.call("/api/investigations?project=launcher",f.command)).status,409);assert.equal((await (await get(f.storeKey)).json()).records.length,1);assert.equal((await (await get(f.partKey)).json())[0].revision,f.part.revision);
 }
});
test("archiving an entry moves that entry but creates no part snapshot; revision writes retain the private origin boundary",async()=>{
 const f=await fixture();const archived=await f.call("/api/investigations?project=launcher",{action:"archiveRecord",id:f.record.id,expectedRevision:"records-r1"});assert.equal(archived.status,200);const result=await archived.json();assert.equal(result.records[0].lifecycle,"archived");assert.equal(result.records[0].partSnapshot,undefined);
 const denied=await worker.fetch(new Request(origin+"/api/investigations?project=launcher",{method:"POST",headers:{origin:"https://elsewhere.test",cookie:f.cookie},body:JSON.stringify(f.command)}),f.env,{});assert.equal(denied.status,403);
});
