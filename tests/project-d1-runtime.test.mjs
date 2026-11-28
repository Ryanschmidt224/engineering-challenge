import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {build} from 'esbuild';
import {Miniflare,Log,LogLevel} from 'miniflare';

// Node's SQLite permits more compound SELECT terms than D1. Exercise the
// migration and project commands through the actual workerd D1 binding.
test('D1 upgrades v14, preserves projects and retains new projects across Worker restarts', {timeout:90000}, async()=>{
 const directory=await mkdtemp(join(tmpdir(),'bs-d1-migration-'));
 const root=resolve('.');
 const entry=`
 import {initializeProjectEngine} from ${JSON.stringify(root+'/functions/api/project-engine-migrations.js')};
 import {handleProjectWorkspace} from ${JSON.stringify(root+'/functions/api/project-workspace-api.js')};
 export default {async fetch(request,env){
  if(new URL(request.url).pathname==='/setup-v14'){
   let count=0;const binding={prepare:sql=>env.DB.prepare(sql),batch:statements=>{if(++count===15)throw Error('Stop at v14');return env.DB.batch(statements);}};
   try{await initializeProjectEngine(binding);}catch(e){if(e.message!=='Stop at v14')throw e;}
   return Response.json({ok:true});
  }
  return handleProjectWorkspace(request,{WORKSHOP_DB:env.DB},{id:'runtime-owner'});
 }};`;
 const bundled=await build({stdin:{contents:entry,resolveDir:root},bundle:true,write:false,format:'esm',platform:'browser'});
 const options={modules:true,script:bundled.outputFiles[0].text,compatibilityDate:'2026-07-30',d1Databases:{DB:'runtime-migration'},d1Persist:directory,log:new Log(LogLevel.ERROR)};
 let runtime=new Miniflare(options);
 try{
  assert.equal((await runtime.dispatchFetch('https://fixture.test/setup-v14')).status,200);
  const db=await runtime.getD1Database('DB');
  await assert.rejects(db.prepare('SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6').all(),/too many terms in compound SELECT/);
  const oldId=crypto.randomUUID(),newId=crypto.randomUUID();
  await db.prepare('INSERT INTO engine_projects(id,owner_id,name,revision,created_at,owner_name,overview) VALUES(?,?,?,?,?,?,?)').bind(oldId,'runtime-owner','Existing USB-C supply',crypto.randomUUID(),new Date().toISOString(),'Wes',JSON.stringify({tags:['Legacy tag','electronics']})).run();
  const itemId=crypto.randomUUID(),occurrenceId=crypto.randomUUID(),archiveId=crypto.randomUUID();
  await db.prepare("INSERT INTO engine_items(id,project_id,name,part_number,kind,source,fields,created_at) VALUES(?,?,?,?,?,?,?,?)").bind(itemId,oldId,'Existing part','NR100','part','custom','{}',new Date().toISOString()).run();
  await db.prepare("INSERT INTO engine_occurrences(id,project_id,item_id,quantity) VALUES(?,?,?,?)").bind(occurrenceId,oldId,itemId,3).run();
  await db.prepare("INSERT INTO engine_archive_groups(id,project_id,root_occurrence_id,members,created_at) VALUES(?,?,?,?,?)").bind(archiveId,oldId,occurrenceId,'[]',new Date().toISOString()).run();
  const beforeObjects=(await db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' OR type='index' AND tbl_name='engine_occurrences' ORDER BY name").all()).results;
  const list=()=>runtime.dispatchFetch('https://fixture.test/api/project-engine/projects');
  let response=await list();assert.equal(response.status,200,await response.clone().text());assert.equal((await response.json()).projects[0].id,oldId);
  const settings=await runtime.dispatchFetch('https://fixture.test/api/project-engine/settings');assert.equal(settings.status,200,await settings.clone().text());const choices=await settings.json();assert.ok(choices.tags.includes('Legacy tag'));assert.ok(choices.tags.includes('PCB Design'));assert.equal(choices.tags.filter(value=>value.toLowerCase()==='electronics').length,1);
  response=await runtime.dispatchFetch('https://fixture.test/api/project-engine/projects/'+newId,{method:'POST',body:JSON.stringify({operationId:crypto.randomUUID(),expectedRevision:null,name:'Created after upgrade',owner_name:'Ryan'})});assert.equal(response.status,200,await response.clone().text());
  assert.equal((await db.prepare('SELECT quantity FROM engine_occurrences WHERE id=?').bind(occurrenceId).first()).quantity,3);
  await db.prepare("UPDATE engine_occurrences SET build_status='ordered' WHERE id=?").bind(occurrenceId).run();
  assert.equal((await db.prepare('SELECT build_status FROM engine_occurrences WHERE id=?').bind(occurrenceId).first()).build_status,'ordered');
  assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results,[]);
  const afterObjects=(await db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' OR type='index' AND tbl_name='engine_occurrences' ORDER BY name").all()).results;
  assert.deepEqual(afterObjects,[...beforeObjects,...['engine_project_number_assign','engine_project_number_immutable_delete','engine_project_number_immutable_update'].map(name=>({name}))].sort((a,b)=>a.name.localeCompare(b.name)));
  assert.equal((await db.prepare('SELECT project_number FROM engine_project_numbers WHERE project_id=?').bind(oldId).first()).project_number,1001);
  assert.equal((await db.prepare('SELECT project_number FROM engine_project_numbers WHERE project_id=?').bind(newId).first()).project_number,1002);
  const concurrent = Array.from({length:8},()=>({id:crypto.randomUUID(),operationId:crypto.randomUUID()}));
  const created = await Promise.all(concurrent.map(p=>runtime.dispatchFetch('https://fixture.test/api/project-engine/projects/'+p.id,{method:'POST',body:JSON.stringify({operationId:p.operationId,expectedRevision:null,name:'Same name'})})));
  for(const result of created)assert.equal(result.status,200,await result.clone().text());
  const numbers=(await db.prepare('SELECT project_number FROM engine_project_numbers ORDER BY project_number').all()).results.map(row=>row.project_number);
  assert.deepEqual(numbers,Array.from({length:10},(_,i)=>1001+i));
  const first=concurrent[0];const replay=await runtime.dispatchFetch('https://fixture.test/api/project-engine/projects/'+first.id,{method:'POST',body:JSON.stringify({operationId:first.operationId,expectedRevision:null,name:'Same name'})});assert.equal(replay.status,200);assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM engine_project_numbers').first()).n,10);
  await assert.rejects(db.prepare("UPDATE engine_occurrences SET build_status='invented' WHERE id=?").bind(occurrenceId).run());
  assert.equal((await db.prepare('SELECT MAX(version) AS version FROM project_engine_migrations').first()).version,17);
  assert.equal((await db.prepare('SELECT owner_name FROM engine_projects WHERE id=?').bind(oldId).first()).owner_name,'Wes');
  await runtime.dispose();runtime=new Miniflare(options);
  response=await list();assert.equal(response.status,200,await response.clone().text());assert.deepEqual((await response.json()).projects.map(project=>project.id).sort(),[oldId,newId,...concurrent.map(p=>p.id)].sort());
 }finally{await runtime.dispose();await rm(directory,{recursive:true,force:true});}
});
