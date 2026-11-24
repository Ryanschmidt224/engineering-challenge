import {test} from "node:test";
import assert from "node:assert/strict";
import {fixture,upload} from "./helpers/project-workspace.mjs";
import {handleProjectWorkspace} from "../functions/api/project-workspace-api.js";
import {expandProjectSnapshot} from "../functions/api/project-snapshot-values.js";
const origin="https://preview.example.test",base=origin+"/api/project-engine/projects/",id=()=>crypto.randomUUID();
const saved=async(f,eventId)=>(await f.call("/history/"+eventId)).result.event.payload.snapshot;
const raw=async(f,eventId)=>JSON.parse((await f.db.prepare("SELECT payload FROM engine_events WHERE project_id=? AND id=?").bind(f.projectId,eventId).first()).payload).snapshot;
const valueCount=async f=>(await f.db.prepare("SELECT count(*) AS n FROM engine_snapshot_values WHERE project_id=?").bind(f.projectId).first()).n;

for(const assembly of [false,true])test("1000 records can be revised, archived and recovered with exact earlier evidence on a "+(assembly?"parent assembly":"part"),async()=>{
 const f=await fixture();try{
  const file=await upload(f,"retained-drawing.step",new TextEncoder().encode("Exact original engineering bytes"));
  let target=f.itemId;if(assembly){const added=await f.call("/items","POST",{details:{name:"Parent assembly",is_assembly:true}});assert.equal(added.status,200);target=added.result.itemId;const placement=(await f.call("/state")).result.occurrences.find(row=>row.item_id===f.itemId);assert.equal((await f.call("/occurrences/"+placement.id,"PATCH",{parentId:added.result.occurrenceId})).status,200);}
  const part=snapshot=>assembly?snapshot.parts.find(row=>row.item.id===f.itemId):snapshot;
  let firstRecord,early;
  for(let n=0;n<1000;n++){
   const created=await f.call("/items/"+f.itemId+"/records","POST",{record:{type:"note",title:"Observation "+n,fields:{text:"Record "+n+" "+"e".repeat(600)}}});assert.equal(created.status,200,JSON.stringify(created));if(n===0)firstRecord=created.result.recordId;
   if(n===49){early=await f.call("/items/"+target+"/revisions","POST",{entryDetails:{whatChanged:"First 50 observations"}});assert.equal(early.status,200,JSON.stringify(early));}
  }
  const revised=await f.call("/items/"+target+"/revisions","POST",{entryDetails:{whatChanged:"1000 observations"}});assert.equal(revised.status,200,JSON.stringify(revised));
  const before=await saved(f,revised.result.eventId),small=await saved(f,early.result.eventId),stored=await raw(f,revised.result.eventId),count=await valueCount(f);
  assert.equal(part(before).records.length,1000);assert.equal(part(small).records.length,50);assert.equal(part(stored).records,undefined);assert.equal(part(stored).references.records.length,1000);assert.ok(JSON.stringify(stored).length<120000,"Stored checkpoint contains references, not repeated note bodies");
  assert.equal((await f.call("/records/"+firstRecord,"PATCH",{record:{type:"note",title:"Later correction",fields:{text:"Corrected after the revision"}}})).status,200);
  assert.deepEqual(await saved(f,early.result.eventId),small);assert.deepEqual(await saved(f,revised.result.eventId),before);
  const token=f.revision(),operationId=id(),archived=await f.call("/items/"+target+"/archive","POST",{}, {revision:token,operationId});assert.equal(archived.status,200,JSON.stringify(archived));
  const after=await saved(f,archived.result.eventId);assert.equal(part(after).records.length,1000);assert.equal(part(after).records.find(row=>row.id===firstRecord).title,"Later correction");assert.equal(part(after).record_events.filter(row=>row.payload.edited_record_id===firstRecord).length,1);assert.equal(await valueCount(f),count+2,"Only the changed record and its new audit need new frozen values");
  const retry=await f.call("/items/"+target+"/archive","POST",{}, {revision:token,operationId});assert.deepEqual(retry.result,archived.result);assert.equal(await valueCount(f),count+2);
  const exported=await handleProjectWorkspace(new Request(base+f.projectId+"/export"),f.env,f.owner);assert.equal(exported.status,200,await exported.clone().text());const backup=await exported.text(),copy=id();assert.equal(JSON.parse(backup.split("\n")[0]).manifest.version,2);
  const partial=id(),cut=backup.indexOf('{"type":"metadata_complete"}'),incomplete=await handleProjectWorkspace(new Request(base+partial+"/import-copy?name=Incomplete",{method:"POST",headers:{origin,"x-operation-id":id(),"x-project-revision":"new"},body:backup.slice(0,cut)}),f.env,f.owner);assert.notEqual(incomplete.status,200);assert.equal(await f.db.prepare("SELECT id FROM engine_projects WHERE id=?").bind(partial).first(),null);
  const restored=await handleProjectWorkspace(new Request(base+copy+"/import-copy?name=Large%20recovered%20project",{method:"POST",headers:{origin,"x-operation-id":id(),"x-project-revision":"new"},body:backup}),f.env,f.owner);assert.equal(restored.status,200,await restored.clone().text());
  for(const [eventId,expected]of [[early.result.eventId,small],[revised.result.eventId,before],[archived.result.eventId,after]]){
   const detail=await(await handleProjectWorkspace(new Request(base+copy+"/history/"+eventId),f.env,f.owner)).json();assert.deepEqual(detail.event.payload.snapshot,expected);
  }
  assert.equal(await(await handleProjectWorkspace(new Request(base+copy+"/files/"+file.fileId),f.env,f.owner)).text(),"Exact original engineering bytes");
 }finally{f.db.close();}
});

test("inline historical snapshots coexist unchanged with referenced checkpoints through named recovery",async()=>{
 const f=await fixture();try{
  await f.call("/items/"+f.itemId+"/records","POST",{record:{type:"note",fields:{text:"Legacy recorded text"}}});const revision=await f.call("/items/"+f.itemId+"/revisions","POST",{}),inline=structuredClone(await saved(f,revision.result.eventId)),oldId=id();inline.format=3;delete inline.references;
  const event=await f.db.prepare("SELECT * FROM engine_events WHERE project_id=? AND id=?").bind(f.projectId,revision.result.eventId).first(),payload=JSON.stringify({...JSON.parse(event.payload),snapshot:inline});f.db.sqlite.prepare("INSERT INTO engine_events(id,project_id,item_id,type,title,summary,payload,created_at) VALUES(?,?,?,?,?,?,?,?)").run(oldId,f.projectId,f.itemId,"revision","Earlier inline revision","",payload,event.created_at);
  const exported=await handleProjectWorkspace(new Request(base+f.projectId+"/export"),f.env,f.owner),backup=await exported.text(),copy=id();const response=await handleProjectWorkspace(new Request(base+copy+"/import-copy?name=Mixed%20history",{method:"POST",headers:{origin,"x-operation-id":id(),"x-project-revision":"new"},body:backup}),f.env,f.owner);assert.equal(response.status,200,await response.clone().text());
  const detail=await(await handleProjectWorkspace(new Request(base+copy+"/history/"+oldId),f.env,f.owner)).json();assert.deepEqual(detail.event.payload.snapshot,inline);assert.equal((await f.db.prepare("SELECT payload FROM engine_events WHERE project_id=? AND id=?").bind(copy,oldId).first()).payload,payload);
 }finally{f.db.close();}
});

test("snapshot values and counters roll back together on failed revision or archive and stale capture writes nothing",async()=>{
 const f=await fixture();try{
  await f.call("/items/"+f.itemId+"/records","POST",{record:{type:"note",fields:{text:"Before failure"}}});
  const count=await valueCount(f),token=f.revision(),state=(await f.call("/state")).result;
  f.db.sqlite.exec("CREATE TRIGGER fail_snapshot_event BEFORE INSERT ON engine_events WHEN NEW.type IN('revision','archived') BEGIN SELECT RAISE(ABORT,'SQLITE forced snapshot failure'); END");
  for(const action of ["revisions","archive"]){const result=await f.call("/items/"+f.itemId+"/"+action,"POST",{});assert.notEqual(result.status,200);assert.equal(await valueCount(f),count);assert.deepEqual((await f.call("/state")).result,state);assert.equal(f.revision(),token);}
  f.db.sqlite.exec("DROP TRIGGER fail_snapshot_event");await f.call("/items/"+f.itemId,"PATCH",{build:{quantity:4}});
  assert.equal((await f.call("/items/"+f.itemId+"/revisions","POST",{},{revision:token})).status,409);assert.equal(await valueCount(f),count);
 }finally{f.db.close();}
});

test("copy recovery refuses missing or corrupt snapshot values and historical readers never fall back to current records",async()=>{
 const f=await fixture();try{
  const record=await f.call("/items/"+f.itemId+"/records","POST",{record:{type:"note",fields:{text:"Preserve exactly"}}}),revised=await f.call("/items/"+f.itemId+"/revisions","POST",{});assert.equal(revised.status,200);
  const snapshot=await raw(f,revised.result.eventId),exported=await handleProjectWorkspace(new Request(base+f.projectId+"/export"),f.env,f.owner),original=(await exported.text()).trimEnd().split("\n").map(JSON.parse);
  for(const mode of ["missing","corrupt","missing-list"]){
   const lines=structuredClone(original),manifest=lines[0].manifest;
   if(mode==="missing")manifest.tables.snapshot_values=manifest.tables.snapshot_values.filter(row=>row.id!==snapshot.references.records[0]);
   if(mode==="corrupt")manifest.tables.snapshot_values.find(row=>row.id===snapshot.references.records[0]).snapshot=JSON.stringify({id:record.result.recordId,fields:{text:"Forged"}});
   if(mode==="missing-list"){const event=manifest.tables.events.find(row=>row.id===revised.result.eventId),payload=JSON.parse(event.payload);delete payload.snapshot.references.records;event.payload=JSON.stringify(payload);}
   const copy=id(),response=await handleProjectWorkspace(new Request(base+copy+"/import-copy?name=Rejected",{method:"POST",headers:{origin,"x-operation-id":id(),"x-project-revision":"new"},body:lines.map(JSON.stringify).join("\n")+"\n"}),f.env,f.owner);assert.notEqual(response.status,200);assert.equal(await f.db.prepare("SELECT id FROM engine_projects WHERE id=?").bind(copy).first(),null);
  }
  assert.deepEqual(await expandProjectSnapshot(f.db,id(),{format:3,records:[{id:"old",fields:{text:"Legacy fixed value"}}]}),{format:3,records:[{id:"old",fields:{text:"Legacy fixed value"}}]});
  await assert.rejects(expandProjectSnapshot(f.db,id(),snapshot),/missing/);
  f.db.sqlite.prepare("DELETE FROM engine_snapshot_values WHERE project_id=? AND id=?").run(f.projectId,snapshot.references.records[0]);
  const missing=await f.call("/history/"+revised.result.eventId);assert.notEqual(missing.status,200);assert.match(missing.result.error,/missing/);
 }finally{f.db.close();}
});
