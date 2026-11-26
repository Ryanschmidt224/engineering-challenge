import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TestD1} from './helpers/d1.mjs';
import {initializeProjectEngine} from '../functions/api/project-engine-migrations.js';
import {initializeWorkshop} from '../functions/api/workshop-db.js';

for(const [name,initialize,readSQL] of [
 ['Projects',initializeProjectEngine,"SELECT 1 AS ready FROM sqlite_master WHERE type='table' AND name='project_engine_migrations'"],
 ['Workshop',initializeWorkshop,"SELECT value FROM workshop_meta WHERE key='schema'"],
]){
 test(name+' initialization does not reuse a completed request promise',async t=>{
  const db=new TestD1();t.after(()=>db.close());await initialize(db);
  const prepare=db.prepare.bind(db);let reads=0;
  db.prepare=sql=>{const query=prepare(sql);if(sql===readSQL){const first=query.first;query.first=async()=>{reads++;return first();};}return query;};
  await initialize(db);await initialize(db);assert.equal(reads,2,'Each request must run its own database readiness read.');
 });
 test(name+' concurrent readiness checks do not await another request\'s promise',async t=>{
  const db=new TestD1();t.after(()=>db.close());await initialize(db);
  const prepare=db.prepare.bind(db);let reads=0,release;
  const hold=new Promise(resolve=>release=resolve);
  db.prepare=sql=>{const query=prepare(sql);if(sql===readSQL){const first=query.first;query.first=async()=>{const own=++reads;if(own===1)await hold;return first();};}return query;};
  const first=initialize(db);await new Promise(resolve=>setImmediate(resolve));let secondDone=false;const second=initialize(db).then(()=>{secondDone=true;});await new Promise(resolve=>setImmediate(resolve));
  // Always release the first request, including when this assertion fails.
  try{assert.equal(reads,2);assert.equal(secondDone,true,'The second request must finish while the first is waiting.');}finally{release();await Promise.all([first,second]);}
 });
}
