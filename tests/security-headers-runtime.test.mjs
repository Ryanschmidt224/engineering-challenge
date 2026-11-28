import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,rm,cp,readFile,readdir} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {build} from "esbuild";
import {Miniflare,Log,LogLevel} from "miniflare";
import {SECURITY_HEADERS} from "../functions/security-headers.js";
import {provisionTestAccount} from "./helpers/accounts.mjs";

test("native Cloudflare asset-first and Worker-first routing apply matching headers and preserve files",{timeout:90000},async()=>{
 const directory=await mkdtemp(join(tmpdir(),"bs-security-headers-")),root=resolve('.'),secret='synthetic-native-headers-secret';let runtime;
 try{
  await cp(join(root,'assets'),join(directory,'assets'),{recursive:true});await cp(join(root,'_headers'),join(directory,'_headers'));
  for(const name of(await readdir(root)).filter(name=>name.endsWith('.html')))await cp(join(root,name),join(directory,name));
  const source=await build({entryPoints:[join(root,'worker.js')],bundle:true,write:false,format:'esm',platform:'browser'});
  const config=JSON.parse(await readFile(join(root,'wrangler.jsonc'),'utf8'));
  runtime=new Miniflare({modules:true,script:source.outputFiles[0].text,compatibilityDate:"2026-07-30",assets:{directory,binding:'ASSETS',routerConfig:{has_user_worker:true,static_routing:{user_worker:config.assets.run_worker_first}}},r2Buckets:{PHOTOS:'headers-files'},d1Databases:{WORKSHOP_DB:'headers-db'},bindings:{admin_password:secret},log:new Log(LogLevel.ERROR)});
  const origin='https://fixture.test',request=(path,options={})=>runtime.dispatchFetch(origin+path,{redirect:'manual',...options}),check=response=>{for(const[name,value]of Object.entries(SECURITY_HEADERS))assert.equal(response.headers.get(name),value,name);};
  // Both extensionless canonical URLs and filename redirects use the asset router.
  for(const path of ['/workshop','/knowledge','/calculators','/assets/project-page.js']){const response=await request(path);assert.equal(response.status,200,path);check(response);}
  const cached=await request('/assets/project-page.js');const revalidated=await request('/assets/project-page.js',{headers:{'if-none-match':cached.headers.get('etag')}});assert.equal(revalidated.status,304);check(revalidated);
  assert.equal((await request('/_headers')).status,404);
  for(const path of ['/project','/project/','/project.html','/website-settings.html']){const response=await request(path);assert.equal(response.status,401,path+' '+await response.clone().text());check(response);assert.match(await response.text(),/project-signin-page\.js/);}
  let response=await request('/');assert.equal(response.status,302);check(response);
  response=await request('/api/workshop');assert.equal(response.status,401);check(response);
  response=await request('/api/accounts');assert.equal(response.status,200);check(response);assert.equal((await response.json()).user,null);
  const bucket=await runtime.getR2Bucket('PHOTOS'),provisioned=await provisionTestAccount(new Request(origin+'/api/accounts',{method:'POST',headers:{origin},body:JSON.stringify({action:'register',email:'owner@headers.test',password:'synthetic-headers-password'})}),{PHOTOS:bucket,admin_password:secret},{role:'admin'}),cookie=provisioned.headers.get('set-cookie').split(';')[0];
  response=await request('/api/accounts',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({action:'login',email:'owner@headers.test',password:'synthetic-headers-password'})});assert.equal(response.status,200);check(response);assert.match(response.headers.get('set-cookie'),/bs_user=.*HttpOnly; Secure/);
  response=await request('/api/workshop',{headers:{cookie}});assert.equal(response.status,200);check(response);await response.arrayBuffer();
  const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
  response=await request('/api/workshop/file?owner=family&id=f-resistor',{method:'POST',headers:{origin,cookie,'x-file-name':'bench.png'},body:bytes});assert.equal(response.status,201);check(response);const {id}=await response.json();
  response=await request('/api/workshop/file?id='+id,{headers:{cookie}});assert.equal(response.status,200);assert.equal(response.headers.get('content-security-policy'),"default-src 'none'; sandbox");assert.equal(response.headers.get('x-frame-options'),'SAMEORIGIN');assert.match(response.headers.get('content-type'),/image\/png/);assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);
  const document=Buffer.from('%PDF-1.7\nfixture document');response=await request('/api/workshop/file?owner=family&id=f-resistor',{method:'POST',headers:{origin,cookie,'x-file-name':'datasheet.pdf'},body:document});assert.equal(response.status,201);const attachment=await response.json();response=await request('/api/workshop/file?id='+attachment.id,{headers:{cookie}});assert.equal(response.status,200);assert.match(response.headers.get('content-disposition'),/^attachment;/);assert.equal(response.headers.get('content-security-policy'),"default-src 'none'; sandbox");assert.deepEqual(Buffer.from(await response.arrayBuffer()),document);
 }finally{if(runtime)await runtime.dispose();await rm(directory,{recursive:true,force:true});}
});
