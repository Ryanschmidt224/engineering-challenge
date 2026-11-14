import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("every Workshop tool and material appears exactly once in the category tree",()=>{
 const source=readFileSync("assets/resources.js","utf8");
 const ids=[...source.matchAll(/\{id:"(workshop:[^"]+)",kind:"(?:tool|material)"/g)].map(match=>match[1]);
 const tree=source.slice(source.indexOf("const workshopCategories=["),source.indexOf("const legacyCategory="));
 assert.equal(ids.length,16);
 for(const id of ids){
  const count=tree.split('"'+id+'"').length-1;
  assert.equal(count,1,id+" must be in exactly one category");
 }
 for(const label of ["Wire and cable","Power and electronics","Fasteners","Other"])assert.ok(tree.includes(label),label+" category missing");
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
