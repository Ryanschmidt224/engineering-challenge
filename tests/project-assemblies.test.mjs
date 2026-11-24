import {test} from "node:test";
import assert from "node:assert/strict";
import {engineFixture} from "./helpers/project-engine.mjs";
import {projectBOM} from "../assets/project-tree-model.js";
const state=async f=>(await f.call("/state")).result;
test("nested placements multiply quantities, reserve assembly numbers, and share part definitions without sharing build state",async()=>{
 const f=await engineFixture();try{
  const top=await f.add("Launcher",{assembly:true,quantity:2}),sub=await f.add("Feeder",{assembly:true,parent:top.occurrenceId,quantity:3}),part=await f.add("Bearing",{parent:sub.occurrenceId,quantity:4});
  const placed=await f.call("/items/"+part.itemId+"/placements","POST",{parentId:null,build:{quantity:1}});assert.equal(placed.status,200);
  await f.add("Instructions",{kind:"document",quantity:10});await f.add("Wrench",{is_tool:true,quantity:20});
  let s=await state(f);assert.equal(s.items.find(x=>x.id===top.itemId).part_number,"MX001");assert.equal(s.items.find(x=>x.id===sub.itemId).part_number,"MX002");assert.equal(s.items.find(x=>x.id===part.itemId).part_number,"MX100");
  const bom=projectBOM(s.items,s.occurrences);assert.equal(bom.find(x=>x.item.id===part.itemId).quantity,25);assert.equal(bom.length,3);
  assert.equal((await f.call("/occurrences/"+placed.result.occurrenceId,"PATCH",{build:{quantity:5,build_status:"complete"}})).status,200);
  s=await state(f);assert.equal(s.occurrences.find(x=>x.id===part.occurrenceId).quantity,4);assert.equal(s.occurrences.find(x=>x.id===part.occurrenceId).build_status,"not_started");
  assert.equal((await f.call("/items/"+part.itemId,"PATCH",{occurrenceId:placed.result.occurrenceId,details:{name:"Updated bearing",part_number:"MX100"}})).status,200);assert.equal((await state(f)).items.filter(x=>x.name==="Updated bearing").length,1);
  assert.equal((await f.call("/bom")).result.rows.find(x=>x.item.id===part.itemId).quantity,29);
 }finally{f.db.close();}
});
test("assembly records and revisions freeze child values, placement composition, and complete child instructions",async()=>{
 const f=await engineFixture();try{
  const top=await f.add("Assembly",{assembly:true}),part=await f.add("Plate",{parent:top.occurrenceId,quantity:2,fields:{specs:[{field_id:"thickness",label:"Thickness",unit:"mm",value:3}]}});
  await f.call("/items/"+part.itemId+"/steps","POST",{title:"Drill",body:"Old fixture"});
  const record=await f.call("/items/"+top.itemId+"/records","POST",{occurrenceId:top.occurrenceId,record:{type:"test",fields:{result:"Held 2 kg"}}});assert.equal(record.status,200,JSON.stringify(record));
  const revision=await f.call("/items/"+top.itemId+"/revisions","POST",{occurrenceId:top.occurrenceId,entryDetails:{whatChanged:"Before a stronger plate"}});assert.equal(revision.status,200,JSON.stringify(revision));
  await f.call("/items/"+part.itemId,"PATCH",{details:{name:"Plate",part_number:"MX100",fields:{specs:[{field_id:"thickness",label:"Thickness",unit:"mm",value:5}]}}});
  await f.call("/occurrences/"+part.occurrenceId,"PATCH",{build:{quantity:4}});
  const evidence=(await f.call("/history/"+record.result.eventId)).result,saved=evidence.configurations[0].snapshot.composition[0];assert.equal(saved.design.item.fields.specs[0].value,3);assert.equal(Object.hasOwn(saved.design,"occurrence"),false);assert.equal(evidence.event.payload.record_context.composition[0].quantity,2);
  const frozen=(await f.call("/history/"+revision.result.eventId)).result.event.payload.snapshot;assert.equal(frozen.composition[0].quantity,2);assert.equal(frozen.parts[0].steps[0].body,"Old fixture");assert.equal(frozen.parts[0].item.fields.specs[0].value,3);
  const s=await state(f);assert.equal(s.items.find(x=>x.id===top.itemId).revision_level,2);assert.equal(s.items.find(x=>x.id===part.itemId).revision_level,1);
 }finally{f.db.close();}
});
test("equivalent shared assembly placements reuse design identity while evidence keeps exact tested placements",async()=>{
 const f=await engineFixture();try{
  const top=await f.add("Shared drive",{assembly:true,quantity:2}),child=await f.add("Bearing",{parent:top.occurrenceId,quantity:4});
  const first=await f.call("/items/"+top.itemId+"/records","POST",{occurrenceId:top.occurrenceId,record:{type:"test",fields:{result:"First placement"}}});assert.equal(first.status,200,JSON.stringify(first));
  const copied=await f.call("/items/"+top.itemId+"/placements","POST",{build:{quantity:7,build_status:"complete",attention:true,hidden:true}});assert.equal(copied.status,200,JSON.stringify(copied));
  const second=await f.call("/items/"+top.itemId+"/records","POST",{occurrenceId:copied.result.occurrenceId,record:{type:"test",fields:{result:"Second placement"}}});assert.equal(second.status,200,JSON.stringify(second));
  assert.equal(second.result.configurationId,first.result.configurationId);
  const a=(await f.call("/history/"+first.result.eventId)).result.event.payload.record_context,b=(await f.call("/history/"+second.result.eventId)).result.event.payload.record_context;
  assert.equal(a.occurrence.id,top.occurrenceId);assert.equal(b.occurrence.id,copied.result.occurrenceId);assert.equal(a.occurrence.quantity,2);assert.equal(b.occurrence.quantity,7);assert.equal(b.occurrence.build_status,"complete");assert.equal(b.occurrence.attention,true);assert.equal(b.occurrence.hidden,true);assert.equal(b.project.name,"Mixed assembly");assert.notEqual(a.composition[0].id,b.composition[0].id);assert.equal(a.composition[0].quantity,4);assert.equal(b.composition[0].quantity,4);
  let current=await state(f);const definition=current.items.find(row=>row.id===child.itemId);assert.equal(definition.revision_level,1);
  const changed=await f.call("/items/"+child.itemId,"PATCH",{occurrenceId:child.occurrenceId,details:{name:"Bearing v2",part_number:definition.part_number}});assert.equal(changed.status,200,JSON.stringify(changed));
  const third=await f.call("/items/"+top.itemId+"/records","POST",{occurrenceId:top.occurrenceId,record:{type:"test",fields:{result:"Changed child design"}}});assert.equal(third.status,200,JSON.stringify(third));assert.notEqual(third.result.configurationId,first.result.configurationId);
  const originalDesign=(await f.call("/history/"+first.result.eventId)).result.configurations[0].snapshot.composition[0].design,newDesign=(await f.call("/history/"+third.result.eventId)).result.configurations[0].snapshot.composition[0].design;assert.equal(originalDesign.item.name,"Bearing");assert.equal(newDesign.item.name,"Bearing v2");
  current=await state(f);assert.equal(current.items.find(row=>row.id===child.itemId).revision_level,1);
 }finally{f.db.close();}
});
test("group archive and restore preserve earlier archives, other shared placements, identities, numbers, and R2 bytes",async()=>{
 const f=await engineFixture();try{
  const top=await f.add("Assembly",{assembly:true}),old=await f.add("Earlier archive",{parent:top.occurrenceId}),part=await f.add("Shared bearing",{parent:top.occurrenceId});
  const other=await f.call("/items/"+part.itemId+"/placements","POST",{build:{quantity:3}});await f.call("/occurrences/"+old.occurrenceId+"/archive","POST",{});
  const beforeKeys=[...f.env.PHOTOS.objects.keys()],preview=await f.call("/occurrences/"+top.occurrenceId+"/archive-preview");assert.equal(preview.result.members.length,2);assert.equal(preview.result.sharedPlacements,1);
  const operationId=crypto.randomUUID(),token=f.revision(),archived=await f.call("/occurrences/"+top.occurrenceId+"/archive","POST",{entryDetails:{whyChanged:"Replace assembly"}},{operationId,revision:token});assert.equal(archived.status,200,JSON.stringify(archived));
  assert.deepEqual((await f.call("/occurrences/"+top.occurrenceId+"/archive","POST",{entryDetails:{whyChanged:"Replace assembly"}},{operationId,revision:token})).result,archived.result);
  let s=await state(f);assert.equal(s.occurrences.find(x=>x.id===other.result.occurrenceId).removed_at,null);assert.notEqual(s.occurrences.find(x=>x.id===part.occurrenceId).removed_at,null);
  assert.equal((await f.call("/items","POST",{assignNumber:false,details:{name:"Cannot reuse",part_number:"mx000100"}})).status,409);
  assert.equal((await f.call("/occurrences/"+top.occurrenceId+"/restore","POST",{})).status,200);
  s=await state(f);assert.equal(s.occurrences.find(x=>x.id===part.occurrenceId).removed_at,null);assert.notEqual(s.occurrences.find(x=>x.id===old.occurrenceId).removed_at,null);assert.equal(s.items.find(x=>x.id===top.itemId).revision_level,1);assert.deepEqual([...f.env.PHOTOS.objects.keys()],beforeKeys);
  assert.equal((await f.call("/occurrences/"+old.occurrenceId+"/restore","POST",{})).status,200);
 }finally{f.db.close();}
});
test("invalid tree ownership, cycles and stale or late-failing mixed archive commands cannot partially write",async()=>{
 const f=await engineFixture();try{
  const top=await f.add("Assembly",{assembly:true}),sub=await f.add("Nested",{assembly:true,parent:top.occurrenceId}),part=await f.add("Part",{parent:sub.occurrenceId});
  assert.equal((await f.call("/occurrences/"+top.occurrenceId,"PATCH",{parentId:sub.occurrenceId})).status,400);
  assert.equal((await f.call("/items","POST",{parentId:part.occurrenceId,details:{name:"Invalid child"}})).status,400);
  assert.equal((await f.call("/items","POST",{parentId:crypto.randomUUID(),details:{name:"Foreign parent"}})).status,400);
  const before=await state(f),token=f.revision();f.db.sqlite.exec("CREATE TRIGGER fail_group_event BEFORE INSERT ON engine_events WHEN NEW.type='archived' BEGIN SELECT RAISE(ABORT,'late failure'); END");
  assert.notEqual((await f.call("/occurrences/"+top.occurrenceId+"/archive","POST",{})).status,200);assert.deepEqual(await state(f),before);assert.equal(f.revision(),token);
  f.db.sqlite.exec("DROP TRIGGER fail_group_event");await f.call("/occurrences/"+part.occurrenceId,"PATCH",{build:{quantity:2}});
  assert.equal((await f.call("/occurrences/"+top.occurrenceId+"/archive","POST",{},{revision:token})).status,409);assert.equal((await state(f)).occurrences.every(x=>x.removed_at===null),true);
 }finally{f.db.close();}
});
test("a hundred-member archive and assembly revision use bounded D1 calls and do not exceed the parameter limit",async()=>{
 const f=await engineFixture();try{
  const top=await f.add("Bounded assembly",{assembly:true});f.db.sqlite.exec("BEGIN");
  for(let n=0;n<99;n++){const item=crypto.randomUUID(),occurrence=crypto.randomUUID();f.db.sqlite.prepare("INSERT INTO engine_items(id,project_id,name,part_number,kind,source,fields,created_at) VALUES(?,?,?,?,?,?,?,?)").run(item,f.projectId,"Member "+n,"MX"+(100+n),"part","custom","{}",new Date().toISOString());f.db.sqlite.prepare("INSERT INTO engine_occurrences(id,project_id,item_id,parent_id) VALUES(?,?,?,?)").run(occurrence,f.projectId,item,top.occurrenceId);}f.db.sqlite.exec("COMMIT");
  const prepare=f.db.prepare.bind(f.db),batch=f.db.batch.bind(f.db);let calls=0;const wrapped=stmt=>({...stmt,bind:(...values)=>wrapped(stmt.bind(...values)),all:async()=>{calls++;return stmt.all();},run:async()=>{calls++;return stmt.run();},first:async()=>{calls++;return stmt.first();}});f.db.prepare=sql=>wrapped(prepare(sql));f.db.batch=async statements=>{calls++;return batch(statements);};
  const revised=await f.call("/items/"+top.itemId+"/revisions","POST",{occurrenceId:top.occurrenceId});assert.equal(revised.status,200,JSON.stringify(revised));assert.ok(calls<50,"Revision used "+calls+" D1 calls");
  calls=0;const archived=await f.call("/occurrences/"+top.occurrenceId+"/archive","POST",{});assert.equal(archived.status,200,JSON.stringify(archived));assert.equal(archived.result.members,100);assert.ok(calls<50,"Archive used "+calls+" D1 calls");
  assert.equal((await f.call("/occurrences/"+top.occurrenceId+"/restore","POST",{})).status,200);
 }finally{f.db.close();}
});
test("shared assembly placements copy active composition with fresh build status and reject definition cycles",async()=>{
 const f=await engineFixture();try{
  const top=await f.add("Drive",{assembly:true}),child=await f.add("Bearing",{parent:top.occurrenceId,quantity:4});await f.call("/occurrences/"+child.occurrenceId,"PATCH",{build:{quantity:4,build_status:"complete",attention:true}});
  assert.equal((await f.call("/items/"+top.itemId+"/placements","POST",{parentId:top.occurrenceId,build:{quantity:1}})).status,400);
  const copied=await f.call("/items/"+top.itemId+"/placements","POST",{parentId:null,build:{quantity:2}});assert.equal(copied.status,200,JSON.stringify(copied));const s=await state(f),newChild=s.occurrences.find(row=>row.parent_id===copied.result.occurrenceId);assert.equal(newChild.item_id,child.itemId);assert.equal(newChild.quantity,4);assert.equal(newChild.build_status,"not_started");assert.equal(newChild.attention,0);assert.equal(s.items.length,2);
 }finally{f.db.close();}
});
test("shared-part writes require an explicit placement instead of guessing another build context",async()=>{
 const f=await engineFixture();try{
  const part=await f.add("Shared"),other=await f.call("/items/"+part.itemId+"/placements","POST",{});assert.equal(other.status,200);const before=await state(f);
  for(const [path,data]of [["/items/"+part.itemId+"/archive",{}],["/items/"+part.itemId+"/revisions",{}],["/items/"+part.itemId+"/records",{record:{type:"test",fields:{result:"Ambiguous"}}}]]){const result=await f.call(path,"POST",data);assert.equal(result.status,400);assert.match(result.result.error,/exact placement/);}
  assert.deepEqual(await state(f),before);assert.equal((await f.call("/items/"+part.itemId+"/records","POST",{occurrenceId:other.result.occurrenceId,record:{type:"test",fields:{result:"Specific build"}}})).status,200);
 }finally{f.db.close();}
});
test("a subtree above 100 placements reports the archive limit and makes no partial writes",async()=>{
 const f=await engineFixture();try{
  const top=await f.add("Large assembly",{assembly:true}),part=await f.add("Repeated fastener",{parent:top.occurrenceId});
  const insert=f.db.sqlite.prepare("INSERT INTO engine_occurrences(id,project_id,item_id,parent_id,sort_order) VALUES(?,?,?,?,?)");for(let i=0;i<100;i++)insert.run(crypto.randomUUID(),f.projectId,part.itemId,top.occurrenceId,i+2);
  const before=JSON.stringify(await state(f)),receipts=f.db.sqlite.prepare("SELECT count(*) AS n FROM engine_operations").get().n,objects=[...f.env.PHOTOS.objects.keys()];
  for(const [path,method]of [["/archive-preview","GET"],["/archive","POST"]]){const result=await f.call("/occurrences/"+top.occurrenceId+path,method);assert.equal(result.status,400);assert.match(result.result.error,/too large to archive at once.*100 placements/);}
  assert.equal(JSON.stringify(await state(f)),before);assert.equal(f.db.sqlite.prepare("SELECT count(*) AS n FROM engine_operations").get().n,receipts);assert.deepEqual([...f.env.PHOTOS.objects.keys()],objects);
 }finally{f.db.close();}
});
