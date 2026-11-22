import {provisionTestAccount} from "./helpers/accounts.mjs";
import {test} from "node:test";
import assert from "node:assert/strict";
import {handleAccounts} from "../functions/api/accounts.js";
import {isAdmin,auth} from "../functions/api/auth.js";
import {onRequest as projectsApi,projectAllowed,canEditProject} from "../functions/api/projects.js";
import {handleTree} from "../functions/api/tree.js";
import {handleComponents} from "../functions/api/components.js";
import {handleProposals} from "../functions/api/proposals.js";
const ORIGIN="https://schmidt.example";
class Bucket{
 constructor(){this.data=new Map();this.deletes=[]}
 async get(key){const entry=this.data.get(key);if(!entry)return null;return {etag:entry.etag,async text(){return typeof entry.value==="string"?entry.value:JSON.stringify(entry.value)}}}
 async put(key,value,opts={}){
  const existing=this.data.get(key);
  const cond=opts.onlyIf;
  if(cond?.etagDoesNotMatch==="*"&&existing)return null;
  if(cond?.etagMatches&&existing?.etag!==cond.etagMatches)return null;
  const etag=crypto.randomUUID();
  this.data.set(key,{value,etag});return {etag};
 }
 async delete(key){this.deletes.push(key);this.data.delete(key)}
}
const request=(path,method="GET",body,cookie)=>new Request(ORIGIN+path,{method,headers:{
 ...(body?{"content-type":"application/json"}:{}),
 ...(method!=="GET"?{origin:ORIGIN}:{}),
 ...(cookie?{cookie}:{}),
 },...(body?{body:JSON.stringify(body)}:{})});
const read=async response=>({status:response.status,data:await response.json()});
const cookie=response=>response.headers.get("set-cookie")?.split(";")[0];
test("ownership hides private projects, preserves archives, and gates writes",async()=>{
 const env={PHOTOS:new Bucket(),admin_password:"test-separate-administrator-secret"};
 const a=await provisionTestAccount(request("/api/accounts","POST",{action:"register",email:"one@example.test",password:"one-strong-test-password"}),env);
 const b=await provisionTestAccount(request("/api/accounts","POST",{action:"register",email:"two@example.test",password:"two-strong-test-password"}),env);
 assert.equal(a.status,201);assert.equal(b.status,201);
 const owner=cookie(a),other=cookie(b);
 const created=await projectsApi({request:request("/api/projects","POST",{name:"Private stepper design",description:"Personal prototype"},owner),env});
 assert.equal(created.status,200);
 const id=(await created.json()).projects.find(p=>p.name==="Private stepper design").id;
 assert.match(id,/^p[a-f0-9]{32}$/);
 const ownerRequest=request("/api/tree?project="+id,"GET",undefined,owner);
 const outsiderRequest=request("/api/tree?project="+id,"GET",undefined,other);
 assert.equal(await projectAllowed(env,id,ownerRequest),true);
 assert.equal(await projectAllowed(env,id,outsiderRequest),false);
 assert.equal(await canEditProject(ownerRequest,env,id),true);
 assert.equal(await canEditProject(outsiderRequest,env,id),false);
 assert.equal((await handleTree(ownerRequest,env)).status,200);
 assert.equal((await handleTree(outsiderRequest,env)).status,400);
 assert.equal((await handleComponents(request("/api/components?project="+id,"GET",undefined,other),env)).status,400);
 const otherListing=await projectsApi({request:request("/api/projects","GET",undefined,other),env});
 assert.equal((await otherListing.json()).projects.some(p=>p.id===id),false);
 assert.equal((await handleTree(request("/api/tree?project="+id,"PUT",{nodes:[]},other),env)).status,400);
 const published=await projectsApi({request:request("/api/projects","PATCH",{id,visibility:"public",editMode:"approval"},owner),env});
 assert.equal(published.status,200);
 assert.equal(await projectAllowed(env,id,outsiderRequest),true);
 assert.equal(await canEditProject(outsiderRequest,env,id),false);
 const recipe=[{id:"step1",title:"Solder contacts",tileOrder:[]}];
 await env.PHOTOS.put("workspaces/"+id+"/__root__.json",JSON.stringify({recipe,resources:{tools:[],parts:[],calculators:[]},revision:"r1",history:[]}));
 const proposed=await handleProposals(request("/api/proposals?project="+id,"POST",{
  scope:"assembly",targetId:"__root__",stepId:"step1",field:"title",suggestedText:"Solder contacts at the manufacturer specified temperature"
 },other),env);
 assert.equal(proposed.status,201);
 const proposalId=(await proposed.json()).proposal.id;
 const unapproved=JSON.parse(await (await env.PHOTOS.get("workspaces/"+id+"/__root__.json")).text());
 assert.equal(unapproved.recipe[0].title,"Solder contacts");
 assert.equal((await handleProposals(request("/api/proposals?project="+id,"PATCH",{id:proposalId,action:"approve"},other),env)).status,403);
 assert.equal((await handleProposals(request("/api/proposals?project="+id,"PATCH",{id:proposalId,action:"approve"},owner),env)).status,200);
 const after=JSON.parse(await (await env.PHOTOS.get("workspaces/"+id+"/__root__.json")).text());
 assert.equal(after.recipe[0].title,"Solder contacts at the manufacturer specified temperature");
 assert.equal(after.history.at(-1).recipe[0].title,"Solder contacts");
 assert.equal((await projectsApi({request:request("/api/projects","PATCH",{id,editMode:"locked"},owner),env})).status,200);
 assert.equal((await handleProposals(request("/api/proposals?project="+id,"POST",{
  scope:"assembly",targetId:"__root__",stepId:"step1",field:"title",suggestedText:"Change again"
 },other),env)).status,403);
 assert.equal((await projectsApi({request:request("/api/projects","DELETE",{id,confirmName:"incorrect"},owner),env})).status,400);
 assert.equal((await projectsApi({request:request("/api/projects","DELETE",{id,confirmName:"Private stepper design"},owner),env})).status,200);
 assert.equal(await projectAllowed(env,id,ownerRequest),false);
 assert.equal(env.PHOTOS.deletes.length,0);
 assert.ok(await env.PHOTOS.get("workspaces/"+id+"/__root__.json"));
 assert.equal((await projectsApi({request:request("/api/projects","PATCH",{id,action:"restore"},owner),env})).status,200);
 assert.equal(await projectAllowed(env,id,ownerRequest),true);
});


test("part progress and attention notes are editable only by the project owner",async()=>{
 const env={PHOTOS:new Bucket(),admin_password:"test-part-status-signing-secret"};
 const register=await provisionTestAccount(request("/api/accounts","POST",{action:"register",email:"status-owner@example.test",password:"strong-project-password"}),env);
 const owner=cookie(register);
 const created=await projectsApi({request:request("/api/projects","POST",{name:"Progress test project"},owner),env});
 const project=(await created.json()).projects.find(p=>p.name==="Progress test project").id;
 const id="33333333-3333-4333-8333-333333333333";
 await env.PHOTOS.put("components/"+project+".json",JSON.stringify([{id,name:"Motor Mount",partType:"custom",quantity:2,quantityUnit:"pcs",specifications:[]}]));
 const endpoint="/api/components?project="+project+"&id="+id;
 const invalid=await handleComponents(request(endpoint,"PATCH",{needsAttention:true,attentionNote:""},owner),env);
 assert.equal(invalid.status,400);
 const saved=await handleComponents(request(endpoint,"PATCH",{progressStatus:"in_progress",needsAttention:true,attentionNote:"Hole locations need rechecking"},owner),env);
 assert.equal(saved.status,200);
 const part=(await saved.json()).component;
 assert.equal(part.progressStatus,"in_progress");assert.equal(part.needsAttention,true);
 assert.equal(part.attentionNote,"Hole locations need rechecking");
 const forbidden=await handleComponents(request(endpoint,"PATCH",{progressStatus:"complete",needsAttention:false}),env);
 assert.notEqual(forbidden.status,200);
 const final=await handleComponents(request(endpoint,"PATCH",{progressStatus:"complete",needsAttention:false,expectedRevision:part.revision},owner),env);
 assert.equal(final.status,200);
 const components=await handleComponents(request("/api/components?project="+project,"GET",undefined,owner),env);
 assert.equal((await components.json()).components[0].progressStatus,"complete");
});

test("Projects share one catalog with custom categories and no legacy mini project type",async()=>{
 const env={PHOTOS:new Bucket(),admin_password:"test-category-project-secret"};
 const response=await provisionTestAccount(request("/api/accounts","POST",{
  action:"register",email:"categories@example.test",password:"a-strong-category-password"
 }),env);
 assert.equal(response.status,201);
 const owner=cookie(response);
 const created=await projectsApi({request:request("/api/projects","POST",{
  name:"Small prototype",kind:"mini",category:"Electronics",description:"Test a control circuit"
 },owner),env});
 assert.equal(created.status,200);
 const project=(await created.json()).projects.find(p=>p.name==="Small prototype");
 assert.equal(project.kind,"project");
 assert.equal(project.category,"Electronics");
 assert.ok(Number.isFinite(Date.parse(project.createdAt)));
 const changed=await projectsApi({request:request("/api/projects","PATCH",{
  id:project.id,category:"Automation"
 },owner),env});
 assert.equal(changed.status,200);
 assert.equal((await changed.json()).projects.find(p=>p.id===project.id).category,"Automation");
 const stored=JSON.parse(await (await env.PHOTOS.get("project-catalog/v1.json")).text());
 assert.equal(stored.projects.find(p=>p.id===project.id).category,"Automation");
 assert.equal((await projectsApi({request:request("/api/projects","PATCH",{
  id:project.id,category:""
 },owner),env})).status,400);
});

test("administrator is a role on an existing email/password account, never a public signup option",async()=>{
 const env={PHOTOS:new Bucket(),admin_password:"role-based-test-admin-secret"};
 const response=await provisionTestAccount(request("/api/accounts","POST",{
  action:"register",email:"role-admin@example.test",password:"strong-account-password",displayName:"Site Owner",role:"admin"
 }),env);
 assert.equal(response.status,201);
 const session=cookie(response);
 const current=new Request(ORIGIN+"/api/auth",{headers:{cookie:session}});
 assert.equal(await isAdmin(current,env),false);
 assert.equal((await handleAccounts(request("/api/accounts","POST",{action:"claim-admin",adminPassword:"incorrect"},session),env)).status,403);
 const elevated=await handleAccounts(request("/api/accounts","POST",{
  action:"claim-admin",adminPassword:env.admin_password
 },session),env);
 assert.equal(elevated.status,200);
 assert.equal((await elevated.json()).user.role,"admin");
 assert.equal(await isAdmin(current,env),true);
 assert.equal((await (await handleAccounts(request("/api/accounts","GET",undefined,session),env)).json()).user.role,"admin");
 assert.equal((await auth(request("/api/auth","POST",{password:env.admin_password}),env)).status,410);
 const other=await provisionTestAccount(request("/api/accounts","POST",{
  action:"register",email:"ordinary@example.test",password:"another-strong-password"
 }),env);
 assert.equal(other.status,201);
 assert.equal((await other.json()).user.role,"member");
 assert.equal(await isAdmin(new Request(ORIGIN+"/api/auth",{headers:{cookie:cookie(other)}}),env),false);
});

test("project tags are optional, case-insensitive unique, and can describe several disciplines",async()=>{
 const env={PHOTOS:new Bucket(),admin_password:"role-tags-test-password"};
 const response=await provisionTestAccount(request("/api/accounts","POST",{
  action:"register",email:"tags@example.test",password:"strong-tags-test-password"
 }),env);
 assert.equal(response.status,201);
 const owner=cookie(response);
 let result=await projectsApi({request:request("/api/projects","POST",{
  name:"CAD with electronics",description:"A mixed build",tags:["CAD","Electronics","cad","3D Printing","Software"],category:"Uncategorized"
 },owner),env});
 assert.equal(result.status,200);
 const project=(await result.json()).projects.find(item=>item.name==="CAD with electronics");
 assert.deepEqual(project.tags,["CAD","Electronics","3D Printing","Software"]);
 result=await projectsApi({request:request("/api/projects","PATCH",{id:project.id,tags:["Woodworking","CAD"]},owner),env});
 assert.equal(result.status,200);
 assert.deepEqual((await result.json()).projects.find(item=>item.id===project.id).tags,["Woodworking","CAD"]);
 result=await projectsApi({request:request("/api/projects","PATCH",{id:project.id,tags:["   "]},owner),env});
 assert.equal(result.status,400);
 result=await projectsApi({request:request("/api/projects","PATCH",{id:project.id,tags:Array(21).fill("CAD")},owner),env});
 assert.equal(result.status,400);
});

test("public registration is closed without creating accounts or exposing secrets",async()=>{
 const env={PHOTOS:new Bucket(),admin_password:"registration-error-test-secret"};
 for(const payload of [
  {action:"register",email:"existing@example.test",password:"a-long-valid-test-password"},
  {action:"register",email:"bad",password:"short",role:"admin"}
 ]){
  const result=await handleAccounts(request("/api/accounts","POST",payload),env);
  assert.equal(result.status,410);
  const data=await result.json();
  assert.equal(data.code,"REGISTRATION_CLOSED");
  assert.doesNotMatch(JSON.stringify(data),/registration-error-test-secret/);
 }
 assert.equal(env.PHOTOS.data.size,0);
});

test("legacy administrator password can be linked only once",async()=>{
 const env={PHOTOS:new Bucket(),admin_password:"unique-admin-migration-secret"};
 const first=await provisionTestAccount(request("/api/accounts","POST",{
  action:"register",email:"first-admin@example.test",password:"first-valid-password"
 }),env);
 const second=await provisionTestAccount(request("/api/accounts","POST",{
  action:"register",email:"second-admin@example.test",password:"second-valid-password"
 }),env);
 assert.equal(first.status,201);assert.equal(second.status,201);
 const firstCookie=cookie(first),secondCookie=cookie(second);
 let result=await handleAccounts(request("/api/accounts","POST",{
  action:"claim-admin",adminPassword:env.admin_password
 },firstCookie),env);
 assert.equal(result.status,200);
 result=await handleAccounts(request("/api/accounts","POST",{
  action:"claim-admin",adminPassword:env.admin_password
 },secondCookie),env);
 assert.equal(result.status,409);
 assert.equal((await result.json()).code,"ADMIN_ALREADY_CLAIMED");
 assert.equal(await isAdmin(new Request(ORIGIN+"/api/auth",{headers:{cookie:secondCookie}}),env),false);
});

test("short summary and hierarchical quantities persist independently of existing project data",async()=>{
 const env={PHOTOS:new Bucket(),admin_password:"test-separate-administrator-secret"};
 const registered=await provisionTestAccount(request("/api/accounts","POST",{
  action:"register",email:"quantities@example.test",password:"a-strong-test-password"
 }),env);
 assert.equal(registered.status,201);
 const owner=cookie(registered);
 const created=await projectsApi({request:request("/api/projects","POST",{
  name:"Quantity test",description:"Existing directory description"
 },owner),env});
 const id=(await created.json()).projects.find(p=>p.name==="Quantity test").id;
 let summaryRevision=null;
 const patch=body=>projectsApi({request:request("/api/projects","PATCH",{id,...body,expectedRevision:summaryRevision},owner),env});
 const firstSummary=await read(await patch({summary:"Keep this long summary."}));
 assert.equal(firstSummary.status,200);
 summaryRevision=firstSummary.data.projects.find(p=>p.id===id).summaryRevision;
 assert.equal((await patch({shortSummary:"a".repeat(41)})).status,400);
 assert.equal((await patch({shortSummary:"Two\nlines"})).status,400);
 const result=await read(await patch({shortSummary:"a".repeat(40)}));
 assert.equal(result.status,200);
 const record=result.data.projects.find(p=>p.id===id);
 assert.equal(record.shortSummary,"a".repeat(40));
 assert.equal(record.summary,"Keep this long summary.");
 assert.equal(record.description,"Existing directory description");

 const treeUrl="/api/tree?project="+id;
 const saveTree=nodes=>handleTree(request(treeUrl,"PUT",{nodes},owner),env);
 const assembly={id:"testing-assembly",name:"Test assembly",parentId:null};
 assert.equal((await saveTree([{...assembly,quantity:1.5}])).status,400);
 assert.equal((await saveTree([{...assembly,quantity:2}])).status,200);
 assert.equal((await saveTree([{...assembly,name:"Renamed assembly"}])).status,200);
 const tree=await read(await handleTree(request(treeUrl,"GET",undefined,owner),env));
 assert.equal(tree.data.nodes[0].quantity,2);

 const partUrl="/api/components?project="+id;
 const newPart=await handleComponents(request(partUrl,"POST",{
  name:"Stock",description:"Supply",assemblyId:assembly.id,quantity:2,quantityUnit:"mm",specifications:[]
 },owner),env);
 assert.equal(newPart.status,201);
 const original=(await newPart.json()).component;
 const partRequest=(quantity,expectedRevision=null)=>handleComponents(request(partUrl+"&id="+original.id,"PATCH",{quantity,expectedRevision},owner),env);
 assert.equal((await partRequest(0)).status,400);
 const updated=await read(await partRequest(3.5));
 assert.equal(updated.status,200);
 assert.equal(updated.data.component.quantity,3.5);
 assert.equal(updated.data.component.description,original.description);
 assert.equal(updated.data.component.quantityUnit,"mm");
 const cleared=(await read(await partRequest(null,updated.data.component.revision))).data.component;
 assert.equal(cleared.quantity,null);
 const offers=[{vendor:"other",supplierName:"JLCPCB",sku:"",url:"https://jlcpcb.com/"}];
 const custom=await read(await handleComponents(request(partUrl+"&id="+original.id,"PUT",{
  ...cleared,expectedRevision:cleared.revision,partType:"custom_purchased",supplier:"JLCPCB",supplierOffers:offers,
  historicalPrice:12.50,historicalPurchasePrice:12.50,historicalPriceDate:"2026-11-19"
 },owner),env));
 assert.equal(custom.status,200);
 assert.equal(custom.data.component.partType,"custom_purchased");
 assert.equal(custom.data.component.historicalPrice,12.50);
 assert.equal(custom.data.component.supplier,"JLCPCB");
 const caption=await read(await handleComponents(request(partUrl+"&id="+original.id,"PATCH",{treeDescription:"PCB assembly",expectedRevision:custom.data.component.revision},owner),env));
 assert.equal(caption.status,200);
 assert.equal(caption.data.component.projectDetails.featureTreeName,"PCB assembly");
 assert.equal(caption.data.component.supplier,"JLCPCB");
 assert.equal(caption.data.component.historicalPrice,12.50);

 assert.deepEqual(custom.data.component.supplierOffers,offers);

});
