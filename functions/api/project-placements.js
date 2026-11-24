import {projectTree,MAX_PROJECT_PLACEMENTS} from "../../assets/project-tree-model.js";
import {normalizeOccurrence} from "../../assets/project-item-model.js";
import {commitProjectCommand,CommandConflict} from "./project-command.js";
import {rows,statement,decode,itemContext,buildDetails,storedBuild,addEvent,originalPath,addFileLinks,unchangedProject} from "./project-state.js";
import {captureProjectPart,entryEvidence} from "./project-part-snapshot.js";
export async function loadProjectTree(db,projectId){const result=await db.batch([statement(db,"SELECT * FROM engine_items WHERE project_id=?",projectId),statement(db,"SELECT * FROM engine_occurrences WHERE project_id=?",projectId)]);return projectTree(result[0].results.map(decode),result[1].results);}
export function parentPlacement(tree,parentId){if(parentId===null||parentId===undefined)return null;const parent=tree.placements.get(parentId);if(!parent||!tree.active(parent)||!tree.definitions.get(parent.item_id).is_assembly)throw Error("Choose an active subassembly in this project.");return parent.id;}
export async function placeExisting(db,input,project,itemId,data){
 const tree=await loadProjectTree(db,project.id),item=tree.definitions.get(itemId),source=tree.placements.get(data.sourceOccurrenceId)||[...tree.placements.values()].find(row=>row.item_id===itemId&&tree.active(row));
 if(!item||!source||source.item_id!==itemId||!tree.active(source))throw Error("Choose an active part placement.");
 const originals=item.is_assembly?tree.subtree(source.id):[source],parent_id=parentPlacement(tree,data.parentId),build=normalizeOccurrence(data.build),mapping=new Map(originals.map(row=>[row.id,crypto.randomUUID()]));
 if(tree.placements.size+originals.length>MAX_PROJECT_PLACEMENTS)throw Error("This preview supports at most 1,000 placements.");
 const next=originals.map(row=>({...row,...storedBuild(row.id===source.id?build:normalizeOccurrence({quantity:row.quantity,unit:row.unit,hidden:!!row.hidden})),id:mapping.get(row.id),parent_id:row.id===source.id?parent_id:mapping.get(row.parent_id),removed_at:null,removed_path:null,archive_group_id:null}));
 projectTree([...tree.definitions.values()],[...tree.placements.values(),...next]);
 return commitProjectCommand(db,input,w=>{for(const row of next)w.insert("engine_occurrences",{...row,sort_order:row.id===mapping.get(source.id)?tree.placements.size:row.sort_order});return {itemId,occurrenceId:mapping.get(source.id),placed:next.length};});
}
export async function editPlacement(db,input,project,id,data){
 const tree=await loadProjectTree(db,project.id),old=tree.placements.get(id);if(!old||!tree.active(old))throw Error("Choose an active placement.");
 const build=normalizeOccurrence(data.build===undefined?buildDetails(old):data.build),parent_id=data.parentId===undefined?old.parent_id:parentPlacement(tree,data.parentId);
 let order=old.sort_order;if(data.sortOrder!==undefined){if(!Number.isSafeInteger(data.sortOrder)||data.sortOrder<0)throw Error("Choose a valid placement order.");order=data.sortOrder;}
 const patch={...storedBuild(build),parent_id:parent_id||null,sort_order:order};
 projectTree([...tree.definitions.values()],[...tree.placements.values()].map(row=>row.id===id?{...row,...patch}:row));
 if(Object.entries(patch).every(([key,value])=>(old[key]??null)===value))return unchangedProject(db,project,input);
 return commitProjectCommand(db,input,w=>{w.update("engine_occurrences",patch,{project_id:project.id,id,removed_at:null});return {itemId:old.item_id,occurrenceId:id};});
}
export async function reorderPlacements(db,input,project,id,data){
 const tree=await loadProjectTree(db,project.id),selected=tree.placements.get(id);if(!selected||!tree.active(selected))throw Error("Choose an active placement.");
 const siblings=(tree.children.get(selected.parent_id||null)||[]).filter(tree.active),ids=data.ids;
 if(!Array.isArray(ids)||ids.length!==siblings.length||new Set(ids).size!==ids.length||ids.some(id=>!siblings.some(row=>row.id===id)))throw Error("Provide each active sibling placement exactly once.");
 if(siblings.every((row,index)=>row.id===ids[index]))return unchangedProject(db,project,input);
 return commitProjectCommand(db,input,w=>{w.reorderOccurrences(selected.parent_id||null,ids);return {occurrenceId:id};});
}
export async function lifePreview(db,project,id,restore=false){
 const tree=await loadProjectTree(db,project.id),occurrence=tree.placements.get(id);if(!occurrence)throw Error("Placement not found.");
 const item=tree.definitions.get(occurrence.item_id),group=occurrence.archive_group_id?(await rows(db,"SELECT * FROM engine_archive_groups WHERE project_id=? AND id=?",project.id,occurrence.archive_group_id))[0]:null;
 const members=restore?(group?JSON.parse(group.members).map(row=>tree.placements.get(row.id)).filter(Boolean):[occurrence]):tree.subtree(id);
 const conflicts=[];if(restore&&group&&group.root_occurrence_id!==id)conflicts.push("Restore the archived group from its top-level entry.");if(restore&&occurrence.parent_id&&!tree.active(tree.placements.get(occurrence.parent_id)))conflicts.push("Restore the parent subassembly first.");
 const shared=members.filter(row=>[...tree.placements.values()].some(other=>other.item_id===row.item_id&&!members.some(member=>member.id===other.id)&&tree.active(other)));
 return {item,occurrence:decode(occurrence),root:{id:project.id,name:project.name},members:members.map(row=>({id:row.id,item_id:row.item_id,name:tree.definitions.get(row.item_id).name,part_number:tree.definitions.get(row.item_id).part_number,path:tree.path(row)})),sharedPlacements:shared.length,conflicts,revision:project.revision,group};
}
export async function changePlacementLife(db,input,project,id,restore,data={}){
 const preview=await lifePreview(db,project,id,restore),{item,occurrence,group}=preview;
 if(restore?occurrence.removed_at===null:occurrence.removed_at!==null)return unchangedProject(db,project,input);
 if(preview.conflicts.length)throw new CommandConflict(preview.conflicts.join(" "));
 const tree=await loadProjectTree(db,project.id),members=preview.members.map(row=>tree.placements.get(row.id));
 if(restore&&members.some(row=>row.removed_at===null||row.archive_group_id!==(group?.id||null)))throw new CommandConflict("The archived group changed. Review it before restoring.");
 const evidence=restore?null:await entryEvidence(db,project,data),snapshot=restore?null:await captureProjectPart(db,project,item,occurrence),groupId=restore?group?.id:crypto.randomUUID();
 return commitProjectCommand(db,input,w=>{
  if(!restore)w.insert("engine_archive_groups",{id:groupId,project_id:project.id,root_occurrence_id:id,members:JSON.stringify(preview.members),created_at:w.createdAt});
  w.archiveOccurrences(members.map(member=>({...member,path:JSON.stringify({...originalPath(project,tree.definitions.get(member.item_id)),ancestors:tree.path(member).slice(0,-1)})})),{restore,groupId});
  const parent=tree.placements.get(occurrence.parent_id),eventId=addEvent(w,project.id,item.id,restore?"restored":"archived",restore?"Restored to build":item.is_assembly?"Archived subassembly":"Archived part",{path:restore?occurrence.removed_path:{...originalPath(project,item),ancestors:tree.path(occurrence).slice(0,-1)},occurrence_id:id,parent_item_id:parent?.item_id||null,group_id:groupId,members:preview.members,...(!restore?{snapshot,entryDetails:evidence.details}:{}),source:{id:item.id,name:item.name,part_number:item.part_number}});
  if(evidence)addFileLinks(w,project.id,{event_id:eventId},evidence.photos);return {itemId:item.id,occurrenceId:id,eventId,members:members.length};
 });
}
