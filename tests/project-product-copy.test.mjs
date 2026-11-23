import {test} from "node:test";
import assert from "node:assert/strict";
import {productCopyDraft,matchingProduct} from "../assets/project-product-copy.js";

test("catalog copy includes physical identity and sourcing without project data or guessed field mapping",()=>{
 const part={id:"source",itemType:"part",partType:"purchased",name:"Project role",implementationName:"Physical resistor",model:"EX-10K",manufacturer:"Example",description:"Fit inside housing",quantity:12,partNumber:"NR100",projectDetails:{notes:"Private project notes"},specifications:[{name:"Resistance",value:"10k Ω"},{name:"Tolerance",value:0,source:"inferred"}],supplierOffers:[{vendor:"digikey",sku:"EX-ND",url:"https://www.digikey.com/example"}],photoRevision:"photo",implementations:[{name:"Old alternative"}]};
 const before=structuredClone(part),copy=productCopyDraft(part,"family","new");
 assert.deepEqual(copy,{id:"new",family_id:"family",name:"Physical resistor",manufacturer:"Example",mpn:"EX-10K",supplier_links:[{supplier:"digikey",part_number:"EX-ND",url:"https://www.digikey.com/example"}],field_values:{},notes:"Copied specifications — review and enter applicable family fields:\nResistance: 10k Ω\nTolerance: 0 (inferred)"});
 assert.deepEqual(part,before);
 for(const invalid of [{...part,partType:"custom"},{...part,itemType:"document"},{...part,familyUse:true},{...part,generatedFrom:"wire"}])assert.throws(()=>productCopyDraft(invalid,"family"),/off-the-shelf/);
});
test("duplicate hint compares active family product MPN and manufacturer without merging anything",()=>{
 const record={family_id:"family",mpn:" EX-10K ",manufacturer:"Example"},product={id:"existing",family_id:"family",mpn:"ex-10k",manufacturer:"EXAMPLE",archived:0};
 assert.equal(matchingProduct([product],record),product);
 for(const changed of [{archived:1},{family_id:"other"},{manufacturer:"Another company"},{mpn:"EX-20K"}])assert.equal(matchingProduct([{...product,...changed}],record),null);
 assert.equal(matchingProduct([product],{...record,mpn:""}),null);
});
