import test from "node:test";
import assert from "node:assert/strict";
import {resolveFunctionalPart,encodeFunctionalPart,changeImplementation,implementationForBOM} from "../functions/api/functional-part-model.js";
import "../assets/bom-model.js";

const original=()=>({
 id:"part-104",partNumber:"104",name:"LED Switch",description:"Switch a signal LED using 5 V logic",
 functionalRequirements:"5 V GPIO; low current; no thermal damage",
 acceptanceCriteria:"LED turns off within 100 ms",
 itemType:"part",partType:"purchased",quantity:1,quantityUnit:"pcs",
 manufacturer:"ON Semiconductor",model:"2N7000",supplier:"DigiKey",
 specifications:[{name:"Vgs",value:"5 V"}],
 historicalPrice:0.19,workshopChoice:"workshop:2n7000",
 projectDetails:{notes:"Project-specific reason",workshopReferenceId:"workshop:2n7000"}
});
test("stored functional part does not duplicate implementation-specific fields",()=>{
 const stored=encodeFunctionalPart(original());
 assert.equal(stored.name,"LED Switch");
 assert.equal(stored.functional.purpose,"Switch a signal LED using 5 V logic");
 assert.equal(stored.functional.requirements,"5 V GPIO; low current; no thermal damage");
 assert.equal(stored.functional.acceptanceCriteria,"LED turns off within 100 ms");
 assert.equal(Object.hasOwn(stored,"manufacturer"),false);
 assert.equal(Object.hasOwn(stored,"model"),false);
 assert.equal(Object.hasOwn(stored,"partType"),false);
 assert.equal(Object.hasOwn(stored.projectDetails,"workshopReferenceId"),false);
 const candidate=stored.selection.candidates[0];
 assert.equal(candidate.model,"2N7000");
 assert.equal(candidate.workshopReferenceId,"workshop:2n7000");
 assert.equal(candidate.historicalPrice,0.19);
});
test("resolution supplies existing UI without changing functional part number",()=>{
 const view=resolveFunctionalPart(encodeFunctionalPart(original()));
 assert.equal(view.partNumber,"104");
 assert.equal(view.name,"LED Switch");
 assert.equal(view.model,"2N7000");
 assert.equal(view.projectDetails.workshopReferenceId,"workshop:2n7000");
 assert.equal(view.implementationResolved,true);
});
test("new implementation does not inherit another candidate's supplier or specs",()=>{
 const before=resolveFunctionalPart(encodeFunctionalPart(original()));
 const after=changeImplementation(before,"add",{name:"Machined switch carrier",partType:"custom"});
 assert.equal(after.name,"LED Switch");
 assert.equal(after.partNumber,"104");
 assert.equal(after.implementations.length,2);
 assert.equal(after.implementationName,"Machined switch carrier");
 assert.equal(after.partType,"custom");
 assert.equal(after.manufacturer,"");
 assert.equal(after.specifications.length,0);
 assert.equal(after.implementationHistory.length,1);
 const back=changeImplementation(after,"select",{id:before.selectedImplementationId});
 assert.equal(back.model,"2N7000");
 assert.equal(back.workshopChoice,"workshop:2n7000");
 assert.equal(back.implementationHistory.length,2);
});
test("functional requirements remain when an implementation is unselected",()=>{
 const selected=resolveFunctionalPart(encodeFunctionalPart(original()));
 const unselected=changeImplementation(selected,"select",{id:null});
 const stored=encodeFunctionalPart(unselected);
 assert.equal(stored.selection.selectedId,null);
 assert.equal(stored.functional.purpose,original().description);
 assert.equal(implementationForBOM(stored).status,"unselected");
 assert.equal(stored.selection.candidates.length,1);
});
test("selection history and retired alternatives persist rather than being deleted",()=>{
 const selected=resolveFunctionalPart(encodeFunctionalPart(original()));
 const retired=changeImplementation(selected,"retire",{id:selected.selectedImplementationId});
 const stored=encodeFunctionalPart(retired);
 assert.equal(stored.selection.candidates.length,1);
 assert.ok(stored.selection.candidates[0].retiredAt);
 assert.equal(stored.selection.selectedId,null);
 assert.throws(()=>changeImplementation(retired,"select",{id:selected.selectedImplementationId}),/Retired implementation/);
});
test("BOM resolves one implementation per functional part",()=>{
 const purchased=resolveFunctionalPart(encodeFunctionalPart(original()));
 const fabricated=changeImplementation(purchased,"add",{name:"Custom PCB switch",partType:"custom"});
 const unresolved=changeImplementation(fabricated,"select",{id:null});
 const {splitPhysicalPlan}=globalThis.BSBomModel;
 const groups=splitPhysicalPlan([purchased,fabricated,unresolved]);
 assert.deepEqual(groups.purchase,[purchased]);
 assert.deepEqual(groups.fabricate,[fabricated]);
 assert.deepEqual(groups.unselected,[unresolved]);
});
test("document and auto-generated consumables are not converted into functional parts",()=>{
 for(const part of [
  {id:"doc",itemType:"document",partType:"code",name:"Code"},
  {id:"wire",generatedFrom:"part-104",partType:"purchased",name:"Ferrule"}
 ]){
  assert.deepEqual(encodeFunctionalPart(part),part);
  assert.deepEqual(resolveFunctionalPart(part),part);
 }
});

test("purchasing status belongs to the selected implementation",()=>{
 const originalPart={...original(),purchaseStatus:"already_have"};
 const first=resolveFunctionalPart(encodeFunctionalPart(originalPart));
 const newCandidate=changeImplementation(first,"add",{name:"Alternative MOSFET",partType:"purchased"});
 assert.equal(newCandidate.purchaseStatus,"not_started");
 const ordered={...newCandidate,purchaseStatus:"need_to_buy"};
 const same=changeImplementation(ordered,"select",{id:ordered.selectedImplementationId});
 assert.equal(same.purchaseStatus,"need_to_buy");
 const old=changeImplementation(same,"select",{id:first.selectedImplementationId});
 assert.equal(old.purchaseStatus,"not_started");
 const retired=changeImplementation({...old,purchaseStatus:"already_have"},"retire",{id:newCandidate.selectedImplementationId});
 assert.equal(retired.purchaseStatus,"already_have");
});

test("project-owned function description does not follow the selected purchased or custom design",()=>{
 const source={...original(),name:"2N7000 N-channel MOSFET",
  projectDetails:{...original().projectDetails,featureTreeName:"LED Switching Transistor"}};
 const first=resolveFunctionalPart(encodeFunctionalPart(source));
 const custom=changeImplementation(first,"add",{name:"Custom LED Driver PCB",partType:"custom"});
 assert.equal(custom.projectDetails.featureTreeName,"LED Switching Transistor");
 assert.equal(custom.implementationName,"Custom LED Driver PCB");
 const restored=changeImplementation(custom,"select",{id:first.selectedImplementationId});
 assert.equal(restored.projectDetails.featureTreeName,"LED Switching Transistor");
 assert.equal(restored.model,"2N7000");
 const stored=encodeFunctionalPart(restored);
 assert.equal(stored.projectDetails.featureTreeName,"LED Switching Transistor");
});
