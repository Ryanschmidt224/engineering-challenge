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
  const list=()=>runtime.dispatchFetch('https://fixture.test/api/project-engine/projects');
  let response=await list();assert.equal(response.status,200,await response.clone().text());assert.equal((await response.json()).projects[0].id,oldId);
  const settings=await runtime.dispatchFetch('https://fixture.test/api/project-engine/settings');assert.equal(settings.status,200,await settings.clone().text());const choices=await settings.json();assert.ok(choices.tags.includes('Legacy tag'));assert.ok(choices.tags.includes('PCB Design'));assert.equal(choices.tags.filter(value=>value.toLowerCase()==='electronics').length,1);
  response=await runtime.dispatchFetch('https://fixture.test/api/project-engine/projects/'+newId,{method:'POST',body:JSON.stringify({operationId:crypto.randomUUID(),expectedRevision:null,name:'Created after upgrade',owner_name:'Ryan'})});assert.equal(response.status,200,await response.clone().text());
  assert.equal((await db.prepare('SELECT MAX(version) AS version FROM project_engine_migrations').first()).version,15);
  assert.equal((await db.prepare('SELECT owner_name FROM engine_projects WHERE id=?').bind(oldId).first()).owner_name,'Wes');
  await runtime.dispose();runtime=new Miniflare(options);
  response=await list();assert.equal(response.status,200,await response.clone().text());assert.deepEqual((await response.json()).projects.map(project=>project.id).sort(),[oldId,newId].sort());
 }finally{await runtime.dispose();await rm(directory,{recursive:true,force:true});}
});
