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
test("root gallery excludes legacy step images without deleting stored objects",async()=>{
 const env={PHOTOS:fakeStorage()};
 const response=await getPhotos({request:new Request("https://example.test/api/photos?project=launcher"),env});
 assert.equal(response.status,200);
 const json=await response.json();
 assert.deepEqual(json.photos.map(photo=>photo.id),[cover]);
});
test("assembly-specific gallery remains untouched",async()=>{
 const env={PHOTOS:fakeStorage()};
 const response=await getPhotos({request:new Request("https://example.test/api/photos?project=launcher&assembly=assemblyA"),env});
 const json=await response.json();
 assert.deepEqual(json.photos.map(photo=>photo.id),[assemblyPhoto]);
});
test("PDF work-instruction attachment is retrievable",async()=>{
 const env={PHOTOS:fakeStorage()};
 const response=await handleRecipeFiles(new Request("https://example.test/api/recipe-files?id="+encodeURIComponent(fileId)),env);
 assert.equal(response.status,200);
 assert.equal(response.headers.get("content-type"),"application/pdf");
 assert.match(response.headers.get("content-disposition"),/inline/);
});
