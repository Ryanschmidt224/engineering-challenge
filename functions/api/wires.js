import {isAdmin} from "./auth.js";
const PROJECTS=new Set(["launcher","linear","robot"]);
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const libraryKey="libraries/wires.json";
const clean=(value,max=160)=>String(value??"").trim().slice(0,max);
const guid=value=>typeof value==="string"&&/^[0-9a-f-]{36}$/i.test(value);
async function library(env){
 const obj=await env.PHOTOS.get(libraryKey);
 return obj?JSON.parse(await obj.text()):[];
}
function wireData(input){
 if(!input||typeof input!=="object")return null;
 const wire={
  name:clean(input.name,100),awg:clean(input.awg,24),
  construction:clean(input.construction,100),insulation:clean(input.insulation,100),
  color:clean(input.color,60),manufacturer:clean(input.manufacturer,100),
  partNumber:clean(input.partNumber,100),notes:clean(input.notes,500)
 };
 if(!wire.name)return null;
 return wire;
}
export async function handleWires(request,env){
 if(!env.PHOTOS)return json({error:"Storage unavailable"},503);
 const url=new URL(request.url);
 if(request.method==="GET")return json({wires:await library(env)});
 if(!await isAdmin(request,env))return json({error:"Admin login required"},401);
 const input=await request.json().catch(()=>null),fields=wireData(input);
 if(!fields)return json({error:"Wire name is required"},400);
 const wires=await library(env);
 if(request.method==="POST"){
  if(wires.length>=300)return json({error:"Wire library is full"},400);
  const wire={id:crypto.randomUUID(),...fields};
  wires.push(wire);
  await env.PHOTOS.put(libraryKey,JSON.stringify(wires));
  return json({wire},201);
 }
 if(request.method==="PUT"){
  const id=url.searchParams.get("id"),index=wires.findIndex(w=>w.id===id);
  if(index<0)return json({error:"Wire type not found"},404);
  wires[index]={...wires[index],...fields};
  await env.PHOTOS.put(libraryKey,JSON.stringify(wires));
  return json({wire:wires[index]});
 }
 return json({error:"Method not allowed"},405);
}
export async function handleHarness(request,env){
 if(!env.PHOTOS)return json({error:"Storage unavailable"},503);
 const url=new URL(request.url),project=url.searchParams.get("project"),partId=url.searchParams.get("part");
 if(!PROJECTS.has(project)||!guid(partId))return json({error:"Invalid part"},400);
 const records=await env.PHOTOS.get("components/"+project+".json");
 const parts=records?JSON.parse(await records.text()):[];
 if(!parts.some(p=>p.id===partId))return json({error:"Part not found"},404);
 const key="harnesses/"+project+"/"+partId+".json";
 if(request.method==="GET"){
  const record=await env.PHOTOS.get(key);
  return json({cuts:record?JSON.parse(await record.text()):[]});
 }
 if(request.method!=="PUT")return json({error:"Method not allowed"},405);
 if(!await isAdmin(request,env))return json({error:"Admin login required"},401);
 const body=await request.json().catch(()=>null);
 if(!Array.isArray(body?.cuts)||body.cuts.length>100)return json({error:"Invalid harness cutting list"},400);
 const wires=await library(env),ids=new Set(wires.map(w=>w.id));
 const cuts=[];
 for(const item of body.cuts){
  if(!item||!ids.has(item.wireId))return json({error:"Select a wire from the shared library"},400);
  const qty=Number(item.qty),cutLengthMm=Number(item.cutLengthMm),stripAmm=Number(item.stripAmm||0),stripBmm=Number(item.stripBmm||0);
  if(!Number.isInteger(qty)||qty<1||qty>10000||!Number.isFinite(cutLengthMm)||cutLengthMm<=0||cutLengthMm>1000000||![stripAmm,stripBmm].every(n=>Number.isFinite(n)&&n>=0&&n<cutLengthMm))return json({error:"Enter a valid quantity, cut length and strip lengths in millimeters"},400);
  cuts.push({id:guid(item.id)?item.id:crypto.randomUUID(),wireId:item.wireId,qty,cutLengthMm,stripAmm,stripBmm,endA:clean(item.endA,120),endB:clean(item.endB,120),notes:clean(item.notes,500)});
 }
 await env.PHOTOS.put(key,JSON.stringify(cuts));
 return json({cuts});
}
