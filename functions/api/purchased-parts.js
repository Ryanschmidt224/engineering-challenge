import {isAdmin} from "./auth.js";
const PROJECTS=new Set(["launcher","linear","robot","buck","motorlab","coiltest"]);
const KEY="libraries/purchased-parts.json";
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const short=(value,max=200)=>String(value??"").trim().slice(0,max);
const identity=part=>{
 const asin=short(part.asin,20).toLowerCase();
 if(asin)return "asin:"+asin;
 const manufacturer=short(part.manufacturer,100).toLowerCase(),model=short(part.model,100).toLowerCase();
 if(manufacturer&&model)return "model:"+manufacturer+":"+model;
 return "name:"+short(part.name,180).toLowerCase()+"|"+manufacturer+"|"+model;
};
export async function handlePurchasedParts(request,env){
 if(!["GET","POST"].includes(request.method))return json({error:"Method not allowed"},405);
 // Purchased history may reveal proprietary product selections; never publicly expose it.
 if(!await isAdmin(request,env))return json({error:"Administrator login required"},401);
 if(!env.PHOTOS)return json({error:"Storage unavailable"},503);
 const object=await env.PHOTOS.get(KEY);
 const records=object?JSON.parse(await object.text()):[];
 if(request.method==="GET")return json({parts:records});
 const body=await request.json().catch(()=>null);
 const project=body?.project,partId=body?.partId;
 if(!PROJECTS.has(project)||typeof partId!=="string"||!/^[0-9a-f-]{36}$/i.test(partId))return json({error:"Select a saved project part"},400);
 const source=await env.PHOTOS.get("components/"+project+".json");
 const components=source?JSON.parse(await source.text()):[];
 const part=components.find(p=>p.id===partId);
 if(!part||part.generatedFrom)return json({error:"Part not found or is calculated material"},404);
 const key=identity(part),reference={project,partId};
 let record=records.find(r=>r.identity===key);
 if(!record){
  if(records.length>=1200)return json({error:"Purchased-part library full"},400);
  record={id:crypto.randomUUID(),identity:key,name:short(part.name,180),manufacturer:short(part.manufacturer,100),model:short(part.model,100),
   supplier:short(part.supplier,140),asin:short(part.asin,30),category:short(part.category,100),
   specifications:Array.isArray(part.specifications)?part.specifications.slice(0,35).map(v=>({name:short(v.name,120),value:short(v.value,300),source:v.source==="inferred"?"inferred":"explicit"})):[],
   historicalPrice:part.historicalPrice??null,recordedAt:new Date().toISOString(),sources:[]};
  records.push(record);
 }
 if(!Array.isArray(record.sources))record.sources=[];
 if(!record.sources.some(s=>s.project===project&&s.partId===partId))record.sources.push(reference);
 await env.PHOTOS.put(KEY,JSON.stringify(records));
 return json({ok:true,part:record,matchedExisting:record.sources.length>1});
}