import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const partId="11111111-1111-1111-1111-111111111111";
const impl1="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const impl2="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const fakePart=selected=>({
 id:partId,name:"Switching transistor",partSchemaVersion:2,
 functional:{purpose:"Switch an LED"},
 selection:{selectedId:selected,candidates:[{id:impl1,name:"2N7000"},{id:impl2,name:"Custom PCB"}]}
});
function handler(path,name){
 const src=readFileSync(new URL("../"+path,import.meta.url),"utf8")
  .replace(/^import .*;\s*$/gm,"").replace(/^export /gm,"");
 return runInNewContext(src+"\n"+name+";",{
  URL,Response,Request,Headers,TextDecoder,TextEncoder,crypto,
  projectAllowed:async()=>true,canEditProject:async()=>true,isAdmin:async()=>true
 });
}
function envFor(selected){
 const prefixes=[];
 return {prefixes,env:{PHOTOS:{
  get:async key=>key==="components/launcher.json"?{text:async()=>JSON.stringify([fakePart(selected)])}:null,
  list:async({prefix})=>{prefixes.push(prefix);return {objects:[],truncated:false}},
  head:async()=>null,
  put:async()=>({etag:"saved"})
 }}};
}
const files=handler("functions/api/part-files.js","handlePartFiles");
const drawings=handler("functions/api/drawings.js","handleDrawings");
const pages=handler("functions/api/part-pages.js","handlePartPages");
const url=(route,implementation)=>"https://example.test/api/"+route+"?project=launcher&id="+partId+
 (route==="drawings"?"&type=part":"")+(implementation===undefined?"":"&implementation="+implementation);
test("CAD file listings are scoped to active implementation",async()=>{
 const {env,prefixes}=envFor(impl1);
 assert.equal((await files(new Request(url("part-files",impl1)),env)).status,200);
 assert.ok(prefixes.some(p=>p==="part-files/launcher/"+partId+"/implementations/"+impl1+"/"));
 assert.equal((await files(new Request(url("part-files",impl2)),env)).status,409);
 assert.equal((await files(new Request(url("part-files")),env)).status,409);
});
test("unselected parts have no CAD file source until an implementation is chosen",async()=>{
 const {env,prefixes}=envFor(null);
 const res=await files(new Request(url("part-files")),env);
 assert.deepEqual(JSON.parse(await res.text()),{files:[],needsImplementation:true});
 assert.equal(prefixes.length,0);
});
test("drawing PDFs are implementation-scoped for parts",async()=>{
 const {env,prefixes}=envFor(impl2);
 const res=await drawings(new Request(url("drawings",impl2)),env);
 assert.equal(res.status,200);
 assert.ok(prefixes.some(p=>p==="drawings/launcher/part/"+partId+"/implementations/"+impl2+"/"));
 assert.equal((await drawings(new Request(url("drawings",impl1)),env)).status,409);
});
test("saved product webpages are attached to selected physical solution",async()=>{
 const {env,prefixes}=envFor(impl1);
 assert.equal((await pages(new Request(url("part-pages",impl1)),env)).status,200);
 assert.ok(prefixes.some(p=>p==="part-pages/launcher/"+partId+"/implementations/"+impl1+"/"));
 assert.equal((await pages(new Request(url("part-pages",impl2)),env)).status,409);
});
