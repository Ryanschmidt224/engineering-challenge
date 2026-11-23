import {test} from "node:test";
import assert from "node:assert/strict";
import worker from "../worker.js";
import {TestR2} from "./helpers/r2.mjs";
import {provisionTestAccount} from "./helpers/accounts.mjs";
import {zipStore} from "../assets/project-files-zip.js";
import {readStoredZip} from "./helpers/zip.mjs";
const origin="https://files.example.test",id=()=>crypto.randomUUID();
async function fixture(){const env={PHOTOS:new TestR2(),admin_password:"synthetic-file-test-signing-secret"},login=await provisionTestAccount(new Request(origin+"/api/accounts",{method:"POST",headers:{origin},body:JSON.stringify({action:"register",email:"owner@example.test",password:"synthetic-file-test-password"})}),env,{role:"admin"});return {env,cookie:login.headers.get("set-cookie").split(";")[0]};}
test("project file index includes paginated current part/assembly CAD and drawings without old selections or other projects",async()=>{
 const {env,cookie}=await fixture(),legacy=id(),modern=id(),selected=id(),old=id();await env.PHOTOS.put("components/launcher.json",JSON.stringify([{id:legacy,name:"Legacy bracket",partType:"custom",partNumber:"NR100"},{id:modern,name:"Current bracket",partType:"custom",partNumber:"NR101",selection:{selectedId:selected,candidates:[{id:selected,name:"Bracket B",partType:"custom"},{id:old,name:"Bracket A",partType:"custom"}]}}]));await env.PHOTOS.put("trees/launcher.json",JSON.stringify([{id:"assembly-1",name:"Frame",kind:"assembly",partNumber:"NR001"}]));
 const keys=["part-files/launcher/"+legacy+"/"+id()+".stl","part-files/launcher/"+modern+"/implementations/"+selected+"/"+id()+".sldprt","drawings/launcher/part/"+modern+"/implementations/"+selected+"/"+id()+".pdf","drawings/launcher/assembly/assembly-1/"+id()+".pdf"];
 for(const key of keys)await env.PHOTOS.put(key,"123456789",{customMetadata:{filename:key.endsWith(".stl")?"same.stl":key.endsWith(".pdf")?"drawing.pdf":"part.sldprt"}});
 for(const key of ["part-files/launcher/"+modern+"/implementations/"+old+"/"+id()+".stl","part-files/robot/"+legacy+"/"+id()+".stl","part-files/launcher/"+id()+"/"+id()+".stl"])await env.PHOTOS.put(key,"Excluded");
 const list=env.PHOTOS.list.bind(env.PHOTOS);env.PHOTOS.list=options=>list({...options,limit:2});const get=path=>worker.fetch(new Request(origin+path,{headers:{cookie}}),env,{});
 const response=await get("/api/project-files?project=launcher");assert.equal(response.status,200);const {files}=await response.json();assert.equal(files.length,4);assert.deepEqual(new Set(files.map(file=>file.extension)),new Set(["stl","pdf","sldprt"]));
 for(const file of files){const fetched=await get(file.url);assert.equal(fetched.status,200);assert.equal(await fetched.text(),"123456789");assert.match(fetched.headers.get("content-disposition"),/^attachment/);}
 const first=files[0],key=new URL(first.url,origin).searchParams.get("key");await env.PHOTOS.put(key,"replaced",{customMetadata:{filename:"drawing.pdf"}});assert.equal((await get(first.url)).status,409);
 const malicious="/api/project-files?"+new URLSearchParams({project:"launcher",key:"users/private.json",etag:"anything"});assert.equal((await get(malicious)).status,404);assert.equal((await worker.fetch(new Request(origin+"/api/project-files?project=launcher"),env,{})).status,401);
});
test("streaming ZIP preserves bytes, duplicate basenames, UTF-8 names and standard CRC32 across chunks",async()=>{
 const entries=[{path:"NR100/one.stl",size:9},{path:"NR101/one.stl",size:9},{path:"測定/empty.pdf",size:0}];const open=async entry=>({body:new ReadableStream({start(controller){if(entry.size){controller.enqueue(new TextEncoder().encode("1234"));controller.enqueue(new TextEncoder().encode("56789"));}controller.close();}})});
 const buffer=await new Response(zipStore(entries,open)).arrayBuffer(),files=readStoredZip(buffer);assert.deepEqual(files.map(file=>file.name),entries.map(entry=>entry.path));assert.deepEqual(files.map(file=>file.crc),[0xcbf43926,0xcbf43926,0]);assert.deepEqual(files.map(file=>file.bytes.toString()),["123456789","123456789",""]);
 await assert.rejects(()=>new Response(zipStore([{path:"bad.stl",size:10}],open)).arrayBuffer(),/changed during download/);
});
