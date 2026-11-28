import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TestD1} from './helpers/d1.mjs';
import {fixture} from './helpers/project-workspace.mjs';
import {initializeProjectEngine} from '../functions/api/project-engine-migrations.js';
import {handleProjectWorkspace} from '../functions/api/project-workspace-api.js';
import {projectNumber,projectLabel,projectNameKey} from '../assets/project-identity.js';
const id=()=>crypto.randomUUID(),origin='https://preview.example.test';
const projectRequest=(projectId,method='GET',body,path='')=>new Request(origin+'/api/project-engine/projects/'+projectId+path,{method,headers:{origin},...(body?{body:JSON.stringify(body)}:{})});
test('v17 assigns existing projects once in creation order without touching headers or deletion fences',async t=>{
 const db=new TestD1();t.after(()=>db.close());const batch=db.batch.bind(db);let batches=0;
 db.batch=statements=>{if(++batches===17)throw Error('Stop at v16');return batch(statements);};await assert.rejects(initializeProjectEngine(db),/Stop at v16/);db.batch=batch;
 const projects=[{id:id(),date:'2026-11-27T00:00:00.000Z'},{id:id(),date:'2026-11-26T00:00:00.000Z'}];
 for(const p of projects)await db.prepare('INSERT INTO engine_projects(id,owner_id,name,revision,created_at) VALUES(?,?,?,?,?)').bind(p.id,'owner','Identical name',id(),p.date).run();
 await db.prepare('INSERT INTO engine_project_deletions(id,project_id,actor_id,expected_revision,request_hash,created_at) VALUES(?,?,?,?,?,?)').bind(id(),projects[0].id,'owner',id(),'a'.repeat(64),projects[0].date).run();
 const before=(await db.prepare('SELECT * FROM engine_projects ORDER BY id').all()).results;await initializeProjectEngine(db);
 assert.deepEqual((await db.prepare('SELECT * FROM engine_projects ORDER BY id').all()).results,before);
 const numbers=await db.prepare('SELECT * FROM engine_project_numbers ORDER BY project_number').all();assert.deepEqual(numbers.results.map(row=>({...row})),[{project_id:projects[1].id,project_number:1001},{project_id:projects[0].id,project_number:1002}]);
 await initializeProjectEngine(db);assert.deepEqual((await db.prepare('SELECT * FROM engine_project_numbers ORDER BY project_number').all()).results,numbers.results);
 await assert.rejects(db.prepare('UPDATE engine_projects SET name=? WHERE id=?').bind('No',projects[0].id).run(),/PROJECT_DELETING/);
 assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results,[]);
});
test('creation/replay/rename/deletion/copy restore keep permanent unique numbers independent of names and part prefixes',async t=>{
 const f=await fixture();t.after(()=>f.db.close());const call=(projectId,method,body,path='')=>handleProjectWorkspace(projectRequest(projectId,method,body,path),f.env,f.owner);
 const original=(await f.call('/state')).result.project;assert.equal(original.project_number,1001);
 const second=id(),operationId=id(),body={operationId,expectedRevision:null,name:original.name,prefix:'CUSTOM',digits:4};
 assert.equal((await call(second,'POST',body)).status,200);const replay=await call(second,'POST',body);assert.equal(replay.status,200);
 let secondProject=(await(await call(second,'GET',null,'/state')).json()).project;assert.equal(secondProject.project_number,1002);assert.equal(secondProject.prefix,'CUSTOM');
 const edited=await call(second,'PATCH',{operationId:id(),expectedRevision:secondProject.revision,name:'Renamed'});assert.equal(edited.status,200);secondProject=(await(await call(second,'GET',null,'/state')).json()).project;assert.equal(secondProject.project_number,1002);
 const backup=await(await call(second,'GET',null,'/export')).text();assert.equal(JSON.parse(backup.split('\n')[0]).manifest.project.project_number,1002);
 const deleteOperation=id();for(let at=0;at<10;at++){const r=await call(second,'POST',{operationId:deleteOperation,expectedRevision:secondProject.revision,name:'Renamed'},'/delete');assert.equal(r.status,200);if((await r.json()).deleted)break;}
 assert.equal((await call(second,'GET',null,'/state')).status,404);
 assert.equal((await f.db.prepare('SELECT project_number FROM engine_project_numbers WHERE project_id=?').bind(second).first()).project_number,1002);
 await assert.rejects(f.db.prepare('DELETE FROM engine_project_numbers WHERE project_id=?').bind(second).run(),/PROJECT_NUMBER_PERMANENT/);
 await assert.rejects(f.db.prepare('UPDATE engine_project_numbers SET project_number=9999 WHERE project_id=?').bind(second).run(),/PROJECT_NUMBER_PERMANENT/);
 const copy=id(),restored=await handleProjectWorkspace(new Request(origin+'/api/project-engine/projects/'+copy+'/import-copy?name=Renamed',{method:'POST',headers:{origin,'x-operation-id':id(),'x-project-revision':'new'},body:backup}),f.env,f.owner);assert.equal(restored.status,200,await restored.clone().text());
 assert.equal((await(await call(copy,'GET',null,'/state')).json()).project.project_number,1003);
 const third=id();assert.equal((await call(third,'POST',{operationId:id(),expectedRevision:null,name:'Renamed'})).status,200);assert.equal((await(await call(third,'GET',null,'/state')).json()).project.project_number,1004);
 assert.deepEqual((await f.call('/state')).result.project,original);
});
test('failed atomic creation leaves no issued number and labels preserve the editable name',async t=>{
 const f=await fixture();t.after(()=>f.db.close());const projectId=id();await assert.rejects(f.db.batch([f.db.prepare('INSERT INTO engine_projects(id,owner_id,name,revision,created_at) VALUES(?,?,?,?,?)').bind(projectId,f.owner.id,'Failed',id(),new Date().toISOString()),f.db.prepare('SELECT missing FROM missing_table')]));
 assert.equal(await f.db.prepare('SELECT * FROM engine_project_numbers WHERE project_id=?').bind(projectId).first(),null);
 assert.equal(projectNumber({project_number:1001}),'P1001');assert.equal(projectLabel({project_number:1001,name:'USB-C supply'}),'P1001 — USB-C supply');assert.equal(projectNameKey('  USB-C   Supply '),projectNameKey('usb-c supply'));
});
