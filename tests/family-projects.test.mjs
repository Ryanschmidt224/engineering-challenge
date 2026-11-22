import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import worker from "../worker.js";
import {TestD1} from "./helpers/d1.mjs";
import {TestR2} from "./helpers/r2.mjs";
import {provisionTestAccount} from "./helpers/accounts.mjs";

const context={module:{exports:{}}};runInNewContext(readFileSync("assets/bom-model.js","utf8"),context);const bom=context.module.exports;
async function fixture(t){
 const env={WORKSHOP_DB:new TestD1(),PHOTOS:new TestR2(),admin_password:"disposable-family-test-secret"};t.after(()=>env.WORKSHOP_DB.close());
 const origin="https://family-project.example.test",login=await provisionTestAccount(new Request(origin+"/api/accounts",{method:"POST",headers:{origin},body:JSON.stringify({action:"register",email:"owner@example.test",password:"disposable-family-test-password"})}),env,{role:"admin"});
 const cookie=login.headers.get("set-cookie").split(";")[0];
 const call=(path,method="GET",body)=>worker.fetch(new Request(origin+path,{method,headers:{origin,cookie},...(body===undefined?{}:{body:JSON.stringify(body)})}),env,{});
 const catalog=await(await call("/api/workshop")).json();
 const use={id:crypto.randomUUID(),project_id:"launcher",tree_node_id:null,family_id:"f-resistor",product_id:null,purpose:"Pull-up resistor",quantity:2,unit:"pcs",field_values:{"f-resistor-resistance":10000},notes:""};
 const save=(entity,record,expectedRevision=null)=>call("/api/workshop","POST",{entity,record,expectedRevision,expectedFamilyRevision:1});
 return {env,call,catalog,use,save};
}
test("D1 uses retain instructions, history and engineering files when selecting and editing products",async t=>{
 const {env,call,use,save}=await fixture(t);assert.equal((await save("use",use)).status,200);
 const workspace="/api/workspace?project=launcher&part="+use.id;
 assert.equal((await call(workspace,"PUT",{recipe:[{id:"step-a",title:"Measure before installing",tileOrder:[]}],expectedRevision:null})).status,200);
 const instructions=await(await env.PHOTOS.get("part-workspaces/launcher/"+use.id+".json")).text();
 let history=await call("/api/investigations?project=launcher","POST",{action:"create",scope:"part",ownerType:"part",ownerId:use.id,title:"Measurement before selection",category:"note",description:"Measured 10k",photos:[],entries:[],notes:[]});
 assert.equal(history.status,200,await history.clone().text());
 const evidence=await(await env.PHOTOS.get("investigations/launcher.json")).text();
 const product={id:crypto.randomUUID(),family_id:use.family_id,name:"Selected resistor",manufacturer:"Example",mpn:"R-10K",supplier_links:[],field_values:{"f-resistor-resistance":10000},notes:""};
 assert.equal((await save("product",product)).status,200);use.product_id=product.id;assert.equal((await save("use",use,1)).status,200);
 product.field_values["f-resistor-resistance"]=12000;assert.equal((await save("product",product,1)).status,200);
 const parts=await(await call("/api/components?project=launcher")).json(),part=parts.components.find(part=>part.id===use.id);
 assert.match(part.specifications.find(field=>field.name==="Resistance").value,/12000 Ω.*10000 Ω/);
 assert.equal(await(await env.PHOTOS.get("part-workspaces/launcher/"+use.id+".json")).text(),instructions);
 assert.equal(await(await env.PHOTOS.get("investigations/launcher.json")).text(),evidence);
 assert.equal((await call("/api/part-files?project=launcher&id="+use.id)).status,200);
 assert.equal((await call("/api/drawings?project=launcher&type=part&id="+use.id)).status,200);
 assert.equal((await call("/api/part-pages?project=launcher&id="+use.id)).status,200);
 const patch=await call("/api/components?project=launcher&id="+use.id,"PATCH",{expectedRevision:part.revision,progressStatus:"complete",quantity:0});assert.equal(patch.status,200);
 assert.equal((await call("/api/components?project=launcher&id="+use.id,"PATCH",{expectedRevision:part.revision,quantity:5})).status,409);
 const catalog=await(await call("/api/workshop")).json();assert.equal(catalog.uses[0].field_values["f-resistor-resistance"],10000);assert.equal(catalog.products[0].field_values["f-resistor-resistance"],12000);
});
test("project tree membership follows D1 archive/restore and assembly placement without copying use records",async t=>{
 const {env,call,use,save}=await fixture(t),assembly=crypto.randomUUID();
 await env.PHOTOS.put("trees/launcher.json",JSON.stringify([{id:assembly,kind:"assembly",name:"Control board",parentId:null,quantity:3}]));
 use.tree_node_id=assembly;assert.equal((await save("use",use)).status,200);
 let tree=await(await call("/api/tree?project=launcher")).json();assert.equal(tree.nodes.find(node=>node.partId===use.id).parentId,assembly);
 assert.equal((await call("/api/assembly-archive?project=launcher","POST",{action:"archive",nodeId:assembly,expectedRevision:tree.revision})).status,409);
 assert.equal((await call("/api/components?project=launcher&id="+use.id,"PATCH",{expectedRevision:"1",assemblyId:null})).status,200);
 tree=await(await call("/api/tree?project=launcher")).json();assert.equal(tree.nodes.find(node=>node.partId===use.id).parentId,null);
 // Simulate a previously saved projection; archived uses must not reappear.
 await env.PHOTOS.put("trees/launcher.json",JSON.stringify(tree.nodes));
 assert.equal((await call("/api/workshop","PATCH",{entity:"use",id:use.id,expectedRevision:2,archived:true})).status,200);
 assert.equal((await(await call("/api/tree?project=launcher")).json()).nodes.some(node=>node.partId===use.id),false);
 assert.equal((await call("/api/workshop","PATCH",{entity:"use",id:use.id,expectedRevision:3,archived:false})).status,200);
 assert.equal((await(await call("/api/tree?project=launcher")).json()).nodes.filter(node=>node.partId===use.id).length,1);
 assert.equal(await env.PHOTOS.get("components/launcher.json"),null);
});
test("family grouping distinguishes requirements, false, zero and units; nested quantities preserve use identities",()=>{
 const part={id:"a",familyUse:true,familyId:"resistor",productId:null,quantity:2,quantityUnit:"pcs",familyValues:{ohms:10000,enabled:false,offset:0},assemblyId:"inner"};
 const copy={...part,id:"b",name:"Different project purpose",familyValues:{offset:0,ohms:10000,enabled:false}};
 assert.equal(bom.familyIdentity(part),bom.familyIdentity(copy));
 for(const changed of [{familyValues:{ohms:1000}},{quantityUnit:"m"},{productId:"another"},{familyValues:{ohms:10000,enabled:null,offset:0}}])assert.notEqual(bom.familyIdentity(part),bom.familyIdentity({...part,...changed}));
 assert.equal(bom.projectQuantity(part,[{id:"outer",parentId:null,quantity:2},{id:"inner",parentId:"outer",quantity:3}]),12);
 assert.equal(part.quantity,2);assert.equal(copy.id,"b");
});
test("retired Workshop write APIs return 410 and new routes retain the owner boundary",async t=>{
 const {env,call}=await fixture(t);
 for(const path of ["workshop-reference","personal-workshop","workshop-templates","commonparts","purchased-parts","workshop-photo","workshop-image-import"]){
  assert.equal((await call("/api/"+path,"POST",{})).status,410,path);
  assert.equal((await worker.fetch(new Request("https://family-project.example.test/api/"+path),env,{})).status,401,path);
 }
 for(const path of ["workshop","workshop/file?id=missing","workshop/export"])assert.equal((await worker.fetch(new Request("https://family-project.example.test/api/"+path),env,{})).status,401,path);
});
