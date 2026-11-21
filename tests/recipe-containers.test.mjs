import {retainHistory,historyKey} from "../functions/api/workspace-history.js";
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {randomUUID} from "node:crypto";

const source=readFileSync("functions/api/workspace.js","utf8")
 .replace(/^import .*;\s*$/gm,"").replace(/^export /gm,"");
const handleWorkspace=runInNewContext(source+"\nhandleWorkspace;",{
 Request,Response,URL,crypto:{randomUUID},retainHistory,historyKey,
 projectAllowed:async()=>true,canEditProject:async()=>true,
 isAdmin:async()=>true,console,Date,JSON,Number,String,Array,Object,Map,Set,RegExp
});
const path="/api/workspace?project=launcher&assembly=__root__";
const id1="11111111-1111-4111-8111-111111111111";
const id2="22222222-2222-4222-8222-222222222222";
const item=(id,title="Measure voltage")=>({id,title,tileOrder:["record:"+id1,"record:"+id2]});
const req=(method,data)=>new Request("https://example.test"+path,{
 method,headers:{"content-type":"application/json"},
 body:data===undefined?undefined:JSON.stringify(data)
});
const store=()=>{
 const entries=new Map();
 const env={PHOTOS:{
  get:async key=>entries.has(key)?{text:async()=>entries.get(key)}:null,
  put:async(key,value)=>{entries.set(key,value);return {etag:"saved"}}
 }};
 return {entries,env};
};
const workspace=async env=>(await (await handleWorkspace(req("GET"),env)).json()).workspace;

test("Work Instructions persist only container identity and tile order, not embedded notes",async()=>{
 const {env}=store();
 const save=await handleWorkspace(req("PUT",{recipe:[{
  ...item("measure"),notes:["Legacy note"],photos:["legacy.jpg"],standard:"Legacy text",
  photoNoteIds:{},experiments:[{text:"Legacy"}]
 }]}),env);
 assert.equal(save.status,200);
 const record=(await workspace(env)).recipe[0];
 assert.deepEqual(Object.keys(record).sort(),["archiveNote","archivedAt","id","tileOrder","title"]);
 assert.deepEqual(Array.from(record.tileOrder),["record:"+id1,"record:"+id2]);
 assert.equal(record.title,"Measure voltage");
});

test("drag-reordering entry tiles changes only ordering metadata",async()=>{
 const {env}=store();
 assert.equal((await handleWorkspace(req("PUT",{recipe:[item("measure")]}),env)).status,200);
 const before=await workspace(env);
 const changed={...before.recipe[0],tileOrder:["record:"+id2,"record:"+id1]};
 assert.equal((await handleWorkspace(req("PUT",{
  recipe:[changed],expectedRevision:before.revision
 }),env)).status,200);
 const after=await workspace(env);
 assert.deepEqual(Array.from(after.recipe[0].tileOrder),["record:"+id2,"record:"+id1]);
 assert.equal(after.recipe[0].id,"measure");
});

test("invalid container identifiers, duplicate tiles and malformed archive data are rejected",async()=>{
 const {env}=store();
 const invalid=[
  [item("same"),item("same")],
  [{...item("measure"),tileOrder:["record:"+id1,"record:"+id1]}],
  [{...item("measure"),tileOrder:["record:not-an-uuid"]}],
  [{...item("measure"),title:""}],
  [{...item("measure"),archivedAt:"yesterday"}],
  [{...item("measure"),archiveNote:"x".repeat(2501)}]
 ];
 for(const recipe of invalid){
  const response=await handleWorkspace(req("PUT",{recipe}),env);
  assert.equal(response.status,400,JSON.stringify(recipe).slice(0,150));
 }
});

test("stale editors cannot overwrite a newer Work Instruction or tile order",async()=>{
 const {env}=store();
 await handleWorkspace(req("PUT",{recipe:[item("measure")]}),env);
 const current=await workspace(env);
 const response=await handleWorkspace(req("PUT",{
  recipe:[{...item("measure"),title:"Changed",tileOrder:["record:"+id2]}],
  expectedRevision:"outdated"
 }),env);
 assert.equal(response.status,409);
 const after=await workspace(env);
 assert.equal(after.revision,current.revision);
 assert.equal(after.recipe[0].title,"Measure voltage");
 assert.deepEqual(Array.from(after.recipe[0].tileOrder),["record:"+id1,"record:"+id2]);
});

test("archiving a Work Instruction preserves its identity and ordered entry links",async()=>{
 const {env}=store();
 const when="2026-11-20T17:00:00.000Z";
 assert.equal((await handleWorkspace(req("PUT",{recipe:[{
  ...item("measure"),archivedAt:when,archiveNote:"Superseded test procedure"
 }]}),env)).status,200);
 const saved=(await workspace(env)).recipe[0];
 assert.equal(saved.id,"measure");
 assert.equal(saved.archivedAt,when);
 assert.equal(saved.archiveNote,"Superseded test procedure");
 assert.deepEqual(Array.from(saved.tileOrder),["record:"+id1,"record:"+id2]);
});
