import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {build} from "esbuild";
import {Miniflare,Log,LogLevel} from "miniflare";
import {LOGIN_LIMIT_KEY,LOGIN_WINDOW_MS} from "../functions/api/login-attempt-limits.js";

test("native R2 conditional admission is bounded under concurrent requests and survives cold restart",{timeout:90000},async()=>{
 const directory=await mkdtemp(join(tmpdir(),"bs-login-limits-"));
 const bundle=await build({stdin:{contents:`import {reserveLoginAttempt} from ${JSON.stringify(resolve("functions/api/login-attempt-limits.js"))};export default {async fetch(request,env){const blocked=await reserveLoginAttempt(request,env,'owner@fixture.test');return Response.json(blocked||{allowed:true},{status:blocked?.status||200});}};`,resolveDir:resolve(".")},bundle:true,write:false,format:"esm",platform:"browser"});
 const options={modules:true,script:bundle.outputFiles[0].text,compatibilityDate:"2026-07-30",r2Buckets:{PHOTOS:"login-limits"},r2Persist:directory,bindings:{admin_password:"synthetic-native-login-secret"},log:new Log(LogLevel.ERROR)};
 let runtime=new Miniflare(options);
 const request=()=>runtime.dispatchFetch("https://fixture.test/reserve",{method:"POST"});
 try{
  for(let i=0;i<9;i++)assert.equal((await request()).status,200);
  const responses=await Promise.all(Array.from({length:16},request));assert.equal(responses.filter(response=>response.status===200).length,1);assert.ok(responses.every(response=>[200,429,503].includes(response.status)));
  let bucket=await runtime.getR2Bucket("PHOTOS");assert.equal((await (await bucket.get(LOGIN_LIMIT_KEY)).json()).attempts,10);
  await runtime.dispose();runtime=new Miniflare(options);assert.equal((await request()).status,429);
  bucket=await runtime.getR2Bucket("PHOTOS");const previous=await (await bucket.get(LOGIN_LIMIT_KEY)).json();previous.startedAt=Date.now()-LOGIN_WINDOW_MS;await bucket.put(LOGIN_LIMIT_KEY,JSON.stringify(previous));
  assert.equal((await request()).status,200);assert.equal((await (await bucket.get(LOGIN_LIMIT_KEY)).json()).attempts,1);
 }finally{await runtime.dispose();await rm(directory,{recursive:true,force:true});}
});
