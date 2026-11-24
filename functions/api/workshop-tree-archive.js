import {getFamilyProjectPart} from "./workshop-db.js";

// Archive existing project uses, never reusable families/products. One guarded
// D1 statement changes all affected flags or none. R2 publication and recovery
// remain explicit in the enclosing legacy archive operation.
export async function workshopArchiveSources(env,project,partIds,removedIds){
 const parts=[],uses=[],files=[];
 if(!env.WORKSHOP_DB)return {parts,uses,files};
 for(const id of partIds){
  const part=await getFamilyProjectPart(env,project,id);if(!part)continue;parts.push(part);
  if(removedIds.has(id)){
   const row=await env.WORKSHOP_DB.prepare("SELECT u.id,u.revision,u.family_id,u.product_id,f.revision AS familyRevision,p.revision AS productRevision FROM workshop_uses u JOIN workshop_families f ON f.id=u.family_id LEFT JOIN workshop_products p ON p.id=u.product_id WHERE u.id=? AND u.project_id=? AND u.archived=0").bind(id,project).first();
   if(!row)throw Error("A Workshop project use changed before archiving");uses.push(row);
  }
  const attachments=await env.WORKSHOP_DB.prepare("SELECT r2_key FROM workshop_attachments WHERE archived=0 AND (use_id=? OR family_id=? OR product_id=?)").bind(id,part.familyId,part.productId).all();
  files.push(...attachments.results.map(file=>file.r2_key).filter(Boolean));
 }
 return {parts,uses,files:[...new Set(files)]};
}

export async function setWorkshopArchiveState(env,project,uses,from,to,revisionOffset,{checkSources=true}={}){
 if(!uses?.length)return;
 if(!env.WORKSHOP_DB)throw Error("Workshop storage is unavailable; archive state was retained");
 const expected=JSON.stringify(uses.map(use=>({...use,revision:use.revision+revisionOffset})));
 const sources=checkSources?" AND f.revision=json_extract(j.value,'$.familyRevision') AND COALESCE(p.revision,0)=COALESCE(json_extract(j.value,'$.productRevision'),0)":"";
 const result=await env.WORKSHOP_DB.prepare(`UPDATE workshop_uses SET archived=?,revision=revision+1
 WHERE project_id=? AND id IN (SELECT json_extract(value,'$.id') FROM json_each(?))
 AND (SELECT COUNT(*) FROM workshop_uses u JOIN json_each(?) j ON u.id=json_extract(j.value,'$.id')
 LEFT JOIN workshop_families f ON f.id=u.family_id LEFT JOIN workshop_products p ON p.id=u.product_id
 WHERE u.project_id=? AND u.archived=? AND u.revision=json_extract(j.value,'$.revision')${sources})=?`).bind(to,project,expected,expected,project,from,uses.length).run();
 if(result.meta.changes!==uses.length)throw Error("Workshop project uses or their source facts changed. Reload and review before archiving or restoring.");
}
