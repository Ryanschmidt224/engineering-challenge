import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("Workshop reference categories are centralized and preserve stable item IDs",()=>{
 const source=readFileSync("assets/resources.js","utf8");
 const tree=source.slice(source.indexOf("const workshopCategories=["),source.indexOf("const legacyCategory="));
 for(const name of ["Tools & Equipment","Consumables & Supplies","Electronics & Components","Hardware & Materials","Safety & Measurement"])
  assert.ok(tree.includes(name),name+" is required");
 for(const name of ["workshop:solder","workshop:wire22","workshop:meter","workshop:oscilloscope","workshop:ferrule22"])
  assert.ok(source.includes('id:"'+name+'"'),name+" must retain its stable reference ID");
 assert.match(tree,/\["tools","Tools & Equipment",\[/);
 assert.match(tree,/workshopComponents\.map\(item=>item\.id\)/);
 assert.match(tree,/workshopHardware\.map\(item=>item\.id\)/);
 assert.match(source,/const workshopReferences=.*\.map\(itemMetadata\)/);
 assert.match(source,/branch\("purchased"/);
 assert.match(source,/branch\("saved"/);
 assert.match(source,/ancestor\.tagName==="DETAILS"/);
});
test("Edit Part inputs use paired descriptor/value layout with mobile fallback",()=>{
 const css=readFileSync("assets/site.css","utf8");
 assert.match(css,/\.component-review>label\s*\{\s*display:grid/);
 assert.match(css,/grid-template-columns:minmax\(150px,215px\) minmax\(0,1fr\)/);
 assert.match(css,/@media\(max-width:620px\)/);
});

test("New Part Workshop picker uses the same five categories",()=>{
 const picker=readFileSync("assets/library-part-picker.js","utf8");
 const api=readFileSync("functions/api/commonparts.js","utf8");
 assert.match(picker,/document\.createTextNode\("This part is from the workshop"\)/);
 assert.match(picker,/const lib=workshopCheckbox\.checked/);
 for(const [id,label] of [["tools","Tools & Equipment"],["consumables","Consumables & Supplies"],["electronics","Electronics & Components"],["hardware","Hardware & Materials"],["safety","Safety & Measurement"]]){
  assert.ok(picker.includes('["'+id+'","'+label+'"]'),"Missing "+label+" in picker");
  assert.ok(api.includes('"'+id+'"'),"Missing "+id+" category in API");
 }
 assert.match(picker,/commonGroup\(p\)/);
 assert.match(picker,/wireModeCheckbox/);
});
test("Tree display offers only Workshop item and Document filters",()=>{
 const source=readFileSync("assets/site-assembly.js","utf8");
 assert.match(source,/filterOption\("Workshop item"/);
 assert.match(source,/filterOption\("Document"/);
 for(const old of ["Purchased","Custom","Tools","Documents","Hidden parts"])
  assert.ok(!source.includes('filterOption("'+old+'"'),"Old tree filter remains: "+old);
 assert.match(source,/partWorkshopItems\.get\(node\.partId\)===true/);
 assert.match(source,/return !isHiddenPart\(node\)/);
});
test("Parts Management input backgrounds and column grips are uncluttered",()=>{
 const css=readFileSync("assets/parts-management.css","utf8");
 assert.match(css,/background-color:#fff!important/);
 assert.match(css,/border-radius:7px/);
});

test("Electronics & Components retains useful subtype filters",()=>{
 const picker=readFileSync("assets/library-part-picker.js","utf8");
 for(const label of ["Power supplies & converters","Motors & motor drives","Controllers & circuit boards","Sensors & switches","Other electronics"])
  assert.ok(picker.includes(label),"Missing power filter: "+label);
 assert.doesNotMatch(picker,/field\("Filter parts","select"\)/);
 assert.match(picker,/powerType\.label\.classList\.toggle\("hide",!lib\|\|category\.input\.value!=="electronics"\)/);
 assert.match(picker,/fetch\("\/api\/purchased-parts"/);
 assert.match(picker,/workshopStandardRows/);
});
