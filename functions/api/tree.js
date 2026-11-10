import {projectAllowed,canEditProject,VALID_PROJECT_ID} from "./projects.js";
import {isAdmin} from "./auth.js";
const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
export async function handleTree(request,env){
 const project=new URL(request.url).searchParams.get("project");
 if(!await projectAllowed(env,project,request))return reply({error:"Unknown project"},400);
 if(!env.PHOTOS)return reply({error:"Storage unavailable"},503);
 // Root project display settings are separate from the tree and its node IDs.
 // Names and cover selection can change without migrating BOM or assembly data.
 if(new URL(request.url).searchParams.has("metadata")){
  const key="project-settings/"+project+".json";
  const existing=await env.PHOTOS.get(key);
  const current=existing?JSON.parse(await existing.text()):{};
  if(request.method==="GET")return reply({title:current.title||null,revision:existing?.etag??null});
  if(request.method!=="PUT")return reply({error:"Method not allowed"},405);
  if(!await canEditProject(request,env,project))return reply({error:"Admin login required"},401);
  const body=await request.json().catch(()=>null);
  if(typeof body?.title!=="string"||!body.title.trim()||body.title.trim().length>100)return reply({error:"Project name must be 1–100 characters"},400);
  if(Object.hasOwn(body,"expectedRevision")&&(body.expectedRevision??null)!==(existing?.etag??null))
   return reply({error:"Project settings changed in another tab. Reload and try again."},409);
  const condition=existing?.etag?{onlyIf:{etagMatches:existing.etag}}:
   {onlyIf:{etagDoesNotMatch:"*"}};
  const saved=await env.PHOTOS.put(key,JSON.stringify({...current,title:body.title.trim()}),condition);
  if(saved===null)return reply({error:"Concurrent project settings update. Reload and try again."},409);
  return reply({ok:true,title:body.title.trim(),revision:saved.etag??null});
 }
 const assemblyId=new URL(request.url).searchParams.get("assembly");
 if(assemblyId!==null){
  if(assemblyId!=="__root__"&&!/^[a-zA-Z0-9-]{1,80}$/.test(assemblyId))return reply({error:"Invalid assembly"},400);
  const treeObj=await env.PHOTOS.get("trees/"+project+".json");
  const tree=treeObj?JSON.parse(await treeObj.text()):[];
  if(assemblyId!=="__root__"&&!tree.some(n=>n.id===assemblyId))return reply({error:"Assembly not found"},404);
  const contentKey="assembly-pages/"+project+"/"+assemblyId+".json";
  if(request.method==="GET"){
   const obj=await env.PHOTOS.get(contentKey);
   return reply({page:obj?JSON.parse(await obj.text()):{description:""},revision:obj?.etag??null});
  }
  if(request.method!=="PUT")return reply({error:"Method not allowed"},405);
  if(!await canEditProject(request,env,project))return reply({error:"Admin login required"},401);
  const body=await request.json().catch(()=>null);
  if(typeof body?.description!=="string"||body.description.length>20000)return reply({error:"Invalid description"},400);
  const existing=await env.PHOTOS.get(contentKey);
  if(Object.prototype.hasOwnProperty.call(body,"expectedRevision")&&
    (body.expectedRevision??null)!==(existing?.etag??null))
   return reply({error:"The assembly description changed elsewhere. Reload before saving."},409);
  const condition=existing?.etag?{onlyIf:{etagMatches:existing.etag}}:
   !existing?{onlyIf:{etagDoesNotMatch:"*"}}:undefined;
  const written=await env.PHOTOS.put(contentKey,JSON.stringify({description:body.description}),condition);
  if(written===null)return reply({error:"Concurrent edit. Reload description before saving."},409);
  return reply({ok:true,revision:written?.etag??null});
 }
 const key="trees/"+project+".json";
 if(request.method==="GET"){
  const obj=await env.PHOTOS.get(key);
  return reply({nodes:obj?JSON.parse(await obj.text()):[],revision:obj?.etag??null});
 }
 if(request.method!=="PUT")return reply({error:"Method not allowed"},405);
 if(!await canEditProject(request,env,project))return reply({error:"Admin login required"},401);
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
 for(const n of nodes){
  if(n.kind!==undefined&&!["assembly","part"].includes(n.kind))return reply({error:"Invalid node type"},400);
  if(n.kind==="part"&&(!/^[0-9a-f-]{36}$/i.test(n.partId||"")||nodes.some(child=>child.parentId===n.id)))return reply({error:"A part must link to a BOM record and cannot contain children"},400);
  if(n.parentId!==null&&nodes.find(parent=>parent.id===n.parentId)?.kind==="part")return reply({error:"Parts cannot contain subassemblies"},400);
 }
 for(const n of nodes){if(n.dependsOn!==undefined&&(!Array.isArray(n.dependsOn)||n.dependsOn.some(id=>typeof id!=="string"||id===n.id||!ids.has(id))))return reply({error:"Invalid dependencies"},400);if(n.stage!==undefined&&!["independent","sequential","integration"].includes(n.stage))return reply({error:"Invalid stage"},400)}
 for(const n of nodes){const seen=new Set([n.id]),visit=id=>{if(seen.has(id))return false;seen.add(id);const item=nodes.find(x=>x.id===id);for(const dep of item?.dependsOn||[])if(!visit(dep))return false;seen.delete(id);return true};for(const dep of n.dependsOn||[])if(!visit(dep))return reply({error:"Circular dependencies"},400)}
 const existing=await env.PHOTOS.get(key);
 if(Object.prototype.hasOwnProperty.call(body,"expectedRevision")&&
   (body.expectedRevision??null)!==(existing?.etag??null))
  return reply({error:"The feature tree was modified elsewhere. Reload before saving."},409);
 const condition=existing?.etag?{onlyIf:{etagMatches:existing.etag}}:
  !existing?{onlyIf:{etagDoesNotMatch:"*"}}:undefined;
 const written=await env.PHOTOS.put(key,JSON.stringify(nodes.map(n=>({id:n.id,name:n.name.trim(),parentId:n.parentId,dependsOn:n.dependsOn||[],stage:n.stage||"independent",kind:n.kind==="part"?"part":"assembly",...(n.kind==="part"?{partId:n.partId}:{})}))),condition);
 if(written===null)return reply({error:"Concurrent tree edit. Reload before saving."},409);
 return reply({ok:true,revision:written?.etag??null});
}
