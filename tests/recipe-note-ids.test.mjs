import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {randomUUID} from "node:crypto";

const source=readFileSync("functions/api/workspace.js","utf8")
 .replace(/^import .*;\s*$/gm,"").replace(/^export /gm,"");
const handleWorkspace=runInNewContext(source+"\nhandleWorkspace;",{
 Request,Response,URL,crypto:{randomUUID},isAdmin:async()=>true,
 console,Date,JSON,Number,String,Array,Object,Map,Set,RegExp
});
const path="/api/workspace?project=launcher&assembly=__root__";
const photo="recipe-files/launcher/11111111-1111-4111-8111-111111111111.png";
const req=(method,data)=>new Request("https://example.test"+path,{
 method,headers:{"content-type":"application/json"},
 body:data===undefined?undefined:JSON.stringify(data)
});
const store=()=>{
 const entries=new Map();
 const env={PHOTOS:{
  get:async key=>entries.has(key)?{text:async()=>entries.get(key)}:null,
  put:async(key,value)=>{entries.set(key,value);return {}}
 }};
 return {entries,env};
};
const recipeStep={
 id:"measure",title:"Measure voltage",standard:"Inspect terminals",detail:"",
 kind:"measurement",notes:["Connect multimeter","Record reading"],
 photos:[photo],photoNames:{[photo]:"Reading"}
};

test("legacy index-based photo placement migrates to permanent note IDs",async()=>{
 const {env}=store();
 const response=await handleWorkspace(req("PUT",{recipe:[{
  ...recipeStep,photoAfterNote:{[photo]:0}
 }],experiments:[]}),env);
 assert.equal(response.status,200);
 const loaded=await (await handleWorkspace(req("GET"),env)).json();
 const step=loaded.workspace.recipe[0];
 assert.equal(step.notes.length,2);
 assert.equal(step.noteIds.length,2);
 assert.notEqual(step.noteIds[0],step.noteIds[1]);
 assert.equal(step.photoNoteIds[photo],step.noteIds[0]);
 assert.equal(step.photoAfterNote[photo],0);
 assert.deepEqual(Array.from(step.photos),[photo]);
});

test("photos remain attached when notes reorder and survive note deletion",async()=>{
 const {env}=store();
 let res=await handleWorkspace(req("PUT",{recipe:[{
  ...recipeStep,photoAfterNote:{[photo]:0}
 }],experiments:[]}),env);
 assert.equal(res.status,200);
 let saved=(await (await handleWorkspace(req("GET"),env)).json()).workspace;
 let step=saved.recipe[0];
 const noteId=step.noteIds[0];
 step={...step,notes:[step.notes[1],step.notes[0]],noteIds:[step.noteIds[1],step.noteIds[0]]};
 res=await handleWorkspace(req("PUT",{recipe:[step],experiments:[],expectedRevision:saved.revision}),env);
 assert.equal(res.status,200);
 saved=(await (await handleWorkspace(req("GET"),env)).json()).workspace;
 step=saved.recipe[0];
 assert.equal(step.photoNoteIds[photo],noteId);
 assert.equal(step.photoAfterNote[photo],1);
 step={...step,notes:[step.notes[0]],noteIds:[step.noteIds[0]],photoNoteIds:{},photoAfterNote:{}};
 res=await handleWorkspace(req("PUT",{recipe:[step],experiments:[],expectedRevision:saved.revision}),env);
 assert.equal(res.status,200);
 saved=(await (await handleWorkspace(req("GET"),env)).json()).workspace;
 step=saved.recipe[0];
 assert.equal(step.photos[0],photo,"deleted notes must not delete attachments");
 assert.equal(Object.keys(step.photoNoteIds).length,0);
});

test("invalid permanent note IDs and broken photo ownership are rejected",async()=>{
 const {env}=store();
 for(const fields of [
  {noteIds:["same","same"]},
  {noteIds:["only-one"]},
  {noteIds:["first","second"],photoNoteIds:{[photo]:"missing"}},
  {noteIds:["first","second"],photoNoteIds:{"unknown-photo":"first"}}
 ]){
  const result=await handleWorkspace(req("PUT",{recipe:[{...recipeStep,...fields}],experiments:[]}),env);
  assert.equal(result.status,400,JSON.stringify(fields));
 }
});

test("a stale save cannot overwrite a newer note/photo association",async()=>{
 const {env}=store();
 const first=await handleWorkspace(req("PUT",{recipe:[recipeStep],experiments:[]}),env);
 assert.equal(first.status,200);
 const current=(await (await handleWorkspace(req("GET"),env)).json()).workspace;
 const response=await handleWorkspace(req("PUT",{
  recipe:[{...recipeStep,notes:["changed","text"]}],
  experiments:[],expectedRevision:"outdated"
 }),env);
 assert.equal(response.status,409);
 const after=(await (await handleWorkspace(req("GET"),env)).json()).workspace;
 assert.equal(after.revision,current.revision);
 assert.equal(after.recipe[0].notes[0],"Connect multimeter");
});
