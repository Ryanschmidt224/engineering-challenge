/* Shared photo editing controls for projects, assemblies and parts.
 * Only the markup, add, and delete callbacks differ by photo source.
 */
(function(){
 "use strict";
 function actionBar(cover,{onMarkup,onAdd,onDelete}={}){
  if(!cover)throw Error("Photo actions require a photo element");
  const shell=document.createElement("div");shell.className="bs-photo-control";
  cover.before(shell);shell.append(cover);
  const bar=document.createElement("div");bar.className="bs-photo-actions";
  const edit=document.createElement("button");edit.type="button";edit.className="btn bs-photo-toggle";
  edit.textContent="Edit photo";edit.setAttribute("aria-expanded","false");
  const more=document.createElement("div");more.className="bs-photo-more";more.hidden=true;
  const make=(name,fn,className)=>{
   const button=document.createElement("button");button.type="button";button.className="btn "+className;
   button.textContent=name;button.onclick=()=>fn?.();return button;
  };
  const markup=make("Markup / annotate",onMarkup,"bs-photo-markup");
  const add=make("Add",onAdd,"bs-photo-add");
  const remove=make("Delete",onDelete,"bs-photo-delete");
  more.append(markup,add,remove);bar.append(edit,more);shell.append(bar);
  const status=document.createElement("p");status.className="bs-photo-status";status.setAttribute("role","status");
  status.setAttribute("aria-live","polite");shell.append(status);
  let enabled=true,present=false;
  const sync=()=>{
   edit.hidden=!enabled;more.hidden=!enabled||edit.getAttribute("aria-expanded")!=="true";
   markup.disabled=!present;remove.disabled=!present;
  };
  edit.onclick=()=>{
   if(!enabled)return;
   const next=edit.getAttribute("aria-expanded")!=="true";
   edit.setAttribute("aria-expanded",String(next));sync();
  };
  sync();
  return {
   shell,edit,markup,add,remove,status,
   setEnabled(value){enabled=!!value;sync()},
   setPhotoPresent(value){present=!!value;sync()},
   setStatus(message){status.textContent=message||""},
   collapse(){edit.setAttribute("aria-expanded","false");sync()},
   showActions(){edit.setAttribute("aria-expanded","true");sync()}
  };
 }
 // Kept for older photo-management dialogs while the new inline controls
 // become the default. No photo data is modified by this UI component.
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
 window.BSPhotoEditor=Object.freeze({actionBar,dialog});
})();
