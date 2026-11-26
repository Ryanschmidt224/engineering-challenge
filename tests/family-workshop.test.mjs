import test from "node:test";
import assert from "node:assert/strict";
import {TestD1} from "./helpers/d1.mjs";
import {provisionTestAccount} from "./helpers/accounts.mjs";
import {initializeWorkshop,workshopSnapshot,saveFamily,handleFamilyWorkshop} from "../functions/api/workshop-db.js";
import {resolveFamilyValues} from "../assets/family-model.js";

class Bucket {
 objects=new Map();
 async put(key,value){this.objects.set(key,value);return {etag:crypto.randomUUID()};}
 async get(key){const value=this.objects.get(key);return value===undefined?null:{text:async()=>value,json:async()=>JSON.parse(value)};}
}
async function setup(t,role="admin") {
 const env={WORKSHOP_DB:new TestD1(),PHOTOS:new Bucket(),admin_password:"synthetic-test-secret"};t.after(()=>env.WORKSHOP_DB.close());
 const origin="https://workshop.example.test";
 const response=await provisionTestAccount(new Request(origin+"/api/accounts",{method:"POST",headers:{origin},body:JSON.stringify({action:"register",email:role+"@example.test",password:"synthetic-long-password"})}),env,{role});
 const cookie=response.headers.get("set-cookie").split(";")[0];
 const call=(method="GET",body,requestOrigin=origin)=>handleFamilyWorkshop(new Request(origin+"/api/workshop",{method,headers:{origin:requestOrigin,cookie},...(body?{body:JSON.stringify(body)}:{})}),env);
 return {env,call};
}
const familyDraft=(snapshot,id)=>({...snapshot.families.find(f=>f.id===id),fields:snapshot.fields.filter(f=>f.family_id===id)});
test("clean D1 bootstrapping seeds only the approved categories, families and definitions once",async t=>{
 const {env,call}=await setup(t);const initial=await (await call()).json();
 assert.equal(initial.categories.length,33);assert.equal(initial.families.length,60);assert.equal(initial.fields.length,432);
 assert.deepEqual(initial.products,[]);assert.deepEqual(initial.uses,[]);assert.deepEqual(initial.attachments,[]);
 env.WORKSHOP_DB.sqlite.exec("UPDATE workshop_families SET name='Owner edited resistor' WHERE id='f-resistor'");
 const second=new TestD1(env.WORKSHOP_DB.sqlite);await initializeWorkshop(second);
 assert.equal((await workshopSnapshot(second)).families.find(f=>f.id==="f-resistor").name,"Owner edited resistor");
 assert.equal((await workshopSnapshot(second)).fields.length,432);
});
test("stale family writes cannot rename or hide definitions through a successful dependent batch",async t=>{
 const {env,call}=await setup(t);const initial=await (await call()).json(),draft=familyDraft(initial,"f-resistor");
 const first=structuredClone(draft);first.fields[0].label="Required resistance";
 assert.equal((await call("POST",{entity:"family",record:first,expectedRevision:draft.revision})).status,200);
 const stale={...draft,name:"Stale name",fields:[]};
 assert.equal((await call("POST",{entity:"family",record:stale,expectedRevision:draft.revision})).status,409);
 const current=await workshopSnapshot(env.WORKSHOP_DB);
 assert.equal(current.families.find(f=>f.id==="f-resistor").name,"Resistor");
 assert.equal(current.fields.find(f=>f.id===first.fields[0].id).label,"Required resistance");
 assert.equal(current.fields.filter(f=>f.family_id==="f-resistor"&&f.hidden).length,0);
});
test("populated field contract failures roll back the family revision and all prior field changes",async t=>{
 const {env,call}=await setup(t);const initial=await (await call()).json(),family=familyDraft(initial,"f-resistor"),field=family.fields[0];
 const product={id:crypto.randomUUID(),family_id:family.id,name:"Specific resistor",field_values:{[field.id]:0},supplier_links:[]};
 assert.equal((await call("POST",{entity:"product",record:product,expectedRevision:null,expectedFamilyRevision:family.revision})).status,200);
 const edited=structuredClone(family);edited.name="Should roll back";edited.fields[0].unit="kΩ";
 assert.equal((await call("POST",{entity:"family",record:edited,expectedRevision:family.revision})).status,409);
 const after=await workshopSnapshot(env.WORKSHOP_DB);
 assert.equal(after.families.find(f=>f.id===family.id).revision,family.revision);assert.equal(after.fields.find(f=>f.id===field.id).unit,"Ω");
 const hidden=structuredClone(family);hidden.fields=[];assert.ok(await saveFamily(env.WORKSHOP_DB,hidden,family.revision));
 assert.equal((await workshopSnapshot(env.WORKSHOP_DB)).products[0].field_values[field.id],0);
});
test("D1 foreign keys reject a selected product from another family and cycles in categories",async t=>{
 const {env,call}=await setup(t);await call();
 const product={id:crypto.randomUUID(),family_id:"f-resistor",name:"Specific resistor",field_values:{},supplier_links:[]};
 assert.equal((await call("POST",{entity:"product",record:product,expectedRevision:null,expectedFamilyRevision:2})).status,200);
 const use={id:crypto.randomUUID(),project_id:"launcher",family_id:"f-dc-power-supply",product_id:product.id,purpose:"Wrong family",quantity:null,unit:"pcs",field_values:{}};
 assert.equal((await call("POST",{entity:"use",record:use,expectedRevision:null,expectedFamilyRevision:1})).status,400);
 assert.throws(()=>env.WORKSHOP_DB.sqlite.prepare("INSERT INTO workshop_uses(id,project_id,family_id,product_id) VALUES('bad','launcher','f-dc-power-supply',?)").run(product.id),/FOREIGN KEY/);
 const snapshot=await workshopSnapshot(env.WORKSHOP_DB),parent=snapshot.categories.find(c=>!c.parent_id),child=snapshot.categories.find(c=>c.parent_id===parent.id);
 assert.equal((await call("POST",{entity:"category",record:{...parent,parent_id:child.id},expectedRevision:1})).status,400);
});
test("owner boundary, stale family-schema guards, archive and restore are enforced",async t=>{
 const member=await setup(t,"member");assert.equal((await member.call()).status,401);
 const {env,call}=await setup(t);const snapshot=await (await call()).json(),family=familyDraft(snapshot,"f-resistor");
 assert.equal((await call("POST",{entity:"family",record:family,expectedRevision:family.revision},"https://other.example.test")).status,403);
 await saveFamily(env.WORKSHOP_DB,family,family.revision);
 assert.equal((await call("POST",{entity:"product",record:{id:crypto.randomUUID(),family_id:family.id,name:"Stale draft",supplier_links:[],field_values:{}},expectedRevision:null,expectedFamilyRevision:family.revision})).status,409);
 assert.equal((await call("PATCH",{entity:"family",id:family.id,archived:true,expectedRevision:family.revision+1})).status,200);
 assert.equal((await call("PATCH",{entity:"family",id:family.id,archived:false,expectedRevision:family.revision+1})).status,409);
 assert.equal((await call("PATCH",{entity:"family",id:family.id,archived:false,expectedRevision:family.revision+2})).status,200);
});
test("value precedence preserves zero and false; hints do not impose value ownership",()=>{
 const fields=[{id:"a",hidden:0,filled_on_use:1},{id:"b",hidden:0},{id:"c",hidden:1}];
 const rows=resolveFamilyValues(fields,{a:0,b:false,c:123},{a:12,b:true});
 assert.equal(rows.length,2);assert.equal(rows[0].value,0);assert.equal(rows[1].value,false);assert.equal(rows[1].different,true);
});
