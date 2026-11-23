import {canonicalJSON,sha256,CommandConflict} from "./project-command.js";
import {normalizeCustomItem,normalizeOccurrence} from "../../assets/project-item-model.js";
export const uuid=value=>typeof value==="string"&&/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(value);
export const statement=(db,sql,...values)=>db.prepare(sql).bind(...values);
export async function rows(db,sql,...values){return (await statement(db,sql,...values).all()).results;}
export function decode(row){return row&&Object.fromEntries(Object.entries(row).map(([key,value])=>[key,["fields","snapshot","payload","step_snapshot","removed_path","retired_path"].includes(key)&&value!==null?JSON.parse(value):value]));}
export class ProjectNotFound extends Error {constructor(message="Project or item not found."){super(message);this.status=404;}}
export const text=(value,max,label,required=false)=>{if(value===undefined)value="";if(typeof value!=="string"||value.length>max||value.includes("\0")||required&&!value.trim())throw Error(label+" must be valid text"+(required?" (required)":"")+" of at most "+max+" characters.");return value.trim();};
export async function ownedProject(db,id,actor){
 if(!uuid(id))throw new ProjectNotFound();
 const project=await statement(db,"SELECT * FROM engine_projects WHERE id=? AND owner_id=?",id,actor).first();if(!project)throw new ProjectNotFound();return project;
}
export function expectedProject(project,input){if(project.revision!==input.expectedRevision)throw new CommandConflict();}
export async function itemContext(db,projectId,itemId,{active=true}={}){
 if(!uuid(itemId))throw new ProjectNotFound();
 const result=await db.batch([
  statement(db,"SELECT * FROM engine_items WHERE project_id=? AND id=?",projectId,itemId),
  statement(db,"SELECT * FROM engine_occurrences WHERE project_id=? AND item_id=? ORDER BY id",projectId,itemId)
 ]);
 const item=decode(result[0].results[0]),occurrence=decode(result[1].results[0]);
 if(!item||!occurrence||active&&occurrence.removed_at!==null)throw new ProjectNotFound();
 return {item,occurrence};
}
export const itemDetails=item=>normalizeCustomItem({name:item.name,short_name:item.short_name,part_number:item.part_number,kind:item.kind,source:item.source,is_tool:!!item.is_tool,fields:item.fields});
export const buildDetails=occurrence=>normalizeOccurrence({quantity:occurrence.quantity,unit:occurrence.unit,build_status:occurrence.build_status,attention:!!occurrence.attention,attention_note:occurrence.attention_note,hidden:!!occurrence.hidden});
export const storedItem=details=>({...details,is_tool:details.is_tool?1:0,fields:JSON.stringify(details.fields)});
export const storedBuild=build=>({...build,attention:build.attention?1:0,hidden:build.hidden?1:0});
export async function currentEngineeringFile(db,projectId,itemId){
 return (await rows(db,"SELECT f.* FROM engine_file_links l JOIN engine_files f ON f.project_id=l.project_id AND f.id=l.file_id WHERE l.project_id=? AND l.item_id=? AND l.active=1 AND f.state='ready'",projectId,itemId))[0]||null;
}
export async function readyFiles(db,projectId,ids=[]){
 if(!Array.isArray(ids)||ids.length>20||new Set(ids).size!==ids.length||ids.some(id=>!uuid(id)))throw Error("Choose at most 20 distinct uploaded files.");
 const found=[];for(const id of ids){const file=await statement(db,"SELECT * FROM engine_files WHERE project_id=? AND id=? AND state='ready'",projectId,id).first();if(!file)throw Error("An attachment is missing or has not finished uploading.");found.push(file);}return found;
}
export function addFileLinks(w,projectId,owner,files,role="support"){
 for(const file of files)w.insert("engine_file_links",{id:crypto.randomUUID(),project_id:projectId,file_id:file.id,...owner,role,active:1});
}
export async function configurationPlan(db,project,item,occurrence,file){
 const projectId=project.id;
 const snapshot={format:1,item:{id:item.id,...itemDetails(item)},occurrence:{id:occurrence.id,...buildDetails(occurrence),root:{id:project.id,name:project.name}},file:file?{id:file.id,name:file.name,content_type:file.content_type,size:file.size,sha256:file.sha256}:null};
 const fingerprint=await sha256(canonicalJSON(snapshot));
 const existing=await statement(db,"SELECT id FROM engine_configurations WHERE project_id=? AND item_id=? AND fingerprint=?",projectId,item.id,fingerprint).first();
 const id=existing?.id||crypto.randomUUID();
 return {id,snapshot,write(w){if(existing)return;w.insert("engine_configurations",{id,project_id:projectId,item_id:item.id,fingerprint,snapshot:JSON.stringify(snapshot),created_at:w.createdAt});if(file)addFileLinks(w,projectId,{configuration_id:id},[file]);}};
}
export function addEvent(w,projectId,itemId,type,title,payload={},summary="",id=crypto.randomUUID()){
 w.insert("engine_events",{id,project_id:projectId,item_id:itemId,type,title,summary,payload:JSON.stringify(payload),created_at:w.createdAt});return id;
}
export function originalPath(project,item,step){return {root:{id:project.id,name:project.name},item:{id:item.id,name:item.name,part_number:item.part_number},...(step?{step:{id:step.id,title:step.title}}:{})};}
export async function workspaceState(db,project){
 const tables=["engine_items","engine_occurrences","engine_steps","engine_records","engine_files","engine_file_links"];
 const result=await db.batch([statement(db,"SELECT * FROM engine_projects WHERE id=?",project.id),...tables.map(table=>statement(db,`SELECT * FROM ${table} WHERE project_id=? ORDER BY ${table==="engine_steps"?"sort_order,id":"id"}`,project.id))]);
 return {project:result[0].results[0],...Object.fromEntries(tables.map((name,index)=>[name.replace("engine_",""),result[index+1].results.map(decode)]))};
}
