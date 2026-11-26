import {test} from "node:test";
import assert from "node:assert/strict";
import {fixture as projectFixture} from "./helpers/project-workspace.mjs";
import {provisionTestAccount} from "./helpers/accounts.mjs";
import {accountUser} from "../functions/api/accounts.js";
import {initializeWorkshop} from "../functions/api/workshop-db.js";
import {resolveTargets,key} from "../functions/api/knowledge-targets.js";
import {targetHref} from "../assets/knowledge-model.js";
import worker from "../worker.js";
const origin="https://knowledge.example.test",id=()=>crypto.randomUUID();
async function fixture(t){
 const f=await projectFixture();t.after(()=>f.db.close());f.env.NEW_PROJECT_ENGINE="1";f.env.admin_password="synthetic-knowledge-secret";
 const login=await provisionTestAccount(new Request(origin+"/api/accounts",{method:"POST",headers:{origin},body:JSON.stringify({action:"register",email:"knowledge-owner@example.test",password:"synthetic-knowledge-password"})}),f.env,{role:"admin"}),cookie=login.headers.get("set-cookie").split(";")[0];
 const owner=await accountUser(new Request(origin,{headers:{cookie}}),f.env);
 await f.db.prepare("UPDATE engine_projects SET owner_id=? WHERE id=?").bind(owner.id,f.projectId).run();f.owner.id=owner.id;
 await initializeWorkshop(f.db);
 const config=await f.db.prepare("SELECT id FROM engine_configurations WHERE project_id=? AND item_id=? LIMIT 1").bind(f.projectId,f.itemId).first(),recordId=id(),now=new Date().toISOString();
 await f.db.prepare("INSERT INTO engine_records(id,project_id,item_id,configuration_id,type,title,fields,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)").bind(recordId,f.projectId,f.itemId,config.id,"note","Bench result",JSON.stringify({note:"A measured result"}),now,now).run();
 const call=(path,method="GET",body)=>worker.fetch(new Request(origin+path,{method,headers:{origin,cookie},...(method!=="GET"?{body:JSON.stringify(body)}:{})}),f.env,{});
 const resolve=wanted=>resolveTargets(f.env,f.db,wanted,owner.id);
 return {...f,owner,call,resolve,recordId};
}
test("Info Bits resolve large duplicate catalogs within D1 parameter limits",async t=>{
 const f=await fixture(t);for(let n=0;n<350;n++)await f.db.prepare("INSERT INTO workshop_families(id,name,archived) VALUES(?,?,?)").bind("boundary-"+n,"Family "+n,n===349?1:0).run();
 const wanted=Array.from({length:350},(_,n)=>({target_type:"family",target_id:"boundary-"+n}));wanted.push(wanted[0],{target_type:"family",target_id:"missing"});
 const found=await f.resolve(wanted);assert.equal(found.size,351);assert.equal(found.get(key(wanted[349])).state,"archived");assert.equal(found.get(key(wanted.at(-1))).state,"missing");assert.equal(found.get(key(wanted[0])).name,"Family 0");
});
test("current projects, scoped parts and records resolve without R2 project readers",async t=>{
 const f=await fixture(t),wanted=[{target_type:"project",target_id:f.projectId},{target_type:"use",target_project_id:f.projectId,target_id:f.itemId},{target_type:"record",target_project_id:f.projectId,target_id:f.recordId}];
 const result=await f.resolve(wanted);for(const target of wanted)assert.equal(result.get(key(target)).state,"available");assert.equal(result.get(key(wanted[2])).row.item_id,f.itemId);
 assert.equal(targetHref(wanted[0]),"project.html?project="+f.projectId);assert.equal(new URL(targetHref({...wanted[2],target_item_id:f.itemId}),origin).searchParams.get("item"),f.itemId);
 const other=await resolveTargets(f.env,f.db,wanted,"another-owner");for(const row of other.values())assert.equal(row.state,"missing");
 const wrong=[{...wanted[1],target_project_id:id()},{...wanted[2],target_project_id:id()}];for(const row of (await f.resolve(wrong)).values())assert.equal(row.state,"missing");
});
test("the Info Bits API persists current part and record links with their project scope",async t=>{
 const f=await fixture(t),tile=id();let response=await f.call("/api/knowledge","POST",{entity:"tile",expectedRevision:null,record:{id:tile,title:"Power test",summary:"Measured on the bench",body:"",sources:[],type:"lesson",status:"draft"}});assert.equal(response.status,200,await response.clone().text());
 for(const [type,target] of [["project",f.projectId],["use",f.itemId],["record",f.recordId]]){
  response=await f.call("/api/knowledge","POST",{entity:"link",expectedRevision:null,record:{id:id(),tile_id:tile,target_type:type,target_id:target,target_project_id:type==="project"?null:f.projectId,relation:"see_also"}});assert.equal(response.status,200,await response.clone().text());
 }
 const snapshot=await(await f.call("/api/knowledge")).json();assert.equal(snapshot.links.length,3);assert.ok(snapshot.links.every(row=>row.target_state==="available"));assert.equal(snapshot.links.find(row=>row.target_type==="record").target_item_id,f.itemId);
});
test("archived parts and retired project IDs remain unavailable rather than being remapped",async t=>{
 const f=await fixture(t),wanted=[{target_type:"use",target_project_id:f.projectId,target_id:f.itemId},{target_type:"project",target_id:"launcher"},{target_type:"record",target_project_id:"launcher",target_id:f.recordId}];
 await f.db.prepare("UPDATE engine_occurrences SET removed_at=?,removed_path=? WHERE project_id=? AND item_id=?").bind(new Date().toISOString(),"[]",f.projectId,f.itemId).run();
 const found=await f.resolve(wanted);assert.equal(found.get(key(wanted[0])).state,"archived");assert.equal(found.get(key(wanted[1])).state,"missing");assert.equal(found.get(key(wanted[2])).state,"missing");
});

test("untitled current records retain a usable link label",async t=>{
 const f=await fixture(t);await f.db.prepare("UPDATE engine_records SET title='' WHERE project_id=? AND id=?").bind(f.projectId,f.recordId).run();
 const target={target_type:"record",target_project_id:f.projectId,target_id:f.recordId},found=await f.resolve([target]);
 assert.equal(found.get(key(target)).name,"Untitled record");assert.equal(found.get(key(target)).state,"available");
});
