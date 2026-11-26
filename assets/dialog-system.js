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
  const cancel=window.BSUI.button("Cancel"),confirm=window.BSUI.button(confirmLabel,undefined,{variant:danger?"danger":"primary",className:danger?"bs-dialog-danger":""});
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
 // Site-wide help popup. Native title tooltips cannot be styled, so move
 // their message into one viewport-aware, shared tooltip surface on demand.
 // Delegation includes newly created project/workshop controls.
 const globalTooltip=document.createElement("div");
 globalTooltip.className="bs-global-tooltip";
 globalTooltip.id="bs-global-tooltip";
 globalTooltip.setAttribute("role","tooltip");
 globalTooltip.hidden=true;
 document.body.append(globalTooltip);
 let activeTooltip=null,pendingTooltip=null,tooltipTimer=null;
 const tooltipTarget=node=>{
  const el=node instanceof Element?node.closest("[data-bs-tooltip],[title]"):null;
  // This control already includes an interactive, built-in popover.
  return el&&!el.closest(".bs-action-input-help")?el:null;
 };
 const dismissTooltip=()=>{
  clearTimeout(tooltipTimer);tooltipTimer=null;pendingTooltip=null;
  if(activeTooltip){
   const previous=activeTooltip.getAttribute("aria-describedby")||"";
   const restored=previous.split(/\s+/).filter(id=>id!==globalTooltip.id).join(" ");
   if(restored)activeTooltip.setAttribute("aria-describedby",restored);
   else activeTooltip.removeAttribute("aria-describedby");
  }
  activeTooltip=null;globalTooltip.hidden=true;
 };
 const positionTooltip=target=>{
  const bounds=target.getBoundingClientRect();
  const margin=12,gap=9;
  const w=globalTooltip.offsetWidth,h=globalTooltip.offsetHeight;
  const x=Math.max(margin,Math.min(window.innerWidth-w-margin,bounds.left+bounds.width/2-w/2));
  let top=bounds.bottom+gap;
  if(top+h>window.innerHeight-margin&&bounds.top-h-gap>=margin)top=bounds.top-h-gap;
  else top=Math.max(margin,Math.min(top,window.innerHeight-h-margin));
  globalTooltip.style.left=x+"px";
  globalTooltip.style.top=top+"px";
 };
 const showTooltip=target=>{
  if(!target)return;
  const text=(target.getAttribute("data-bs-tooltip")||target.getAttribute("title")||"").trim();
  if(!text)return;
  if(target.hasAttribute("title")){
   target.dataset.bsTooltip=text;
   target.removeAttribute("title");
   if(!target.hasAttribute("aria-label")&&!target.textContent.trim()&&!target.querySelector("img[alt]"))
    target.setAttribute("aria-label",text);
  }
  if(activeTooltip===target)return;
  dismissTooltip();
  // A modal dialog lives in the browser's top layer. A tooltip under body
  // cannot paint above it, even with an arbitrarily high z-index.
  // Mount the same shared tooltip inside the active modal when needed.
  const modal=target.closest("dialog[open]");
  const host=modal&&modal.matches(":modal")?modal:document.body;
  if(globalTooltip.parentNode!==host)host.append(globalTooltip);
  activeTooltip=target;globalTooltip.textContent=text;
  globalTooltip.hidden=false;
  const ids=target.getAttribute("aria-describedby")||"";
  target.setAttribute("aria-describedby",[ids,globalTooltip.id].filter(Boolean).join(" "));
  positionTooltip(target);
 };
 document.addEventListener("pointerover",event=>{
  if(event.pointerType==="touch")return;
  const target=tooltipTarget(event.target);
  if(!target||target===activeTooltip||target===pendingTooltip)return;
  dismissTooltip();pendingTooltip=target;
  // Passing over the page must not immediately cover the next control.
  tooltipTimer=setTimeout(()=>{if(target.isConnected)showTooltip(target);},650);
 },true);
 document.addEventListener("pointerout",event=>{
  const target=pendingTooltip||activeTooltip;
  if(!target||!target.contains(event.target))return;
  if(event.relatedTarget instanceof Node&&target.contains(event.relatedTarget))return;
  dismissTooltip();
 },true);
 document.addEventListener("focusin",()=>requestAnimationFrame(()=>{
  const el=tooltipTarget(document.activeElement);
  el?showTooltip(el):dismissTooltip();
 }),true);
 document.addEventListener("focusout",event=>{
  if(activeTooltip===event.target)dismissTooltip();
 },true);
 document.addEventListener("keydown",event=>{
  if(event.key==="Escape")dismissTooltip();
 },true);
 document.addEventListener("pointerdown",dismissTooltip,true);
 document.addEventListener("click",event=>{
  const target=tooltipTarget(event.target);
  if(!target)return;
  // Help icons are keyboard focusable and tappable; do not intercept the
  // underlying radio, checkbox or page-navigation interaction.
  if(target.matches(".library-function-tip,.library-auto-number-tip,.library-workshop-scope-tip,.library-workshop-search-tip"))
   activeTooltip===target?dismissTooltip():showTooltip(target);
 },true);
 window.addEventListener("scroll",dismissTooltip,true);
 window.addEventListener("resize",dismissTooltip);

 // Reusable help detail: hover remains concise; double-click opens examples.
 // Pages can supply examples through data-bs-examples (JSON string array).
 const helpSelector=".library-function-tip,.library-auto-number-tip,.part-option-help,.bs-help-button";
 const helpTarget=node=>node instanceof Element?node.closest(helpSelector):null;
 const examplesFor=target=>{
  try{
   const data=JSON.parse(target.getAttribute("data-bs-examples")||"[]");
   return Array.isArray(data)?data.filter(item=>typeof item==="string"&&item.trim()).slice(0,8):[];
  }catch{return []}
 };
 const showHelpDetail=target=>{
  if(!target)return;
  dismissTooltip();
  const explanation=(target.dataset.bsTooltip||target.getAttribute("title")||target.getAttribute("aria-label")||"").trim();
  const examples=examplesFor(target);
  const topic=target.dataset.bsHelpTopic||"";
  const heading=(target.dataset.bsHelpTitle||"Field help").trim();
  const dialog=document.createElement("dialog");dialog.className="bs-dialog bs-help-detail-dialog";
  dialog.setAttribute("aria-label",heading);
  const header=document.createElement("div");header.className="bs-help-detail-header";
  const title=document.createElement("h2");title.textContent=heading;
  const close=document.createElement("button");close.type="button";close.className="bs-help-detail-close";
  close.setAttribute("aria-label","Close examples");close.textContent="×";
  header.append(title,close);dialog.append(header);
  const description=document.createElement("p");description.textContent=explanation;dialog.append(description);
  if(topic==="container"){
   // All project items have a stable container. What changes is the
   // implementation linked to it, or whether an implementation exists yet.
   const scenarios=[
    {name:"Custom part — made in-house",container:"Motor Mount",part:"A custom motor bracket",contents:"Rev A: 3D-printed prototype; Rev B: stamped steel. Both are revisions of the same part"},
    {name:"Purchased part",container:"Motor Driver",part:"A manufacturer's motor driver, identified by its MPN",contents:"Suppliers, wiring notes and tests; other commercial drivers can be listed as alternatives"},
    {name:"Part from Workshop",container:"Measure Voltage",part:"A multimeter selected from your Workshop",contents:"The container has its own project notes and work instructions. Workshop source data stays unchanged"},
    {name:"Custom part — purchased",container:"Enclosure",part:"A custom enclosure made by a supplier",contents:"Drawings, revisions, supplier and inspections; manufacturing changes are tracked as revisions"},
    {name:"Assembly or subsystem",container:"Power System",part:"Child containers for the regulator, protection and connectors",contents:"Each child has its own parts, instructions and revisions"},
    {name:"Part not chosen yet",container:"Detect Position",part:"No part selected yet",contents:"Keep project notes and history until a sensor or another solution is chosen"},
    {name:"Document or software work",container:"Control Logic",part:"Code or technical documentation",contents:"Instructions, source files, testing notes and revisions"}
   ];
   const intro=document.createElement("p");intro.className="bs-help-detail-intro";
   intro.textContent="A container is a permanent place in the project hierarchy. Custom part design changes belong in Revisions. Purchased parts can have alternative supplier or manufacturer parts.";
   dialog.append(intro);
   const list=document.createElement("div");list.className="bs-help-scenarios";
   for(const item of scenarios){
    const section=document.createElement("section");section.className="bs-help-scenario";
    const h=document.createElement("h3");h.textContent=item.name;section.append(h);
    for(const [label,value] of [["Container",item.container],["Part",item.part],["Records",item.contents]]){
     const row=document.createElement("div");row.className="bs-help-scenario-row";
     const key=document.createElement("strong");key.textContent=label;
     const detail=document.createElement("span");detail.textContent=value;
     row.append(key,detail);section.append(row);
    }
    list.append(section);
   }
   dialog.classList.add("bs-help-container-guide");
   dialog.append(list);
  }else if(examples.length){
   const exampleTitle=document.createElement("h3");exampleTitle.textContent="Examples";dialog.append(exampleTitle);
   const list=document.createElement("ul");list.className="bs-help-examples";
   for(const example of examples){const li=document.createElement("li");li.textContent=example;list.append(li)}
   dialog.append(list);
  }
  const finish=()=>{if(dialog.open)dialog.close();dialog.remove();if(target.isConnected)target.focus?.({preventScroll:true})};
  close.addEventListener("click",finish);
  dialog.addEventListener("cancel",event=>{event.preventDefault();finish()});
  dialog.addEventListener("click",event=>{if(event.target===dialog)finish()});
  document.body.append(dialog);
  dialog.showModal();close.focus();
 };
 document.addEventListener("dblclick",event=>{
  const target=helpTarget(event.target);
  if(!target)return;
  event.preventDefault();event.stopPropagation();showHelpDetail(target);
 },true);
 document.addEventListener("keydown",event=>{
  const target=helpTarget(event.target);
  if(!target||!["Enter"," "].includes(event.key))return;
  event.preventDefault();showHelpDetail(target);
 },true);
 const helpButton=(label,message,examples=[])=>{
  const button=document.createElement("button");button.type="button";
  button.className="bs-help-button";button.textContent="ⓘ";
  button.dataset.bsTooltip=message;button.dataset.bsHelpTitle=label;
  button.dataset.bsExamples=JSON.stringify(examples);
  button.setAttribute("aria-label",label+": "+message);
  button.title=message;
  return button;
 };

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
  helpButton,
  valueTooltip:()=>tooltip("Value symbols and Windows Alt codes",
   "Windows: hold Alt, type the code on the numeric keypad with Num Lock on, then release Alt. Ω (ohms): Alt+234. µ (micro): Alt+0181. ± (plus/minus): Alt+0177. ° (degrees): Alt+0176. You can also copy these symbols: Ω µ ± °. Examples: 10 kΩ, 100 µF, ±5%."),
  confirm:(message,options={})=>open({...options,message,confirmLabel:options.confirmLabel||"Confirm"}),
  danger:(message,options={})=>open({...options,message,danger:true,confirmLabel:options.confirmLabel||"Delete"}),
  prompt:(message,value="",options={})=>open({...options,message,value,input:true,confirmLabel:options.confirmLabel||"Save"})
 });
})();
