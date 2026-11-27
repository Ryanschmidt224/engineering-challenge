import {test} from "node:test";
import assert from "node:assert/strict";
import {normalizeCustomItem,normalizeOccurrence,allocatePartNumber,diffCustomItems,formatRevisionValue} from "../assets/project-item-model.js";
const part=(patch={})=>({name:"Bracket",part_number:"NR0100",fields:{specs:[{field_id:"thickness",label:"Thickness",value:3,unit:"mm"}]},...patch});
test("custom part validation keeps optional data small and never mixes occurrence fields",()=>{
 const input=part({name:" Bracket ",fields:{description:"",manufacturer:" ",specs:[]}}),original=structuredClone(input);
 assert.deepEqual(normalizeCustomItem(input),{name:"Bracket",part_number:"NR0100",short_name:"",kind:"part",source:"custom",is_tool:false,fields:{}});
 assert.deepEqual(input,original);
 for(const key of ["quantity","hidden","attention_note","supplierOffers","workshopChoice","experiments","appliedProposals"])assert.throws(()=>normalizeCustomItem(part({[key]:true})),/does not support/);
 assert.throws(()=>normalizeCustomItem(part({fields:{quantity:2}})),/does not support/);
 for(const kind of ["part","document","code"])assert.equal(normalizeCustomItem(part({kind})).kind,kind);
 for(const source of ["workshop",null,false])assert.throws(()=>normalizeCustomItem(part({source})),/Choose a custom/);
 assert.throws(()=>normalizeCustomItem(part({kind:null})),/Choose a custom/);
 assert.throws(()=>normalizeCustomItem(part({is_tool:"false"})),/true or false/);
});
test("part field boundaries reject malformed or oversized input",()=>{
 for(const input of [null,[],false,part({name:" "}),part({name:"a".repeat(181)}),part({name:"A\nB"}),part({short_name:"a".repeat(21)}),part({part_number:" "}),part({fields:null}),part({fields:{description:"x".repeat(5001)}})])assert.throws(()=>normalizeCustomItem(input));
 assert.equal(normalizeCustomItem(part({name:"a".repeat(180),short_name:"x".repeat(20),fields:{description:"a\nb",purpose:"Mount the board",acceptance:"Deflection < 1 mm",manufacturer:"Example",mpn:"A-1"}})).fields.description,"a\nb");
});
test("specification IDs and JSON types survive normalization without guessing",()=>{
 const specs=[0,false,"",null].map((value,index)=>({field_id:"field-"+index,label:"Repeated label",value,unit:""}));
 specs.push({field_id:"unset",label:"Repeated label",unit:""});
 const normalized=normalizeCustomItem(part({fields:{specs}}));
 for(let i=0;i<4;i++)assert.equal(normalized.fields.specs[i].value,specs[i].value);
 assert.equal(Object.hasOwn(normalized.fields.specs[4],"value"),false);
 assert.deepEqual(normalized.fields.specs.map(row=>row.field_id),specs.map(row=>row.field_id));
 for(const invalid of [[...specs,specs[0]],[{label:"Missing ID",value:1}],[{field_id:" field",label:"Bad ID"}],[{field_id:"a",label:""}],[{field_id:"a",label:"Bad value",value:{}}],[{field_id:"a",label:"Bad value",value:undefined}],[{field_id:"a",label:"Bad value",value:NaN}],[{field_id:"a",label:"Bad value",value:Infinity}]])assert.throws(()=>normalizeCustomItem(part({fields:{specs:invalid}})));
});
test("build quantities and flags have explicit defaults and preserve zero and attention text",()=>{
 assert.deepEqual(normalizeOccurrence(),{quantity:1,unit:"pcs",build_status:"not_started",attention:false,attention_note:"",hidden:false});
 assert.deepEqual(normalizeOccurrence({quantity:0,unit:"mm",build_status:"in_progress",attention:false,attention_note:"Keep this note",hidden:true}),{quantity:0,unit:"mm",build_status:"in_progress",attention:false,attention_note:"Keep this note",hidden:true});
 for(const input of [{quantity:-1},{quantity:null},{quantity:"2"},{quantity:NaN},{quantity:Infinity},{attention:"false"},{hidden:0},{build_status:null},{build_status:"done"},{attention_note:"x".repeat(2501)},{name:"Wrong owner"}])assert.throws(()=>normalizeOccurrence(input));
});
test("automatic numbers use project format and reserve removed numbers without renumbering",()=>{
 const reserved=["NR0100","NR0101","NR0103","nr0102","Manual-A"],copy=[...reserved];
 assert.equal(allocatePartNumber({prefix:"NR",digits:4},reserved),"NR0104");
 assert.deepEqual(reserved,copy);
 assert.equal(allocatePartNumber({},[]),"NR100");
 assert.equal(allocatePartNumber({prefix:"BB",digits:3},[]),"BB100");
 assert.equal(allocatePartNumber({prefix:"",digits:1},["100"]),"101");
 assert.equal(allocatePartNumber({prefix:"NR",digits:4},["NR0101"]),"NR0100");
 for(const input of [{digits:0},{digits:9},{digits:2.5},{digits:"4"},{prefix:"x".repeat(11)}])assert.throws(()=>allocatePartNumber(input,[]));
});
test("revision review shows only changed engineering fields, including labels and units",()=>{
 const before=part(),after=structuredClone(before);after.fields.specs[0].value=5;
 const changes=diffCustomItems(before,after);assert.equal(changes.length,1);assert.equal(changes[0].key,"spec:thickness");assert.equal(changes[0].label,"Thickness");
 assert.equal(formatRevisionValue(changes[0].before),"3 mm");assert.equal(formatRevisionValue(changes[0].after),"5 mm");
 assert.deepEqual(diffCustomItems(before,structuredClone(before)),[]);
 assert.deepEqual(diffCustomItems(part({fields:{specs:[{field_id:"zero",label:"Zero",value:-0}]}}),part({fields:{specs:[{field_id:"zero",label:"Zero",value:0}]}})),[]);
 const renamed=structuredClone(before);renamed.fields.specs[0].label="Plate thickness";assert.equal(diffCustomItems(before,renamed)[0].after.label,"Plate thickness");
 const reunit=structuredClone(before);reunit.fields.specs[0].unit="in";assert.equal(formatRevisionValue(diffCustomItems(before,reunit)[0].after),"3 in");
 assert.deepEqual(diffCustomItems(part({fields:{}}),part({fields:{description:" ",specs:[]}})),[]);
 const cleared=diffCustomItems(part({fields:{purpose:"Mount it"}}),part({fields:{purpose:""}}));assert.equal(cleared[0].after.present,false);
});
test("revision review distinguishes false, zero, empty text, null, unset and removed rows",()=>{
 const valuePart=value=>part({fields:{specs:[{field_id:"a",label:"Enabled",...(value==="UNSET"?{}:{value})}]}});
 for(const [value,label] of [[false,"No"],[0,"0"],["","Empty text"],[null,"Null"],["UNSET","Value not set"]]){
  const change=diffCustomItems(valuePart(true),valuePart(value));assert.equal(change.length,1);assert.equal(formatRevisionValue(change[0].after),label);
 }
 const removed=diffCustomItems(valuePart(false),part({fields:{}}));assert.equal(removed.length,1);assert.equal(formatRevisionValue(removed[0].after),"Not set");
 const added=diffCustomItems(part({fields:{}}),valuePart("UNSET"));assert.equal(added.length,1);assert.equal(added[0].after.label,"Enabled");
});
test("specification order uses stable IDs even with duplicate labels",()=>{
 const before=part({fields:{specs:[{field_id:"a",label:"Same",value:1},{field_id:"b",label:"Same",value:2}]}}),after=structuredClone(before);after.fields.specs.reverse();
 const changes=diffCustomItems(before,after);assert.equal(changes.length,1);assert.equal(changes[0].key,"spec-order");assert.notEqual(changes[0].before.value,changes[0].after.value);
 after.fields.specs[0].value=4;assert.deepEqual(diffCustomItems(before,after).map(change=>change.key),["spec:b","spec-order"]);
});


test("linked names persist an explicit choice and derive from Generic Part Name without a second saved source",()=>{
 const linked=normalizeCustomItem(part({name:"Stale specific text",short_name:"Power supply",fields:{name_linked:true}}));
 assert.equal(linked.name,"Power supply");assert.equal(linked.fields.name_linked,true);
 const separate=normalizeCustomItem(part({name:"DHEN1112",short_name:"Power supply",fields:{name_linked:false}}));
 assert.equal(separate.name,"DHEN1112");assert.equal(separate.fields.name_linked,false);
 assert.equal(normalizeCustomItem(part({name:"Same",short_name:"Same",fields:{name_linked:false}})).fields.name_linked,false);
 assert.throws(()=>normalizeCustomItem(part({fields:{name_linked:"false"}})),/true or false/);
 assert.throws(()=>normalizeCustomItem(part({short_name:"",fields:{name_linked:true}})),/Part Name \(Generic\) is required/);
 assert.equal(Object.hasOwn(normalizeCustomItem(part()).fields,"name_linked"),false);
 const before=part({name:"Same",short_name:"Same",fields:{name_linked:true}}),after={...before,fields:{name_linked:false}};
 assert.deepEqual(diffCustomItems(before,after).map(change=>change.key),["fields.name_linked"]);
});

test('purchased tool fields and Ordered status persist with strict validation',()=>{
 const fields={supply:'purchased',vendor:'DigiKey',supplier_number:'A-1',order_url:'https://example.com/part',individual_cost:0,bulk_cost:12,package_quantity:10};
 const value=normalizeCustomItem(part({is_tool:true,fields}));assert.equal(value.is_tool,true);assert.deepEqual(value.fields,fields);assert.equal(normalizeOccurrence({build_status:'ordered'}).build_status,'ordered');
 for(const patch of [{supply:'unknown'},{order_url:'javascript:alert(1)'},{individual_cost:-1},{bulk_cost:'12'},{package_quantity:0},{package_quantity:1.5}])assert.throws(()=>normalizeCustomItem(part({fields:{...fields,...patch}})));
});
