import {test} from "node:test";
import assert from "node:assert/strict";
import {TestD1} from "./helpers/d1.mjs";
import {TestR2} from "./helpers/r2.mjs";
import {handleProjectWorkspace} from "../functions/api/project-workspace-api.js";
import {commitProjectCommand,replayProjectCommand,canonicalJSON,sha256} from "../functions/api/project-command.js";
import {normalizeProjectRecord} from "../assets/project-record-model.js";
import {fixture,upload,counts} from "./helpers/project-workspace.mjs";
const id=()=>crypto.randomUUID(),origin="https://preview.example.test";
test("custom project ordinary saves, no-op, revision replay and old evidence retain their actual configuration",async()=>{
 const f=await fixture();try{
  const {call,itemId,db}=f;let state=(await call("/state")).result;assert.equal(state.items[0].part_number,"NR100");assert.deepEqual(await counts(db),{configurations:1,events:0,receipts:2});
  const details={...state.items[0],fields:{...state.items[0].fields,description:"Ordinary edit captured by evidence"}};for(const key of ["id","project_id","created_at","revision_level"])delete details[key];details.is_tool=!!details.is_tool;
  const edit=await call("/items/"+itemId,"PATCH",{details});assert.equal(edit.status,200,JSON.stringify(edit));assert.equal((await counts(db)).events,0);
  const before=await counts(db),rev=f.revision();const noop=await call("/items/"+itemId,"PATCH",{details});assert.equal(noop.result.noop,true);assert.equal(f.revision(),rev);assert.deepEqual(await counts(db),before);
  const record=await call("/items/"+itemId+"/records","POST",{record:{type:"test",fields:{checked:"3 mm bracket",result:"Flexed"}}});assert.equal(record.status,200,JSON.stringify(record));
  const revised=structuredClone(details);revised.fields.specs[0].value=5;
  const operationId=id(),expectedRevision=f.revision(),save=await call("/items/"+itemId+"/revisions","POST",{details:revised,entryDetails:{whatChanged:"5 mm bracket",whyChanged:"Reduce flex"}},{operationId,revision:expectedRevision});assert.equal(save.status,200,JSON.stringify(save));
  const savedCounts=await counts(db);assert.deepEqual(savedCounts,{configurations:3,events:2,receipts:5});
  const replay=await call("/items/"+itemId+"/revisions","POST",{details:revised,entryDetails:{whatChanged:"5 mm bracket",whyChanged:"Reduce flex"}},{operationId,revision:expectedRevision});assert.deepEqual(replay.result,save.result);assert.deepEqual(await counts(db),savedCounts);
  assert.equal((await call("/items/"+itemId+"/revisions","POST",{details:revised,entryDetails:{whyChanged:"Different"}},{operationId,revision:expectedRevision})).status,409);
  assert.equal((await call("/items/"+itemId,"PATCH",{details},{revision:expectedRevision})).status,409);assert.deepEqual(await counts(db),savedCounts);
  const old=(await call("/history/"+record.result.eventId)).result;assert.equal(old.configurations[0].snapshot.item.fields.specs[0].value,3);assert.equal(old.configurations[0].snapshot.item.fields.description,details.fields.description);
  const history=(await call("/history?type=changes&q=Thickness")).result;assert.equal(history.entries.length,1);assert.equal(history.entries[0].id,save.result.eventId);
  const revision=(await call("/history/"+save.result.eventId)).result;assert.equal(revision.configurations.length,2);assert.equal(revision.event.payload.changes[0].before.value,3);assert.equal(revision.event.payload.changes[0].after.value,5);
 }finally{f.db.close();}
});
test("removed item is read-only, reserves its number, restores the same IDs and freezes its original path",async()=>{
 const f=await fixture();try{
  const {call,itemId,db,env}=f;const state=(await call("/state")).result,occurrence=state.occurrences[0];
  const remove=await call("/items/"+itemId+"/archive","POST");assert.equal(remove.status,200);const keys=[...env.PHOTOS.objects.keys()];
  assert.equal((await call("/items/"+itemId,"PATCH",{details:f.details})).status,404);
  assert.equal((await call("/items","POST",{assignNumber:false,details:{...f.details,part_number:"nr100"}})).status,409);
  await call("","PATCH",{name:"Renamed root"});
  const preview=(await call("/items/"+itemId+"/restore-preview")).result;assert.equal(preview.root.name,"Renamed root");assert.equal(preview.occurrence.removed_path.root.name,"Bracket build");assert.deepEqual(preview.conflicts,[]);
  const operationId=id(),revision=f.revision(),restore=await call("/items/"+itemId+"/restore","POST",{},{operationId,revision});assert.equal(restore.status,200);assert.deepEqual((await call("/items/"+itemId+"/restore","POST",{},{operationId,revision})).result,restore.result);
  const restored=(await call("/state")).result;assert.equal(restored.occurrences[0].id,occurrence.id);assert.equal(restored.items[0].id,itemId);assert.equal(restored.occurrences[0].removed_path.root.name,"Bracket build");assert.equal(restored.occurrences[0].removed_at,null);assert.deepEqual([...env.PHOTOS.objects.keys()],keys);
  assert.equal((await counts(db)).events,2);
 }finally{f.db.close();}
});
test("steps retire and restore without losing records; independent duplication never shares edits",async()=>{
 const f=await fixture();try{
  const {call,itemId}=f;const step=await call("/items/"+itemId+"/steps","POST",{title:"Drill",body:"Use 3 mm stock"});assert.equal(step.status,200);
  const record=await call("/items/"+itemId+"/records","POST",{stepId:step.result.stepId,record:{type:"note",fields:{text:"Original instruction"}}});assert.equal(record.status,200);
  await call("/steps/"+step.result.stepId,"PATCH",{title:"Drill carefully",body:"Use a fixture"});await call("/steps/"+step.result.stepId+"/retire","POST");
  assert.equal((await call("/steps/"+step.result.stepId,"PATCH",{title:"Cannot change retired step"})).status,400);
  const evidence=(await call("/history/"+record.result.eventId)).result;assert.equal(evidence.record.step_snapshot.title,"Drill");assert.equal(evidence.record.step_snapshot.body,"Use 3 mm stock");
  await call("/steps/"+step.result.stepId+"/restore","POST");const state=(await call("/state")).result;assert.equal(state.steps[0].id,step.result.stepId);assert.equal(state.steps[0].retired_at,null);
  const duplicate=await call("/items/"+itemId+"/duplicate","POST");assert.equal(duplicate.status,200,JSON.stringify(duplicate));assert.notEqual(duplicate.result.itemId,itemId);
  assert.equal((await call("/items/"+duplicate.result.itemId,"PATCH",{details:{...f.details,name:"Independent copy",part_number:"NR101"}})).status,200);const final=(await call("/state")).result;assert.equal(final.items.find(row=>row.id===itemId).name,"Bracket");assert.equal(final.steps.length,1);assert.equal(final.records.length,1);
 }finally{f.db.close();}
});
test("step reordering supports more than 100 steps without exceeding D1 bound parameters",async()=>{
 const f=await fixture();try{
  const {db,projectId,itemId,call}=f,ids=Array.from({length:120},id);db.sqlite.exec("BEGIN");for(const [index,value]of ids.entries())db.sqlite.prepare("INSERT INTO engine_steps(id,project_id,item_id,title,sort_order,created_at) VALUES(?,?,?,?,?,?)").run(value,projectId,itemId,"Step "+index,index,new Date().toISOString());db.sqlite.exec("COMMIT");
  const reversed=[...ids].reverse(),response=await call("/items/"+itemId+"/steps/reorder","POST",{ids:reversed});assert.equal(response.status,200,JSON.stringify(response));assert.deepEqual((await call("/state")).result.steps.map(row=>row.id),reversed);
  assert.equal((await call("/items/"+itemId+"/steps/reorder","POST",{ids:reversed.slice(1)})).status,400);
 }finally{f.db.close();}
});
test("History stable cursors handle equal timestamps, edited record search and project isolation",async()=>{
 const f=await fixture();try{
  const {db,call,itemId}=f,ids=[];for(let n=0;n<7;n++){const r=await call("/items/"+itemId+"/records","POST",{record:{type:"note",fields:{text:"Entry "+n}}});ids.push(r.result.eventId);}
  db.sqlite.exec("UPDATE engine_events SET created_at='2026-11-22T12:00:00.000Z'");let cursor="",found=[];do{const page=await call("/history?limit=2"+(cursor?"&cursor="+cursor:""));assert.equal(page.status,200);assert.equal(page.result.total,7);found.push(...page.result.entries.map(row=>row.id));cursor=page.result.nextCursor;}while(cursor);assert.deepEqual(found,[...ids].sort().reverse());
  const detail=(await call("/history/"+ids[0])).result;await call("/records/"+detail.record.id,"PATCH",{record:{type:"problem",fields:{happened:"Unique fault",status:"resolved"}}});
  assert.equal((await call("/history?type=problems&q=Unique%20fault")).result.entries.length,1);
  assert.equal((await call("/history?type=notes&q=Unique%20fault")).result.entries.length,0);
  assert.equal((await call("/history?cursor=bad")).status,400);assert.equal((await call("/state","GET",{},{owner:{id:"other-owner"}})).status,404);
 }finally{f.db.close();}
});
test("record and configuration foreign keys reject evidence from another item atomically",async()=>{
 const f=await fixture();try{
  const {db,projectId,owner,itemId,call}=f;const other=await call("/items","POST",{details:{name:"Other part"}}),configuration=other.result.configurationId;
  const before=await counts(db),revision=f.revision();await assert.rejects(commitProjectCommand(db,{projectId,actorId:owner.id,operationId:id(),expectedRevision:revision,payload:{action:"invalid-proof"}},w=>{
   w.update("engine_items",{name:"Must roll back"},{project_id:projectId,id:itemId});w.insert("engine_records",{id:id(),project_id:projectId,item_id:itemId,configuration_id:configuration,type:"note",title:"Wrong config",fields:'{"text":"wrong"}',created_at:w.createdAt,updated_at:w.createdAt});return {};
  }),/FOREIGN KEY/);assert.deepEqual(await counts(db),before);assert.equal(f.revision(),revision);assert.equal((await call("/state")).result.items.find(row=>row.id===itemId).name,"Bracket");
 }finally{f.db.close();}
});
test("receipts written by the real-D1-proven first version still replay after the refactor",async()=>{
 const f=await fixture();try{
  const {db,projectId,owner}=f,input={projectId,actorId:owner.id,operationId:id(),expectedRevision:f.revision(),payload:{action:"v1-request"}},result={revision:id(),saved:"original"};
  const hash=await sha256(canonicalJSON({projectId,actorId:owner.id,expectedRevision:input.expectedRevision,payload:input.payload}));await db.prepare("INSERT INTO engine_operations VALUES(?,?,?,?,?,?,?)").bind(projectId,owner.id,input.operationId,hash,id(),JSON.stringify(result),new Date().toISOString()).run();assert.deepEqual(await replayProjectCommand(db,input),{result});
 }finally{f.db.close();}
});
test("record validation requires substance, preserves explicit event date and rejects unknown prompts",()=>{
 for(const value of [{type:"problem",fields:{status:"open"}},{type:"note",fields:{text:" "}},{type:"__proto__"},{type:"note",fields:null},{type:"note",fields:{text:"ok"},fileIds:null},{type:"test",fields:{unknown:"bad"}}])assert.throws(()=>normalizeProjectRecord(value));
 const record=normalizeProjectRecord({type:"test",fields:{checked:"Bracket",result:"0 mm deflection"},event_date:"2026-11-22"});assert.equal(record.event_date,"2026-11-22");assert.deepEqual(normalizeProjectRecord(record),record);assert.throws(()=>normalizeProjectRecord({...record,event_date:"2026-02-30"}));
 const attached=normalizeProjectRecord({type:"note",fileIds:[id()]});assert.equal(attached.title,"Note with attachments");assert.deepEqual(normalizeProjectRecord(attached),attached);
});

test("file replacement never overwrites old bytes and interrupted upload cannot publish a broken link",async()=>{
 const f=await fixture();try{
  const first=await upload(f,"drawing-a.dat",new TextEncoder().encode("3 mm drawing"));
  const record=await f.call("/items/"+f.itemId+"/records","POST",{record:{type:"test",fields:{result:"First drawing tested"}}});
  const interrupted=await f.call("/files/prepare","POST",{name:"incomplete.dat"});assert.equal((await f.call("/files/"+interrupted.result.fileId+"/admit","POST",{role:"engineering",itemId:f.itemId})).status,409);
  const second=await upload(f,"drawing-b.dat",new TextEncoder().encode("5 mm drawing"));
  const detail=(await f.call("/history/"+record.result.eventId)).result;assert.equal(detail.configurations[0].snapshot.file.id,first.fileId);
  const get=async fileId=>handleProjectWorkspace(new Request(origin+"/api/project-engine/projects/"+f.projectId+"/files/"+fileId),f.env,f.owner);
  assert.equal(await(await get(first.fileId)).text(),"3 mm drawing");assert.equal(await(await get(second.fileId)).text(),"5 mm drawing");
  const state=(await f.call("/state")).result;assert.equal(state.file_links.filter(link=>link.item_id===f.itemId&&link.active).length,1);assert.equal(state.file_links.find(link=>link.item_id===f.itemId&&link.active).file_id,second.fileId);
  assert.equal((await first.send()).status,200,"lost-response upload can replay after admission and subsequent commands");
  const file=state.files.find(file=>file.id===first.fileId);assert.equal(new TextDecoder().decode(f.env.PHOTOS.objects.get(file.r2_key).bytes),"3 mm drawing");
  const changed=new Request(origin+"/api/project-engine/projects/"+f.projectId+"/files/"+first.fileId+"/bytes",{method:"PUT",headers:{origin,"x-operation-id":id(),"x-project-revision":f.revision()},body:"different"});assert.equal((await handleProjectWorkspace(changed,f.env,f.owner)).status,409);
 }finally{f.db.close();}
});
test("self-contained backup restores IDs, history, configuration values and independent file bytes into an empty target",async()=>{
 const f=await fixture(),target={WORKSHOP_DB:new TestD1(),PHOTOS:new TestR2()};try{
  const first=await upload(f,"old.dat",new TextEncoder().encode("old drawing")),attachment=await upload(f,"measurement.txt",new TextEncoder().encode("Measured 3.00 mm"),"support");
  const step=await f.call("/items/"+f.itemId+"/steps","POST",{title:"Measure",body:"Use calipers"});
  await f.call("/items/"+f.itemId+"/records","POST",{stepId:step.result.stepId,record:{type:"test",fields:{result:"3 mm"},fileIds:[attachment.fileId]}});
  const next=structuredClone(f.details);next.part_number="NR100";next.fields.specs[0].value=5;await f.call("/items/"+f.itemId+"/revisions","POST",{details:next,reason:"Stiffen"});
  await upload(f,"new.dat",new TextEncoder().encode("new drawing"));await f.call("/steps/"+step.result.stepId+"/retire","POST");await f.call("/items/"+f.itemId+"/archive","POST");
  const url=origin+"/api/project-engine/projects/"+f.projectId,backupResponse=await handleProjectWorkspace(new Request(url+"/export"),f.env,f.owner);assert.equal(backupResponse.status,200);const backup=await backupResponse.text();
  const operationId=id(),restore=()=>new Request(url+"/import",{method:"POST",headers:{origin,"x-operation-id":operationId,"x-project-revision":"new"},body:backup});
  const restored=await handleProjectWorkspace(restore(),target,f.owner);assert.equal(restored.status,200,await restored.clone().text());const result=await restored.json();assert.equal(result.verifiedFiles,3);assert.notEqual(result.revision,f.revision());
  const exported=async env=>JSON.parse((await(await handleProjectWorkspace(new Request(url+"/export"),env,f.owner)).text()).split("\n")[0]).manifest;
  const a=await exported(f.env),b=await exported(target);for(const value of [a,b]){delete value.project.revision;for(const file of value.tables.files)delete file.r2_key;}
  assert.deepEqual(b,a);assert.equal((await target.WORKSHOP_DB.prepare("SELECT COUNT(*) AS n FROM engine_operations").first()).n,1);
  const replay=await handleProjectWorkspace(restore(),target,f.owner);assert.deepEqual(await replay.json(),result);
  assert.equal((await handleProjectWorkspace(restore(),f.env,f.owner)).status,409,"never overwrite an existing source project");
  const file=await target.WORKSHOP_DB.prepare("SELECT * FROM engine_files WHERE id=?").bind(first.fileId).first();assert.equal(new TextDecoder().decode(target.PHOTOS.objects.get(file.r2_key).bytes),"old drawing");assert.ok(!f.env.PHOTOS.objects.has(file.r2_key),"restored storage is independent of source object keys");
 }finally{f.db.close();target.WORKSHOP_DB.close();}
});
test("truncated or corrupt backup never admits project metadata",async()=>{
 const f=await fixture(),target={WORKSHOP_DB:new TestD1(),PHOTOS:new TestR2()};try{
  await upload(f,"drawing.dat",new TextEncoder().encode("drawing"));const url=origin+"/api/project-engine/projects/"+f.projectId,backup=await(await handleProjectWorkspace(new Request(url+"/export"),f.env,f.owner)).text();
  for(const body of [backup.replace('{"type":"complete"}\n',""),backup.replace('"data":"ZHJhd2luZw=="','"data":"Y29ycnVwdA=="')]){
   const response=await handleProjectWorkspace(new Request(url+"/import",{method:"POST",headers:{origin,"x-operation-id":id(),"x-project-revision":"new"},body}),target,f.owner);assert.equal(response.status,400,await response.clone().text());assert.equal((await target.WORKSHOP_DB.prepare("SELECT COUNT(*) AS n FROM engine_projects").first()).n,0);assert.equal((await target.WORKSHOP_DB.prepare("SELECT COUNT(*) AS n FROM engine_operations").first()).n,0);
  }
 }finally{f.db.close();target.WORKSHOP_DB.close();}
});

test("design configurations ignore build state and project names while each record freezes its context",async()=>{
 const f=await fixture();try{
  const first=await f.call("/items/"+f.itemId+"/records","POST",{record:{type:"test",title:"Initial bracket test",fields:{result:"Baseline"}}});assert.equal(first.status,200);
  const build={quantity:4,unit:"pcs",build_status:"complete",attention:true,attention_note:"Inspect fixture",hidden:true};
  assert.equal((await f.call("/items/"+f.itemId,"PATCH",{build})).status,200);
  const second=await f.call("/items/"+f.itemId+"/records","POST",{record:{type:"test",fields:{result:"Same design after completion"}}});assert.equal(second.status,200);
  assert.equal((await f.call("","PATCH",{name:"Renamed project"})).status,200);
  const third=await f.call("/items/"+f.itemId+"/records","POST",{record:{type:"test",fields:{result:"Same design after project rename"}}});assert.equal(third.status,200);
  assert.equal(first.result.configurationId,second.result.configurationId);assert.equal(first.result.configurationId,third.result.configurationId);assert.equal((await counts(f.db)).configurations,1);
  const read=async result=>(await f.call("/history/"+result.eventId)).result;
  const a=await read(first.result),b=await read(second.result),c=await read(third.result);
  assert.equal(a.configurations[0].snapshot.format,2);assert.equal(a.configurations[0].snapshot.occurrence,undefined);
  assert.equal(a.recordContext.project.name,"Bracket build");assert.equal(a.recordContext.occurrence.build_status,"not_started");assert.equal(a.recordContext.occurrence.quantity,1);
  assert.equal(b.recordContext.project.name,"Bracket build");assert.deepEqual({...b.recordContext.occurrence,id:undefined},{...build,id:undefined});
  assert.equal(c.recordContext.project.name,"Renamed project");assert.equal(c.recordContext.occurrence.build_status,"complete");
  const next=structuredClone(f.details);next.part_number="NR100";next.fields.specs[0].value=5;
  assert.equal((await f.call("/items/"+f.itemId,"PATCH",{details:next})).status,200);
  const changed=await f.call("/items/"+f.itemId+"/records","POST",{record:{type:"test",fields:{result:"Different design"}}});assert.equal(changed.status,200);assert.notEqual(changed.result.configurationId,first.result.configurationId);assert.equal((await counts(f.db)).configurations,2);
  assert.deepEqual(await read(first.result),a,"later design/build/project changes cannot rewrite an earlier capture");
 }finally{f.db.close();}
});
test("record retry replays its original design and context before checking a newer project revision",async()=>{
 const f=await fixture();try{
  const operationId=id(),revision=f.revision(),record={type:"test",title:"Captured test",fields:{result:"Initial result"}};
  const created=await f.call("/items/"+f.itemId+"/records","POST",{record},{operationId,revision});assert.equal(created.status,200);
  const original=(await f.call("/history/"+created.result.eventId)).result;
  await f.call("/items/"+f.itemId,"PATCH",{build:{build_status:"complete",quantity:8}});
  await f.call("","PATCH",{name:"Later project label"});const latest=f.revision(),before=await counts(f.db);
  const replay=await f.call("/items/"+f.itemId+"/records","POST",{record},{operationId,revision});
  assert.equal(replay.status,200);assert.deepEqual(replay.result,created.result);assert.deepEqual(await counts(f.db),before);
  const changed=await f.call("/records/"+created.result.recordId,"PATCH",{record:{...record,fields:{result:"Corrected result"}}},{revision:latest});assert.equal(changed.status,200);
  const after=(await f.call("/history/"+created.result.eventId)).result;
  assert.deepEqual(after.recordContext,original.recordContext);assert.equal(after.record.configuration_id,original.record.configuration_id);assert.equal(after.record.fields.result,"Corrected result");
  assert.equal(after.recordContext.occurrence.build_status,"not_started");assert.equal(after.recordContext.project.name,"Bracket build");
 }finally{f.db.close();}
});
test("legacy combined snapshots stay unchanged beside design-only captures and round-trip through recovery",async()=>{
 const f=await fixture(),target={WORKSHOP_DB:new TestD1(),PHOTOS:new TestR2()};try{
  const state=(await f.call("/state")).result,occ=state.occurrences[0],row=await f.db.prepare("SELECT * FROM engine_configurations WHERE project_id=?").bind(f.projectId).first();
  const legacy={...JSON.parse(row.snapshot),format:1,occurrence:{id:occ.id,quantity:occ.quantity,unit:occ.unit,build_status:occ.build_status,attention:!!occ.attention,attention_note:occ.attention_note,hidden:!!occ.hidden,root:{id:f.projectId,name:state.project.name}}};
  const snapshot=JSON.stringify(legacy),fingerprint=await sha256(canonicalJSON(legacy)),recordId=id(),eventId=id();
  await f.db.prepare("UPDATE engine_configurations SET snapshot=?,fingerprint=? WHERE id=?").bind(snapshot,fingerprint,row.id).run();
  await f.db.prepare("INSERT INTO engine_records(id,project_id,item_id,configuration_id,type,title,fields,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)").bind(recordId,f.projectId,f.itemId,row.id,"test","Legacy evidence",JSON.stringify({result:"Original legacy test"}),row.created_at,row.created_at).run();
  await f.db.prepare("INSERT INTO engine_events(id,project_id,item_id,type,title,summary,payload,created_at) VALUES(?,?,?,?,?,?,?,?)").bind(eventId,f.projectId,f.itemId,"test","Legacy evidence","",JSON.stringify({record_id:recordId,configuration_id:row.id}),row.created_at).run();
  const revision=await f.call("/items/"+f.itemId+"/revisions","POST",{build:{build_status:"complete"},reason:"Build checkpoint"});assert.equal(revision.status,200,JSON.stringify(revision));
  const change=(await f.call("/history/"+revision.result.eventId)).result;assert.equal(change.event.payload.before,change.event.payload.after,"unchanged design uses one configuration even at the legacy boundary");assert.equal((await counts(f.db)).configurations,2);
  assert.equal(change.event.payload.build_context.before.occurrence.build_status,"not_started");assert.equal(change.event.payload.build_context.after.occurrence.build_status,"complete");
  const fresh=await f.call("/items/"+f.itemId+"/records","POST",{record:{type:"test",fields:{result:"New capture"}}});assert.equal(fresh.status,200);assert.equal(fresh.result.configurationId,change.event.payload.after);
  const oldRow=await f.db.prepare("SELECT * FROM engine_configurations WHERE id=?").bind(row.id).first();assert.equal(oldRow.snapshot,snapshot);assert.equal(oldRow.fingerprint,fingerprint);
  const old=(await f.call("/history/"+eventId)).result;assert.equal(old.recordContext.legacy,true);assert.equal(old.recordContext.occurrence.build_status,"not_started");
  const editedLegacy=await f.call("/records/"+recordId,"PATCH",{record:{type:"test",fields:{result:"Corrected legacy result"}}});assert.equal(editedLegacy.status,200);
  const legacyAudit=(await f.call("/history/"+editedLegacy.result.eventId)).result;assert.equal(legacyAudit.recordContext.legacy,true);assert.equal(legacyAudit.event.payload.configuration_id,row.id);assert.equal(legacyAudit.event.payload.record_edit.before.fields.result,"Original legacy test");
  const base=origin+"/api/project-engine/projects/"+f.projectId,backup=await(await handleProjectWorkspace(new Request(base+"/export"),f.env,f.owner)).text();
  const response=await handleProjectWorkspace(new Request(base+"/import",{method:"POST",headers:{origin,"x-operation-id":id(),"x-project-revision":"new"},body:backup}),target,f.owner);assert.equal(response.status,200,await response.clone().text());
  const read=async id=>(await(await handleProjectWorkspace(new Request(base+"/history/"+id),target,f.owner)).json());
  assert.equal((await read(eventId)).configurations[0].snapshot.format,1);assert.equal((await read(eventId)).recordContext.legacy,true);
  const restored=await read(fresh.result.eventId);assert.equal(restored.configurations[0].snapshot.format,2);assert.equal(restored.recordContext.occurrence.build_status,"complete");assert.equal(restored.recordContext.project.name,"Bracket build");
  const restoredLegacy=await target.WORKSHOP_DB.prepare("SELECT snapshot,fingerprint FROM engine_configurations WHERE id=?").bind(row.id).first();assert.equal(restoredLegacy.snapshot,snapshot);assert.equal(restoredLegacy.fingerprint,fingerprint);
 }finally{f.db.close();target.WORKSHOP_DB.close();}
});

test("record edit history freezes both versions, evidence context and removed attachments through recovery",async()=>{
 const f=await fixture(),target={WORKSHOP_DB:new TestD1(),PHOTOS:new TestR2()};try{
  const a=await upload(f,"before.txt",new TextEncoder().encode("original measurement"),"support"),b=await upload(f,"after.txt",new TextEncoder().encode("corrected measurement"),"support");
  const before={type:"test",title:"Measured bracket",fields:{checked:"Bracket",result:"ok"},event_date:"2026-11-22",fileIds:[a.fileId]};
  const created=await f.call("/items/"+f.itemId+"/records","POST",{record:before});assert.equal(created.status,200);
  const capture=(await f.call("/history/"+created.result.eventId)).result;
  await f.call("/items/"+f.itemId,"PATCH",{build:{build_status:"complete",quantity:9}});await f.call("","PATCH",{name:"Later project name"});
  const after={type:"problem",title:"Failed bracket",fields:{happened:"FAILED",status:"open"},event_date:"2026-11-23",fileIds:[b.fileId]};
  const changed=await f.call("/records/"+created.result.recordId,"PATCH",{record:after});assert.equal(changed.status,200,JSON.stringify(changed));
  const audit=(await f.call("/history/"+changed.result.eventId)).result,payload=audit.event.payload;
  assert.equal(audit.event.type,"record_edited");assert.equal(audit.record,null);assert.equal(payload.edited_record_id,created.result.recordId);assert.equal(payload.record_event_id,created.result.eventId);assert.equal(payload.actor_id,f.owner.id);
  assert.deepEqual(payload.record_edit.before,normalizeProjectRecord(before));assert.deepEqual(payload.record_edit.after,normalizeProjectRecord(after));
  assert.equal(payload.configuration_id,created.result.configurationId);assert.deepEqual(audit.recordContext,capture.recordContext);assert.equal(audit.recordContext.occurrence.build_status,"not_started");assert.equal(audit.recordContext.project.name,"Bracket build");
  assert.deepEqual(audit.attachments.map(file=>file.id).sort(),[a.fileId,b.fileId].sort());assert.equal(audit.configurations[0].id,created.result.configurationId);
  const later=await f.call("/records/"+created.result.recordId,"PATCH",{record:{type:"note",fields:{text:"Later explanation"}}});assert.equal(later.status,200);
  assert.deepEqual((await f.call("/history/"+changed.result.eventId)).result,audit,"later edits cannot rewrite the audit");
  const state=(await f.call("/state")).result;assert.deepEqual(state.record_events.filter(row=>row.record_id===created.result.recordId),[{id:created.result.eventId,record_id:created.result.recordId}]);
  const current=(await f.call("/history/"+created.result.eventId)).result;assert.equal(current.record.type,"note");assert.equal(current.record.id,created.result.recordId);
  assert.equal((await f.call("/history?type=changes&q=ok")).result.entries.some(row=>row.id===changed.result.eventId),true,"search includes the saved old result");
  const base=origin+"/api/project-engine/projects/"+f.projectId;
  for(const [fileId,bytes]of [[a.fileId,"original measurement"],[b.fileId,"corrected measurement"]])assert.equal(await(await handleProjectWorkspace(new Request(base+"/files/"+fileId),f.env,f.owner)).text(),bytes);
  const backup=await(await handleProjectWorkspace(new Request(base+"/export"),f.env,f.owner)).text();
  const response=await handleProjectWorkspace(new Request(base+"/import",{method:"POST",headers:{origin,"x-operation-id":id(),"x-project-revision":"new"},body:backup}),target,f.owner);assert.equal(response.status,200,await response.clone().text());
  const restored=await(await handleProjectWorkspace(new Request(base+"/history/"+changed.result.eventId),target,f.owner)).json();assert.deepEqual({...restored,attachments:restored.attachments.map(({r2_key,...file})=>file)},{...audit,attachments:audit.attachments.map(({r2_key,...file})=>file)});for(const file of restored.attachments)assert.notEqual(file.r2_key,audit.attachments.find(old=>old.id===file.id).r2_key);
 }finally{f.db.close();target.WORKSHOP_DB.close();}
});
test("record audit is absent on no-op or stale save and exact retries replay one saved edit",async()=>{
 const f=await fixture();try{
  const before={type:"test",title:"Result",fields:{result:"ok"}},created=await f.call("/items/"+f.itemId+"/records","POST",{record:before});assert.equal(created.status,200);
  const path="/records/"+created.result.recordId,initial=await counts(f.db),token=f.revision();
  const noop=await f.call(path,"PATCH",{record:before});assert.equal(noop.result.noop,true);assert.deepEqual(await counts(f.db),initial);assert.equal(f.revision(),token);
  const operationId=id(),after={...before,fields:{result:"FAILED"}},changed=await f.call(path,"PATCH",{record:after},{operationId,revision:token});assert.equal(changed.status,200);
  assert.equal((await counts(f.db)).events,initial.events+1);await f.call("","PATCH",{name:"Renamed after edit"});const latest=f.revision(),savedCounts=await counts(f.db);
  assert.equal((await f.call(path,"PATCH",{record:{...after,title:"Stale draft"}},{revision:token})).status,409);
  const replay=await f.call(path,"PATCH",{record:after},{operationId,revision:token});assert.deepEqual(replay.result,changed.result);
  assert.equal((await f.call(path,"PATCH",{record:before},{operationId,revision:token})).status,409);assert.deepEqual(await counts(f.db),savedCounts);
  const state=(await f.call("/state")).result;assert.equal(state.project.revision,latest);assert.equal(state.records[0].fields.result,"FAILED");
  assert.equal((await f.call("/history?type=changes")).result.entries.filter(row=>row.type==="record_edited").length,1);
 }finally{f.db.close();}
});
test("record edit and attachment changes roll back when their audit write fails",async()=>{
 const f=await fixture();try{
  const a=await upload(f,"original.txt",new TextEncoder().encode("original bytes"),"support"),b=await upload(f,"new.txt",new TextEncoder().encode("new bytes"),"support");
  const created=await f.call("/items/"+f.itemId+"/records","POST",{record:{type:"test",fields:{result:"ok"},fileIds:[a.fileId]}});assert.equal(created.status,200);
  const state=(await f.call("/state")).result,before=await counts(f.db);
  f.db.sqlite.exec("CREATE TRIGGER reject_record_audit BEFORE INSERT ON engine_events WHEN NEW.type='record_edited' BEGIN SELECT RAISE(ABORT,'SQLITE forced audit failure'); END");
  const failed=await f.call("/records/"+created.result.recordId,"PATCH",{record:{type:"test",fields:{result:"FAILED"},fileIds:[b.fileId]}});assert.equal(failed.status,500);
  assert.deepEqual((await f.call("/state")).result,state);assert.deepEqual(await counts(f.db),before);
 }finally{f.db.close();}
});



test("numbered revisions preserve the complete previous part and standard Save keeps the working level",async()=>{
 const f=await fixture();try{
  const {call,itemId}=f,step=await call("/items/"+itemId+"/steps","POST",{title:"Load test",body:"Use the original fixture"}),record=await call("/items/"+itemId+"/records","POST",{stepId:step.result.stepId,record:{type:"test",title:"Original result",fields:{checked:"3 mm bracket",result:"Held 2 kg"}}});assert.equal(step.status,200);assert.equal(record.status,200);
  const file=await upload(f,"original.dat",new TextEncoder().encode("old immutable drawing"));
  const first=await call("/items/"+itemId+"/revisions","POST",{entryDetails:{whatChanged:"About to improve the bracket",whyChanged:"Reduce flex",notes:"Retest"}});assert.equal(first.status,200,JSON.stringify(first));
  let state=(await call("/state")).result;assert.equal(state.items[0].revision_level,2);assert.equal(state.items[0].fields.specs[0].value,3);
  const saved=(await call("/history/"+first.result.eventId)).result.event;assert.equal(saved.payload.level,1);assert.equal(saved.payload.snapshot.item.revision_level,1);assert.equal(saved.payload.snapshot.steps[0].body,"Use the original fixture");assert.equal(saved.payload.snapshot.records[0].fields.result,"Held 2 kg");assert.ok(saved.payload.snapshot.files.some(row=>row.id===file.fileId));
  const ordinary={...f.details,part_number:"NR100",fields:{...f.details.fields,specs:[{field_id:"thickness",label:"Thickness",value:5,unit:"mm"}]}};assert.equal((await call("/items/"+itemId,"PATCH",{details:ordinary})).status,200);assert.equal((await call("/state")).result.items[0].revision_level,2);assert.equal((await call("/history?type=revisions")).result.entries.length,1);
  assert.equal((await call("/steps/"+step.result.stepId,"PATCH",{body:"Later instructions"})).status,200);const revised={...ordinary,fields:{...ordinary.fields,purpose:"Changed purpose"}},operationId=id(),revision=f.revision();const second=await call("/items/"+itemId+"/revisions","POST",{details:revised,entryDetails:{whatChanged:"Changed purpose"}},{operationId,revision});assert.equal(second.status,200,JSON.stringify(second));
  const repeat=await call("/items/"+itemId+"/revisions","POST",{details:revised,entryDetails:{whatChanged:"Changed purpose"}},{operationId,revision});assert.deepEqual(repeat.result,second.result);state=(await call("/state")).result;assert.equal(state.items[0].revision_level,3);
  const secondCopy=(await call("/history/"+second.result.eventId)).result.event;assert.equal(secondCopy.payload.level,2);assert.equal(secondCopy.payload.snapshot.item.fields.specs[0].value,5);assert.equal(secondCopy.payload.snapshot.item.fields.purpose,undefined);assert.deepEqual((await call("/history/"+first.result.eventId)).result.event.payload.snapshot,saved.payload.snapshot);
 }finally{f.db.close();}
});

test("archive is not a revision, preserves its complete copy and permanently reserves padded number aliases",async()=>{
 const f=await fixture();try{
  const {call,itemId}=f;assert.equal((await call("/items/"+itemId+"/revisions","POST",{})).status,200);let state=(await call("/state")).result;const original=state.items[0],occurrence=state.occurrences[0];
  const archived=await call("/items/"+itemId+"/archive","POST",{entryDetails:{whyChanged:"Replaced this design",notes:"Keep the complete record"}});assert.equal(archived.status,200,JSON.stringify(archived));const entry=(await call("/history/"+archived.result.eventId)).result.event;assert.equal(entry.type,"archived");assert.equal(entry.payload.snapshot.item.revision_level,2);assert.equal(entry.payload.entryDetails.notes,"Keep the complete record");
  assert.equal((await call("/history?type=revisions")).result.entries.length,1);assert.equal((await call("/state")).result.items[0].revision_level,2);
  for(const number of ["NR100","nr0100","NR000100"])assert.equal((await call("/items","POST",{assignNumber:false,details:{...f.details,part_number:number}})).status,409);
  const next=await call("/items","POST",{details:f.details});assert.equal(next.status,200);state=(await call("/state")).result;assert.equal(state.items.find(item=>item.id===next.result.itemId).part_number,"NR101");assert.equal((await call("/items/"+itemId+"/restore","POST")).status,200);state=(await call("/state")).result;assert.equal(state.items.find(item=>item.id===itemId).part_number,original.part_number);assert.equal(state.items.find(item=>item.id===itemId).revision_level,2);assert.equal(state.occurrences.find(row=>row.item_id===itemId).id,occurrence.id);
  assert.equal((await call("/items/"+itemId,"PATCH",{details:{...f.details,part_number:"NR500"}})).status,409);
 }finally{f.db.close();}
});

test("history images are owned by the project and invalid evidence cannot advance a revision",async()=>{
 const f=await fixture();try{
  const {call,itemId,db}=f,before=await counts(db),revision=f.revision();for(const entryDetails of [{photos:[id()]},{notes:"x".repeat(5001)},{photos:[],photoNames:{[id()]:"Unowned"}}]){assert.equal((await call("/items/"+itemId+"/revisions","POST",{entryDetails})).status,400);assert.deepEqual(await counts(db),before);assert.equal(f.revision(),revision);assert.equal((await call("/state")).result.items[0].revision_level,1);}
 }finally{f.db.close();}
});

test("forged staging metadata cannot substitute corrupt bytes during backup restore",async()=>{
 const f=await fixture(),target={WORKSHOP_DB:new TestD1(),PHOTOS:new TestR2()};try{
  const uploaded=await upload(f,"drawing.dat",new TextEncoder().encode("original bytes")),backup=await(await handleProjectWorkspace(new Request(origin+"/api/project-engine/projects/"+f.projectId+"/export"),f.env,f.owner)).text(),manifest=JSON.parse(backup.split("\n")[0]).manifest,operationId=id(),file=manifest.tables.files.find(row=>row.id===uploaded.fileId);
  await target.PHOTOS.put("project-engine/restored/"+f.projectId+"/"+operationId+"/"+file.id,new TextEncoder().encode("corrupt! bytes"),{customMetadata:{sha256:file.sha256}});
  const response=await handleProjectWorkspace(new Request(origin+"/api/project-engine/projects/"+f.projectId+"/import",{method:"POST",headers:{origin,"x-operation-id":operationId,"x-project-revision":"new"},body:backup}),target,f.owner);assert.equal(response.status,400,await response.clone().text());assert.match((await response.json()).error,/byte verification/);assert.equal((await target.WORKSHOP_DB.prepare("SELECT COUNT(*) AS n FROM engine_projects").first()).n,0);assert.equal((await target.WORKSHOP_DB.prepare("SELECT COUNT(*) AS n FROM engine_operations").first()).n,0);
 }finally{f.db.close();target.WORKSHOP_DB.close();}
});
