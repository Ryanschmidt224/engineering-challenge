import {unchanged} from "./project-workspace-commands.js";
import {commitProjectCommand,CommandConflict} from "./project-command.js";
import {statement,uuid,text,itemContext,configurationPlan,currentEngineeringFile,addFileLinks,addEvent,ProjectNotFound,expectedProject} from "./project-state.js";
export const MAX_ENGINE_FILE=20*1024*1024;
export async function readBounded(request,max){
 const reader=request.body?.getReader();if(!reader)return new Uint8Array();const chunks=[];let length=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>max){await reader.cancel();throw Object.assign(Error("File is too large. Maximum 20 MB."),{status:413});}chunks.push(value);}}finally{reader.releaseLock();}
 const all=new Uint8Array(length);let offset=0;for(const chunk of chunks){all.set(chunk,offset);offset+=chunk.length;}return all;
}
export async function bytesHash(bytes){return [...new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))].map(value=>value.toString(16).padStart(2,"0")).join("");}
async function fileRow(db,projectId,id){
 if(!uuid(id))throw new ProjectNotFound("File not found.");const file=await statement(db,"SELECT * FROM engine_files WHERE project_id=? AND id=?",projectId,id).first();if(!file)throw new ProjectNotFound("File not found.");return file;
}
export async function prepareFile(db,input,project,data){
 const name=text(data.name,240,"File name",true),content_type=text(data.content_type===undefined?"application/octet-stream":data.content_type,120,"File type",true);
 if(!/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(content_type))throw Error("Invalid file type.");
 const fileId=crypto.randomUUID(),key="project-engine/files/"+project.id+"/"+fileId;
 return commitProjectCommand(db,input,w=>{w.insert("engine_files",{id:fileId,project_id:project.id,name,content_type,r2_key:key,state:"prepared",created_at:w.createdAt});return {fileId};});
}
// Uploading does not change the build. Only admission can publish a link. A
// failed or stale upload can leave unlinked bytes, never a broken active file.
export async function uploadFile(request,env,owner,project,id){
 const operationId=request.headers.get("x-operation-id"),expectedRevision=request.headers.get("x-project-revision");
 if(!uuid(operationId)||!uuid(expectedRevision))throw Error("Upload requires an operation ID and loaded project revision.");
 const file=await fileRow(env.WORKSHOP_DB,project.id,id),bytes=await readBounded(request,MAX_ENGINE_FILE),hash=await bytesHash(bytes);
 const previous=await env.PHOTOS.head(file.r2_key);
 const matches=object=>object?.customMetadata?.operation_id===operationId&&object.customMetadata.expected_revision===expectedRevision&&object.customMetadata.actor_id===owner.id&&object.customMetadata.sha256===hash&&object.size===bytes.length;
 if(previous){if(!matches(previous))throw new CommandConflict("This file already contains different bytes. Prepare a new file.");return {fileId:id,size:bytes.length,sha256:hash};}
 expectedProject(project,{expectedRevision});if(file.state!=="prepared")throw new CommandConflict("Prepare a new file before uploading.");
 const put=await env.PHOTOS.put(file.r2_key,bytes,{onlyIf:{etagDoesNotMatch:"*"},httpMetadata:{contentType:file.content_type},customMetadata:{operation_id:operationId,expected_revision:expectedRevision,actor_id:owner.id,sha256:hash}});
 if(!put&&!matches(await env.PHOTOS.head(file.r2_key)))throw new CommandConflict("Another upload already used this file. Prepare a new file.");
 return {fileId:id,size:bytes.length,sha256:hash};
}
export async function admitFile(db,env,input,project,id,data){
 const file=await fileRow(db,project.id,id),head=await env.PHOTOS.head(file.r2_key);
 if(!head||head.size>MAX_ENGINE_FILE||!/^[a-f0-9]{64}$/.test(head.customMetadata?.sha256||""))throw new CommandConflict("The upload has not finished. Retry uploading before saving.");
 const ready={...file,state:"ready",size:head.size,sha256:head.customMetadata.sha256};
 if(!["support","engineering"].includes(data.role))throw Error("Choose an engineering file or a supporting attachment.");
 const context=data.role==="engineering"?await itemContext(db,project.id,data.itemId,{occurrenceId:data.occurrenceId,requireOccurrence:true}):null;
 const old=context?await currentEngineeringFile(db,project.id,context.item.id):null;
 const config=context?await configurationPlan(db,project,context.item,context.occurrence,ready):null;
 const currentLink=context?await statement(db,"SELECT id FROM engine_file_links WHERE project_id=? AND item_id=? AND active=1",project.id,context.item.id).first():null;
 const prior=context?await configurationPlan(db,project,context.item,context.occurrence,old,{cache:config.cache}):null;
 if(file.state==="ready"&&(!context||old?.id===id))return {...await unchanged(db,project,input),fileId:id};
 return commitProjectCommand(db,input,w=>{
  if(file.state!=="ready")w.update("engine_files",{state:"ready",size:ready.size,sha256:ready.sha256},{project_id:project.id,id,state:"prepared"});
  let eventId=null;
  if(context){
   prior.write(w);
   // The sole current link ID is read before the transaction and guarded there.
   if(currentLink)w.update("engine_file_links",{active:0},{project_id:project.id,id:currentLink.id,active:1});
   addFileLinks(w,project.id,{item_id:context.item.id},[ready],"engineering");config.write(w);
   eventId=addEvent(w,project.id,context.item.id,"file_replaced",old?"Engineering file replaced":"Engineering file added",{before:prior.id,after:config.id,file_id:id,previous_file_id:old?.id||null,source:{id:context.item.id,name:context.item.name,part_number:context.item.part_number}},file.name);
  }
  return {fileId:id,eventId,configurationId:config?.id||null};
 });
}
export async function downloadFile(env,project,id,inline=false){
 const file=await fileRow(env.WORKSHOP_DB,project.id,id);if(file.state!=="ready")throw new ProjectNotFound("File not found.");
 const object=await env.PHOTOS.get(file.r2_key);if(!object)throw new ProjectNotFound("File bytes are unavailable.");
 const safeImage=inline&&["image/jpeg","image/png","image/webp","image/gif","image/avif"].includes(file.content_type),name=encodeURIComponent(file.name).replace(/'/g,"%27");
 return new Response(object.body,{headers:{"content-type":safeImage?file.content_type:"application/octet-stream","content-disposition":(safeImage?"inline":"attachment")+"; filename*=UTF-8''"+name,"content-length":String(file.size),"cache-control":"private, no-store","x-content-type-options":"nosniff","content-security-policy":"default-src 'none'; sandbox"}});
}
