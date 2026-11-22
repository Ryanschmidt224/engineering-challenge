import {test} from 'node:test';
import assert from 'node:assert/strict';
import {onRequest} from '../functions/api/workshop-templates.js';
import {onRequest as references} from '../functions/api/workshop-reference.js';
import {cleanLayout,cleanProductSections} from '../functions/api/workshop-template-schema.js';
import {fixture,request,templateBody} from './helpers/workshop-fixture.mjs';
const KEY='workshop-templates/v1.json';
const call=async(f,method='GET',body)=>{
 const response=await onRequest({request:request('/api/workshop-templates',method,body,f.session),env:f.env});
 return {status:response.status,...await response.json()};
};

test('template lifecycle strips source values, keeps IDs, and never modifies Workshop items',async()=>{
 const f=await fixture();
 await f.env.PHOTOS.put('workshop-reference-overrides/v1.json',JSON.stringify({existing:{name:'Untouched'}}));
 const before=(await f.env.PHOTOS.get('workshop-reference-overrides/v1.json')).etag;
 const created=await call(f,'POST',templateBody());assert.equal(created.status,200);
 const saved=created.template;assert.ok(saved.revision);
 assert.equal(saved.tableLayout.sections.identity.rows[0].value,'');
 assert.deepEqual(saved.tableLayout.sections.identity.hiddenFields,['model']);
 assert.equal(saved.productSections[0].fields[0].value,'');
 assert.equal(saved.productSections[0].fields[0].id,'gate');
 assert.deepEqual((await call(f)).templates,[saved]);
 const updated=await call(f,'PUT',{...saved,name:'MOSFET updated',expectedRevision:saved.revision});
 assert.equal(updated.status,200);assert.notEqual(updated.template.revision,saved.revision);
 assert.equal((await call(f,'DELETE',{id:saved.id,expectedRevision:saved.revision})).status,409);
 assert.equal((await call(f,'DELETE',{id:saved.id,expectedRevision:updated.template.revision})).status,200);
 assert.deepEqual((await call(f)).templates,[]);
 assert.equal((await f.env.PHOTOS.get('workshop-reference-overrides/v1.json')).etag,before);
});

test('same-template racing saves reject one writer, while unrelated template writes retry safely',async()=>{
 const f=await fixture();
 const original=(await call(f,'POST',templateBody())).template;
 let competing;
 f.env.PHOTOS.beforePut=async key=>{
  assert.equal(key,KEY);
  competing=await call(f,'PUT',{...original,name:'Other writer',expectedRevision:original.revision});
 };
 const stale=await call(f,'PUT',{...original,name:'Stale writer',expectedRevision:original.revision});
 assert.equal(competing.status,200);assert.equal(stale.status,409);
 assert.equal(stale.code,'REVISION_CONFLICT');
 assert.equal((await call(f)).templates[0].name,'Other writer');
 const current=competing.template;
 f.env.PHOTOS.beforePut=async()=>{assert.equal((await call(f,'POST',templateBody('Relay'))).status,200)};
 assert.equal((await call(f,'PUT',{...current,name:'Latest MOSFET',expectedRevision:current.revision})).status,200);
 assert.equal((await call(f)).templates.length,2);
});

test('legacy templates acquire revisions on first guarded save; unguarded clients cannot overwrite them',async()=>{
 const f=await fixture(),legacy={...templateBody(),id:'tpl-11111111-1111-4111-8111-111111111111'};
 await f.env.PHOTOS.put(KEY,JSON.stringify({[legacy.id]:legacy}));
 assert.equal((await call(f,'PUT',legacy)).status,428);
 const saved=await call(f,'PUT',{...legacy,expectedRevision:null});assert.equal(saved.status,200);
 assert.ok(saved.template.revision);
 assert.equal((await call(f,'PUT',{...legacy,expectedRevision:null})).status,409);
});

test('template writes validate authorization, names, duplicates, malformed fields and request size',async()=>{
 const f=await fixture();
 assert.equal((await call({...f,session:null},'POST',templateBody())).status,401);
 assert.equal((await onRequest({request:new Request('https://workshop.example/api/workshop-templates',{
  method:'POST',headers:{cookie:f.session,origin:'https://elsewhere.example'},body:JSON.stringify(templateBody())}),env:f.env})).status,403);
 assert.equal((await call(f,'POST',templateBody())).status,200);
 assert.equal((await call(f,'POST',templateBody('mosfet'))).status,409);
 for(const patch of [{name:{}},{category:[]},{category:"not-a-category"},{tableLayout:{sections:[]}},
  {tableLayout:{sections:{identity:{labels:'bad'}}}},
  {tableLayout:{sections:{identity:{hiddenFields:'bad'}}}},
  {tableLayout:{sections:{identity:{rows:[null]}}}},
  {tableLayout:{sections:{identity:{labels:{unknown:'Bad'}}}}},
  {productSections:[{id:'s',title:'bad',fields:[null]}]},
  {genericFields:[null]}]){
  assert.equal((await call(f,'POST',{...templateBody('Invalid'),...patch})).status,400,JSON.stringify(patch));
 }
 const duplicate=templateBody('Duplicate');duplicate.tableLayout.sections.identity.rows.push({...duplicate.tableLayout.sections.identity.rows[0]});
 assert.equal((await call(f,'POST',duplicate)).status,400);
 assert.equal((await call(f,'POST',{...templateBody('Large'),padding:'x'.repeat(256*1024)})).status,413);
});

test('bad stored entries are isolated and storage failures return usable errors',async()=>{
 const f=await fixture(),saved=(await call(f,'POST',templateBody())).template;
 await f.env.PHOTOS.put(KEY,JSON.stringify({[saved.id]:saved,broken:null}));
 assert.equal((await call(f)).templates.length,1);
 assert.equal((await call(f,'POST',templateBody('Relay'))).status,200);
 const originalGet=f.env.PHOTOS.get.bind(f.env.PHOTOS);
 f.env.PHOTOS.get=async key=>{if(key===KEY)throw Error('storage offline');return originalGet(key)};
 const failure=await call(f);assert.equal(failure.status,503);assert.match(failure.error,/temporarily unavailable/);
});

test('template and Workshop item persistence use the same field contract and preserve custom row IDs',async()=>{
 const f=await fixture(),source=templateBody();
 const created=await references({request:request('/api/workshop-reference','POST',{
  details:{name:'Test switch',category:'electrical-switching',...source,name:'Test switch'}},f.session),env:f.env});
 assert.equal(created.status,201);
 const {details}=await created.json();
 assert.equal(details.tableLayout.sections.identity.rows[0].value,'SOURCE VALUE');
 const saved=(await call(f,'POST',{...source,tableLayout:details.tableLayout,productSections:details.productSections})).template;
 assert.equal(saved.tableLayout.sections.identity.rows[0].id,details.tableLayout.sections.identity.rows[0].id);
 assert.equal(saved.tableLayout.sections.identity.rows[0].value,'');
 const oldId=crypto.randomUUID();
 assert.equal(cleanLayout({sections:{notes:{rows:[{id:oldId,label:'Old field',value:'kept'}]}}}).sections.notes.rows[0].id,oldId);
 assert.equal(cleanProductSections([{id:'a',title:'A',fields:[]},{id:'a',title:'A',fields:[]}]),null);
});
