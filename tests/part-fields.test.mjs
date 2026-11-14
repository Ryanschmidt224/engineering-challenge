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

test("Parts Management groups repeated names without merging distinct records",()=>{
 const script=readFileSync(new URL("../assets/parts-management.js",import.meta.url),"utf8");
 const context={window:{BSPartFields:fields}};
 runInNewContext(script,context);
 const group=context.window.BSPartsManager.groupParts;
 const entries=[
  {id:"motor-a",name:"C2822 1400KV Brushless Motor",partType:"purchased"},
  {id:"motor-b",name:" c2822  1400kv brushless motor ",partType:"purchased"},
  {id:"motor-custom",name:"C2822 1400KV Brushless Motor",partType:"custom"},
  {id:"regulator",name:"5V Buck Converter",partType:"purchased"}
 ];
 const groups=group(entries);
 assert.equal(groups.length,3);
 const motors=groups.find(g=>g.parts.some(p=>p.id==="motor-a"));
 assert.deepEqual(Array.from(motors.parts,p=>p.id),["motor-a","motor-b"]);
 assert.equal(entries.length,4);
 assert.notEqual(groups.find(g=>g.parts.some(p=>p.id==="motor-custom")),motors);
});

test("Legacy parts without explicit type filter as Off-the-shelf",()=>{
 const legacy={id:"old",name:"LM2596 DC Converter",itemType:"part"};
 const explicit={...legacy,id:"new",partType:"purchased"};
 assert.equal(fields.partTypeFor(legacy),"purchased");
 assert.equal(fields.partTypeFor(explicit),"purchased");
 assert.equal(fields.statusField(legacy),"purchaseStatus");
 assert.equal(fields.labelFor(fields.statusesFor(legacy),"already_have"),"Already own");
 const script=readFileSync(new URL("../assets/parts-management.js",import.meta.url),"utf8");
 assert.match(script,/partTypeFor\(p\)===typeFilter\.value/);
 const context={window:{BSPartFields:fields}};
 runInNewContext(script,context);
 const groups=context.window.BSPartsManager.groupParts([legacy,explicit]);
 assert.equal(groups.length,1);
});

test("Status choices are based on item type and sourcing",()=>{
 for(const record of [
  {name:"COTS part",partType:"purchased",itemType:"part",key:"purchaseStatus"},
  {name:"Custom part",partType:"custom",itemType:"part",key:"progressStatus"},
  {name:"Document",partType:"purchased",itemType:"document",key:"progressStatus"},
  {name:"Code",partType:"code",itemType:"document",key:"progressStatus"}
 ]){
  assert.equal(fields.statusField(record),record.key,record.name);
  const ids=fields.statusesFor(record).map(([id])=>id);
  assert.equal(ids.includes("already_have"),record.key==="purchaseStatus",record.name);
  assert.equal(ids.includes("in_progress"),record.key==="progressStatus",record.name);
 }
});

test("Parts Management autofits displayed names up to 40 characters without truncating stored names",()=>{
 const source=readFileSync(new URL("../assets/parts-management.js",import.meta.url),"utf8");
 assert.match(source,/String\(part\.name\|\|""\)\.slice\(0,40\)/);
 assert.match(source,/Math\.min\(maxWidth/);
 assert.match(source,/fitNameWidth\(entries\)/);
 assert.match(source,/nameWidthManuallyResized=true/);
 assert.match(source,/input\.maxLength=180/);
});

test("Progress Status operations render as editable fields on both pages",()=>{
 const management=readFileSync(new URL("../assets/parts-management.js",import.meta.url),"utf8");
 const details=readFileSync(new URL("../assets/site-assembly.js",import.meta.url),"utf8");
 assert.match(management,/let order="name",direction=1/);
 assert.match(management,/progressOperationAdd:true/);
 assert.match(management,/progressOperationEdit:\{id:operation\.id,text:input\.value\}/);
 assert.match(management,/for\(const \[index,operation\] of \(part\.progressUpdates\|\|\[\]\)\.entries\(\)\)/);
 assert.match(details,/partWorkspace\.querySelector\("\.workspace-heading"\)\.after\(progressNotes\)/);
 assert.match(details,/progressNotes\.open=part\.progressStatus==="in_progress"/);
 assert.match(details,/progressOperationAdd:true/);
 assert.match(details,/progressOperationEdit:\{id:operation\.id,text:input\.value\}/);
 assert.doesNotMatch(details,/detailRows\.after\(progressNotes\)/);
});
