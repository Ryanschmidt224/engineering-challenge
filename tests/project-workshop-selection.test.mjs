import {test} from "node:test";
import assert from "node:assert/strict";
import {engineFixture,engineOrigin} from "./helpers/project-engine.mjs";
import {initializeWorkshop} from "../functions/api/workshop-db.js";
import {handleProjectWorkspace} from "../functions/api/project-workspace-api.js";
import {TestD1} from "./helpers/d1.mjs";
import {TestR2} from "./helpers/r2.mjs";
export async function catalog(f,{photo=true}={}){
 await initializeWorkshop(f.db);f.db.sqlite.prepare("INSERT INTO workshop_families(id,name) VALUES(?,?)").run("bearings","Bearings");
 f.db.sqlite.prepare("INSERT INTO workshop_fields(id,family_id,label,unit,type) VALUES(?,?,?,?,?)").run("bore","bearings","Bore","mm","number");
 f.db.sqlite.prepare("INSERT INTO workshop_fields(id,family_id,label,type) VALUES(?,?,?,?)").run("sealed","bearings","Sealed","boolean");
 for(const [id,name,bore]of [["bearing-a","Bearing A",8],["bearing-b","Bearing B",10]])f.db.sqlite.prepare("INSERT INTO workshop_products(id,family_id,name,manufacturer,mpn,field_values) VALUES(?,?,?,?,?,?)").run(id,"bearings",name,"Acme",id,JSON.stringify({bore,sealed:false}));
 if(photo){await f.env.PHOTOS.put("catalog/bearing-photo",new Uint8Array([1,2,3]),{httpMetadata:{contentType:"image/png"}});f.db.sqlite.prepare("INSERT INTO workshop_attachments(id,product_id,title,kind,r2_key,media_type,size) VALUES(?,?,?,?,?,?,?)").run("bearing-photo","bearing-a","Bearing photo","photo","catalog/bearing-photo","image/png",3);}
 return {familyId:"bearings",productId:"bearing-a",expectedFamilyRevision:1,expectedProductRevision:1};
}
test("Workshop choices become project-owned frozen facts, separate requirements and immutable copied files",async()=>{
 const f=await engineFixture();try{
  const selection=await catalog(f),top=await f.add("Drive",{assembly:true,quantity:2});
  const added=await f.call("/workshop-items","POST",{name:"Shaft support",parentId:top.occurrenceId,selection,requirements:{bore:7,sealed:false}});assert.equal(added.status,200,JSON.stringify(added));
  let state=(await f.call("/state")).result,item=state.items.find(x=>x.id===added.result.itemId),source=state.selections.find(x=>x.id===item.id);assert.equal(item.fields.specs.find(x=>x.field_id==="bore").value,8);assert.equal(item.fields.specs.find(x=>x.field_id==="sealed").value,false);assert.equal(source.requirements.bore,7);assert.equal(source.snapshot.fields.find(x=>x.id==="bore").different,true);
  const copied=state.files[0];assert.notEqual(copied.r2_key,"catalog/bearing-photo");assert.deepEqual([...new Uint8Array(await(await f.env.PHOTOS.get(copied.r2_key)).arrayBuffer())],[1,2,3]);
  f.db.sqlite.prepare("UPDATE workshop_products SET name='Catalog changed',field_values='{}',revision=revision+1 WHERE id='bearing-a'").run();await f.env.PHOTOS.put("catalog/bearing-photo",new Uint8Array([9]));
  state=(await f.call("/state")).result;assert.equal(state.items.find(x=>x.id===item.id).fields.specs[0].value,8);assert.equal(state.selections[0].snapshot.product.name,"Bearing A");assert.equal((await f.env.PHOTOS.get(copied.r2_key)).size,3);
  assert.equal((await f.call("/items/"+item.id,"PATCH",{occurrenceId:added.result.occurrenceId,details:{...item,name:"Project-only bearing",is_tool:false,fields:{...item.fields,description:"Project change"},id:undefined,project_id:undefined,created_at:undefined,revision_level:undefined}})).status,200);
  assert.equal((await f.db.prepare("SELECT name FROM workshop_products WHERE id='bearing-a'").first()).name,"Catalog changed");assert.equal((await f.db.prepare("SELECT count(*) AS n FROM workshop_uses").first()).n,0);
  const before=[...f.env.PHOTOS.objects].map(([key,row])=>[key,[...row.bytes]]);assert.equal((await f.call("/occurrences/"+top.occurrenceId+"/archive","POST",{})).status,200);assert.equal((await f.call("/occurrences/"+top.occurrenceId+"/restore","POST",{})).status,200);assert.deepEqual([...f.env.PHOTOS.objects].map(([key,row])=>[key,[...row.bytes]]),before);
 }finally{f.db.close();}
});
test("Workshop selections preserve legal stable field IDs beginning with a dash or underscore",async()=>{
 const f=await engineFixture();try{
  const selection=await catalog(f,{photo:false});
  for(const id of ["_enabled","-clearance"])f.db.sqlite.prepare("INSERT INTO workshop_fields(id,family_id,label,type) VALUES(?,?,?,?)").run(id,"bearings",id,"number");
  f.db.sqlite.prepare("UPDATE workshop_products SET field_values=? WHERE id='bearing-a'").run(JSON.stringify({bore:8,sealed:false,_enabled:0,"-clearance":1}));
  const added=await f.call("/workshop-items","POST",{selection,requirements:{_enabled:0,"-clearance":2}});assert.equal(added.status,200,JSON.stringify(added));
  const state=(await f.call("/state")).result;assert.equal(state.items[0].fields.specs.find(x=>x.field_id==="_enabled").value,0);assert.equal(state.items[0].fields.specs.find(x=>x.field_id==="-clearance").value,1);assert.equal(state.selections[0].requirements["-clearance"],2);
 }finally{f.db.close();}
});
test("Workshop source changes during admission reject the whole command and its retry cannot select another generation",async()=>{
 const f=await engineFixture();try{
  const selection=await catalog(f,{photo:false}),before=(await f.call("/state")).result,revision=f.revision(),operationId=crypto.randomUUID();
  const batch=f.db.batch.bind(f.db);let changed=false;f.db.batch=async statements=>{if(!changed&&statements.length>3){changed=true;f.db.sqlite.prepare("UPDATE workshop_products SET revision=2 WHERE id='bearing-a'").run();}return batch(statements);};
  const result=await f.call("/workshop-items","POST",{selection},{operationId,revision});assert.equal(result.status,409,JSON.stringify(result));assert.deepEqual((await f.call("/state")).result,before);
  assert.equal((await f.call("/workshop-items","POST",{selection},{operationId,revision})).status,409);assert.equal((await f.db.prepare("SELECT count(*) AS n FROM engine_operations").first()).n,1);
 }finally{f.db.close();}
});
test("selecting another product preserves requirements and a full numbered copy of the original product and photo",async()=>{
 const f=await engineFixture();try{
  const selection=await catalog(f),added=await f.call("/workshop-items","POST",{selection,requirements:{bore:7}});assert.equal(added.status,200);
  const changed=await f.call("/items/"+added.result.itemId+"/selection","POST",{occurrenceId:added.result.occurrenceId,selection:{...selection,productId:"bearing-b"},entryDetails:{whatChanged:"Larger shaft",whyChanged:"New load"}});assert.equal(changed.status,200,JSON.stringify(changed));
  const state=(await f.call("/state")).result;assert.equal(state.items[0].revision_level,2);assert.equal(state.items[0].fields.specs[0].value,10);assert.equal(state.selections[0].requirements.bore,7);
  const old=(await f.call("/history/"+changed.result.eventId)).result.event.payload.snapshot;assert.equal(old.selection.snapshot.product.id,"bearing-a");assert.equal(old.selection.requirements.bore,7);assert.equal(old.files.length,1);assert.equal(old.files[0].name,"Bearing photo");
 }finally{f.db.close();}
});
test("a mixed nested backup restores selections, archive groups, composition and copied source files without the Workshop catalogue",async()=>{
 const f=await engineFixture(),targetDb=new TestD1(),target={WORKSHOP_DB:targetDb,PHOTOS:new TestR2()};try{
  const selection=await catalog(f),top=await f.add("Assembly",{assembly:true,quantity:3});await f.call("/workshop-items","POST",{parentId:top.occurrenceId,selection,requirements:{bore:7}});await f.call("/items/"+top.itemId+"/records","POST",{occurrenceId:top.occurrenceId,record:{type:"test",fields:{result:"Mixed assembly test"}}});await f.call("/occurrences/"+top.occurrenceId+"/archive","POST",{});
  const request=new Request(engineOrigin+"/api/project-engine/projects/"+f.projectId+"/export"),exported=await handleProjectWorkspace(request,f.env,f.owner),backup=await exported.text();
  const restore=new Request(engineOrigin+"/api/project-engine/projects/"+f.projectId+"/import",{method:"POST",headers:{origin:engineOrigin,"x-operation-id":crypto.randomUUID(),"x-project-revision":"new"},body:backup}),response=await handleProjectWorkspace(restore,target,f.owner);assert.equal(response.status,200,await response.clone().text());
  const state=await(await handleProjectWorkspace(new Request(engineOrigin+"/api/project-engine/projects/"+f.projectId+"/state"),target,f.owner)).json();assert.equal(state.selections[0].snapshot.product.id,"bearing-a");assert.equal(state.selections[0].requirements.bore,7);assert.equal(state.archive_groups.length,1);assert.equal(state.occurrences.filter(x=>x.removed_at).length,2);assert.equal(state.files.length,1);assert.notEqual(state.files[0].r2_key,(await f.call("/state")).result.files[0].r2_key);
 }finally{f.db.close();targetDb.close();}
});
test("source field type or unit changes cannot reinterpret a saved project requirement",async()=>{
 const f=await engineFixture();try{
  const selection={...await catalog(f,{photo:false}),productId:null,expectedProductRevision:null};f.db.sqlite.prepare("UPDATE workshop_products SET field_values='{}'").run();const added=await f.call("/workshop-items","POST",{selection,requirements:{bore:7}});assert.equal(added.status,200);
  f.db.sqlite.prepare("UPDATE workshop_fields SET unit='inch' WHERE id='bore'").run();f.db.sqlite.prepare("UPDATE workshop_families SET revision=2 WHERE id='bearings'").run();
  const before=(await f.call("/state")).result,response=await f.call("/items/"+added.result.itemId+"/selection","POST",{selection:{...selection,expectedFamilyRevision:2},requirements:{bore:7}});assert.equal(response.status,400);assert.match(response.result.error,/changed type or unit/);assert.deepEqual((await f.call("/state")).result,before);
  const clear=await f.call("/items/"+added.result.itemId+"/selection","POST",{selection:{...selection,expectedFamilyRevision:2},requirements:{bore:null}});assert.equal(clear.status,200,JSON.stringify(clear));
 }finally{f.db.close();}
});
test("pre-assembly backups still import with root placements and empty selection/group tables",async()=>{
 const f=await engineFixture(),db=new TestD1(),env={WORKSHOP_DB:db,PHOTOS:new TestR2()};try{
  await f.add("Legacy-format part");const response=await handleProjectWorkspace(new Request(engineOrigin+"/api/project-engine/projects/"+f.projectId+"/export"),f.env,f.owner),rows=(await response.text()).trimEnd().split("\n").map(JSON.parse),manifest=rows[0].manifest;delete manifest.tables.selections;delete manifest.tables.archive_groups;for(const item of manifest.tables.items){delete item.is_assembly;delete item.revision_level;}for(const row of manifest.tables.occurrences){delete row.parent_id;delete row.archive_group_id;}
  const imported=await handleProjectWorkspace(new Request(engineOrigin+"/api/project-engine/projects/"+f.projectId+"/import",{method:"POST",headers:{origin:engineOrigin,"x-operation-id":crypto.randomUUID(),"x-project-revision":"new"},body:rows.map(row=>JSON.stringify(row)).join("\n")+"\n"}),env,f.owner);assert.equal(imported.status,200,await imported.clone().text());
  const state=await(await handleProjectWorkspace(new Request(engineOrigin+"/api/project-engine/projects/"+f.projectId+"/state"),env,f.owner)).json();assert.equal(state.items[0].is_assembly,false);assert.equal(state.items[0].revision_level,1);assert.equal(state.occurrences[0].parent_id,null);assert.deepEqual(state.selections,[]);assert.deepEqual(state.archive_groups,[]);
 }finally{f.db.close();db.close();}
});
