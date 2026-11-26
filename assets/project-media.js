import {viewMode} from "./view-mode.js";
import {node,field,actions} from "./workshop-ui.js";
import {confirmAction} from "./project-editors.js";

// Project/part photo galleries and the part picture. Removing a photo hides it;
// the stored file and its row are kept. Double-click a photo for full size.
const button=(...args)=>window.BSUI.button(...args);
const SHOWN=/^image\/(jpeg|png|webp|gif|avif)$/,PICTURE=/^image\/(jpeg|png|webp)$/;
const src=(ctx,file)=>"/api/project-engine/projects/"+ctx.projectId+"/files/"+file.id+"?inline=1";
const fileOf=(ctx,row)=>ctx.client.state.files.find(file=>file.id===row.file_id);
// Keep a gallery open across the page refresh that follows each save.
const opened=new Set();
export const photosFor=(state,itemId=null)=>(state.media||[]).filter(row=>row.active&&row.role==="photo"&&(row.item_id||null)===itemId).sort((a,b)=>a.sort_order-b.sort_order||a.id.localeCompare(b.id));
export const pictureFor=(state,itemId)=>(state.media||[]).find(row=>row.active&&row.role==="picture"&&row.item_id===itemId)||null;

function thumbnail(ctx,file,alt){
 if(!file)return node("p","Unavailable photo","muted");
 if(!SHOWN.test(file.content_type)){const note=node("p","","muted");note.append(document.createTextNode(file.name+" can't be shown here (HEIC photos need converting to JPG). "));const link=node("a","Download");link.href=src(ctx,file).replace("?inline=1","");note.append(link);return note;}
 const img=node("img","","project-media-image");img.src=src(ctx,file);img.alt=alt||file.name;img.loading="lazy";img.title="Double-click for full size";return img;
}
async function send(ctx,path,method,data,message){
 try{await ctx.client.write(ctx.projectId,path,method,data);await ctx.refresh();ctx.notify(message);}catch(error){ctx.notify(error.message);}
}
// Upload images as supporting files, then attach them in one guarded save.
async function addFiles(ctx,files,{itemId=null,role="photo"}={}){
 const images=files.filter(file=>file.type.startsWith("image/")||/\.hei[cf]$/i.test(file.name));
 if(!images.length){ctx.notify("Choose image files.");return;}
 if(images.some(file=>file.size>20*1024*1024)){ctx.notify("Choose images of at most 20 MB each.");return;}
 if(role==="picture"&&(images.length!==1||!PICTURE.test(images[0].type)||images[0].size>=3*1024*1024)){ctx.notify("A part picture must be one JPG, PNG or WebP image smaller than 3 MB.");return;}
 ctx.notify("Uploading "+images.length+" photo"+(images.length===1?"":"s")+"…");
 try{
  const fileIds=[];for(const file of images.slice(0,20))fileIds.push((await ctx.client.upload(ctx.projectId,file)).fileId);
  await ctx.client.write(ctx.projectId,"/media","POST",{fileIds,role,...(itemId?{itemId}:{})});await ctx.refresh();
  ctx.notify(role==="picture"?"Picture saved. The earlier picture is kept in storage.":fileIds.length+" photo"+(fileIds.length===1?"":"s")+" added."+(images.length>20?" Add the rest in another batch of up to 20.":""));
 }catch(error){ctx.notify(error.message);}
}
function picker(onFiles,{multiple=true,label}){
 const input=node("input");input.type="file";input.accept="image/*";input.multiple=multiple;input.hidden=true;input.setAttribute("aria-label",label);
 input.onchange=()=>{const files=[...input.files];input.value="";if(files.length)onFiles(files);};
 return {input,open:()=>input.click()};
}
function acceptDrops(area,onFiles){
 area.addEventListener("paste",event=>{const files=[...(event.clipboardData?.files||[])];if(files.length){event.preventDefault();onFiles(files);}});
 area.addEventListener("dragover",event=>{if([...event.dataTransfer.types].includes("Files"))event.preventDefault();});
 area.addEventListener("drop",event=>{const files=[...event.dataTransfer.files];if(files.length){event.preventDefault();event.stopPropagation();onFiles(files);}});
}
function editCaption(ctx,row){
 let caption=row.caption;const dialog=ctx.dialog,form=node("form"),error=node("p","","error");
 form.append(field("Caption",caption,value=>caption=value),error,actions(button("Save caption",()=>form.requestSubmit(),{variant:"primary"}),button("Cancel",()=>dialog.close())));
 form.onsubmit=async event=>{event.preventDefault();try{await ctx.client.write(ctx.projectId,"/media/"+row.id,"PATCH",{caption});await ctx.refresh();dialog.close();ctx.notify("Caption saved.");}catch(problem){error.textContent=problem.message;}};
 dialog.replaceChildren(node("h2","Photo caption"),form);dialog.setAttribute("aria-label","Photo caption");dialog.showModal();form.querySelector("input")?.focus();
}

export function mediaGallery(ctx,{itemId=null,title="Photos"}={}){
 const photos=photosFor(ctx.client.state,itemId),body=node("div","","project-photo-tools"),section={body,root:body};body.dataset.section=itemId?"part-photos":"project-photos";
 const add=files=>addFiles(ctx,files,{itemId}),choose=picker(add,{label:title+" files"});
 const uploadRow=node("div","","bs-photo-upload-row"),addButton=button("Add photos",choose.open);
 const grid=node("div","","project-media-grid"),mode=viewMode({label:"Photo view",storageKey:"bs-photo-view",initial:"tiles",onChange:value=>grid.dataset.view=value});grid.dataset.view=mode.value;
 const move=async(index,delta)=>{const ids=photos.map(row=>row.id);[ids[index],ids[index+delta]]=[ids[index+delta],ids[index]];await send(ctx,"/media/reorder","POST",{ids,...(itemId?{itemId}:{})},"Photo order saved.");};
 photos.forEach((row,index)=>{
  const file=fileOf(ctx,row),tile=node("figure","","project-media-tile"),caption=node("figcaption",row.caption||file?.name||"Unavailable photo");
  const remove=button("Remove",()=>confirmAction(ctx,"Remove photo","Remove this photo from the gallery? The stored file is kept.","Remove photo",token=>ctx.client.write(ctx.projectId,"/media/"+row.id+"/remove","POST",{},token)),{variant:"quiet",small:true});
  const tools=actions(button("Caption",()=>editCaption(ctx,row),{variant:"quiet",small:true}),...(index>0?[button("←",()=>move(index,-1),{variant:"quiet",small:true})]:[]),...(index<photos.length-1?[button("→",()=>move(index,1),{variant:"quiet",small:true})]:[]),remove);
  for(const control of tools.querySelectorAll("button"))if(["←","→"].includes(control.textContent))control.setAttribute("aria-label",control.textContent==="←"?"Move photo earlier":"Move photo later");
  const meta=node("small",file?(file.name+" · "+Math.ceil(file.size/1024)+" KB"):"Unavailable file","project-media-meta"),image=thumbnail(ctx,file,row.caption),key="media:"+ctx.projectId+":"+row.id;tile.append(image);const controls=window.BSPhotoEditor.actionBar(image,{content:tools,expanded:opened.has(key),onToggle:open=>{if(open)opened.add(key);else opened.delete(key);}});controls.panel.classList.add("project-photo-editor");tile.append(caption,meta,controls.panel);grid.append(tile);
 });
 const paste=window.BSPhotoMarkup.pasteTarget((incoming,event)=>{event?.stopPropagation();void add(incoming);});paste.textContent="Drop photos or paste an image";paste.title="Right-click and choose Paste, or press Ctrl+V.";
 uploadRow.append(addButton,paste,mode.root);section.body.append(uploadRow,choose.input,grid);
 acceptDrops(section.body,add);return section.root;
}

// Every overview uses the shared bottom-right pencil. All management tools
// live inside its disclosure; no separate photo field or gallery section.
function photoControl(ctx,cover,tools,key){
 const holder=node("div","","project-picture-holder");holder.append(cover);
 const controls=window.BSPhotoEditor.actionBar(cover,{content:tools,expanded:opened.has(key),onToggle:open=>{if(open)opened.add(key);else opened.delete(key);}});holder.editorPanel=controls.panel;controls.panel.classList.add("project-photo-editor");
 return holder;
}

// Falls back to an image CAD file without changing that file's stored role.
export function partPicture(ctx,item,engineeringFile=null){
 const current=pictureFor(ctx.client.state,item.id),file=current?fileOf(ctx,current):engineeringFile&&SHOWN.test(engineeringFile.content_type)?engineeringFile:null;
 const cover=file?thumbnail(ctx,file,item.name):node("p","No picture yet","muted");if(cover.tagName==="IMG")cover.className="project-picture";
 const tools=node("div","","project-picture-tools"),choose=picker(files=>addFiles(ctx,files,{itemId:item.id,role:"picture"}),{multiple:false,label:"Part picture"});choose.input.accept="image/jpeg,image/png,image/webp";
 const controls=[button(current?"Replace picture":"Add picture",choose.open,{variant:"quiet",small:true})];
 if(current)controls.push(button("Remove picture",()=>confirmAction(ctx,"Remove picture","Remove this part's picture? The stored file is kept.","Remove picture",token=>ctx.client.write(ctx.projectId,"/media/"+current.id+"/remove","POST",{},token)),{variant:"quiet",small:true}));
 tools.append(choose.input,actions(...controls),mediaGallery(ctx,{itemId:item.id,title:"Additional photos"}));
 return photoControl(ctx,cover,tools,ctx.projectId+":"+item.id);
}

// The same first gallery photo used by the project directory.
export function projectPicture(ctx,{assembly=null,gallery=false}={}){
 const photo=photosFor(ctx.client.state)[0],file=photo?fileOf(ctx,photo):null;
 const cover=file?thumbnail(ctx,file,photo.caption||ctx.client.state.project.name):node("p","No picture yet","muted");if(cover.tagName==="IMG")cover.className="project-picture";
 const tools=node("div","","project-picture-tools");tools.append(mediaGallery(ctx,{title:"Project photos"}));
 // Keep the original top assembly's pictures accessible when its row is folded
 // into Project summary. They retain their original item and file IDs.
 if(assembly){const group=node("div","","project-assembly-photo-tools");group.append(node("strong","Top assembly · "+assembly.part_number),partPicture(ctx,assembly));tools.append(group);}
 if(gallery){const images=node("div","","project-summary-photo-grid");for(const photo of photosFor(ctx.client.state)){const img=thumbnail(ctx,fileOf(ctx,photo),photo.caption||ctx.client.state.project.name);img.className="project-summary-photo";images.append(img);}if(!images.childElementCount)images.append(cover);return photoControl(ctx,images,tools,ctx.projectId+":");}
 return photoControl(ctx,cover,tools,ctx.projectId+":");
}
