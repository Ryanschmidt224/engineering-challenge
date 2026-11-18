/* Centralized, accessible confirmation and input popups.
   Does not override native window.confirm(), which is synchronous. */
(()=>{
 "use strict";
 if(window.BSDialogs)return;
 const open=({title="Confirm action",message="",confirmLabel="Confirm",danger=false,
  input=false,value="",label="",multiline=false,placeholder=""}={})=>new Promise(resolve=>{
  const dialog=document.createElement("dialog");
  dialog.className="bs-dialog";
  const heading=document.createElement("h2");
  heading.id="bs-dialog-title-"+Math.random().toString(36).slice(2);
  heading.textContent=title;
  const detail=document.createElement("p");detail.textContent=message;
  dialog.setAttribute("aria-labelledby",heading.id);
  dialog.append(heading,detail);
  let field;
  if(input){
   const holder=document.createElement("div");holder.className="bs-dialog-field";
   const labelEl=document.createElement("label");
   labelEl.textContent=label||"Value";
   field=document.createElement(multiline?"textarea":"input");
   if(!multiline)field.type="text";
   field.value=value??"";
   field.placeholder=placeholder;
   labelEl.append(field);holder.append(labelEl);dialog.append(holder);
  }
  const actions=document.createElement("div");actions.className="bs-dialog-actions";
  const cancel=document.createElement("button"),confirm=document.createElement("button");
  for(const button of [cancel,confirm])button.type="button";
  cancel.className="btn";cancel.textContent="Cancel";
  confirm.className=danger?"btn bs-dialog-danger":"btn primary";
  confirm.textContent=confirmLabel;
  actions.append(cancel,confirm);dialog.append(actions);document.body.append(dialog);
  let finished=false;
  const finish=ok=>{
   if(finished)return;
   finished=true;
   const answer=ok?(input?field.value:true):(input?null:false);
   if(dialog.open)dialog.close();
   dialog.remove();
   resolve(answer);
  };
  cancel.addEventListener("click",()=>finish(false));
  confirm.addEventListener("click",()=>finish(true));
  dialog.addEventListener("cancel",event=>{event.preventDefault();finish(false)});
  dialog.addEventListener("close",()=>finish(false));
  dialog.addEventListener("click",event=>{
   if(event.target===dialog)finish(false);
  });
  if(field&&!multiline)field.addEventListener("keydown",event=>{
   if(event.key==="Enter"){event.preventDefault();finish(true)}
  });
  dialog.showModal();
  (field||cancel).focus();
 });
 let tooltipId=0;
 function tooltip(label,message){
  const wrapper=document.createElement("span");wrapper.className="bs-section-tooltip";
  const button=document.createElement("button");button.type="button";button.textContent="ⓘ";
  button.setAttribute("aria-label",label);
  const tip=document.createElement("span");tip.id="bs-section-tooltip-"+(++tooltipId);
  tip.className="bs-section-tooltip-content";tip.setAttribute("role","tooltip");tip.textContent=message;
  button.setAttribute("aria-describedby",tip.id);
  button.onclick=event=>{event.preventDefault();event.stopPropagation();button.focus()};
  button.onkeydown=event=>{
   if(event.key==="Escape"){
    event.stopPropagation();
    wrapper.classList.add("tooltip-dismissed");
   }
  };
  button.onblur=()=>wrapper.classList.remove("tooltip-dismissed");
  wrapper.append(button,tip);
  return wrapper;
 }
 window.BSDialogs=Object.freeze({
  tooltip,
  confirm:(message,options={})=>open({...options,message,confirmLabel:options.confirmLabel||"Confirm"}),
  danger:(message,options={})=>open({...options,message,danger:true,confirmLabel:options.confirmLabel||"Delete"}),
  prompt:(message,value="",options={})=>open({...options,message,value,input:true,confirmLabel:options.confirmLabel||"Save"})
 });
})();
