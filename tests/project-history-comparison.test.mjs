import {test} from "node:test";
import assert from "node:assert/strict";
import {fixture} from "./helpers/project-workspace.mjs";
import {comparisonRows} from "../assets/project-history-comparison.js";
import {formatRevisionValue} from "../assets/project-item-model.js";
test("History compares frozen part and instruction content against working fields without changing saved evidence",async()=>{
 const f=await fixture();try{
  const scope=(await f.call("/items/"+f.itemId+"/steps","POST",{title:"Clamp",body:"Soft jaws"})).result.stepId,record=(await f.call("/items/"+f.itemId+"/records","POST",{stepId:scope,record:{type:"test",fields:{result:"0.2 ohm"}}})).result.recordId;
  const instruction=(await f.call("/steps/"+scope+"/revisions","POST")).result.eventId,part=(await f.call("/items/"+f.itemId+"/revisions","POST")).result.eventId;
  const oldScope=(await f.call("/history/"+instruction)).result.event.payload.snapshot,oldPart=(await f.call("/history/"+part)).result.event.payload.snapshot;
  await f.call("/steps/"+scope,"PATCH",{body:"Torque wrench"});await f.call("/records/"+record,"PATCH",{record:{type:"test",fields:{result:"0.3 ohm"}}});
  const details={...structuredClone(f.details),part_number:oldPart.item.part_number};details.fields.specs.find(row=>row.field_id==="zero").value=5;details.fields.specs.find(row=>row.field_id==="false").value=true;details.fields.specs.find(row=>row.field_id==="empty").value=null;
  const save=await f.call("/items/"+f.itemId,"PATCH",{details});assert.equal(save.status,200,JSON.stringify(save));const current=(await f.call("/state")).result,rows=comparisonRows(oldPart,current);
  assert.equal(formatRevisionValue(rows.find(row=>row.label==="Offset").before),"0");assert.equal(formatRevisionValue(rows.find(row=>row.label==="Coated").before),"No");assert.equal(formatRevisionValue(rows.find(row=>row.label==="Coated").after),"Yes");assert.equal(formatRevisionValue(rows.find(row=>row.label==="Finish").before),"Empty text");assert.equal(formatRevisionValue(rows.find(row=>row.label==="Finish").after),"Null");
  const scopeRows=comparisonRows(oldScope,current);assert.ok(scopeRows.some(row=>row.label.endsWith("Instructions")&&row.before.value==="Soft jaws"&&row.after.value==="Torque wrench"));assert.ok(scopeRows.some(row=>row.label.endsWith("Result")&&row.before.value==="0.2 ohm"&&row.after.value==="0.3 ohm"));
  assert.deepEqual((await f.call("/history/"+instruction)).result.event.payload.snapshot,oldScope);assert.deepEqual((await f.call("/history/"+part)).result.event.payload.snapshot,oldPart);
 }finally{f.db.close();}
});
