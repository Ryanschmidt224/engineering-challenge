import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultBackupReminder,backupReminderSummary,normalizeBackupReminder,DAY_MS} from '../assets/backup-reminder-model.js';
import {backupReminderResponse} from '../functions/api/backup-reminder.js';
import {websiteSettingsResponse,readWebsiteSettings} from '../functions/api/website-settings.js';
import {initializeProjectEngine} from '../functions/api/project-engine-migrations.js';
import {handleProjectEngine} from '../functions/api/project-engine.js';
import {TestD1} from './helpers/d1.mjs';
import {TestR2} from './helpers/r2.mjs';
import {provisionTestAccount} from './helpers/accounts.mjs';
const origin='https://preview.example.test',path='/api/project-engine/backup-reminder';
const request=body=>new Request(origin+path,{method:body?'POST':'GET',...(body?{body:JSON.stringify(body)}:{})});
const now=new Date('2026-11-28T15:00:00.000Z');
async function setup(t){const db=new TestD1();t.after(()=>db.close());await initializeProjectEngine(db);return db;}
test('outside-copy reminders use strict interval boundaries, calendar-independent age, and server snooze expiry',()=>{
 const settings=defaultBackupReminder();assert.equal(backupReminderSummary(settings,now).due,true);
 settings.lastConfirmed={at:new Date(+now-30*DAY_MS).toISOString(),backupCreatedAt:null};
 assert.equal(backupReminderSummary(settings,now).due,false);assert.equal(backupReminderSummary(settings,new Date(+now+1)).due,true);
 settings.snoozedUntil=new Date(+now+3*DAY_MS).toISOString();assert.equal(backupReminderSummary(settings,new Date(+now+2*DAY_MS)).due,false);assert.equal(backupReminderSummary(settings,new Date(+now+3*DAY_MS)).due,true);
 settings.intervalDays=90;assert.equal(backupReminderSummary(settings,new Date(+now+3*DAY_MS)).due,false);
 for(const intervalDays of [6,91,7.5,'30'])assert.throws(()=>normalizeBackupReminder({...settings,intervalDays}),/7 to 90/);
 for(const intervalDays of [7,90])assert.equal(normalizeBackupReminder({...settings,intervalDays}).intervalDays,intervalDays);
});
test('only explicit confirmation clears reminder; download dates retain archive age, settings edits preserve records, snooze survives cold reads',async t=>{
 const db=await setup(t),run=(body,date=now)=>backupReminderResponse(db,request(body),date);
 const download=await run({action:'downloaded',source:'nightly',backupCreatedAt:'2026-10-01T09:17:00.000Z'});
 assert.equal(download.due,true);assert.equal(download.lastConfirmed,null);assert.equal(download.lastDownloaded.backupCreatedAt,'2026-10-01T09:17:00.000Z');
 await assert.rejects(run({action:'confirm'}),/Confirm/);
 const snoozed=await run({action:'snooze'});assert.equal(snoozed.due,false);
 assert.equal((await backupReminderResponse(db,request(),new Date(+now+2*DAY_MS))).snoozedUntil,snoozed.snoozedUntil);
 assert.equal((await backupReminderResponse(db,request(),new Date(+now+3*DAY_MS))).due,true);
 const initial=await readWebsiteSettings(db);
 const confirmed=await run({action:'confirm',confirmed:true,backupCreatedAt:download.lastDownloaded.backupCreatedAt});assert.equal(confirmed.due,false);assert.equal(confirmed.lastConfirmed.at,now.toISOString());assert.equal(confirmed.lastConfirmed.backupCreatedAt,download.lastDownloaded.backupCreatedAt);assert.equal(confirmed.snoozedUntil,null);
 await assert.rejects(websiteSettingsResponse(db,{expectedRevision:initial.revision,value:{...initial,tags:['Changed']}}),e=>e.status===409);
 const current=await readWebsiteSettings(db);
 const saved=await websiteSettingsResponse(db,{expectedRevision:current.revision,value:{tags:['Updated'],owners:['Ryan'],defaultOwner:'Ryan'}});
 assert.deepEqual(saved.backupReminder,normalizeBackupReminder(confirmed));
 const manual=await run({action:'confirm',confirmed:true});assert.equal(manual.lastConfirmed.backupCreatedAt,null);
 const changed=await run({action:'interval',intervalDays:7});assert.equal(changed.intervalDays,7);assert.deepEqual(changed.lastDownloaded,download.lastDownloaded);
 await assert.rejects(run({action:'downloaded',source:'nightly',backupCreatedAt:'2028-01-01T00:00:00.000Z'}),/creation date/);
});
test('reminder updates retry settings revision conflicts without losing other settings or a newer snooze',async t=>{
 const db=await setup(t),prepare=db.prepare.bind(db);let interrupted=false;
 db.prepare=sql=>{
  const statement=prepare(sql);
  if(sql.startsWith('UPDATE website_settings SET value=')){
   const bind=statement.bind.bind(statement);statement.bind=(...args)=>{
    const bound=bind(...args),run=bound.run.bind(bound);bound.run=async()=>{
     if(!interrupted){interrupted=true;const current=await readWebsiteSettings(db);await websiteSettingsResponse(db,{expectedRevision:current.revision,value:{...current,tags:['Another device']}});}
     return run();
    };return bound;
   };
  }return statement;
 };
 await backupReminderResponse(db,request({action:'snooze'}),now);
 const result=await readWebsiteSettings(db);assert.deepEqual(result.tags,['Another device']);assert.equal(result.backupReminder.snoozedUntil,new Date(+now+3*DAY_MS).toISOString());
});
test('real reminder route requires owner and same-origin mutation, rejects unsupported methods and invalid settings',async t=>{
 const env={WORKSHOP_DB:new TestD1(),PHOTOS:new TestR2(),admin_password:'synthetic-backup-reminder-secret'};t.after(()=>env.WORKSHOP_DB.close());
 const call=(method='GET',body,headers={})=>handleProjectEngine(new Request(origin+path,{method,headers:{origin,...headers},...(body?{body:JSON.stringify(body)}:{})}),env);
 assert.equal((await call()).status,401);
 const login=await provisionTestAccount(new Request(origin+'/api/accounts',{method:'POST',headers:{origin},body:JSON.stringify({action:'register',email:'reminder-owner@example.test',password:'synthetic-reminder-password'})}),env,{role:'admin'}),cookie=login.headers.get('set-cookie').split(';')[0];
 assert.equal((await call('POST',{action:'confirm',confirmed:true},{cookie,origin:'https://outside.test'})).status,403);
 assert.equal((await call('DELETE',null,{cookie})).status,405);
 assert.equal((await call('POST',{action:'interval',intervalDays:6},{cookie})).status,400);
 assert.equal((await call('POST',{action:'confirm'},{cookie})).status,400);
 const read=await call('GET',null,{cookie});assert.equal(read.status,200);assert.match(read.headers.get('cache-control'),/no-store/);assert.equal((await read.json()).due,true);
 assert.equal((await call('POST',{action:'snooze'},{cookie})).status,200);
 assert.equal((await(await call('GET',null,{cookie})).json()).due,false);
});
