import {test} from "node:test";
import assert from "node:assert/strict";
import {fixture,upload} from "./helpers/project-workspace.mjs";
import {backupEngineProjects,ENGINE_BACKUP_PREFIX} from "../functions/api/project-auto-backups.js";
import {handleProjectWorkspace} from "../functions/api/project-workspace-api.js";
const origin="https://preview.example.test",base=origin+"/api/project-engine/projects/";
const enabled=f=>({...f.env,NEW_PROJECT_ENGINE:"1"});
const stored=f=>[...f.env.PHOTOS.objects.keys()].filter(key=>key.startsWith(ENGINE_BACKUP_PREFIX));
const pattern=(size,seed)=>{const bytes=new Uint8Array(size);let x=seed;for(let i=0;i<size;i++){x=(x*1103515245+12345)>>>0;bytes[i]=x>>>24;}return bytes;};

test("nightly backups work without a rollout flag and skip an uninitialized database",async()=>{
 const f=await fixture();try{
  const result=await backupEngineProjects(f.env);
  assert.equal(result[0].status,"saved");assert.equal(stored(f).length,1);
  const {TestD1}=await import("./helpers/d1.mjs");const db=new TestD1();
  try{assert.deepEqual(await backupEngineProjects({...f.env,WORKSHOP_DB:db}),[]);
   assert.equal((await db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name='engine_projects'").first()).n,0);
  }finally{db.close();}
 }finally{f.db.close();}
});

test("a scheduled backup restores as an identical copy, and an unchanged project is not backed up again",async()=>{
 const f=await fixture();try{
  await upload(f,"bracket.dat",new TextEncoder().encode("solid bracket"));
  ok(await f.call("/items/"+f.itemId+"/records","POST",{record:{type:"note",fields:{text:"First fit check"}}}));
  const [first]=await backupEngineProjects(enabled(f),new Date("2026-11-25T09:17:00Z"));
  assert.equal(first.status,"saved",JSON.stringify(first));assert.equal(stored(f).length,1);
  const [again]=await backupEngineProjects(enabled(f),new Date("2026-11-26T09:17:00Z"));
  assert.equal(again.status,"unchanged");assert.equal(stored(f).length,1);
  ok(await f.call("/items/"+f.itemId+"/records","POST",{record:{type:"note",fields:{text:"Second fit check"}}}));
  const [changed]=await backupEngineProjects(enabled(f),new Date("2026-11-27T09:17:00Z"));
  assert.equal(changed.status,"saved");assert.equal(stored(f).length,2);
  // The owner downloads it through the engine API and restores it as a named copy.
  const list=await(await handleProjectWorkspace(new Request(base+f.projectId+"/automatic-backups"),f.env,f.owner)).json();
  assert.equal(list.backups.length,2);assert.ok(list.backups[0].id>list.backups[1].id,"newest first");
  const download=await handleProjectWorkspace(new Request(base+f.projectId+"/automatic-backups?id="+list.backups[0].id),f.env,f.owner);assert.equal(download.status,200);
  const copy=crypto.randomUUID(),restored=await handleProjectWorkspace(new Request(base+copy+"/import-copy?name=From%20nightly",{method:"POST",headers:{origin,"x-operation-id":crypto.randomUUID(),"x-project-revision":"new"},body:await download.text()}),f.env,f.owner);
  assert.equal(restored.status,200,await restored.clone().text());
  const state=await(await handleProjectWorkspace(new Request(base+copy+"/state"),f.env,f.owner)).json();
  assert.deepEqual(state.records.map(row=>row.fields.text).sort(),["First fit check","Second fit check"]);
  assert.equal((await handleProjectWorkspace(new Request(base+f.projectId+"/automatic-backups?id=../x"),f.env,f.owner)).status,400);
 }finally{f.db.close();}
});

test("a large backup is stored in parts; a failure part-way leaves nothing behind and later projects are still processed",async()=>{
 const f=await fixture();try{
  const second=await handleProjectWorkspace(new Request(base+crypto.randomUUID(),{method:"POST",headers:{origin,"content-type":"application/json"},body:JSON.stringify({name:"Other build",operationId:crypto.randomUUID(),expectedRevision:null})}),f.env,f.owner);assert.equal(second.status,200);
  const a=await upload(f,"a.mesh",pattern(7*1024*1024,1),"support"),b=await upload(f,"b.mesh",pattern(7*1024*1024,2),"support");
  const [big]=await backupEngineProjects(enabled(f));assert.equal(big.status,"saved",JSON.stringify(big));assert.ok(big.bytes>8*1024*1024,"spans more than one part");
  // Damage whichever file is exported second, after the first part is uploaded.
  const later=[a.fileId,b.fileId].sort()[1],row=await f.db.prepare("SELECT r2_key FROM engine_files WHERE id=?").bind(later).first();
  f.env.PHOTOS.objects.get(row.r2_key).bytes[0]^=1;
  ok(await f.call("/items/"+f.itemId+"/records","POST",{record:{type:"note",fields:{text:"Change after damage"}}}));
  const before=stored(f).length,summary=await backupEngineProjects(enabled(f));
  const failed=summary.find(row=>row.project===f.projectId),other=summary.find(row=>row.project!==f.projectId);
  assert.equal(failed.status,"failed");assert.match(failed.reason,/verification/);
  assert.equal(stored(f).length,before,"no backup object was written for the failed project");assert.equal(other.status,"unchanged","the next project was still processed");
  assert.equal(f.env.PHOTOS.uploads.size,0,"the partial upload was aborted");
 }finally{f.db.close();}
});

function ok(reply){assert.equal(reply.status,200,JSON.stringify(reply.result));return reply.result;}
