import {test} from "node:test";
import assert from "node:assert/strict";
import worker from "../worker.js";
import {TestR2} from "./helpers/r2.mjs";
import {TestD1} from "./helpers/d1.mjs";
import {provisionTestAccount} from "./helpers/accounts.mjs";
import {readFileSync} from "node:fs";
const origin="https://retirement.example.test";
test("retired APIs neither read nor mutate old project storage, while owner/origin guards remain",async t=>{
 const env={NEW_PROJECT_ENGINE:"1",WORKSHOP_DB:new TestD1(),PHOTOS:new TestR2(),admin_password:"synthetic-retirement-secret"};t.after(()=>env.WORKSHOP_DB.close());
 const login=await provisionTestAccount(new Request(origin+"/api/accounts",{method:"POST",headers:{origin},body:JSON.stringify({action:"register",email:"retirement-owner@example.test",password:"synthetic-retirement-password"})}),env,{role:"admin"}),cookie=login.headers.get('set-cookie').split(';')[0];
 await env.PHOTOS.put('trees/launcher.json','{"nodes":[]}');const before=structuredClone([...env.PHOTOS.objects]);
 for(const path of ['/api/projects','/api/components','/api/tree','/api/project/archive','/api/project/backups','/api/recipe-files','/api/photo'])for(const method of ['GET','POST','PATCH','DELETE']){
  const request=new Request(origin+path,{method,headers:{origin,cookie},...(method==='GET'?{}:{body:'{"project":"launcher"}'})});
  const response=await worker.fetch(request,env,{});assert.equal(response.status,410,method+' '+path);assert.equal((await response.json()).code,'LEGACY_RETIRED');
 }
 assert.deepEqual([...env.PHOTOS.objects],before);
 assert.equal((await worker.fetch(new Request(origin+'/api/tree'),env,{})).status,401);
 assert.equal((await worker.fetch(new Request(origin+'/api/tree',{method:'DELETE',headers:{cookie,origin:'https://outsider.example.test'}}),env,{})).status,403);
});
test('the current home and Settings HTML are dispatched through the Worker',async()=>{
 const config=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
 for(const path of ['/','/index.html','/project.html','/website-settings.html'])assert.ok(config.assets.run_worker_first.includes(path),path);
 const response=await worker.fetch(new Request(origin+'/index.html?legacy=1'),{},{});assert.equal(response.status,302);assert.equal(response.headers.get('location'),origin+'/project.html');
});
