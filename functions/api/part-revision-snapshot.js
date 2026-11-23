import {archiveAssets} from "./assembly-archive.js";
import {getFamilyProjectPart} from "./workshop-db.js";
import {resolveFunctionalPart} from "./functional-part-model.js";
import {partPhotoKey,getPartPhoto} from "./workshop-linked-part.js";

export async function capturePartRevision(request,env,project,data,records){
 const partKey="components/"+project+".json",partObject=await env.PHOTOS.get(partKey);
 const parts=partObject?await partObject.json():[];
 const raw=parts.find(part=>part.id===data.partId)||await getFamilyProjectPart(env,project,data.partId);
 if(!raw)return {error:"Part no longer exists",status:404};
 const part=raw.familyUse?raw:resolveFunctionalPart(raw);
 if((data.expectedPartRevision??null)!==(part.revision??null))return {error:"This part changed since you opened it. Reload before creating a revision.",status:409};
 const workspaceKey="part-workspaces/"+project+"/"+part.id+".json",workspaceObject=await env.PHOTOS.get(workspaceKey),workspace=workspaceObject?await workspaceObject.json():{};
 if((data.expectedWorkspaceRevision??null)!==(workspace.revision??null))return {error:"Instructions changed since you opened them. Reload before creating a revision.",status:409};
 const id=crypto.randomUUID(),createdAt=new Date().toISOString();
 const snapshot={part,workspace,entryDetails:data.entryDetails,records:records.filter(record=>record.ownerType==="part"&&record.ownerId===part.id&&!record.partSnapshot),capturedAt:createdAt};
 const extraKeys=[];let photoSource=partPhotoKey(project,part);
 if(part.familyUse&&env.WORKSHOP_DB){
  const attachments=await env.WORKSHOP_DB.prepare("SELECT r2_key,kind FROM workshop_attachments WHERE archived=0 AND (use_id=? OR family_id=? OR product_id=?)").bind(part.id,part.familyId,part.productId).all();
  for(const file of attachments.results)if(file.r2_key)extraKeys.push(file.r2_key);
  photoSource=attachments.results.find(file=>file.kind==="photo")?.r2_key||photoSource;
 }else{
  const photo=await getPartPhoto(request,env,project,part);
  if(photo?.key){photoSource=photo.key;extraKeys.push(photo.key);}
 }
 if(JSON.stringify(snapshot).length>250000)return {error:"Part history is too large to snapshot",status:413};
 try{
  snapshot.assets=await archiveAssets(env.PHOTOS,project,id,[{kind:"part",partId:part.id}],[...snapshot.records,{entryDetails:data.entryDetails}],[part],{
   copyKey:(_,revision,key)=>"part-revisions/"+project+"/"+part.id+"/"+revision+"/objects/"+encodeURIComponent(key),verify:true,extraKeys
  });
 }catch(error){return {error:error.message,status:409};}
 if(JSON.stringify(snapshot).length>500000)return {error:"Part history and file list are too large to snapshot",status:413};
 const photo=snapshot.assets.find(file=>file.original===photoSource);
 if(photo)snapshot.thumbnailKey=photo.archive;
 // Recheck independent source owners before publishing the historical record.
 // R2 cannot provide a cross-object transaction; no source is changed here.
 if((await env.PHOTOS.head(partKey))?.etag!==partObject?.etag||(await env.PHOTOS.head(workspaceKey))?.etag!==workspaceObject?.etag)
  return {error:"The part or instructions changed during copying. Reload before creating a revision.",status:409};
 if(part.familyUse&&JSON.stringify(await getFamilyProjectPart(env,project,part.id))!==JSON.stringify(raw))return {error:"Workshop information changed during copying. Reload before creating a revision.",status:409};
 return {record:{id,scope:"part",ownerType:"part",ownerId:part.id,stepId:"",category:"revision",
  title:"Revision: "+String(part.name||"Part").slice(0,160),status:"resolved",date:createdAt.slice(0,10),
  lifecycle:"revision",partSnapshot:snapshot,createdAt,operationId:data.operationId,
  revisionRequest:{expectedPartRevision:data.expectedPartRevision??null,expectedWorkspaceRevision:data.expectedWorkspaceRevision??null},entries:[]}};
}
