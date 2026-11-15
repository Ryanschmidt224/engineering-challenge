import {test} from "node:test";
import assert from "node:assert/strict";
import {handleAccounts} from "../functions/api/accounts.js";
import {onRequest as personalWorkshop} from "../functions/api/personal-workshop.js";
import {onRequest as workshopReference} from "../functions/api/workshop-reference.js";

const ORIGIN="https://schmidt.example";
class TestBucket{
 constructor(){this.objects=new Map()}
 async get(key){
  const entry=this.objects.get(key);if(!entry)return null;
  return {etag:entry.etag,size:entry.body.byteLength,httpMetadata:entry.meta,
   async text(){return new TextDecoder().decode(entry.body)},
   get body(){return new ReadableStream({start(ctrl){ctrl.enqueue(entry.body);ctrl.close()}})}};
 }
 async head(key){const e=this.objects.get(key);return e?{etag:e.etag,size:e.body.byteLength}:null}
 async put(key,value,opts={}){
  const old=this.objects.get(key);
  if(opts.onlyIf?.etagDoesNotMatch==="*"&&old)return null;
  if(opts.onlyIf?.etagMatches&&old?.etag!==opts.onlyIf.etagMatches)return null;
  const body=typeof value==="string"?new TextEncoder().encode(value):value;
  const entry={body,etag:crypto.randomUUID(),meta:opts.httpMetadata||{}};
  this.objects.set(key,entry);return {etag:entry.etag};
 }
 async delete(key){this.objects.delete(key)}
}
const request=(path,method="GET",body,session)=>{
 const headers={...(method!=="GET"?{origin:ORIGIN}:{}),...(session?{cookie:session}:{})};
 if(body!==undefined)headers["content-type"]="application/json";
 return new Request(ORIGIN+path,{method,headers,...(body===undefined?{}:{body:JSON.stringify(body)})});
};
const cookie=r=>r.headers.get("set-cookie")?.split(";")[0];
const data=async r=>({status:r.status,body:await r.json()});
const register=async(env,email)=>{
 const response=await handleAccounts(request("/api/accounts","POST",{action:"register",email,password:"test-account-password-strong-2026"}),env);
 assert.equal(response.status,201);
 return cookie(response);
};

test("public Workshop references are readable, but visitors cannot edit shared catalog",async()=>{
 const env={PHOTOS:new TestBucket(),admin_password:"test-admin-secret"};
 let result=await data(await workshopReference({request:request("/api/workshop-reference"),env}));
 assert.equal(result.status,200);assert.deepEqual(result.body.items,{});assert.equal(result.body.canEdit,false);
 result=await data(await workshopReference({request:request("/api/workshop-reference","PUT",{id:"workshop:meter",details:{name:"Modified"}}),env}));
 assert.equal(result.status,403);
});

test("shared Workshop editing requires claimed admin role and preserves saved fields",async()=>{
 const env={PHOTOS:new TestBucket(),admin_password:"test-admin-secret"};
 const session=await register(env,"siteadmin@example.test");
 const before=await data(await workshopReference({request:request("/api/workshop-reference","PUT",{id:"workshop:meter",details:{name:"Modified"}} ,session),env}));
 assert.equal(before.status,403);
 const claimed=await data(await handleAccounts(request("/api/accounts","POST",{action:"claim-admin",adminPassword:env.admin_password},session),env));
 assert.equal(claimed.status,200);
 assert.equal(claimed.body.user.role,"admin");
 const edited=await data(await workshopReference({request:request("/api/workshop-reference","PUT",{id:"workshop:meter",details:{
  name:"Digital multimeter",spec:"DC volts and resistance",manufacturer:"Example Instruments",model:"ABC-100",
  partNumber:"ABC100",supplier:"Example Supplier",supplierUrl:"https://example.com/abc100",
  asin:"B012345678",price:"$100",packageQuantity:"1",orderNotes:"Order the genuine item",notes:"Workshop standard",
  photos:[]
 }},session),env}));
 assert.equal(edited.status,200);
 const fetched=await data(await workshopReference({request:request("/api/workshop-reference"),env}));
 assert.equal(fetched.body.items["workshop:meter"].model,"ABC-100");
 assert.equal(fetched.body.items["workshop:meter"].spec,"DC volts and resistance");
});

test("private Workshop inventory is isolated between users and retains shared catalog links",async()=>{
 const env={PHOTOS:new TestBucket(),admin_password:"test-admin-secret"};
 const owner=await register(env,"owner@example.test");
 const outsider=await register(env,"outsider@example.test");
 const added=await data(await personalWorkshop({request:request("/api/personal-workshop","POST",{
  name:"My multimeter",category:"Measurement",kind:"equipment",quantity:1,
  unit:"pcs",catalogId:"workshop:meter",stockStatus:"in_use_reusable",
  specifications:[{name:"Counts",value:"6000"}]
 },owner),env}));
 assert.equal(added.status,200);assert.equal(added.body.items.length,1);
 const item=added.body.items[0];
 assert.equal(item.catalogId,"workshop:meter");
 const other=await data(await personalWorkshop({request:request("/api/personal-workshop","GET",undefined,outsider),env}));
 assert.equal(other.status,200);assert.deepEqual(other.body.items,[]);
 const edited=await data(await personalWorkshop({request:request("/api/personal-workshop","PUT",{
  ...item,quantity:2,stockStatus:"committed"
 },owner),env}));
 assert.equal(edited.status,200);
 assert.equal(edited.body.items[0].stockStatus,"committed");
 assert.equal(edited.body.items[0].catalogId,"workshop:meter");
 const forbidden=await data(await personalWorkshop({request:request("/api/personal-workshop","PUT",{
  ...item,quantity:100
 },outsider),env}));
 assert.equal(forbidden.status,404);
 const visitor=await data(await personalWorkshop({request:request("/api/personal-workshop"),env}));
 assert.equal(visitor.status,401);
});

test("shared Workshop edits reject unsafe ordering links and invalid image references",async()=>{
 const env={PHOTOS:new TestBucket(),admin_password:"test-admin-secret"};
 const session=await register(env,"otheradmin@example.test");
 assert.equal((await handleAccounts(request("/api/accounts","POST",{action:"claim-admin",adminPassword:env.admin_password},session),env)).status,200);
 const unsafe=await data(await workshopReference({request:request("/api/workshop-reference","PUT",{
  id:"workshop:meter",details:{supplierUrl:"javascript:alert(1)"}
 },session),env}));
 assert.equal(unsafe.status,400);
 const invalid=await data(await workshopReference({request:request("/api/workshop-reference","PUT",{
  id:"workshop:meter",details:{photos:[{id:"not-a-uuid"}]}
 },session),env}));
 assert.equal(invalid.status,400);
});
