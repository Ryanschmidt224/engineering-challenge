import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {TestD1} from "./helpers/d1.mjs";
import {TestR2} from "./helpers/r2.mjs";
import {provisionTestAccount} from "./helpers/accounts.mjs";
import worker from "../worker.js";
import {verifyWorkshopBackup,restoreCatalog} from "../scripts/workshop-backup.mjs";

async function fixture(t){
 const env={WORKSHOP_DB:new TestD1(),PHOTOS:new TestR2(),admin_password:"test-only-owner-secret"};t.after(()=>env.WORKSHOP_DB.close());
 const origin="https://backup.example.test",login=await provisionTestAccount(new Request(origin+"/api/accounts",{method:"POST",headers:{origin},body:JSON.stringify({action:"register",email:"owner@example.test",password:"test-only-owner-password"})}),env,{role:"admin"});
 const cookie=login.headers.get("set-cookie").split(";")[0];
 const call=(path,method="GET",body,headers={})=>worker.fetch(new Request(origin+path,{method,headers:{origin,cookie,...headers},...(body===undefined?{}:{body:typeof body==="object"&&!(body instanceof Uint8Array)?JSON.stringify(body):body})}),env,{});
 await call("/api/workshop");return {env,call};
}
test("Workshop attachments are private, immutable, validated and survive archive/restore",async t=>{
 const {env,call}=await fixture(t),bytes=new TextEncoder().encode("%PDF-1.7\nexample fixture\n");
 const uploaded=await call("/api/workshop/file?owner=family&id=f-resistor","POST",bytes,{"x-file-name":"resistor-datasheet.pdf"});assert.equal(uploaded.status,201);
 const {id}=await uploaded.json(),url="/api/workshop/file?id="+id;
 assert.equal((await worker.fetch(new Request("https://backup.example.test"+url),env,{})).status,401);
 const download=await call(url);assert.equal(download.status,200);assert.equal(download.headers.get("content-type"),"application/octet-stream");assert.deepEqual(new Uint8Array(await download.arrayBuffer()),bytes);
 assert.equal((await call("/api/workshop/file?owner=family&id=f-resistor","POST",bytes,{"x-file-name":"fake.png"})).status,415);
 assert.equal((await call("/api/workshop/file?owner=family&id=f-resistor","POST",bytes,{origin:"https://other.example.test","x-file-name":"test.pdf"})).status,403);
 assert.equal((await call("/api/workshop","PATCH",{entity:"attachment",id,expectedRevision:1,archived:true})).status,200);
 assert.equal((await call(url)).status,200);assert.equal((await call("/api/workshop","PATCH",{entity:"attachment",id,expectedRevision:2,archived:false})).status,200);
 assert.equal([...env.PHOTOS.objects.keys()].filter(key=>key.startsWith("workshop-v2/")).length,1);
});
test("export verifies all bytes including recoverable orphans and restores into an empty database",async t=>{
 const {env,call}=await fixture(t),bytes=Uint8Array.from({length:420000},(_,index)=>index%251);
 const uploaded=await call("/api/workshop/file?owner=family&id=f-resistor","POST",bytes,{"x-file-name":"part.txt"});assert.equal(uploaded.status,201);
 await env.PHOTOS.put("workshop-v2/files/"+crypto.randomUUID(),"recoverable orphan");
 const response=await call("/api/workshop/export");assert.equal(response.status,200);
 const text=await response.text(),restoredBytes=new Map();
 const result=await verifyWorkshopBackup(text.trim().split("\n"),{onChunk:async(key,offset,chunk)=>{restoredBytes.set(key,Buffer.concat([restoredBytes.get(key)||Buffer.alloc(0),chunk]));}});
 assert.equal(result.fileCount,2);assert.deepEqual([...restoredBytes.values()].find(value=>value.length===bytes.length),Buffer.from(bytes));
 const restored=new DatabaseSync(":memory:");t.after(()=>restored.close());restoreCatalog(result.catalog,restored);
 assert.equal(restored.prepare("SELECT count(*) n FROM workshop_families").get().n,60);
 assert.equal(restored.prepare("SELECT count(*) n FROM workshop_attachments").get().n,1);
 assert.throws(()=>restoreCatalog(result.catalog,restored),/empty destination/);
 await assert.rejects(()=>verifyWorkshopBackup(text.trim().split("\n").slice(0,-1)),/incomplete/);
 const bad=text.trim().split("\n").map(line=>{const record=JSON.parse(line);if(record.type==="file")record.sha256="0".repeat(64);return JSON.stringify(record);});
 await assert.rejects(()=>verifyWorkshopBackup(bad),/checksum/);
 const missing={...result.catalog,fields:result.catalog.fields.map(field=>({...field,family_id:"missing-family"}))};
 const empty=new DatabaseSync(":memory:");t.after(()=>empty.close());assert.throws(()=>restoreCatalog(missing,empty),/FOREIGN KEY/);
 assert.equal(empty.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='workshop_families'").get(),undefined);
});
test("export fails closed when referenced bytes are missing",async t=>{
 const {env,call}=await fixture(t);const response=await call("/api/workshop/file?owner=family&id=f-resistor","POST","fixture",{"x-file-name":"notes.txt"});assert.equal(response.status,201);
 for(const key of env.PHOTOS.objects.keys())if(key.startsWith("workshop-v2/"))await env.PHOTOS.delete(key);
 assert.equal((await call("/api/workshop/export")).status,409);
});

test('new Workshop CAD uploads point to Dropbox without writing stored bytes',async t=>{
 const {env,call}=await fixture(t);const before=await env.PHOTOS.list();
 for(const name of ['part.step','assembly.SLDASM','drawing.dxf']){
  const response=await call('/api/workshop/file?owner=family&id=f-resistor','POST',new Uint8Array([1,2,3]),{'x-file-name':name});
  assert.equal(response.status,415);assert.match((await response.json()).error,/Dropbox/);
 }
 assert.deepEqual(await env.PHOTOS.list(),before);
});
