import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const browser={window:{},URL};
runInNewContext(readFileSync(new URL("../assets/part-fields.js",import.meta.url),"utf8"),browser);
const fields=browser.window.BSPartFields;

test("cost rolls up Workshop packages with recorded prices taking priority",()=>{
 const sourcing={url:"https://example.test/parts/123",price:"$12.50",packageQuantity:"5 pcs"};
 const part={quantity:6,workshopSourcing:sourcing};
 assert.equal(fields.sourcingFor(part).url,sourcing.url);
 assert.equal(fields.sourcingFor(part).unitCost,2.5);
 assert.equal(fields.sourcingFor(part).packageSize,"5 pcs");
 const historic={...part,historicalPrice:3};
 assert.equal(fields.sourcingFor(historic).source,"historical");
 assert.equal(fields.sourcingFor(historic).unitCost,3);
 const legacy={quantity:1,specifications:[
  {name:"Supplier URL",value:"javascript:alert(1)"},{name:"Reference price",value:"9.00 USD"},{name:"Quantity per package",value:"3"}
 ]};
 assert.equal(fields.sourcingFor(legacy).url,"");
 assert.equal(fields.sourcingFor(legacy).unitCost,3);
 const ambiguous={...part,workshopSourcing:{...sourcing,packageQuantity:"assortment"}};
 const result=fields.estimateCost([part,historic,legacy,ambiguous,{...part,quantity:null},{...part,isTool:true}]);
 assert.equal(result.total,36);
 assert.equal(result.priced,3);
 assert.equal(result.workshop,2);
 assert.equal(result.materials,5);
});

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

test("whole package estimate rounds combined quantities and reports incomplete materials",()=>{
 const part={quantity:6,projectDetails:{workshopReferenceId:"workshop:resistor"},workshopSourcing:{price:"10",packageQuantity:"10"}};
 const result=fields.estimateCost([part,{...part,quantity:7},{...part,quantity:null},{quantity:3}]);
 assert.equal(result.total,13);
 assert.equal(result.packageTotal,20);
 assert.equal(result.packagePriced,2);
 assert.equal(result.missingQuantity,1);
 assert.equal(result.missingPrice,1);
});

test("expanded details follow shared editor field order and hide empty fields",()=>{
 const part={partNumber:"NR116",name:"Flywheel",itemType:"part",partType:"purchased",description:"Launches dart",quantity:2,purchaseStatus:"not_started",isTool:false,hideFromFeatureTree:false,projectDetails:{featureTreeName:"Dart Launcher Flywheel"}};
 const rows=fields.detailRows(part);
 assert.deepEqual(Array.from(rows,([label])=>label),["Part name","Feature tree description","Status","Quantity","Part number","Item type","Part type","Description"]);
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
 const picker=readFileSync(new URL("../assets/part-create.js",import.meta.url),"utf8");
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
 assert.match(script,/const matchesType=part=>/);
  assert.match(script,/window\.BSCatalogUI\?\.categories\(sidebar/);
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

test("Parts Management and part pages omit the retired operations editor",()=>{
 const management=readFileSync(new URL("../assets/parts-management.js",import.meta.url),"utf8");
 const details=readFileSync(new URL("../assets/site-assembly.js",import.meta.url),"utf8");
 assert.match(management,/let order="name",direction=1/);
 assert.match(management,/stateCell\.append\(state\)/);
 assert.doesNotMatch(management,/bs-progress-notes|bs-progress-operations|progressOperationAdd|progressOperationEdit/);
 assert.doesNotMatch(details,/part-progress-updates|progressOperationAdd|progressOperationEdit/);
 assert.match(details,/part-needs-attention/);
});

test("part values distinguish variants in display names and whole-package totals",()=>{
 const base={name:"¼ W resistor",quantity:1,workshopSourcing:{price:"10",packageQuantity:"100"}};
 const a={...base,projectDetails:{workshopReferenceId:"workshop:resistor",value:"10 kΩ"}};
 const b={...base,projectDetails:{workshopReferenceId:"workshop:resistor",value:"100 kΩ"}};
 assert.equal(fields.displayName(a),"¼ W resistor - 10 kΩ");
 assert.equal(fields.estimateCost([a,b]).packageTotal,20);
 assert.equal(fields.estimateCost([a,b]).priceAvailable,2);
 assert.equal(fields.estimateCost([{...a,quantity:null},b]).priceAvailable,2);
 assert.equal(fields.estimateCost([{...a,quantity:null},b]).priced,1);
});

test("purchased custom parts expose purchase costs and buying status",()=>{
 const part={partType:"custom_purchased",supplier:"JLCPCB",quantity:2,historicalPrice:12.5};
 assert.equal(fields.statusField(part),"purchaseStatus");
 assert.equal(fields.sourcingFor(part).unitCost,12.5);
 assert.equal(fields.estimateCost([part]).total,25);
 assert.equal(fields.detailRows(part).find(([label])=>label==="Supplier")[1],"JLCPCB");
});

test("expanded identity keeps value separate and groups supplier ordering identifiers",()=>{
 const part={name:"1/4 Watt Resistor",projectDetails:{value:"350"},supplier:"DigiKey",asin:"B07BL2VX1",
  workshopSourcing:{supplierPartNumber:"ABC-ND"}};
 const rows=fields.detailRows(part);
 assert.equal(rows.find(([label])=>label==="Part name")[1],"1/4 Watt Resistor");
 assert.equal(rows.find(([label])=>label==="Value")[1],"350Ω");
 assert.deepEqual(Array.from(rows.filter(([label])=>label==="Supplier"),row=>row[1]),["DigiKey · ABC-ND","Amazon · ASIN B07BL2VX1"]);
 assert.equal(rows.some(([label])=>label==="ASIN"),false);
});

test("documentation combines Workshop and saved references with safe distinct links",()=>{
 const links=fields.documentationLinks({
  workshopDocumentation:[{label:"Datasheet",url:"https://example.test/data.pdf"}],
  specifications:[
   {name:"Documentation URL",value:"https://example.test/data.pdf"},
   {name:"Manual",value:"https://example.test/manual.pdf"},
   {name:"Datasheet",value:"javascript:alert(1)"},
   {name:"Supplier URL",value:"https://example.test/buy"},
   {name:"Manual",value:"https://user:secret@example.test/private.pdf"}
  ]
 });
 assert.deepEqual(Array.from(links,link=>link.url),["https://example.test/data.pdf","https://example.test/manual.pdf"]);
 assert.equal(fields.documentationLinks({}).length,0);
});

test("functional part number is stable and displayed once, separate from the manufacturer model",()=>{
 const part={partNumber:"104",name:"LED Switching Transistor",model:"2N7000",projectDetails:{}};
 assert.equal(fields.numberedName(part),"104 · LED Switching Transistor");
 assert.equal(fields.numberedName({...part,name:"104 — LED Switching Transistor"}),"104 — LED Switching Transistor");
 assert.equal(fields.numberedName({...part,name:"104 - LED Switching Transistor"}),"104 - LED Switching Transistor");
 assert.equal(fields.numberedName({...part,name:"104 · LED Switching Transistor"}),"104 · LED Switching Transistor");
 assert.equal(fields.numberedName({...part,name:"1040 Switching Transistor"}),"104 · 1040 Switching Transistor");
 assert.equal(fields.numberedName({...part,partNumber:""}),"LED Switching Transistor");
 assert.equal(fields.numberedName({...part,projectDetails:{value:"5 V GPIO"}}),"104 · LED Switching Transistor - 5 V GPIO");
});
test("UI keeps functional number in the feature tree and BOM independent of MPN",()=>{
 const source=readFileSync(new URL("../assets/site-assembly.js",import.meta.url),"utf8");
 assert.match(source,/const firstLine=isPartNode\(node\)\?window\.BSPartFields\.numberedFunctionalName/);
 assert.match(source,/name\.textContent=window\.BSPartFields\.numberedFunctionalName\(part\)/);
 assert.match(source,/heading\.textContent=window\.BSPartFields\.numberedFunctionalName\(part\)/);
 assert.match(source,/document\.createTextNode\("Part number"\)/);
});

test("project-owned feature description is primary and selected physical item is secondary",()=>{
 const part={partNumber:"104",name:"2N7000 N-channel MOSFET",partType:"purchased",
  model:"2N7000",implementationResolved:true,implementationName:"2N7000 N-channel MOSFET",
  projectDetails:{featureTreeName:"LED Switching Transistor",workshopTreeDescription:"Workshop caption"}};
 assert.equal(fields.treeDescriptionFor(part),"LED Switching Transistor");
 assert.equal(fields.numberedFunctionalName(part),"104 · LED Switching Transistor");
 assert.equal(fields.implementationLabelFor(part),"2N7000 N-channel MOSFET");
 const swapped={...part,model:"AO3400A",implementationName:"AO3400A MOSFET",
  projectDetails:{...part.projectDetails,workshopTreeDescription:"Other Workshop label"}};
 assert.equal(fields.numberedFunctionalName(swapped),"104 · LED Switching Transistor");
 assert.equal(fields.implementationLabelFor(swapped),"AO3400A MOSFET");
 assert.equal(fields.numberedFunctionalName({...part,projectDetails:{}}),"104 · 2N7000 N-channel MOSFET");
 assert.equal(fields.treeDescriptionFor({...part,projectDetails:{workshopTreeDescription:"Workshop only"}}),"");
});
test("custom implementations and unselected components use the same project purpose label",()=>{
 const core={partNumber:"105",name:"Shaft Coupler",projectDetails:{featureTreeName:"Motor Shaft Coupling"},itemType:"part"};
 assert.equal(fields.numberedFunctionalName(core),"105 · Motor Shaft Coupling");
 assert.equal(fields.implementationLabelFor({...core,partType:"custom",implementationName:"Rigid Coupling · Rev B",implementationResolved:true}),"Rigid Coupling · Rev B");
 assert.equal(fields.implementationLabelFor({...core,implementationResolved:false}),"Part not selected");
 assert.equal(fields.numberedFunctionalName({...core,itemType:"document"}),"105 · Shaft Coupler");
});
test("feature tree reads the project caption independently of Workshop metadata",()=>{
 const site=readFileSync(new URL("../assets/site-assembly.js",import.meta.url),"utf8");
 const backend=readFileSync(new URL("../functions/api/components.js",import.meta.url),"utf8");
 assert.match(site,/numberedFunctionalName\(\{/);
 assert.match(site,/implementationLabelFor\(\{/);
 assert.match(site,/Container \(name\)/);
 assert.match(site,/const functionalTreeDescriptionField=/);
 assert.match(backend,/featureTreeName:180/);
 assert.match(backend,/featureTreeName:previous\.projectDetails\?\.featureTreeName\|\|""/);
});
