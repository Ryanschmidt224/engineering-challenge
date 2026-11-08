import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {mkdtemp,writeFile,readFile,rm,mkdir} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createHash} from "node:crypto";

const sha=data=>createHash("sha256").update(data).digest("hex");
const cli=(...args)=>spawnSync(process.execPath,["scripts/project-archive-cli.mjs",...args],{encoding:"utf8"});
test("lossless independent restore and repack, with refusal to overwrite",async()=>{
 const tmp=await mkdtemp(join(tmpdir(),"bs-restore-test-"));
 try{
  const initial=new Map([
   ["components/launcher.json",Buffer.from('[{"id":"p1","name":"Converter","quantity":2}]')],
   ["trees/launcher.json",Buffer.from('[{"id":"a1","name":"Cabinet","parentId":null}]')],
   ["workspaces/launcher/a1.json",Buffer.from('{"recipe":[{"id":"step1","title":"Inspect","standard":"Check polarity","detail":""}]}')],
   ["drawings/launcher/part/p1/drawing.pdf",Buffer.from([37,80,68,70,1,0,255])],
   ["part-files/launcher/p1/sample.x_t",Buffer.from("Parasolid\u0000data")],
   ["part-pages/launcher/p1/source.html",Buffer.from("<html><title>Source</title></html>")],
   ["libraries/purchased-parts.json",Buffer.from("[]")]
  ]);
  const objects=[...initial].map(([key,data])=>({key,size:data.length,sha256:sha(data),
   contentType:"application/octet-stream",httpMetadata:{},customMetadata:{},
   data:data.toString("base64")}));
  const archive={format:"building-schmidt-project",schemaVersion:1,projectId:"launcher",
   objectCount:objects.length,totalBytes:objects.reduce((n,o)=>n+o.size,0),objects};
  const input=join(tmp,"original.bsproject"),recovered=join(tmp,"recovered"),output=join(tmp,"roundtrip.bsproject");
  await writeFile(input,JSON.stringify(archive));
  assert.equal(cli("verify",input).status,0);
  const restored=cli("restore",input,recovered);
  assert.equal(restored.status,0,restored.stderr);
  for(const [key,data] of initial)assert.deepEqual(await readFile(join(recovered,"records",...key.split("/"))),data);
  const repeated=cli("restore",input,recovered);
  assert.notEqual(repeated.status,0,"Never overwrite an existing recovered folder");
  const packed=cli("pack",recovered,output);
  assert.equal(packed.status,0,packed.stderr);
  assert.equal(cli("verify",output).status,0);
  const result=JSON.parse(await readFile(output,"utf8"));
  for(const obj of result.objects)assert.equal(obj.sha256,archive.objects.find(x=>x.key===obj.key).sha256);
  const edited=join(recovered,"records","workspaces","launcher","a1.json");
  await writeFile(edited,'{"recipe":[{"id":"step1","title":"Inspect","standard":"Updated instruction","detail":""}]}');
  const revised=join(tmp,"edited.bsproject");
  assert.equal(cli("pack",recovered,revised).status,0);
  assert.equal(cli("verify",revised).status,0);
  assert.equal(cli("verify",input).status,0,"Original archive remains unchanged");
 }finally{await rm(tmp,{recursive:true,force:true})}
});
test("rejects path traversal before creating a destination",async()=>{
 const tmp=await mkdtemp(join(tmpdir(),"bs-path-test-"));
 try{
  const data=Buffer.from("test"),key="launcher/../../important.txt";
  const archive={format:"building-schmidt-project",schemaVersion:1,projectId:"launcher",
   objectCount:1,totalBytes:data.length,objects:[{key,size:data.length,sha256:sha(data),
    data:data.toString("base64"),contentType:"application/octet-stream",httpMetadata:{},customMetadata:{}}]};
  const path=join(tmp,"bad.bsproject");await writeFile(path,JSON.stringify(archive));
  assert.notEqual(cli("verify",path).status,0);
  assert.notEqual(cli("restore",path,join(tmp,"target")).status,0);
 }finally{await rm(tmp,{recursive:true,force:true})}
});
