import test from "node:test";
import assert from "node:assert/strict";
import {readFile,readdir} from "node:fs/promises";
import {SECURITY_HEADERS,secureResponse,staticHeaderRules} from "../functions/security-headers.js";
import worker from "../worker.js";
const origin="https://headers.example.test";
const check=response=>{for(const [name,value]of Object.entries(SECURITY_HEADERS))assert.equal(response.headers.get(name),value,name);};

test("one security policy covers asset-first files and all maintained HTML entrypoints avoid inline scripts",async()=>{
 assert.equal(await readFile(new URL('../_headers',import.meta.url),'utf8'),staticHeaderRules());
 const policy=SECURITY_HEADERS['Content-Security-Policy'];assert.match(policy,/script-src 'self' https:\/\/static\.cloudflareinsights\.com;/);assert.doesNotMatch(policy,/script-src[^;]*(?:unsafe-inline|unsafe-eval|data:|blob:)/);assert.match(policy,/script-src-attr 'none'/);assert.match(policy,/frame-ancestors 'self'/);assert.match(policy,/object-src 'none'/);assert.match(policy,/base-uri 'none'/);
 for(const name of(await readdir(new URL('../',import.meta.url))).filter(name=>name.endsWith('.html'))){
  const html=await readFile(new URL('../'+name,import.meta.url),'utf8');
  for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))assert.ok(/\bsrc\s*=/.test(match[1])||!match[2].trim(),name+' has an inline script');
  assert.doesNotMatch(html,/\son[a-z]+\s*=/i,name+' has an event-handler attribute');
 }
 const ignore=await readFile(new URL('../.assetsignore',import.meta.url),'utf8');assert.ok(!ignore.split('\n').includes('_headers'));
});
test("headers preserve streamed bytes, cookies, status, cache validators and stricter file policies",async()=>{
 const bytes=new Uint8Array([1,2,3,4]);const original=new Response(new ReadableStream({start(c){c.enqueue(bytes);c.close();}}),{status:201,headers:{'content-type':'image/png','content-disposition':'attachment; filename="image.png"','content-security-policy':"default-src 'none'; sandbox",'x-frame-options':'DENY','set-cookie':'bs_user=synthetic; HttpOnly; Secure','etag':'"original"','cache-control':'private, no-store'}});
 original.arrayBuffer=()=>{throw Error('Wrapper buffered the original body');};const secured=secureResponse(original);assert.equal(secured.status,201);assert.equal(secured.body,original.body);assert.deepEqual(new Uint8Array(await secured.arrayBuffer()),bytes);
 for(const name of ['content-type','content-disposition','content-security-policy','x-frame-options','set-cookie','etag','cache-control'])assert.equal(secured.headers.get(name),original.headers.get(name),name);
 for(const status of [204,304]){const response=secureResponse(new Response(null,{status}));assert.equal(response.status,status);check(response);}
});
test("redirects, owner sign-in pages, API denials and asynchronous failures receive the policy",async()=>{
 const assets={async fetch(){return new Response('<html>Sign in</html>',{headers:{'content-type':'text/html'}});}};
 let response=await worker.fetch(new Request(origin+'/'),{ASSETS:assets},{});assert.equal(response.status,302);assert.equal(response.headers.get('location'),origin+'/project.html');check(response);
 for(const path of ['/project','/project/','/project.html','/website-settings.html']){response=await worker.fetch(new Request(origin+path),{ASSETS:assets},{});assert.equal(response.status,401);check(response);assert.equal(await response.text(),'<html>Sign in</html>');}
 response=await worker.fetch(new Request(origin+'/api/workshop'),{},{});assert.equal(response.status,401);check(response);
 response=await worker.fetch(new Request(origin+'/api/accounts'),{},{});assert.equal(response.status,503);check(response);
 response=await worker.fetch(new Request(origin+'/workshop.html'),{ASSETS:assets},{});assert.equal(response.status,200);check(response);
 response=await worker.fetch(new Request(origin+'/missing'),{ASSETS:{async fetch(){throw Error('Private storage diagnostic');}}},{});assert.equal(response.status,500);check(response);assert.equal(await response.text(),'Internal server error');
});
