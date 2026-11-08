import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {webcrypto,randomUUID} from "node:crypto";

const source=readFileSync("functions/api/project-archive.js","utf8")
 .replace(/^import .*;\s*$/gm,"").replace(/^export /gm,"");
const archiveHandler=runInNewContext(source+"\nhandleProjectArchive;",{
 Response,Headers,Request,URL,Date,JSON,Set,Array,Uint8Array,Number,String,RegExp,
 crypto:webcrypto,btoa:input=>Buffer.from(input,"binary").toString("base64"),
 atob:input=>Buffer.from(input,"base64").toString("binary"),
 isAdmin:async()=>true
});
const buffer=text=>Buffer.from(text,"utf8");
function fakeR2(initial={}){
 const objects=new Map(Object.entries(initial).map(([key,content])=>
  [key,{data:Buffer.isBuffer(content)?content:buffer(content),
   metadata:{filename:key.split("/").pop()},contentType:key.endsWith(".pdf")?"application/pdf":"application/json"}]));
 let writes=0;
 return {objects,writes:()=>writes,
  list:async({prefix,cursor})=>{
   const matching=[...objects.keys()].filter(key=>key.startsWith(prefix)).sort();
   const offset=cursor?Number(cursor):0;const size=2;
   return {objects:matching.slice(offset,offset+size).map(key=>({key})),
    truncated:offset+size<matching.length,cursor:String(offset+size)};
  },
  head:async key=>objects.has(key)?{}:null,
  get:async key=>{
   const value=objects.get(key);
   return value?{
    size:value.data.length,customMetadata:value.metadata,
    httpMetadata:{contentType:value.contentType},
    arrayBuffer:async()=>value.data.buffer.slice(value.data.byteOffset,value.data.byteOffset+value.data.byteLength)
   }:null;
  },
  put:async()=>{writes++;throw Error("Read-only archive must not write")},
  delete:async()=>{writes++;throw Error("Read-only archive must not delete")}
 };
}
const url="https://example.com/api/project/archive?project=launcher";
const req=(method,body)=>new Request(url,{method,headers:{"content-type":"application/json"},
 body:body===undefined?undefined:JSON.stringify(body)});
test("exports all project namespaces and global references; validates checksums without writes",async()=>{
 const r2=fakeR2({
  "trees/launcher.json":'[{"id":"assembly-1"}]',
  "components/launcher.json":'[{"id":"part-1"}]',
  "assembly-pages/launcher/__root__.json":'{"description":"Assembly"}',
  "workspaces/launcher/__root__.json":'{"recipe":[]}',
  "part-workspaces/launcher/part-1.json":'{"instructions":"Build"}',
  "harnesses/launcher/part-1.json":'[]',
  "drawings/launcher/part/part-1/demo.pdf":Buffer.from([37,80,68,70,1,2,3]),
  "component-thumbnails/launcher/part-1":Buffer.from([0,1,2,3,254]),
  "launcher/photo.jpg":Buffer.from([255,216,255,217]),
  "libraries/wires.json":'[{"id":"wire-1"}]',
  "libraries/common-parts.json":"[]"
 });
 const response=await archiveHandler(req("GET"),{PHOTOS:r2});
 assert.equal(response.status,200);
 const archived=await response.json();
 assert.equal(archived.schemaVersion,1);
 assert.equal(archived.objectCount,11);
 for(const [key,{data}] of r2.objects){
  const record=archived.objects.find(entry=>entry.key===key);
  assert.ok(record,"Missing "+key);
  assert.deepEqual(Buffer.from(record.data,"base64"),data);
 }
 const checked=await archiveHandler(req("POST",archived),{PHOTOS:r2});
 assert.equal(checked.status,200);
 assert.deepEqual((await checked.json()).objectCount,archived.objectCount);
 assert.equal(r2.writes(),0);
});
test("rejects altered data, duplicate storage keys and wrong project",async()=>{
 const r2=fakeR2({"trees/launcher.json":"[]"});
 const archive=await (await archiveHandler(req("GET"),{PHOTOS:r2})).json();
 const corrupted=structuredClone(archive);corrupted.objects[0].data="AAAA";
 assert.equal((await archiveHandler(req("POST",corrupted),{PHOTOS:r2})).status,422);
 const duplicated=structuredClone(archive);duplicated.objects.push({...duplicated.objects[0]});duplicated.objectCount++;
 duplicated.totalBytes*=2;
 assert.equal((await archiveHandler(req("POST",duplicated),{PHOTOS:r2})).status,422);
 const wrong=structuredClone(archive);wrong.projectId="robot";
 assert.equal((await archiveHandler(req("POST",wrong),{PHOTOS:r2})).status,422);
 assert.equal(r2.writes(),0);
});
test("export aborts rather than silently omitting a missing record",async()=>{
 const r2=fakeR2({"trees/launcher.json":"[]"});
 r2.get=async()=>null;
 const response=await archiveHandler(req("GET"),{PHOTOS:r2});
 assert.equal(response.status,422);
 assert.match((await response.json()).error,/disappeared/i);
});
