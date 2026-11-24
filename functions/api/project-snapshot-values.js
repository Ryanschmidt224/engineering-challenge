import {canonicalJSON,sha256} from "./project-command.js";
import {statement,uuid} from "./project-state.js";

// Frozen values are project-owned and content-deduplicated. A checkpoint stores
// their IDs rather than copying every record/instruction/audit on each save.
export const snapshotKinds=["step","record","configuration","event","link","file","selection"];
export async function snapshotValuePlan(db,projectId){
 const existing=(await statement(db,"SELECT id,kind,fingerprint FROM engine_snapshot_values WHERE project_id=?",projectId).all()).results;
 const known=new Map(existing.map(row=>[row.kind+":"+row.fingerprint,row.id])),pending=[];
 return {
  async reference(kind,value){
   if(value===null)return null;
   if(!snapshotKinds.includes(kind))throw Error("Unsupported saved value.");
   const snapshot=canonicalJSON(value),fingerprint=await sha256(snapshot),key=kind+":"+fingerprint;
   if(known.has(key))return known.get(key);
   if(new TextEncoder().encode(snapshot).length>500000)throw Error("One saved value exceeds the supported size. Nothing was changed.");
   const id=crypto.randomUUID();known.set(key,id);pending.push({id,project_id:projectId,kind,fingerprint,snapshot});return id;
  },
  write(w){for(const row of pending)w.insert("engine_snapshot_values",{...row,created_at:w.createdAt});}
 };
}

const fields={steps:"step",records:"record",configurations:"configuration",record_events:"event",file_links:"link",files:"file",file:"file",selection:"selection"};
function referenceEntries(part){
 if(part?.format!==5||!part.references||typeof part.references!=="object"||Array.isArray(part.references))throw Error("The saved revision is incomplete.");
 for(const name of ["steps","records","configurations","record_events","file_links","files"])if(!Array.isArray(part.references[name]))throw Error("The saved revision is missing a reference list.");
 if(!Object.hasOwn(part.references,"file")||part.references.file!==null&&!uuid(part.references.file))throw Error("The saved revision has an invalid file reference.");
 const result=[];
 for(const [name,refs]of Object.entries(part.references)){
  if(!Object.hasOwn(fields,name))throw Error("The saved revision has an unsupported reference.");
  if(name==="selection"&&!uuid(refs))throw Error("The saved revision has an invalid selection reference.");
  for(const id of Array.isArray(refs)?refs:refs===null?[]:[refs]){if(!uuid(id))throw Error("The saved revision has an invalid reference.");result.push({id,kind:fields[name]});}
 }
 return result;
}
export async function expandProjectSnapshot(db,projectId,snapshot){
 if(snapshot?.format!==5)return snapshot;
 const parts=[snapshot,...(snapshot.parts||[])],ids=new Set();
 for(const part of parts)for(const {id}of referenceEntries(part))ids.add(id);
 const rows=(await statement(db,"SELECT * FROM engine_snapshot_values WHERE project_id=? AND id IN(SELECT value FROM json_each(?))",projectId,JSON.stringify([...ids])).all()).results,values=new Map();
 for(const row of rows){const value=JSON.parse(row.snapshot);if(await sha256(canonicalJSON(value))!==row.fingerprint)throw Error("A saved revision value failed verification.");values.set(row.id,{kind:row.kind,value});}
 const expand=part=>{
  const result={...part};
  for(const [name,refs]of Object.entries(part.references)){
   const read=id=>{const saved=values.get(id);if(!saved||saved.kind!==fields[name])throw Error("A saved revision value is missing. Recover from a complete project backup.");return saved.value;};
   result[name]=Array.isArray(refs)?refs.map(read):refs===null?null:read(refs);
  }
  if(part.parts)result.parts=part.parts.map(expand);return result;
 };
 return expand(snapshot);
}

// Backup checks run before admission. Missing frozen values must never yield a
// superficially successful recovery of an unreadable historical checkpoint.
export function validateSnapshotReferences(tables,values=new Map(tables.snapshot_values.map(row=>[row.id,row]))){
 for(const event of tables.events){
  const snapshot=JSON.parse(event.payload).snapshot;if(snapshot?.format!==5)continue;
  for(const part of [snapshot,...(snapshot.parts||[])])for(const {id,kind}of referenceEntries(part))if(!values.has(id)||values.get(id).kind!==kind)throw Error("Backup is missing a saved revision value.");
 }
}
export async function verifySnapshotValues(values){
 for(const row of values){
  if(!snapshotKinds.includes(row.kind)||!/^[a-f0-9]{64}$/.test(row.fingerprint)||typeof row.snapshot!=="string"||new TextEncoder().encode(row.snapshot).length>500000)throw Error("Invalid saved revision value in backup.");
  if(await sha256(canonicalJSON(JSON.parse(row.snapshot)))!==row.fingerprint)throw Error("A saved revision value failed its backup hash check.");
 }
}
