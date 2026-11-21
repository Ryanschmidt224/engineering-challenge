import {projectAllowed,canEditProject,VALID_PROJECT_ID} from "./projects.js";

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
async function archiveAssets(bucket,project,archiveId,subtree,records,parts){
 const keys=new Set();
 const sourceIds=subtree.filter(n=>n.kind!=="part").map(n=>n.id);
 const partIds=[...new Set(subtree.filter(n=>n.kind==="part").map(n=>n.partId))];
 for(const id of sourceIds)for(const k of ["workspaces/"+project+"/"+id+".json","assembly-status/"+project+"/"+id+".json","unstructured-notes/"+project+"/workspace/"+id+".json"])keys.add(k);
 for(const id of partIds){
  for(const k of ["part-workspaces/"+project+"/"+id+".json","harnesses/"+project+"/"+id+".json","component-thumbnails/"+project+"/"+id,"unstructured-notes/"+project+"/part/"+id+".json"])keys.add(k);
  for(const obj of await listAll(bucket,"component-thumbnails/"+project+"/"+id+"/",200))keys.add(obj.key);
  for(const p of ["part-files/"+project+"/"+id+"/","part-pages/"+project+"/"+id+"/","part-code/"+project+"/"+id+"/","drawings/"+project+"/part/"+id+"/"])for(const obj of await listAll(bucket,p,200))keys.add(obj.key);
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
 referencedProjectKeys({subtree,records,parts},project,keys);
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
   referencedProjectKeys(parsed,project,keys);
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
 const copied=[];
 for(const original of keys){
  if(original.startsWith("assembly-archives/")||original.length>600)continue;
  const object=await bucket.get(original);
  if(!object)continue;
  const saved=stableKey(project,archiveId,original);
  await bucket.put(saved,await object.arrayBuffer(),{httpMetadata:object.httpMetadata,customMetadata:object.customMetadata});
  copied.push({original,archive:saved,size:object.size});
  if(copied.length>500)throw Error("Too many referenced files for one archive");
 }
 return copied;
}
export function relatedRecords(records,subtree){
 const assemblies=new Set(subtree.filter(n=>n.kind!=="part").map(n=>n.id));
 const parts=new Set(subtree.filter(n=>n.kind==="part").map(n=>n.partId));
 return records.filter(r=>(r.ownerType==="part"&&parts.has(r.ownerId))||(r.ownerType==="assembly"&&assemblies.has(r.ownerId)));
}
async function listArchives(bucket,project,parentId){
 const all=await listAll(bucket,"assembly-archives/"+project+"/manifests/",2000),result=[];
 const tree=await read(bucket,treeKey(project),[]);
 const activeIds=new Set(tree.value.map(node=>node.id));
 for(const item of all){
  if(!item.key.endsWith(".json"))continue;
  const object=await bucket.get(item.key);
  if(!object)continue;
  const manifest=JSON.parse(await object.text());
  if(parentId!==null&&manifest.parentId!==parentId)continue;
  // Prepared manifests remain as recovery artifacts after failed transactions.
  // They are not visible as archives while the source node is still active.
  if(activeIds.has(manifest.nodeId)&&!manifest.restoredAt)continue;
  result.push({id:manifest.id,nodeId:manifest.nodeId,parentId:manifest.parentId,name:manifest.name,kind:manifest.kind,
   partNumber:manifest.partNumber||"",archivedAt:manifest.archivedAt,restoredAt:manifest.restoredAt||null,
   nodeCount:manifest.nodes.length,partCount:manifest.parts.length,reason:manifest.reason||""});
 }
 return result.sort((a,b)=>b.archivedAt.localeCompare(a.archivedAt));
}
export async function handleAssemblyArchive(request,env){
 const url=new URL(request.url),project=url.searchParams.get("project"),bucket=env.PHOTOS;
 if(!VALID_PROJECT_ID.test(project||"")||!await projectAllowed(env,project,request))return json({error:"Project unavailable"},404);
 if(!bucket)return json({error:"Storage unavailable"},503);
 if(request.method==="GET"){
  const id=url.searchParams.get("id"),parent=url.searchParams.get("parent");
  if(id){
   if(!uuid(id))return json({error:"Invalid archive ID"},400);
   const {value}=await read(bucket,manifestKey(project,id),null);
   if(!value)return json({error:"Archive not found"},404);
   return json({archive:value});
  }
  if(parent!==null&&parent!=="__root__"&&!idOK(parent))return json({error:"Invalid parent"},400);
  return json({items:await listArchives(bucket,project,parent)});
 }
 if(request.method!=="POST")return json({error:"Method not allowed"},405);
 if(!await canEditProject(request,env,project))return json({error:"Edit permission required"},403);
 const body=await request.json().catch(()=>null);
 if(!body||!["archive","restore"].includes(body.action))return json({error:"Invalid archive action"},400);
 const tree=await read(bucket,treeKey(project),[]);
 const current=tree.value;
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
  const removedIds=new Set([...partIds].filter(id=>!remaining.some(n=>n.kind==="part"&&n.partId===id)));
  const componentState=await read(bucket,partKey(project),[]);
  const ownedParts=componentState.value.filter(p=>removedIds.has(p.id));
  const allParts=componentState.value.filter(p=>partIds.has(p.id));
  const remainingParts=componentState.value.filter(p=>!removedIds.has(p.id));
  const investigationState=await read(bucket,investigationKey(project),{records:[]});
  const entries=relatedRecords(investigationState.value.records||[],subtree);
  const id=crypto.randomUUID(),at=new Date().toISOString();
  const archived={schemaVersion:1,id,project,nodeId:original.id,parentId:original.parentId??"__root__",
   kind:original.kind||"assembly",name:original.name,partNumber:original.partNumber||"",
   archivedAt:at,reason:String(body.reason||"").slice(0,2500),restoredAt:null,
   nodes:clone(subtree),parts:clone(allParts),removedPartIds:[...removedIds],
   investigations:clone(entries),affectedDependents,assets:[],state:"prepared"};
  try{
   archived.assets=await archiveAssets(bucket,project,id,subtree,entries,allParts);
   await bucket.put(manifestKey(project,id),JSON.stringify(archived));
   // Save components first: on tree conflict the previous component data is restored
   // conditionally. The archive itself remains as the recovery record.
   let partsWritten=null;
   if(removedIds.size){
    partsWritten=await bucket.put(partKey(project),JSON.stringify(remainingParts),conditional(componentState.object));
    if(partsWritten===null)return json({error:"Components changed during archiving. Refresh and retry.",archiveId:id},409);
   }
   const treeWritten=await bucket.put(treeKey(project),JSON.stringify(remaining),conditional(tree.object));
   if(treeWritten===null){
    if(partsWritten)await bucket.put(partKey(project),JSON.stringify(componentState.value),{onlyIf:{etagMatches:partsWritten.etag}});
    return json({error:"Feature tree changed during archiving. No tree items were removed.",archiveId:id},409);
   }
   archived.state="archived";
   try{await bucket.put(manifestKey(project,id),JSON.stringify(archived));}
   catch(error){console.error("Archive manifest state update failed",id,error)}
   return json({ok:true,id,nodes:remaining,revision:treeWritten.etag??null,
    removedPartIds:[...removedIds],count:subtree.length});
  }catch(error){return json({error:error.message||"Could not archive item"},500)}
 }
 if(!uuid(body.id))return json({error:"Invalid archive ID"},400);
 const stored=await read(bucket,manifestKey(project,body.id),null),archive=stored.value;
 if(!archive||archive.project!==project)return json({error:"Archive not found"},404);
 if(archive.restoredAt)return json({error:"Archive was already restored"},409);
 if(current.some(n=>n.id===archive.nodeId))return json({error:"Item is still active or its ID conflicts with another item"},409);
 const parent=archive.parentId==="__root__"?null:archive.parentId;
 if(parent&&!current.some(n=>n.id===parent&&n.kind!=="part"))return json({error:"Original parent no longer exists"},409);
 const conflicts=archive.nodes.filter(n=>current.some(item=>item.id===n.id));
 if(conflicts.length)return json({error:"Some archived node IDs are in use"},409);
 const componentState=await read(bucket,partKey(project),[]);
 const incoming=archive.parts.filter(p=>!componentState.value.some(existing=>existing.id===p.id));
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
 // Restore all missing file bytes before the tree becomes visible again.
 // If a backup copy is absent, fail without touching the active BOM/tree.
 const missing=[],toRestore=[];
 for(const asset of archive.assets||[]){
  if(await bucket.head(asset.original))continue;
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
 const treeWritten=await bucket.put(treeKey(project),JSON.stringify(nextTree),conditional(tree.object));
 if(treeWritten===null){
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
