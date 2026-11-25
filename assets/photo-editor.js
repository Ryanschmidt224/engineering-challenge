/* Shared photo editing controls for projects, assemblies and parts.
 * Only the markup, add, paste, and delete callbacks differ by photo source.
 */
(function(){
 "use strict";
 function actionBar(cover,{onMarkup,onAdd,onPaste,onDelete,content,expanded=false,onToggle}={}){
  if(!cover)throw Error("Photo actions require a photo element");
  const shell=document.createElement("div");shell.className="bs-photo-control";
  cover.before(shell);shell.append(cover);
  const bar=document.createElement("div");bar.className="bs-photo-actions";
  const edit=document.createElement("button");edit.type="button";edit.className="btn bs-photo-toggle";
  edit.innerHTML='<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L9 17l-4 1 1-4Z"/></svg>';edit.title="Edit photo";edit.setAttribute("aria-label","Edit photo");edit.setAttribute("aria-expanded","false");
  const more=document.createElement("div");more.className="bs-photo-more";more.hidden=true;
  const make=(name,fn,className)=>{
   const button=document.createElement("button");button.type="button";button.className="btn "+className;
   button.textContent=name;button.onclick=()=>fn?.();return button;
  };
  const markup=make("Markup / annotate",onMarkup,"bs-photo-markup");
  let uploader=null;
  const add=make("Add",()=>{if(uploader)uploader.open();else onAdd?.()},"bs-photo-add");
  const remove=make("Delete",onDelete,"bs-photo-delete");
  if(content){more.append(content);shell.classList.add("bs-photo-custom-tools");}else more.append(markup,add,remove);bar.append(edit,more);shell.append(bar);
  if(onPaste){
   uploader=uploadPanel({title:"Add photos",accept:"image/*,.heic,.heif",multiple:false,
    onFiles:files=>{if(files[0])return onPaste(files[0])}});
   shell.append(uploader.panel);
  }
  const status=document.createElement("p");status.className="bs-photo-status";status.setAttribute("role","status");
  status.setAttribute("aria-live","polite");shell.append(status);
  let enabled=true,present=false;
  const sync=()=>{
   edit.hidden=!enabled;more.hidden=!enabled||edit.getAttribute("aria-expanded")!=="true";
   if(uploader&&more.hidden)uploader.close();
   markup.disabled=!present;remove.disabled=!present;
  };
  edit.onclick=()=>{
   if(!enabled)return;
   const next=edit.getAttribute("aria-expanded")!=="true";
   edit.setAttribute("aria-expanded",String(next));sync();onToggle?.(next);
  };
  edit.setAttribute("aria-expanded",String(expanded));sync();
  return {
   shell,edit,markup,add,remove,status,
   setEnabled(value){enabled=!!value;sync()},
   setPhotoPresent(value){present=!!value;sync()},
   setStatus(message){status.textContent=message||""},
   collapse(){edit.setAttribute("aria-expanded","false");sync()},
   showActions(){edit.setAttribute("aria-expanded","true");sync()}
  };
 }
 function dialog({parent,label,className="workspace-photo-dialog",doneClass="",content,contentHtml}){
  if(!parent)throw Error("Photo editor requires a parent");
  const modal=document.createElement("dialog");modal.className=className;modal.setAttribute("aria-label",label);
  const header=document.createElement("div");header.className="workspace-photo-dialog-header";
  const close=document.createElement("button");close.type="button";close.className=("btn "+doneClass).trim();
  close.textContent="Done";close.onclick=()=>modal.close();header.append(close);modal.append(header);
  if(content)modal.append(content);
  else if(contentHtml!==undefined){const body=document.createElement("div");body.innerHTML=contentHtml;while(body.firstChild)modal.append(body.firstChild)}
  parent.append(modal);modal.addEventListener("click",e=>{if(e.target===modal)modal.close()});return modal;
 }

 // One reusable, on-demand upload surface for images and optional documents.
 // The caller supplies upload/storage logic; this component owns only UI and input events.
 function uploadPanel({onFiles,accept="image/*,.heic,.heif",multiple=true,title="Add photos",hint=""}={}){
  if(typeof onFiles!=="function")throw Error("Photo upload requires an onFiles callback");
  const panel=document.createElement("section");panel.className="bs-upload-panel";panel.hidden=true;
  const heading=document.createElement("div");heading.className="bs-upload-heading";
  const name=document.createElement("strong");name.textContent=title;
  const close=window.BSUI.button("Close",()=>{panel.hidden=true});close.classList.add("bs-upload-close");
  heading.append(name,close);
  const text=document.createElement("p");text.className="bs-upload-hint";
  text.textContent="Drop files in the box, right-click and Paste an image, or choose files from your device.";
  const fileInput=document.createElement("input");fileInput.type="file";fileInput.accept=accept;fileInput.multiple=multiple;fileInput.hidden=true;
  const choose=window.BSUI.button(multiple?"Choose files":"Choose file",()=>fileInput.click(),{variant:"primary"});choose.classList.add("bs-upload-choose");
  const drop=window.BSPhotoMarkup.pasteTarget(files=>onFiles(files));
  drop.classList.add("bs-upload-drop");
  drop.textContent="Drag and drop files here or right-click to paste an image (Ctrl+V)";
  // Capture drops before pasteTarget, which only accepts images; document
  // uploaders also need PDF/CAD files to reach their normal validation.
  drop.addEventListener("drop",event=>{
   if(!event.dataTransfer?.files?.length)return;
   event.preventDefault();event.stopImmediatePropagation();drop.classList.remove("is-dragover");
   void onFiles([...event.dataTransfer.files].slice(0,multiple?undefined:1));
  },true);
  fileInput.onchange=()=>{
   const files=[...(fileInput.files||[])];fileInput.value="";
   if(files.length)void onFiles(files);
  };
  panel.append(heading,text,drop,choose,fileInput);
  if(hint){const note=document.createElement("p");note.className="bs-upload-hint";note.textContent=hint;panel.append(note)}
  return {panel,open(nextTitle){name.textContent=nextTitle||title;panel.hidden=false;drop.focus()},close(){panel.hidden=true},choose,drop,fileInput};
 }

 window.BSPhotoEditor=Object.freeze({actionBar,dialog,uploadPanel});
})();
