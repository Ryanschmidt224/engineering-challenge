import {isAdmin} from "./auth.js";
const projects=new Set(["launcher","linear","robot"]);
const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
export async function handleTree(request,env){
 const project=new URL(request.url).searchParams.get("project");
 if(!projects.has(project))return reply({error:"Unknown project"},400);
 if(!env.PHOTOS)return reply({error:"Storage unavailable"},503);
 const assemblyId=new URL(request.url).searchParams.get("assembly");
 if(assemblyId!==null){
  if(!/^[a-zA-Z0-9-]{1,80}$/.test(assemblyId))return reply({error:"Invalid assembly"},400);
  const treeObj=await env.PHOTOS.get("trees/"+project+".json");
  const tree=treeObj?JSON.parse(await treeObj.text()):[];
  if(!tree.some(n=>n.id===assemblyId))return reply({error:"Assembly not found"},404);
  const contentKey="assembly-pages/"+project+"/"+assemblyId+".json";
  if(request.method==="GET"){
   const obj=await env.PHOTOS.get(contentKey);
   return reply({page:obj?JSON.parse(await obj.text()):{description:""}});
  }
  if(request.method!=="PUT")return reply({error:"Method not allowed"},405);
  if(!await isAdmin(request,env))return reply({error:"Admin login required"},401);
  const body=await request.json().catch(()=>null);
  if(typeof body?.description!=="string"||body.description.length>20000)return reply({error:"Invalid description"},400);
  await env.PHOTOS.put(contentKey,JSON.stringify({description:body.description}));
  return reply({ok:true});
 }
 const key="trees/"+project+".json";
 if(request.method==="GET"){
  const obj=await env.PHOTOS.get(key);
  return reply({nodes:obj?JSON.parse(await obj.text()):[]});
 }
 if(request.method!=="PUT")return reply({error:"Method not allowed"},405);
 if(!await isAdmin(request,env))return reply({error:"Admin login required"},401);
 const body=await request.json().catch(()=>null),nodes=body?.nodes;
 if(!Array.isArray(nodes)||nodes.length>200)return reply({error:"Invalid feature tree"},400);
 const ids=new Set();
 for(const n of nodes){
  if(!n||typeof n.id!=="string"||!/^[a-zA-Z0-9-]{1,80}$/.test(n.id)||ids.has(n.id)||typeof n.name!=="string"||!n.name.trim()||n.name.length>100||!(n.parentId===null||typeof n.parentId==="string"))return reply({error:"Invalid node"},400);
  ids.add(n.id);
 }
 for(const n of nodes){
  if(n.parentId!==null&&!ids.has(n.parentId))return reply({error:"Missing parent"},400);
  let cursor=n.parentId,seen=new Set([n.id]);
  while(cursor!==null){if(seen.has(cursor))return reply({error:"Circular tree"},400);seen.add(cursor);cursor=nodes.find(x=>x.id===cursor)?.parentId??null}
 }
 await env.PHOTOS.put(key,JSON.stringify(nodes.map(n=>({id:n.id,name:n.name.trim(),parentId:n.parentId}))));
 return reply({ok:true});
}
