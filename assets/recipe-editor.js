/* Discrete, progressively disclosed recipe steps. Existing API/schema unchanged. */
(function(){
 "use strict";
 const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node};
 const button=(label,fn,cls="btn")=>{const node=el("button",cls,label);node.type="button";node.onclick=fn;return node};
 const normalize=x=>({id:x.id,title:x.title||"",standard:x.standard||"",detail:x.detail||"",kind:x.kind||"action",notes:Array.isArray(x.notes)?x.notes.filter(n=>typeof n==="string").slice(0,40):[],photos:Array.isArray(x.photos)?x.photos.filter(p=>typeof p==="string").slice(0,30):[],photoNames:x.photoNames&&typeof x.photoNames==="object"&&!Array.isArray(x.photoNames)?Object.fromEntries(Object.entries(x.photoNames).filter(([id,name])=>typeof name==="string"&&Array.isArray(x.photos)&&x.photos.includes(id))):{}});
 const kinds=[["action","Action"],["inspection","Inspection"],["measurement","Measurement"],["explanation","Explanation"]];
 const newId=()=>crypto?.randomUUID?.()||"step_"+Date.now()+"_"+Math.random().toString(36).slice(2);
 // Viewer is shared by author and reader; closing it never changes step data.
 function openPhoto(id,name){
  const overlay=el("div","recipe-photo-viewer");
  overlay.setAttribute("role","dialog");overlay.setAttribute("aria-modal","true");overlay.setAttribute("aria-label",name||"Step photo");
  const close=button("×",()=>dismiss(),"recipe-photo-viewer-close");
  close.setAttribute("aria-label","Close photo");close.title="Close (Esc)";
  const picture=el("img","recipe-photo-viewer-image");
  picture.src="/api/photo?id="+encodeURIComponent(id);picture.alt=name||"Step photo";
  const caption=el("div","recipe-photo-viewer-caption",name||"");
  const onKey=event=>{if(event.key==="Escape")dismiss()};
  const dismiss=()=>{document.removeEventListener("keydown",onKey);overlay.remove()};
  overlay.addEventListener("click",event=>{if(event.target===overlay)dismiss()});
  overlay.append(close,picture,caption);
  document.body.append(overlay);document.addEventListener("keydown",onKey);close.focus();
 }
 const makePhoto=(id,name)=>{
  const picture=el("img","recipe-step-photo-image");
  picture.src="/api/photo?id="+encodeURIComponent(id);
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
  article.querySelector("h2")?.after(panel);
  const admin=()=>!!options.admin?.();
  let steps=[],expanded=null,dirty=false,level="standard";
  const editing=new Set();
  try{const saved=localStorage.getItem("bs-recipe-detail");if(["brief","standard","detailed"].includes(saved))level=saved}catch{}
  const changed=()=>{dirty=true;options.onChange?.()};
  const saveHint=()=>{feedback.textContent="Unsaved step changes."};
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
  const move=(index,offset)=>{
   const destination=index+offset;if(destination<0||destination>=steps.length)return;
   [steps[index],steps[destination]]=[steps[destination],steps[index]];
   expanded=steps[destination].id;changed();saveHint();render();
  };
  function render(){
   content.replaceChildren();
   const hasDetail=steps.some(s=>s.standard?.trim()||s.detail?.trim());
   if(hasDetail){
    const preferences=el("div","recipe-detail-controls");
    preferences.append(el("span","muted","Show"));
    for(const [key,label] of [["brief","Brief"],["standard","Standard"],["detailed","Detailed"]]){
     const choice=button(label,()=>{level=key;try{localStorage.setItem("bs-recipe-detail",key)}catch{}render()},"btn recipe-detail-button"+(key===level?" active":""));
     choice.setAttribute("aria-pressed",String(key===level));preferences.append(choice);
    }
    content.append(preferences);
   }
   for(let i=0;i<steps.length;i++){
    const step=steps[i],card=el("details","recipe-one-step");
    card.dataset.stepId=step.id;card.open=expanded===step.id;
    const summary=el("summary","recipe-one-step-summary");
    const name=el("span","recipe-one-step-title",(i+1)+". "+(step.title||"Untitled step"));
    summary.append(name);
    if(step.kind!=="action")summary.append(el("small","recipe-kind-caption",kinds.find(k=>k[0]===step.kind)?.[1]||step.kind));
    if(admin()){
     const edit=button(editing.has(step.id)?"Editing":"Edit",event=>{
      editing.add(step.id);expanded=step.id;render();
     },"btn recipe-step-edit-toggle");
     edit.addEventListener("click",event=>{event.preventDefault();event.stopPropagation()});
     summary.append(edit);
    }
    card.append(summary);
    card.addEventListener("toggle",()=>{if(card.open)expanded=step.id;else if(expanded===step.id)expanded=null});
    const body=el("div","recipe-one-step-body");
    if(admin()&&editing.has(step.id)){
     const title=el("label","recipe-one-field","Step");
     const nameInput=editField(step.title,"Describe the action",v=>{step.title=v;name.textContent=(i+1)+". "+(v||"Untitled step")});
     nameInput.maxLength=180;title.append(nameInput);body.append(title);

     // Notes and photos are optional; only display editors when requested.
     const additions=el("div","recipe-step-additions");
     const noteList=el("div","recipe-step-notes");
     const showNotes=()=>{
      noteList.replaceChildren();
      step.notes.forEach((value,index)=>{
       const line=el("div","recipe-step-note");
       const field=editField(value,"Write a note",v=>step.notes[index]=v,3);
       field.maxLength=4000;
       const removeNote=button("Remove note",()=>{step.notes.splice(index,1);changed();saveHint();showNotes()},"btn recipe-small-action");
       line.append(field,removeNote);noteList.append(line);
      });
     };
     showNotes();
     const photoList=el("div","recipe-step-photos");
     const showPhotos=()=>{
      photoList.replaceChildren();
      step.photos.forEach((id,index)=>{
       const item=el("div","recipe-step-photo");
       const photoName=step.photoNames[id]||"";
       const picture=makePhoto(id,photoName);
       const nameInput=editField(photoName,"Photo name",value=>{step.photoNames[id]=value;picture.alt=value||"Step photo"});
       nameInput.classList.add("recipe-step-photo-name");
       nameInput.setAttribute("aria-label","Photo name");
       nameInput.maxLength=120;
       item.append(picture,nameInput,button("Remove photo",()=>{step.photos.splice(index,1);delete step.photoNames[id];changed();saveHint();showPhotos()},"btn recipe-small-action"));
       photoList.append(item);
      });
     };
     showPhotos();
     const addNote=button("+ Add note",()=>{step.notes.push("");changed();saveHint();showNotes();noteList.lastElementChild?.querySelector("textarea")?.focus()},"btn recipe-small-action");
     const addPhoto=button("+ Add photo",()=>input.click(),"btn recipe-small-action");
     const input=el("input");input.type="file";input.accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif";input.hidden=true;
     const upload=async file=>{
      if(!file)return;
      if(!options.project){feedback.textContent="Cannot identify this project for photo upload.";return}
      if(file.size>10*1024*1024){feedback.textContent="Maximum photo size is 10 MB.";return}
      addPhoto.disabled=true;feedback.textContent="Uploading photo…";
      try{
       const res=await fetch("/api/photos",{method:"POST",credentials:"same-origin",headers:{"content-type":file.type,"x-photo-project":options.project,"x-photo-name":encodeURIComponent(file.name)},body:file});
       const data=await res.json();
       if(!res.ok||!data.id)throw Error(data.error||"Photo upload failed");
       step.photos.push(data.id);step.photoNames[data.id]=file.name.replace(/\.[^.]+$/,"").slice(0,120);changed();showPhotos();saveHint();
      }catch(error){feedback.textContent=error.message||"Photo upload failed"}
      finally{addPhoto.disabled=false;input.value=""}
     };
     input.onchange=()=>upload(input.files?.[0]);
     additions.append(addNote,addPhoto,input);
     body.append(noteList,photoList,additions);
     body.addEventListener("dragover",event=>{if(event.dataTransfer?.types?.includes("Files"))event.preventDefault()});
     body.addEventListener("drop",event=>{const file=[...(event.dataTransfer?.files||[])].find(f=>f.type.startsWith("image/"));if(file){event.preventDefault();upload(file)}});
     body.addEventListener("paste",event=>{const file=[...(event.clipboardData?.files||[])].find(f=>f.type.startsWith("image/"));if(file){event.preventDefault();upload(file)}});
     const actions=el("div","recipe-edit-controls");
     const up=button("↑",()=>move(i,-1));up.disabled=i===0;up.title="Move up";
     const down=button("↓",()=>move(i,1));down.disabled=i===steps.length-1;down.title="Move down";
     const duplicate=button("Duplicate",()=>{const copy={...normalize(step),id:newId(),notes:[...step.notes],photos:[...step.photos],photoNames:{...step.photoNames}};steps.splice(i+1,0,copy);expanded=copy.id;editing.add(copy.id);changed();saveHint();render()});
     const remove=button("Remove",()=>{if(!confirm("Remove this step?"))return;steps.splice(i,1);editing.delete(step.id);expanded=null;changed();saveHint();render()});
     const save=button("Save step",async()=>{
      if(!step.title.trim()){feedback.textContent="Enter a step name before saving.";nameInput.focus();return}
      save.disabled=true;save.textContent="Saving…";
      try{await options.onSave?.();dirty=false;feedback.textContent="Step saved.";editing.delete(step.id);render()}
      catch(error){feedback.textContent=error.message||"Could not save step.";save.textContent="Save step"}
      finally{save.disabled=false}
     },"btn primary recipe-save-step");
     actions.append(up,down,duplicate,remove,save);body.append(actions);
    }else{
     const displayed=el("div","recipe-reader-text");
     if(step.standard.trim())displayed.append(el("p","",step.standard));
     if(step.detail.trim())displayed.append(el("p","",step.detail));
     for(const note of step.notes||[]){if(note.trim())displayed.append(el("p","",note))}
     for(const photo of step.photos||[]){
      const item=el("figure","recipe-reader-photo");
      item.append(makePhoto(photo,step.photoNames?.[photo]||""));
      if(step.photoNames?.[photo])item.append(el("figcaption","",step.photoNames[photo]));
      displayed.append(item);
     }
     if(displayed.childElementCount){
      body.append(displayed);
      let highlighted="";
      displayed.addEventListener("mouseup",()=>{highlighted=selectedText(displayed)||highlighted});
      displayed.addEventListener("keyup",()=>{highlighted=selectedText(displayed)||highlighted});
      body.append(button("Please explain this",()=>{
       const selected=selectedText(displayed)||highlighted;
       if(!selected){feedback.textContent="Highlight an instruction phrase first.";return}
       if(window.BSExplainText)window.BSExplainText(selected,{stepId:step.id,stepTitle:step.title,fullText:step.standard+"\n"+step.detail});
      },"btn recipe-explain"));
     }
    }
    card.append(body);content.append(card);
   }
   if(admin()){
    const add=button("+ Add step",()=>{
     const item={id:newId(),title:"New step",standard:"",detail:"",kind:"action",notes:[],photos:[],photoNames:{}};
     steps.push(item);expanded=item.id;editing.add(item.id);changed();saveHint();render();
     const newCard=[...content.querySelectorAll(".recipe-one-step")].find(x=>x.dataset.stepId===item.id);
     newCard?.querySelector("input")?.focus();
    },"btn recipe-add-step");
    content.append(add);
   }
  }
  function setData(data){
   steps=Array.isArray(data?.recipe)?data.recipe.map(normalize):[];
   dirty=false;expanded=null;editing.clear();feedback.textContent="";
   render();
  }
  render();
  return {setData,getData:()=>steps.map(normalize),isDirty:()=>dirty,render};
 }
 window.BSRecipes={mount};
})();