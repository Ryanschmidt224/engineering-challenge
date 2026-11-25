import {test} from "node:test";
import assert from "node:assert/strict";
import {fixture,upload} from "./helpers/project-workspace.mjs";
import {handleProjectWorkspace} from "../functions/api/project-workspace-api.js";
import {instructionTree} from "../assets/project-instruction-model.js";
import {normalizeProjectRecord} from "../assets/project-record-model.js";
import {validateManifest} from "../functions/api/project-backup.js";
import {createProjectClient} from "../assets/project-client.js";
const id=()=>crypto.randomUUID(),base="https://preview.example.test/api/project-engine/projects/";
const ok=reply=>{assert.equal(reply.status,200,JSON.stringify(reply));return reply.result;};
const step=async(f,title,options={})=>ok(await f.call("/items/"+f.itemId+"/steps","POST",{title,body:title+" body",...options})).stepId;
const state=async f=>ok(await f.call("/state"));
const saved=async(f,event)=>ok(await f.call("/history/"+event)).event.payload.snapshot;
const revise=(f,scope,data={},options={})=>f.call("/steps/"+scope+"/revisions","POST",data,options);
const record=(f,scope,text,fileIds=[],fields={})=>f.call("/items/"+f.itemId+"/records","POST",{stepId:scope,record:{type:"note",fields:{text,...fields},fileIds}});
const backup=async f=>{const response=await handleProjectWorkspace(new Request(base+f.projectId+"/export"),f.env,f.owner);assert.equal(response.status,200);return response.text();};
async function copy(f,body){const project=id(),operation=id(),response=await handleProjectWorkspace(new Request(base+project+"/import-copy?name=Instruction%20copy",{method:"POST",headers:{"x-operation-id":operation,"x-project-revision":"new"},body}),f.env,f.owner);assert.equal(response.status,200,await response.clone().text());return {project,result:await response.json()};}

test("instruction and header revisions freeze explicit scopes, order, record audits and exact attachments independently",async()=>{
 const f=await fixture();try{
  const group=await step(f,"Assembly",{isGroup:true}),a=await step(f,"Solder",{parentId:group}),nested=await step(f,"Inspection",{parentId:group,isGroup:true}),b=await step(f,"Measure",{parentId:nested}),outside=await step(f,"Packing");
  const file=await upload(f,"scope.txt",new TextEncoder().encode("Original scope bytes"),"support"),created=ok(await record(f,a,"Original result",[file.fileId],{attachments:{text:[{id:file.fileId,name:"Solder result"}]}}));
  ok(await record(f,b,"Nested result"));ok(await record(f,outside,"Unrelated result"));
  ok(await f.call("/items/"+f.itemId+"/steps/reorder","POST",{parentId:group,ids:[nested,a]}));
  const first=ok(await revise(f,a,{entryDetails:{whatChanged:"Save solder setup"}})),groupRevision=ok(await revise(f,group,{entryDetails:{whatChanged:"Save whole assembly"}})),before=await saved(f,first.eventId),whole=await saved(f,groupRevision.eventId);
  assert.equal(before.scope.id,a);assert.deepEqual(before.steps.map(row=>row.id),[a]);assert.equal(before.records.length,1);assert.equal(before.files[0].id,file.fileId);assert.equal(before.records[0].fields.attachments.text[0].name,"Solder result");
  assert.deepEqual(instructionTree(whole.steps).children(group).map(row=>row.id),[nested,a]);assert.deepEqual(new Set(whole.steps.map(row=>row.id)),new Set([group,nested,a,b]));assert.equal(whole.records.length,2);assert.equal(whole.records.some(row=>row.fields.text==="Unrelated result"),false);
  ok(await f.call("/steps/"+a,"PATCH",{body:"Later instructions"}));ok(await f.call("/records/"+created.recordId,"PATCH",{record:{type:"note",fields:{text:"Changed result"}}}));
  assert.deepEqual(await saved(f,first.eventId),before);assert.deepEqual(await saved(f,groupRevision.eventId),whole);
  const current=await state(f);assert.equal(current.items[0].revision_level,1);assert.equal(current.steps.find(row=>row.id===a).revision_level,2);assert.equal(current.steps.find(row=>row.id===group).revision_level,2);assert.equal(current.steps.find(row=>row.id===b).revision_level,1);
  const history=ok(await f.call("/history?type=instruction_revisions&instruction="+a));assert.equal(history.total,1);assert.equal(ok(await f.call("/history?type=revisions")).total,0);assert.equal(ok(await f.call("/history?type=instruction_revisions")).total,2,"A group produces one event, not one per descendant");
 }finally{f.db.close();}
});
test("Save as revision freezes the saved instruction then edits it; ordinary and no-op saves keep its level",async()=>{
 const f=await fixture();try{
  const scope=await step(f,"Cut"),noop=ok(await revise(f,scope,{title:"Cut",body:"Cut body",parentId:null}));assert.equal(noop.noop,true);
  const revision=ok(await revise(f,scope,{title:"Deburr",body:"Deburr both edges",parentId:null,entryDetails:{whatChanged:"Added deburring"}}));assert.equal((await saved(f,revision.eventId)).steps[0].title,"Cut");
  ok(await f.call("/steps/"+scope,"PATCH",{body:"Use a file"}));const current=await state(f);assert.equal(current.steps[0].title,"Deburr");assert.equal(current.steps[0].revision_level,2);assert.equal(current.items[0].revision_level,1);
  const part=ok(await f.call("/items/"+f.itemId+"/revisions","POST"));assert.equal((await saved(f,part.eventId)).steps[0].revision_level,2);assert.equal((await state(f)).steps[0].revision_level,2);
 }finally{f.db.close();}
});
test("scope revision replay precedes stale/domain checks and mismatched retries never advance twice",async()=>{
 const f=await fixture();try{
  const scope=await step(f,"Cut"),operationId=id(),revision=f.revision(),payload={entryDetails:{whatChanged:"Keep evidence"}},first=ok(await revise(f,scope,payload,{operationId,revision}));
  ok(await f.call("/steps/"+scope+"/retire","POST"));assert.deepEqual(ok(await revise(f,scope,payload,{operationId,revision})),first);
  assert.equal((await revise(f,scope,{entryDetails:{whatChanged:"Other content"}},{operationId,revision})).status,409);
  assert.equal((await revise(f,scope,payload,{revision})).status,409);assert.equal((await state(f)).steps[0].revision_level,2);
 }finally{f.db.close();}
});
test("retiring a group hides its descendants without discarding their independent archive state",async()=>{
 const f=await fixture();try{
  const root=await step(f,"Group",{isGroup:true}),active=await step(f,"Active child",{parentId:root}),retired=await step(f,"Previously archived",{parentId:root}),entry=ok(await record(f,active,"Saved evidence"));
  ok(await f.call("/steps/"+retired+"/retire","POST"));ok(await f.call("/steps/"+root+"/retire","POST"));
  for(const [path,method,data]of [["/steps/"+active,"PATCH",{body:"Blocked"}],["/records/"+entry.recordId,"PATCH",{record:{type:"note",fields:{text:"Blocked"}}}],["/steps/"+active+"/revisions","POST",{}],["/items/"+f.itemId+"/records","POST",{stepId:active,record:{type:"note",fields:{text:"Blocked"}}}],["/steps/"+retired+"/restore","POST",{}]])assert.equal((await f.call(path,method,data)).status,400,path);
  ok(await f.call("/steps/"+root+"/restore","POST"));const tree=instructionTree((await state(f)).steps);assert.equal(tree.active(tree.byId.get(active)),true);assert.equal(tree.active(tree.byId.get(retired)),false);
 }finally{f.db.close();}
});
test("instruction membership and order reject cycles, foreign scopes, hidden parents and incomplete sibling lists",async()=>{
 const f=await fixture();try{
  const root=await step(f,"Group",{isGroup:true}),nested=await step(f,"Nested",{isGroup:true,parentId:root}),a=await step(f,"A",{parentId:root}),b=await step(f,"B",{parentId:root});
  const other=ok(await f.call("/items","POST",{details:{name:"Other"}})),foreign=ok(await f.call("/items/"+other.itemId+"/steps","POST",{title:"Foreign",isGroup:true})).stepId;
  for(const data of [{parentId:root},{parentId:nested},{parentId:foreign},{parentId:a}])assert.equal((await f.call("/steps/"+root,"PATCH",data)).status,400);
  for(const ids of [[a,b],[a,b,foreign],[nested,a,a]])assert.equal((await f.call("/items/"+f.itemId+"/steps/reorder","POST",{parentId:root,ids})).status,400);
  const token=f.revision(),results=await Promise.all([f.call("/items/"+f.itemId+"/steps/reorder","POST",{parentId:root,ids:[b,a,nested]},{revision:token}),f.call("/steps/"+a,"PATCH",{body:"Concurrent"},{revision:token})]);assert.deepEqual(results.map(row=>row.status).sort(),[200,409]);
 }finally{f.db.close();}
});
test("failed revision event rolls back frozen values, instruction level and command receipt together",async()=>{
 const f=await fixture();try{
  const scope=await step(f,"Cut");ok(await record(f,scope,"Evidence"));const before=await state(f),values=await f.db.prepare("SELECT count(*) AS n FROM engine_snapshot_values").first();
  f.db.sqlite.exec("CREATE TRIGGER refuse_instruction_revision BEFORE INSERT ON engine_events WHEN NEW.type='instruction_revision' BEGIN SELECT RAISE(ABORT,'fixture constraint failed'); END");
  assert.equal((await revise(f,scope,{body:"Unsaved edit"})).status,500);assert.deepEqual(await state(f),before);assert.deepEqual(await f.db.prepare("SELECT count(*) AS n FROM engine_snapshot_values").first(),values);
  f.db.sqlite.exec("DROP TRIGGER refuse_instruction_revision");ok(await revise(f,scope,{body:"Now saved"}));assert.equal((await state(f)).steps[0].revision_level,2);
 }finally{f.db.close();}
});
test("scope revisions and named evidence survive copy recovery byte-for-byte with stable IDs",async()=>{
 const f=await fixture();try{
  const root=await step(f,"Group",{isGroup:true}),child=await step(f,"Measure",{parentId:root}),file=await upload(f,"result.dat",new TextEncoder().encode("Measured bytes"),"support");ok(await record(f,child,"Old result",[file.fileId],{attachments:{text:[{id:file.fileId,name:"Original reading"}]}}));const revision=ok(await revise(f,root,{entryDetails:{whatChanged:"Measurements saved"}}));
  const original=await saved(f,revision.eventId),archive=await backup(f),copied=await copy(f,archive),detail=await(await handleProjectWorkspace(new Request(base+copied.project+"/history/"+revision.eventId),f.env,f.owner)).json();assert.deepEqual(detail.event.payload.snapshot,original);
  const current=await(await handleProjectWorkspace(new Request(base+copied.project+"/state"),f.env,f.owner)).json();assert.equal(current.steps.find(row=>row.id===child).parent_id,root);assert.equal(current.steps.find(row=>row.id===root).revision_level,2);assert.equal(await(await handleProjectWorkspace(new Request(base+copied.project+"/files/"+file.fileId),f.env,f.owner)).text(),"Measured bytes");assert.equal(await backup(f),archive);
  const malformed=JSON.parse(archive.split("\n")[0]).manifest;malformed.tables.steps.find(row=>row.id===root).parent_id=child;assert.throws(()=>validateManifest(malformed,f.projectId),/instruction group|cycle/);
 }finally{f.db.close();}
});
test("pre-instruction backups retain their original snapshots and gain only working defaults",async()=>{
 const f=await fixture();try{
  const scope=await step(f,"Legacy step");ok(await record(f,scope,"Legacy record"));const lines=(await backup(f)).trim().split("\n").map(JSON.parse),manifest=lines[0].manifest;
  for(const row of manifest.tables.steps)for(const key of ["parent_id","is_group","revision_level","archive_reason"])delete row[key];for(const row of manifest.tables.records)for(const key of ["sort_order","parent_record_id"])delete row[key];
  const copied=await copy(f,lines.map(row=>JSON.stringify(row)+"\n").join("")),current=await(await handleProjectWorkspace(new Request(base+copied.project+"/state"),f.env,f.owner)).json();assert.equal(current.steps[0].revision_level,1);assert.equal(current.steps[0].parent_id,null);assert.equal(current.records[0].sort_order,0);
 }finally{f.db.close();}
});
test("per-prompt attachments validate names, membership and limits without rewriting legacy evidence",()=>{
 const files=Array.from({length:36},id),entry={type:"test",fields:{result:"OK",attachments:{checked:files.slice(0,12).map(id=>({id,name:"Setup"})),method:files.slice(12,24).map(id=>({id,name:"Method"})),result:files.slice(24).map(id=>({id,name:"Reading"}))}},fileIds:files};assert.equal(normalizeProjectRecord(entry).fileIds.length,36);
 for(const attachments of [{result:[{id:id(),name:"Not uploaded"}]},{unknown:[]},{result:files.slice(0,13).map(id=>({id,name:"Too many"}))},{result:[{id:files[0],name:"x".repeat(121)}]}])assert.throws(()=>normalizeProjectRecord({...entry,fields:{result:"OK",attachments}}));
 assert.deepEqual(normalizeProjectRecord({type:"note",fields:{text:"Old note"},fileIds:files.slice(0,20)}).fileIds,files.slice(0,20));
});
test("record ordering is scoped, guarded, saved in snapshots and does not create a revision",async()=>{
 const f=await fixture();try{
  const scope=await step(f,"Measure"),other=await step(f,"Other"),a=ok(await record(f,scope,"A")),b=ok(await record(f,scope,"B")),foreign=ok(await record(f,other,"Foreign"));
  assert.equal((await f.call("/steps/"+scope+"/reorder-records","POST",{ids:[a.recordId,foreign.recordId]})).status,400);ok(await f.call("/steps/"+scope+"/reorder-records","POST",{ids:[b.recordId,a.recordId]}));const revision=ok(await revise(f,scope));assert.deepEqual((await saved(f,revision.eventId)).records.sort((a,b)=>a.sort_order-b.sort_order).map(row=>row.id),[b.recordId,a.recordId]);assert.equal((await state(f)).items[0].revision_level,1);
 }finally{f.db.close();}
});
test("nested records retain membership/order through revisions, immutable moves and streamed copy recovery",async()=>{
 const f=await fixture();try{
  const group=await step(f,"Assembly",{isGroup:true}),scope=await step(f,"Inspect",{parentId:group}),other=await step(f,"Other"),root=ok(await record(f,scope,"Parent result")),sibling=ok(await record(f,scope,"Other result")),foreign=ok(await record(f,other,"Foreign result"));
  const add=(title,parentRecordId)=>f.call("/items/"+f.itemId+"/records","POST",{stepId:scope,parentRecordId,record:{type:"note",title,fields:{text:"Evidence "+title+" "+"s".repeat(2800)}}});
  const a=ok(await add("Nested A",root.recordId)),b=ok(await add("Nested B",root.recordId));assert.equal((await add("Wrong owner",foreign.recordId)).status,400);assert.equal((await add("Bad parent","")).status,400);
  ok(await f.call("/steps/"+scope+"/reorder-records","POST",{parentRecordId:root.recordId,ids:[b.recordId,a.recordId]}));const savedRevision=ok(await revise(f,group)),original=await saved(f,savedRevision.eventId);
  const before=(await state(f)).records.find(row=>row.id===root.recordId);assert.equal((await f.call("/records/"+root.recordId,"PATCH",{parentRecordId:a.recordId,record:{type:before.type,title:before.title,fields:before.fields}})).status,400,"Moving a record beneath its child cannot create a cycle");
  const moved=ok(await f.call("/records/"+a.recordId,"PATCH",{parentRecordId:sibling.recordId,record:{type:"note",fields:{text:"Moved entry"}}}));assert.equal(ok(await f.call("/history/"+moved.eventId)).event.payload.record_structure.before.parent_record_id,root.recordId);assert.deepEqual(await saved(f,savedRevision.eventId),original);
  for(let n=0;n<200;n++)ok(await add("Large nested "+n,root.recordId));const archive=await backup(f);assert.equal(JSON.parse(archive.split("\n")[0]).manifest.version,2);const recovered=await copy(f,archive),detail=await(await handleProjectWorkspace(new Request(base+recovered.project+"/history/"+savedRevision.eventId),f.env,f.owner)).json();assert.deepEqual(detail.event.payload.snapshot,original);
  const current=await(await handleProjectWorkspace(new Request(base+recovered.project+"/state"),f.env,f.owner)).json();assert.equal(current.records.find(row=>row.id===a.recordId).parent_record_id,sibling.recordId);assert.equal(current.records.filter(row=>row.parent_record_id===root.recordId).length,201);
 }finally{f.db.close();}
});
for(const phase of ["prepare","admit"])test("attachment upload resumes after a lost "+phase+" response without duplicate files or new bytes",async()=>{
 const f=await fixture();try{
  let lost=false,puts=0;const admissions=[];
  const client=createProjectClient({fetcher:async(path,options={})=>{if(options.method==="PUT")puts++;if(path.endsWith("/admit"))admissions.push(JSON.parse(options.body));const response=await handleProjectWorkspace(new Request("https://preview.example.test"+path,options),f.env,f.owner);if(path.endsWith("/"+phase)&&!lost){lost=true;throw Error("Response lost");}return response;}});
  await client.load(f.projectId);const file=new File(["Exact evidence bytes"],"reading.txt",{type:"text/plain"}),token=client.state.project.revision;
  await assert.rejects(client.upload(f.projectId,file,{expectedRevision:token}),/Response lost/);const result=await client.upload(f.projectId,file,{expectedRevision:token});assert.equal(puts,1);assert.equal((await client.load(f.projectId)).files.length,1);assert.equal(client.state.files[0].id,result.fileId);assert.equal(client.state.files[0].state,"ready");if(phase==="admit")assert.deepEqual(admissions[0],admissions[1]);
 }finally{f.db.close();}
});
test("problem resolution and photos variants validate explicitly; archive reasons survive snapshots and recovery",async()=>{
 const f=await fixture();try{
  const scope=await step(f,"Troubleshoot");const problem=normalizeProjectRecord({type:"problem",fields:{happened:"No output",did_fix:"yes",resolution:"Replaced fuse"}});assert.equal(problem.fields.status,"resolved");assert.equal(normalizeProjectRecord({...problem,fields:{...problem.fields,did_fix:"maybe"}}).fields.status,"open");assert.throws(()=>normalizeProjectRecord({type:"problem",fields:{did_fix:"no"}}),/meaningful/);
  const document=await upload(f,"not-a-photo.txt",new TextEncoder().encode("Document"),"support");assert.equal((await f.call("/items/"+f.itemId+"/records","POST",{stepId:scope,record:{type:"note",fields:{category:"photos"},fileIds:[document.fileId]}})).status,400);
  ok(await f.call("/steps/"+scope+"/retire","POST",{reason:"Superseded procedure"}));const revision=ok(await f.call("/items/"+f.itemId+"/revisions","POST"));assert.equal((await saved(f,revision.eventId)).steps[0].archive_reason,"Superseded procedure");const archive=await backup(f),recovered=await copy(f,archive),current=await(await handleProjectWorkspace(new Request(base+recovered.project+"/state"),f.env,f.owner)).json();assert.equal(current.steps[0].archive_reason,"Superseded procedure");
 }finally{f.db.close();}
});
