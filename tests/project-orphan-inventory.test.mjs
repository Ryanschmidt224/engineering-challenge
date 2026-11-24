import {test} from "node:test";
import assert from "node:assert/strict";
import {fixture,upload} from "./helpers/project-workspace.mjs";
import {inventoryProjectOrphans} from "../functions/api/project-orphan-cleanup.js";
import {handleProjectWorkspace} from "../functions/api/project-workspace-api.js";
import {canonicalJSON,sha256} from "../functions/api/project-command.js";
const id=()=>crypto.randomUUID(),now=Date.parse("2026-11-24T18:00:00Z"),old="2026-11-22T18:00:00Z",params=(kind,cursor="",limit=50)=>new URLSearchParams({kind,cursor,limit}),base="https://preview.example.test/api/project-engine/projects/";
const inspect=(f,kind,cursor="",limit=50)=>inventoryProjectOrphans(f.db,f.env.PHOTOS,f.owner.id,params(kind,cursor,limit),{now});
const escaped=value=>"\\u"+value.charCodeAt(0).toString(16).padStart(4,"0")+value.slice(1);
async function note(f,payload){f.db.sqlite.prepare("INSERT INTO engine_events(id,project_id,item_id,type,title,payload,created_at) VALUES(?,?,?,'note','Retained reference',?,?)").run(id(),f.projectId,f.itemId,payload,old);}
async function prepared(f,name){const response=await f.call("/files/prepare","POST",{name,content_type:"application/octet-stream"});assert.equal(response.status,200);return response.result.fileId;}
async function value(f,text){const snapshot=canonicalJSON({text}),valueId=id();f.db.sqlite.prepare("INSERT INTO engine_snapshot_values(id,project_id,kind,fingerprint,snapshot,created_at) VALUES(?,?,'record',?,?,?)").run(valueId,f.projectId,await sha256(snapshot),snapshot,old);return valueId;}

test("orphan inventory protects escaped historical references, ready files, links and recent uploads without writing",async()=>{
 const f=await fixture();try{
  const missing=await prepared(f,"Never uploaded"),retained=await prepared(f,"Referenced prepared metadata"),recent=await prepared(f,"Upload in progress"),ready=await upload(f,"Published drawing",new TextEncoder().encode("Saved bytes"));
  f.db.sqlite.prepare("UPDATE engine_files SET created_at=? WHERE project_id=?").run(old,f.projectId);await note(f,'{"saved_file":"'+escaped(retained)+'"}');
  const recentKey=f.db.sqlite.prepare("SELECT r2_key FROM engine_files WHERE project_id=? AND id=?").get(f.projectId,recent).r2_key;await f.env.PHOTOS.put(recentKey,"New bytes");
  const orphan=await value(f,"Unreferenced value"),saved=await value(f,"Retained value");await note(f,'{"references":["'+escaped(saved)+'"]}');
  const before=f.db.sqlite.prepare("SELECT total_changes() AS n").get().n,objects=f.env.PHOTOS.objects.size,files=await inspect(f,"files"),values=await inspect(f,"values");
  assert.deepEqual(files.candidates.map(row=>row.id),[missing]);assert.ok(files.protected.some(row=>row.id===retained&&/saved engineering/.test(row.reason)));assert.ok(files.protected.some(row=>row.id===recent&&/recent|unknown/.test(row.reason)));assert.equal([...files.candidates,...files.protected].some(row=>row.id===ready.fileId),false,"Ready engineering files are not deletion candidates");
  assert.deepEqual(values.candidates.map(row=>row.id),[orphan]);assert.ok(values.protected.some(row=>row.id===saved));assert.equal(f.db.sqlite.prepare("SELECT total_changes() AS n").get().n,before);assert.equal(f.env.PHOTOS.objects.size,objects);assert.equal(files.dryRun,true);
 }finally{f.db.close();}
});

test("object inventory is allowlisted, owner-scoped, paginated and protects saved or pending restore bytes",async()=>{
 const f=await fixture();try{
  const ready=await upload(f,"Drawing",new TextEncoder().encode("Historical drawing")),readyKey=f.db.sqlite.prepare("SELECT r2_key FROM engine_files WHERE project_id=? AND id=?").get(f.projectId,ready.fileId).r2_key;
  const orphan="project-engine/workshop/"+f.projectId+"/"+id()+"/failed-copy",saved="project-engine/workshop/"+f.projectId+"/"+id()+"/saved-evidence",operation=id(),pending="project-engine/restored/"+f.projectId+"/"+operation+"/"+id(),foreign="project-engine/workshop/"+id()+"/"+id()+"/other-owner",young="project-engine/workshop/"+f.projectId+"/"+id()+"/new-copy";
  for(const key of [orphan,saved,pending,foreign,young,"project-engine/restored/"+f.projectId+"/"+id()+"/unrecognized-file-id","project-engine/unrecognized/key","users/private.json"]){await f.env.PHOTOS.put(key,"Retained bytes");f.env.PHOTOS.objects.get(key).uploaded=new Date(old);}f.env.PHOTOS.objects.get(readyKey).uploaded=new Date(old);f.env.PHOTOS.objects.get(young).uploaded=new Date(now);
  const foreignParts=foreign.split("/");f.db.sqlite.prepare("INSERT INTO engine_projects(id,owner_id,name,revision,created_at) VALUES(?,'different-owner','Private project',?,?)").run(foreignParts[2],id(),old);f.db.sqlite.prepare("INSERT INTO engine_restore_jobs(id,project_id,actor_id,operation_id,state,row_count,created_at) VALUES(?,?,?,?,'staging',0,?)").run(id(),foreignParts[2],f.owner.id,foreignParts[3],old); // A rejected restore cannot grant access to another owner's target.
  await note(f,'{"old_document":"'+escaped(saved)+'"}');f.db.sqlite.prepare("INSERT INTO engine_restore_jobs(id,project_id,actor_id,operation_id,state,row_count,created_at) VALUES(?,?,?,?,'ready',0,?)").run(id(),f.projectId,f.owner.id,operation,old);
  const before=f.db.sqlite.prepare("SELECT total_changes() AS n").get().n,keys=[...f.env.PHOTOS.objects.keys()];f.env.PHOTOS.delete=()=>{throw Error("Inventory cannot delete");};f.env.PHOTOS.put=()=>{throw Error("Inventory cannot write objects");};
  const reports=[];let cursor="";do{const report=await inspect(f,"objects",cursor,1);reports.push(report);cursor=report.nextCursor;}while(cursor);
  const candidates=reports.flatMap(row=>row.candidates),protectedRows=reports.flatMap(row=>row.protected);assert.deepEqual(candidates.map(row=>row.key),[orphan]);for(const key of [readyKey,saved,pending,young])assert.ok(protectedRows.some(row=>row.key===key),key);assert.equal([...candidates,...protectedRows].some(row=>row.key===foreign),false);assert.deepEqual([...f.env.PHOTOS.objects.keys()],keys);assert.equal(f.db.sqlite.prepare("SELECT total_changes() AS n").get().n,before);
 }finally{f.db.close();}
});

test("old restore creation dates do not override recent activity; completed staging needs a successful owned receipt",async()=>{
 const f=await fixture();try{
  const pending=id(),finished=id();for(const job of [pending,finished]){f.db.sqlite.prepare("INSERT INTO engine_restore_jobs(id,project_id,actor_id,operation_id,state,row_count,created_at) VALUES(?,?,?,?,'staging',1,?)").run(job,f.projectId,f.owner.id,id(),old);f.db.sqlite.prepare("INSERT INTO engine_restore_rows(job_id,table_name,row_id,position,data) VALUES(?,'items',?,0,'{}')").run(job,id());}f.db.sqlite.prepare("UPDATE engine_restore_jobs SET state='complete' WHERE id=?").run(finished);
  const report=await inspect(f,"restores");assert.equal(report.candidates.length,0);assert.ok(report.protected.some(row=>row.id===pending&&/progress is recent/.test(row.reason)));assert.ok(report.protected.some(row=>row.id===finished&&/successful import receipt/.test(row.reason)));
 }finally{f.db.close();}
});

test("metadata cursors retain identical scoped file IDs from recovered copies",async()=>{
 const f=await fixture();try{
  const file=await prepared(f,"Not uploaded yet");f.db.sqlite.prepare("UPDATE engine_files SET created_at=? WHERE project_id=?").run(old,f.projectId);const backup=await(await handleProjectWorkspace(new Request(base+f.projectId+"/export"),f.env,f.owner)).text(),copy=id();
  const response=await handleProjectWorkspace(new Request(base+copy+"/import-copy?name=Recovered",{method:"POST",headers:{origin:"https://preview.example.test","x-operation-id":id(),"x-project-revision":"new"},body:backup}),f.env,f.owner);assert.equal(response.status,200,await response.clone().text());
  const first=await inspect(f,"files","",1);assert.ok(first.nextCursor);const second=await inspect(f,"files",first.nextCursor,1);assert.equal(second.nextCursor,null);assert.deepEqual([first.candidates[0].id,second.candidates[0].id],[file,file]);assert.notEqual(first.candidates[0].projectId,second.candidates[0].projectId);
 }finally{f.db.close();}
});

test("malformed saved metadata fails closed and invalid inventory options change nothing",async()=>{
 const f=await fixture();try{
  await prepared(f,"Pending");f.db.sqlite.prepare("UPDATE engine_files SET created_at=? WHERE project_id=?").run(old,f.projectId);f.db.sqlite.prepare("UPDATE engine_occurrences SET removed_path='{' WHERE project_id=?").run(f.projectId);
  const before=f.db.sqlite.prepare("SELECT total_changes() AS n").get().n;await assert.rejects(inspect(f,"files"),/inventory is incomplete/);
  for(const query of ["kind=delete","limit=51","kind=values&cursor=invalid","kind=restores&cursor="+id()+":"+id()])await assert.rejects(inventoryProjectOrphans(f.db,f.env.PHOTOS,f.owner.id,new URLSearchParams(query),{now}),/inventory kind/);
  assert.equal(f.db.sqlite.prepare("SELECT total_changes() AS n").get().n,before);
 }finally{f.db.close();}
});
