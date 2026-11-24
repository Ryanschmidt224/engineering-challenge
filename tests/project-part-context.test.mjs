import {test} from "node:test";
import assert from "node:assert/strict";
import {fixture,upload,counts} from "./helpers/project-workspace.mjs";
import {handleProjectWorkspace} from "../functions/api/project-workspace-api.js";
const id=()=>crypto.randomUUID(),origin="https://preview.example.test";
test("part snapshots retain original record context, audit and file ownership through copy recovery",async()=>{
 const f=await fixture();try{
  const a=await upload(f,"original.txt",new TextEncoder().encode("original bytes"),"support"),b=await upload(f,"corrected.txt",new TextEncoder().encode("corrected bytes"),"support");
  const step=await f.call("/items/"+f.itemId+"/steps","POST",{title:"Measure bracket",body:"Original fixture"});
  const record=await f.call("/items/"+f.itemId+"/records","POST",{stepId:step.result.stepId,record:{type:"test",title:"Load test",fields:{result:"ok"},fileIds:[a.fileId]}});
  const edit=await f.call("/records/"+record.result.recordId,"PATCH",{record:{type:"test",title:"Load test",fields:{result:"FAILED"},fileIds:[b.fileId]}});assert.equal(edit.status,200);
  await f.call("/steps/"+step.result.stepId,"PATCH",{body:"Checkpoint fixture"});
  await f.call("/items/"+f.itemId,"PATCH",{build:{build_status:"complete",quantity:4}});await f.call("","PATCH",{name:"Later root"});
  const before=await counts(f.db),revision=await f.call("/items/"+f.itemId+"/revisions","POST",{entryDetails:{whatChanged:"Preserve the saved evidence"}});assert.equal(revision.status,200,JSON.stringify(revision));
  const detail=(await f.call("/history/"+revision.result.eventId)).result,event=detail.event,snapshot=event.payload.snapshot;
  assert.equal(event.payload.before,event.payload.after,"checkpoint counter is not design identity");assert.equal((await counts(f.db)).configurations,before.configurations);assert.equal(snapshot.format,5);assert.equal(snapshot.item.revision_level,1);assert.equal((await f.call("/state")).result.items[0].revision_level,2);
  assert.equal(snapshot.occurrence.build_status,"complete");assert.equal(snapshot.records[0].fields.result,"FAILED");assert.equal(snapshot.steps[0].body,"Checkpoint fixture");assert.equal(snapshot.records[0].step_snapshot.body,"Original fixture");
  const creation=snapshot.record_events.find(row=>row.id===record.result.eventId),audit=snapshot.record_events.find(row=>row.id===edit.result.eventId);assert.equal(creation.payload.record_context.occurrence.build_status,"not_started");assert.equal(creation.payload.record_context.project.name,"Bracket build");assert.equal(audit.payload.record_edit.before.fields.result,"ok");assert.equal(audit.payload.record_edit.after.fields.result,"FAILED");
  assert.equal(snapshot.record_events.every(row=>!row.payload.snapshot),true,"record history does not recursively embed full part revisions");
  assert.deepEqual(snapshot.file_links.filter(link=>link.record_id===record.result.recordId&&link.active).map(link=>link.file_id),[b.fileId]);assert.deepEqual(snapshot.file_links.filter(link=>link.event_id===edit.result.eventId).map(link=>link.file_id).sort(),[a.fileId,b.fileId].sort());
  await f.call("/records/"+record.result.recordId,"PATCH",{record:{type:"note",fields:{text:"Later record"}}});await f.call("/steps/"+step.result.stepId,"PATCH",{body:"Later fixture"});await f.call("/items/"+f.itemId,"PATCH",{build:{quantity:9}});
  assert.deepEqual((await f.call("/history/"+revision.result.eventId)).result.event.payload.snapshot,snapshot);
  const base=origin+"/api/project-engine/projects/",backup=await(await handleProjectWorkspace(new Request(base+f.projectId+"/export"),f.env,f.owner)).text(),copy=id();
  const response=await handleProjectWorkspace(new Request(base+copy+"/import-copy?name=Recovered",{method:"POST",headers:{origin,"x-operation-id":id(),"x-project-revision":"new"},body:backup}),f.env,f.owner);assert.equal(response.status,200,await response.clone().text());
  const restored=await(await handleProjectWorkspace(new Request(base+copy+"/history/"+revision.result.eventId),f.env,f.owner)).json();assert.deepEqual(restored.event.payload.snapshot,snapshot);
  for(const [fileId,bytes]of [[a.fileId,"original bytes"],[b.fileId,"corrected bytes"]])assert.equal(await(await handleProjectWorkspace(new Request(base+copy+"/files/"+fileId),f.env,f.owner)).text(),bytes);
 }finally{f.db.close();}
});
test("backups without numbered-revision columns restore without rewriting saved snapshots",async()=>{
 const f=await fixture();try{
  const base=origin+"/api/project-engine/projects/",backup=await(await handleProjectWorkspace(new Request(base+f.projectId+"/export"),f.env,f.owner)).text(),lines=backup.trimEnd().split("\n"),first=JSON.parse(lines[0]);for(const item of first.manifest.tables.items)delete item.revision_level;
  const saved=first.manifest.tables.configurations[0].snapshot;lines[0]=JSON.stringify(first);const copy=id(),response=await handleProjectWorkspace(new Request(base+copy+"/import-copy?name=Legacy",{method:"POST",headers:{origin,"x-operation-id":id(),"x-project-revision":"new"},body:lines.join("\n")+"\n"}),f.env,f.owner);assert.equal(response.status,200,await response.clone().text());
  assert.equal((await f.db.prepare("SELECT revision_level FROM engine_items WHERE project_id=?").bind(copy).first()).revision_level,1);assert.equal((await f.db.prepare("SELECT snapshot FROM engine_configurations WHERE project_id=?").bind(copy).first()).snapshot,saved);
 }finally{f.db.close();}
});

test("tests retain their recorded part level while unchanged checkpoints share design identity",async()=>{
 const f=await fixture();try{
  const first=await f.call("/items/"+f.itemId+"/records","POST",{record:{type:"test",fields:{result:"Revision 1 test"}}});
  const checkpoint=await f.call("/items/"+f.itemId+"/revisions","POST",{});assert.equal(checkpoint.status,200);
  const second=await f.call("/items/"+f.itemId+"/records","POST",{record:{type:"test",fields:{result:"Revision 2 test"}}});assert.equal(first.result.configurationId,second.result.configurationId);
  const a=(await f.call("/history/"+first.result.eventId)).result,b=(await f.call("/history/"+second.result.eventId)).result;
  assert.equal(a.recordContext.part.revision_level,1);assert.equal(b.recordContext.part.revision_level,2);assert.equal(a.recordContext.part.id,f.itemId);
  assert.equal(a.configurations[0].snapshot.item.revision_level,undefined);assert.equal((await counts(f.db)).configurations,1);
  const revision=(await f.call("/history/"+checkpoint.result.eventId)).result.event;assert.equal(revision.payload.build_context.before.part.revision_level,1);assert.equal(revision.payload.build_context.after.part.revision_level,2);
  await f.call("/records/"+first.result.recordId,"PATCH",{record:{type:"test",fields:{result:"Corrected revision 1 test"}}});assert.deepEqual((await f.call("/history/"+first.result.eventId)).result.recordContext,a.recordContext);
 }finally{f.db.close();}
});
