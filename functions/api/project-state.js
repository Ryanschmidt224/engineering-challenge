import {recordedPart} from "../../assets/project-record-context.js";
import {canonicalJSON,sha256,CommandConflict} from "./project-command.js";
import {normalizeCustomItem,normalizeOccurrence} from "../../assets/project-item-model.js";
import {projectTree} from "../../assets/project-tree-model.js";
export const uuid=value=>typeof value==="string"&&/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(value);
export const statement=(db,sql,...values)=>db.prepare(sql).bind(...values);
export async function rows(db,sql,...values){return (await statement(db,sql,...values).all()).results;}
export function decode(row){return row&&Object.fromEntries(Object.entries(row).map(([key,value])=>[key,key==="is_assembly"?!!value:["fields","snapshot","payload","step_snapshot","removed_path","retired_path","requirements","members"].includes(key)&&value!==null?JSON.parse(value):value]));}
export class ProjectNotFound extends Error {constructor(message="Project or item not found."){super(message);this.status=404;}}
export const text=(value,max,label,required=false)=>{if(value===undefined)value="";if(typeof value!=="string"||value.length>max||value.includes("\0")||required&&!value.trim())throw Error(label+" must be valid text"+(required?" (required)":"")+" of at most "+max+" characters.");return value.trim();};
export async function ownedProject(db,id,actor){
 if(!uuid(id))throw new ProjectNotFound();
 const project=await statement(db,"SELECT * FROM engine_projects WHERE id=? AND owner_id=? AND restore_job_id IS NULL",id,actor).first();if(!project)throw new ProjectNotFound();return project;
}
export function expectedProject(project,input){if(project.revision!==input.expectedRevision)throw new CommandConflict();}
export async function unchangedProject(db,project,input){const row=await statement(db,"SELECT revision FROM engine_projects WHERE id=? AND owner_id=?",project.id,input.actorId).first();if(row?.revision!==input.expectedRevision)throw new CommandConflict();return {ok:true,noop:true,revision:row.revision};}
export async function itemContext(db,projectId,itemId,{active=true,occurrenceId=null,requireOccurrence=false}={}){
 if(!uuid(itemId))throw new ProjectNotFound();
 const result=await db.batch([
  statement(db,"SELECT * FROM engine_items WHERE project_id=? AND id=?",projectId,itemId),
  statement(db,"SELECT * FROM engine_occurrences WHERE project_id=? AND item_id=? ORDER BY id",projectId,itemId)
 ]);
 if(requireOccurrence&&!occurrenceId&&result[1].results.length>1)throw Error("Choose the exact placement for this shared part.");
 const item=decode(result[0].results[0]),occurrence=decode(result[1].results.find(row=>occurrenceId?row.id===occurrenceId:!active||row.removed_at===null));
 if(!item||!occurrence||active&&occurrence.removed_at!==null)throw new ProjectNotFound();
 if(active&&occurrence.parent_id){const all=await rows(db,"SELECT * FROM engine_occurrences WHERE project_id=?",projectId),definitions=await rows(db,"SELECT * FROM engine_items WHERE project_id=?",projectId);if(!projectTree(definitions,all).active(occurrence))throw new ProjectNotFound();}
 return {item,occurrence};
}
export const itemDetails=item=>normalizeCustomItem({name:item.name,short_name:item.short_name,part_number:item.part_number,kind:item.kind,source:item.source,is_tool:!!item.is_tool,is_assembly:!!item.is_assembly,fields:item.fields});
export const buildDetails=occurrence=>normalizeOccurrence({quantity:occurrence.quantity,unit:occurrence.unit,build_status:occurrence.build_status,attention:!!occurrence.attention,attention_note:occurrence.attention_note,hidden:!!occurrence.hidden});
export const storedItem=details=>({...details,is_tool:details.is_tool?1:0,is_assembly:details.is_assembly?1:0,fields:JSON.stringify(details.fields)});
export const storedBuild=build=>({...build,attention:build.attention?1:0,hidden:build.hidden?1:0});
// Capture operational state with the evidence/event, never in design identity.
// Assembly evidence may include the exact tested placement tree; configuration
// fingerprints intentionally contain only the logical component design.
export const buildContext=(project,occurrence,item=null,tree=null)=>{
 const part=recordedPart(item),composition=tree&&item?.is_assembly?tree.subtree(occurrence.id).slice(1).map(row=>{
  const definition=tree.definitions.get(row.item_id),saved=recordedPart(definition);
  return {id:row.id,parent_id:row.parent_id,sort_order:row.sort_order,item:{id:definition.id,name:definition.name,part_number:definition.part_number,...(saved?{revision_level:saved.revision_level}:{})},...buildDetails(row)};
 }):undefined;
 return {format:1,project:{id:project.id,name:project.name},occurrence:{id:occurrence.id,...buildDetails(occurrence)},...(part?{part}:{}),...(composition?{composition}:{})};
};
export async function currentEngineeringFile(db,projectId,itemId){
 return (await rows(db,"SELECT f.* FROM engine_file_links l JOIN engine_files f ON f.project_id=l.project_id AND f.id=l.file_id WHERE l.project_id=? AND l.item_id=? AND l.active=1 AND f.state='ready'",projectId,itemId))[0]||null;
}
export async function readyFiles(db,projectId,ids=[],limit=20){
 if(!Array.isArray(ids)||ids.length>limit||new Set(ids).size!==ids.length||ids.some(id=>!uuid(id)))throw Error("Choose at most "+limit+" distinct uploaded files.");
 const found=[];for(const id of ids){const file=await statement(db,"SELECT * FROM engine_files WHERE project_id=? AND id=? AND state='ready'",projectId,id).first();if(!file)throw Error("An attachment is missing or has not finished uploading.");found.push(file);}return found;
}
export function addFileLinks(w,projectId,owner,files,role="support"){
 for(const file of files)w.insert("engine_file_links",{id:crypto.randomUUID(),project_id:projectId,file_id:file.id,...owner,role,active:1});
}
export async function configurationPlan(db,project,item,occurrence,file,{shallow=false,selection,cache=null}={}){
 const projectId=project.id;
 let tree=null;
 if(item.is_assembly&&!shallow&&!cache){
  const result=await db.batch([statement(db,"SELECT * FROM engine_items WHERE project_id=?",projectId),statement(db,"SELECT * FROM engine_occurrences WHERE project_id=?",projectId)]);tree=projectTree(result[0].results.map(decode),result[1].results);
  const childRows=tree.placements.has(occurrence.id)?tree.subtree(occurrence.id).slice(1):[];
  const ids=JSON.stringify([...new Set([item.id,...childRows.map(row=>row.item_id)])]),loaded=await db.batch([
   statement(db,"SELECT * FROM engine_selections WHERE project_id=? AND id IN(SELECT value FROM json_each(?))",projectId,ids),
   statement(db,"SELECT l.item_id,f.* FROM engine_file_links l JOIN engine_files f ON f.project_id=l.project_id AND f.id=l.file_id WHERE l.project_id=? AND l.active=1 AND l.item_id IN(SELECT value FROM json_each(?)) AND f.state='ready'",projectId,ids),
   statement(db,"SELECT id,item_id,fingerprint FROM engine_configurations WHERE project_id=? AND item_id IN(SELECT value FROM json_each(?))",projectId,ids)
  ]);cache={tree,plans:new Map(),selections:new Map(loaded[0].results.map(row=>[row.id,decode(row)])),files:new Map(loaded[1].results.map(row=>[row.item_id,row])),configurations:new Map(loaded[2].results.map(row=>[row.item_id+":"+row.fingerprint,row]))};
 }
 if(item.is_assembly&&cache?.tree)tree=cache.tree;
 const selected=selection===undefined?(cache?cache.selections.get(item.id):decode(await statement(db,"SELECT * FROM engine_selections WHERE project_id=? AND id=?",projectId,item.id).first())):selection;
 const children=[];
 const composition=[];
 if(tree)for(const child of (tree.children.get(occurrence.id)||[]).filter(tree.active)){
  const definition=tree.definitions.get(child.item_id),plan=await configurationPlan(db,project,definition,child,cache.files.get(definition.id)||null,{cache});children.push(plan);
  composition.push({quantity:child.quantity,unit:child.unit,design:plan.snapshot});
 }
 composition.sort((a,b)=>canonicalJSON(a).localeCompare(canonicalJSON(b)));
 const selectionDesign=selected?{family_id:selected.family_id,product_id:selected.product_id??null,family_revision:selected.family_revision,product_revision:selected.product_revision??null,snapshot:selected.snapshot,requirements:selected.requirements}:null;
 // Format 1 rows remain immutable/readable. Format 2 is the design-only leaf
 // boundary. Format 3 adds frozen Workshop product facts and logical assembly
 // composition without placement IDs, project labels, build state or counters.
 const snapshot={format:item.is_assembly||selectionDesign?3:2,item:{id:item.id,...itemDetails(item)},file:file?{id:file.id,name:file.name,content_type:file.content_type,size:file.size,sha256:file.sha256}:null,...(selectionDesign?{selection:selectionDesign}:{}),...(item.is_assembly?{composition}: {})};
 if(new TextEncoder().encode(JSON.stringify(snapshot)).length>500000)throw Error("This assembly configuration exceeds the preview snapshot limit. Nothing was changed.");
 const fingerprint=await sha256(canonicalJSON(snapshot));
 const sharedKey=item.id+":"+fingerprint;if(cache?.plans.has(sharedKey))return cache.plans.get(sharedKey);
 const existing=cache?cache.configurations.get(item.id+":"+fingerprint):await statement(db,"SELECT id FROM engine_configurations WHERE project_id=? AND item_id=? AND fingerprint=?",projectId,item.id,fingerprint).first();
 const id=existing?.id||crypto.randomUUID();
 const written=new WeakSet(),plan={id,snapshot,cache,write(w){if(written.has(w))return;written.add(w);for(const child of children)child.write(w);if(existing)return;w.insert("engine_configurations",{id,project_id:projectId,item_id:item.id,fingerprint,snapshot:JSON.stringify(snapshot),created_at:w.createdAt});if(file)addFileLinks(w,projectId,{configuration_id:id},[file]);}};if(cache)cache.plans.set(sharedKey,plan);return plan;
}
export function addEvent(w,projectId,itemId,type,title,payload={},summary="",id=crypto.randomUUID()){
 w.insert("engine_events",{id,project_id:projectId,item_id:itemId,type,title,summary,payload:JSON.stringify(payload),created_at:w.createdAt});return id;
}
export function originalPath(project,item,step){return {root:{id:project.id,name:project.name},item:{id:item.id,name:item.name,part_number:item.part_number},...(step?{step:{id:step.id,title:step.title}}:{})};}
export async function workspaceState(db,project){
 const tables=["engine_items","engine_occurrences","engine_steps","engine_records","engine_files","engine_file_links","engine_selections","engine_archive_groups","engine_media"];
 const result=await db.batch([statement(db,"SELECT * FROM engine_projects WHERE id=?",project.id),...tables.map(table=>statement(db,`SELECT * FROM ${table} WHERE project_id=? ORDER BY ${table==="engine_steps"||table==="engine_media"?"sort_order,id":"id"}`,project.id)),statement(db,"SELECT id,json_extract(payload,'$.record_id') AS record_id FROM engine_events WHERE project_id=? AND json_type(payload,'$.record_id')='text'",project.id)]);
 return {record_events:result.at(-1).results,project:result[0].results[0],...Object.fromEntries(tables.map((name,index)=>[name.replace("engine_",""),result[index+1].results.map(decode)]))};
}
