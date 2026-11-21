import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {runInNewContext} from "node:vm";

test("Workshop reference categories are centralized and preserve stable item IDs",()=>{
 const source=readFileSync("assets/resources.js","utf8");
 const tree=source.slice(source.indexOf("const workshopCategories=["),source.indexOf("const legacyCategory="));
 for(const name of ["Tools & Equipment","Consumables & Supplies","Electronics & Components","Hardware & Materials","Safety & Measurement"])
  assert.ok(tree.includes(name),name+" is required");
 for(const name of ["workshop:solder","workshop:wire22","workshop:wire18","workshop:ferrule22","workshop:heatshrink"])
  assert.ok(source.includes('id:"'+name+'"'),name+" must remain a shared essential");
 assert.match(source,/const workshopEquipment=\[\];/);
 assert.match(source,/const workshopComponents=\[\];/);
 assert.match(source,/const workshopPower=\[\];/);
 assert.match(tree,/\["tools","Tools & Equipment",\[/);
 assert.match(tree,/\["electronics","Electronics & Components",\[\]\]/);
 assert.match(tree,/\["tools","Tools & Equipment",\[\]\]/);
 assert.match(source,/const workshopReferences=workshopSupplies\.map\(itemMetadata\)/);
 assert.match(source,/branch\("purchased"/);
 assert.match(source,/branch\("saved"/);
 assert.match(source,/ancestor\.tagName==="DETAILS"/);
});
test("Edit Part inputs use paired descriptor/value layout with mobile fallback",()=>{
 const css=readFileSync("assets/site-workspaces.css","utf8");
 assert.match(css,/\.component-review>label\s*\{\s*display:grid/);
 assert.match(css,/grid-template-columns:minmax\(150px,215px\) minmax\(0,1fr\)/);
 assert.match(css,/@media\(max-width:620px\)/);
});

test("New Part Workshop picker uses the same five categories",()=>{
 const picker=readFileSync("assets/library-part-picker.js","utf8");
 const api=readFileSync("functions/api/commonparts.js","utf8");
 assert.match(picker,/el\("strong","","Use from"\)/);
 assert.match(picker,/el\("strong","","Create new"\)/);
 assert.match(picker,/addToWorkshopCheckbox\.onchange/);
 assert.match(picker,/partClassification\.input\.value="purchased"/);
 assert.match(picker,/payload\.addToWorkshop=publicRadio\.checked\?"public":"private"/);
 assert.match(picker,/const lib=isPart&&workshopCheckbox\.checked/);
 assert.match(picker,/form\.append\(heading,subtitle,itemKind\.label,workshopChoices/);
 assert.match(picker,/name="new-part-source"/);
 assert.match(picker,/name="workshop-destination"/);
 assert.match(picker,/saveCreatedPartToWorkshop/);
 assert.match(picker,/publicCategory\.input\.value/);
 for(const [id,label] of [["tools","Tools & Equipment"],["consumables","Consumables & Supplies"],["electronics","Electronics & Components"],["hardware","Hardware & Materials"],["safety","Safety & Measurement"]]){
  assert.ok(picker.includes('["'+id+'","'+label+'"]'),"Missing "+label+" in picker");
  assert.ok(api.includes('"'+id+'"'),"Missing "+id+" category in API");
 }
 assert.match(picker,/commonGroup\(p\)/);
 assert.match(picker,/wireModeCheckbox/);
});
test("Feature tree uses explicit show/hide controls for Workshop items and documents",()=>{
 const source=readFileSync("assets/site-assembly.js","utf8");
 assert.match(source,/filterOption\("Show Workshop items"/);
 assert.match(source,/filterOption\("Show documents"/);
 for(const old of ["Purchased","Custom","Tools","Documents","Hidden parts"])
  assert.ok(!source.includes('filterOption("'+old+'"'),"Old tree filter remains: "+old);
 const code=source.slice(source.indexOf("const includeTreeNode="),source.indexOf("const loadWorkshopCaptions="));
 const flags={showWorkshopItems:true,showTreeDocuments:true,showHiddenParts:false};
 const sandbox={...flags,isPartNode:n=>n.kind==="part",isHiddenPart:n=>n.hidden,isDocumentNode:n=>n.document,
  partWorkshopItems:new Map([["workshop-part",true]])};
 const visible=runInNewContext(code+";includeTreeNode",sandbox);
 const part={kind:"part",partId:"workshop-part",document:true,hidden:true};
 assert.equal(visible(part),false);
 sandbox.showHiddenParts=true;assert.equal(visible(part),true);
 sandbox.showWorkshopItems=false;assert.equal(visible(part),false);
 sandbox.showWorkshopItems=true;sandbox.showTreeDocuments=false;assert.equal(visible(part),false);
 assert.equal(visible({kind:"assembly"}),true);
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

test("Projects use tags instead of a category selector, without deleting legacy API metadata",()=>{
 const source=readFileSync("assets/project-manager.js","utf8");
 const api=readFileSync("functions/api/projects.js","utf8");
 assert.doesNotMatch(source,/name="category"/);
 assert.doesNotMatch(source,/groupInput|categoryNavigation|categoryCounts/);
 assert.match(source,/makeTagPicker\(projectTags\(project\)\)/);
 assert.match(source,/getTags\(\)/);
 assert.match(api,/category/); // Historical records must remain readable.
});
test("Saving a purchased project part to My Workshop never publishes private inventory to the shared catalog",()=>{
 const source=readFileSync("assets/site-assembly.js","utf8");
 assert.match(source,/const \{wireInfo,workshopSavedMessage="",addToWorkshop=false,workshopCategory="",\.\.\.part\}=payload/);
 const picker=readFileSync("assets/library-part-picker.js","utf8");
 assert.match(picker,/savedWorkshopItem=await saveCreatedPartToWorkshop\(/);
 assert.match(picker,/delete payload\.addToWorkshop/);
 assert.match(source,/workshopSavedMessage/);
 assert.doesNotMatch(source,/await window\.BSLibraryPartPicker\.saveCreatedPartToWorkshop\(/);
 assert.match(picker,/fetch\("\/api\/personal-workshop"/);
 assert.match(picker,/quantity:0,unit:"pcs"/);
 assert.match(picker,/stockStatus:"committed"/);
 assert.match(picker,/if\(chosen==="public"\)/);
 assert.match(picker,/fetch\("\/api\/workshop-reference"/);
 assert.match(picker,/if\(chosen!=="private"\)/);
});

test("Workshop detail editing is tied to the opened record, with one image-adjacent Edit action",()=>{
 const source=readFileSync("assets/personal-workshop.js","utf8");
 const css=readFileSync("assets/workshop.css","utf8");
 const shared=source.slice(source.indexOf("  function showItem("),source.indexOf("  function openItemEditor("));
 assert.doesNotMatch(shared,/Edit shared catalog|Edit My Workshop copy|Edit item in My Workshop/);
 assert.match(shared,/if\(canEditCatalog\(item\)\)\s*mediaButtons\.append\(itemButton\("Edit",\(\)=>openItemEditor\(item\)/);
 assert.equal((shared.match(/itemButton\("Edit"/g)||[]).length,1);
 assert.match(shared,/mediaWithEdit\.append\(mediaButtons\)/);
 assert.match(shared,/itemButton\("View in My Workshop",\(\)=>showPersonalItem\(owned\[0\]\.id\)/);
 const personal=source.slice(source.indexOf("  function showPersonalItem("),source.indexOf("  function showItem("));
 assert.equal((personal.match(/itemButton\("Edit"/g)||[]).length,1);
 assert.match(source,/window\.BSPartFields\?\.sectionFields/);
 assert.match(source,/part-editor-section-heading/);
 assert.match(css,/\.workshop-item-hero\{grid-template-columns:minmax\(260px,440px\)/);
 assert.match(css,/\.workshop-under-image-edit\{min-width:0/);
});

test("Only nine core supplies are seeded, with reference images and buying guidance",()=>{
 const sandbox={window:{},document:{readyState:"loading",addEventListener(){}}};
 runInNewContext(readFileSync("assets/resources.js","utf8"),sandbox);
 const {workshopReferences,workshopCategories,workshopGroups}=sandbox.window.BSResources;
 assert.equal(workshopReferences.length,9);
 assert.deepEqual([...workshopReferences.map(item=>item.id)].sort(),[
  "workshop:ferrule18","workshop:ferrule22","workshop:heatshrink",
  "workshop:sealshrink","workshop:silicone","workshop:solder",
  "workshop:wire16","workshop:wire18","workshop:wire22"
 ].sort());
 assert.equal(workshopCategories.length,5);
 assert.ok(workshopGroups.some(group=>group.id==="measurement"),"Empty family remains available for new items");
 for(const item of workshopReferences){
  assert.equal(item.kind,"material");
  assert.ok(item.orderNotes?.length>45,"Missing buying advice: "+item.name);
  assert.ok(item.illustration,"Missing picture for "+item.name);
  const path="assets/workshop-illustrations/"+item.illustration+".svg";
  assert.ok(existsSync(path),"Missing illustration: "+path);
  assert.match(readFileSync(path,"utf8"),/^<svg/);
 }
});
