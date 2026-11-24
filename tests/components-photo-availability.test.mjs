import {test} from "node:test";
import assert from "node:assert/strict";
import {handleComponents} from "../functions/api/components.js";
import {TestR2} from "./helpers/r2.mjs";
import {provisionTestAccount} from "./helpers/accounts.mjs";

async function fixture(){
 const bucket=new TestR2(),env={PHOTOS:bucket,admin_password:"synthetic-photo-test-signing-secret"};
 const login=await provisionTestAccount(new Request("https://example.test/api/accounts",{method:"POST",headers:{origin:"https://example.test"},body:JSON.stringify({action:"register",email:"photo-owner@example.test",password:"disposable-test-password"})}),env,{role:"admin"});
 const cookie=login.headers.get("set-cookie").split(";")[0];
 const request=new Request("https://example.test/api/components?project=launcher",{headers:{cookie}});
 const parts=[{id:"own",name:"Own photo",partType:"custom",specifications:[]},{id:"missing",name:"No photo",partType:"custom",specifications:[]},{id:"inherited",name:"Workshop photo",partType:"custom",projectDetails:{workshopReferenceId:"workshop:wire22"},specifications:[]}];
 const photoId=crypto.randomUUID(),photoKey="workshop-reference-photos/"+photoId;
 await bucket.put("components/launcher.json",JSON.stringify(parts));
 await bucket.put("component-thumbnails/launcher/own",new Uint8Array([1]));
 await bucket.put(photoKey,new Uint8Array([2]));
 await bucket.put("workshop-reference-overrides/v1.json",JSON.stringify({"workshop:wire22":{photos:[{id:photoId}]}}));
 return {bucket,env,request,parts,photoKey};
}
for(const failure of ["listing failure","incomplete listing"])test("components still load with unknown photo availability after "+failure,async()=>{
 const {bucket,env,request,parts}=await fixture();
 bucket.list=async()=>{if(failure==="listing failure")throw Error("Synthetic listing failure");return {objects:[{key:"component-thumbnails/launcher/own"}],truncated:true};};
 const response=await handleComponents(request,env);assert.equal(response.status,200);
 const {components}=await response.json();assert.deepEqual(components.map(part=>part.id),parts.map(part=>part.id));
 for(const part of components){assert.equal(part.hasPhoto,undefined);assert.equal(Object.hasOwn(part,"hasPhoto"),false);}
});
for(const failure of ["head","source"])test("a failed inherited photo "+failure+" check preserves every part and reports unknown",async()=>{
 const {bucket,env,request,parts}=await fixture(),get=bucket.get.bind(bucket);
 let imageReads=0;
 bucket.get=async key=>{if(key.startsWith("workshop-reference-photos/")){imageReads++;throw Error("Image body should not be fetched");}if(failure==="source"&&key==="workshop-reference-overrides/v1.json")throw Error("Synthetic source failure");return get(key);};
 bucket.head=async()=>{throw Error("Synthetic head failure");};
 const response=await handleComponents(request,env);assert.equal(response.status,200);
 const {components}=await response.json();assert.deepEqual(components.map(part=>part.id),parts.map(part=>part.id));
 assert.equal(components.find(part=>part.id==="own").hasPhoto,true);assert.equal(components.find(part=>part.id==="missing").hasPhoto,false);assert.equal(components.find(part=>part.id==="inherited").hasPhoto,undefined);assert.equal(imageReads,0);
});
test("Workshop lookups skip custom/document photos and suppressed fallback, retaining sourcing and inherited photos",async()=>{
 const {bucket,env,request,photoKey}=await fixture(),get=bucket.get.bind(bucket),head=bucket.head.bind(bucket);
 const linked={projectDetails:{workshopReferenceId:"workshop:wire22"},specifications:[]};
 const parts=[{...linked,id:"custom",name:"Custom",partType:"custom"},{...linked,id:"document",name:"Document",itemType:"document",partType:"purchased"},{...linked,id:"removed",name:"Removed photo",partType:"custom",photoRevision:crypto.randomUUID()}];
 for(const part of parts.slice(0,2))await bucket.put("component-thumbnails/launcher/"+part.id,new Uint8Array([1]));
 let lookups=0,heads=0;
 bucket.get=async key=>{if(key==="workshop-reference-overrides/v1.json")lookups++;if(key===photoKey)throw Error("Photo body must not be opened");return get(key);};
 bucket.head=async key=>{heads++;return head(key);};
 const read=async()=>{await bucket.put("components/launcher.json",JSON.stringify(parts));const response=await handleComponents(request,env);assert.equal(response.status,200);return (await response.json()).components;};
 let components=await read();assert.equal(lookups,0);assert.equal(heads,0);assert.deepEqual(components.map(part=>part.hasPhoto),[true,true,false]);
 parts.push({...linked,id:"purchased",name:"Purchased",partType:"purchased"});await bucket.put("component-thumbnails/launcher/purchased",new Uint8Array([1]));
 components=await read();assert.equal(lookups,1);assert.equal(heads,0);assert.ok(components.find(part=>part.id==="purchased").workshopSourcing);
 parts.push({...linked,id:"inherits",name:"Inherits",partType:"custom"});lookups=0;
 components=await read();assert.equal(lookups,1);assert.equal(heads,1);assert.equal(components.find(part=>part.id==="inherits").hasPhoto,true);
});
