import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {fileURLToPath} from "node:url";
import {dirname,resolve} from "node:path";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const window={};
runInNewContext(readFileSync(resolve(root,"assets/workshop-model.js"),"utf8"),{window});
const families=[
 {id:"measurement",items:["workshop:meter","workshop:oscilloscope"]},
 {id:"power-supplies",items:["workshop:bench-psu","workshop:buck-psu"]},
 {id:"wire",items:["workshop:wire18"]}
];
const refs=[
 {id:"workshop:meter",name:"Digital multimeter",category:"tools"},
 {id:"workshop:oscilloscope",name:"Oscilloscope",category:"tools"},
 {id:"workshop:bench-psu",name:"Adjustable DC bench power supply",category:"electronics"},
 {id:"workshop:buck-psu",name:"DC-to-DC buck converter",category:"electronics"},
 {id:"workshop:wire18",name:"18 AWG power hook-up wire",category:"consumables"}
];
const owned=[
 {id:"private-1",name:"Fluke digital multimeter",category:"Measurement",kind:"equipment",quantity:1,stockStatus:"in_stock",unit:"pcs",catalogId:"workshop:meter"},
 {id:"private-2",name:"18 AWG power hook-up wire",category:"Wire",kind:"material",quantity:50,stockStatus:"committed",unit:"ft"},
 {id:"private-3",name:"24 V bench power supply",category:"Power supplies",kind:"equipment",quantity:1,stockStatus:"in_use_reusable",unit:"pcs"}
];
const model=window.BSWorkshopModel.create({
 standards:()=>refs,families:()=>families,categoryFor:item=>item.category,getItems:()=>owned
});

test("Workshop classification recognizes shared and owned multimeters",()=>{
 assert.equal(model.typeFor(refs[0]).id,"multimeters");
 assert.equal(model.typeFor(owned[0]).id,"multimeters");
 assert.equal(model.familyOfPersonal(owned[0]),"measurement");
 assert.equal(model.categoryOfPersonal(owned[0]),"tools");
});

test("Workshop classification groups power supplies and wire by product family",()=>{
 assert.equal(model.familyOfPersonal(owned[1]),"wire");
 assert.equal(model.familyOfPersonal(owned[2]),"power-supplies");
 assert.equal(model.typeFor(refs[2]).id,"dc-bench");
 assert.equal(model.typeFor(refs[3]).id,"dc-dc");
});

test("owner matching keeps catalog ID primary and carries stock status into catalog",()=>{
 assert.equal(model.ownedFor(refs[0]).length,1);
 assert.equal(model.ownedFor(refs[4]).length,1);
 assert.match(model.ownershipLabel(model.ownedFor(refs[0])),/In stock/);
 assert.match(model.ownershipLabel(model.ownedFor(refs[4])),/Committed/);
 assert.equal(model.ownedFor(refs[1]).length,0);
});
