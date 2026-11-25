import {statement,decode,itemDetails,buildDetails} from "./project-state.js";
import {projectTree} from "../../assets/project-tree-model.js";
import {snapshotValuePlan} from "./project-snapshot-values.js";
import {instructionTree} from "../../assets/project-instruction-model.js";

// Project-wide command admission checks the loaded token after these reads.
// Referenced file objects are immutable and retained; no mutable URL is copied.
export async function captureProjectPart(db,project,item,occurrence,{shallow=false,instructionId=null}={}){
 const result=await db.batch([statement(db,"SELECT * FROM engine_items WHERE project_id=?",project.id),statement(db,"SELECT * FROM engine_occurrences WHERE project_id=?",project.id)]),tree=projectTree(result[0].results.map(decode),result[1].results);
 const placements=item.is_assembly&&!shallow&&!instructionId?tree.subtree(occurrence.id):[occurrence],ids=[...new Set(placements.map(row=>row.item_id))],serialized=JSON.stringify(ids);
 const data=await db.batch([
  statement(db,"SELECT * FROM engine_steps WHERE project_id=? AND item_id IN(SELECT value FROM json_each(?)) ORDER BY sort_order,id",project.id,serialized),
  statement(db,"SELECT * FROM engine_records WHERE project_id=? AND item_id IN(SELECT value FROM json_each(?)) ORDER BY created_at,id",project.id,serialized),
  statement(db,"SELECT * FROM engine_configurations WHERE project_id=? AND item_id IN(SELECT value FROM json_each(?)) ORDER BY created_at,id",project.id,serialized),
  statement(db,"SELECT * FROM engine_events WHERE project_id=? AND item_id IN(SELECT value FROM json_each(?)) AND (json_type(payload,'$.record_id')='text' OR json_type(payload,'$.edited_record_id')='text') ORDER BY created_at,id",project.id,serialized),
  statement(db,"SELECT * FROM engine_file_links WHERE project_id=?",project.id),
  statement(db,"SELECT * FROM engine_files WHERE project_id=? AND state='ready' ORDER BY id",project.id),
  statement(db,"SELECT * FROM engine_selections WHERE project_id=? AND id IN(SELECT value FROM json_each(?))",project.id,serialized)
 ]);
 const [steps,records,configurations,events,links,files,selections]=data.map(result=>result.results.map(decode)),values=await snapshotValuePlan(db,project.id);
 async function capture(definition,placement){
  const ownedSteps=instructionId?instructionTree(steps).subtree(instructionId):steps.filter(row=>row.item_id===definition.id),stepIds=new Set(ownedSteps.map(row=>row.id));
  const ownedRecords=records.filter(row=>row.item_id===definition.id&&(!instructionId||stepIds.has(row.step_id))),ownedConfigs=configurations.filter(row=>row.item_id===definition.id&&(!instructionId||ownedRecords.some(record=>record.configuration_id===row.id))),recordIds=new Set(ownedRecords.map(row=>row.id));
  const recordEvents=events.filter(row=>row.item_id===definition.id&&(recordIds.has(row.payload?.record_id)||recordIds.has(row.payload?.edited_record_id)));
  const recordEventIds=new Set(recordEvents.map(row=>row.id)),ownedLinks=links.filter(row=>!instructionId&&row.item_id===definition.id||recordIds.has(row.record_id)||ownedConfigs.some(config=>row.configuration_id===config.id)||recordEventIds.has(row.event_id));
  const current=ownedLinks.find(row=>row.item_id===definition.id&&row.active),file=files.find(row=>row.id===current?.file_id)||null,selected=selections.find(row=>row.id===definition.id);
  const references={},list=async(kind,rows)=>{const ids=[];for(const row of rows)ids.push(await values.reference(kind,row));return ids;};
  references.steps=await list("step",ownedSteps);references.records=await list("record",ownedRecords);
  references.record_events=await list("event",recordEvents);references.file_links=await list("link",ownedLinks);references.configurations=await list("configuration",ownedConfigs);
  references.files=await list("file",files.filter(saved=>ownedLinks.some(link=>link.file_id===saved.id)));references.file=await values.reference("file",file);
  if(selected)references.selection=await values.reference("selection",selected);
  return {format:5,item:{id:definition.id,...itemDetails(definition),revision_level:definition.revision_level||1},occurrence:{id:placement.id,...buildDetails(placement),root:{id:project.id,name:project.name},parent_id:placement.parent_id||null},references};
 }
 const snapshot=await capture(item,occurrence);
 if(instructionId){const scope=steps.find(row=>row.id===instructionId);snapshot.scope={type:scope.is_group?"group":"instruction",id:scope.id,title:scope.title,revision_level:scope.revision_level};}
 if(item.is_assembly&&!shallow&&!instructionId){snapshot.composition=placements.slice(1).map(child=>({...child,path:tree.path(child),item:{id:child.item_id,name:tree.definitions.get(child.item_id).name,part_number:tree.definitions.get(child.item_id).part_number,revision_level:tree.definitions.get(child.item_id).revision_level||1}}));const seen=new Set([item.id]);snapshot.parts=[];for(const child of placements.slice(1))if(!seen.has(child.item_id)){snapshot.parts.push(await capture(tree.definitions.get(child.item_id),child));seen.add(child.item_id);}}
 if(new TextEncoder().encode(JSON.stringify(snapshot)).length>1000000)throw Error("This revision exceeds the 1 MB history-reference limit. Revising children first will not reduce it. Keep this saved project and contact support before retrying. Nothing was changed.");
 return {snapshot,write:w=>values.write(w)};
}

export async function entryEvidence(db,project,data={}){
 const details=data.entryDetails??{};if(!details||typeof details!=="object"||Array.isArray(details))throw Error("Invalid history explanation.");
 const result={};for(const key of ["whatChanged","whyChanged","notes"]){const value=details[key]??"";if(typeof value!=="string"||value.length>5000||value.includes("\0"))throw Error("History fields must contain at most 5,000 characters.");result[key]=value.trim();}
 const ids=details.photos??[],names=details.photoNames??{};
 if(!Array.isArray(ids)||ids.length>12||new Set(ids).size!==ids.length||!names||typeof names!=="object"||Array.isArray(names)||Object.keys(names).length>12)throw Error("Choose up to 12 distinct named photos.");
 const photos=[];for(const id of ids){if(!/^[a-f0-9-]{36}$/i.test(id))throw Error("Invalid history photo.");const file=await statement(db,"SELECT * FROM engine_files WHERE project_id=? AND id=? AND state='ready'",project.id,id).first();if(!file||!/^image\/(jpeg|png|webp|gif|avif|heic|heif)$/.test(file.content_type))throw Error("A history photo is missing, not an image, or belongs to another project.");photos.push(file);}
 for(const [id,name]of Object.entries(names))if(!ids.includes(id)||typeof name!=="string"||name.length>120)throw Error("Invalid history photo name.");
 return {details:{...result,photos:ids,photoNames:Object.fromEntries(Object.entries(names).map(([id,name])=>[id,name.trim()]))},photos};
}
