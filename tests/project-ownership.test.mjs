import {test} from "node:test";
import assert from "node:assert/strict";
import {handleAccounts} from "../functions/api/accounts.js";
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
 const a=await handleAccounts(request("/api/accounts","POST",{action:"register",email:"one@example.test",password:"one-strong-test-password"}),env);
 const b=await handleAccounts(request("/api/accounts","POST",{action:"register",email:"two@example.test",password:"two-strong-test-password"}),env);
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
 const recipe=[{id:"step1",title:"Solder contacts",standard:"Use 260 C",detail:"",notes:[],photos:[]}];
 await env.PHOTOS.put("workspaces/"+id+"/__root__.json",JSON.stringify({recipe,resources:{tools:[],parts:[],calculators:[]},revision:"r1",history:[]}));
 const proposed=await handleProposals(request("/api/proposals?project="+id,"POST",{
  scope:"assembly",targetId:"__root__",stepId:"step1",field:"standard",suggestedText:"Use temperature specified by solder manufacturer"
 },other),env);
 assert.equal(proposed.status,201);
 const proposalId=(await proposed.json()).proposal.id;
 const unapproved=JSON.parse(await (await env.PHOTOS.get("workspaces/"+id+"/__root__.json")).text());
 assert.equal(unapproved.recipe[0].standard,"Use 260 C");
 assert.equal((await handleProposals(request("/api/proposals?project="+id,"PATCH",{id:proposalId,action:"approve"},other),env)).status,403);
 assert.equal((await handleProposals(request("/api/proposals?project="+id,"PATCH",{id:proposalId,action:"approve"},owner),env)).status,200);
 const after=JSON.parse(await (await env.PHOTOS.get("workspaces/"+id+"/__root__.json")).text());
 assert.equal(after.recipe[0].standard,"Use temperature specified by solder manufacturer");
 assert.equal(after.history.at(-1).recipe[0].standard,"Use 260 C");
 assert.equal((await projectsApi({request:request("/api/projects","PATCH",{id,editMode:"locked"},owner),env})).status,200);
 assert.equal((await handleProposals(request("/api/proposals?project="+id,"POST",{
  scope:"assembly",targetId:"__root__",stepId:"step1",field:"standard",suggestedText:"Change again"
 },other),env)).status,403);
 assert.equal((await projectsApi({request:request("/api/projects","DELETE",{id,confirmName:"incorrect"},owner),env})).status,400);
 assert.equal((await projectsApi({request:request("/api/projects","DELETE",{id,confirmName:"Private stepper design"},owner),env})).status,200);
 assert.equal(await projectAllowed(env,id,ownerRequest),false);
 assert.equal(env.PHOTOS.deletes.length,0);
 assert.ok(await env.PHOTOS.get("workspaces/"+id+"/__root__.json"));
 assert.equal((await projectsApi({request:request("/api/projects","PATCH",{id,action:"restore"},owner),env})).status,200);
 assert.equal(await projectAllowed(env,id,ownerRequest),true);
});
