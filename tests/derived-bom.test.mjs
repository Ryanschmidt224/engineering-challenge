// Run with npm test. Cloudflare R2 and admin auth are mocked in memory.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {randomUUID} from "node:crypto";

function handler(path,name){
 const source=readFileSync(path,"utf8").replace(/^import .*;\s*$/gm,"").replace(/^export /gm,"");
 return runInNewContext(source+"\n"+name+";",{
  Response,Request,URL,crypto:{randomUUID},isAdmin:async()=>true,
  console,Date,JSON,Number,String,Array,Map,Set,RegExp
 });
}
function storage(){
 const map=new Map();
 return {map,env:{PHOTOS:{
  get:async key=>map.has(key)?{text:async()=>map.get(key)}:null,
  put:async(key,value)=>{map.set(key,value)},
  delete:async key=>{map.delete(key)}
 }}};
}
function request(method,path,data){
 return new Request("https://example.test"+path,{method,headers:{"content-type":"application/json"},
  body:data===undefined?undefined:JSON.stringify(data)});
}
const components=handler("functions/api/components.js","handleComponents");
const workspace=handler("functions/api/workspace.js","handleWorkspace");
const componentsUrl="/api/components?project=launcher";
const specs=(a,b)=>[{name:"AWG",value:"18"},{name:"End A",value:a},{name:"End B",value:b}];

test("ferrules are derived, updated, and removed with the source wire",async()=>{
 const {map,env}=storage();
 const create=await components(request("POST",componentsUrl,{
  name:"Crimped wire",category:"Crimped wire",quantity:3,quantityUnit:"pcs",
  specifications:specs("ferrule","ferrule")}),env);
 assert.equal(create.status,201);
 const source=(await create.json()).component;
 let records=JSON.parse(map.get("components/launcher.json"));
 assert.equal(records.find(x=>x.generatedFrom===source.id)?.quantity,6);
 assert.equal(records.find(x=>x.generatedFrom===source.id)?.sharedPartRef,"standard:ferrule:18");
 const update=await components(request("PUT",componentsUrl+"&id="+source.id,{
  ...source,quantity:5,specifications:specs("ferrule","bare")}),env);
 assert.equal(update.status,200);
 records=JSON.parse(map.get("components/launcher.json"));
 assert.equal(records.find(x=>x.generatedFrom===source.id)?.quantity,5);
 assert.equal(records.filter(x=>x.generatedFrom===source.id).length,1);
 const generated=records.find(x=>x.generatedFrom===source.id);
 assert.equal((await components(request("DELETE",componentsUrl+"&id="+generated.id),env)).status,409);
 assert.equal((await components(request("DELETE",componentsUrl+"&id="+source.id),env)).status,200);
 assert.equal(JSON.parse(map.get("components/launcher.json")).length,0);
});

test("unknown quantities stay blank and ferrules are not invented",async()=>{
 const {map,env}=storage();
 const created=await components(request("POST",componentsUrl,{
  name:"Crimped wire",category:"Crimped wire",quantity:null,quantityUnit:"pcs",
  specifications:specs("ferrule","bare")}),env);
 assert.equal(created.status,201);
 const records=JSON.parse(map.get("components/launcher.json"));
 assert.equal(records[0].quantity,null);
 assert.equal(records.find(x=>x.generatedFrom===records[0].id)?.quantity,null);
});

test("optional test notes and automatic instruction history are retained",async()=>{
 const {env}=storage();
 const url="/api/workspace?project=launcher&assembly=__root__";
 const basic={instructions:"Connect the wire.",procedures:"",notes:"",
  resources:{parts:[],tools:[],calculators:[]},experiments:[]};
 assert.equal((await workspace(request("PUT",url,basic),env)).status,200);
 const second={...basic,instructions:"Connect the wire, then test continuity.",
  experiments:[{id:"test-1",createdAt:"2026-11-07T00:00:00Z",text:"Continuity confirmed"}]};
 assert.equal((await workspace(request("PUT",url,second),env)).status,200);
 const loaded=await (await workspace(request("GET",url),env)).json();
 assert.equal(loaded.workspace.experiments.length,1);
 assert.equal(loaded.workspace.history.length,1);
 assert.equal(loaded.workspace.history[0].instructions,"Connect the wire.");
});


test("standard shop supplies are assumed available while special wire is purchased",async()=>{
 const {env}=storage();
 async function add(name,category,specifications=[]){
  const response=await components(request("POST",componentsUrl,{
   name,category,quantity:null,quantityUnit:"pcs",specifications
  }),env);
  assert.equal(response.status,201);return (await response.json()).component;
 }
 const solder=await add("Solder","Consumable");
 const heat=await add("Heat shrink tubing","Consumable");
 const special=await add("Wire — 10 AWG stranded copper","Wire & cable");
 const standard=await add("Wire — 22 AWG stranded copper","Wire & cable");
 const crimped=await add("Crimped wire — 18 AWG","Crimped wire",specs("ferrule","bare"));
 const items=(await (await components(request("GET",componentsUrl),env)).json()).components;
 const find=id=>items.find(x=>x.id===id);
 assert.equal(find(solder.id).assumedOnHand,true);
 assert.equal(find(heat.id).assumedOnHand,true);
 assert.equal(find(standard.id).assumedOnHand,true);
 assert.equal(find(special.id).assumedOnHand,false);
 assert.equal(find(crimped.id).assumedOnHand,false);
 assert.equal(items.find(x=>x.generatedKind==="ferrule").assumedOnHand,true);
});

test("one-click purchase override works on calculated consumables and survives source edits",async()=>{
 const {env}=storage();
 const created=await components(request("POST",componentsUrl,{
  name:"Crimped wire",category:"Crimped wire",quantity:3,quantityUnit:"pcs",
  specifications:[...specs("ferrule","ferrule"),{name:"Cut length (in)",value:"12"}]
 }),env);
 const wire=(await created.json()).component;
 let items=(await (await components(request("GET",componentsUrl),env)).json()).components;
 const ferrule=items.find(x=>x.generatedKind==="ferrule");
 const raw=items.find(x=>x.generatedKind==="wire");
 assert.equal(raw.quantity,36);
 assert.equal(raw.quantityUnit,"in");
 assert.equal(raw.assumedOnHand,true);
 assert.equal((await components(request("PATCH",componentsUrl+"&id="+ferrule.id,{purchaseOverride:true}),env)).status,200);
 const saved=await components(request("PUT",componentsUrl+"&id="+wire.id,{
  ...wire,quantity:5,specifications:[...specs("ferrule","bare"),{name:"Cut length (in)",value:"12"}]
 }),env);
 assert.equal(saved.status,200);
 items=(await (await components(request("GET",componentsUrl),env)).json()).components;
 assert.equal(items.find(x=>x.generatedKind==="ferrule").quantity,5);
 assert.equal(items.find(x=>x.generatedKind==="ferrule").assumedOnHand,false);
 assert.equal(items.find(x=>x.generatedKind==="wire").quantity,60);
 assert.equal((await components(request("PATCH",componentsUrl+"&id="+ferrule.id,{purchaseOverride:false}),env)).status,200);
 items=(await (await components(request("GET",componentsUrl),env)).json()).components;
 assert.equal(items.find(x=>x.generatedKind==="ferrule").assumedOnHand,true);
});


test("shop materials can save a recommended Workshop choice without a full part edit",async()=>{
 const {env}=storage();
 const created=await components(request("POST",componentsUrl,{
  name:"Solder",category:"Consumable",quantity:null,quantityUnit:"pcs",specifications:[]
 }),env);
 const part=(await created.json()).component;
 const choice=await components(request("PATCH",componentsUrl+"&id="+part.id,{
  workshopChoice:"workshop:solder"
 }),env);
 assert.equal(choice.status,200);
 const loaded=await (await components(request("GET",componentsUrl),env)).json();
 assert.equal(loaded.components.find(item=>item.id===part.id).workshopChoice,"workshop:solder");
 assert.equal(loaded.components.find(item=>item.id===part.id).assumedOnHand,true);
 const invalid=await components(request("PATCH",componentsUrl+"&id="+part.id,{
  workshopChoice:"workshop:untrusted"
 }),env);
 assert.equal(invalid.status,400);
});

test("solder-removal tools are not mistaken for consumable solder",async()=>{
 const {env}=storage();
 const created=await components(request("POST",componentsUrl,{
  name:"Solder Sucker Desoldering Tool",category:"Tool",quantity:1,quantityUnit:"pcs",specifications:[]
 }),env);
 const part=(await created.json()).component;
 const loaded=await (await components(request("GET",componentsUrl),env)).json();
 assert.equal(loaded.components.find(item=>item.id===part.id).assumedOnHand,false);
});
