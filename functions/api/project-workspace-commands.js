import {configuredOwner} from "./website-settings.js";
import {legacyRecordContext} from "../../assets/project-record-context.js";
import {loadProjectTree,parentPlacement,changePlacementLife,lifePreview} from "./project-placements.js";
import {captureProjectPart,entryEvidence} from "./project-part-snapshot.js";
import {commitProjectCommand,canonicalJSON,CommandConflict} from "./project-command.js";
import {normalizeCustomItem,normalizeOccurrence,allocatePartNumber,diffProjectItems,projectNumberKey} from "../../assets/project-item-model.js";
import {normalizeProjectRecord,MAX_RECORD_FILES} from "../../assets/project-record-model.js";
import {stepRow,instructionState} from "./project-instruction-commands.js";
import {recordTree} from "../../assets/project-instruction-model.js";
export {createStep,stepRow,editStep,reorderSteps,changeStepLife,reorderRecords} from "./project-instruction-commands.js";
import {rows,statement,decode,uuid,text,itemContext,itemDetails,buildDetails,storedItem,storedBuild,buildContext,configurationPlan,currentEngineeringFile,readyFiles,addFileLinks,addEvent,originalPath,ProjectNotFound} from "./project-state.js";
const same=(a,b)=>canonicalJSON(a)===canonicalJSON(b);
function photoRecordFiles(record,files){if(record.fields.category==="photos"&&files.some(file=>!/^image\/(jpeg|png|webp|gif|avif|heic|heif)$/.test(file.content_type)))throw Error("Photos entries accept images only. Use a Note for other files.");}
export async function unchanged(db,project,input){
 const current=await statement(db,"SELECT revision FROM engine_projects WHERE id=? AND owner_id=?",project.id,input.actorId).first();
 if(current?.revision!==input.expectedRevision)throw new CommandConflict();return {ok:true,noop:true,revision:current.revision};
}
async function numberAvailable(db,projectId,number,except=null){
 const reserved=await rows(db,"SELECT id,part_number FROM engine_items WHERE project_id=?",projectId);
 if(reserved.some(row=>row.id!==except&&projectNumberKey(row.part_number)===projectNumberKey(number)))throw new CommandConflict("That part number is reserved by an active or archived item. Choose another number.");
}
export async function createProject(db,input,data){
 const name=text(data.name,180,"Project name",true),prefix=text(data.prefix===undefined?"NR":data.prefix,10,"Number prefix"),digits=data.digits===undefined?3:data.digits,owner_name=await configuredOwner(db,data.owner_name);
 if(!Number.isInteger(digits)||digits<1||digits>8)throw Error("Choose between 1 and 8 numbering digits.");
 if(input.expectedRevision!==null)throw Error("A new project requires expectedRevision: null.");
 return commitProjectCommand(db,input,w=>{w.insert("engine_projects",{id:input.projectId,owner_id:input.actorId,name,prefix,digits,owner_name,revision:w.revision,created_at:w.createdAt});return {projectId:input.projectId};});
}
export async function editProject(db,input,project,data){
 const name=data.name===undefined?project.name:text(data.name,180,"Project name",true),prefix=data.prefix===undefined?project.prefix:text(data.prefix,10,"Number prefix"),digits=data.digits===undefined?project.digits:data.digits,owner_name=await configuredOwner(db,data.owner_name===undefined?project.owner_name:data.owner_name,project.owner_name);
 if(!Number.isInteger(digits)||digits<1||digits>8)throw Error("Choose between 1 and 8 numbering digits.");
 if(name===project.name&&prefix===project.prefix&&digits===project.digits&&owner_name===project.owner_name)return unchanged(db,project,input);
 return commitProjectCommand(db,input,w=>{w.update("engine_projects",{name,prefix,digits,owner_name},{id:project.id,owner_id:input.actorId});return {projectId:project.id};});
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
 const evidence=revision?await entryEvidence(db,project,data):null,capture=revision?await captureProjectPart(db,project,context.item,context.occurrence):null,snapshot=capture?.snapshot,level=context.item.revision_level||1;
 await numberAvailable(db,project.id,after.part_number,itemId);
 const support=revision?await readyFiles(db,project.id,data.fileIds===undefined?[]:data.fileIds):[];
 const file=await currentEngineeringFile(db,project.id,itemId);
 const prior=await configurationPlan(db,project,context.item,context.occurrence,file);
 let next=await configurationPlan(db,project,{...context.item,...after,...(revision?{revision_level:level+1}:{})},{...context.occurrence,...build},file,{cache:prior.cache});
 if(same(prior.snapshot,next.snapshot))next=prior;
 return commitProjectCommand(db,input,w=>{
  if(capture)capture.write(w);
  if(revision&&prior.id!==next.id)prior.write(w);
  w.update("engine_items",{...storedItem(after),...(revision?{revision_level:level+1}:{})},{project_id:project.id,id:itemId});
  w.update("engine_occurrences",storedBuild(build),{project_id:project.id,id:context.occurrence.id,removed_at:null});
  next.write(w);
  let eventId=null;
  if(revision){eventId=addEvent(w,project.id,itemId,"revision","Revision "+level,{before:prior.id,after:next.id,level,snapshot,entryDetails:evidence.details,changes,build_context:{before:buildContext(project,context.occurrence,context.item,prior.cache?.tree),after:buildContext(project,{...context.occurrence,...build},{...context.item,revision_level:level+1},prior.cache?.tree)},source:{id:itemId,name:before.name,part_number:before.part_number}},evidence.details.whatChanged);addFileLinks(w,project.id,{event_id:eventId},[...new Map([...support,...evidence.photos].map(file=>[file.id,file])).values()]);}
  return {itemId,configurationId:next.id,eventId};
 });
}
export async function createRecord(db,input,project,itemId,data){
 const {item,occurrence}=await itemContext(db,project.id,itemId,{occurrenceId:data.occurrenceId,requireOccurrence:true}),record=normalizeProjectRecord(data.record);
 const step=data.stepId?await stepRow(db,project.id,data.stepId):null;
 if(step&&(step.item_id!==itemId||!(await instructionState(db,project.id,itemId)).active(step)))throw Error("Choose an active step on this item.");
 const files=await readyFiles(db,project.id,record.fileIds,MAX_RECORD_FILES),id=crypto.randomUUID();
 photoRecordFiles(record,files);
 const parent_record_id=data.parentRecordId??null;
 if(parent_record_id!==null){const existing=await rows(db,"SELECT id,project_id,item_id,step_id,parent_record_id FROM engine_records WHERE project_id=? AND item_id=?",project.id,itemId);recordTree([...existing,{id,project_id:project.id,item_id:itemId,step_id:step?.id||null,parent_record_id}]);}
 const file=await currentEngineeringFile(db,project.id,itemId),configuration=await configurationPlan(db,project,item,occurrence,file),sort_order=(await statement(db,"SELECT COALESCE(MAX(sort_order),-1)+1 AS next FROM engine_records WHERE project_id=? AND item_id=? AND step_id IS ? AND parent_record_id IS ?",project.id,itemId,step?.id||null,parent_record_id).first()).next;
 return commitProjectCommand(db,input,w=>{
  configuration.write(w);
  if(step)w.require("EXISTS(SELECT 1 FROM engine_steps WHERE project_id=? AND id=? AND item_id=? AND retired_at IS NULL)",project.id,step.id,itemId);
  w.insert("engine_records",{id,project_id:project.id,item_id:itemId,step_id:step?.id||null,parent_record_id,configuration_id:configuration.id,type:record.type,title:record.title,fields:JSON.stringify(record.fields),event_date:record.event_date,step_snapshot:step?JSON.stringify({id:step.id,title:step.title,body:step.body,revision_level:step.revision_level,parent_id:step.parent_id}):null,sort_order,created_at:w.createdAt,updated_at:w.createdAt});
  addFileLinks(w,project.id,{record_id:id},files);
  const eventId=addEvent(w,project.id,itemId,record.type,record.title,{record_id:id,configuration_id:configuration.id,occurrence_id:occurrence.id,record_context:buildContext(project,occurrence,item,configuration.cache?.tree),source:{id:itemId,name:item.name,part_number:item.part_number,step_title:step?.title||null}},Object.values(record.fields).filter(value=>typeof value==="string").join(" · ").slice(0,300));
  return {recordId:id,eventId,configurationId:configuration.id};
 });
}
export async function editRecord(db,input,project,id,data){
 const old=decode(await statement(db,"SELECT * FROM engine_records WHERE project_id=? AND id=?",project.id,id).first());if(!old)throw new ProjectNotFound("Record not found.");
 await itemContext(db,project.id,old.item_id);
 if(old.step_id&&!(await instructionState(db,project.id,old.item_id)).active(await stepRow(db,project.id,old.step_id)))throw Error("Restore this instruction and its parent groups before editing its records.");
 const record=normalizeProjectRecord(data.record);
 const oldLinks=await rows(db,"SELECT * FROM engine_file_links WHERE project_id=? AND record_id=? AND active=1",project.id,id),files=await readyFiles(db,project.id,record.fileIds,MAX_RECORD_FILES);
 photoRecordFiles(record,files);
 const oldValue={type:old.type,title:old.title,fields:old.fields,event_date:old.event_date,fileIds:oldLinks.map(link=>link.file_id).sort()},nextValue={...record,fileIds:[...record.fileIds].sort()};
 const parent_record_id=data.parentRecordId===undefined?old.parent_record_id:data.parentRecordId;
 const sort_order=parent_record_id===old.parent_record_id?old.sort_order:(await statement(db,"SELECT COALESCE(MAX(sort_order),-1)+1 AS next FROM engine_records WHERE project_id=? AND item_id=? AND step_id IS ? AND parent_record_id IS ?",project.id,old.item_id,old.step_id,parent_record_id).first()).next;
 let structure=null;
 if(parent_record_id!==old.parent_record_id){const existing=await rows(db,"SELECT id,project_id,item_id,step_id,parent_record_id,title FROM engine_records WHERE project_id=? AND item_id=?",project.id,old.item_id);recordTree(existing.map(row=>row.id===id?{...row,parent_record_id}:row));structure={before:{parent_record_id:old.parent_record_id,parent_title:existing.find(row=>row.id===old.parent_record_id)?.title||null,sort_order:old.sort_order},after:{parent_record_id,parent_title:existing.find(row=>row.id===parent_record_id)?.title||null,sort_order}};}
 if(same(oldValue,nextValue)&&parent_record_id===old.parent_record_id)return unchanged(db,project,input);
 const creation=decode(await statement(db,"SELECT * FROM engine_events WHERE project_id=? AND json_extract(payload,'$.record_id')=? ORDER BY created_at,id LIMIT 1",project.id,id).first());
 const configuration=decode(await statement(db,"SELECT * FROM engine_configurations WHERE project_id=? AND id=?",project.id,old.configuration_id).first());
 const recordContext=creation?.payload.record_context||legacyRecordContext(configuration?.snapshot);
 const retained=await readyFiles(db,project.id,oldValue.fileIds,MAX_RECORD_FILES),auditFiles=[...new Map([...retained,...files].map(file=>[file.id,file])).values()];
 return commitProjectCommand(db,input,w=>{
  w.update("engine_records",{type:record.type,title:record.title,fields:JSON.stringify(record.fields),event_date:record.event_date,parent_record_id,sort_order,updated_at:w.createdAt},{project_id:project.id,id});
  for(const link of oldLinks)if(!record.fileIds.includes(link.file_id))w.update("engine_file_links",{active:0},{project_id:project.id,id:link.id});
  addFileLinks(w,project.id,{record_id:id},files.filter(file=>!oldLinks.some(link=>link.file_id===file.id)));
  // Use edited_record_id so creation-event/Knowledge mappings stay unique.
  const eventId=addEvent(w,project.id,old.item_id,"record_edited","Record edited: "+record.title,{edited_record_id:id,record_event_id:creation?.id||null,configuration_id:old.configuration_id,record_context:recordContext,step_snapshot:old.step_snapshot,actor_id:input.actorId,record_edit:{before:oldValue,after:nextValue},...(structure?{record_structure:structure}:{}),source:creation?.payload.source||{id:old.item_id}},record.title);
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
