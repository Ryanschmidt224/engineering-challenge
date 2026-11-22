import {provisionTestAccount} from "./helpers/accounts.mjs";
import {TestR2} from "./helpers/r2.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import {onRequestGet as getPhotos} from "../functions/api/photos.js";
import {handleRecipeFiles} from "../functions/api/recipe-files.js";

const key="launcher/11111111-1111-4111-8111-111111111111.jpg";
const cover="launcher/22222222-2222-4222-8222-222222222222.jpg";
const assemblyPhoto="launcher/33333333-3333-4333-8333-333333333333.jpg";
const fileId="recipe-files/launcher/44444444-4444-4444-8444-444444444444.pdf";
function fakeStorage(){
 const photos=[
  {key,customMetadata:{assemblyId:""},uploaded:new Date("2026-01-01")},
  {key:cover,customMetadata:{assemblyId:""},uploaded:new Date("2026-01-01")},
  {key:assemblyPhoto,customMetadata:{assemblyId:"assemblyA"},uploaded:new Date("2026-01-01")}
 ];
 const json=body=>({text:async()=>JSON.stringify(body)});
 const objects=new Map([
  ["workspaces/launcher/__root__.json",json({recipe:[{photos:[key]}]})],
  ["workspaces/launcher/subassembly.json",json({recipe:[]})],
  [fileId,{body:new TextEncoder().encode("%PDF-1.7").buffer,customMetadata:{filename:"Circuit.pdf"}}]
 ]);
 return {
  list:async({prefix})=>({objects:prefix==="launcher/"?photos.filter(p=>p.key.startsWith(prefix)):
   [...objects.keys()].filter(k=>k.startsWith(prefix)).map(key=>({key})),truncated:false}),
  get:async key=>objects.get(key)||null,
  put:async()=>{throw Error("Unexpected mutation")},
  delete:async()=>{throw Error("Unexpected deletion")}
 };
}
async function signed(storage){
 const accounts=new TestR2(),env={PHOTOS:{...storage,get:async key=>await accounts.get(key)||storage.get(key),put:accounts.put.bind(accounts)},admin_password:"attachment-fixture-secret"};
 const login=await provisionTestAccount(new Request("https://example.test/api/accounts",{method:"POST",headers:{origin:"https://example.test"},body:JSON.stringify({action:"register",email:"attachments@example.test",password:"attachment-fixture-password"})}),env,{role:"admin"});
 env.PHOTOS.put=storage.put;
 const cookie=login.headers.get("set-cookie").split(";")[0];
 return {env,request:(url,options={})=>new Request(url,{...options,headers:{...options.headers,cookie}})};
}
test("root gallery excludes legacy step images without deleting stored objects",async()=>{
 const {env,request}=await signed(fakeStorage());
 const response=await getPhotos({request:request("https://example.test/api/photos?project=launcher"),env});
 assert.equal(response.status,200);
 const json=await response.json();
 assert.deepEqual(json.photos.map(photo=>photo.id),[cover]);
});
test("assembly-specific gallery remains untouched",async()=>{
 const {env,request}=await signed(fakeStorage());
 const response=await getPhotos({request:request("https://example.test/api/photos?project=launcher&assembly=assemblyA"),env});
 const json=await response.json();
 assert.deepEqual(json.photos.map(photo=>photo.id),[assemblyPhoto]);
});
test("PDF work-instruction attachment is retrievable",async()=>{
 const {env,request}=await signed(fakeStorage());
 const response=await handleRecipeFiles(request("https://example.test/api/recipe-files?id="+encodeURIComponent(fileId)),env);
 assert.equal(response.status,200);
 assert.equal(response.headers.get("content-type"),"application/pdf");
 assert.match(response.headers.get("content-disposition"),/inline/);
});

test("attachment HEAD recovers each stored filename without downloading the file",async()=>{
 const files=new Map([
  ["png","image.png"],
  ["kicad_sch","Practice schematic (rev 1).kicad_sch"],
  ["kicad_pcb","Practice board (rev 1).kicad_pcb"],
  ["kicad_pro","Practice project (rev 1).kicad_pro"]
 ]);
 const storage=fakeStorage();
 const get=storage.get;
 storage.get=async key=>{
  assert.ok(!key.startsWith("recipe-files/"),"HEAD should read only object metadata");
  return get(key);
 };
 storage.head=async id=>({customMetadata:{filename:files.get(id.split(".").pop())}});
 const {env,request}=await signed(storage);
 for(const [extension,name] of files){
  const id=fileId.replace(/pdf$/,extension);
  const response=await handleRecipeFiles(request(
   "https://example.test/api/recipe-files?id="+encodeURIComponent(id),{method:"HEAD"}),env);
  assert.equal(response.status,200);
  assert.equal(response.body,null);
  assert.equal(decodeURIComponent(response.headers.get("content-disposition").split("UTF-8''")[1]),name);
 }
});
