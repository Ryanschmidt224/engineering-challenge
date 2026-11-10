/* Shared photo-editor chrome: one pencil launch and modal frame across
 * projects, subassemblies and parts. Data/API differences stay in callers.
 * No uploads, records or photo deletion happen inside this UI-only module.
 */
(function(){
 "use strict";
 function pencil(cover,label){
  if(!cover)throw Error("Photo editor requires a cover element");
  const shell=document.createElement("div");
  shell.className="workspace-cover-shell";
  cover.before(shell);shell.append(cover);
  const button=document.createElement("button");
  button.type="button";
  button.className="workspace-photo-launch";
  button.textContent="✎";
  button.title=label;
  button.setAttribute("aria-label",label);
  shell.append(button);
  return button;
 }
 function dialog({parent,label,className="workspace-photo-dialog",doneClass="",content,contentHtml}){
  if(!parent)throw Error("Photo editor requires a parent");
  const modal=document.createElement("dialog");
  modal.className=className;
  modal.setAttribute("aria-label",label);
  const header=document.createElement("div");
  header.className="workspace-photo-dialog-header";
  const close=document.createElement("button");
  close.type="button";
  close.className=("btn "+doneClass).trim();
  close.textContent="Done";
  close.onclick=()=>modal.close();
  header.append(close);
  modal.append(header);
  if(content)modal.append(content);
  else if(contentHtml!==undefined){
   const body=document.createElement("div");
   body.innerHTML=contentHtml;
   while(body.firstChild)modal.append(body.firstChild);
  }
  parent.append(modal);
  modal.addEventListener("click",event=>{if(event.target===modal)modal.close()});
  return modal;
 }
 window.BSPhotoEditor=Object.freeze({pencil,dialog});
})();
