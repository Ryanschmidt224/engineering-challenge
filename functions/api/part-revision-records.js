import {projectFamilyParts} from "./workshop-db.js";

export const revisionRecordKey=(project,part,id)=>`part-revisions/${project}/${part}/${id}/record.json`;
export const revisionLevel=part=>Number.isSafeInteger(part?.revisionLevel)&&part.revisionLevel>0?part.revisionLevel:1;

// The part owns membership in history. Immutable copies are written first;
// its counter and reference list are then committed together with the edit.
export async function partRevisionRecords(env,project,parts=null){
 if(!parts){const file=await env.PHOTOS.get("components/"+project+".json");parts=[...(file?await file.json():[]),...await projectFamilyParts(env,project)];}
 const records=[];
 for(const part of parts)for(const ref of part.revisionHistory||[]){
  if(ref.deleted)continue;
  if(!/^[a-f0-9-]{36}$/i.test(ref.id))throw Error("Invalid saved revision reference");
  const file=await env.PHOTOS.get(revisionRecordKey(project,part.id,ref.id));
  if(!file)throw Error("A saved revision is missing. Restore its backup before editing history.");
  const record=await file.json();
  if(record.id!==ref.id||record.ownerId!==part.id||!record.partSnapshot)throw Error("Saved revision does not match its part");
  records.push(record);
 }
 return records;
}
export const mergeRevisionRecords=(legacy,current)=>[...new Map([...legacy,...current].map(record=>[record.id,record])).values()];
