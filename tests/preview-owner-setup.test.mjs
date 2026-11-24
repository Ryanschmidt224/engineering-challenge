import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import {TestR2} from "./helpers/r2.mjs";
import {handleAccounts} from "../functions/api/accounts.js";
import {isAdmin} from "../functions/api/auth.js";
const html=readFileSync("scripts/preview-owner-setup.html","utf8");
// Execute the actual self-contained file's crypto function, not a second
// implementation. DOM initialization stays inert in the Node sandbox.
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
const context=vm.createContext({crypto,TextEncoder,btoa});new vm.Script(script).runInContext(context);
const generate=password=>context.generatePreviewOwnerFiles(password);
const origin="https://preview.example.test";
const login=(password,cookie)=>new Request(origin+"/api/accounts",{method:"POST",headers:{origin,"content-type":"application/json",...(cookie?{cookie}:{})},body:JSON.stringify({action:"login",email:"owner@preview.test",password})});
test("offline preview account files sign in through the unchanged owner authentication",async()=>{
 const password="synthetic-preview-owner-password",files=await generate(password),env={PHOTOS:new TestR2(),admin_password:"synthetic-server-signing-key"};
 assert.equal(files.length,2);
 for(const file of files){assert.equal(file.content.includes(password),false);await env.PHOTOS.put(file.key,file.content);}
 assert.match(files[0].key,/^users\/u[a-f\d]{32}\.json$/);assert.match(files[1].key,/^user-email\/[\w-]{43}\.json$/);
 const user=JSON.parse(files[0].content);assert.equal(user.email,"owner@preview.test");assert.equal(user.role,"admin");assert.equal(JSON.parse(files[1].content).id,user.id);assert.equal(Object.hasOwn(user,"password"),false);
 const response=await handleAccounts(login(password),env);assert.equal(response.status,200);assert.equal((await response.json()).user.role,"admin");
 const cookie=response.headers.get("set-cookie").split(";")[0];assert.equal(await isAdmin(new Request(origin+"/api/projects",{headers:{cookie}}),env),true);
 assert.equal((await handleAccounts(login("different-synthetic-password"),env)).status,401);
 // Its two generated objects stay in this isolated bucket; no production
 // namespace, remote endpoint or bootstrap handler is involved.
 assert.deepEqual([...env.PHOTOS.objects.keys()].sort(),Array.from(files,file=>file.key).sort());
});
test("each generation uses fresh identity, salt and session tokens; invalid passwords fail",async()=>{
 const first=JSON.parse((await generate("synthetic-preview-owner-password"))[0].content),second=JSON.parse((await generate("synthetic-preview-owner-password"))[0].content);
 for(const key of ["id","salt","passwordHash","sessionVersion"])assert.notEqual(first[key],second[key]);
 for(const password of [undefined,null,false,"short","a".repeat(257)])await assert.rejects(generate(password),/between 12 and 256/);
});
test("setup utility has no network capability and is excluded from deployed assets",()=>{
 assert.match(html,/connect-src 'none'/);assert.match(html,/form-action 'none'/);
 assert.doesNotMatch(script,/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|localStorage|sessionStorage/);
 assert.ok(readFileSync(".assetsignore","utf8").split(/\r?\n/).includes("scripts/**"));
 assert.doesNotMatch(readFileSync("worker.js","utf8"),/preview-owner-setup/);
});
