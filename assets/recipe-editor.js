/* Discrete, progressively disclosed recipe steps. Existing API/schema unchanged. */
(function(){
 "use strict";
 const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node};
 const button=(label,fn,cls="btn")=>{const node=el("button",cls,label);node.type="button";node.onclick=fn;return node};
 // Keep existing text and photo arrays, with stable note IDs for attachments.
 const newId=()=>crypto?.randomUUID?.()||"note_"+Date.now()+"_"+Math.random().toString(36).slice(2);
 const normalize=x=>{
  const notes=Array.isArray(x.notes)?x.notes.filter(n=>typeof n==="string").slice(0,40):[];
  const photos=Array.isArray(x.photos)?x.photos.filter(p=>typeof p==="string").slice(0,30):[];
  const used=new Set();
  const noteIds=notes.map((_,i)=>{
   const candidate=x.noteIds?.[i];
   const id=typeof candidate==="string"&&/^[a-zA-Z0-9_-]{1,80}$/.test(candidate)&&!used.has(candidate)?candidate:newId();
   used.add(id);return id;
  });
  const photoNames=x.photoNames&&typeof x.photoNames==="object"&&!Array.isArray(x.photoNames)?Object.fromEntries(Object.entries(x.photoNames).filter(([id,name])=>typeof name==="string"&&photos.includes(id))):{};
  const previous=x.photoAfterNote&&typeof x.photoAfterNote==="object"&&!Array.isArray(x.photoAfterNote)?x.photoAfterNote:{};
  const stored=x.photoNoteIds&&typeof x.photoNoteIds==="object"&&!Array.isArray(x.photoNoteIds)?x.photoNoteIds:{};
  const photoNoteIds={};
  for(const id of photos){
   if(typeof stored[id]==="string"&&used.has(stored[id]))photoNoteIds[id]=stored[id];
   else if(Number.isInteger(previous[id])&&noteIds[previous[id]])photoNoteIds[id]=noteIds[previous[id]];
  }
  const photoAfterNote={};
  for(const [id,noteId] of Object.entries(photoNoteIds))photoAfterNote[id]=noteIds.indexOf(noteId);
  return {id:x.id,title:x.title||"",standard:x.standard||"",detail:x.detail||"",kind:x.kind||"action",notes,noteIds,photos,photoNames,photoNoteIds,photoAfterNote};
 };
 const kinds=[["action","Action"],["inspection","Inspection"],["measurement","Measurement"],["explanation","Explanation"]];

 // Viewer is shared by author and reader; closing it never changes step data.
 function openPhoto(id,name){
  const overlay=el("div","recipe-photo-viewer");
  overlay.setAttribute("role","dialog");overlay.setAttribute("aria-modal","true");overlay.setAttribute("aria-label",name||"Step photo");
  const close=button("×",()=>dismiss(),"recipe-photo-viewer-close");
  close.setAttribute("aria-label","Close photo");close.title="Close (Esc)";
  const picture=el("img","recipe-photo-viewer-image");
  picture.src=attachmentUrl(id);picture.alt=name||"Step photo";
  const caption=el("div","recipe-photo-viewer-caption",name||"");
  const onKey=event=>{if(event.key==="Escape")dismiss()};
  const dismiss=()=>{document.removeEventListener("keydown",onKey);overlay.remove()};
  overlay.addEventListener("click",event=>{if(event.target===overlay)dismiss()});
  overlay.append(close,picture,caption);
  document.body.append(overlay);document.addEventListener("keydown",onKey);close.focus();
 }
 const isRecipeFile=id=>id.startsWith("recipe-files/");
 const attachmentExtension=id=>id.split(".").pop().toLowerCase();
 const isImageAttachment=id=>!isRecipeFile(id)||["jpg","jpeg","png","webp","gif","heic","heif"].includes(attachmentExtension(id));
 const attachmentUrl=id=>isRecipeFile(id)?"/api/recipe-files?id="+encodeURIComponent(id):"/api/photo?id="+encodeURIComponent(id);
 const makeAttachment=(id,name)=>{
  if(isImageAttachment(id))return makePhoto(id,name);
  const link=el("a","recipe-document-link");
  link.href=attachmentUrl(id);link.target="_blank";link.rel="noopener noreferrer";
  // Preserve the original filename from the server; PDFs open in the browser.
  const icon=el("span","recipe-document-icon",attachmentExtension(id).toUpperCase());
  const action=el("span","recipe-document-open",attachmentExtension(id)==="pdf"?"Open PDF":"Download document");
  link.append(icon,action);
  return link;
 };
 const makePhoto=(id,name)=>{
  const picture=el("img","recipe-step-photo-image");
  picture.src=attachmentUrl(id);
  picture.alt=name||"Step photo";picture.loading="lazy";
  picture.title="Double-click for full-screen view";
  picture.tabIndex=0;picture.setAttribute("role","button");
  picture.addEventListener("dblclick",()=>openPhoto(id,name));
  picture.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();openPhoto(id,name)}});
  return picture;
 };
 function mount(article,options={}){
  if(!article)return null;
  const panel=el("section","recipe-editor recipe-compact"),content=el("div","recipe-content"),feedback=el("p","recipe-feedback muted");
  panel.append(content,feedback);
  const heading=article.querySelector("h2");
  if(heading){
   const headingRow=el("div","recipe-heading-row");
   const tip=el("p","recipe-right-click-tip");
   tip.append(el("span","recipe-right-click-icon","ⓘ"),document.createTextNode(" Right-click any word or highlighted text in a step to search the knowledge base or request an explanation."));
   heading.before(headingRow);headingRow.append(heading,tip);headingRow.after(panel);
  }else article.prepend(panel);
  const admin=()=>!!options.admin?.();
  let steps=[],expanded=null,dirty=false,level="standard",pendingUploads=0,saving=false;
  const editing=new Set();
  window.addEventListener("beforeunload",event=>{if(!dirty&&!pendingUploads&&!saving)return;event.preventDefault();event.returnValue="";});
  try{const saved=localStorage.getItem("bs-recipe-detail");if(["brief","standard","detailed"].includes(saved))level=saved}catch{}
  let changeVersion=0,saveTimer=null,savePromise=null,allowReplay=false;
  async function savePending(){
   clearTimeout(saveTimer);
   if(savePromise){await savePromise;if(!dirty)return; }
   if(!dirty)return;
   if(pendingUploads)throw Error("Finish uploading photos or documents before leaving this step.");
   if(steps.some(step=>!step.title.trim()))throw Error("Every step needs a name before it can be saved.");
   if(!admin()||typeof options.onSave!=="function")throw Error("Sign in to save your instructions.");
   const version=changeVersion;
   feedback.textContent="Saving…";
   savePromise=(async()=>{
    await options.onSave();
    if(changeVersion===version){dirty=false;feedback.textContent="Saved."}
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
  const changed=()=>{dirty=true;changeVersion++;options.onChange?.();scheduleSave()};
  const saveHint=()=>{feedback.textContent="Unsaved step changes."};
  // Capture navigation before the page replaces its editor or changes the workspace endpoint.
  // Replay the original click only after the save has succeeded.
  document.addEventListener("click",async event=>{
   if(allowReplay||!dirty||!article.isConnected||article.closest(".hide")||article.offsetParent===null)return;
   const target=event.target.closest("button,a,[role=button]");
   if(!target||article.contains(target)||target.closest(".modalback"))return;
   event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
   try{
    await savePending();
    allowReplay=true;try{target.click()}finally{allowReplay=false}
   }catch(error){feedback.textContent=error.message||"Save failed; navigation cancelled."}
  },true);
  const editField=(value,placeholder,onValue,rows=0)=>{
   const field=el(rows?"textarea":"input","field recipe-input");
   if(rows)field.rows=rows;else field.type="text";
   field.value=value;field.placeholder=placeholder;
   // On the first click or keyboard focus, select the old value so typing
   // replaces it. Later clicks within the focused field allow caret edits.
   let firstFocus=false;
   field.addEventListener("focus",()=>{firstFocus=true;field.select()});
   field.addEventListener("click",()=>{if(firstFocus){field.select();firstFocus=false}});
   field.addEventListener("blur",()=>{firstFocus=false});
   field.oninput=()=>{onValue(field.value);changed();saveHint()};
   return field;
  };
  const selectedText=area=>{
   const selection=window.getSelection?.();
   if(!selection||selection.isCollapsed)return "";
   const text=String(selection).trim();
   if(!text||text.length>220||!area.contains(selection.getRangeAt(0).commonAncestorContainer))return "";
   return text;
  };

  // Contextual knowledge lookup from work-instruction prose, including step names.
  let knowledgeMenu=null;
  const closeKnowledgeMenu=()=>{
   if(knowledgeMenu){knowledgeMenu.remove();knowledgeMenu=null}
  };
  const termAtPoint=event=>{
   const selection=window.getSelection?.();
   if(selection&&!selection.isCollapsed){
    const text=String(selection).trim();
    if(text.length<=220&&event.target.closest(".recipe-one-step")?.contains(selection.anchorNode)&&
       event.target.closest(".recipe-one-step")?.contains(selection.focusNode))return text;
   }
   const range=document.caretRangeFromPoint?.(event.clientX,event.clientY)||
    document.caretPositionFromPoint?.(event.clientX,event.clientY);
   const node=range?.startContainer||range?.offsetNode;
   const offset=range?.startOffset??range?.offset;
   if(!node||node.nodeType!==Node.TEXT_NODE||!event.target.contains(node))return "";
   const value=node.textContent||"";
   const isWord=ch=>/[\p{L}\p{N}×._-]/u.test(ch);
   let start=Math.min(offset,value.length),end=start;
   if(start>0&&!isWord(value[start]||"")&&isWord(value[start-1]))start--;
   if(!isWord(value[start]||""))return "";
   end=start;
   while(start>0&&isWord(value[start-1]))start--;
   while(end<value.length&&isWord(value[end]))end++;
   return value.slice(start,end).trim().slice(0,220);
  };
  const searchKnowledge=term=>{
   const q=term.toLowerCase().trim().replace(/\s+/g," ");
   if(!q)return [];
   const words=q.split(/\s+/).filter(w=>w.length>2);
   const workshop=(window.BSResources?.catalog?.parts||[])
    .concat(window.BSResources?.catalog?.tools||[])
    .filter(item=>item.id?.startsWith("workshop:"))
    .map(item=>{
     const title=item.name.toLowerCase(),detail=(item.subtitle||"").toLowerCase();
     const score=title===q?120:title.startsWith(q+" ")||title.includes(" "+q+" ")?95:
      title.includes(q)?75:words.length&&words.every(w=>title.includes(w))?60:detail.includes(q)?25:0;
     return {id:item.id,title:item.name,type:"Workshop",score};
    }).filter(item=>item.score>0);
   const articles=(window.BSKnowledgeArticles?.search(term)||[])
    .map(item=>({id:item.id,title:item.title,type:"Knowledge article",score:item.score}));
   return [...workshop,...articles].sort((a,b)=>b.score-a.score).slice(0,8);
  };
  const openKnowledgeResult=result=>{
   closeKnowledgeMenu();
   if(result.type==="Workshop"){
    location.hash="commonparts";
    // Wait for navigation to mount the Workshop feature tree before focusing.
    setTimeout(()=>window.BSResources?.focusWorkshopItem(result.id),50);
   }else window.BSKnowledgeArticles?.open(result.id);
  };
  const showKnowledgeMenu=(event,term,step)=>{
   closeKnowledgeMenu();
   const results=searchKnowledge(term);
   const menu=el("div","recipe-knowledge-context-menu");
   menu.setAttribute("role","menu");menu.setAttribute("aria-label","Knowledge base matches");
   menu.append(el("div","recipe-knowledge-context-heading",'Search knowledge base: "'+term+'"'));
   for(const result of results){
    const item=button(result.title,()=>openKnowledgeResult(result),"recipe-knowledge-context-result");
    item.setAttribute("role","menuitem");
    item.append(el("small","",result.type));menu.append(item);
   }
   if(!results.length)menu.append(el("p","recipe-knowledge-empty","No matching articles yet."));
   const explain=button("Please explain this",()=>{
    closeKnowledgeMenu();
    window.BSExplainText?.(term,{stepId:step.id,stepTitle:step.title});
   },"recipe-knowledge-context-explain");
   menu.append(explain);document.body.append(menu);knowledgeMenu=menu;
   const x=Math.max(8,Math.min(event.clientX,window.innerWidth-menu.offsetWidth-8));
   const y=Math.max(8,Math.min(event.clientY,window.innerHeight-menu.offsetHeight-8));
   menu.style.left=x+"px";menu.style.top=y+"px";
  };
  content.addEventListener("contextmenu",event=>{
   if(event.target.closest("input,textarea,select,button,img"))return;
   const card=event.target.closest(".recipe-one-step");
   if(!card)return;
   const step=steps.find(item=>item.id===card.dataset.stepId);
   if(!step)return;
   const term=termAtPoint(event);
   if(!term)return;
   event.preventDefault();showKnowledgeMenu(event,term,step);
  });
  document.addEventListener("click",event=>{if(knowledgeMenu&&!knowledgeMenu.contains(event.target))closeKnowledgeMenu()});
  document.addEventListener("keydown",event=>{if(event.key==="Escape")closeKnowledgeMenu()});
  document.addEventListener("scroll",closeKnowledgeMenu,true);
  const move=(index,offset)=>{
   const destination=index+offset;if(destination<0||destination>=steps.length)return;
   [steps[index],steps[destination]]=[steps[destination],steps[index]];
   expanded=steps[destination].id;changed();saveHint();render();
  };
  function render(){
   content.replaceChildren();
   // One step at a time: the list is navigation, the right pane is the selected step.
   if(steps.length&&!steps.some(step=>step.id===expanded))expanded=steps[0].id;
   const browser=el("div","recipe-step-browser");
   const stepList=el("nav","recipe-step-list");
   stepList.setAttribute("aria-label","Work instruction steps");
   const detailPane=el("div","recipe-step-detail");
   const divider=el("div","recipe-step-resizer");
   divider.setAttribute("role","separator");divider.setAttribute("aria-orientation","vertical");
   divider.setAttribute("aria-label","Resize work instruction list width");
   divider.tabIndex=0;divider.title="Drag left or right to resize the step list. Use arrow keys to adjust.";
   const widthKey="bs-recipe-list-width-"+(options.project||"default");
   let savedWidth=31;
   try{savedWidth=Number(localStorage.getItem(widthKey))||31}catch{}
   const setWidth=value=>{
    const safe=Math.max(16,Math.min(70,Number(value)||31));
    browser.style.setProperty("--recipe-nav-width",safe+"%");
    divider.setAttribute("aria-valuenow",String(Math.round(safe)));
    return safe;
   };
   setWidth(savedWidth);
   divider.setAttribute("aria-valuemin","16");divider.setAttribute("aria-valuemax","70");
   const persist=value=>{try{localStorage.setItem(widthKey,String(value))}catch{}};
   divider.onkeydown=event=>{
    if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
    event.preventDefault();
    const current=Number.parseFloat(browser.style.getPropertyValue("--recipe-nav-width"))||31;
    const next=setWidth(event.key==="Home"?16:event.key==="End"?70:current+(event.key==="ArrowLeft"?-2:2));
    persist(next);
   };
   divider.onpointerdown=event=>{
    if(window.matchMedia("(max-width:760px)").matches)return;
    event.preventDefault();
    divider.setPointerCapture(event.pointerId);browser.classList.add("is-resizing-recipe");
   };
   divider.onpointermove=event=>{
    if(!divider.hasPointerCapture(event.pointerId))return;
    const rect=browser.getBoundingClientRect();
    setWidth((event.clientX-rect.left)/rect.width*100);
   };
   const release=event=>{
    if(!divider.hasPointerCapture(event.pointerId))return;
    divider.releasePointerCapture(event.pointerId);
    browser.classList.remove("is-resizing-recipe");
    persist(Number.parseFloat(browser.style.getPropertyValue("--recipe-nav-width"))||31);
   };
   divider.onpointerup=release;divider.onpointercancel=release;
   browser.append(stepList,divider,detailPane);
   if(steps.length)content.append(browser);
   const hasDetail=steps.some(s=>s.standard?.trim()||s.detail?.trim());
   if(hasDetail){
    const preferences=el("div","recipe-detail-controls");
    preferences.append(el("span","muted","Show"));
    for(const [key,label] of [["brief","Brief"],["standard","Standard"],["detailed","Detailed"]]){
     const choice=button(label,()=>{level=key;try{localStorage.setItem("bs-recipe-detail",key)}catch{}render()},"btn recipe-detail-button"+(key===level?" active":""));
     choice.setAttribute("aria-pressed",String(key===level));preferences.append(choice);
    }
    detailPane.append(preferences);
   }
   for(let i=0;i<steps.length;i++){
    const step=steps[i],isCurrent=expanded===step.id;
    const navButton=button((i+1)+". "+(step.title||"Untitled step"),async()=>{
     if(expanded===step.id)return;
     try{await savePending()}catch(error){feedback.textContent=error.message||"Save failed; still on this step.";return}
     expanded=step.id;editing.clear();closeKnowledgeMenu();render();options.onStepChange?.(step.id);
    },"recipe-step-nav-item"+(isCurrent?" is-active":""));
    navButton.setAttribute("aria-current",isCurrent?"step":"false");
    navButton.setAttribute("aria-label","Step "+(i+1)+": "+(step.title||"Untitled step"));
    stepList.append(navButton);
    if(!isCurrent)continue;
    const card=el("details","recipe-one-step");
    card.dataset.stepId=step.id;card.open=true;
    const summary=el("summary","recipe-one-step-summary");
    const name=el("span","recipe-one-step-title",(i+1)+". "+(step.title||"Untitled step"));
    summary.append(name);
    if(step.kind!=="action")summary.append(el("small","recipe-kind-caption",kinds.find(k=>k[0]===step.kind)?.[1]||step.kind));
    if(admin()){
     const edit=button(editing.has(step.id)?"Save":"Edit",async event=>{
      event.preventDefault();event.stopPropagation();
      if(!editing.has(step.id)){
       editing.add(step.id);expanded=step.id;render();
       return;
      }
      if(saving)return;
      if(pendingUploads){feedback.textContent="Wait for photo uploads to finish before saving.";return}
      if(!step.title.trim()){
       feedback.textContent="Enter a step name before saving.";
       card.querySelector(".recipe-one-field input")?.focus();
       return;
      }
      const bottomSave=card.querySelector(".recipe-save-step-bottom");
      saving=true;edit.disabled=true;edit.textContent="Saving…";
      if(bottomSave){bottomSave.disabled=true;bottomSave.textContent="Saving…"}
      try{
       if(typeof options.onSave!=="function")throw Error("Save is unavailable.");
       await options.onSave();
       dirty=false;feedback.textContent="Step saved.";
       editing.delete(step.id);expanded=step.id;render();
      }catch(error){
       feedback.textContent=error.message||"Could not save step.";
       edit.disabled=false;edit.textContent="Save";
       if(bottomSave){bottomSave.disabled=false;bottomSave.textContent="Save"}
      }finally{saving=false}
     },"btn recipe-step-edit-toggle");
     edit.addEventListener("click",event=>{event.preventDefault();event.stopPropagation()});
     summary.append(edit);
    }
    // Step selection happens in the navigation list; keep the detail panel open.
    summary.addEventListener("click",event=>{if(!event.target.closest("button"))event.preventDefault()});
    card.append(summary);
    const body=el("div","recipe-one-step-body");
    if(admin()&&editing.has(step.id)){
     const title=el("label","recipe-one-field","Step");
     const nameInput=editField(step.title,"Describe the action",v=>{step.title=v;name.textContent=(i+1)+". "+(v||"Untitled step")});
     nameInput.maxLength=180;title.append(nameInput);body.append(title);

     // Photos remain in the existing step.photos list. photoAfterNote keeps
     // optional placement beside a particular note without changing photo IDs.
     const additions=el("div","recipe-step-additions");
     const noteList=el("div","recipe-step-notes");
     const photoList=el("div","recipe-step-photos");
     const input=el("input");
     input.type="file";input.multiple=true;
     input.accept=".jpg,.jpeg,.png,.webp,.gif,.heic,.heif,.pdf,.dwg,.dxf,.sldprt,.sldasm,.step,.stp,.stl,.igs,.iges,.x_t,.x_b,.obj,.3mf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip";
     input.hidden=true;
     let uploadTargetNote=null;
     const selectAttachment=noteIndex=>{
      uploadTargetNote=noteIndex;input.click();
     };
     const addPhoto=button("+ Add photo / document",()=>selectAttachment(null),"btn recipe-small-action");
     function editablePhoto(id){
      const item=el("div","recipe-step-photo");
      const photoName=step.photoNames[id]||"";
      const picture=makeAttachment(id,photoName);
      const nameInput=editField(photoName,"Attachment name",value=>{step.photoNames[id]=value;if(picture.tagName==="IMG")picture.alt=value||"Step photo"});
      nameInput.classList.add("recipe-step-photo-name");
      nameInput.setAttribute("aria-label","Attachment name");nameInput.maxLength=120;
      const frame=el("div","recipe-photo-frame");
      frame.append(picture,nameInput);
      const remove=button("Remove attachment",()=>{
       step.photos=step.photos.filter(photo=>photo!==id);
       delete step.photoNames[id];delete step.photoAfterNote[id];delete step.photoNoteIds[id];
       changed();saveHint();showNotes();showPhotos();
      },"btn recipe-small-action");
      item.append(frame,remove);
      return item;
     }
     function showNotes(){
      noteList.replaceChildren();
      step.notes.forEach((value,index)=>{
       const line=el("div","recipe-step-note");
       line.dataset.noteIndex=String(index);
       const field=editField(value,"Write a note",v=>step.notes[index]=v,3);
       field.maxLength=4000;
       const noteAttachments=el("div","recipe-note-attachments");
       for(const id of step.photos){
        if(step.photoNoteIds[id]===step.noteIds[index])noteAttachments.append(editablePhoto(id));
       }
       const addAfterNote=button("+ Add photo / document",()=>selectAttachment(index),"btn recipe-small-action recipe-add-note-photo");
       addAfterNote.setAttribute("aria-label","Add photo after note "+(index+1));
       const removeNote=button("Remove note",()=>{
        const deletedId=step.noteIds[index];
        step.notes.splice(index,1);step.noteIds.splice(index,1);
        // Unlink attachments from deleted notes, but never delete their files.
        for(const [id,noteId] of Object.entries(step.photoNoteIds)){
         if(noteId===deletedId){delete step.photoNoteIds[id];delete step.photoAfterNote[id]}
        }
        for(const [id,noteId] of Object.entries(step.photoNoteIds))step.photoAfterNote[id]=step.noteIds.indexOf(noteId);
        changed();saveHint();showNotes();showPhotos();
       },"btn recipe-small-action");
       line.append(field,noteAttachments,addAfterNote,removeNote);
       noteList.append(line);
      });
     }
     function showPhotos(){
      photoList.replaceChildren();
      for(const id of step.photos){
       if(step.photoNoteIds[id]===undefined)photoList.append(editablePhoto(id));
      }
     }
     const upload=async(file,noteIndex=null)=>{
      if(!file)return;
      const targetNoteId=Number.isInteger(noteIndex)?step.noteIds[noteIndex]:null;
      if(!options.project){feedback.textContent="Cannot identify this project for attachment upload.";return}
      if(step.photos.length>=30){feedback.textContent="A step supports up to 30 attachments.";return}
      if(file.size>20*1024*1024){feedback.textContent="Maximum attachment size is 20 MB.";return}
      pendingUploads++;addPhoto.disabled=true;feedback.textContent="Uploading attachment…";
      try{
       const res=await fetch("/api/recipe-files?project="+encodeURIComponent(options.project),{method:"POST",credentials:"same-origin",headers:{"content-type":"application/octet-stream","x-file-name":encodeURIComponent(file.name)},body:file});
       const data=await res.json();
       if(!res.ok||!data.id)throw Error(data.error||"Attachment upload failed");
       step.photos.push(data.id);
       step.photoNames[data.id]=file.name.replace(/\.[^.]+$/,"").slice(0,120);
       const currentPosition=targetNoteId?step.noteIds.indexOf(targetNoteId):-1;
       if(currentPosition>=0){step.photoNoteIds[data.id]=targetNoteId;step.photoAfterNote[data.id]=currentPosition}
       changed();showNotes();showPhotos();saveHint();
      }catch(error){feedback.textContent=error.message||"Attachment upload failed"}
      finally{pendingUploads--;addPhoto.disabled=pendingUploads>0;input.value=""}
     };
     input.onchange=async()=>{
      const target=uploadTargetNote;
      for(const file of [...(input.files||[])])await upload(file,target);
      uploadTargetNote=null;
     };
     const addNote=button("+ Add note",()=>{step.notes.push("");step.noteIds.push(newId());changed();saveHint();showNotes();noteList.lastElementChild?.querySelector("textarea")?.focus()},"btn recipe-small-action");
     additions.append(addNote,addPhoto,input);
     body.append(noteList,photoList,additions);
     showNotes();showPhotos();
     body.addEventListener("dragover",event=>{if(event.dataTransfer?.types?.includes("Files"))event.preventDefault()});
     body.addEventListener("drop",event=>{const files=[...(event.dataTransfer?.files||[])];if(files.length){event.preventDefault();const line=event.target.closest(".recipe-step-note");const index=line?Number(line.dataset.noteIndex):null;(async()=>{for(const file of files)await upload(file,index)})()}});
     body.addEventListener("paste",event=>{const file=[...(event.clipboardData?.files||[])].find(f=>f.type.startsWith("image/"));if(file){event.preventDefault();const line=event.target.closest(".recipe-step-note");void upload(file,line?Number(line.dataset.noteIndex):null)}});
     const actions=el("div","recipe-edit-controls");
     const up=button("↑",()=>move(i,-1));up.disabled=i===0;up.title="Move up";
     const down=button("↓",()=>move(i,1));down.disabled=i===steps.length-1;down.title="Move down";
     const remove=button("Remove",()=>{if(!confirm("Remove this step?"))return;steps.splice(i,1);editing.delete(step.id);expanded=null;changed();saveHint();render()});
     const bottomSave=button("Save",()=>edit.click(),"btn primary recipe-save-step-bottom");
     actions.append(up,down,remove,bottomSave);body.append(actions);
    }else{
     const displayed=el("div","recipe-reader-text");
     if(step.standard.trim())displayed.append(el("p","recipe-reader-note",step.standard));
     if(step.detail.trim())displayed.append(el("p","recipe-reader-note",step.detail));
     const appendReadAttachment=photo=>{
      const item=el("figure","recipe-reader-photo");
      item.append(makeAttachment(photo,step.photoNames?.[photo]||""));
      if(step.photoNames?.[photo])item.append(el("figcaption","",step.photoNames[photo]));
      displayed.append(item);
     };
     for(let noteIndex=0;noteIndex<step.notes.length;noteIndex++){
      const note=step.notes[noteIndex];
      if(note.trim())displayed.append(el("p","recipe-reader-note",note));
      for(const photo of step.photos){
       if(step.photoNoteIds[photo]===step.noteIds[noteIndex])appendReadAttachment(photo);
      }
     }
     for(const photo of step.photos){
      if(step.photoNoteIds[photo]===undefined)appendReadAttachment(photo);
     }
     if(displayed.childElementCount){
      body.append(displayed);
      // The context menu provides knowledge lookup without a redundant button.
     }
    }
    if(typeof options.renderInvestigations==="function"){
     const investigationArea=el("div","recipe-step-investigations");
     body.append(investigationArea);
     options.renderInvestigations(step,investigationArea);
    }
    card.append(body);detailPane.append(card);
   }
   if(admin()){
    const add=button("+ Add step",()=>{
     const item={id:newId(),title:"New step",standard:"",detail:"",kind:"action",notes:[],noteIds:[],photos:[],photoNames:{},photoNoteIds:{},photoAfterNote:{}};
     steps.push(item);expanded=item.id;editing.add(item.id);changed();saveHint();render();
     const newCard=[...content.querySelectorAll(".recipe-one-step")].find(x=>x.dataset.stepId===item.id);
     newCard?.querySelector("input")?.focus();
    },"btn recipe-add-step");
    content.append(add);
   }
  }
  function setData(data){
   steps=Array.isArray(data?.recipe)?data.recipe.map(normalize):[];
   clearTimeout(saveTimer);dirty=false;expanded=steps[0]?.id||null;
   const resumeKey="bs-resume-step:"+location.hash;
   const desired=sessionStorage.getItem(resumeKey);
   if(desired&&steps.some(step=>step.id===desired)){expanded=desired;sessionStorage.removeItem(resumeKey)}
   editing.clear();feedback.textContent="";
   render();
  }
  render();
  return {setData,getData:()=>steps.map(normalize),getSelected:()=>steps.find(step=>step.id===expanded)||null,isDirty:()=>dirty,hasPendingUploads:()=>pendingUploads>0,savePending,markSaved:()=>{if(!savePromise){dirty=false;feedback.textContent="Saved."}},render};
 }
 window.BSRecipes={mount};
})();