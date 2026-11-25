import {test} from "node:test";
import assert from "node:assert/strict";
import {projectTree} from "../assets/project-tree-model.js";
import {treeDropPlan} from "../assets/project-tree-drag.js";
const tree=()=>projectTree([{id:"a",name:"A",is_assembly:true},{id:"b",name:"B",is_assembly:true},{id:"p",name:"Part"}],[{id:"root",item_id:"a",parent_id:null,sort_order:0},{id:"nested",item_id:"b",parent_id:"root",sort_order:0},{id:"one",item_id:"p",parent_id:"root",sort_order:1},{id:"two",item_id:"p",parent_id:"root",sort_order:2}]);
test("drag reorder supplies each sibling exactly once and ignores an unchanged order",()=>{assert.deepEqual(treeDropPlan(tree(),"two","one","before").data.ids,["nested","two","one"]);assert.equal(treeDropPlan(tree(),"one","two","before"),null);});
test("drag into an assembly uses one existing move command without changing build values",()=>{assert.deepEqual(treeDropPlan(tree(),"one","nested"),{path:"/occurrences/one",method:"PATCH",data:{parentId:"nested",sortOrder:0}});assert.equal(treeDropPlan(tree(),"one","root"),null);assert.equal(treeDropPlan(tree(),"one",null).data.parentId,null);});
test("drag rejects descendants, leaf destinations and ambiguous cross-parent reorders",()=>{assert.throws(()=>treeDropPlan(tree(),"root","nested"),/cannot contain itself/);assert.throws(()=>treeDropPlan(tree(),"nested","one"),/subassembly/);assert.throws(()=>treeDropPlan(tree(),"one","root","after"),/change assemblies/);assert.equal(treeDropPlan(tree(),"root","root"),null);});
