import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("every Workshop tool and material appears exactly once in the category tree",()=>{
 const source=readFileSync("assets/resources.js","utf8");
 const materialIds=[...source.matchAll(/\{id:"(workshop:[^"]+)",kind:"material"/g)].map(match=>match[1]);
 const toolIds=[...source.matchAll(/\{id:"(workshop:[^"]+)",kind:"tool"/g)].map(match=>match[1]);
 const tree=source.slice(source.indexOf("const workshopCategories=["),source.indexOf("const legacyCategory="));
 assert.equal(materialIds.length+toolIds.length,16);
 for(const id of materialIds)assert.equal(tree.split('"'+id+'"').length-1,1,id+" material must be in exactly one category");
 assert.match(tree,/\["tool","Tool",workshopEquipment\.map\(item=>item\.id\)\]/);
 for(const label of ["Wire and cable","Power and electronics","Fasteners","Tool","Other"])assert.ok(tree.includes(label),label+" category missing");
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

test("New Part Workshop Item picker uses the same four categories",()=>{
 const picker=readFileSync("assets/library-part-picker.js","utf8");
 const api=readFileSync("functions/api/commonparts.js","utf8");
 assert.match(picker,/document\.createTextNode\("This part is from the workshop"\)/);
 assert.match(picker,/const lib=workshopCheckbox\.checked/);
 for(const [id,label] of [["wire","Wire and cable"],["power","Power and electronics"],["fasteners","Fasteners"],["tool","Tool"],["other","Other"]]){
  assert.ok(picker.includes('["'+id+'","'+label+'"]'),"Missing "+label+" in the picker");
  assert.ok(api.includes('"'+id+'"'),"Missing "+id+" category in save API");
 }
 assert.match(picker,/commonGroup\(p\)/);
 assert.match(picker,/cat==="screws"/);
 assert.match(picker,/cat==="buck-converters"/);
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

test("Power and electronics has useful component filters and no duplicate category selector",()=>{
 const picker=readFileSync("assets/library-part-picker.js","utf8");
 for(const label of ["Power supplies & converters","Motors & motor drives","Controllers & circuit boards","Sensors & switches","Other electronics"])
  assert.ok(picker.includes(label),"Missing power filter: "+label);
 assert.doesNotMatch(picker,/field\("Filter parts","select"\)/);
 assert.match(picker,/powerType\.label\.classList\.toggle\("hide",!lib\|\|category\.input\.value!=="power"\)/);
 assert.match(picker,/fetch\("\/api\/purchased-parts"/);
 assert.match(picker,/workshopToolRows/);
});
