/* One reusable note panel for project summary, BOM, assembly, part and parts pages.
 * Uses existing /api/photos and BSPhotoMarkup rather than a second photo system.
 */
(function(){
 "use strict";
 const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e};
 const button=(label,onClick,cls="btn")=>{const b=el("button",cls,label);b.type="button";b.onclick=onClick;return b};
 const id=()=>crypto.randomUUID();
 function mount(parent,{project,scope,canEdit}){
  const panel=el("section","bs-unstructured-notes");
  panel.setAttribute("aria-label","Unstructured Notes");
  const bar=el("div","bs-unstructured-notes-heading");
  bar.append(el("h2","","Unstructured Notes"));
  const add=button("+ Add entry",()=>edit(null),"btn bs-unstructured-add");
  const status=el("p","muted bs-unstructured-status");status.setAttribute("role","status");
  const list=el("div","bs-unstructured-list");
  bar.append(add);panel.append(bar,status,list);parent.append(panel);
  let pageId="root",records=[],revision=null,editable=false,version=0,editing=null;
  const endpoint=()=>"/api/unstructured-notes?project="+encodeURIComponent(project)+
   "&scope="+encodeURIComponent(scope)+"&id="+encodeURIComponent(pageId);
  const report=value=>{status.textContent=value||""};
  async function read(idValue="root"){
   pageId=idValue||"root";const stamp=++version;editing=null;
   list.replaceChildren();report("Loading notes…");add.hidden=true;
   try{
    const response=await fetch(endpoint(),{credentials:"same-origin",cache:"no-store"});
    const data=await response.json();
    if(!response.ok)throw Error(data.error||"Unable to load notes");
    if(stamp!==version)return;
    records=data.notes||[];revision=data.revision||null;
    // The API is the permission authority; the project sidebar may still be initializing.
    editable=!!data.canEdit;
    report("");render();
   }catch(error){if(stamp===version){report(error.message);add.hidden=true}}
  }
  function render(){
   list.replaceChildren();add.hidden=!editable;
   if(!records.length)list.append(el("p","muted bs-unstructured-empty","No notes yet."));
   for(const note of records){
    const card=el("article","bs-unstructured-card");
    const heading=button(note.title,()=>{
     card.classList.toggle("is-expanded");
     content.hidden=!card.classList.contains("is-expanded");
    },"bs-unstructured-note-title");
    heading.setAttribute("aria-expanded","false");
    const content=el("div","bs-unstructured-note-content");content.hidden=true;
    heading.onclick=()=>{content.hidden=!content.hidden;heading.setAttribute("aria-expanded",String(!content.hidden))};
    const text=el("p","bs-unstructured-description",note.description||"");
    content.append(text);
    if(note.photos?.length){
     const pictures=el("div","bs-unstructured-photos");
     for(const photoId of note.photos){
      const frame=el("div","bs-unstructured-photo");
      const photo=el("img");photo.alt=note.title;
      photo.src=window.BSPhotoMarkup.displayUrl("gallery",photoId);
      photo.loading="lazy";frame.append(photo);
      const actions=el("div","bs-unstructured-photo-actions");
      actions.append(button("View",()=>window.open("/api/photo?id="+encodeURIComponent(photoId),"_blank"),"btn"));
      if(editable)actions.append(button("Edit photo",()=>window.BSPhotoMarkup.open({
       kind:"gallery",id:photoId,onSave:()=>{photo.src=window.BSPhotoMarkup.displayUrl("gallery",photoId)+"&updated="+Date.now()}
      }),"btn"));
      frame.append(actions);pictures.append(frame);
     }
     content.append(pictures);
    }
    if(editable){
     const actions=el("div","bs-unstructured-note-actions");
     actions.append(button("Edit",()=>edit(note),"btn"));
     actions.append(button("Delete",async()=>{
      if(!await window.BSDialogs.danger("Delete this note? Its original photos will be retained in storage.",{title:"Delete note?"}))return;
      await save(records.filter(x=>x.id!==note.id));
     },"btn"));
     content.append(actions);
    }
    card.append(heading,content);list.append(card);
   }
  }
  async function save(notes){
   report("Saving…");add.disabled=true;
   try{
    const response=await fetch(endpoint(),{method:"PUT",credentials:"same-origin",
     headers:{"content-type":"application/json"},body:JSON.stringify({notes,expectedRevision:revision})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(data.error||"Unable to save notes");
    records=data.notes;revision=data.revision;editing=null;
    report("Saved.");render();return true;
   }catch(error){report(error.message);return false}
   finally{add.disabled=false}
  }
  function edit(note){
   if(!editable)return;
   const working=note?{...note,photos:[...(note.photos||[])]}:
    {id:id(),title:"",description:"",photos:[]};
   const editor=el("form","bs-unstructured-editor");
   editor.noValidate=true;
   const title=el("label","bs-unstructured-field");
   title.append(el("span","","Note header"));
   const name=el("input","field");name.maxLength=180;name.placeholder="Enter a note title";
   name.value=working.title;name.required=true;title.append(name);
   const detail=el("label","bs-unstructured-field");
   detail.append(el("span","","Description"));
   const description=el("textarea","field");description.rows=6;description.maxLength=12000;
   description.placeholder="Write anything useful here…";description.value=working.description;detail.append(description);
   const photos=el("div","bs-unstructured-edit-photos");
   const photoInput=el("input");photoInput.type="file";photoInput.accept="image/*,.heic,.heif";
   photoInput.multiple=true;photoInput.hidden=true;
   const pick=button("+ Add photo",()=>photoInput.click(),"btn");
   const photoStatus=el("span","small muted");photoStatus.setAttribute("role","status");
   let uploading=0;
   const drawPhotos=()=>{
    photos.replaceChildren();
    for(const photoId of working.photos){
     const frame=el("div","bs-unstructured-edit-photo");
     const img=el("img");img.src=window.BSPhotoMarkup.displayUrl("gallery",photoId);
     img.alt="Note attachment";
     frame.append(img,
      button("Edit photo",()=>window.BSPhotoMarkup.open({kind:"gallery",id:photoId,
       onSave:()=>{img.src=window.BSPhotoMarkup.displayUrl("gallery",photoId)+"&updated="+Date.now()}
      }),"btn"),
      button("Remove",()=>{working.photos=working.photos.filter(x=>x!==photoId);drawPhotos()},"btn"));
     photos.append(frame);
    }
   };
   drawPhotos();
   const uploadPhotos=async files=>{
    for(const file of files){
     if(working.photos.length>=12){photoStatus.textContent="Maximum 12 photos per note.";break}
     if(file.size>10*1024*1024){photoStatus.textContent="Maximum photo size is 10 MB.";continue}
     const type=file.type||({jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp",gif:"image/gif",heic:"image/heic",heif:"image/heif"}[file.name.split(".").pop().toLowerCase()]||"");
     if(!type){photoStatus.textContent="Choose an image file.";continue}
     uploading++;submit.disabled=true;photoStatus.textContent="Uploading photo…";
     try{
      const response=await fetch("/api/photos",{method:"POST",credentials:"same-origin",
       headers:{"content-type":type,"x-photo-project":project,"x-photo-assembly":"note-"+working.id,
        "x-photo-name":encodeURIComponent(file.name),"x-photo-caption":encodeURIComponent(name.value.trim())},
       body:file});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw Error(data.error||"Photo upload failed");
      working.photos.push(data.id);drawPhotos();photoStatus.textContent="Photo uploaded.";
     }catch(error){photoStatus.textContent=error.message}
     finally{uploading--;submit.disabled=uploading>0}
    }
   };
   photoInput.onchange=()=>{const files=[...photoInput.files];photoInput.value="";void uploadPhotos(files)};
   const actions=el("div","bs-unstructured-editor-actions");
   const submit=button("Save note",()=>editor.requestSubmit(),"btn primary");
   const cancel=button("Cancel",()=>{editing=null;render()},"btn");
   actions.append(submit,cancel);
   editor.append(title,detail,photos,pick,photoInput,window.BSPhotoMarkup.pasteTarget(uploadPhotos,{
    onEmpty:()=>{photoStatus.textContent="Copy an image or choose a photo file."}
   }),photoStatus,actions);
   editor.onsubmit=async e=>{
    e.preventDefault();if(uploading)return;
    if(!name.value.trim()){name.focus();photoStatus.textContent="Enter a note header.";return}
    const next={...working,title:name.value.trim(),description:description.value};
    const updated=note?records.map(row=>row.id===note.id?next:row):[...records,next];
    if(!await save(updated))submit.disabled=false;
   };
   list.replaceChildren(editor);editing=working.id;report("");name.focus();
  }
  return {element:panel,read,refresh:()=>read(pageId)};
 }
 window.BSUnstructuredNotes=Object.freeze({mount});
})();
