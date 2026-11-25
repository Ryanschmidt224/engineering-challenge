import {commitProjectCommand} from "./project-command.js";
import {rows,statement,uuid,text,itemContext,readyFiles,unchangedProject,ProjectNotFound} from "./project-state.js";

// Project/part photo galleries and one current part picture. Removing a photo
// only clears `active`; its row, file metadata and bytes are retained.
export const MEDIA_ROLES=["photo","picture"],MAX_GALLERY=200;
const IMAGE=/^image\/(jpeg|png|webp|gif|avif|heic|heif)$/;
const PICTURE=/^image\/(jpeg|png|webp)$/,MAX_PICTURE=3*1024*1024;

async function owner(db,project,itemId){
 if(itemId===null||itemId===undefined)return null;
 await itemContext(db,project.id,itemId);return itemId;
}
async function mediaRow(db,projectId,id){
 if(!uuid(id))throw new ProjectNotFound("Photo not found.");
 const row=await statement(db,"SELECT * FROM engine_media WHERE project_id=? AND id=?",projectId,id).first();
 if(!row||!row.active)throw new ProjectNotFound("Photo not found.");return row;
}
const gallery=(db,projectId,itemId)=>rows(db,"SELECT * FROM engine_media WHERE project_id=? AND item_id IS ? AND role='photo' AND active=1 ORDER BY sort_order,id",projectId,itemId);

export async function addMedia(db,input,project,data){
 const role=data.role===undefined?"photo":data.role;
 if(!MEDIA_ROLES.includes(role))throw Error("Choose a photo or a part picture.");
 const itemId=await owner(db,project,data.itemId??null);
 if(role==="picture"&&!itemId)throw Error("Choose the part this picture belongs to.");
 const ids=Array.isArray(data.fileIds)?data.fileIds:[data.fileId];
 if(role==="picture"&&ids.length!==1)throw Error("Choose one picture.");
 const files=await readyFiles(db,project.id,ids,20),caption=text(data.caption,500,"Caption");
 for(const file of files){
  if(!(role==="picture"?PICTURE:IMAGE).test(file.content_type))throw Error(role==="picture"?"A part picture must be a JPG, PNG or WebP image.":"Photos accept images only.");
  if(role==="picture"&&file.size>MAX_PICTURE)throw Error("A part picture must be smaller than 3 MB.");
 }
 const existing=role==="photo"?await gallery(db,project.id,itemId):[];
 if(existing.length+files.length>MAX_GALLERY)throw Error("A gallery holds at most "+MAX_GALLERY+" photos.");
 if(files.some(file=>existing.some(row=>row.file_id===file.id)))throw Error("That photo is already in this gallery.");
 const current=role==="picture"?await statement(db,"SELECT * FROM engine_media WHERE project_id=? AND item_id=? AND role='picture' AND active=1",project.id,itemId).first():null;
 if(current?.file_id===files[0]?.id)return {...await unchangedProject(db,project,input),mediaIds:[current.id]};
 let order=Math.max(-1,...existing.map(row=>row.sort_order));
 return commitProjectCommand(db,input,w=>{
  if(current)w.update("engine_media",{active:0,removed_at:w.createdAt},{project_id:project.id,id:current.id,active:1});
  const mediaIds=files.map(file=>{const id=crypto.randomUUID();w.insert("engine_media",{id,project_id:project.id,item_id:itemId,file_id:file.id,role,caption,sort_order:++order,active:1,created_at:w.createdAt});return id;});
  return {mediaIds};
 });
}
export async function editMedia(db,input,project,id,data){
 const row=await mediaRow(db,project.id,id),caption=text(data.caption,500,"Caption");
 if(caption===row.caption)return unchangedProject(db,project,input);
 return commitProjectCommand(db,input,w=>{w.update("engine_media",{caption},{project_id:project.id,id,active:1});return {mediaId:id};});
}
export async function removeMedia(db,input,project,id){
 const row=await mediaRow(db,project.id,id);
 return commitProjectCommand(db,input,w=>{w.update("engine_media",{active:0,removed_at:w.createdAt},{project_id:project.id,id:row.id,active:1});return {mediaId:id};});
}
export async function reorderMedia(db,input,project,data){
 const itemId=await owner(db,project,data.itemId??null),existing=await gallery(db,project.id,itemId);
 if(!Array.isArray(data.ids)||data.ids.length!==existing.length||new Set(data.ids).size!==data.ids.length||data.ids.some(id=>!existing.some(row=>row.id===id)))throw Error("Provide each photo in this gallery exactly once.");
 if(existing.every((row,index)=>row.id===data.ids[index]))return unchangedProject(db,project,input);
 return commitProjectCommand(db,input,w=>{
  // Membership and count are guarded together, like steps and placements.
  w.require("(SELECT COUNT(*) FROM engine_media WHERE project_id=? AND item_id IS ? AND role='photo' AND active=1)=? AND (SELECT COUNT(*) FROM engine_media WHERE project_id=? AND item_id IS ? AND role='photo' AND active=1 AND id IN(SELECT value FROM json_each(?)))=?",project.id,itemId,existing.length,project.id,itemId,JSON.stringify(data.ids),existing.length);
  for(const [sort_order,id]of data.ids.entries())w.update("engine_media",{sort_order},{project_id:project.id,id,active:1});
  return {itemId};
 });
}
