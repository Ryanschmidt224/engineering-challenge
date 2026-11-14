import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const browser={window:{}};
runInNewContext(readFileSync(new URL("../assets/part-fields.js",import.meta.url),"utf8"),browser);
const fields=browser.window.BSPartFields;

test("purchased and custom status options remain separate",()=>{
 const purchased={partType:"purchased"};
 const custom={partType:"custom",progressStatus:"in_progress"};
 assert.equal(fields.statusField(purchased),"purchaseStatus");
 assert.equal(fields.statusValue(purchased),"not_started");
 assert.equal(fields.statusValue({...purchased,purchaseStatus:"need_to_buy"}),"need_to_buy");
 assert.equal(fields.labelFor(fields.statusesFor(purchased),"already_have"),"Already own");
 assert.equal(fields.labelFor(fields.statusesFor(purchased),"need_to_buy"),"Need to buy");
 assert.equal(fields.labelFor(fields.statusesFor(purchased),"not_started"),"Not started");
 assert.equal(fields.statusField(custom),"progressStatus");
 assert.equal(fields.statusValue(custom),"in_progress");
 assert.equal(fields.statusesFor(purchased).some(([key])=>key==="need_to_buy"),true);
 assert.equal(fields.statusesFor(custom).some(([key])=>key==="need_to_buy"),false);
});

test("expanded details follow shared editor field order and hide empty fields",()=>{
 const part={partNumber:"NR116",name:"Flywheel",itemType:"part",partType:"purchased",description:"Launches dart",quantity:2,purchaseStatus:"not_started",isTool:false,hideFromFeatureTree:false};
 const rows=fields.detailRows(part);
 assert.deepEqual(Array.from(rows,([label])=>label),["Part number","Part name","Item type","Part type","Status","Description","Quantity"]);
 assert.equal(rows.find(([label])=>label==="Status")[1],"Not started");
 assert.equal(rows.some(([label])=>label==="Manufacturer"),false);
});

test("display details include recorded source information but no empty fields",()=>{
 const rows=fields.detailRows({name:"Bracket",partType:"custom",quantity:1,category:"Mounting"});
 assert.equal(rows.find(([label])=>label==="Category")[1],"Mounting");
 assert.equal(rows.some(([label])=>label==="Supplier"),false);
});

test("Code is displayed as its own item type for existing code records",()=>{
 const code={name:"Controller source",partType:"code",itemType:"document",quantity:null};
 const rows=fields.detailRows(code);
 assert.equal(rows.find(([label])=>label==="Item type")[1],"Code");
 assert.equal(rows.some(([label])=>label==="Part type"),false);
});

test("New Part and Part editor each show Part, Document, Code",()=>{
 const picker=readFileSync(new URL("../assets/library-part-picker.js",import.meta.url),"utf8");
 const editor=readFileSync(new URL("../assets/site-assembly.js",import.meta.url),"utf8");
 for(const source of [picker,editor]){
  for(const [type,label] of [["part","Part"],["document","Document"],["code","Code"]])
   assert.ok(source.includes('"'+type+'","'+label+'"'),"Missing item type "+label);
 }
 assert.match(picker,/partType:itemKind\.input\.value==="code"\?"code":partClassification\.input\.value/);
 assert.match(editor,/itemTypeSelect\.value=part\.partType==="code"\?"code"/);
});

test("Parts Management table fills viewport after column resizing",()=>{
 const js=readFileSync(new URL("../assets/parts-management.js",import.meta.url),"utf8");
 assert.match(js,/scroll\.clientWidth-prefix/);
 assert.match(js,/new ResizeObserver\(layoutColumns\)/);
 assert.match(js,/layoutColumns\(\)/);
});
