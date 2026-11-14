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
