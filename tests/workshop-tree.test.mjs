import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {runInNewContext} from "node:vm";

test("Edit Part inputs use paired descriptor/value layout with mobile fallback",()=>{
 const css=readFileSync("assets/site-workspaces.css","utf8");
 assert.match(css,/\.component-review>label\s*\{\s*display:grid/);
 assert.match(css,/grid-template-columns:minmax\(150px,215px\) minmax\(0,1fr\)/);
 assert.match(css,/@media\(max-width:620px\)/);
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

test("Projects use tags instead of a category selector, without deleting legacy API metadata",()=>{
 const source=readFileSync("assets/project-manager.js","utf8");
 const api=readFileSync("functions/api/projects.js","utf8");
 assert.doesNotMatch(source,/name="category"/);
 assert.doesNotMatch(source,/groupInput|categoryNavigation|categoryCounts/);
 assert.match(source,/makeTagPicker\(projectTags\(project\)\)/);
 assert.match(source,/getTags\(\)/);
 assert.match(api,/category/); // Historical records must remain readable.
});