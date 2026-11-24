import {test} from "node:test";
import assert from "node:assert/strict";
import {handleProjectWorkspace} from "../functions/api/project-workspace-api.js";
import {decode} from "../functions/api/project-state.js";
import {fixture,upload,counts} from "./helpers/project-workspace.mjs";
const id=()=>crypto.randomUUID(),origin="https://preview.example.test";
test("restore as a copy preserves source, scoped identities, audit and independent bytes with replay",async()=>{
 const f=await fixture();try{
  const file=await upload(f,"bracket.step",new TextEncoder().encode("drawing"));
  const created=await f.call("/items/"+f.itemId+"/records","POST",{record:{type:"test",fields:{result:"ok"},fileIds:[file.fileId]}});
  const edited=await f.call("/records/"+created.result.recordId,"PATCH",{record:{type:"test",fields:{result:"FAILED"}}});assert.equal(edited.status,200);
  await f.call("/items/"+f.itemId+"/remove","POST");
  const base=origin+"/api/project-engine/projects/",backup=await(await handleProjectWorkspace(new Request(base+f.projectId+"/export"),f.env,f.owner)).text(),copyId=id(),operationId=id(),name="Recovered bracket";
  const request=(title=name)=>new Request(base+copyId+"/import-copy?"+new URLSearchParams({name:title}),{method:"POST",headers:{origin,"x-operation-id":operationId,"x-project-revision":"new"},body:backup});
  const response=await handleProjectWorkspace(request(),f.env,f.owner);assert.equal(response.status,200,await response.clone().text());const result=await response.json();assert.equal(result.asCopy,true);assert.equal(result.sourceProjectId,f.projectId);assert.equal(result.projectId,copyId);
  const state=await(await handleProjectWorkspace(new Request(base+copyId+"/state"),f.env,f.owner)).json();assert.equal(state.project.name,name);assert.notEqual(state.project.revision,f.revision());assert.equal(state.items[0].id,f.itemId);assert.equal(state.occurrences[0].removed_path.root.id,f.projectId);
  const sourceManifest=JSON.parse(backup.split("\n")[0]).manifest;
  for(const table of ["items","occurrences","steps","records","configurations","events","file_links"]){const copied=(await f.db.prepare("SELECT * FROM engine_"+table+" WHERE project_id=? ORDER BY id").bind(copyId).all()).results.map(decode);assert.deepEqual(copied,sourceManifest.tables[table].map(row=>decode({...row,project_id:copyId})));}
  const audit=await(await handleProjectWorkspace(new Request(base+copyId+"/history/"+edited.result.eventId),f.env,f.owner)).json();assert.equal(audit.recordContext.project.id,f.projectId);assert.equal(audit.event.payload.record_edit.before.fields.result,"ok");assert.equal(audit.event.payload.record_edit.after.fields.result,"FAILED");
  const copiedFile=state.files.find(row=>row.id===file.fileId),original=sourceManifest.tables.files.find(row=>row.id===file.fileId);assert.notEqual(copiedFile.r2_key,original.r2_key);assert.equal(await(await handleProjectWorkspace(new Request(base+copyId+"/files/"+file.fileId),f.env,f.owner)).text(),"drawing");
  const restored=await handleProjectWorkspace(new Request(base+copyId+"/items/"+f.itemId+"/restore",{method:"POST",headers:{origin,"content-type":"application/json"},body:JSON.stringify({operationId:id(),expectedRevision:result.revision})}),f.env,f.owner);assert.equal(restored.status,200);
  assert.deepEqual(await(await handleProjectWorkspace(request(),f.env,f.owner)).json(),result);assert.equal((await handleProjectWorkspace(request("Changed request"),f.env,f.owner)).status,409);
  const collision=new Request(request());collision.headers.set("x-operation-id",id());assert.equal((await handleProjectWorkspace(collision,f.env,f.owner)).status,409,"an existing copy is never overwritten");
  assert.equal((await f.db.prepare("SELECT COUNT(*) AS n FROM engine_projects").first()).n,2);assert.equal(await(await handleProjectWorkspace(new Request(base+f.projectId+"/export"),f.env,f.owner)).text(),backup,"source metadata and exported bytes stay unchanged");
  assert.equal((await handleProjectWorkspace(new Request(base+copyId+"/state"),f.env,{id:"other-owner"})).status,404);
 }finally{f.db.close();}
});
test("copy recovery refuses source identity, invalid name and corrupt bytes",async()=>{
 const f=await fixture();try{
  await upload(f,"drawing.step",new TextEncoder().encode("drawing"));const base=origin+"/api/project-engine/projects/",backup=await(await handleProjectWorkspace(new Request(base+f.projectId+"/export"),f.env,f.owner)).text(),before=await counts(f.db),objects=f.env.PHOTOS.objects.size;
  const request=(projectId,name,body=backup)=>new Request(base+projectId+"/import-copy?"+new URLSearchParams({name}),{method:"POST",headers:{origin,"x-operation-id":id(),"x-project-revision":"new"},body});
  assert.equal((await handleProjectWorkspace(request(f.projectId,"Copy"),f.env,f.owner)).status,409);
  assert.equal((await handleProjectWorkspace(request(id(),""),f.env,f.owner)).status,400);assert.equal((await handleProjectWorkspace(request(id(),"x".repeat(181)),f.env,f.owner)).status,400);assert.equal(f.env.PHOTOS.objects.size,objects);
  for(const body of [backup.replace('{"type":"complete"}\n',""),backup.replace('"data":"ZHJhd2luZw=="','"data":"Y29ycnVwdA=="')]){const response=await handleProjectWorkspace(request(id(),"Copy",body),f.env,f.owner);assert.equal(response.status,400);assert.equal((await f.db.prepare("SELECT COUNT(*) AS n FROM engine_projects").first()).n,1);}
  const put=f.env.PHOTOS.put.bind(f.env.PHOTOS);f.env.PHOTOS.put=(key,bytes,options)=>put(key,new Uint8Array(bytes.length),options);
  const badStorage=await handleProjectWorkspace(request(id(),"Copy"),f.env,f.owner);assert.equal(badStorage.status,400);assert.match((await badStorage.json()).error,/staged restore file failed byte verification/);
  assert.equal((await f.db.prepare("SELECT COUNT(*) AS n FROM engine_projects").first()).n,1);
  assert.deepEqual(await counts(f.db),before);assert.equal(await(await handleProjectWorkspace(new Request(base+f.projectId+"/export"),f.env,f.owner)).text(),backup);
 }finally{f.db.close();}
});
