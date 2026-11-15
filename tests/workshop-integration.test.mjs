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
 assert.equal(result.status,401);
});

test("signed-in users may edit seeded public Workshop references and saved fields persist",async()=>{
 const env={PHOTOS:new TestBucket(),admin_password:"test-admin-secret"};
 const session=await register(env,"siteadmin@example.test");
 const before=await data(await workshopReference({request:request("/api/workshop-reference","PUT",{id:"workshop:meter",details:{name:"Modified"}} ,session),env}));
 assert.equal(before.status,200); // Members may edit seeded public catalog entries.
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

test("administrator can create, retrieve and edit shared Workshop products without mutating personal inventory",async()=>{
 const env={PHOTOS:new TestBucket(),admin_password:"test-admin-secret"};
 const session=await register(env,"catalogadmin@example.test");
 let response=await data(await workshopReference({request:request("/api/workshop-reference","POST",{
  details:{name:"Bench supply model 123",kind:"equipment",category:"electronics",
   familyId:"power-supplies",familyName:"Power Supplies & Converters",
   typeName:"Bench DC Power Supplies",manufacturer:"Example Manufacturing",model:"123",
   spec:"0–30 V adjustable output",supplierUrl:"https://example.com/item",photos:[]}
 },session),env}));
 assert.equal(response.status,201); // Signed-in member creates their own shared item.
 assert.equal((await handleAccounts(request("/api/accounts","POST",{
  action:"claim-admin",adminPassword:env.admin_password
 },session),env)).status,200);
 response=await data(await workshopReference({request:request("/api/workshop-reference","POST",{
  details:{name:"Bench supply model 123",kind:"equipment",category:"electronics",
   familyId:"power-supplies",familyName:"Power Supplies & Converters",
   typeName:"Bench DC Power Supplies",manufacturer:"Example Manufacturing",model:"123",
   spec:"0–30 V adjustable output",supplierUrl:"https://example.com/item",photos:[]}
 },session),env}));
 assert.equal(response.status,201);
 assert.match(response.body.id,/^workshop:custom-[a-f0-9-]{36}$/);
 assert.equal(response.body.details.created,true);
 const id=response.body.id;
 const read=await data(await workshopReference({request:request("/api/workshop-reference"),env}));
 assert.equal(read.body.items[id].familyId,"power-supplies");
 assert.equal(read.body.items[id].name,"Bench supply model 123");
 const saved=await data(await workshopReference({request:request("/api/workshop-reference","PUT",{
  id,details:{...read.body.items[id],notes:"Revised instructions",photos:[]}
 },session),env}));
 assert.equal(saved.status,200);
 assert.equal(saved.body.details.created,true);
 assert.equal(saved.body.details.notes,"Revised instructions");
 const second=await data(await workshopReference({request:request("/api/workshop-reference","POST",{
  details:{name:"Second supply",kind:"equipment",category:"electronics",familyId:"power-supplies"}
 },session),env}));
 assert.equal(second.status,201);
 assert.notEqual(second.body.id,id);
});

test("shared Workshop creation rejects incomplete categories, unsafe ordering URLs and missing names",async()=>{
 const env={PHOTOS:new TestBucket(),admin_password:"test-admin-secret"};
 const session=await register(env,"catalogvalidator@example.test");
 assert.equal((await handleAccounts(request("/api/accounts","POST",{
  action:"claim-admin",adminPassword:env.admin_password
 },session),env)).status,200);
 for(const details of [
  {name:"",category:"tools",familyId:"measurement"},
  {name:"Tool",category:"unknown",familyId:"measurement"},
  {name:"Tool",category:"tools",familyId:"bad family"},
  {name:"Tool",category:"tools",familyId:"measurement",supplierUrl:"javascript:alert(1)"}
 ]){
  const response=await data(await workshopReference({request:request("/api/workshop-reference","POST",{details},session),env}));
  assert.equal(response.status,400);
 }
 const read=await data(await workshopReference({request:request("/api/workshop-reference"),env}));
 assert.deepEqual(read.body.items,{});
});

test("signed-in members may publish and collaboratively edit public Workshop entries",async()=>{
 const env={PHOTOS:new TestBucket(),admin_password:"test-admin-secret"};
 const creator=await register(env,"maker-one@example.test");
 const other=await register(env,"maker-two@example.test");
 const details={name:"Member-created sensor",category:"electronics",kind:"component",
  familyId:"community-electronics",familyName:"Community contributions",spec:"5 V sensor",photos:[]};
 const guest=await data(await workshopReference({request:request("/api/workshop-reference","POST",{details}),env}));
 assert.equal(guest.status,401);
 const created=await data(await workshopReference({request:request("/api/workshop-reference","POST",{details},creator),env}));
 assert.equal(created.status,201);
 const id=created.body.id;
 assert.match(id,/^workshop:custom-/);
 assert.equal(created.body.details.created,true);
 const mine=await data(await workshopReference({request:request("/api/workshop-reference","GET",undefined,creator),env}));
 assert.equal(mine.body.canCreate,true);
 assert.equal(mine.body.canEdit,true);
 assert.ok(mine.body.editableIds.includes(id));
 const theirs=await data(await workshopReference({request:request("/api/workshop-reference","GET",undefined,other),env}));
 assert.equal(theirs.body.canCreate,true);
 assert.ok(theirs.body.editableIds.includes(id));
 const blocked=await data(await workshopReference({request:request("/api/workshop-reference","PUT",{
  id,details:{...details,name:"Hijacked"}
 },other),env}));
 assert.equal(blocked.status,200);
 const seeded=await data(await workshopReference({request:request("/api/workshop-reference","PUT",{
  id:"workshop:wire22",details:{name:"Edited seed"}
 },creator),env}));
 assert.equal(seeded.status,200);
 const changed=await data(await workshopReference({request:request("/api/workshop-reference","PUT",{
  id,details:{...details,name:"Revised sensor"}
 },creator),env}));
 assert.equal(changed.status,200);
 assert.equal(changed.body.details.name,"Revised sensor");
 const stillOwned=await data(await workshopReference({request:request("/api/workshop-reference","GET",undefined,creator),env}));
 assert.ok(stillOwned.body.editableIds.includes(id));
});

test("shared Workshop rejects stale saves without deleting another contributor's changes",async()=>{
 const env={PHOTOS:new TestBucket(),admin_password:"test-admin-secret"};
 const maker=await register(env,"revision-maker@example.test");
 const editor=await register(env,"revision-editor@example.test");
 const details={name:"2N7000 MOSFET",category:"electronics",kind:"component",
  familyId:"community-electronics",familyName:"Community contributions",partNumber:"2N7000",photos:[]};
 const first=await data(await workshopReference({request:request("/api/workshop-reference","POST",{details},maker),env}));
 assert.equal(first.status,201);
 const id=first.body.id,stamp=first.body.details.updatedAt;
 const changed=await data(await workshopReference({request:request("/api/workshop-reference","PUT",{
  id,details:{...details,name:"2N7000 N-channel MOSFET"},expectedUpdatedAt:stamp
 },editor),env}));
 assert.equal(changed.status,200);
 const stale=await data(await workshopReference({request:request("/api/workshop-reference","PUT",{
  id,details:{...details,name:"Outdated entry"},expectedUpdatedAt:stamp
 },maker),env}));
 assert.equal(stale.status,409);
 const check=await data(await workshopReference({request:request("/api/workshop-reference"),env}));
 assert.equal(check.body.items[id].name,"2N7000 N-channel MOSFET");
});
