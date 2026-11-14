import test from "node:test";
import assert from "node:assert/strict";
import {auth} from "../functions/api/auth.js";
import {handlePartCode} from "../functions/api/part-code.js";
import {handleComponents} from "../functions/api/components.js";
import {folders,isAllowedKey} from "../functions/api/project-archive.js";

class Bucket{
 data=new Map();version=0;
 async get(key){const item=this.data.get(key);return item?{etag:item.etag,text:async()=>item.text}:null}
 async put(key,value,options={}){
  const current=this.data.get(key),guard=options.onlyIf||{};
  if(guard.etagDoesNotMatch==="*"&&current)return null;
  if(guard.etagMatches&&current?.etag!==guard.etagMatches)return null;
  const etag="mock-"+(++this.version);
  this.data.set(key,{etag,text:typeof value==="string"?value:JSON.stringify(value)});
  return {etag};
 }
}
const id="12345678-1234-1234-1234-123456789abc";
const base="https://example.test";
async function setup(){
 const env={PHOTOS:new Bucket(),admin_password:"long-test-password"};
 await env.PHOTOS.put("components/launcher.json",JSON.stringify([{id,name:"Motor controller",partType:"code",itemType:"document",progressStatus:"not_started"}]));
 const login=await auth(new Request(base+"/api/auth",{method:"POST",headers:{"origin":base,"content-type":"application/json"},body:JSON.stringify({password:env.admin_password})}),env);
 assert.equal(login.status,200);
 const cookie=login.headers.get("set-cookie").split(";")[0];
 const req=(path,method="GET",body)=>new Request(base+path,{method,headers:{cookie,...(body?{"content-type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})});
 return {env,req};
}
test("Code items store immutable versions and reject stale writes",async()=>{
 const {env,req}=await setup(),path="/api/part-code?project=launcher&id="+id;
 const blank=await handlePartCode(req(path),env);assert.equal(blank.status,200);
 assert.equal((await blank.json()).document.source,"");
 let a=await handlePartCode(req(path,"PUT",{source:"print(1)\n",language:"python",filename:"main.py",expectedRevision:null}),env);
 assert.equal(a.status,200);const first=(await a.json()).revision;
 let b=await handlePartCode(req(path,"PUT",{source:"print(2)\n",language:"python",filename:"main.py",expectedRevision:first}),env);
 assert.equal(b.status,200);const second=(await b.json()).revision;
 const current=await (await handlePartCode(req(path),env)).json();
 assert.equal(current.document.source,"print(2)\n");assert.equal(current.document.revisions.length,2);
 const older=await (await handlePartCode(req(path+"&revision="+first),env)).json();
 assert.equal(older.version.source,"print(1)\n");
 assert.notEqual(first,second);
 assert.equal((await handlePartCode(req(path,"PUT",{source:"stale",language:"text",filename:"x.txt",expectedRevision:first}),env)).status,409);
});
test("Changing names and types preserves unrelated component data",async()=>{
 const {env,req}=await setup(),path="/api/components?project=launcher&id="+id;
 let res=await handleComponents(req(path,"PATCH",{name:"Controller program",progressStatus:"complete"}),env);
 assert.equal(res.status,200);let saved=(await res.json()).component;
 assert.equal(saved.name,"Controller program");assert.equal(saved.progressStatus,"complete");
 res=await handleComponents(req(path,"PATCH",{partType:"custom"}),env);
 saved=(await res.json()).component;assert.equal(saved.itemType,"part");
 res=await handleComponents(req(path,"PATCH",{partType:"code"}),env);
 saved=(await res.json()).component;assert.equal(saved.itemType,"document");
});
test("Project exports include Code current files and revision snapshots",()=>{
 assert(folders("launcher").includes("part-code/launcher/"));
 assert(isAllowedKey("launcher","part-code/launcher/"+id+"/revisions/"+id+".json"));
 assert(!isAllowedKey("launcher","part-code/robot/"+id+"/current.json"));
});


test("Assigning the next number to an existing purchased part works and locks issued numbers",async()=>{
 const {env,req}=await setup();
 const path="/api/components?project=launcher&id="+id;
 const payload={
  name:"Motor controller",itemType:"part",partType:"purchased",description:"",
  quantity:1,quantityUnit:"pcs",specifications:[],partNumber:null,assignNumber:true,
  historicalPurchasePrice:null,historicalPriceBasis:"per_part",historicalPriceDate:null,
  manufacturer:"",model:"",supplier:"",asin:""
 };
 let response=await handleComponents(req(path,"PUT",payload),env);
 assert.equal(response.status,200,await response.text().catch(()=>"<unreadable>"));
 let part=(await (await handleComponents(req("/api/components?project=launcher"),env)).json()).components.find(p=>p.id===id);
 assert.match(part.partNumber,/^NR\d{3,}$/);
 assert.equal(part.fullName,part.partNumber+" - Motor controller");
 const original=part.partNumber;
 response=await handleComponents(req(path,"PUT",{...payload,partNumber:original,assignNumber:false}),env);
 assert.equal(response.status,200);
 response=await handleComponents(req(path,"PUT",{...payload,partNumber:"NR999",assignNumber:false}),env);
 assert.equal(response.status,409);
 part=(await (await handleComponents(req("/api/components?project=launcher"),env)).json()).components.find(p=>p.id===id);
 assert.equal(part.partNumber,original);
});
