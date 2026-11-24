import {legacyRecordContext} from "../../assets/project-record-context.js";
import {loadProjectTree,parentPlacement,changePlacementLife,lifePreview} from "./project-placements.js";
import {captureProjectPart,entryEvidence} from "./project-part-snapshot.js";
import {commitProjectCommand,canonicalJSON,CommandConflict} from "./project-command.js";
import {normalizeCustomItem,normalizeOccurrence,allocatePartNumber,diffProjectItems,projectNumberKey} from "../../assets/project-item-model.js";
import {normalizeProjectRecord} from "../../assets/project-record-model.js";
import {rows,statement,decode,uuid,text,itemContext,itemDetails,buildDetails,storedItem,storedBuild,buildContext,configurationPlan,currentEngineeringFile,readyFiles,addFileLinks,addEvent,originalPath,ProjectNotFound} from "./project-state.js";
const same=(a,b)=>canonicalJSON(a)===canonicalJSON(b);
export async function unchanged(db,project,input){
 const current=await statement(db,"SELECT revision FROM engine_projects WHERE id=? AND owner_id=?",project.id,input.actorId).first();
 if(current?.revision!==input.expectedRevision)throw new CommandConflict();return {ok:true,noop:true,revision:current.revision};
}
async function numberAvailable(db,projectId,number,except=null){
 const reserved=await rows(db,"SELECT id,part_number FROM engine_items WHERE project_id=?",projectId);
 if(reserved.some(row=>row.id!==except&&projectNumberKey(row.part_number)===projectNumberKey(number)))throw new CommandConflict("That part number is reserved by an active or archived item. Choose another number.");
}
export async function createProject(db,input,data){
 const name=text(data.name,180,"Project name",true),prefix=text(data.prefix===undefined?"NR":data.prefix,10,"Number prefix"),digits=data.digits===undefined?3:data.digits;
 if(!Number.isInteger(digits)||digits<1||digits>8)throw Error("Choose between 1 and 8 numbering digits.");
 if(input.expectedRevision!==null)throw Error("A new project requires expectedRevision: null.");
 return commitProjectCommand(db,input,w=>{w.insert("engine_projects",{id:input.projectId,owner_id:input.actorId,name,prefix,digits,revision:w.revision,created_at:w.createdAt});return {projectId:input.projectId};});
}
export async function editProject(db,input,project,data){
 const name=data.name===undefined?project.name:text(data.name,180,"Project name",true),prefix=data.prefix===undefined?project.prefix:text(data.prefix,10,"Number prefix"),digits=data.digits===undefined?project.digits:data.digits;
 if(!Number.isInteger(digits)||digits<1||digits>8)throw Error("Choose between 1 and 8 numbering digits.");
 if(name===project.name&&prefix===project.prefix&&digits===project.digits)return unchanged(db,project,input);
 return commitProjectCommand(db,input,w=>{w.update("engine_projects",{name,prefix,digits},{id:project.id,owner_id:input.actorId});return {projectId:project.id};});
}
export async function createItem(db,input,project,data,{from=null,selectionPlan=null}={}){
 const tree=await loadProjectTree(db,project.id),parent_id=parentPlacement(tree,data.parentId),existing=await rows(db,"SELECT part_number FROM engine_items WHERE project_id=?",project.id);
 if(tree.placements.size>=1000)throw Error("This preview supports at most 1,000 placements.");
 if(from?.item.is_assembly)throw Error("Use Add existing part placement to copy a subassembly with its composition.");
 const automatic=data.assignNumber===undefined||data.assignNumber===true||!!from;
 if(data.assignNumber!==undefined&&typeof data.assignNumber!=="boolean")throw Error("Choose automatic numbering or provide a part number.");
 const details=normalizeCustomItem(from?{...itemDetails(from.item),part_number:allocatePartNumber(project,existing.map(row=>row.part_number),!!(from?.item.is_assembly||data.details?.is_assembly))}:{...data.details,part_number:automatic?allocatePartNumber(project,existing.map(row=>row.part_number),!!(from?.item.is_assembly||data.details?.is_assembly)):data.details?.part_number});
 const build=normalizeOccurrence(from?{}:data.build),itemId=crypto.randomUUID(),occurrenceId=crypto.randomUUID();
 await numberAvailable(db,project.id,details.part_number);
 const item={id:itemId,...details},occurrence={id:occurrenceId,parent_id,...build},file=from?await currentEngineeringFile(db,project.id,from.item.id):null;
 const copiedSelection=from?decode(await statement(db,"SELECT * FROM engine_selections WHERE project_id=? AND id=?",project.id,from.item.id).first()):null;
 const selection=selectionPlan?.selection||copiedSelection;
 const configuration=await configurationPlan(db,project,item,occurrence,file,{selection:selection?{...selection,id:itemId,project_id:project.id}:null});
 return commitProjectCommand(db,input,w=>{
  w.insert("engine_items",{id:itemId,project_id:project.id,...storedItem(details),created_at:w.createdAt});
  w.insert("engine_occurrences",{id:occurrenceId,project_id:project.id,item_id:itemId,...storedBuild(build),parent_id,sort_order:tree.placements.size});
  if(file)addFileLinks(w,project.id,{item_id:itemId},[file],"engineering");
  if(selectionPlan)selectionPlan.write(w,itemId);else if(copiedSelection)w.insert("engine_selections",{...copiedSelection,id:itemId,snapshot:JSON.stringify(copiedSelection.snapshot),requirements:JSON.stringify(copiedSelection.requirements)});
  configuration.write(w);if(selectionPlan)addFileLinks(w,project.id,{configuration_id:configuration.id},selectionPlan.files);return {itemId,occurrenceId,configurationId:configuration.id};
 });
}
export async function editItem(db,input,project,itemId,data,{revision=false}={}){
 const context=await itemContext(db,project.id,itemId,{occurrenceId:data.occurrenceId,requireOccurrence:true}),before=itemDetails(context.item),oldBuild=buildDetails(context.occurrence);
 const after=normalizeCustomItem(data.details===undefined?before:data.details),build=normalizeOccurrence(data.build===undefined?oldBuild:data.build);
 const changes=diffProjectItems(before,after,oldBuild,build);
 if(!!after.is_assembly!==!!before.is_assembly)throw Error("Part and subassembly identities cannot be converted after creation.");
 if(after.part_number!==before.part_number)throw new CommandConflict("Issued part numbers are permanent and cannot be changed or reused.");
 if(!changes.length&&!revision)return unchanged(db,project,input);
 const evidence=revision?await entryEvidence(db,project,data):null,snapshot=revision?await captureProjectPart(db,project,context.item,context.occurrence):null,level=context.item.revision_level||1;
 await numberAvailable(db,project.id,after.part_number,itemId);
 const support=revision?await readyFiles(db,project.id,data.fileIds===undefined?[]:data.fileIds):[];
 const file=await currentEngineeringFile(db,project.id,itemId);
 const prior=await configurationPlan(db,project,context.item,context.occurrence,file);
 let next=await configurationPlan(db,project,{...context.item,...after,...(revision?{revision_level:level+1}:{})},{...context.occurrence,...build},file,{cache:prior.cache});
 if(same(prior.snapshot,next.snapshot))next=prior;
 return commitProjectCommand(db,input,w=>{
  if(revision&&prior.id!==next.id)prior.write(w);
  w.update("engine_items",{...storedItem(after),...(revision?{revision_level:level+1}:{})},{project_id:project.id,id:itemId});
  w.update("engine_occurrences",storedBuild(build),{project_id:project.id,id:context.occurrence.id,removed_at:null});
  next.write(w);
  let eventId=null;
  if(revision){eventId=addEvent(w,project.id,itemId,"revision","Revision "+level,{before:prior.id,after:next.id,level,snapshot,entryDetails:evidence.details,changes,build_context:{before:buildContext(project,context.occurrence,context.item,prior.cache?.tree),after:buildContext(project,{...context.occurrence,...build},{...context.item,revision_level:level+1},prior.cache?.tree)},source:{id:itemId,name:before.name,part_number:before.part_number}},evidence.details.whatChanged);addFileLinks(w,project.id,{event_id:eventId},[...new Map([...support,...evidence.photos].map(file=>[file.id,file])).values()]);}
  return {itemId,configurationId:next.id,eventId};
 });
}
export async function createStep(db,input,project,itemId,data){
 await itemContext(db,project.id,itemId);
 const title=text(data.title,180,"Step title",true),body=text(data.body,12000,"Instructions"),id=crypto.randomUUID();
 const order=(await statement(db,"SELECT COALESCE(MAX(sort_order),-1)+1 AS next FROM engine_steps WHERE project_id=? AND item_id=?",project.id,itemId).first()).next;
 return commitProjectCommand(db,input,w=>{w.insert("engine_steps",{id,project_id:project.id,item_id:itemId,title,body,sort_order:order,created_at:w.createdAt});return {stepId:id};});
}
export async function stepRow(db,projectId,id){
 if(!uuid(id))throw new ProjectNotFound("Step not found.");
 const step=decode(await statement(db,"SELECT * FROM engine_steps WHERE project_id=? AND id=?",projectId,id).first());if(!step)throw new ProjectNotFound("Step not found.");return step;
}
export async function editStep(db,input,project,id,data){
 const step=await stepRow(db,project.id,id);await itemContext(db,project.id,step.item_id);if(step.retired_at)throw Error("Restore the step before editing it.");
 const title=data.title===undefined?step.title:text(data.title,180,"Step title",true),body=data.body===undefined?step.body:text(data.body,12000,"Instructions");
 if(title===step.title&&body===step.body)return unchanged(db,project,input);
 return commitProjectCommand(db,input,w=>{w.update("engine_steps",{title,body},{project_id:project.id,id,retired_at:null});return {stepId:id};});
}
export async function reorderSteps(db,input,project,itemId,data){
 await itemContext(db,project.id,itemId);
 const existing=await rows(db,"SELECT id FROM engine_steps WHERE project_id=? AND item_id=? AND retired_at IS NULL ORDER BY sort_order,id",project.id,itemId);
 if(!Array.isArray(data.ids)||data.ids.length!==existing.length||new Set(data.ids).size!==data.ids.length||data.ids.some(id=>!existing.some(row=>row.id===id)))throw Error("Provide each active step exactly once.");
 if(existing.every((row,index)=>row.id===data.ids[index]))return unchanged(db,project,input);
 return commitProjectCommand(db,input,w=>{w.reorderSteps(itemId,data.ids);return {itemId};});
}
export async function changeStepLife(db,input,project,id,restore){
 const step=await stepRow(db,project.id,id),{item}=await itemContext(db,project.id,step.item_id);
 if(restore?!step.retired_at:!!step.retired_at)return unchanged(db,project,input);
 return commitProjectCommand(db,input,w=>{
  w.update("engine_steps",{retired_at:restore?null:w.createdAt,...(!restore?{retired_path:JSON.stringify(originalPath(project,item,step))}:{})},{project_id:project.id,id,retired_at:step.retired_at});
  const eventId=addEvent(w,project.id,item.id,restore?"step_restored":"step_retired",restore?"Step restored":"Step retired",{step_id:id,path:restore?step.retired_path:originalPath(project,item,step),source:{id:item.id,name:item.name,part_number:item.part_number,step_title:step.title}},step.title);
  return {stepId:id,eventId};
 });
}
export async function createRecord(db,input,project,itemId,data){
 const {item,occurrence}=await itemContext(db,project.id,itemId,{occurrenceId:data.occurrenceId,requireOccurrence:true}),record=normalizeProjectRecord(data.record);
 const step=data.stepId?await stepRow(db,project.id,data.stepId):null;
 if(step&&(step.item_id!==itemId||step.retired_at))throw Error("Choose an active step on this item.");
 const files=await readyFiles(db,project.id,record.fileIds),id=crypto.randomUUID();
 const file=await currentEngineeringFile(db,project.id,itemId),configuration=await configurationPlan(db,project,item,occurrence,file);
 return commitProjectCommand(db,input,w=>{
  configuration.write(w);
  if(step)w.require("EXISTS(SELECT 1 FROM engine_steps WHERE project_id=? AND id=? AND item_id=? AND retired_at IS NULL)",project.id,step.id,itemId);
  w.insert("engine_records",{id,project_id:project.id,item_id:itemId,step_id:step?.id||null,configuration_id:configuration.id,type:record.type,title:record.title,fields:JSON.stringify(record.fields),event_date:record.event_date,step_snapshot:step?JSON.stringify({id:step.id,title:step.title,body:step.body}):null,created_at:w.createdAt,updated_at:w.createdAt});
  addFileLinks(w,project.id,{record_id:id},files);
  const eventId=addEvent(w,project.id,itemId,record.type,record.title,{record_id:id,configuration_id:configuration.id,occurrence_id:occurrence.id,record_context:buildContext(project,occurrence,item,configuration.cache?.tree),source:{id:itemId,name:item.name,part_number:item.part_number,step_title:step?.title||null}},Object.values(record.fields).filter(value=>typeof value==="string").join(" · ").slice(0,300));
  return {recordId:id,eventId,configurationId:configuration.id};
 });
}
export async function editRecord(db,input,project,id,data){
 const old=decode(await statement(db,"SELECT * FROM engine_records WHERE project_id=? AND id=?",project.id,id).first());if(!old)throw new ProjectNotFound("Record not found.");
 await itemContext(db,project.id,old.item_id);
 const record=normalizeProjectRecord(data.record);
 const oldLinks=await rows(db,"SELECT * FROM engine_file_links WHERE project_id=? AND record_id=? AND active=1",project.id,id),files=await readyFiles(db,project.id,record.fileIds);
 const oldValue={type:old.type,title:old.title,fields:old.fields,event_date:old.event_date,fileIds:oldLinks.map(link=>link.file_id).sort()},nextValue={...record,fileIds:[...record.fileIds].sort()};
 if(same(oldValue,nextValue))return unchanged(db,project,input);
 const creation=decode(await statement(db,"SELECT * FROM engine_events WHERE project_id=? AND json_extract(payload,'$.record_id')=? ORDER BY created_at,id LIMIT 1",project.id,id).first());
 const configuration=decode(await statement(db,"SELECT * FROM engine_configurations WHERE project_id=? AND id=?",project.id,old.configuration_id).first());
 const recordContext=creation?.payload.record_context||legacyRecordContext(configuration?.snapshot);
 const retained=await readyFiles(db,project.id,oldValue.fileIds),auditFiles=[...new Map([...retained,...files].map(file=>[file.id,file])).values()];
 return commitProjectCommand(db,input,w=>{
  w.update("engine_records",{type:record.type,title:record.title,fields:JSON.stringify(record.fields),event_date:record.event_date,updated_at:w.createdAt},{project_id:project.id,id});
  for(const link of oldLinks)if(!record.fileIds.includes(link.file_id))w.update("engine_file_links",{active:0},{project_id:project.id,id:link.id});
  addFileLinks(w,project.id,{record_id:id},files.filter(file=>!oldLinks.some(link=>link.file_id===file.id)));
  // Use edited_record_id so creation-event/Knowledge mappings stay unique.
  const eventId=addEvent(w,project.id,old.item_id,"record_edited","Record edited: "+record.title,{edited_record_id:id,record_event_id:creation?.id||null,configuration_id:old.configuration_id,record_context:recordContext,step_snapshot:old.step_snapshot,actor_id:input.actorId,record_edit:{before:oldValue,after:nextValue},source:creation?.payload.source||{id:old.item_id}},record.title);
  addFileLinks(w,project.id,{event_id:eventId},auditFiles);
  return {recordId:id,eventId,configurationId:old.configuration_id};
 });
}
export async function restorePreview(db,project,itemId,occurrenceId=null){
 const context=await itemContext(db,project.id,itemId,{active:false,occurrenceId,requireOccurrence:true});return lifePreview(db,project,context.occurrence.id,true);
}
export async function changeItemLife(db,input,project,itemId,restore,data={}){
 const context=await itemContext(db,project.id,itemId,{active:false,occurrenceId:data.occurrenceId,requireOccurrence:true});return changePlacementLife(db,input,project,context.occurrence.id,restore,data);
}
