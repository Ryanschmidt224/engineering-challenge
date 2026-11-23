import {capturePartRevision} from "./part-revision-snapshot.js";
import {historyEntryDetails} from "./history-entry-details.js";
import {revisionRecordKey,revisionLevel,partRevisionRecords,mergeRevisionRecords} from "./part-revision-records.js";
import {encodeFunctionalPart} from "./functional-part-model.js";
import {dbRows,getFamilyProjectPart,projectFamilyParts} from "./workshop-db.js";

const fail=(message,status=409)=>Object.assign(Error(message),{status});
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==="object"?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
export async function revisionCommand(input,project){
 const entryDetails=historyEntryDetails(input.entryDetails,project),operationId=input.operationId;
 if(!/^[a-f0-9-]{36}$/i.test(operationId||""))throw fail("Invalid revision operation",400);
 const bytes=new TextEncoder().encode(JSON.stringify(stable({...input,entryDetails,expectedRevision:input.action==="createPartRevision"?undefined:input.expectedRevision})));
 const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",bytes));
 return {entryDetails,operationId,fingerprint:[...digest].map(byte=>byte.toString(16).padStart(2,"0")).join("")};
}
export function revisionReplay(part,command){
 const existing=part.revisionHistory?.find(ref=>ref.operationId===command.operationId);
 if(existing&&existing.fingerprint!==command.fingerprint)throw fail("This operation ID was already used for different revision changes");
 return existing;
}
export async function prepareRevision(request,env,project,input,part,command,records){
 const refs=part.revisionHistory||[];
 if(refs.length>=300)throw fail("Part revision history is full",413);
 if(!records){const file=await env.PHOTOS.get("investigations/"+project+".json");records=file?(await file.json()).records||[]:[];}
 const sources=part.familyUse?{
  family:await env.WORKSHOP_DB.prepare("SELECT revision FROM workshop_families WHERE id=?").bind(part.familyId).first(),
  product:part.productId?await env.WORKSHOP_DB.prepare("SELECT revision FROM workshop_products WHERE id=?").bind(part.productId).first():null
 }:null;
 const workspaceKey="part-workspaces/"+project+"/"+part.id+".json",workspaceEtag=(await env.PHOTOS.head(workspaceKey))?.etag;
 records=mergeRevisionRecords(records,await partRevisionRecords(env,project));
 if(records.length>=300)throw fail("Project revision and record history is full",413);
 const captured=await capturePartRevision(request,env,project,{partId:part.id,operationId:command.operationId,entryDetails:command.entryDetails,
  expectedPartRevision:Object.hasOwn(input,"expectedPartRevision")?input.expectedPartRevision:input.expectedRevision??null,expectedWorkspaceRevision:input.expectedWorkspaceRevision??null},records);
 if(captured.error)throw fail(captured.error,captured.status);
 const record=captured.record,level=revisionLevel(part);
 record.partRevisionRef=true;record.partSnapshot.part.revisionLevel=level;
 record.title="Revision "+level+": "+String(part.name||"Part").slice(0,160);
 const key=revisionRecordKey(project,part.id,record.id),serialized=JSON.stringify(record);
 await env.PHOTOS.put(key,serialized,{onlyIf:{etagDoesNotMatch:"*"}});
 const verified=await env.PHOTOS.get(key);
 if(!verified||await verified.text()!==serialized)throw fail("The saved revision could not be verified. Your working part was not changed.");
 if((await env.PHOTOS.head(workspaceKey))?.etag!==workspaceEtag)throw fail("Instructions changed during copying. Your working part was not changed.");
 return {record,sources,fields:{revisionLevel:level+1,revisionHistory:[...refs,{id:record.id,operationId:command.operationId,fingerprint:command.fingerprint,level,createdAt:record.createdAt}]}};
}

export async function createRevision(request,env,project,input,records){
 const key="components/"+project+".json",object=await env.PHOTOS.get(key),parts=object?await object.json():[];
 const part=parts.find(part=>part.id===input.partId)||await getFamilyProjectPart(env,project,input.partId);
 if(!part)throw fail("Part no longer exists",404);
 const command=await revisionCommand(input,project),replay=revisionReplay(part,command);
 if(replay)return {createdId:replay.id,component:part};
 const prepared=await prepareRevision(request,env,project,input,part,command,records);
 let component;
 if(part.familyUse){
  const use=(await dbRows(env.WORKSHOP_DB,"SELECT * FROM workshop_uses WHERE id=? AND project_id=? AND archived=0",part.id,project))[0];
  const state={...use.project_state,...prepared.fields};
  const result=await env.WORKSHOP_DB.prepare("UPDATE workshop_uses SET project_state=?,revision=revision+1 WHERE id=? AND project_id=? AND archived=0 AND revision=? AND EXISTS(SELECT 1 FROM workshop_families WHERE id=? AND revision=?) AND (? IS NULL OR EXISTS(SELECT 1 FROM workshop_products WHERE id=? AND revision=?))").bind(JSON.stringify(state),part.id,project,Number(part.revision),part.familyId,prepared.sources.family?.revision??null,part.productId,part.productId,prepared.sources.product?.revision??null).run();
  if(!result.meta.changes)throw fail("This project part changed. Reload before creating a revision.");
  component=await getFamilyProjectPart(env,project,part.id);
 }else{
  component={...part,...prepared.fields,revision:crypto.randomUUID()};
  const next=parts.map(item=>item.id===part.id?encodeFunctionalPart(component):item);
  const result=await env.PHOTOS.put(key,JSON.stringify(next),{onlyIf:{etagMatches:object.etag}});
  if(result===null)throw fail("The part changed during copying. Reload before creating a revision.");
 }
 return {createdId:prepared.record.id,component};
}

export async function removeReferencedRevision(env,project,id){
 const key="components/"+project+".json",object=await env.PHOTOS.get(key),parts=object?await object.json():[];
 for(const part of [...parts,...await projectFamilyParts(env,project)]){
  if(!part.revisionHistory?.some(ref=>ref.id===id))continue;
  const refs=part.revisionHistory.map(ref=>ref.id===id?{...ref,deleted:true}:ref);
  if(part.familyUse){
   const use=(await dbRows(env.WORKSHOP_DB,"SELECT * FROM workshop_uses WHERE id=? AND project_id=? AND archived=0",part.id,project))[0];
   const result=await env.WORKSHOP_DB.prepare("UPDATE workshop_uses SET project_state=?,revision=revision+1 WHERE id=? AND revision=?").bind(JSON.stringify({...use.project_state,revisionHistory:refs}),part.id,Number(part.revision)).run();
   if(!result.meta.changes)throw fail("Part history changed elsewhere. Reload before deleting.");
  }else{
   const result=await env.PHOTOS.put(key,JSON.stringify(parts.map(item=>item.id===part.id?{...item,revisionHistory:refs,revision:crypto.randomUUID()}:item)),{onlyIf:{etagMatches:object.etag}});
   if(result===null)throw fail("Part history changed elsewhere. Reload before deleting.");
  }
  return true;
 }
 return false;
}

export async function revisionResponse(env,project,legacy){return mergeRevisionRecords(legacy,await partRevisionRecords(env,project));}
