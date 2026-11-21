/* Work Instructions are named containers for regular typed entry records. */
(function(){
 "use strict";
 const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node};
 const button=(label,fn,cls="btn")=>{const node=el("button",cls,label);node.type="button";node.onclick=fn;return node};
 // Stable IDs keep linked entry records associated with their container.
 const newId=()=>crypto?.randomUUID?.()||"note_"+Date.now()+"_"+Math.random().toString(36).slice(2);
 // A Work Instruction is only a named container. All content lives in
 // independently editable Notes / Tests / Revisions / Failures records.
 const normalize=x=>({
  id:x.id,
  title:typeof x.title==="string"?x.title:"",
  archivedAt:x.archivedAt||"",
  archiveNote:x.archiveNote||"",
  tileOrder:Array.isArray(x.tileOrder)?x.tileOrder.filter(id=>typeof id==="string"&&id.startsWith("record:")).slice(0,300):[]
 });
 function mount(article,options={}){
  if(!article)return null;
  const panel=el("section","recipe-editor recipe-compact"),content=el("div","recipe-content"),feedback=el("p","recipe-feedback muted");
  panel.append(content,feedback);
  const heading=article.querySelector("h2");
  const headingActions=el("div","recipe-heading-actions");
  const count=el("span","workspace-record-count");
  if(heading){
   const headingRow=el("div","recipe-heading-row");
   heading.before(headingRow);headingActions.append(heading);headingRow.append(headingActions,count);headingRow.after(panel);
  }else article.prepend(headingActions,panel);
  const admin=()=>!!options.admin?.();
  let steps=[],expanded=null,dirty=false,pendingUploads=0,saving=false,draft=null,scope=null,loading=true;
  const editing=new Set();
  const editSnapshots=new Map();
  let archivedStepsExpanded=false;
  window.addEventListener("beforeunload",event=>{if(!dirty&&!pendingUploads&&!saving&&!draft)return;event.preventDefault();event.returnValue="";});
  let changeVersion=0,saveTimer=null,savePromise=null,allowReplay=false;
  async function savePending(){
   clearTimeout(saveTimer);
   if(savePromise){await savePromise;if(!dirty)return; }
   if(!dirty)return;
   if(pendingUploads)throw Error("Finish uploading photos or documents before leaving this step.");
   if(savedSteps().some(step=>!step.title.trim()))throw Error("Every step needs a name before it can be saved.");
   if(!admin()||typeof options.onSave!=="function")throw Error("Sign in to save your instructions.");
   const version=changeVersion;
   feedback.textContent="Saving…";
   savePromise=(async()=>{
    await options.onSave();
    if(changeVersion===version){dirty=false;window.BSTransient?.show(feedback,"Saved.")}
    else{dirty=true;feedback.textContent="More edits to save."}
   })();
   try{await savePromise}
   catch(error){dirty=true;feedback.textContent=error.message||"Unable to save instructions.";throw error}
   finally{savePromise=null}
   if(dirty)scheduleSave();
  }
  function scheduleSave(){
   clearTimeout(saveTimer);
   saveTimer=setTimeout(()=>{void savePending().catch(()=>{})},1100);
  }
  const savedSteps=()=>steps.filter(step=>step!==draft);
  const changed=()=>{if(draft?.id===expanded)return;dirty=true;changeVersion++;options.onChange?.();
   // The active Edit session is committed by Save. Do not autosave its draft
   // into the project before the user has a chance to press Cancel.
   if(!editing.has(expanded))scheduleSave();
  };
  const saveHint=()=>{feedback.textContent="Unsaved step changes."};
  // Capture navigation before the page replaces its editor or changes the workspace endpoint.
  // Replay the original click only after the save has succeeded.
  document.addEventListener("click",async event=>{
   if(allowReplay||!dirty||!article.isConnected||article.closest(".hide")||article.offsetParent===null)return;
   const target=event.target.closest("button,a,[role=button]");
   if(!target||article.contains(target)||target.closest(".modalback,dialog,[role=dialog]")||target.matches(".workspace-save,.part-workspace-save"))return;
   event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
   try{
    await savePending();
    allowReplay=true;try{target.click()}finally{allowReplay=false}
   }catch(error){feedback.textContent=error.message||"Save failed; navigation cancelled."}
  },true);
  async function persistContainer(step,{draftSave=false}={}){
   if(!step.title.trim())throw Error("Enter a Work Instruction name.");
   if(saving)return;
   saving=true;
   if(draftSave)draft=null;
   try{
    if(savePromise)await savePromise;
    if(typeof options.onSave!=="function")throw Error("Saving is unavailable.");
    await options.onSave();
    clearTimeout(saveTimer);dirty=false;
    editSnapshots.delete(step.id);editing.delete(step.id);
    window.BSTransient?.show(feedback,"Work Instruction saved.");
    render();
   }catch(error){
    if(draftSave)draft=step;
    feedback.textContent=error.message||"Work Instruction could not be saved.";
    render();
   }finally{saving=false}
  }
  async function deleteContainer(step){
   if(saving)return;
   if(!await window.BSDialogs.danger(
    'Delete Work Instruction "'+step.title+'"? All entries belonging to it will no longer be accessible. This cannot be undone.',
    {title:"Delete Work Instruction?",confirmLabel:"Delete Work Instruction"}))return;
   const index=steps.indexOf(step);
   if(index<0)return;
   steps.splice(index,1);
   if(step===draft){draft=null;expanded=steps.find(s=>!s.archivedAt)?.id||null;render();return}
   try{
    if(savePromise)await savePromise;
    await options.onSave();
    dirty=false;editing.delete(step.id);editSnapshots.delete(step.id);
    expanded=steps.find(s=>!s.archivedAt)?.id||null;
    window.BSTransient?.show(feedback,"Work Instruction deleted.");
    render();
   }catch(error){
    steps.splice(index,0,step);
    feedback.textContent=error.message||"Could not delete Work Instruction.";
    render();
   }
  }
  async function archiveContainer(step){
   if(saving||step===draft)return;
   const dialog=el("dialog","recipe-step-archive-dialog investigation-archive-dialog");
   dialog.append(el("h3","","Archive Work Instruction"));
   dialog.append(el("p","muted","Move this Work Instruction to Archived steps. It can be restored."));
   const label=el("label","recipe-archive-note-label","Why? (optional)");
   const note=el("textarea","field recipe-archive-note");
   note.rows=3;note.maxLength=2500;label.append(note);dialog.append(label);
   const buttons=el("div","recipe-archive-dialog-actions");
   const confirm=button("Archive",async()=>{
    const previous=step.archivedAt,previousNote=step.archiveNote;
    step.archivedAt=new Date().toISOString();step.archiveNote=note.value.trim();
    try{
     await options.onSave();
     archivedStepsExpanded=true;editing.delete(step.id);
     expanded=steps.find(s=>!s.archivedAt)?.id||step.id;
     dialog.close();render();
    }catch(error){
     step.archivedAt=previous;step.archiveNote=previousNote;
     feedback.textContent=error.message||"Could not archive Work Instruction.";
    }
   },"btn primary");
   buttons.append(confirm,button("Cancel",()=>dialog.close()));
   dialog.append(buttons);document.body.append(dialog);
   dialog.addEventListener("close",()=>dialog.remove(),{once:true});dialog.showModal();
  }
  function render(){
   content.replaceChildren();
   const total=savedSteps().filter(step=>!step.archivedAt).length;
   count.textContent="("+total+(total===1?" record)":" records)");
   if(steps.length&&!steps.some(step=>step.id===expanded))
    expanded=steps.find(step=>!step.archivedAt)?.id||steps[0].id;
   const browser=el("div","recipe-step-browser");
   const stepList=el("nav","recipe-step-list");
   stepList.setAttribute("aria-label","Work Instructions");
   const divider=el("div","recipe-step-resizer");
   divider.setAttribute("role","separator");
   divider.setAttribute("aria-orientation","vertical");
   divider.setAttribute("aria-label","Resize Work Instruction list");
   divider.tabIndex=0;
   const detailPane=el("div","recipe-step-detail");
   const widthKey="bs-recipe-list-width-"+(options.project||"default");
   let savedWidth=31;try{savedWidth=Number(localStorage.getItem(widthKey))||31}catch{}
   const setWidth=value=>{
    // Keep enough room for the active instruction and its entry controls.
    // Previously saved 70% splits could squeeze the right pane into overlapping UI.
    const width=browser.getBoundingClientRect().width;
    const maxBySpace=width>0?100*(width-320)/width:55;
    const safe=Math.max(16,Math.min(55,maxBySpace,Number(value)||31));
    browser.style.setProperty("--recipe-nav-width",safe+"%");
    return safe;
   };
   setWidth(savedWidth);
   divider.onkeydown=event=>{
    if(!["ArrowLeft","ArrowRight"].includes(event.key))return;
    event.preventDefault();
    const current=Number.parseFloat(browser.style.getPropertyValue("--recipe-nav-width"))||31;
    const val=setWidth(current+(event.key==="ArrowLeft"?-2:2));
    try{localStorage.setItem(widthKey,String(val))}catch{}
   };
   divider.onpointerdown=event=>{
    if(window.matchMedia("(max-width:760px)").matches)return;
    divider.setPointerCapture(event.pointerId);
    browser.classList.add("is-resizing-recipe");
   };
   divider.onpointermove=event=>{
    if(!divider.hasPointerCapture(event.pointerId))return;
    const rect=browser.getBoundingClientRect();
    setWidth((event.clientX-rect.left)/rect.width*100);
   };
   const endResize=event=>{
    if(!divider.hasPointerCapture(event.pointerId))return;
    divider.releasePointerCapture(event.pointerId);
    browser.classList.remove("is-resizing-recipe");
    try{localStorage.setItem(widthKey,browser.style.getPropertyValue("--recipe-nav-width").replace("%",""))}catch{}
   };
   divider.onpointerup=endResize;divider.onpointercancel=endResize;
   browser.append(stepList,divider,detailPane);
   if(steps.length)content.append(browser);
   const archive=el("details","recipe-archived-steps");
   archive.open=archivedStepsExpanded;
   archive.addEventListener("toggle",()=>{archivedStepsExpanded=archive.open});
   const archived=steps.filter(step=>step.archivedAt);
   archive.append(el("summary","recipe-archive-steps-heading","Archived steps ("+archived.length+")"));
   const archiveList=el("div","recipe-archived-step-list");archive.append(archiveList);
   for(let i=0;i<steps.length;i++){
    const step=steps[i],isDraft=step===draft,isCurrent=step.id===expanded,isArchived=!!step.archivedAt;
    const row=el("div","recipe-step-nav-row"+(isCurrent?" is-active":""));
    const select=button(step.title||"New Work Instruction",async()=>{
     if(saving||expanded===step.id)return;
     if(draft&&draft!==step){feedback.textContent="Save or cancel the new Work Instruction first.";return}
     try{await savePending()}catch(error){feedback.textContent=error.message;return}
     expanded=step.id;editing.clear();
     options.onStepSelected?.(step.id);
     render();options.onStepChange?.(step.id);
    },"recipe-step-nav-item"+(isCurrent?" is-active":""));
    select.setAttribute("aria-current",isCurrent?"step":"false");
    row.append(select);
    (isArchived?archiveList:stepList).append(row);
    if(admin()&&!isDraft&&!isArchived){
     select.draggable=true;select.title="Drag to reorder Work Instructions";
     select.addEventListener("dragstart",event=>{
      if(saving){event.preventDefault();return}
      event.dataTransfer.setData("application/x-bs-recipe-step",step.id);
      event.dataTransfer.effectAllowed="move";
     });
     select.addEventListener("dragover",event=>{
      if(!event.dataTransfer.types.includes("application/x-bs-recipe-step"))return;
      event.preventDefault();event.dataTransfer.dropEffect="move";
     });
     select.addEventListener("drop",event=>{
      if(!event.dataTransfer.types.includes("application/x-bs-recipe-step"))return;
      event.preventDefault();event.stopPropagation();
      const from=steps.findIndex(s=>s.id===event.dataTransfer.getData("application/x-bs-recipe-step"));
      const to=steps.indexOf(step);
      if(from<0||to<0||from===to)return;
      const copy=[...steps],item=copy.splice(from,1)[0];
      const target=copy.indexOf(step);
      copy.splice(target+(event.clientY>select.getBoundingClientRect().top+select.offsetHeight/2?1:0),0,item);
      steps=copy;changed();render();
     });
    }
    if(!isCurrent)continue;
    const inEdit=isDraft||editing.has(step.id);
    const header=el("div","recipe-container-heading");
    if(inEdit){
     const title=window.BSEntryEditor.titleInput(step.title,value=>{
      step.title=value;select.textContent=value||"New Work Instruction";
      changed();saveHint();
     },{placeholder:"Work Instruction name"});
     title.classList.add("recipe-step-name");title.maxLength=180;
     header.append(title);
    }else header.append(el("strong","recipe-entries-heading",step.title));
    // Only the selected step owns these controls. In normal view Edit is
    // the sole action; Save/Cancel/Archive/Delete appear only while editing.
    if(admin()){
     const navActions=el("div","recipe-step-nav-actions");
     if(inEdit){
      const saveButton=button("Save",async()=>{await persistContainer(step,{draftSave:isDraft})},"btn primary");
      const cancel=button("Cancel",()=>{
       if(isDraft){steps.splice(steps.indexOf(step),1);draft=null;expanded=steps.find(s=>!s.archivedAt)?.id||null}
       else{const snap=editSnapshots.get(step.id);if(snap)Object.assign(step,snap)}
       editing.delete(step.id);editSnapshots.delete(step.id);dirty=false;
       render();
      },"btn");
      navActions.append(saveButton,cancel);
      if(!isDraft&&!isArchived)navActions.append(button("Archive",()=>archiveContainer(step),"btn"));
      navActions.append(button("Delete",()=>deleteContainer(step),"btn recipe-delete-step"));
     }else if(isArchived){
      navActions.append(button("Restore",async()=>{
       const at=step.archivedAt,note=step.archiveNote;
       step.archivedAt="";step.archiveNote="";
       try{await options.onSave();render()}catch(error){step.archivedAt=at;step.archiveNote=note;feedback.textContent=error.message}
      },"btn"));
     }else navActions.append(button("Edit",()=>{
      editSnapshots.set(step.id,normalize(step));editing.add(step.id);render();
      detailPane.querySelector(".recipe-step-name")?.focus();
     },"btn recipe-step-edit-toggle"));
     row.classList.add("has-nav-actions");
     if(inEdit)row.classList.add("is-editing");
     row.append(navActions);
    }
    detailPane.append(header);
    if(!isDraft&&typeof options.renderInvestigations==="function"){
     const area=el("div","recipe-step-investigations");
     detailPane.append(area);
     options.renderInvestigations(step,area,editing.has(step.id),null,order=>{
      step.tileOrder=order;changed();saveHint();
     });
     // The main instruction heading controls all active entry disclosures.
     // Keep each entry's own chevron intact for individual expansion.
     const entryCards=()=>[...area.querySelectorAll(".investigation-active-content details.investigation-card")];
     if(entryCards().length){
      const expandAll=el("button","recipe-expand-all");
      expandAll.type="button";
      expandAll.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 7 6 6 6-6"/><path d="m6 13 6 6 6-6"/></svg>';
      const updateExpandAll=()=>{
       const cards=entryCards(),allOpen=cards.length>0&&cards.every(card=>card.open);
       expandAll.classList.toggle("is-expanded",allOpen);
       expandAll.setAttribute("aria-expanded",String(allOpen));
       expandAll.setAttribute("aria-label",allOpen?"Collapse all entries":"Expand all entries");
       expandAll.title=allOpen?"Collapse all entries":"Expand all entries";
      };
      expandAll.onclick=()=>{
       // Query live cards rather than stale elements: entries can be edited,
       // reordered, or replaced without recreating the Work Instruction.
       const cards=entryCards(),expand=cards.some(card=>!card.open);
       for(const card of cards)card.open=expand;
       updateExpandAll();
      };
      area.addEventListener("toggle",event=>{
       if(event.target.matches("details.investigation-card"))updateExpandAll();
      },true);
      header.prepend(expandAll);
      updateExpandAll();
     }
    }else if(isDraft)detailPane.append(el("p","muted","Save this Work Instruction to start adding entries."));
   }
   if(archived.length)stepList.append(archive);
   add.hidden=!admin();
  }
  const add=button("+ Add Work Instruction",()=>{
   if(!admin()||loading||saving||pendingUploads)return;
   if(!draft){
    draft={id:newId(),title:"",archivedAt:"",archiveNote:"",tileOrder:[]};
    steps.push(draft);
   }
   expanded=draft.id;editSnapshots.clear();editing.clear();editing.add(draft.id);render();
   content.querySelector(".recipe-step-name")?.focus();
  },"btn recipe-add-step bs-section-add-entry");
  headingActions.append(add);
  function setLoading(value){
   loading=value;
   add.disabled=value;
   panel.inert=value;
   panel.setAttribute("aria-busy",String(value));
  }
  function setData(data,nextScope){
   const keepDraft=scope===nextScope&&draft;
   const resumeDraft=keepDraft&&expanded===draft.id;
   scope=nextScope;
   if(!keepDraft)draft=null;
   steps=Array.isArray(data?.recipe)?data.recipe.map(normalize):[];
   if(draft)steps.push(draft);
   clearTimeout(saveTimer);dirty=false;expanded=steps.find(step=>!step.archivedAt)?.id||null;
   archivedStepsExpanded=false;
   const resumeKey="bs-resume-step:"+location.hash;
   const desired=sessionStorage.getItem(resumeKey);
   if(desired&&steps.some(step=>step.id===desired&&!step.archivedAt)){expanded=desired;sessionStorage.removeItem(resumeKey)}
   if(expanded)options.onStepSelected?.(expanded);
   editSnapshots.clear();editing.clear();feedback.textContent="";
   if(resumeDraft){expanded=draft.id;editing.add(draft.id)}
   setLoading(false);
   render();
  }
  setLoading(true);
  render();
  return {setData,setLoading,getData:()=>savedSteps().map(normalize),getSelected:()=>steps.find(step=>step.id===expanded)||null,isDirty:()=>dirty,hasPendingUploads:()=>pendingUploads>0,savePending,markSaved:()=>{if(!savePromise){dirty=false;window.BSTransient?.show(feedback,"Saved.")}},render};
 }
 window.BSRecipes={mount};
})();
