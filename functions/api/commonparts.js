import {isAdmin} from "./auth.js";
const key="libraries/common-parts.json";
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const clean=(value,max=160)=>String(value??"").trim().slice(0,max);
const valid=input=>{
 if(!input||typeof input!=="object")return null;
 const category=clean(input.category,30);
 if(!["wire","power","fasteners","other"].includes(category))return null;
 const record={
  category,name:clean(input.name,100),manufacturer:clean(input.manufacturer,100),
  partNumber:clean(input.partNumber,100),specifications:clean(input.specifications,1000),
  notes:clean(input.notes,1000)
 };
 return record.name?record:null;
};
async function read(env){
 const object=await env.PHOTOS.get(key);
 return object?JSON.parse(await object.text()):[];
}
export async function handleCommonParts(request,env){
 if(!env.PHOTOS)return json({error:"Shared part library storage unavailable"},503);
 if(request.method==="GET")return json({parts:await read(env)});
 if(!["POST","PUT"].includes(request.method))return json({error:"Method not allowed"},405);
 if(!await isAdmin(request,env))return json({error:"Administrator login required"},401);
 const input=await request.json().catch(()=>null),data=valid(input);
 if(!data)return json({error:"Select category and enter a part name"},400);
 const parts=await read(env);
 if(request.method==="POST"){
  if(parts.length>=500)return json({error:"Shared part library full"},400);
  const part={id:crypto.randomUUID(),...data};
  parts.push(part);await env.PHOTOS.put(key,JSON.stringify(parts));
  return json({part},201);
 }
 const id=new URL(request.url).searchParams.get("id");
 const index=parts.findIndex(item=>item.id===id);
 if(index<0)return json({error:"Library part not found"},404);
 const part={...parts[index],...data};parts[index]=part;
 await env.PHOTOS.put(key,JSON.stringify(parts));return json({part});
}