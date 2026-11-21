import test from "node:test";
import assert from "node:assert/strict";
import {collectSubtree,relatedRecords,archiveAssets} from "../functions/api/assembly-archive.js";

const tree=[
 {id:"a",kind:"assembly",parentId:null,name:"Top"},
 {id:"b",kind:"assembly",parentId:"a",name:"Nested"},
 {id:"c",kind:"part",partId:"11111111-1111-1111-1111-111111111111",parentId:"b",name:"Sensor"},
 {id:"d",kind:"part",partId:"22222222-2222-2222-2222-222222222222",parentId:"a",name:"Switch"},
 {id:"e",kind:"part",partId:"11111111-1111-1111-1111-111111111111",parentId:null,name:"Shared Sensor"}
];

test("archiving a nested assembly captures its complete subtree, not siblings",()=>{
 assert.deepEqual(collectSubtree(tree,"b").map(n=>n.id),["b","c"]);
 assert.deepEqual(collectSubtree(tree,"a").map(n=>n.id),["a","b","d","c"]);
});
test("archiving a part only selects that occurrence",()=>{
 assert.deepEqual(collectSubtree(tree,"c").map(n=>n.id),["c"]);
 assert.equal(tree.find(n=>n.id==="e").partId,tree.find(n=>n.id==="c").partId);
});
test("invalid subtree references fail rather than creating partial archives",()=>{
 assert.throws(()=>collectSubtree(tree,"missing"),/no longer exists/);
 assert.throws(()=>collectSubtree([{id:"x",parentId:"y"},{id:"y",parentId:"x"}],"x"),/Circular/);
});
test("history selection includes part and assembly records but no unrelated data",()=>{
 const entries=[
  {id:"a",ownerType:"assembly",ownerId:"b"},
  {id:"b",ownerType:"part",ownerId:"11111111-1111-1111-1111-111111111111"},
  {id:"c",ownerType:"part",ownerId:"22222222-2222-2222-2222-222222222222"},
  {id:"d",ownerType:"assembly",ownerId:"other"}
 ];
 assert.deepEqual(relatedRecords(entries,collectSubtree(tree,"b")).map(n=>n.id),["a","b"]);
});

test("archive copies assembly instructions, note photos and photo markup",async()=>{
 const image="launcher/00000000-0000-0000-0000-000000000001.png";
 const file="recipe-files/launcher/00000000-0000-0000-0000-000000000002.png";
 const objects=new Map([
  ["workspaces/launcher/b.json",{body:JSON.stringify({recipe:[{id:"step",title:"Assemble"}],photos:[image]})}],
  ["assembly-pages/launcher/b.json",{body:JSON.stringify({description:"Wire terminal block"})}],
  [image,{body:"image",metadata:{assemblyId:"b"}}],
  ["photo-annotations/"+image+".json",{body:JSON.stringify({marks:[]})}],
  ["photo-renders/"+image+".webp",{body:"rendered"}],
  [file,{body:"attachment"}]
 ]);
 const bucket={
  list:async({prefix})=>({objects:[...objects.keys()].filter(key=>key.startsWith(prefix)).map(key=>({key})),truncated:false}),
  head:async key=>objects.has(key)?{customMetadata:objects.get(key).metadata}:null,
  get:async key=>objects.has(key)?{
   size:objects.get(key).body.length,
   text:async()=>objects.get(key).body,
   arrayBuffer:async()=>new TextEncoder().encode(objects.get(key).body).buffer
  }:null,
  put:async(key,value)=>{objects.set(key,{body:value});return {etag:"test"}}
 };
 const copy=await archiveAssets(bucket,"launcher","archive-test",
  [{id:"b",kind:"assembly"}],
  [{id:"entry",ownerType:"assembly",ownerId:"b",entries:[{files:[file]}]}],[]);
 const names=copy.map(item=>item.original);
 for(const name of ["workspaces/launcher/b.json","assembly-pages/launcher/b.json",
   image,file,"photo-annotations/"+image+".json","photo-renders/"+image+".webp"]){
  assert.ok(names.includes(name),name+" was not preserved");
 }
 assert.equal(copy.length,names.length);
});
