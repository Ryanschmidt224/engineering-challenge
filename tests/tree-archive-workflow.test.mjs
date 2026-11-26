import {test} from "node:test";
import assert from "node:assert/strict";
import worker from "../worker.js";
import {TestR2} from "./helpers/r2.mjs";
import {TestD1} from "./helpers/d1.mjs";
import {provisionTestAccount} from "./helpers/accounts.mjs";
import {exportProject,inspectArchive} from "../functions/api/project-archive.js";
import {setWorkshopArchiveState,workshopArchiveSources} from "../functions/api/workshop-tree-archive.js";
import {issueNumber} from "../functions/api/numbering.js";
const origin="https://archive.example.test",project="launcher",id=()=>crypto.randomUUID();
async function fixture(t){
 const env={PHOTOS:new TestR2(),WORKSHOP_DB:new TestD1(),admin_password:"synthetic-archive-secret"};t.after(()=>env.WORKSHOP_DB.close());
 const login=await provisionTestAccount(new Request(origin+"/api/accounts",{method:"POST",headers:{origin},body:JSON.stringify({action:"register",email:"archive@example.test",password:"synthetic-archive-password"})}),env,{role:"admin"});const cookie=login.headers.get("set-cookie").split(";")[0];
 const call=(path,data)=>worker.fetch(new Request(origin+path,{method:data?"POST":"GET",headers:{origin,cookie},...(data?{body:JSON.stringify(data)}:{})}),env,{});
 const product={id:id(),family_id:"f-resistor",name:"Resistor",manufacturer:"Example",mpn:"R-1",field_values:{"f-resistor-resistance":1000},supplier_links:[]};
 assert.equal((await call("/api/workshop",{entity:"product",record:product,expectedRevision:null,expectedFamilyRevision:2})).status,200);
 const addUse=async(parent,purpose)=>{const record={id:id(),project_id:project,tree_node_id:parent,family_id:product.family_id,product_id:product.id,purpose,quantity:1,unit:"pcs",field_values:{},notes:"Saved requirement"};const r=await call("/api/workshop",{entity:"use",record,expectedRevision:null,expectedFamilyRevision:2});assert.equal(r.status,200,await r.clone().text());return record;};
 const custom={id:id(),name:"Bracket",partNumber:"100",partType:"custom",revision:"part-r1",specifications:[{name:"Thickness",value:"3 mm"}]};
 await env.PHOTOS.put("components/launcher.json",JSON.stringify([custom]));
 const nodes=[{id:"frame",name:"Frame",kind:"assembly",parentId:null,partNumber:"001"},{id:"nested",name:"Nested",kind:"assembly",parentId:"frame",partNumber:"002"},{id:"part-"+custom.id,partId:custom.id,name:custom.name,kind:"part",parentId:"nested"},{id:"other",name:"Other",kind:"assembly",parentId:null}];
 await env.PHOTOS.put("trees/launcher.json",JSON.stringify(nodes));
 const revision=async()=> (await env.PHOTOS.head("trees/launcher.json")).etag;
 const archive=async(nodeId,extra={})=>call("/api/assembly-archive?project=launcher",{action:"archive",nodeId,expectedRevision:await revision(),...extra});
 const restore=async(archiveId)=>call("/api/assembly-archive?project=launcher",{action:"restore",id:archiveId,expectedRevision:await revision()});
 return {env,call,custom,nodes,product,addUse,archive,restore,revision};
}
test("mixed custom/Workshop subtree archives to its parent, preserves bytes and records, and restores stable identities",async t=>{
 const f=await fixture(t),inside=await f.addUse("nested","Inside resistor"),outside=await f.addUse("other","Outside resistor");
 const photo="recipe-files/launcher/"+id()+".png",drawing="drawings/launcher/part/"+f.custom.id+"/"+id()+".pdf",oldRevision="part-revisions/launcher/"+f.custom.id+"/"+id()+"/objects/test.pdf";
 for(const [key,bytes] of [[photo,"photo-original"],[drawing,"%PDF-original"],[oldRevision,"old-revision-bytes"]])await f.env.PHOTOS.put(key,bytes);
 await f.env.PHOTOS.put("part-workspaces/launcher/"+f.custom.id+".json",JSON.stringify({revision:"workspace-r1",recipe:[{id:"test",title:"Check thickness"}]}));
 const records={revision:"records-r1",records:[{id:id(),scope:"part",ownerType:"part",ownerId:f.custom.id,title:"Load test",lifecycle:"active",entries:[{type:"result",text:"Passed",files:[photo]}]},{id:id(),ownerType:"part",ownerId:f.custom.id,partSnapshot:{assets:[{original:"drawings/launcher/part/"+f.custom.id+"/removed.pdf",archive:oldRevision}]}}]};await f.env.PHOTOS.put("investigations/launcher.json",JSON.stringify(records));
 const response=await f.archive("nested",{entryDetails:{whyChanged:"Remove the prototype",notes:"Keep the fixture",photos:[photo],photoNames:{[photo]:"Prototype"}}});assert.equal(response.status,200,await response.clone().text());const saved=await response.json();
 const manifest=await(await f.call("/api/assembly-archive?project=launcher&id="+saved.id)).json(),archive=manifest.archive;
 assert.equal(archive.parentId,"frame");assert.equal(archive.entryDetails.notes,"Keep the fixture");assert.equal(archive.parts.length,1);assert.equal(archive.workshopParts.length,1);assert.deepEqual(archive.investigations,records.records);assert.ok(archive.assets.some(asset=>asset.original===oldRevision));
 assert.equal((await f.env.WORKSHOP_DB.prepare("SELECT archived FROM workshop_uses WHERE id=?").bind(inside.id).first()).archived,1);assert.equal((await f.env.WORKSHOP_DB.prepare("SELECT archived FROM workshop_uses WHERE id=?").bind(outside.id).first()).archived,0);
 assert.equal((await f.env.WORKSHOP_DB.prepare("SELECT archived FROM workshop_products WHERE id=?").bind(f.product.id).first()).archived,0);
 assert.deepEqual(await(await f.env.PHOTOS.get("investigations/launcher.json")).json(),records,"archive creates no part revision or record mutation");
 const list=await(await f.call("/api/assembly-archive?project=launcher&parent=frame")).json();assert.equal(list.items.length,1);assert.equal((await(await f.call("/api/assembly-archive?project=launcher&parent=other")).json()).items.length,0);
 const index=archive.assets.findIndex(asset=>asset.original===drawing);await f.env.PHOTOS.put(drawing,"replacement");assert.equal(await(await f.call("/api/assembly-archive?project=launcher&id="+saved.id+"&asset="+index)).text(),"%PDF-original");
 const backup=await exportProject(f.env.PHOTOS,project);await inspectArchive(backup,project);assert.ok(backup.objects.some(object=>object.key===archive.assets[index].archive));
 assert.equal((await f.restore(saved.id)).status,409,"changed current files require review instead of silent reuse");await f.env.PHOTOS.put(drawing,"%PDF-original");
 const restored=await f.restore(saved.id);assert.equal(restored.status,200,await restored.clone().text());const tree=(await restored.json()).nodes;assert.ok(tree.some(node=>node.id==="nested"));assert.ok(tree.some(node=>node.partId===inside.id));assert.equal((await f.env.WORKSHOP_DB.prepare("SELECT archived FROM workshop_uses WHERE id=?").bind(inside.id).first()).archived,0);
 const components=await(await f.env.PHOTOS.get("components/launcher.json")).json();assert.ok(components.some(part=>part.id===f.custom.id));assert.ok(!components.some(part=>part.id===inside.id),"D1 uses never become duplicate R2 parts");
});
test("archiving one shared occurrence retains the other placement and active part definition",async t=>{
 const f=await fixture(t);f.nodes.push({id:"other-bracket",kind:"part",partId:f.custom.id,name:"Shared bracket",parentId:"other"});await f.env.PHOTOS.put("trees/launcher.json",JSON.stringify(f.nodes));
 const response=await f.archive("part-"+f.custom.id);assert.equal(response.status,200);assert.equal((await response.json()).removedPartIds.length,0);assert.equal((await(await f.env.PHOTOS.get("components/launcher.json")).json())[0].id,f.custom.id);
});
test("Workshop group guards are all-or-none, and tree conflicts compensate flags before returning failure",async t=>{
 const f=await fixture(t),a=await f.addUse("nested","A"),b=await f.addUse("nested","B");
 const source=await workshopArchiveSources(f.env,project,new Set([a.id,b.id]),new Set([a.id,b.id]));
 await assert.rejects(()=>setWorkshopArchiveState(f.env,project,[source.uses[0],{...source.uses[1],revision:999}],0,1,0));for(const use of source.uses)assert.equal((await f.env.WORKSHOP_DB.prepare("SELECT archived FROM workshop_uses WHERE id=?").bind(use.id).first()).archived,0);
 await setWorkshopArchiveState(f.env,project,source.uses,0,1,0);for(const use of source.uses)assert.equal((await f.env.WORKSHOP_DB.prepare("SELECT archived FROM workshop_uses WHERE id=?").bind(use.id).first()).archived,1);await setWorkshopArchiveState(f.env,project,source.uses,1,0,1,{checkSources:false});
 const put=f.env.PHOTOS.put.bind(f.env.PHOTOS);let failed=false;
 f.env.PHOTOS.put=async(key,value,options)=>{if(key==="trees/launcher.json"&&options.onlyIf&&!failed){failed=true;return null;}return put(key,value,options);};
 assert.equal((await f.archive("nested")).status,409);for(const use of source.uses)assert.equal((await f.env.WORKSHOP_DB.prepare("SELECT archived FROM workshop_uses WHERE id=?").bind(use.id).first()).archived,0);assert.ok((await(await f.env.PHOTOS.get("trees/launcher.json")).json()).some(node=>node.id==="nested"));
});
test("restore conflicts keep the archive and use flags; a guarded retry after a tree conflict succeeds",async t=>{
 const f=await fixture(t),use=await f.addUse("nested","A"),saved=await(await f.archive("nested")).json(),put=f.env.PHOTOS.put.bind(f.env.PHOTOS);let failed=false;
 f.env.PHOTOS.put=async(key,value,options)=>{if(key==="trees/launcher.json"&&options.onlyIf&&!failed){failed=true;return null;}return put(key,value,options);};
 assert.equal((await f.restore(saved.id)).status,409);assert.equal((await f.env.WORKSHOP_DB.prepare("SELECT archived FROM workshop_uses WHERE id=?").bind(use.id).first()).archived,1);const retry=await f.restore(saved.id);assert.equal(retry.status,200,await retry.clone().text());
});
test("previously archived children remain under the archived parent; missing photos and stale commands publish no active removal",async t=>{
 const f=await fixture(t);const child=await(await f.archive("part-"+f.custom.id)).json();const parent=await f.archive("nested");assert.equal(parent.status,200);const previous=await(await f.call("/api/assembly-archive?project=launcher&parent=nested")).json();assert.equal(previous.items[0].id,child.id);
 const g=await fixture(t),before=await(await g.env.PHOTOS.get("trees/launcher.json")).text();assert.equal((await g.archive("nested",{expectedRevision:"stale"})).status,409);assert.equal((await g.archive("nested",{entryDetails:{photos:["recipe-files/launcher/"+id()+".png"]}})).status,409);assert.equal(await(await g.env.PHOTOS.get("trees/launcher.json")).text(),before);
});
test("lost archive responses replay the same committed removal and reject edited operation reuse",async t=>{
 const f=await fixture(t),command={action:"archive",nodeId:"nested",expectedRevision:await f.revision(),operationId:id(),entryDetails:{notes:"Keep this snapshot"}};
 const first=await f.call("/api/assembly-archive?project=launcher",command);assert.equal(first.status,200);const saved=await first.json();
 const replay=await f.call("/api/assembly-archive?project=launcher",command);assert.equal(replay.status,200);assert.equal((await replay.json()).id,saved.id);assert.equal((await f.env.PHOTOS.list({prefix:"assembly-archives/launcher/manifests/"})).objects.length,1);
 assert.equal((await f.call("/api/assembly-archive?project=launcher",{...command,entryDetails:{notes:"Different request"}})).status,409);
 await f.env.PHOTOS.delete("assembly-archives/launcher/operations/"+command.operationId+".json");assert.equal((await f.call("/api/assembly-archive?project=launcher",command)).status,200,"manifest recovers a missing receipt");
});
test("archived part and subassembly numbers stay consumed through restore, padding changes and archive-copy removal",async t=>{
 const f=await fixture(t);f.custom.partNumber="NR100";f.nodes.find(node=>node.id==="frame").partNumber="NR001";f.nodes.find(node=>node.id==="nested").partNumber="NR002";await f.env.PHOTOS.put("components/launcher.json",JSON.stringify([f.custom]));await f.env.PHOTOS.put("trees/launcher.json",JSON.stringify(f.nodes));
 const response=await f.archive("nested");assert.equal(response.status,200,await response.clone().text());const saved=await response.json();
 await assert.rejects(()=>issueNumber(f.env,project,"part",id(),"NR100"),/already assigned/);await assert.rejects(()=>issueNumber(f.env,project,"part",id(),"NR00100"),/already assigned/);await assert.rejects(()=>issueNumber(f.env,project,"assembly",id(),"NR002"),/already assigned/);
 assert.equal(await issueNumber(f.env,project,"part",id()),"NR101");assert.equal(await issueNumber(f.env,project,"assembly",id()),"NR003");assert.equal((await f.restore(saved.id)).status,200);assert.equal((await(await f.env.PHOTOS.get("components/launcher.json")).json())[0].partNumber,"NR100");
 await f.env.PHOTOS.delete("assembly-archives/launcher/manifests/"+saved.id+".json");await assert.rejects(()=>issueNumber(f.env,project,"part",id(),"NR100"),/already assigned/);
});
test("older archive-only numbers are recognized before allocation even when they predate the register",async t=>{
 const f=await fixture(t),archiveId=id();await f.env.PHOTOS.put("assembly-archives/launcher/manifests/"+archiveId+".json",JSON.stringify({nodes:[{id:"old-assembly",kind:"assembly",partNumber:"NR009"}],parts:[{id:"old-part",partNumber:"NR109"}]}));
 await assert.rejects(()=>issueNumber(f.env,project,"part",id(),"NR109"),/already assigned/);await assert.rejects(()=>issueNumber(f.env,project,"assembly",id(),"NR009"),/already assigned/);
 const lookup=await(await f.call("/api/numbering?project=launcher&lookup=NR109")).json();assert.equal(lookup.reserved,true);assert.equal(lookup.active,false);
 await issueNumber(f.env,project,"part",id());await f.env.PHOTOS.delete("assembly-archives/launcher/manifests/"+archiveId+".json");await assert.rejects(()=>issueNumber(f.env,project,"part",id(),"NR109"),/already assigned/);
});
