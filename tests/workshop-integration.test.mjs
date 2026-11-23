import {provisionTestAccount} from "./helpers/accounts.mjs";
import {test} from "node:test";
import assert from "node:assert/strict";
import {handleAccounts} from "../functions/api/accounts.js";
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
 const response=await provisionTestAccount(request("/api/accounts","POST",{action:"register",email,password:"test-account-password-strong-2026"}),env,{role:"admin"});
 assert.equal(response.status,201);
 return cookie(response);
};

test("Workshop AI receives both identity fields and prioritizes the exact manufacturer number",async t=>{
 const env={PHOTOS:new TestBucket(),AI_LOOKUP_ENABLED:"1",OPENAI_API_KEY:"test-key",admin_password:"test-admin-secret"};
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
  assert.ok(query.includes(JSON.stringify({partNumber:fields.partNumber,manufacturer:"",partName:"",featureTreeDescription:fields.featureTreeDescription})));
  assert.match(query,/search first for the exact manufacturer part number/);
 }
 draft={partNumber:"ABC10",name:"Different part"};
 assert.equal((await lookUp({partNumber:"ABC-10",featureTreeDescription:"Motor switch"})).status,422);
 draft={partNumber:"",name:"Unverified part"};
 assert.equal((await lookUp({partNumber:"ABC-10"})).status,422);
 assert.equal((await lookUp({partNumber:"",featureTreeDescription:""})).status,400);
});

test("Workshop AI estimates API cost and identifies unverified end mill specifications",async t=>{
 const env={PHOTOS:new TestBucket(),AI_LOOKUP_ENABLED:"1",OPENAI_API_KEY:"test-key",admin_password:"test-admin-secret"};
 const session=await register(env,"endmill-lookup@example.test");
 let reportUsage=true,partNumber="ABC-10";
 t.mock.method(globalThis,"fetch",async (_url,options)=>{
  const {input:prompt,tools}=JSON.parse(options.body);
  assert.deepEqual(tools,[{type:"web_search",search_context_size:"low"}]);
  assert.match(prompt,/Stop searching once a reliable source verifies the exact part/);
  assert.match(prompt,/Cutting diameter, Shank diameter, Length of cut, Overall length, Flute count, Tool material, Coating, End geometry/);
  return Response.json({
   ...(reportUsage&&{usage:{input_tokens:10000,input_tokens_details:{cached_tokens:4000},output_tokens:1000}}),
   output:[
    {type:"web_search_call",action:{type:"search"}},{type:"web_search_call",action:{type:"open_page"}},
    {type:"web_search_call",action:{type:"search"}},{type:"web_search_call",action:{type:"find_in_page"}},
    {type:"message",content:[{type:"output_text",text:JSON.stringify({
     partNumber,typeName:"End mills",name:"Carbide end mill",
     specs:[{name:"Cutting diameter",value:"1/4",unit:"in"},{name:"Flute count",value:"4"}]
    })}]}
   ]
  });
 });
 const lookup=async()=>data(await workshopLookup({request:request("/api/workshop-lookup","POST",{
  partNumber:"ABC-10",featureTreeDescription:"End mill"
 },session),env}));
 const result=await lookup();
 assert.equal(result.status,200);
 assert.deepEqual(result.body.lookupUsage,{
  estimatedUsd:0.051,searches:2,inputTokens:10000,cachedInputTokens:4000,outputTokens:1000
 });
 assert.deepEqual(result.body.missingSpecs,["Shank diameter","Length of cut","Overall length","Tool material","Coating","End geometry"]);
 assert.equal(result.body.research.specs[0].unit,"in");
 partNumber="ABC-11";
 const rejected=await lookup();
 assert.equal(rejected.status,422);
 assert.deepEqual(rejected.body.lookupUsage,result.body.lookupUsage);
 partNumber="ABC-10";
 reportUsage=false;
 assert.equal((await lookup()).body.lookupUsage,null);
});

test("Workshop AI verifies a McMaster catalog SKU independently of the manufacturer number",async t=>{
 const env={PHOTOS:new TestBucket(),AI_LOOKUP_ENABLED:"1",OPENAI_API_KEY:"test-key",admin_password:"test-admin-secret"};
 const session=await register(env,"mcmaster-lookup@example.test");
 const sku="90044A535",supplierPage="https://www.mcmaster.com/"+sku+"/";
 let verifiedSku=sku;
 t.mock.method(globalThis,"fetch",async (_url,options)=>{
  const prompt=JSON.parse(options.body).input;
  assert.ok(prompt.includes(JSON.stringify({partNumber:"",manufacturer:"",partName:"",featureTreeDescription:"10-32 SHCS 3/16 long",
   searchHint:"Mcmaster",supplierPartNumber:sku,supplier:"McMaster-Carr",supplierPage})));
  return Response.json({output:[{type:"message",content:[{type:"output_text",text:JSON.stringify({
   partNumber:"",supplierPartNumber:verifiedSku,name:"Socket head cap screw"
  })}]}]});
 });
 const lookup=async numbers=>data(await workshopLookup({request:request("/api/workshop-lookup","POST",{
  ...numbers,featureTreeDescription:"10-32 SHCS 3/16 long",searchHint:"Mcmaster"
 },session),env}));
 const result=await lookup({partNumber:sku});
 assert.equal(result.status,200);
 assert.equal(result.body.draft.partNumber,"");
 assert.equal(result.body.draft.supplierPartNumber,sku);
 assert.equal(result.body.draft.supplierUrl,supplierPage);
 assert.equal(result.body.moveSupplierNumber,true);
 const explicit=await lookup({supplierPartNumber:sku});
 assert.equal(explicit.status,200);
 assert.equal(explicit.body.moveSupplierNumber,false);
 verifiedSku="90044A525";
 const mismatch=await lookup({partNumber:sku});
 assert.equal(mismatch.status,422);
 assert.equal(mismatch.body.supplierPage,supplierPage);
});

test("Workshop AI checks supplier numbers for vendors other than McMaster",async t=>{
 const env={PHOTOS:new TestBucket(),AI_LOOKUP_ENABLED:"1",OPENAI_API_KEY:"test-key",admin_password:"test-admin-secret"};
 const session=await register(env,"supplier-lookup@example.test");
 const supplierPartNumber="296-LM358P-ND",supplier="DigiKey";
 let sku=supplierPartNumber;
 t.mock.method(globalThis,"fetch",async (_url,options)=>{
  const prompt=JSON.parse(options.body).input;
  assert.ok(prompt.includes(JSON.stringify({partNumber:"",manufacturer:"",partName:"",featureTreeDescription:"",supplierPartNumber,supplier})));
  return Response.json({output:[{type:"message",content:[{type:"output_text",text:JSON.stringify({
   partNumber:"LM358P",supplierPartNumber:sku,name:"Dual op amp"
  })}]}]});
 });
 const lookup=async()=>data(await workshopLookup({request:request("/api/workshop-lookup","POST",{
  supplierPartNumber,supplier
 },session),env}));
 const result=await lookup();
 assert.equal(result.status,200);
 assert.equal(result.body.draft.partNumber,"LM358P");
 assert.equal(result.body.draft.supplierPartNumber,supplierPartNumber);
 assert.equal(result.body.draft.supplier,supplier);
 sku="296-OTHER-ND";
 assert.equal((await lookup()).status,422);
});

test("functional part number survives selection between purchased and custom implementations",async()=>{
 const env={PHOTOS:new TestBucket(),admin_password:"test-admin-secret"};
 const session=await register(env,"functional-number-owner@example.test");
 const added=await data(await handleComponents(request("/api/components?project=launcher","POST",{
  name:"LED Switch",assignNumber:true,partType:"purchased",itemType:"part",
  description:"Switch a low-current LED from 5 V logic",functionalRequirements:"5 V GPIO",
  acceptanceCriteria:"LED switches off when GPIO is low",manufacturer:"onsemi",
  model:"2N7000",specifications:[],quantity:1
 },session),env));
 assert.equal(added.status,201,JSON.stringify(added.body));
 const original=added.body.component;
 assert.match(original.partNumber,/^[A-Za-z0-9-]+$/);
 const functionalNumber=original.partNumber;
 assert.equal(original.name,"LED Switch");
 assert.equal(original.model,"2N7000");
 assert.equal(original.implementationResolved,true);
 const changed=await data(await handleComponents(request("/api/components?project=launcher&id="+original.id,
  "PATCH",{functionalAction:"add",implementation:{name:"Custom LED driver",partType:"custom"},
   expectedRevision:original.revision??null},session),env));
 assert.equal(changed.status,200,JSON.stringify(changed.body));
 assert.equal(changed.body.component.partNumber,functionalNumber);
 assert.equal(changed.body.component.name,"LED Switch");
 assert.equal(changed.body.component.model,"");
 assert.equal(changed.body.component.partType,"custom");
 assert.equal(changed.body.component.functionalRequirements,"5 V GPIO");
 const back=await data(await handleComponents(request("/api/components?project=launcher&id="+original.id,
  "PATCH",{functionalAction:"select",implementation:{id:original.selectedImplementationId},
   expectedRevision:changed.body.component.revision??null},session),env));
 assert.equal(back.status,200,JSON.stringify(back.body));
 assert.equal(back.body.component.partNumber,functionalNumber);
 assert.equal(back.body.component.name,"LED Switch");
 assert.equal(back.body.component.model,"2N7000");
 const saved=JSON.parse(await (await env.PHOTOS.get("components/launcher.json")).text());
 assert.equal(saved.length,1);
 assert.equal(saved[0].partNumber,functionalNumber);
 assert.equal(Object.hasOwn(saved[0],"manufacturer"),false);
 assert.equal(Object.hasOwn(saved[0],"model"),false);
 assert.equal(saved[0].selection.candidates.length,2);
});
