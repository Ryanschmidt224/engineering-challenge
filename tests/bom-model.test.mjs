import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const bom=require("../assets/bom-model.js");

const nodes=[
 {id:"motor",parentId:null,name:"Motor Control",kind:"assembly"},
 {id:"board",parentId:"motor",name:"Control Board",kind:"assembly"},
 {id:"motor-link",parentId:"motor",name:"Motor",kind:"part",partId:"a"},
 {id:"other",parentId:null,name:"Cabinet",kind:"assembly"}
];
const parts=[
 {id:"a",name:"Motor",assemblyId:"motor",quantity:2},
 {id:"b",name:"Regulator",assemblyId:"board",quantity:1,quantityUnit:"pcs"},
 {id:"c",name:"Solder",assemblyId:"motor",assumedOnHand:true,quantity:1},
 {id:"d",name:"Cabinet",assemblyId:"other",quantity:1}
];

test("BOM selector includes nested assembly parts and separates workshop stock",()=>{
 const result=bom.selectWorkspaceParts(parts,nodes,"motor");
 assert.deepEqual(result.listItems.map(p=>p.id),["a","b"]);
 assert.deepEqual(result.shopItems.map(p=>p.id),["c"]);
 assert.deepEqual([...result.included],["motor","board"]);
 assert.ok(result.shopIds.has("c"));
 assert.ok(!result.listItems.some(p=>p.id==="d"));
});

test("BOM selector includes project root and does not mistake a part-tree link for a subassembly",()=>{
 const result=bom.selectWorkspaceParts(parts,nodes,null);
 assert.deepEqual(result.listItems.map(p=>p.id),["a","b","d"]);
 assert.equal(result.listItems.filter(p=>p.id==="a").length,1);
});

test("BOM quantity and assembly labels are pure display formatting",()=>{
 assert.equal(bom.quantityText(parts[0]),"2");
 assert.equal(bom.quantityText(parts[1]),"1 pcs");
 assert.equal(bom.quantityText({}),"Not specified");
 assert.equal(bom.assemblyText(parts[1],"motor",nodes),"Control Board");
 assert.equal(bom.assemblyText(parts[0],"motor",nodes),"This assembly");
 assert.equal(bom.assemblyText({assemblyId:null},null,nodes),"Project");
});

test("malformed cyclic assembly references never recurse indefinitely",()=>{
 const cyclic=[{id:"a",parentId:"b"},{id:"b",parentId:"a"}];
 assert.deepEqual([...bom.assemblyIds(cyclic,"a")],["a","b"]);
});
