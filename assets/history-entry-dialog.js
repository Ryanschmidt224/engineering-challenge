import {dialogForm} from "./dialog-form.js";
const openPrompts=new WeakMap();
const make=(tag,text="",cls="")=>{const node=document.createElement(tag);node.textContent=text;node.className=cls;return node;};

// One explanation/photo draft per trigger. Uploaded photo IDs survive failed
// saves; identical retries retain their operation ID, edited payloads get a new one.
export function openHistoryEntryDialog({trigger,project,title,description,submitLabel,archive=false,ui,photoEditor,onSave,uploadPhoto}){
 const existing=openPrompts.get(trigger);if(existing?.dialog.open){existing.dialog.focus();return existing;}
 const fields={},photos=[];let dirty=false,operation=null,previousPayload=null;
 const warn=event=>{if(form.dialog.open&&(dirty||form.isBusy())){event.preventDefault();event.returnValue="";}};
 const form=dialogForm({title,description,submitLabel,ui,onClose(){
  window.removeEventListener("beforeunload",warn);for(const photo of photos)URL.revokeObjectURL(photo.url);openPrompts.delete(trigger);
 },onSubmit:async()=>{
  for(const photo of photos){
   if(photo.id)continue;
   if(uploadPhoto)photo.id=await uploadPhoto(photo.file);
   else{const response=await fetch("/api/recipe-files?project="+encodeURIComponent(project),{method:"POST",credentials:"same-origin",headers:{"content-type":"application/octet-stream","x-file-name":encodeURIComponent(photo.file.name)},body:photo.file});
    const data=await response.json();if(!response.ok||!data.id)throw Error(data.error||"Photo upload failed. Your draft is preserved.");photo.id=data.id;}
  }
  const details={whatChanged:fields.whatChanged?.value||"",whyChanged:fields.whyChanged.value,notes:fields.notes.value,photos:photos.map(photo=>photo.id),photoNames:Object.fromEntries(photos.filter(photo=>photo.name.trim()).map(photo=>[photo.id,photo.name.trim()]))};
  const fingerprint=JSON.stringify(details);if(previousPayload!==fingerprint){operation=crypto.randomUUID();previousPayload=fingerprint;}
  await onSave(details,operation);dirty=false;
 }});
 for(const [key,label] of [...(archive?[]:[["whatChanged","What changed"]]),["whyChanged",archive?"Why are you archiving it?":"Why did you change it"],["notes","Notes"]]){
  const field=make("div","","bs-dialog-field"),caption=make("label",label),input=make("textarea","","field ui-control");input.rows=3;input.maxLength=5000;input.addEventListener("input",()=>{dirty=true;});caption.append(input);field.append(caption);form.body.append(field);fields[key]=input;
 }
 const gallery=make("div","","investigation-note-photo-gallery");
 function draw(){
  gallery.replaceChildren();for(const photo of photos){
   const tile=make("figure","","investigation-named-photo"),image=make("img","","investigation-note-photo");image.src=photo.url;image.alt=photo.name||photo.file.name;
   const caption=make("input","","field ui-control");caption.type="text";caption.maxLength=120;caption.placeholder="Photo name (optional)";caption.setAttribute("aria-label","Photo name for "+photo.file.name);caption.value=photo.name;caption.oninput=()=>{photo.name=caption.value;image.alt=photo.name||photo.file.name;dirty=true;};
   tile.append(image,caption,ui.button("Remove photo",()=>{URL.revokeObjectURL(photo.url);photos.splice(photos.indexOf(photo),1);dirty=true;draw();}));gallery.append(tile);
  }
 }
 const uploader=photoEditor.uploadPanel({title:"Add photos",accept:"image/*,.heic,.heif",hint:"Up to 12 photos, 20 MB each. Fields and photos are optional.",onFiles:files=>{
  if(form.isBusy())return;
  for(const file of files){
   if(!/\.(jpg|jpeg|png|webp|gif|heic|heif)$/i.test(file.name)){form.feedback.textContent="Choose an image file.";continue;}
   if(file.size>20*1024*1024){form.feedback.textContent="Each photo must be 20 MB or smaller.";continue;}
   if(photos.length>=12){form.feedback.textContent="Choose up to 12 photos.";break;}
   photos.push({file,id:null,name:"",url:URL.createObjectURL(file)});dirty=true;
  }draw();
 }});
 const add=ui.button("Add photos",()=>{if(uploader.panel.hidden)uploader.open();else uploader.close();});form.body.append(add,uploader.panel,gallery);
 window.addEventListener("beforeunload",warn);openPrompts.set(trigger,form);form.open();return form;
}

export function renderHistoryEntryDetails(details,target,{ui,imageUrlFor,archive=false}){
 if(!details)return;
 for(const [key,label] of [["whatChanged","What changed"],["whyChanged",archive?"Why it was archived":"Why did you change it"],["notes","Notes"]])if(details[key])target.append(ui.fieldRow(label,details[key]).root);
 const gallery=make("div","","investigation-note-photo-gallery");
 for(const id of details.photos||[]){const tile=make("figure","","investigation-named-photo"),image=make("img","","investigation-note-photo");image.src=imageUrlFor(id);image.alt=details.photoNames?.[id]||"History photo";image.loading="lazy";tile.append(image);if(details.photoNames?.[id])tile.append(make("figcaption",details.photoNames[id]));gallery.append(tile);}
 if(gallery.childElementCount)target.append(gallery);
}
