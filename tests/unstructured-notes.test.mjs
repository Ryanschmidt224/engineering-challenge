import {provisionTestAccount} from "./helpers/accounts.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import {handleAccounts} from "../functions/api/accounts.js";
import {onRequest as notes} from "../functions/api/unstructured-notes.js";
import {onRequest as projectsApi} from "../functions/api/projects.js";
import worker from "../worker.js";
const ORIGIN="https://schmidt.example";
class Bucket{
 constructor(){this.objects=new Map()}
 async get(key){
  const entry=this.objects.get(key);if(!entry)return null;
  return {etag:entry.etag,customMetadata:entry.meta,
   text:async()=>new TextDecoder().decode(entry.body)};
 }
 async head(key){
  const e=this.objects.get(key);
  return e?{etag:e.etag,customMetadata:e.meta}:null;
 }
 async put(key,data,options={}){
  const existing=this.objects.get(key);
  if(options.onlyIf?.etagMatches&&existing?.etag!==options.onlyIf.etagMatches)return null;
  if(options.onlyIf?.etagDoesNotMatch==="*"&&existing)return null;
  const entry={etag:crypto.randomUUID(),
   body:typeof data==="string"?new TextEncoder().encode(data):data,
   meta:options.customMetadata||{}};
  this.objects.set(key,entry);return {etag:entry.etag};
 }
 async delete(key){this.objects.delete(key)}
}
const request=(path,method="GET",body,cookie)=>{
 const headers={...(cookie?{cookie}:{}),...(method==="GET"?{}:{origin:ORIGIN}),
  ...(body===undefined?{}:{"content-type":"application/json"})};
 return new Request(ORIGIN+path,{method,headers,
  ...(body===undefined?{}:{body:JSON.stringify(body)})});
};
const parse=async response=>({status:response.status,body:await response.json()});
const send=(env,path,method="GET",body,cookie)=>notes({request:request(path,method,body,cookie),env});
const access=async(env)=>{
 const r=await provisionTestAccount(request("/api/accounts","POST",{
  action:"register",email:"notes-admin@example.test",password:"test-account-password-strong-2026"}),env);
 assert.equal(r.status,201);
 const cookie=r.headers.get("set-cookie").split(";")[0];
 const claimed=await handleAccounts(request("/api/accounts","POST",{
  action:"claim-admin",adminPassword:env.admin_password},cookie),env);
 assert.equal(claimed.status,200);
 return cookie;
};
const URL="/api/unstructured-notes?project=launcher&scope=summary&id=root";
const noteId="12345678-1234-4234-8234-123456789abc";
test("free-form notes are readable but only project editors may create them",async()=>{
 const env={PHOTOS:new Bucket(),admin_password:"test-admin-secret"};
 const first=await parse(await send(env,URL));
 assert.equal(first.status,200);assert.deepEqual(first.body.notes,[]);assert.equal(first.body.canEdit,false);
 const note={id:noteId,title:"Assembly idea",description:"Try different mounting screws.",photos:[]};
 const forbidden=await parse(await send(env,URL,"PUT",{notes:[note],expectedRevision:null}));
 assert.equal(forbidden.status,403);
 const cookie=await access(env);
 const saved=await parse(await send(env,URL,"PUT",{notes:[note],expectedRevision:null},cookie));
 assert.equal(saved.status,200);
 assert.equal(saved.body.notes[0].title,"Assembly idea");
 assert.ok(saved.body.revision);
 const read=await parse(await send(env,URL));
 assert.equal(read.body.notes.length,1);assert.equal(read.body.notes[0].description,note.description);
 assert.equal(read.body.canEdit,false);
 const stale=await parse(await send(env,URL,"PUT",{notes:[note],expectedRevision:null},cookie));
 assert.equal(stale.status,409);
});
test("notes remain independent across project summary, assemblies, BOM and parts",async()=>{
 const env={PHOTOS:new Bucket(),admin_password:"test-admin-secret"},cookie=await access(env);
 const note={id:noteId,title:"Scope detail",description:"Local only",photos:[]};
 const saved=await parse(await send(env,URL,"PUT",{notes:[note],expectedRevision:null},cookie));
 assert.equal(saved.status,200);
 for(const scope of ["workspace","bom","parts","part"]){
  const page="/api/unstructured-notes?project=launcher&scope="+scope+
   "&id="+(scope==="part"?"11111111-1111-4111-8111-111111111111":"root");
  const result=await parse(await send(env,page));
  assert.equal(result.status,200);assert.deepEqual(result.body.notes,[]);
 }
});
test("notes reuse gallery photo storage and reject cross-note photo links",async()=>{
 const env={PHOTOS:new Bucket(),admin_password:"test-admin-secret"},cookie=await access(env);
 const photo="launcher/11111111-1111-4111-8111-111111111111.png";
 await env.PHOTOS.put(photo,new Uint8Array([1,2,3]),
  {customMetadata:{assemblyId:"note-"+noteId}});
 const saved=await parse(await send(env,URL,"PUT",{notes:[
  {id:noteId,title:"Photographed assembly",description:"Mounting",photos:[photo]}
 ],expectedRevision:null},cookie));
 assert.equal(saved.status,200);
 const badId="22222222-2222-4222-8222-222222222222";
 const bad=await parse(await send(env,URL,"PUT",{notes:[
  {id:badId,title:"Wrong photo",description:"",photos:[photo]}
 ],expectedRevision:saved.body.revision},cookie));
 assert.equal(bad.status,400);
 const read=await parse(await send(env,URL));
 assert.deepEqual(read.body.notes[0].photos,[photo]);
});

test("production worker routes notes requests instead of serving the app shell",async()=>{
 const env={PHOTOS:new Bucket(),ASSETS:{fetch:async()=>new Response("<html>Fallback</html>")},admin_password:"test-admin-secret"};
 const cookie=await access(env);
 const note={id:noteId,title:"Routed note",description:"Saved through worker",photos:[]};
 const saved=await parse(await worker.fetch(request(URL,"PUT",{notes:[note],expectedRevision:null},cookie),env,{}));
 assert.equal(saved.status,200);
 assert.equal(saved.body.notes[0].description,"Saved through worker");
 const result=await parse(await worker.fetch(request(URL,"GET",undefined,cookie),env,{}));
 assert.equal(result.status,200);
 assert.equal(result.body.notes[0].title,"Routed note");
});

test("project rename uses the authorized settings API and keeps project ID stable",async()=>{
 const env={PHOTOS:new Bucket(),admin_password:"test-admin-secret"};
 const cookie=await access(env);
 const updated=await parse(await projectsApi({request:request("/api/projects","PATCH",{
  id:"launcher",name:"Renamed launcher project"
 },cookie),env}));
 assert.equal(updated.status,200);
 const project=updated.body.projects.find(p=>p.id==="launcher");
 assert.equal(project.name,"Renamed launcher project");
 const reread=await parse(await projectsApi({request:request("/api/projects"),env}));
 assert.equal(reread.body.projects.find(p=>p.id==="launcher").name,"Renamed launcher project");
 const rejected=await parse(await projectsApi({request:request("/api/projects","PATCH",{
  id:"launcher",name:""
 },cookie),env}));
 assert.equal(rejected.status,400);
 const forbidden=await parse(await projectsApi({request:request("/api/projects","PATCH",{
  id:"launcher",name:"Unauthorized name"
 }),env}));
 assert.equal(forbidden.status,401);
});
