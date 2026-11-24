import {test} from "node:test";
import assert from "node:assert/strict";
import {legacyRecordContext,recordedPart} from "../assets/project-record-context.js";
test("legacy context preserves a known tested level without inventing an unknown one",()=>{
 const item={id:"saved-part",revision_level:4},occurrence={root:{id:"saved-root",name:"Original root"},build_status:"complete"};
 assert.deepEqual(legacyRecordContext({format:1,item,occurrence}),{format:1,project:occurrence.root,occurrence,legacy:true,part:{id:item.id,revision_level:4}});
 assert.equal(legacyRecordContext({format:1,item:{id:item.id},occurrence}).part,undefined);assert.equal(legacyRecordContext({format:2,item}),null);assert.equal(recordedPart({id:item.id,revision_level:0}),null);
});
