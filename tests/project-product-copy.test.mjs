import {test} from "node:test";
import assert from "node:assert/strict";
import {productCopyDraft,matchingProduct} from "../assets/project-product-copy.js";

test("engine product draft copies physical fields and units without project context",()=>{
 const item={id:"part",kind:"part",name:"Power module",part_number:"BB100",fields:{manufacturer:"Acme",mpn:"AC12",purpose:"Private purpose",specs:[{label:"Voltage",value:12,unit:"V"}]},revision_level:4},before=structuredClone(item),draft=productCopyDraft(item,"family","new");
 assert.equal(draft.name,"AC12");assert.equal(draft.manufacturer,"Acme");assert.match(draft.notes,/Voltage: 12 V/);assert.doesNotMatch(JSON.stringify(draft),/Private purpose|BB100|revision/);assert.deepEqual(item,before);assert.throws(()=>productCopyDraft({...item,is_assembly:1},"family"),/off-the-shelf/);
});

test("current part copy requires a part identity and never mutates project context",()=>{
 const item={id:"source",kind:"part",name:"Physical resistor",part_number:"NR100",fields:{manufacturer:"Example",mpn:"EX-10K",purpose:"Private role",specs:[{label:"Resistance",value:10000,unit:"Ω"},{label:"Offset",value:0}]},quantity:12};
 const before=structuredClone(item),copy=productCopyDraft(item,"family","new");
 assert.equal(copy.name,"EX-10K");assert.equal(copy.mpn,"EX-10K");assert.match(copy.notes,/Offset: 0/);assert.deepEqual(copy.field_values,{});assert.deepEqual(item,before);assert.doesNotMatch(JSON.stringify(copy),/Private role|NR100|quantity/);
 for(const kind of ["document","code"])assert.throws(()=>productCopyDraft({...item,kind},"family"),/off-the-shelf/);
});
test("duplicate hint compares active family product MPN and manufacturer without merging anything",()=>{
 const record={family_id:"family",mpn:" EX-10K ",manufacturer:"Example"},product={id:"existing",family_id:"family",mpn:"ex-10k",manufacturer:"EXAMPLE",archived:0};
 assert.equal(matchingProduct([product],record),product);
 for(const changed of [{archived:1},{family_id:"other"},{manufacturer:"Another company"},{mpn:"EX-20K"}])assert.equal(matchingProduct([{...product,...changed}],record),null);
 assert.equal(matchingProduct([product],{...record,mpn:""}),null);
});
