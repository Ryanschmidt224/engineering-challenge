import {test} from "node:test";
import assert from "node:assert/strict";
import {projectTree} from "../assets/project-tree-model.js";
import {summaryAssembly} from "../assets/project-root-view.js";
const items=[{id:"assembly",is_assembly:true},{id:"part",is_assembly:false}];
const root={id:"root",item_id:"assembly",parent_id:null,quantity:1,sort_order:0,removed_at:null};
test("one unit assembly can share the summary without changing identities or parents",()=>{const rows=[root,{id:"child",item_id:"part",parent_id:"root",quantity:3,sort_order:0,removed_at:null}],before=structuredClone(rows);assert.equal(summaryAssembly(projectTree(items,rows)).occurrence.id,"root");assert.deepEqual(rows,before);});
test("multiple builds, quantities and hidden assemblies stay explicit",()=>{assert.equal(summaryAssembly(projectTree(items,[{...root,quantity:2}])),null);assert.equal(summaryAssembly(projectTree(items,[{...root,hidden:true}])),null);assert.equal(summaryAssembly(projectTree(items,[root,{id:"other",item_id:"part",parent_id:null,quantity:1,removed_at:null}])),null);});
test("the summary root is not created from a leaf part or an empty project",()=>{assert.equal(summaryAssembly(projectTree(items,[])),null);assert.equal(summaryAssembly(projectTree(items,[{...root,item_id:"part"}])),null);});
