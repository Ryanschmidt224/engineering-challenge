import test from "node:test";
import assert from "node:assert/strict";
import {reserveLoginAttempt,LOGIN_LIMIT_KEY,LOGIN_WINDOW_MS,LOGIN_IDENTITY_LIMIT,LOGIN_GLOBAL_LIMIT} from "../functions/api/login-attempt-limits.js";
import {handleAccounts,accountUser} from "../functions/api/accounts.js";
import {auth} from "../functions/api/auth.js";
import {TestR2} from "./helpers/r2.mjs";
import {provisionTestAccount} from "./helpers/accounts.mjs";
const origin="https://login.example.test",at=Date.parse("2026-11-28T05:00:00Z");
const fixture=()=>({PHOTOS:new TestR2(),admin_password:"synthetic-login-limit-secret"});
const req=(email="owner@example.test",ip="192.0.2.1",extra={})=>new Request(origin+"/api/accounts",{method:"POST",headers:{origin,"cf-connecting-ip":ip,...extra},body:JSON.stringify({action:"login",email,password:"synthetic-wrong-password"})});
const reserve=(env,email="owner@example.test",ip="192.0.2.1",now=at)=>reserveLoginAttempt(req(email,ip),env,email,now);
const state=async env=>JSON.parse(await (await env.PHOTOS.get(LOGIN_LIMIT_KEY)).text());

test("durable admission limits a normalized email across clients and a client across emails",async()=>{
 for(const mode of ["email","client"]){
  const env=fixture();
  for(let i=0;i<LOGIN_IDENTITY_LIMIT;i++)assert.equal(await reserve(env,mode==="client"?`person${i}@example.test`:" Owner@Example.Test ",mode==="email"?`192.0.2.${i}`:"192.0.2.1"),null);
  const before=await state(env),blocked=await reserve(env,mode==="client"?"another@example.test":"owner@example.test",mode==="email"?"192.0.2.101":"192.0.2.1",at+1000);
  assert.equal(blocked.status,429);assert.equal(blocked.code,"LOGIN_RATE_LIMITED");assert.equal(blocked.retryAfter,899);assert.deepEqual(await state(env),before);
  const stored=await (await env.PHOTOS.get(LOGIN_LIMIT_KEY)).text();assert.doesNotMatch(stored,/owner|person|192\.0\.2|password|example\.test/i);assert.ok(stored.length<16384);
 }
});
test("rotating both email and client reaches the global bound without growing stored objects",async()=>{
 const env=fixture();
 for(let i=0;i<LOGIN_GLOBAL_LIMIT;i++)assert.equal(await reserve(env,`person${i}@example.test`,`192.0.2.${i}`),null);
 const before=await state(env);assert.equal((await reserve(env,"new@example.test","198.51.100.1")).status,429);assert.deepEqual(await state(env),before);assert.equal(env.PHOTOS.objects.size,1);assert.equal(Object.keys(before.clients).length,LOGIN_GLOBAL_LIMIT);
});
test("cooldown expires without being extended by rejected requests and old state is replaced",async()=>{
 const env=fixture();for(let i=0;i<10;i++)await reserve(env);
 assert.equal((await reserve(env,undefined,undefined,at+LOGIN_WINDOW_MS-1)).retryAfter,1);
 assert.equal(await reserve(env,undefined,undefined,at+LOGIN_WINDOW_MS),null);
 assert.equal((await state(env)).attempts,1);assert.equal((await state(env)).startedAt,at+LOGIN_WINDOW_MS);
});
test("a contested last slot is reserved once; a cold module instance sees the same limit",async()=>{
 const env=fixture();for(let i=0;i<9;i++)await reserve(env);
 const results=await Promise.all(Array.from({length:25},()=>reserve(env)));
 assert.equal(results.filter(result=>result===null).length,1);assert.equal((await state(env)).attempts,10);
 const cold=await import("../functions/api/login-attempt-limits.js?cold=fixture");assert.equal((await cold.reserveLoginAttempt(req(),env,"owner@example.test",at)).status,429);
});
test("a create race, a lost write response and persistent contention never admit unreserved checks",async()=>{
 const env=fixture(),put=env.PHOTOS.put.bind(env.PHOTOS);let writes=0;
 env.PHOTOS.put=async(...args)=>{if(!writes++)return null;return put(...args);};assert.equal(await reserve(env),null);assert.equal((await state(env)).attempts,1);
 env.PHOTOS.put=async(...args)=>{await put(...args);throw Error("private storage diagnostic");};assert.equal((await reserve(env)).status,503);assert.equal((await state(env)).attempts,2);
 env.PHOTOS.put=async()=>null;const blocked=await reserve(env);assert.equal(blocked.status,503);assert.doesNotMatch(JSON.stringify(blocked),/private storage/);
});
test("corrupt, oversized, missing-ETag, future and unavailable storage fail closed",async()=>{
 for(const stored of ["broken",JSON.stringify({version:2})," ".repeat(17000),JSON.stringify({version:1,startedAt:at+60001,attempts:0,accounts:{},clients:{}}),JSON.stringify({version:1,startedAt:at,attempts:1,accounts:{},clients:{}})]){
  const env=fixture();await env.PHOTOS.put(LOGIN_LIMIT_KEY,stored);assert.equal((await reserve(env)).status,503);
 }
 const env=fixture();env.PHOTOS.get=async()=>({text:async()=>"{}"});assert.equal((await reserve(env)).status,503);
 env.PHOTOS.get=async()=>{throw Error("private outage");};assert.equal((await reserve(env)).status,503);
 assert.equal((await reserveLoginAttempt(req(),{},"owner@example.test",at)).status,503);
});
test("untrusted forwarded headers cannot choose the client bucket; missing edge IP shares a limit",async()=>{
 const env=fixture();
 for(let i=0;i<10;i++){
  const request=req(`person${i}@example.test`,"",{"x-forwarded-for":`192.0.2.${i}`,"x-real-ip":`198.51.100.${i}`});
  request.headers.delete("cf-connecting-ip");assert.equal(await reserveLoginAttempt(request,env,`person${i}@example.test`,at),null);
 }
 const request=req("another@example.test","");request.headers.delete("cf-connecting-ip");assert.equal((await reserveLoginAttempt(request,env,"another@example.test",at)).status,429);
});
test("account handler reserves before reading credentials, keeps sessions usable and closes legacy login",async()=>{
 const env=fixture();const provisioned=await provisionTestAccount(new Request(origin+"/api/accounts",{method:"POST",headers:{origin},body:JSON.stringify({action:"register",email:"owner@example.test",password:"synthetic-real-password"})}),env,{role:"admin"});
 const cookie=provisioned.headers.get("set-cookie").split(";")[0];
 for(let i=0;i<9;i++)assert.equal((await handleAccounts(req(),env)).status,401);
 let credentialReads=0;const get=env.PHOTOS.get.bind(env.PHOTOS);env.PHOTOS.get=async key=>{if(key!==LOGIN_LIMIT_KEY)credentialReads++;return get(key);};
 const denied=await handleAccounts(req(),env);assert.equal(denied.status,429);assert.match(denied.headers.get("retry-after"),/^\d+$/);assert.equal(denied.headers.get("set-cookie"),null);assert.equal(credentialReads,0);
 const current=new Request(origin+"/api/accounts",{headers:{cookie}});assert.equal((await accountUser(current,env)).role,"admin");assert.equal((await handleAccounts(current,env)).status,200);
 assert.equal((await auth(req(),env)).status,410);
 const logout=await handleAccounts(new Request(origin+"/api/accounts",{method:"DELETE",headers:{origin,cookie}}),env);assert.equal(logout.status,200);assert.match(logout.headers.get("set-cookie"),/Max-Age=0/);
});
test("origin, registration and validation guards run before touching the limiter",async()=>{
 const env=fixture();
 for(const [body,requestOrigin,status] of [[{action:"register"},origin,410],[{action:"other"},origin,400],[{action:"login",email:"bad",password:"short"},origin,400],[{action:"login",email:"owner@example.test",password:"synthetic-password"},"https://outsider.test",403]]){
  assert.equal((await handleAccounts(new Request(origin+"/api/accounts",{method:"POST",headers:{origin:requestOrigin},body:JSON.stringify(body)}),env)).status,status);
 }
 assert.equal(await env.PHOTOS.get(LOGIN_LIMIT_KEY),null);
});
