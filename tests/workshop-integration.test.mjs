import {test} from "node:test";
import assert from "node:assert/strict";
import {handleAccounts} from "../functions/api/accounts.js";
import {onRequest as personalWorkshop} from "../functions/api/personal-workshop.js";
import {onRequest as workshopReference} from "../functions/api/workshop-reference.js";
import {onRequest as workshopLookup} from "../functions/api/workshop-lookup.js";
import {handleComponentPhoto,handleComponents} from "../functions/api/components.js";
import {handlePhotoAnnotations} from "../functions/api/photo-annotations.js";

const ORIGIN="https://schmidt.example";
class TestBucket{
 constructor(){this.objects=new Map()}
 async get(key){
  const entry=this.objects.get(key);if(!entry)return null;
  return {etag:entry.etag,size:entry.body.byteLength,httpMetadata:entry.meta,
   async text(){return new TextDecoder().decode(entry.body)},
   async arrayBuffer(){return entry.body.slice().buffer},
   writeHttpMetadata(headers){if(entry.meta?.contentType)headers.set("content-type",entry.meta.contentType)},
   get body(){return new ReadableStream({start(ctrl){ctrl.enqueue(entry.body);ctrl.close()}})}};
 }
 async head(key){const e=this.objects.get(key);return e?{etag:e.etag,size:e.body.byteLength}:null}
 async put(key,value,opts={}){
  const old=this.objects.get(key);
  if(opts.onlyIf?.etagDoesNotMatch==="*"&&old)return null;
  if(opts.onlyIf?.etagMatches&&old?.etag!==opts.onlyIf.etagMatches)return null;
  const body=typeof value==="string"?new TextEncoder().encode(value):new Uint8Array(value);
  const entry={body,etag:crypto.randomUUID(),meta:opts.httpMetadata||{}};
  this.objects.set(key,entry);return {etag:entry.etag};
 }
 async delete(key){for(const path of Array.isArray(key)?key:[key])this.objects.delete(path)}
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
 const id=first.body.id,stamp=first.body.details.revision;
 const changed=await data(await workshopReference({request:request("/api/workshop-reference","PUT",{
  id,details:{...details,name:"2N7000 N-channel MOSFET"},expectedRevision:stamp
 },editor),env}));
 assert.equal(changed.status,200);
 const stale=await data(await workshopReference({request:request("/api/workshop-reference","PUT",{
  id,details:{...details,name:"Outdated entry"},expectedRevision:stamp
 },maker),env}));
 assert.equal(stale.status,409);
 const check=await data(await workshopReference({request:request("/api/workshop-reference"),env}));
 assert.equal(check.body.items[id].name,"2N7000 N-channel MOSFET");
});

test("project notes and KiCad metadata are saved on BOM parts, not Workshop references",async()=>{
 const env={PHOTOS:new TestBucket(),admin_password:"test-admin-secret"};
 const session=await register(env,"project-details@example.test");
 const claim=await handleAccounts(request("/api/accounts","POST",{
  action:"claim-admin",adminPassword:env.admin_password
 },session),env);
 assert.equal(claim.status,200);
 const details={
  name:"2N7000 MOSFET",manufacturer:"onsemi",partNumber:"2N7000",
  category:"electronics",kind:"component",familyId:"community-electronics",photos:[]
 };
 const shared=await data(await workshopReference({request:request("/api/workshop-reference","POST",{details},session),env}));
 assert.equal(shared.status,201);
 const projectDetails={
  workshopReferenceId:shared.body.id,
  notes:"Switches the indicator LED",
  changes:"Lead orientation checked against chosen package",
  referenceDesignators:"Q1, Q2",
  footprint:"Package_TO_SOT_THT:TO-92_Inline",
  schematicValue:"2N7000",
  sourceApplication:"KiCad",
  sourceFile:"led-button.kicad_sch",
  sourceComponentId:"e2f1-test-uuid"
 };
 const added=await data(await handleComponents(request("/api/components?project=launcher","POST",{
  name:"2N7000 MOSFET",partType:"purchased",itemType:"part",assignNumber:false,
  manufacturer:"onsemi",model:"2N7000",supplier:"DigiKey",
  description:"N-channel switching MOSFET",specifications:[],projectDetails
 },session),env));
 assert.equal(added.status,201,JSON.stringify(added.body));
 assert.equal(added.body.component.projectDetails.referenceDesignators,"Q1, Q2");
 const id=added.body.component.id;
 const edited=await data(await handleComponents(request("/api/components?project=launcher&id="+id,"PUT",{
  ...added.body.component,
  projectDetails:{...projectDetails,notes:"Moved Q1 closer to connector"}
 },session),env));
 assert.equal(edited.status,200,JSON.stringify(edited.body));
 assert.equal(edited.body.component.projectDetails.notes,"Moved Q1 closer to connector");
 const reread=await data(await handleComponents(request("/api/components?project=launcher"),env));
 const projectRecord=reread.body.components.find(component=>component.id===id);
 assert.equal(projectRecord.projectDetails.footprint,"Package_TO_SOT_THT:TO-92_Inline");
 assert.equal(projectRecord.projectDetails.workshopReferenceId,shared.body.id);
 const workshop=await data(await workshopReference({request:request("/api/workshop-reference"),env}));
 assert.equal(workshop.body.items[shared.body.id].name,"2N7000 MOSFET");
 assert.equal(workshop.body.items[shared.body.id].notes||"","");
 assert.equal(workshop.body.items[shared.body.id].changes,undefined);
 const invalid=await data(await handleComponents(request("/api/components?project=launcher","POST",{
  name:"Invalid project note",specifications:[],projectDetails:{notes:"x".repeat(6001)}
 },session),env));
 assert.equal(invalid.status,400);
});

test("Workshop AI receives both identity fields and prioritizes the exact manufacturer number",async t=>{
 const env={PHOTOS:new TestBucket(),OPENAI_API_KEY:"test-key",admin_password:"test-admin-secret"};
 const session=await register(env,"lookup@example.test");
 let query,draft;
 t.mock.method(globalThis,"fetch",async (url,options)=>{
  assert.equal(url,"https://api.openai.com/v1/responses");
  query=JSON.parse(options.body).input;
  return Response.json({output:[{type:"message",content:[{type:"output_text",text:JSON.stringify(draft)}]}]});
 });
 const lookUp=async body=>data(await workshopLookup({request:request("/api/workshop-lookup","POST",body,session),env}));
 for(const fields of [
  {partNumber:"ABC-10",featureTreeDescription:"Motor switch"},
  {partNumber:"ABC-10",featureTreeDescription:""},
  {partNumber:"",featureTreeDescription:"Motor switch"}
 ]){
  draft={partNumber:fields.partNumber||"SW123",name:"Motor switch"};
  const result=await lookUp(fields);
  assert.equal(result.status,200);
  assert.equal(result.body.draft.partNumber,draft.partNumber);
  assert.ok(query.includes(JSON.stringify(fields)));
  assert.match(query,/search first for the exact manufacturer part number/);
 }
 draft={partNumber:"ABC10",name:"Different part"};
 assert.equal((await lookUp({partNumber:"ABC-10",featureTreeDescription:"Motor switch"})).status,422);
 draft={partNumber:"",name:"Unverified part"};
 assert.equal((await lookUp({partNumber:"ABC-10"})).status,422);
 assert.equal((await lookUp({partNumber:"",featureTreeDescription:""})).status,400);
});

test("Parts Management patches preserve linked public and personal Workshop records",async()=>{
 const env={PHOTOS:new TestBucket(),admin_password:"test-admin-secret"};
 const session=await register(env,"parts-management@example.test");
 const claim=await handleAccounts(request("/api/accounts","POST",{
  action:"claim-admin",adminPassword:env.admin_password
 },session),env);
 assert.equal(claim.status,200);
 const details={name:"Motor switch",partNumber:"ABC-10",featureTreeDescription:"Motor switch",category:"electronics",kind:"component",familyId:"community-electronics",photos:[]};
 const shared=await data(await workshopReference({request:request("/api/workshop-reference","POST",{details},session),env}));
 assert.equal(shared.status,201,JSON.stringify(shared.body));
 const mine=await data(await personalWorkshop({request:request("/api/personal-workshop","POST",details,session),env}));
 assert.equal(mine.status,200);
 const personal=mine.body.items.at(-1);
 const before=new Map(env.PHOTOS.objects);
 for(const workshopReferenceId of [shared.body.id,"my:"+personal.id,personal.id]){
  const added=await data(await handleComponents(request("/api/components?project=launcher","POST",{
   name:details.name,partType:"purchased",itemType:"part",specifications:[],assignNumber:false,projectDetails:{workshopReferenceId}
  },session),env));
  assert.equal(added.status,201,JSON.stringify(added.body));
  const updated=await data(await handleComponents(request("/api/components?project=launcher&id="+added.body.component.id,"PATCH",{
   name:"Project motor switch",partType:"custom",progressStatus:"in_progress",needsAttention:true,attentionNote:"Confirm mounting hole"
  },session),env));
  assert.equal(updated.status,200,JSON.stringify(updated.body));
  assert.equal(updated.body.component.name,"Project motor switch");
  assert.equal(updated.body.component.projectDetails.workshopReferenceId,workshopReferenceId);
 }
 for(const [key,record] of before){
  assert.equal(env.PHOTOS.objects.get(key),record,key);
 }
});

test("Workshop reload replaces project part details and the active photo in one component update",async()=>{
 const env={PHOTOS:new TestBucket(),admin_password:"test-admin-secret"};
 const session=await register(env,"reload@example.test");
 await handleAccounts(request("/api/accounts","POST",{action:"claim-admin",adminPassword:env.admin_password},session),env);
 const workshopKey="workshop-reference-overrides/v1.json";
 const workshopId="workshop:custom-motor-switch";
 const partId="02874271-6998-406f-a1f8-f9d0817085af";
 const photoId="eeb61668-a92b-491f-915b-81a3c4d78912";
 const photoKey="workshop-reference-photos/"+photoId;
 const partPhotoKey="component-thumbnails/launcher/"+partId;
 const components="/api/components?project=launcher";
 const photo="/api/components/photo?project=launcher&id="+partId;
 const view="/api/photo-annotations?kind=part&project=launcher&id="+partId+"&view=1";
 const item={created:true,name:"Current switch",partNumber:"ABC-10",featureTreeDescription:"Motor switch",
  kind:"component",category:"electronics",notes:"Workshop notes",specifications:[{label:"Rated voltage",value:"24",unit:"V"}],photos:[{id:photoId}]};
 const saveWorkshop=()=>env.PHOTOS.put(workshopKey,JSON.stringify({[workshopId]:item}));
 await saveWorkshop();
 await env.PHOTOS.put(photoKey,new Uint8Array([1,2,3]),{httpMetadata:{contentType:"image/png"}});
 const original={id:partId,partNumber:"101",assemblyId:"motor",quantity:2,quantityUnit:"pcs",name:"Project edit",
  manufacturer:"Old manufacturer",attentionNote:"Check",needsAttention:true,progressStatus:"complete",
  projectDetails:{workshopReferenceId:workshopId,changes:"Local change",notes:"Local note"},
  specifications:[{name:"Old spec",value:"Old value"}]};
 await env.PHOTOS.put("components/launcher.json",JSON.stringify([original]));
 const rawPath="/api/components/photo?project=launcher&id=";
 const create=await data(await handleComponents(request(components,"POST",{
  name:"New linked switch",specifications:[],assignNumber:false,projectDetails:{workshopReferenceId:workshopId}
 },session),env));
 assert.equal(create.status,201);
 const inherited=await handleComponentPhoto(request(rawPath+create.body.component.id),env);
 assert.deepEqual([...new Uint8Array(await inherited.arrayBuffer())],[1,2,3]);
 assert.ok(create.body.component.photoRevision);
 const readPhoto=async(path,handler)=>[...new Uint8Array(await (await handler(request(path),env)).arrayBuffer())];
 assert.deepEqual(await readPhoto(view,handlePhotoAnnotations),[1,2,3]);
 await env.PHOTOS.put(partPhotoKey,new Uint8Array([9]),{httpMetadata:{contentType:"image/png"}});
 await env.PHOTOS.put("photo-renders/"+partPhotoKey+".webp",new Uint8Array([8]),{httpMetadata:{contentType:"image/webp"}});
 const reload=()=>handleComponents(request(components+"&id="+partId,"PATCH",{reloadWorkshop:true},session),env);
 assert.deepEqual(await readPhoto(view,handlePhotoAnnotations),[8]);
 const result=await data(await reload());
 assert.equal(result.status,200,JSON.stringify(result.body));
 const {component}=result.body;
 assert.equal(component.name,"Current switch");
 assert.equal(component.model,"ABC-10");
 assert.equal(component.manufacturer,"");
 assert.equal(component.partNumber,"101");
 assert.equal(component.assemblyId,"motor");
 assert.equal(component.quantity,2);
 assert.equal(component.needsAttention,false);
 assert.equal(component.progressStatus,"not_started");
 assert.deepEqual(component.projectDetails,{workshopReferenceId:workshopId,workshopTreeDescription:"Motor switch",notes:"Workshop notes"});
 assert.deepEqual(component.specifications,[{name:"Rated voltage",value:"24 V",source:"explicit"}]);
 assert.deepEqual(await readPhoto(view,handlePhotoAnnotations),[1,2,3]);
 assert.deepEqual(await readPhoto(photo,handleComponentPhoto),[1,2,3]);
 assert.deepEqual(await readPhoto("/api/workshop-reference?photo="+photoId,req=>workshopReference({request:req,env})),[1,2,3]);

 await env.PHOTOS.delete(photoKey);
 item.name="Unsaved because photo is missing";
 await saveWorkshop();
 assert.equal((await reload()).status,409);
 assert.deepEqual(await readPhoto(view,handlePhotoAnnotations),[1,2,3]);
 const peek=await data(await handleComponents(request(components),env));
 assert.equal(peek.body.components.find(p=>p.id===partId).name,"Current switch");
 item.photos=[];
 await saveWorkshop();
 assert.equal((await reload()).status,200);
 assert.equal((await handlePhotoAnnotations(request(view),env)).status,404);
 assert.equal((await handleComponentPhoto(request(photo),env)).status,404);
});

test("legacy personal Workshop photos are readable only by the inventory owner",async()=>{
 const env={PHOTOS:new TestBucket(),admin_password:"test-admin-secret"};
 const owner=await register(env,"photo-owner@example.test");
 const other=await register(env,"photo-other@example.test");
 const photoId=crypto.randomUUID();
 const saved=await data(await personalWorkshop({request:request("/api/personal-workshop","POST",{
  name:"Personal switch",photoId
 },owner),env}));
 assert.equal(saved.status,200);
 const item=saved.body.items[0];
 const inventory=[...env.PHOTOS.objects.keys()].find(key=>key.endsWith("/inventory.json"));
 await env.PHOTOS.put(inventory.replace(/inventory\.json$/,"photos/"+photoId),new Uint8Array([1,2,3]),{
  httpMetadata:{contentType:"image/png"}
 });
 const id=crypto.randomUUID();
 await env.PHOTOS.put("components/launcher.json",JSON.stringify([{
  id,name:"Linked switch",projectDetails:{workshopReferenceId:item.id}
 }]));
 const photo="/api/components/photo?project=launcher&id="+id;
 assert.equal((await handleComponentPhoto(request(photo,"GET",undefined,owner),env)).status,200);
 assert.equal((await handleComponentPhoto(request(photo,"GET",undefined,other),env)).status,404);
 assert.equal((await handleComponentPhoto(request(photo),env)).status,404);
});
