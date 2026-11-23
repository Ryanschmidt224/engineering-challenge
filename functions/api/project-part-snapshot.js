import {rows,statement,decode,itemDetails,buildDetails,currentEngineeringFile} from "./project-state.js";

// Project-wide command admission checks the loaded token after these reads.
// Referenced file objects are immutable and retained; no mutable URL is copied.
export async function captureProjectPart(db,project,item,occurrence){
 const steps=await rows(db,"SELECT * FROM engine_steps WHERE project_id=? AND item_id=? ORDER BY sort_order,id",project.id,item.id);
 const records=await rows(db,"SELECT * FROM engine_records WHERE project_id=? AND item_id=? ORDER BY created_at,id",project.id,item.id);
 const configurations=await rows(db,"SELECT * FROM engine_configurations WHERE project_id=? AND item_id=? ORDER BY created_at,id",project.id,item.id);
 const files=await rows(db,`SELECT DISTINCT f.* FROM engine_files f JOIN engine_file_links l ON l.project_id=f.project_id AND l.file_id=f.id WHERE f.project_id=? AND f.state='ready' AND (l.item_id=? OR l.record_id IN(SELECT id FROM engine_records WHERE project_id=? AND item_id=?) OR l.configuration_id IN(SELECT id FROM engine_configurations WHERE project_id=? AND item_id=?) OR l.event_id IN(SELECT id FROM engine_events WHERE project_id=? AND item_id=?)) ORDER BY f.id`,project.id,item.id,project.id,item.id,project.id,item.id,project.id,item.id);
 const file=await currentEngineeringFile(db,project.id,item.id);
 const snapshot={format:2,item:{id:item.id,...itemDetails(item),revision_level:item.revision_level||1},occurrence:{id:occurrence.id,...buildDetails(occurrence),root:{id:project.id,name:project.name}},file,steps,records:records.map(decode),configurations:configurations.map(decode),files};
 if(new TextEncoder().encode(JSON.stringify(snapshot)).length>500000)throw Error("This part's saved context is too large for the preview snapshot. Nothing was changed.");
 return snapshot;
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
