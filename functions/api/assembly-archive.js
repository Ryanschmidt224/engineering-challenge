import {resolveFunctionalPart} from "./functional-part-model.js";
import {reserveProjectNumbers} from "./numbering.js";
import {historyEntryDetails} from "./history-entry-details.js";
import {workshopArchiveSources,setWorkshopArchiveState} from "./workshop-tree-archive.js";
import {projectAllowed,canEditProject,VALID_PROJECT_ID} from "./projects.js";
import {projectUseTree,getFamilyProjectPart} from "./workshop-db.js";

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const idOK=id=>typeof id==="string"&&/^[a-zA-Z0-9_-]{1,80}$/.test(id);
const uuid=id=>typeof id==="string"&&/^[a-f0-9-]{36}$/i.test(id);
const clone=x=>JSON.parse(JSON.stringify(x));
const read=async(bucket,key,fallback)=>{const object=await bucket.get(key);return {object,value:object?JSON.parse(await object.text()):fallback}};
const conditional=object=>object?.etag?{onlyIf:{etagMatches:object.etag}}:{onlyIf:{etagDoesNotMatch:"*"}};
const prefix=(project,id)=>"assembly-archives/"+project+"/"+id+"/";
const manifestKey=(project,id)=>"assembly-archives/"+project+"/manifests/"+id+".json";
const stableKey=(project,id,original)=>prefix(project,id)+"objects/"+encodeURIComponent(original);
const treeKey=project=>"trees/"+project+".json";
const partKey=project=>"components/"+project+".json";
const investigationKey=project=>"investigations/"+project+".json";
async function listAll(bucket,key,max=700){
 const items=[];let cursor,rounds=0;
 do {
  const page=await bucket.list({prefix:key,limit:1000,...(cursor?{cursor}:{})});
  items.push(...page.objects);
  if(items.length>max)throw Error("Too many related files to archive safely");
  cursor=page.truncated?page.cursor:null;
  if(++rounds>80)throw Error("Storage listing failed to complete");
 }while(cursor);
 return items;
}
const ownerKey=(project,node)=>node.kind==="part"?"part-workspaces/"+project+"/"+node.partId+".json":"workspaces/"+project+"/"+node.id+".json";
const nodeIds=nodes=>new Set(nodes.map(n=>n.id));
export function collectSubtree(nodes,nodeId){
 const result=[],queue=[nodeId],seen=new Set();
 while(queue.length){
  const id=queue.shift();
  if(seen.has(id))throw Error("Circular feature tree");
  seen.add(id);
  const node=nodes.find(n=>n.id===id);
  if(!node)throw Error("Feature-tree item no longer exists");
  result.push(node);
  for(const child of nodes.filter(n=>n.parentId===id))queue.push(child.id);
 }
 return result;
}
function referencedProjectKeys(value,project,out){
 // Preserve referenced R2 file IDs even when the corresponding record is edited later.
 const pattern=new RegExp("(?:recipe-files|part-files|part-pages|drawings|photo-annotations|photo-renders|harnesses|part-photos|part-code|photos)/"+project.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"/[^\\\\\"'\\s]+","g");
 const source=JSON.stringify(value);
 for(const match of source.matchAll(pattern))out.add(match[0].replace(/[,}\\]]+$/,""));
}
export async function archiveAssets(bucket,project,archiveId,subtree,records,parts,{copyKey=stableKey,verify=false,extraKeys=[],includeHistory=false}={}){
 const keys=new Set(extraKeys),required=new Set(extraKeys);
 const references=value=>{
  // Immutable revision bytes are copied through includeHistory below. Their
  // original source paths may have been replaced/deleted since that revision.
  const source=includeHistory?JSON.parse(JSON.stringify(value,(key,value)=>key==="partSnapshot"&&Array.isArray(value?.assets)?undefined:value)):value;
  const linked=new Set();referencedProjectKeys(source,project,linked);for(const key of linked){keys.add(key);required.add(key);}
 };
 const sourceIds=subtree.filter(n=>n.kind!=="part").map(n=>n.id);
 const partIds=[...new Set([...subtree.filter(n=>n.kind==="part").map(n=>n.partId),...parts.map(p=>p.id)])];
 for(const id of sourceIds)for(const k of ["workspaces/"+project+"/"+id+".json","assembly-status/"+project+"/"+id+".json","unstructured-notes/"+project+"/workspace/"+id+".json"])keys.add(k);
 for(const id of partIds){
  for(const k of ["part-workspaces/"+project+"/"+id+".json","harnesses/"+project+"/"+id+".json","component-thumbnails/"+project+"/"+id,"unstructured-notes/"+project+"/part/"+id+".json"])keys.add(k);
  for(const obj of await listAll(bucket,"component-thumbnails/"+project+"/"+id+"/",200))keys.add(obj.key);
  for(const p of ["part-files/"+project+"/"+id+"/","part-pages/"+project+"/"+id+"/","part-code/"+project+"/"+id+"/","drawings/"+project+"/part/"+id+"/"])for(const obj of await listAll(bucket,p,200))keys.add(obj.key);
  if(includeHistory)for(const obj of await listAll(bucket,"part-revisions/"+project+"/"+id+"/",500))keys.add(obj.key);
 }
 for(const id of sourceIds){
  keys.add("assembly-pages/"+project+"/"+id+".json");
  for(const obj of await listAll(bucket,"drawings/"+project+"/assembly/"+id+"/",200))keys.add(obj.key);
 }
 // Assembly gallery images are stored at the project root, identified by
 // metadata rather than by a path scoped to the assembly ID.
 const gallery=await listAll(bucket,project+"/",800);
 const assemblyIds=new Set(sourceIds);
 for(const item of gallery){
  if(!item.key.slice(project.length+1).includes("/")){
   const metadata=await bucket.head(item.key);
   if(assemblyIds.has(metadata?.customMetadata?.assemblyId))keys.add(item.key);
  }
 }
 references({subtree,records,parts});
 // Linked notes, part code and workspace records may refer to more image or
 // document IDs. Follow those references without modifying the source files.
 const linkedRecords=[];
 for(const key of [...keys]){
  if(!key.endsWith(".json"))continue;
  const record=await bucket.get(key);
  if(!record)continue;
  try{
   const parsed=JSON.parse(await record.text());
   linkedRecords.push(parsed);
   references(parsed);
  }catch{ /* Preserve the original object even if an old record is unparseable. */ }
 }
 // Photos are sometimes referenced directly as project/UUID.ext IDs, rather
 // than being nested beneath a photo-files prefix.
 const directPhotos=new RegExp("^"+project+"/[a-f0-9-]{36}\\.(jpg|jpeg|png|webp|gif|heic|heif)$","i");
 const jsonValues=JSON.stringify({subtree,records,parts,linkedRecords});
 for(const photo of gallery)if(directPhotos.test(photo.key)&&jsonValues.includes(photo.key))keys.add(photo.key);
 // Keep the original photo markup and generated rendering with each image.
 for(const key of [...keys])if(/\.(?:jpg|jpeg|png|webp|gif|heic|heif)$/i.test(key)||key.startsWith("component-thumbnails/")){
  keys.add("photo-annotations/"+key+".json");
  keys.add("photo-renders/"+key+".webp");
 }
 const copied=[];let totalBytes=0;
 for(const original of keys){
  if(original.startsWith("assembly-archives/")||original.length>600)continue;
  const object=await bucket.get(original);
  if(!object&&verify&&required.has(original))throw Error("An attached source file is missing. Restore it before creating a revision.");
  if(!object)continue;
  totalBytes+=object.size;
  if(verify&&(object.size>20*1024*1024||totalBytes>100*1024*1024))throw Error("Revision files exceed 20 MB per file or 100 MB total");
  const saved=copyKey(project,archiveId,original),bytes=await object.arrayBuffer();
  const result=await bucket.put(saved,bytes,{httpMetadata:object.httpMetadata,customMetadata:object.customMetadata,...(verify?{onlyIf:{etagDoesNotMatch:"*"}}:{})});
  if(verify){
   const copy=await bucket.get(saved);
   if(!result||!copy||copy.size!==object.size)throw Error("A revision file could not be copied");
   const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",value))).join(",");
   if(await digest(bytes)!==await digest(await copy.arrayBuffer()))throw Error("A revision file failed verification");
  }
  copied.push({original,archive:saved,size:object.size,...(verify?{etag:object.etag,name:object.customMetadata?.filename||original.split("/").pop()}: {})});
  if(copied.length>500)throw Error("Too many referenced files for one archive");
 }
 if(verify)for(const item of copied)if((await bucket.head(item.original))?.etag!==item.etag)throw Error("A source file changed while creating the revision. Reload and try again.");
 return copied;
}
// A snapshot of the path at the exact moment an item leaves the active tree.
// Node IDs are stable, but names and parentage are not; never re-derive this
// for new archives from the future/current tree.
export function archiveOriginPath(tree,nodeId,project,projectName,parts=[]){
 const chain=[],seen=new Set(),index=new Map(tree.map(node=>[node.id,node]));
 let item=index.get(nodeId);
 if(!item)throw Error("Archive source node does not exist");
 while(item){
  if(seen.has(item.id))throw Error("Circular original assembly path");
  seen.add(item.id);
  const component=item.kind==="part"?parts.find(part=>part.id===item.partId):null;
  chain.unshift({id:item.id,kind:item.kind||"assembly",name:item.name,
   partNumber:item.partNumber||component?.partNumber||""});
  if(item.parentId===null||item.parentId===undefined)break;
  item=index.get(item.parentId);
  if(!item)throw Error("Missing parent while capturing original assembly location");
 }
 return [{id:project,kind:"project",name:projectName||project},...chain];
}
function archivedLocation(manifest,tree,projectName){
 if(Array.isArray(manifest.originPath)&&manifest.originPath.length)
  return {originPath:manifest.originPath,originPathSource:"snapshot"};
 const project={id:manifest.project,kind:"project",name:projectName||manifest.project};
 const last={id:manifest.nodeId,kind:manifest.kind,name:manifest.name,partNumber:manifest.partNumber||""};
 if(manifest.parentId==="__root__"||manifest.parentId===null)
  return {originPath:[project,last],originPathSource:"legacy-root"};
 const parent=tree.find(node=>node.id===manifest.parentId);
 if(parent){
  try{
   const current=archiveOriginPath(tree,parent.id,manifest.project,projectName);
   return {originPath:[...current,last],originPathSource:"legacy-current-parent"};
  }catch{}
 }
 return {originPath:[project,{id:manifest.parentId,kind:"unknown",name:"Unknown former parent"},last],
  originPathSource:"legacy-missing-parent"};
}
export function relatedRecords(records,subtree){
 const assemblies=new Set(subtree.filter(n=>n.kind!=="part").map(n=>n.id));
 const parts=new Set(subtree.filter(n=>n.kind==="part").map(n=>n.partId));
 return records.filter(r=>(r.ownerType==="part"&&parts.has(r.ownerId))||(r.ownerType==="assembly"&&assemblies.has(r.ownerId)));
}
async function listArchives(bucket,project,parentId){
 const all=await listAll(bucket,"assembly-archives/"+project+"/manifests/",2000),result=[];
 const tree=await read(bucket,treeKey(project),[]);
 const settings=await read(bucket,"project-settings/"+project+".json",{});
 const projectName=settings.value?.title||project;
 const activeIds=new Set(tree.value.map(node=>node.id));
 for(const item of all){
  if(!item.key.endsWith(".json"))continue;
  const object=await bucket.get(item.key);
  if(!object)continue;
  const manifest=JSON.parse(await object.text());
  if(parentId!==null&&manifest.parentId!==parentId)continue;
  // Prepared manifests remain as recovery artifacts after failed transactions.
  // They are not visible as archives while the source node is still active.
  if(activeIds.has(manifest.nodeId)&&manifest.state==="prepared"&&!manifest.restoredAt)continue;
  result.push({id:manifest.id,nodeId:manifest.nodeId,parentId:manifest.parentId,name:manifest.name,kind:manifest.kind,
   partNumber:manifest.partNumber||"",archivedAt:manifest.archivedAt,restoredAt:manifest.restoredAt||null,
   nodeCount:manifest.nodes.length,partCount:manifest.parts.length,reason:manifest.reason||"",state:manifest.state||"archived",
   ...archivedLocation(manifest,tree.value,projectName)});
 }
 return result.sort((a,b)=>b.archivedAt.localeCompare(a.archivedAt));
}
// Delete exclusively the private copies belonging to this archive ID.
// Never touch the original R2 file paths or any neighboring archive.
export async function purgeArchivedCopies(bucket,project,id){
 if(!VALID_PROJECT_ID.test(project)||!uuid(id))throw Error("Invalid archive identifier");
 const scope=prefix(project,id),objects=await listAll(bucket,scope,700);
 for(const object of objects){
  if(!object.key.startsWith(scope))throw Error("Archive copy outside deletion scope");
  await bucket.delete(object.key);
 }
 return objects.length;
}
export async function handleAssemblyArchive(request,env){
 const url=new URL(request.url),project=url.searchParams.get("project"),bucket=env.PHOTOS;
 if(!VALID_PROJECT_ID.test(project||"")||!await projectAllowed(env,project,request))return json({error:"Project unavailable"},404);
 if(!bucket)return json({error:"Storage unavailable"},503);
 // Existing CAD and saved-part APIs restrict reading to project editors.
 // An archive must not expose those same proprietary files publicly.
 if(!await canEditProject(request,env,project))return json({error:"Project editor access required for archived data"},403);
 if(request.method==="DELETE"){
  // Purge archived parts only. Never delete source keys: an original photo,
  // workspace or part file may still be referenced by an active occurrence.
  const id=url.searchParams.get("id");
  if(!uuid(id))return json({error:"Invalid archived part ID"},400);
  const origin=request.headers?.get?.("origin");
  if(origin&&origin!==url.origin)return json({error:"Cross-origin deletion not permitted"},403);
  const key=manifestKey(project,id),saved=await read(bucket,key,null),archive=saved.value;
  if(!archive||archive.project!==project)return json({error:"Archived part not found"},404);
  if(archive.kind!=="part")return json({error:"Only archived parts can be deleted here"},409);
  if(archive.state==="restoring")
   return json({error:"This part is currently being restored. Reload before deleting."},409);
  const active=await read(bucket,treeKey(project),[]);
  if(archive.state!=="deleting"&&!archive.restoredAt&&
     (archive.state==="prepared"||active.value.some(node=>node.id===archive.nodeId)))
   return json({error:"This archive is not finalized. It may be needed to recover an active part."},409);
  // Claim the manifest before deleting blobs. A failed purge leaves a visible
  // deleting record, so the same request can safely be retried.
  const deleting={...archive,state:"deleting",deleteRequestedAt:archive.deleteRequestedAt||new Date().toISOString()};
  const locked=await bucket.put(key,JSON.stringify(deleting),conditional(saved.object));
  if(locked===null)return json({error:"Archive changed while deleting. Reload and retry."},409);
  try{
   const deletedCopies=await purgeArchivedCopies(bucket,project,id);
   await bucket.delete(key);
   if(await bucket.head(key))return json({error:"The archive record could not be removed. Retry deletion."},503);
   return json({ok:true,id,deletedCopies});
  }catch(error){
   console.error("Archive purge failed",project,id,error);
   return json({error:"Archive deletion was interrupted. The record remains for a safe retry."},503);
  }
 }
 if(request.method==="GET"){
  const id=url.searchParams.get("id"),parent=url.searchParams.get("parent");
  if(id){
   if(!uuid(id))return json({error:"Invalid archive ID"},400);
   const {value}=await read(bucket,manifestKey(project,id),null);
   if(!value)return json({error:"Archive not found"},404);
   if(url.searchParams.has("asset")){
    const index=Number(url.searchParams.get("asset"));
    if(!Number.isSafeInteger(index)||index<0||index>=(value.assets||[]).length)
     return json({error:"Archived attachment not found"},404);
    const item=value.assets[index],copy=await bucket.get(item.archive);
    if(!copy)return json({error:"Archived attachment is missing"},404);
    const type=copy.httpMetadata?.contentType||"application/octet-stream";
    const image=/^image\/(?:jpeg|png|webp|gif|heic|heif)$/.test(type);
    return new Response(copy.body,{headers:{
     "content-type":image?type:"application/octet-stream",
     "content-disposition":image?"inline":"attachment; filename*=UTF-8''"+encodeURIComponent(item.original.split("/").pop()||"archive-file"),
     "cache-control":"private, no-store","x-content-type-options":"nosniff"
    }});
   }
   const tree=await read(bucket,treeKey(project),[]);
   const settings=await read(bucket,"project-settings/"+project+".json",{});
   return json({archive:{...value,displayParts:[...value.parts.map(part=>part.familyUse?part:resolveFunctionalPart(part)),...(value.workshopParts||[])],...archivedLocation(value,tree.value,settings.value?.title||project)}});
  }
  if(parent!==null&&parent!=="__root__"&&!idOK(parent))return json({error:"Invalid parent"},400);
  return json({items:await listArchives(bucket,project,parent)});
 }
 if(request.method!=="POST")return json({error:"Method not allowed"},405);
 const body=await request.json().catch(()=>null);
 if(!body||!["archive","restore"].includes(body.action))return json({error:"Invalid archive action"},400);
 const tree=await read(bucket,treeKey(project),[]);
 const current=await projectUseTree(env,project,tree.value);
 let entryDetails,operationKey,operationRequest;
 if(body.action==="archive"){
  try{entryDetails=historyEntryDetails(body.entryDetails,project);}catch(error){return json({error:error.message},400);}
  if(body.operationId!==undefined&&!uuid(body.operationId))return json({error:"Invalid archive operation ID"},400);
  if(body.operationId){
   operationKey="assembly-archives/"+project+"/operations/"+body.operationId+".json";
   operationRequest=JSON.stringify({nodeId:body.nodeId,expectedRevision:body.expectedRevision??null,reason:String(body.reason||"").slice(0,2500),entryDetails});
   let receipt=(await read(bucket,operationKey,null)).value;
   // A committed manifest is also recovery evidence if saving its index failed.
   if(!receipt&&!current.some(node=>node.id===body.nodeId))for(const item of await listAll(bucket,"assembly-archives/"+project+"/manifests/",2000)){
    const record=(await read(bucket,item.key,null)).value;
    if(record?.operationId===body.operationId&&["archived","restored"].includes(record.state)){receipt={request:record.operationRequest,result:{id:record.id,removedPartIds:record.removedPartIds,count:record.nodes.length}};break;}
   }
   if(receipt){
    if(receipt.request!==operationRequest)return json({error:"This operation ID was used for a different archive request"},409);
    return json({ok:true,...receipt.result,nodes:current,revision:tree.object?.etag??null});
   }
  }
 }

 if(body.expectedRevision!==undefined&&(body.expectedRevision??null)!==(tree.object?.etag??null))
  return json({error:"The feature tree changed. Reload and retry."},409);
 if(body.action==="archive"){
  if(!idOK(body.nodeId))return json({error:"Invalid node"},400);
  const original=current.find(n=>n.id===body.nodeId);
  if(!original)return json({error:"Node no longer exists"},404);
  const subtree=collectSubtree(current,original.id),ids=nodeIds(subtree);
  const affectedDependents=current.filter(n=>!ids.has(n.id)&&(n.dependsOn||[]).some(dep=>ids.has(dep)))
   .map(n=>({id:n.id,dependsOn:n.dependsOn.filter(dep=>ids.has(dep))}));
  const remaining=current.filter(n=>!ids.has(n.id)).map(n=>({...n,dependsOn:(n.dependsOn||[]).filter(dep=>!ids.has(dep))}));
  const partIds=new Set(subtree.filter(n=>n.kind==="part").map(n=>n.partId));
  const componentState=await read(bucket,partKey(project),[]);
  const removedIds=new Set([...partIds].filter(id=>!remaining.some(n=>n.kind==="part"&&n.partId===id)));
  // Wire/material derived components are owned by their source part even
  // when they do not have their own feature-tree node.
  let changed=true;
  while(changed){
   changed=false;
   for(const item of componentState.value){
    if(item.generatedFrom&&removedIds.has(item.generatedFrom)&&!removedIds.has(item.id)&&
       !remaining.some(n=>n.kind==="part"&&n.partId===item.id)){
     removedIds.add(item.id);changed=true;
    }
   }
  }
  let workshop;
  try{workshop=await workshopArchiveSources(env,project,partIds,removedIds);}catch(error){return json({error:error.message},409);}
  const allParts=[...componentState.value.filter(p=>partIds.has(p.id)||removedIds.has(p.id)),...workshop.parts];
  if([...partIds].some(id=>!allParts.some(p=>p.id===id)))
   return json({error:"One or more linked parts are missing their saved definitions. Repair the BOM before archiving."},409);
  const remainingParts=componentState.value.filter(p=>!removedIds.has(p.id));
  const investigationState=await read(bucket,investigationKey(project),{records:[]});
  const entries=relatedRecords(investigationState.value.records||[],subtree);
  const settings=await read(bucket,"project-settings/"+project+".json",{});
  const originPath=archiveOriginPath(current,original.id,project,settings.value?.title||project,allParts);
  const id=crypto.randomUUID(),at=new Date().toISOString();
  const archived={schemaVersion:workshop.uses.length?2:1,id,project,nodeId:original.id,parentId:original.parentId??"__root__",
   kind:original.kind||"assembly",name:original.name,partNumber:original.partNumber||"",
   archivedAt:at,reason:String(body.reason||"").slice(0,2500),restoredAt:null,
   originPath,originPathSource:"snapshot",operationId:body.operationId||null,operationRequest:operationRequest||null,
   nodes:clone(subtree),parts:clone(allParts.filter(part=>!part.familyUse)),workshopParts:clone(workshop.parts),removedPartIds:[...removedIds],
   investigations:clone(entries),entryDetails,workshopUses:workshop.uses,affectedDependents,assets:[],state:"prepared"};
  let usesArchived=false,treeCommitted=false;
  try{
   await reserveProjectNumbers(env,project,subtree,allParts);
   archived.assets=await archiveAssets(bucket,project,id,subtree,[...entries,{entryDetails}],allParts,{verify:true,extraKeys:[...workshop.files,...entryDetails.photos],includeHistory:true});
   await bucket.put(manifestKey(project,id),JSON.stringify(archived));
   await setWorkshopArchiveState(env,project,workshop.uses,0,1,0);usesArchived=true;
   // Write the tree first. Never remove a part definition while the active
   // feature tree still references it. Roll back the tree on a BOM conflict.
   const treeWritten=await bucket.put(treeKey(project),JSON.stringify(remaining),conditional(tree.object));
   if(treeWritten===null){
    await setWorkshopArchiveState(env,project,workshop.uses,1,0,1,{checkSources:false});usesArchived=false;
    return json({error:"Feature tree changed during archiving. No active records were removed.",archiveId:id},409);
   }
   treeCommitted=true;
   if(remainingParts.length!==componentState.value.length){
    const partsWritten=await bucket.put(partKey(project),JSON.stringify(remainingParts),conditional(componentState.object));
    if(partsWritten===null){
     const rolledBack=await bucket.put(treeKey(project),JSON.stringify(current),{onlyIf:{etagMatches:treeWritten.etag}});
     if(rolledBack){treeCommitted=false;await setWorkshopArchiveState(env,project,workshop.uses,1,0,1,{checkSources:false});usesArchived=false;}
     return json({error:rolledBack
      ?"Components changed during archiving. The tree was restored; reload and retry."
      :"Components changed during archiving. The archive is preserved, but the tree needs reconciliation.",
      archiveId:id},409);
    }
   }
   archived.state="archived";
   try{await bucket.put(manifestKey(project,id),JSON.stringify(archived));}
   catch(error){console.error("Archive manifest state update failed",id,error)}
   const result={id,removedPartIds:[...removedIds],count:subtree.length};
   if(operationKey)try{await bucket.put(operationKey,JSON.stringify({request:operationRequest,result}),{onlyIf:{etagDoesNotMatch:"*"}});}catch{ /* The committed manifest supports recovery replay. */ }
   return json({ok:true,...result,nodes:remaining,revision:treeWritten.etag??null});
  }catch(error){
   if(usesArchived&&!treeCommitted){try{await setWorkshopArchiveState(env,project,workshop.uses,1,0,1,{checkSources:false});}catch{archived.state="needs_recovery";await bucket.put(manifestKey(project,id),JSON.stringify(archived));return json({error:"Archive copies were retained, but Workshop flags need reconciliation. No records were deleted.",archiveId:id},503);}}
   return json({error:error.message||"Could not archive item"},409);
  }
 }
 if(!uuid(body.id))return json({error:"Invalid archive ID"},400);
 const stored=await read(bucket,manifestKey(project,body.id),null),archive=stored.value;
 if(!archive||archive.project!==project)return json({error:"Archive not found"},404);
 if(archive.state==="deleting")return json({error:"This archive is being deleted and cannot be restored"},409);
 if(archive.restoredAt)return json({error:"Archive was already restored"},409);
 if(current.some(n=>n.id===archive.nodeId)){
  const complete=archive.nodes.every(node=>current.some(active=>active.id===node.id&&active.kind===node.kind&&active.partId===node.partId));
  if(!complete)return json({error:"An active feature-tree item conflicts with the archived IDs"},409);
  // A previous restore may have completed its tree writes before its final
  // archive-state update. Allow a safe retry to finalize that state.
  archive.restoredAt=new Date().toISOString();archive.state="restored";
  const finished=await bucket.put(manifestKey(project,body.id),JSON.stringify(archive),conditional(stored.object));
  if(finished===null)return json({error:"Archive status changed elsewhere. Reload and retry."},409);
  return json({ok:true,alreadyRestored:true,revision:tree.object?.etag??null,nodes:current,restoredPartIds:[],missing:[]});
 }
 const parent=archive.parentId==="__root__"?null:archive.parentId;
 if(parent&&!current.some(n=>n.id===parent&&n.kind!=="part"))return json({error:"Original parent no longer exists"},409);
 const conflicts=archive.nodes.filter(n=>current.some(item=>item.id===n.id));
 if(conflicts.length)return json({error:"Some archived node IDs are in use"},409);
 const componentState=await read(bucket,partKey(project),[]);
 const incoming=archive.parts.filter(p=>!p.familyUse&&!componentState.value.some(existing=>existing.id===p.id));
 const changedShared=archive.parts.find(p=>{
  const active=componentState.value.find(existing=>existing.id===p.id);
  return active&&JSON.stringify(active)!==JSON.stringify(p);
 });
 if(changedShared)return json({error:"A shared archived part has been modified since archiving. Restore it as a new part instead of overwriting an active part."},409);
 const existingAssemblyNumbers=new Set(current.filter(n=>n.kind!=="part").map(n=>n.partNumber).filter(Boolean));
 const existingPartNumbers=new Set(componentState.value.map(p=>p.partNumber).filter(Boolean));
 if(archive.nodes.some(n=>n.kind!=="part"&&n.partNumber&&existingAssemblyNumbers.has(n.partNumber))||
    incoming.some(p=>p.partNumber&&existingPartNumbers.has(p.partNumber)))
  return json({error:"An archived part number is already in use. Resolve the conflict before restoring."},409);
 const nextParts=[...componentState.value,...incoming];
 const restoredNodes=archive.nodes.map(n=>({...n,dependsOn:(n.dependsOn||[]).filter(dep=>current.some(active=>active.id===dep)||archive.nodes.some(child=>child.id===dep))}));
 const dependencyMap=new Map((archive.affectedDependents||[]).map(item=>[item.id,item.dependsOn]));
 const nextTree=[
  ...current.map(n=>({...n,dependsOn:[...new Set([...(n.dependsOn||[]),...(dependencyMap.get(n.id)||[])])]})),
  ...restoredNodes
 ];
 // Verify every affected Workshop row before restoring R2 membership.
 // A changed reusable source requires review rather than a silent replacement.
 const workshopUses=archive.workshopUses||[];
 // Restore all missing file bytes before the tree becomes visible again.
 // If a backup copy is absent, fail without touching the active BOM/tree.
 const missing=[],toRestore=[];
 for(const asset of archive.assets||[]){
  const active=await bucket.head(asset.original);
  if(active){
   if(asset.etag&&active.etag!==asset.etag){
    const currentFile=await bucket.get(asset.original),savedFile=await bucket.get(asset.archive);
    const hash=async file=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",await file.arrayBuffer()))).join(",");
    if(!currentFile||!savedFile||await hash(currentFile)!==await hash(savedFile))return json({error:"A saved file changed after archiving. Review it before restoring this item."},409);
   }
   continue;
  }
  const copy=await bucket.get(asset.archive);
  if(!copy){missing.push(asset.original);continue}
  toRestore.push({key:asset.original,copy});
 }
 if(missing.length)return json({error:"An archived file is missing from both active storage and the snapshot",missing},409);
 for(const entry of toRestore)
  await bucket.put(entry.key,await entry.copy.arrayBuffer(),{
   httpMetadata:entry.copy.httpMetadata,customMetadata:entry.copy.customMetadata
  });
 let partsWritten=null;
 if(incoming.length){
  partsWritten=await bucket.put(partKey(project),JSON.stringify(nextParts),conditional(componentState.object));
  if(partsWritten===null)return json({error:"Component data changed. Reload and retry."},409);
 }
 try{await setWorkshopArchiveState(env,project,workshopUses,1,0,1);}catch(error){
  if(partsWritten)await bucket.put(partKey(project),JSON.stringify(componentState.value),{onlyIf:{etagMatches:partsWritten.etag}});
  return json({error:error.message},409);
 }
 let treeWritten;try{treeWritten=await bucket.put(treeKey(project),JSON.stringify(nextTree),conditional(tree.object));}catch{treeWritten=null;}
 if(treeWritten===null){
  try{await setWorkshopArchiveState(env,project,workshopUses,0,1,2,{checkSources:false});}catch{return json({error:"Restored bytes were retained, but Workshop flags need reconciliation. No saved archive was deleted."},503);}
  archive.workshopUses=workshopUses.map(use=>({...use,revision:use.revision+2}));await bucket.put(manifestKey(project,body.id),JSON.stringify(archive),conditional(stored.object));
  if(partsWritten)await bucket.put(partKey(project),JSON.stringify(componentState.value),{onlyIf:{etagMatches:partsWritten.etag}});
  return json({error:"Feature tree changed. Reload and retry."},409);
 }
 // Copies have already been verified and restored before tree activation.
 // Merge only missing investigation records; never overwrite newer ones.
 const investigationState=await read(bucket,investigationKey(project),{records:[],revision:null});
 const missingRecords=(archive.investigations||[]).filter(r=>!(investigationState.value.records||[]).some(existing=>existing.id===r.id));
 if(missingRecords.length){
  await bucket.put(investigationKey(project),JSON.stringify({...investigationState.value,records:[...(investigationState.value.records||[]),...missingRecords],revision:crypto.randomUUID()}),conditional(investigationState.object));
 }
 archive.restoredAt=new Date().toISOString();archive.state="restored";
 await bucket.put(manifestKey(project,body.id),JSON.stringify(archive),conditional(stored.object));
 return json({ok:true,revision:treeWritten.etag??null,nodes:nextTree,restoredPartIds:incoming.map(p=>p.id),missing});
}
