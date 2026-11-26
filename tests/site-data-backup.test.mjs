import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TestD1} from './helpers/d1.mjs';
import {TestR2} from './helpers/r2.mjs';
import {siteBackupEntries,backupFilename} from '../functions/api/site-data-backup.js';
import {guardPrivateApi} from '../functions/api/private-access.js';
test('whole-site backup includes all user tables and every storage namespace without mutations',async t=>{
 const db=new TestD1(),bucket=new TestR2();t.after(()=>db.close());await db.prepare('CREATE TABLE content(id INTEGER PRIMARY KEY,value BLOB)').run();await db.prepare('INSERT INTO content VALUES(?,?)').bind(1,'Legacy and new').run();await db.prepare('CREATE TABLE workshop(id TEXT PRIMARY KEY,value TEXT)').run();await db.prepare('INSERT INTO workshop VALUES(?,?)').bind('part','Catalog').run();for(const key of ['legacy/photos/a','project-engine/workshop/project/file','automatic-backups/engine/project/copy'])await bucket.put(key,'exact '+key);const before=[...bucket.objects.keys()],entries=[];for await(const entry of siteBackupEntries({WORKSHOP_DB:db,PHOTOS:bucket}))entries.push(entry);assert.equal(entries.filter(e=>e.type==='row').length,2);assert.equal(entries.filter(e=>e.type==='object').length,3);for(const e of entries.filter(e=>e.type==='bytes'))assert.match(atob(e.data),/^exact /);assert.deepEqual([...bucket.objects.keys()],before);assert.equal(entries.at(-1).type,'verified');assert.equal(backupFilename(new Date('2026-11-26T05:00:00Z')),'BuildingSchmidtDataBackup-2026-11-25.bsbackup');
});
test('concurrent changes make the whole-site backup incomplete rather than falsely verified',async t=>{
 const db=new TestD1();t.after(()=>db.close());await db.prepare('CREATE TABLE content(value TEXT)').run();const bucket=new TestR2();await bucket.put('a','first');const entries=siteBackupEntries({WORKSHOP_DB:db,PHOTOS:bucket});let changed=false;await assert.rejects(async()=>{for await(const entry of entries)if(entry.type==='object'&&!changed){changed=true;await bucket.put('a','second');}},/changed/);
});
test('signed-out access to whole-site data is denied by the existing private API boundary',async()=>{
 const denied=await guardPrivateApi(new Request('https://preview.example.test/api/site-data-backup'),{});assert.equal(denied.status,401);
});
