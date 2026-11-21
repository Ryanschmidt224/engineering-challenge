import test from "node:test";
import assert from "node:assert/strict";
import {collectSubtree,relatedRecords} from "../functions/api/assembly-archive.js";

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
