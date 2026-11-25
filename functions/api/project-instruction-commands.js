import {instructionTree} from "../../assets/project-instruction-model.js";
import {commitProjectCommand} from "./project-command.js";
import {captureProjectPart,entryEvidence} from "./project-part-snapshot.js";
import {rows,statement,decode,uuid,text,itemContext,unchangedProject,addEvent,addFileLinks,originalPath,ProjectNotFound} from "./project-state.js";

export async function instructionState(db,projectId,itemId){return instructionTree((await rows(db,"SELECT * FROM engine_steps WHERE project_id=? AND item_id=?",projectId,itemId)).map(decode));}
export async function stepRow(db,projectId,id){
 if(!uuid(id))throw new ProjectNotFound("Step not found.");
 const step=decode(await statement(db,"SELECT * FROM engine_steps WHERE project_id=? AND id=?",projectId,id).first());if(!step)throw new ProjectNotFound("Step not found.");return step;
}
function parentFor(tree,parentId){
 if(parentId===null)return null;
 const parent=tree.byId.get(parentId);if(!parent?.is_group||!tree.active(parent))throw Error("Choose an active instruction group on this part.");return parentId;
}
export async function createStep(db,input,project,itemId,data){
 await itemContext(db,project.id,itemId);const tree=await instructionState(db,project.id,itemId);
 if(tree.byId.size>=1000)throw Error("This preview supports up to 1,000 instruction scopes per part.");
 const title=text(data.title,180,"Step title",true),body=text(data.body,12000,"Instructions"),id=crypto.randomUUID(),parent_id=parentFor(tree,data.parentId??null);
 if(data.isGroup!==undefined&&typeof data.isGroup!=="boolean")throw Error("Choose instruction or group.");
 const siblings=tree.children(parent_id),order=Math.max(-1,...siblings.map(row=>row.sort_order))+1;
 instructionTree([...tree.byId.values(),{id,item_id:itemId,project_id:project.id,parent_id,is_group:!!data.isGroup,sort_order:order}]);
 return commitProjectCommand(db,input,w=>{w.insert("engine_steps",{id,project_id:project.id,item_id:itemId,title,body,parent_id,is_group:data.isGroup?1:0,sort_order:order,created_at:w.createdAt});return {stepId:id};});
}
export async function editStep(db,input,project,id,data,{revision=false}={}){
 const step=await stepRow(db,project.id,id),context=await itemContext(db,project.id,step.item_id),tree=await instructionState(db,project.id,step.item_id);
 if(!tree.active(step))throw Error("Restore this instruction and its parent groups before editing it.");
 const title=data.title===undefined?step.title:text(data.title,180,"Step title",true),body=data.body===undefined?step.body:text(data.body,12000,"Instructions"),parent_id=data.parentId===undefined?step.parent_id:parentFor(tree,data.parentId);
 if(data.isGroup!==undefined&&!!data.isGroup!==!!step.is_group)throw Error("Instruction and group identities cannot be converted.");
 const moved=parent_id!==step.parent_id,sort_order=moved?Math.max(-1,...tree.children(parent_id).map(row=>row.sort_order))+1:step.sort_order;
 instructionTree([...tree.byId.values()].map(row=>row.id===id?{...row,parent_id,sort_order}:row));
 const changed=title!==step.title||body!==step.body||moved;
 // Standalone revision deliberately captures unchanged saved content. Saving
 // an unedited editor as a revision is a no-op, like an ordinary empty save.
 if(!changed&&(!revision||["title","body","parentId"].some(key=>Object.hasOwn(data,key))))return unchangedProject(db,project,input);
 const evidence=revision?await entryEvidence(db,project,data):null,capture=revision?await captureProjectPart(db,project,context.item,context.occurrence,{instructionId:id}):null,level=step.revision_level;
 return commitProjectCommand(db,input,w=>{
  if(capture)capture.write(w);
  w.update("engine_steps",{title,body,parent_id,sort_order,...(revision?{revision_level:level+1}:{})},{project_id:project.id,id,retired_at:null});
  let eventId=null;
  if(revision){eventId=addEvent(w,project.id,step.item_id,"instruction_revision",(step.is_group?"Group":"Instruction")+" revision "+level,{step_id:id,level,scope_type:step.is_group?"group":"instruction",snapshot:capture.snapshot,entryDetails:evidence.details,source:{id:context.item.id,name:context.item.name,part_number:context.item.part_number,step_title:step.title}},evidence.details.whatChanged);addFileLinks(w,project.id,{event_id:eventId},evidence.photos);}
  return {stepId:id,eventId,revisionLevel:revision?level+1:level};
 });
}
export async function reorderSteps(db,input,project,itemId,data){
 await itemContext(db,project.id,itemId);const tree=await instructionState(db,project.id,itemId),parentId=parentFor(tree,data.parentId??null),existing=tree.children(parentId).filter(row=>!row.retired_at);
 if(!Array.isArray(data.ids)||data.ids.length!==existing.length||new Set(data.ids).size!==data.ids.length||data.ids.some(id=>!existing.some(row=>row.id===id)))throw Error("Provide each active sibling step exactly once.");
 if(existing.every((row,index)=>row.id===data.ids[index]))return unchangedProject(db,project,input);
 return commitProjectCommand(db,input,w=>{w.reorderSteps(itemId,data.ids,parentId);return {itemId};});
}
export async function changeStepLife(db,input,project,id,restore,data={}){
 const step=await stepRow(db,project.id,id),{item}=await itemContext(db,project.id,step.item_id),tree=await instructionState(db,project.id,step.item_id);
 if(restore?!step.retired_at:!!step.retired_at)return unchangedProject(db,project,input);
 if(step.parent_id&&!tree.active(tree.byId.get(step.parent_id)))throw Error("Restore the parent instruction group first.");
 const reason=restore?step.archive_reason:text(data.reason,5000,"Archive reason");
 return commitProjectCommand(db,input,w=>{
  w.update("engine_steps",{retired_at:restore?null:w.createdAt,...(!restore?{archive_reason:reason,retired_path:JSON.stringify(originalPath(project,item,step))}:{})},{project_id:project.id,id,retired_at:step.retired_at});
  const eventId=addEvent(w,project.id,item.id,restore?"step_restored":"step_retired",restore?"Step restored":"Step retired",{step_id:id,reason,path:restore?step.retired_path:originalPath(project,item,step),source:{id:item.id,name:item.name,part_number:item.part_number,step_title:step.title}},step.title);
  return {stepId:id,eventId};
 });
}
export async function reorderRecords(db,input,project,stepId,data){
 const step=await stepRow(db,project.id,stepId);await itemContext(db,project.id,step.item_id);
 if(!(await instructionState(db,project.id,step.item_id)).active(step))throw Error("Restore this instruction before changing its records.");
 const parent=data.parentRecordId??null;
 if(parent!==null&&!uuid(parent))throw Error("Invalid parent record.");
 const existing=await rows(db,"SELECT id FROM engine_records WHERE project_id=? AND step_id=? AND parent_record_id IS ? ORDER BY sort_order,created_at,id",project.id,stepId,parent);
 if(!Array.isArray(data.ids)||data.ids.length!==existing.length||new Set(data.ids).size!==data.ids.length||data.ids.some(id=>!existing.some(row=>row.id===id)))throw Error("Provide each record on this instruction exactly once.");
 if(existing.every((row,index)=>row.id===data.ids[index]))return unchangedProject(db,project,input);
 return commitProjectCommand(db,input,w=>{for(const [sort_order,id]of data.ids.entries())w.update("engine_records",{sort_order},{project_id:project.id,step_id:stepId,parent_record_id:parent,id});return {stepId};});
}
