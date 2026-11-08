import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {webcrypto} from "node:crypto";

const ctx=extra=>({
 Response,Request,Headers,URL,Date,JSON,Array,Set,Map,Uint8Array,ArrayBuffer,
 TextEncoder,TextDecoder,Number,String,RegExp,Error,console,
 crypto:webcrypto,btoa:text=>Buffer.from(text,"binary").toString("base64"),
 atob:text=>Buffer.from(text,"base64").toString("binary"),
 isAdmin:async()=>true,...extra
});
const compile=(path,exports,additional={})=>{
 const code=readFileSync(path,"utf8")
  .replace(/^import .*?;\s*$/gm,"").replace(/^export /gm,"");
 return runInNewContext(code+"\n({"+exports.join(",")+"})",ctx(additional));
};
const archive=compile("functions/api/project-archive.js",["handleProjectArchive","inspectArchive","sha256","encodeBytes","decodeBytes","PROJECTS","exportProject"]);
const staging=compile("functions/api/archive-staging.js",["handleArchiveStaging"],archive);
const automatic=compile("functions/api/automatic-backups.js",["backupAllProjects","handleAutomaticBackups"],archive);
const url=p=>"https://test.example"+p;
const request=(method,path,body)=>new Request(url(path),{method,
 headers:body?{"content-type":"application/json"}:{},
 body:body?JSON.stringify(body):undefined});
const bytes=value=>Buffer.isBuffer(value)?value:Buffer.from(value);
function fakeBucket(initial={}){
 const records=new Map(Object.entries(initial).map(([key,value])=>[key,{
  bytes:bytes(value),httpMetadata:{contentType:key.endsWith(".json")?"application/json":"application/octet-stream"},
  customMetadata:{filename:key.split("/").pop()}
 }]));
 const modified=[];
 const wrap=object=>object?{
  size:object.bytes.length,customMetadata:object.customMetadata,
  httpMetadata:object.httpMetadata,
  arrayBuffer:async()=>object.bytes.buffer.slice(object.bytes.byteOffset,object.bytes.byteOffset+object.bytes.byteLength),
  text:async()=>object.bytes.toString("utf8"),
  body:new ReadableStream({start(c){c.enqueue(object.bytes);c.close()}})
 }:null;
 return {
  records,modified,
  get:async key=>wrap(records.get(key)),
  head:async key=>wrap(records.get(key)),
  put:async(key,value,options={})=>{
   const data=typeof value==="string"?Buffer.from(value):Buffer.from(value);
   records.set(key,{bytes:data,httpMetadata:options.httpMetadata||{},customMetadata:options.customMetadata||{}});
   modified.push(key);
   return {size:data.length};
  },
  list:async({prefix,cursor})=>{
   const matching=[...records.keys()].filter(k=>k.startsWith(prefix)).sort(),index=cursor?Number(cursor):0,size=2;
   return {objects:matching.slice(index,index+size).map(key=>({
    key,size:records.get(key).bytes.length,customMetadata:records.get(key).customMetadata,
    uploaded:new Date("2026-11-08T00:00:00Z")
   })),truncated:index+size<matching.length,cursor:String(index+size)};
  }
 };
}
const sample={
 "trees/launcher.json":'[{"id":"assembly-a","name":"Cabinet"}]',
 "components/launcher.json":'[{"id":"part-a","name":"Buck converter","assemblyId":"assembly-a","quantity":2}]',
 "workspaces/launcher/assembly-a.json":'{"instructions":"Build","recipe":[{"id":"s1","title":"Inspect","standard":"Check","detail":"","kind":"inspection"}]}',
 "part-workspaces/launcher/part-a.json":'{"instructions":"Wire input","history":[]}',
 "component-thumbnails/launcher/part-a":Buffer.from([0,255,1,2]),
 "drawings/launcher/part/part-a/drawing.pdf":Buffer.from("%PDF-1.4\u0000data"),
 "part-files/launcher/part-a/example.x_t":Buffer.from("parasolid-body"),
 "part-pages/launcher/part-a/source.html":Buffer.from("<title>Product</title>"),
 "libraries/wires.json":"[]","libraries/purchased-parts.json":"[]"
};
test("archive validates and reopens all BOM, work instruction and binary asset records",async()=>{
 const bucket=fakeBucket(sample),env={PHOTOS:bucket};
 const result=await archive.handleProjectArchive(request("GET","/api/project/archive?project=launcher"),env);
 assert.equal(result.status,200);
 const data=await result.json();
 assert.equal(data.objectCount,Object.keys(sample).length);
 const validated=await archive.inspectArchive(data,"launcher");
 assert.equal(validated.ok,true);
 for(const [key,value] of Object.entries(sample)){
  const item=data.objects.find(o=>o.key===key);
  assert.ok(item,"Missing "+key);
  assert.deepEqual(Buffer.from(item.data,"base64"),bytes(value));
 }
 assert.equal(bucket.modified.length,0);
});
test("isolated stage restores full archive and never overwrites active project",async()=>{
 const bucket=fakeBucket(sample),env={PHOTOS:bucket};
 const original=await (await archive.handleProjectArchive(request("GET","/api/project/archive?project=launcher"),env)).json();
 const baseline=new Map([...bucket.records].map(([k,v])=>[k,Buffer.from(v.bytes)]));
 const staged=await staging.handleArchiveStaging(request("POST","/api/project/staging?project=launcher",original),env);
 assert.equal(staged.status,201);
 const summary=await staged.json();
 assert.equal(summary.liveProjectModified,false);
 assert.ok(summary.id);
 const recovered=await staging.handleArchiveStaging(request("GET","/api/project/staging?project=launcher&id="+summary.id+"&download=1"),env);
 assert.equal(recovered.status,200);
 const restored=await recovered.json();
 assert.equal(restored.objectCount,original.objectCount);
 assert.equal((await archive.inspectArchive(restored,"launcher")).ok,true);
 for(const item of restored.objects){
  const source=original.objects.find(o=>o.key===item.key);
  assert.equal(item.sha256,source.sha256);
  assert.deepEqual(item.customMetadata,source.customMetadata);
 }
 for(const [key,data] of baseline){
  assert.deepEqual(bucket.records.get(key).bytes,data,"Active project modified: "+key);
 }
 assert.ok(bucket.modified.every(key=>key.startsWith("recovery-staging/launcher/")));
});
test("corrupted archive is rejected before creating any recovery copy",async()=>{
 const bucket=fakeBucket(sample),env={PHOTOS:bucket};
 const original=await (await archive.handleProjectArchive(request("GET","/api/project/archive?project=launcher"),env)).json();
 original.objects[0].data="AAAA";
 const response=await staging.handleArchiveStaging(request("POST","/api/project/staging?project=launcher",original),env);
 assert.equal(response.status,422);
 assert.equal(bucket.modified.length,0);
});
test("automatic project snapshots preserve prior snapshots and avoid modifying project records",async()=>{
 const bucket=fakeBucket(sample),env={PHOTOS:bucket};
 const baseline=new Map([...bucket.records].map(([k,v])=>[k,Buffer.from(v.bytes)]));
 const when=new Date("2026-11-08T07:00:00Z");
 const results=await automatic.backupAllProjects(env,when);
 assert.equal(results.find(x=>x.project==="launcher").status,"saved");
 const list=await automatic.handleAutomaticBackups(request("GET","/api/project/backups?project=launcher"),env);
 assert.equal(list.status,200);
 const entries=(await list.json()).backups;assert.equal(entries.length,1);
 const download=await automatic.handleAutomaticBackups(request("GET","/api/project/backups?project=launcher&id="+entries[0].id),env);
 assert.equal(download.status,200);
 assert.equal((await archive.inspectArchive(await download.json(),"launcher")).ok,true);
 for(const [key,data] of baseline)assert.deepEqual(bucket.records.get(key).bytes,data);
 assert.ok(bucket.modified.every(key=>key.startsWith("automatic-backups/")));
});
