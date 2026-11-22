import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TestR2} from './helpers/r2.mjs';
import {upgradePracticeRecords} from '../functions/api/record-upgrades.js';
import {exportProject,inspectArchive} from '../functions/api/project-archive.js';
const key='investigations/launcher.json';
const practice={id:'record-stable',category:'practice',title:'Practice soldering',scope:'step',ownerType:'assembly',ownerId:'__root__',stepId:'s',createdAt:'2026-11-20',entries:[{id:'entry-stable',type:'attempt',text:'Set 300°C',date:'2026-11-20',files:['recipe-files/launcher/11111111-1111-4111-8111-111111111111.png']},{id:'learned',type:'lesson',text:'Clean the tip',files:[]}]};
async function fixture(){const env={PHOTOS:new TestR2()};const saved={records:[practice,{id:'unchanged',category:'test',entries:[]}],revision:'original'};await env.PHOTOS.put(key,JSON.stringify(saved));return {env,saved,object:await env.PHOTOS.get(key)};}
test('Practice becomes Notes without changing record IDs, content, attachments or unrelated records; verified backup is exportable',async()=>{
 const {env,saved,object}=await fixture();
 const result=await upgradePracticeRecords(env,'launcher',object,saved,JSON.stringify(saved));
 assert.notEqual(result.saved.revision,saved.revision);
 const record=result.saved.records[0];assert.equal(record.id,practice.id);assert.equal(record.category,'note');assert.equal(record.entries[0].id,'entry-stable');assert.equal(record.entries[0].text,practice.entries[0].text);assert.deepEqual(record.entries[0].files,practice.entries[0].files);assert.equal(record.entries[1].descriptor,'What did you learn?');assert.deepEqual(result.saved.records[1],saved.records[1]);
 const backups=await env.PHOTOS.list({prefix:'record-migrations/launcher/'});assert.equal(backups.objects.length,1);assert.deepEqual(await (await env.PHOTOS.get(backups.objects[0].key)).json(),saved);
 const archive=await exportProject(env.PHOTOS,'launcher');await inspectArchive(archive,'launcher');assert.ok(archive.objects.some(item=>item.key===backups.objects[0].key));
 const again=await upgradePracticeRecords(env,'launcher',await env.PHOTOS.get(key),result.saved,JSON.stringify(result.saved));assert.deepEqual(again.saved,result.saved);assert.equal((await env.PHOTOS.list({prefix:'record-migrations/launcher/'})).objects.length,1);
});
test('failed verification and concurrent edits stop the upgrade without overwriting records',async()=>{
 for(const failure of ['backup','conflict']){
  const {env,saved,object}=await fixture(),get=env.PHOTOS.get.bind(env.PHOTOS);
  if(failure==='backup')env.PHOTOS.get=async k=>k.startsWith('record-migrations/')?null:get(k);
  else await env.PHOTOS.put(key,JSON.stringify({...saved,revision:'newer'}));
  await assert.rejects(upgradePracticeRecords(env,'launcher',object,saved,JSON.stringify(saved)));
  assert.equal((await (await get(key)).json()).revision,failure==='backup'?'original':'newer');
 }
});

test('owner API upgrades a body once and Notes edits preserve former Practice fields',async()=>{
 const {provisionTestAccount}=await import('./helpers/accounts.mjs');
 const {handleInvestigations}=await import('../functions/api/investigations.js');
 const {env}=await fixture();env.admin_password='record-fixture-secret';
 const origin='https://example.test';
 const login=await provisionTestAccount(new Request(origin+'/api/accounts',{method:'POST',headers:{origin},body:JSON.stringify({action:'register',email:'records@example.test',password:'record-fixture-password'})}),env,{role:'admin'});
 const cookie=login.headers.get('set-cookie').split(';')[0];
 const request=(method='GET',body)=>new Request(origin+'/api/investigations?project=launcher',{method,headers:{cookie,origin},...(body?{body:JSON.stringify(body)}:{})});
 const get=env.PHOTOS.get.bind(env.PHOTOS);
 env.PHOTOS.get=async k=>{const obj=await get(k);if(!obj||k!==key)return obj;let read=false;return {...obj,text:async()=>{assert.equal(read,false,'R2 body must be read only once');read=true;return obj.text();}};};
 const first=await handleInvestigations(request(),env);assert.equal(first.status,200);
 const upgraded=await first.json();assert.equal(upgraded.records[0].category,'note');
 const edit=await handleInvestigations(request('POST',{action:'editRecord',id:practice.id,title:'Soldering notes',description:'Additional detail',entries:[],notes:[],photos:[],expectedRevision:upgraded.revision}),env);
 assert.equal(edit.status,200);const saved=await edit.json();assert.equal(saved.records[0].entries[0].id,practice.entries[0].id);assert.equal(saved.records[0].entries[0].text,practice.entries[0].text);
 const stale=await handleInvestigations(request('POST',{action:'editRecord',id:practice.id,title:'Old draft',entries:[],expectedRevision:'original'}),env);assert.equal(stale.status,409);
});
