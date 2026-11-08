import {isAdmin} from "./auth.js";
const projects=new Set(["launcher","linear","robot"]);
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
const emptyResources=()=>({tools:[],calculators:[],parts:[]});
const validateResources=input=>{
 if(input===undefined)return undefined;
 if(!input||typeof input!=="object"||Array.isArray(input))return null;
 const resources=emptyResources();
 for(const key of Object.keys(resources)){
  if(!Array.isArray(input[key])||input[key].length>60)return null;
  const ids=input[key];
  if(ids.some(id=>typeof id!=="string"||! /^[a-zA-Z0-9:-]{1,120}$/.test(id)))return null;
  resources[key]=[...new Set(ids)];
 }
 return resources;
};
export async function handleWorkspace(request,env){
 const u=new URL(request.url),project=u.searchParams.get("project"),assembly=u.searchParams.get("assembly"),part=u.searchParams.get("part");
 if(!projects.has(project))return json({error:"Invalid project"},400);
 if(part&&assembly)return json({error:"Specify a part or an assembly, not both"},400);
 if(part){
  if(!/^[0-9a-f-]{36}$/i.test(part))return json({error:"Invalid part"},400);
  if(!env.PHOTOS)return json({error:"Storage unavailable"},503);
  const record=await env.PHOTOS.get("components/"+project+".json");
  const parts=record?JSON.parse(await record.text()):[];
  if(!parts.some(item=>item.id===part))return json({error:"Part no longer exists"},404);
 }else if(!assembly||!(assembly==="__root__"||/^[a-zA-Z0-9-]{1,80}$/.test(assembly)))return json({error:"Invalid workspace"},400);
 if(!env.PHOTOS)return json({error:"Storage unavailable"},503);
 const key=part?"part-workspaces/"+project+"/"+part+".json":"workspaces/"+project+"/"+assembly+".json";
 if(request.method==="GET"){const obj=await env.PHOTOS.get(key);return json({workspace:obj?JSON.parse(await obj.text()):{instructions:"",procedures:"",notes:"",resources:emptyResources()}})}
 if(request.method!=="PUT")return json({error:"Method not allowed"},405);
 if(!await isAdmin(request,env))return json({error:"Administrator login required"},401);
 const data=await request.json().catch(()=>null);if(!data||["instructions","procedures","notes"].some(k=>typeof data[k]!=="string"||data[k].length>30000))return json({error:"Invalid workspace data"},400);
 const resources=validateResources(data.resources);
 if(resources===null)return json({error:"Invalid linked resources"},400);
 const existing=await env.PHOTOS.get(key);
 const previous=existing?JSON.parse(await existing.text()):{};
 const workspace={instructions:data.instructions,procedures:data.procedures,notes:data.notes,resources:resources===undefined?(previous.resources||emptyResources()):resources};
 await env.PHOTOS.put(key,JSON.stringify(workspace));return json({ok:true});
}