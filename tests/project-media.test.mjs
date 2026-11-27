import {test} from "node:test";
import assert from "node:assert/strict";
import {fixture} from "./helpers/project-workspace.mjs";
import {handleProjectWorkspace} from "../functions/api/project-workspace-api.js";
const origin="https://preview.example.test",base=origin+"/api/project-engine/projects/";
const ok=reply=>{assert.equal(reply.status,200,JSON.stringify(reply.result));return reply.result;};
// A minimal valid PNG header is enough: the server trusts the admitted type and size.
const png=size=>{const bytes=new Uint8Array(size);bytes.set([137,80,78,71,13,10,26,10]);return bytes;};
async function image(f,name,{type="image/png",size=64}={}){
 const prepared=ok(await f.call("/files/prepare","POST",{name,content_type:type}));
 const put=await handleProjectWorkspace(new Request(base+f.projectId+"/files/"+prepared.fileId+"/bytes",{method:"PUT",headers:{origin,"x-operation-id":crypto.randomUUID(),"x-project-revision":f.revision()},body:png(size)}),f.env,f.owner);assert.equal(put.status,200,await put.clone().text());
 ok(await f.call("/files/"+prepared.fileId+"/admit","POST",{role:"support"}));return prepared.fileId;
}
const state=async f=>ok(await f.call("/state"));
const gallery=(s,itemId=null)=>s.media.filter(row=>row.active&&row.role==="photo"&&row.item_id===itemId).sort((a,b)=>a.sort_order-b.sort_order);

test("project and part photo galleries keep order and captions, and removal keeps the file",async()=>{
 const f=await fixture();try{
  const a=await image(f,"a.png"),b=await image(f,"b.png"),c=await image(f,"c.png");
  const cover=async()=>{const response=await handleProjectWorkspace(new Request(base.slice(0,-1)),f.env,f.owner);assert.equal(response.status,200);return (await response.json()).projects.find(project=>project.id===f.projectId).cover_file_id;};
  assert.equal(await cover(),null);
  const added=ok(await f.call("/media","POST",{fileIds:[a,b],caption:"Bench setup"}));assert.equal(added.mediaIds.length,2);
  ok(await f.call("/media","POST",{fileId:c,itemId:f.itemId}));
  assert.equal(await cover(),a);
  let s=await state(f);assert.deepEqual(gallery(s).map(row=>row.file_id),[a,b]);assert.deepEqual(gallery(s,f.itemId).map(row=>row.file_id),[c]);
  ok(await f.call("/media/reorder","POST",{ids:[...added.mediaIds].reverse()}));
  ok(await f.call("/media/"+added.mediaIds[0],"PATCH",{caption:"First fit"}));
  assert.equal(await cover(),b);
  s=await state(f);assert.deepEqual(gallery(s).map(row=>row.file_id),[b,a]);assert.equal(gallery(s).find(row=>row.file_id===a).caption,"First fit");
  ok(await f.call("/media/"+added.mediaIds[1]+"/remove","POST"));
  assert.equal(await cover(),a);
  s=await state(f);assert.deepEqual(gallery(s).map(row=>row.file_id),[a]);
  assert.ok(s.files.some(file=>file.id===b&&file.state==="ready"),"the removed photo's file is retained");
  assert.equal((await f.call("/media/reorder","POST",{ids:[added.mediaIds[0],added.mediaIds[1]]})).status,400,"a removed photo cannot be reordered back");
  assert.equal((await f.call("/media","POST",{fileId:a})).status,400,"the same photo is not added twice");
  ok(await f.call("/media/"+added.mediaIds[0]+"/remove","POST"));assert.equal(await cover(),null);
  const other=await handleProjectWorkspace(new Request(base.slice(0,-1)),f.env,{id:"other-owner"});assert.deepEqual((await other.json()).projects,[]);
 }finally{f.db.close();}
});

test("a part has one current picture; replacing it keeps the earlier one, and only small JPG/PNG/WebP files qualify",async()=>{
 const f=await fixture();try{
  const first=await image(f,"front.png"),second=await image(f,"side.webp",{type:"image/webp"}),big=await image(f,"huge.png",{size:3*1024*1024+1}),pdf=await image(f,"sheet.pdf",{type:"application/pdf"});
  assert.equal((await f.call("/media","POST",{role:"picture",fileId:first})).status,400,"a picture needs a part");
  ok(await f.call("/media","POST",{role:"picture",itemId:f.itemId,fileId:first}));
  const replay=await f.call("/media","POST",{role:"picture",itemId:f.itemId,fileId:first});assert.equal(replay.status,200);assert.equal(replay.result.noop,true);
  ok(await f.call("/media","POST",{role:"picture",itemId:f.itemId,fileId:second}));
  const pictures=(await state(f)).media.filter(row=>row.role==="picture");
  assert.deepEqual(pictures.filter(row=>row.active).map(row=>row.file_id),[second]);assert.equal(pictures.length,2,"the earlier picture row is retained");
  assert.equal((await f.call("/media","POST",{role:"picture",itemId:f.itemId,fileId:big})).status,400);
  assert.equal((await f.call("/media","POST",{role:"picture",itemId:f.itemId,fileId:pdf})).status,400);
  assert.equal((await f.call("/media","POST",{fileId:pdf})).status,400,"galleries accept images only");
 }finally{f.db.close();}
});

test("a stale gallery change is refused and a duplicate submit adds a photo once",async()=>{
 const f=await fixture();try{
  const a=await image(f,"a.png"),b=await image(f,"b.png"),stale=f.revision();
  const operationId=crypto.randomUUID();
  ok(await f.call("/media","POST",{fileId:a},{operationId}));
  const again=await f.call("/media","POST",{fileId:a},{operationId,revision:stale});assert.equal(again.status,200);
  assert.equal((await state(f)).media.length,1,"the replay did not add a second row");
  assert.equal((await f.call("/media","POST",{fileId:b},{revision:stale})).status,409);
 }finally{f.db.close();}
});

test("photos and the current picture survive export and restore as a copy",async()=>{
 const f=await fixture();try{
  const a=await image(f,"a.png"),p=await image(f,"p.png");
  ok(await f.call("/media","POST",{fileId:a,caption:"Kept caption"}));ok(await f.call("/media","POST",{role:"picture",itemId:f.itemId,fileId:p}));
  const exported=await handleProjectWorkspace(new Request(base+f.projectId+"/export"),f.env,f.owner);assert.equal(exported.status,200);
  const copy=crypto.randomUUID(),restored=await handleProjectWorkspace(new Request(base+copy+"/import-copy?name=Copy",{method:"POST",headers:{origin,"x-operation-id":crypto.randomUUID(),"x-project-revision":"new"},body:await exported.text()}),f.env,f.owner);
  assert.equal(restored.status,200,await restored.clone().text());
  const s=await(await handleProjectWorkspace(new Request(base+copy+"/state"),f.env,f.owner)).json();
  assert.equal(gallery(s)[0].caption,"Kept caption");assert.equal(s.media.filter(row=>row.role==="picture"&&row.active).length,1);
  const download=await handleProjectWorkspace(new Request(base+copy+"/files/"+gallery(s)[0].file_id+"?inline=1"),f.env,f.owner);assert.equal(download.status,200);
 }finally{f.db.close();}
});

test("an abandoned restore holding photo rows is still fully cleaned up",async()=>{
 const {claimInactiveRestore,cleanupRetiredRestore}=await import("../functions/api/project-orphan-cleanup.js");
 const {backupColumns}=await import("../functions/api/project-backup-schema.js");
 const f=await fixture();try{
  const a=await image(f,"a.png");ok(await f.call("/media","POST",{fileId:a}));ok(await f.call("/media","POST",{role:"picture",itemId:f.itemId,fileId:a}));
  const backup=await(await handleProjectWorkspace(new Request(base+f.projectId+"/export"),f.env,f.owner)).text(),projectId=crypto.randomUUID(),old=new Date(Date.now()-3*24*60*60*1000).toISOString();
  f.db.sqlite.exec("CREATE TRIGGER pause_media_test BEFORE UPDATE OF state ON engine_restore_jobs WHEN NEW.state='complete' BEGIN SELECT RAISE(ABORT,'SQLITE pause'); END");
  const response=await handleProjectWorkspace(new Request(base+projectId+"/import-copy?name=Unpublished",{method:"POST",headers:{origin,"x-operation-id":crypto.randomUUID(),"x-project-revision":"new"},body:backup}),f.env,f.owner);assert.notEqual(response.status,200);f.db.sqlite.exec("DROP TRIGGER pause_media_test");
  const {restore_job_id:jobId}=f.db.sqlite.prepare("SELECT restore_job_id FROM engine_projects WHERE id=?").get(projectId);
  assert.equal(f.db.sqlite.prepare("SELECT COUNT(*) AS n FROM engine_media WHERE project_id=?").get(projectId).n,2,"the hidden copy holds photo rows");
  f.db.sqlite.prepare("UPDATE engine_restore_jobs SET created_at=?,last_activity_at=? WHERE id=?").run(old,old,jobId);
  const receipt=await claimInactiveRestore(f.db,{jobId,actorId:f.owner.id,observedActivity:old});let result,calls=0;
  do{result=await cleanupRetiredRestore(f.db,{...receipt,actorId:f.owner.id});assert.ok(++calls<50);}while(!result.complete);
  for(const name of Object.keys(backupColumns))assert.equal(f.db.sqlite.prepare(`SELECT COUNT(*) AS n FROM engine_${name} WHERE project_id=?`).get(projectId).n,0,name);
  assert.equal(f.db.sqlite.prepare("SELECT COUNT(*) AS n FROM engine_projects WHERE id=?").get(projectId).n,0);
  assert.equal((await state(f)).media.filter(row=>row.active).length,2,"the source project is untouched");
 }finally{f.db.close();}
});

test('main selection reuses scoped library files, keeps prior photos and clears without loss',async()=>{
 const f=await fixture();try{
  const old=await image(f,'legacy-main.png'),next=await image(f,'library.png');
  ok(await f.call('/media','POST',{role:'picture',itemId:f.itemId,fileId:old}));
  const added=ok(await f.call('/media','POST',{itemId:f.itemId,fileId:next})),before=await state(f),revision=f.revision(),operationId=crypto.randomUUID();
  const selected=ok(await f.call('/media/main-picture','POST',{itemId:f.itemId,mediaId:added.mediaIds[0]},{operationId}));
  ok(await f.call('/media/main-picture','POST',{itemId:f.itemId,mediaId:added.mediaIds[0]},{operationId,revision}));
  let s=await state(f);assert.equal(s.files.length,before.files.length);assert.deepEqual(new Set(gallery(s,f.itemId).map(r=>r.file_id)),new Set([old,next]));assert.deepEqual(s.media.filter(r=>r.active&&r.role==='picture').map(r=>r.file_id),[next]);
  assert.equal((await f.call('/media/main-picture','POST',{itemId:f.itemId,mediaId:added.mediaIds[0]},{revision})).status,409);
  const other=ok(await f.call('/items','POST',{details:{name:'Other part'}}));assert.equal((await f.call('/media/main-picture','POST',{itemId:other.itemId,mediaId:added.mediaIds[0]})).status,400);
  ok(await f.call('/media/'+selected.mediaIds[0]+'/remove','POST'));s=await state(f);assert.equal(s.media.filter(r=>r.active&&r.role==='picture').length,0);assert.equal(gallery(s,f.itemId).length,2);
  ok(await f.call('/media/main-picture','POST',{itemId:f.itemId,mediaId:added.mediaIds[0]}));ok(await f.call('/media/'+added.mediaIds[0]+'/remove','POST',{fromLibrary:true}));s=await state(f);assert.equal(s.media.filter(r=>r.active&&r.role==='picture').length,0);assert.equal(gallery(s,f.itemId).length,1);assert.equal(s.files.length,2);assert.equal((await f.call('/media/main-picture','POST',{itemId:f.itemId,mediaId:added.mediaIds[0]})).status,404);
 }finally{f.db.close();}
});

test('clearing a legacy main picture keeps it available once in the library',async()=>{
 const f=await fixture();try{const file=await image(f,'old.png'),main=ok(await f.call('/media','POST',{role:'picture',itemId:f.itemId,fileId:file}));ok(await f.call('/media/'+main.mediaIds[0]+'/remove','POST'));const s=await state(f);assert.deepEqual(gallery(s,f.itemId).map(r=>r.file_id),[file]);assert.equal(s.files.length,1);}finally{f.db.close();}
});

test('ordered gallery adopts an existing standalone picture without duplicate files or missing history',async()=>{
 const f=await fixture();try{
 const old=await image(f,'legacy.png'),next=await image(f,'new.png'),legacy=ok(await f.call('/media','POST',{role:'picture',itemId:f.itemId,fileId:old})),added=ok(await f.call('/media','POST',{itemId:f.itemId,fileId:next}));
 ok(await f.call('/media/reorder','POST',{itemId:f.itemId,ids:[legacy.mediaIds[0],added.mediaIds[0]]}));const s=await state(f);assert.deepEqual(gallery(s,f.itemId).map(r=>r.file_id),[old,next]);assert.equal(s.files.length,2);assert.equal(s.media.filter(r=>r.active&&r.role==='picture').length,0);
 }finally{f.db.close();}
});
