/* Project, assembly, part, and work-instruction records. */
(function(){
 "use strict";
 const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el};
 const btn=(label,fn,cls="btn")=>{const b=make("button",cls,label);b.type="button";b.onclick=fn;return b};
 const types=[["observation","What happened?"],["theory","What do you think caused it?"],["note","Additional notes"]]; 
 const legacyType={attempt:"Attempt / change",theory:"Hypothesis",lesson:"How was it fixed?",revision:"Revision / design change",result:"Result"};
 const categories={
  note:{label:"Notes",fields:[]},
  photos:{label:"Photos",fields:[]},
  test:{label:"Tests/Measurements",fields:[["theory","What did you want to verify?"],["attempt","How did you test it?"] ,["result","What happened?"]]},
  revision:{label:"Revisions",fields:[["revision","What changed?"],["theory","Why did you change it?"]]},
  failure:{label:"Failures",fields:[...types.slice(0,2),["resolution","Did you fix it?"]]}
 };
 const retiredLabels={revision:{result:"What was the result?"},note:{note:"Notes"}};
 const categoryOf=record=>record.category||(record.partSnapshot?"revision":"failure");
 const sectionTitle="Project Archive";
 const acceptedAttachments=globalThis.BSAttachmentTypes.accept;
 const photoExt=/\.(jpg|jpeg|png|webp|gif|heic|heif)$/i;
 const fileUrl=id=>"/api/recipe-files?id="+encodeURIComponent(id);
 const formatTimestamp=savedAt=>{
  const parsed=new Date(savedAt.length===10?savedAt+"T12:00:00":savedAt);
  return Number.isNaN(parsed.getTime())?savedAt:parsed.toLocaleString(undefined,{
   year:"numeric",month:"short",day:"numeric",hour:savedAt.length===10?undefined:"numeric",minute:savedAt.length===10?undefined:"2-digit"
  });
 };
 function mount({project,admin,getTree,getPart,getPartList,revisions,getWorkspaceRevision,renderSnapshot}){
  let records=[],revision=null;
  let assemblySlot=null,partSlot=null,stepSlots=new Map(),activeContext=null,loadSerial=0;
  const openCards=new Set();
  const attachmentNames=new Map();
  function showAttachmentNames(container){
   for(const link of container.querySelectorAll("[data-investigation-file]")){
    const id=link.dataset.investigationFile;
    if(!attachmentNames.has(id)){
     attachmentNames.set(id,fetch(fileUrl(id),{method:"HEAD",credentials:"same-origin"})
      .then(response=>{
       if(!response.ok)return "";
       const encoded=response.headers.get("content-disposition")?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
       return encoded?decodeURIComponent(encoded):"";
      }).catch(()=> "").then(name=>{
       if(!name)attachmentNames.delete(id);
       return name;
      }));
    }
    void attachmentNames.get(id).then(name=>{
     if(!name)return;
     const image=link.querySelector("img");
     if(image)image.alt=name;
     else link.textContent=name;
    });
   }
  }
  function attachmentLink(file){
   const extension=file.split(".").pop();
   const link=make("a","investigation-file","Download ."+extension+" file");
   link.href=fileUrl(file);link.target="_blank";link.rel="noopener noreferrer";
   link.dataset.investigationFile=file;
   return link;
  }
  const openSections=new Set();
  const api="/api/investigations?project="+encodeURIComponent(project);
  const feedback=target=>{const area=target||activeContext?.target;return area?.activeEntriesHost?.querySelector(".investigation-feedback")||area?.querySelector(".investigation-feedback")};
  const report=(message,target)=>{const p=feedback(target);if(p){p.textContent=message;if(message&&p.closest(".investigation-active-area"))p.closest(".investigation-active-area").hidden=false;}};
  const makeContext=(ownerType,ownerId,stepId="",title="")=>({scope:stepId?"step":ownerType,ownerType,ownerId,stepId,title});
  const parentOf=id=>getTree().find(node=>node.id===id)?.parentId??null;
  const isDescendant=(child,ancestor)=>{
   if(ancestor==="__root__")return true;
   const seen=new Set();
   let cur=child;
   while(cur&&cur!=="__root__"&&!seen.has(cur)){
    if(cur===ancestor)return true;
    seen.add(cur);cur=parentOf(cur);
   }
   return false;
  };
  const partAssembly=id=>{
   const part=getPartList().find(x=>x.id===id);
   if(part?.assemblyId)return part.assemblyId;
   const linked=getTree().find(x=>x.partId===id);
   return linked?.parentId??null;
  };
  const localRecord=(record,context)=>record.ownerType===context.ownerType&&record.ownerId===context.ownerId&&
   (context.stepId?record.scope==="step"&&record.stepId===context.stepId:record.scope!=="step");
  const within=(record,context)=>{
   if(context.stepId)return localRecord(record,context);
   if(context.ownerType==="part")return record.ownerType==="part"&&record.ownerId===context.ownerId;
   if(record.ownerType==="assembly")return isDescendant(record.ownerId,context.ownerId);
   return isDescendant(partAssembly(record.ownerId),context.ownerId);
  };
  const owns=(record,context)=>localRecord(record,context);
  async function load(){
   const version=++loadSerial;
   try{
    const r=await fetch(api,{credentials:"same-origin",cache:"no-store"});
    const d=await r.json();if(!r.ok)throw Error(d.error||"Unable to load investigations");
    if(version!==loadSerial)return;
    records=Array.isArray(d.records)?d.records:[];revision=d.revision??null;renderAll();
   }catch(error){report(error.message)}
  }
  async function save(change,{deferRender=false}={}){
   if(!admin())throw Error("Sign in as administrator to save.");
   const r=await fetch(api,{method:"POST",credentials:"same-origin",
    headers:{"content-type":"application/json"},body:JSON.stringify({...change,expectedRevision:revision})});
   const d=await r.json();if(!r.ok)throw Object.assign(Error(d.error||"Save failed"),{status:r.status});
   records=d.records;revision=d.revision;if(!deferRender)renderAll();
   return d;
  }
  function attach(record,container,target,editing=false,onDone=()=>{},creating=false,registerSave=null){
   const reportHere=message=>report(message,target);
   const category=categories[categoryOf(record)];
   const entryList=make("div","investigation-entries");
   for(const entry of [...(record.entries||[]),...(record.notes||[])]){
    const item=make("article","investigation-entry");
    const label=entry.descriptor||(entry.type==="resolution"?("Did you fix it? "+({yes:"Yes — How?",no:"No — Why?",maybe:"Maybe — How?"})[entry.resolution]):category.fields.find(x=>x[0]===entry.type)?.[1]||types.find(x=>x[0]===entry.type)?.[1]||legacyType[entry.type]||"Update");
    const stamp=entry.date||entry.createdAt?.slice(0,10)||"";
    const labelRow=make("div","investigation-entry-heading");
    labelRow.append(make("strong","",label));
    // Field-level dates are redundant; show one entry timestamp at bottom.
    item.append(labelRow);if(entry.text)item.append(make("p","",entry.text));
    const links=make("div","investigation-file-links");
    for(const file of entry.files||[]){
     if(photoExt.test(file)){
      const img=make("img","investigation-image");img.src=fileUrl(file);img.loading="lazy";img.alt="Attached photo";item.append(img);
     }else{
      links.append(attachmentLink(file));
     }
    }
    if(links.childElementCount)item.append(links);
    entryList.append(item);
   }
   const photoEntry=categoryOf(record)==="photos";
   const noteLike=categoryOf(record)==="note"||photoEntry;
   if(!editing){
    if(noteLike){
     if(record.description?.trim())container.append(make("p",photoEntry?"investigation-photo-note":"investigation-note-description",record.description));
     const gallery=make("div","investigation-note-photo-gallery");
     for(const id of record.photos||[]){
      if(photoExt.test(id)){
       const tile=make("figure","investigation-named-photo");
       const image=make("img","investigation-note-photo");image.src=fileUrl(id);
       image.alt=record.photoNames?.[id]||"Note photo";image.loading="lazy";tile.append(image);
       if(record.photoNames?.[id])tile.append(make("figcaption","investigation-photo-name",record.photoNames[id]));
       gallery.append(tile);
      }else gallery.append(attachmentLink(id));
     }
     if(gallery.childElementCount)container.append(gallery);
    }
    if(entryList.childElementCount)container.append(entryList);
    return;
   }
   if(!admin())return;
   const descriptionInput=noteLike?make("textarea","field investigation-description-input"):null;
   if(descriptionInput){descriptionInput.rows=3;descriptionInput.maxLength=5000;descriptionInput.value=record.description||"";descriptionInput.placeholder=photoEntry?"Note (optional)":"Description (optional)"}
   const latest=new Map();for(const entry of record.entries||[])latest.set(entry.type,entry);

   const controls=make("div","investigation-add-controls");
   const nameRow=make("label","investigation-field-label");
   const titleOptional=noteLike;
   const titleInput=window.BSEntryEditor.titleInput(record.title,null,{placeholder:titleOptional?"Title (optional)":"Title"});
   nameRow.append(make("span","investigation-field-descriptor",titleOptional?"Title (optional)":"Title"),titleInput);controls.append(nameRow);
   const dateLabel=make("label","investigation-date-field","Date");
   const date=make("input","field");date.type="date";
   const now=new Date();date.value=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10);
   date.value=record.date||[...(record.entries||[])].reverse().find(entry=>entry.date)?.date||date.value;
   // Date is recorded on the server. Never ask the author to choose a date.
   // Retain this internal value only for legacy entry fields that require it.
   dateLabel.append(date);
   if(descriptionInput){const descriptionLabel=make("label","investigation-description-label",photoEntry?"Note":"Description");descriptionLabel.append(descriptionInput);controls.append(descriptionLabel)}

   const notePhotos=noteLike?{existing:[...(record.photos||[])],pending:[],names:{...(record.photoNames||{})},pendingNames:new Map()}:null;
   if(notePhotos){
    const gallery=make("div","investigation-note-photo-gallery");
    const pendingList=make("div","investigation-note-pending-photos");
    let previewUrls=[];
    const draw=()=>{
     for(const url of previewUrls)URL.revokeObjectURL(url);
     previewUrls=[];
     gallery.replaceChildren();pendingList.replaceChildren();
     for(const id of notePhotos.existing){
      const tile=make("div","investigation-note-photo-tile");
      if(photoExt.test(id)){
       const photo=make("img","investigation-note-photo");photo.src=fileUrl(id);photo.alt="Attached note photo";tile.append(photo);
       const name=make("input","field investigation-photo-name-input");name.type="text";name.maxLength=120;
       name.placeholder="Photo name (optional)";name.setAttribute("aria-label","Photo name");name.value=notePhotos.names[id]||"";
       name.addEventListener("input",()=>{notePhotos.names[id]=name.value});tile.append(name);
      }else tile.append(attachmentLink(id));
      tile.append(btn("Delete",()=>{notePhotos.existing.splice(notePhotos.existing.indexOf(id),1);delete notePhotos.names[id];draw()},"btn investigation-note-photo-remove"));
      gallery.append(tile);
     }
     for(const file of notePhotos.pending){
      const row=make("div","investigation-note-pending-photo");
      if(photoExt.test(file.name)){
       const image=make("img","investigation-note-pending-thumbnail");
       const url=URL.createObjectURL(file);previewUrls.push(url);
       image.src=url;image.alt=file.name;
       image.loading="lazy";row.append(image);
      }
      const info=make("div","investigation-note-pending-info");
      const name=make("input","field investigation-photo-name-input");name.type="text";name.maxLength=120;
      name.placeholder="Photo name (optional)";name.setAttribute("aria-label","Photo name for "+file.name);
      name.value=notePhotos.pendingNames.get(file)||"";
      name.addEventListener("input",()=>notePhotos.pendingNames.set(file,name.value));
      info.append(name,
       btn("Remove",()=>{notePhotos.pending.splice(notePhotos.pending.indexOf(file),1);notePhotos.pendingNames.delete(file);draw()},"btn investigation-note-photo-remove"));
      row.append(info);pendingList.append(row);
     }
    };
    const uploader=window.BSPhotoEditor.uploadPanel({
     title:photoEntry?"Add photos":"Add photos / documents",accept:photoEntry?"image/*,.heic,.heif":acceptedAttachments,
     hint:photoEntry?"Choose or paste up to 12 images, 20 MB each.":"Choose photos or documents. Up to 12 files per note, 20 MB each.",
     onFiles:files=>{
      for(const file of files){
       if(!file.name){reportHere("Select a named file.");continue}
       if(photoEntry&&!photoExt.test(file.name)){reportHere("Photos entries accept images only.");continue}
       if(file.size>20*1024*1024){reportHere("Each file must be 20 MB or smaller.");continue}
       if(notePhotos.existing.length+notePhotos.pending.length>=12){reportHere("An entry can contain up to 12 photos or attachments.");break}
       notePhotos.pending.push(file);
      }
      draw();
     }
    });
    const section=make("div","investigation-note-photos");
    const photoButton=window.BSEntryEditor.attachmentButton(()=>{
     const expanded=uploader.panel.hidden;
     if(expanded)uploader.open();else uploader.close();
     section.classList.toggle("is-upload-expanded",expanded);
     photoButton.setAttribute("aria-expanded",String(expanded));
    },{label:photoEntry?"Add photos":"Add photos / documents",className:"investigation-note-photo-add"});
    photoButton.setAttribute("aria-expanded","false");
    // The existing button is the upload panel's header and its collapse control.
    // Do not render a second title or Close button inside this entry.
    uploader.panel.querySelector(".bs-upload-heading")?.remove();
    section.append(photoButton,uploader.panel,gallery,pendingList);
    controls.append(section);draw();
   }
   function fieldRow(type,label,stored=latest.get(type),parent=controls){
    const wrap=make("div","investigation-entry-field");
    const caption=make("label","investigation-field-label");
    const descriptor=make("span","investigation-field-descriptor",label);
    const field=make("textarea","field");field.rows=2;field.maxLength=5000;
    field.value=stored?.text||"";caption.append(descriptor,field);
    const selected=[];
    const fileChoice=make("span","investigation-file-label");
    function queue(files){
     selected.push(...files);
     fileChoice.replaceChildren(...selected.map((file,index)=>btn(file.name+" ×",()=>{
      selected.splice(index,1);queue([]);
     },"investigation-attachment-link")));
    }
    const uploader=window.BSPhotoEditor.uploadPanel({
     title:"Add attachments",accept:acceptedAttachments,onFiles:queue,
     hint:"You can choose multiple files or paste an image."
    });
    const attachments=make("div","investigation-field-attachments");
    const attachmentButton=window.BSEntryEditor.attachmentButton(()=>{
     const expanded=uploader.panel.hidden;
     if(expanded)uploader.open();else uploader.close();
     attachments.classList.toggle("is-upload-expanded",expanded);
     attachmentButton.setAttribute("aria-expanded",String(expanded));
    },{className:"investigation-attachment-add"});
    attachmentButton.setAttribute("aria-expanded","false");
    // Match the Photos entry: one anchored toggle, without a second title or Close control.
    uploader.panel.querySelector(".bs-upload-heading")?.remove();
    attachments.append(attachmentButton,fileChoice,uploader.panel);
    const existingFiles=[...(stored?.files||[])];
    const existingList=make("div","investigation-existing-files");
    function drawFiles(){
     existingList.replaceChildren();
     for(const file of existingFiles){
      const row=make("div","investigation-existing-file");
      const link=attachmentLink(file);
      if(photoExt.test(file)){const img=make("img","investigation-edit-thumbnail");img.src=fileUrl(file);img.alt="Attached photo";link.replaceChildren(img)}
      row.append(link,btn("Remove",()=>{existingFiles.splice(existingFiles.indexOf(file),1);drawFiles()},"investigation-attachment-link"));
      existingList.append(row);
     }
    }
    drawFiles();
    wrap.append(caption,attachments,existingList);parent.append(wrap);
    return {type,field,selected,wrap,descriptor,existingFiles,stored};
   }
   const inputs=[];
   const fixed=make("select","field investigation-fixed-select");
   for(const [type,label] of (record.category?category:categories.failure).fields){
    if(type!=="resolution"){inputs.push(fieldRow(type,label));continue}
    const fixedRow=make("label","investigation-fixed-row");
    fixedRow.append(make("span","",label),fixed);controls.append(fixedRow);
    for(const [value,caption] of [["","Select"],["yes","Yes"],["no","No"],["maybe","Maybe"]]){
     const option=make("option","",caption);option.value=value;fixed.append(option);
    }
    const resolution=fieldRow("resolution","How?");
    inputs.push(resolution);
    let previous=latest.get("resolution")?.resolution||"";
    fixed.onchange=()=>{
     if(previous&&fixed.value&&(fixed.value==="no")!==(previous==="no"))resolution.field.value="";
     if(fixed.value)previous=fixed.value;
     resolution.wrap.hidden=!fixed.value;
     resolution.descriptor.textContent=fixed.value==="no"?"Why?":"How?";
    };
    fixed.value=previous;fixed.onchange();
   }
   const notes=[];
   const noteList=make("div","investigation-note-list");
   function addNote(stored){
    const panel=make("div","investigation-note-editor");
    const heading=make("label","investigation-field-label");
    const name=make("input","field");name.maxLength=180;name.value=stored?.descriptor||"";
    heading.append(make("span","investigation-field-descriptor","Descriptor"),name);
    panel.append(heading);noteList.append(panel);
    const note={...fieldRow("note","Description",stored??null,panel),name};
    notes.push(note);
    panel.append(btn("Remove note",()=>{
     notes.splice(notes.indexOf(note),1);panel.remove();add.disabled=false;
    },"btn"));
    if(!stored)name.focus();
   }
   const add=btn("+ Add entry",()=>{
    if(notes.length>=30)return;
    addNote();add.disabled=notes.length>=30;
   },"btn investigation-add-note");
   const noteSection=make("div","investigation-note-section");
   if(!notePhotos){
    noteSection.append(noteList,add);controls.append(noteSection);
    for(const note of record.notes||[])addNote(note);
    add.disabled=notes.length>=30;
   }
   let saveBtn;
   const persist=async(deferRender=false)=>{
    const fields=inputs.filter(item=>item.type==="resolution"?!!fixed.value:!!(item.field.value.trim()||item.selected.length||item.existingFiles.length));
    if(!noteLike&&!titleInput.value.trim()){titleInput.focus();throw Error("Enter a title before saving.")}
    const notesToSave=notes.filter(note=>note.name.value.trim()||note.field.value.trim()||note.selected.length||note.existingFiles.length);
    for(const note of notesToSave){
     if(!note.name.value.trim()){note.name.focus();throw Error("Enter a descriptor for the note.")}
     if(!note.field.value.trim()){note.field.focus();throw Error("Enter a description for the note.")}
    }
    saveBtn.disabled=true;
    try{
     const entries=[],savedNotes=notePhotos?[...(record.notes||[])]:[];
     for(const {type,field,selected,existingFiles,stored,name} of [...fields,...notesToSave]){
      if(selected.length+existingFiles.length>12)throw Error("Attach no more than 12 files to each field.");
      const files=[...existingFiles];
      for(const file of selected){
       if(file.size>20*1024*1024)throw Error("An attachment exceeds 20 MB.");
       const up=await fetch("/api/recipe-files?project="+encodeURIComponent(project),{method:"POST",
        credentials:"same-origin",headers:{"content-type":"application/octet-stream","x-file-name":encodeURIComponent(file.name)},body:file});
       const data=await up.json();if(!up.ok)throw Error(data.error||"Attachment failed");
       files.push(data.id);
      }
      const entry={type,text:field.value,date:name?(stored?.date||date.value):date.value,files,
       fileName:selected[0]?.name.slice(0,120)||stored?.fileName||""};
      if(name)savedNotes.push({...entry,descriptor:name.value.trim()});
      else entries.push({...entry,...(type==="resolution"?{resolution:fixed.value}:{})});
     }
     let photos,photoNames;
     if(notePhotos){
      photos=[...notePhotos.existing];
      photoNames={};
      for(const id of photos){const value=(notePhotos.names[id]||"").trim();if(value)photoNames[id]=value;}
      for(const file of notePhotos.pending){
       const up=await fetch("/api/recipe-files?project="+encodeURIComponent(project),{method:"POST",
        credentials:"same-origin",headers:{"content-type":"application/octet-stream","x-file-name":encodeURIComponent(file.name)},body:file});
       const data=await up.json();if(!up.ok||!data.id)throw Error(data.error||"Photo upload failed");
       photos.push(data.id);
       const photoName=(notePhotos.pendingNames.get(file)||"").trim();
       if(photoName)photoNames[data.id]=photoName;
      }
     }
     const details={title:titleInput.value.trim(),date:date.value,entries,notes:savedNotes,
      ...(descriptionInput?{description:descriptionInput.value,photos,photoNames}:{})};
     const result=await save(creating?{...record,...details,action:"create"}:{...details,action:"editRecord",id:record.id},{deferRender});
     if(creating){
      const card=[...target.querySelectorAll(".investigation-card[data-record-id]")].find(item=>item.dataset.recordId===result.createdId);
      if(card){
       card.open=true;
       openCards.add(record.ownerType+":"+record.ownerId+":"+(record.stepId||"")+":"+result.createdId);
      }
     }
     if(!deferRender){onDone();reportHere("Record saved.")}
     return result;
    }catch(error){reportHere(error.message);saveBtn.disabled=false;throw error}
   };
   saveBtn=window.BSEntryEditor.action("Save",()=>{void persist(false).catch(()=>{})},{kind:"primary"});
   if(registerSave)registerSave(()=>persist(true));
   const actions=window.BSEntryEditor.actionRow();
   actions.classList.add("investigation-edit-actions");
   // Use the same Save/Cancel action labels throughout. A record nested
   // under an edited Work Instruction delegates both to the parent editor,
   // so there are no competing independent save transactions.
   if(registerSave){
    actions.append(
     window.BSEntryEditor.action("Save",()=>{
      const step=target.closest(".recipe-step-detail");
      step?.parentElement?.querySelector(".recipe-step-nav-row.is-active .recipe-step-edit-toggle")?.click();
     },{kind:"primary"}),
     window.BSEntryEditor.action("Cancel",()=>{
      const step=target.closest(".recipe-step-detail");
      step?.querySelector(".recipe-cancel-step")?.click();
     })
    );
   }else actions.append(saveBtn,window.BSEntryEditor.action("Cancel",onDone));
   if(!creating&&!isArchived(record)){
    actions.append(window.BSEntryEditor.action("Archive",()=>archiveRecord(record),{className:"investigation-archive-button"}));
   }
   if(!creating)actions.append(window.BSEntryEditor.action("Delete",async()=>{
    const deleteBtn=actions.querySelector(".investigation-delete");
    if(!await window.BSDialogs.danger('Delete "'+(record.title?.trim()||categories[categoryOf(record)]?.label||"Entry")+'"? This removes the record from the project.',{title:"Delete record?"}))return;
    deleteBtn.disabled=true;saveBtn.disabled=true;
    try{await save({action:"deleteRecord",id:record.id});reportHere("Record deleted.")}
    catch(error){reportHere(error.message);deleteBtn.disabled=false;saveBtn.disabled=false}
   },{kind:"danger",className:"investigation-delete"}));
   controls.append(actions);
   container.append(controls);
  }
  // Active records stay in the section where they were created. Old records
  // without an archive flag remain active; previous part snapshots are history.
  const isArchived=record=>record.lifecycle!=="active"||Boolean(record.archivedAt||record.partSnapshot);
  const archiveDate=record=>(record.archivedAt||record.partSnapshot?.archivedAt||"").slice(0,10);
  function archiveRecord(record){
   const dialog=make("dialog","investigation-archive-dialog");
   dialog.setAttribute("aria-label","Archive "+record.title);
   dialog.append(make("h3","","Archive entry"),make("p","muted","Move this entry from its current section into Project Archive."));
   dialog.append(make("p","investigation-archive-today","Archive date: "+new Date().toLocaleDateString()));
   const label=make("label","investigation-archive-note-label","Why was it archived? (optional)");
   const note=make("textarea","field");note.rows=3;note.maxLength=2500;note.placeholder="Reason for archiving (optional)";
   label.append(note);
   const actions=make("div","investigation-edit-actions");
   const message=make("p","investigation-feedback muted");message.setAttribute("role","status");
   const confirm=btn("Archive",async()=>{
    confirm.disabled=true;confirm.textContent="Archiving…";
    try{await save({action:"archiveRecord",id:record.id,note:note.value});dialog.close()}
    catch(error){message.textContent=error.message;confirm.disabled=false;confirm.textContent="Archive"}
   },"btn primary");
   actions.append(confirm,btn("Cancel",()=>dialog.close()));
   dialog.append(label,actions,message);
   document.body.append(dialog);dialog.addEventListener("close",()=>dialog.remove(),{once:true});
   dialog.showModal();note.focus();
  }
  function render(target,context,compact=false){
   if(!target)return;
   const sectionKey=context.ownerType+":"+context.ownerId+":"+(context.stepId||"");
   const existing=compact?target.querySelector(".investigation-collapse"):null;
   if(existing){if(existing.open)openSections.add(sectionKey);else openSections.delete(sectionKey)}
   const activeHost=target.activeEntriesHost||make("section","investigation-active-area");
   activeHost.classList.add("investigation-active-area");
   activeHost.replaceChildren();target.replaceChildren();
   if(!target.activeEntriesHost)target.append(activeHost);
   activeContext={...context,target};
   const own=records.filter(record=>owns(record,context));
   const topLevel=record=>!record.parentRecordId||!own.some(item=>item.id===record.parentRecordId);
   const activeOwn=own.filter(record=>!isArchived(record)&&topLevel(record));
   const stepSlot=compact?stepSlots.get(context.stepId):null;
   if(stepSlot)stepSlot.pendingEdits=[];
   const archivedOwn=own.filter(record=>isArchived(record)&&!record.partSnapshot&&topLevel(record));
   const archivedRelated=records.filter(record=>within(record,context)&&!owns(record,context)&&isArchived(record)&&!record.partSnapshot&&!record.parentRecordId);
   // A step has one edit-mode switch: its Work Instruction header.
   // Other workspace pages have no parent editor and retain their own controls.
   const allowEntryEditing=admin()&&(!compact||!stepSlot?.step?.archivedAt);
   // Step creation follows Edit mode; other sections expose their own action.
   const canCreate=allowEntryEditing&&(!compact||Boolean(stepSlot?.editing));
   const addEntry=canCreate?window.BSUI.button("+ Add entry",event=>{
    event.preventDefault();newRecord(context,target);
   }):null;
   window.BSUI.sectionActions(target.sectionBody||activeHost,{primary:addEntry});
   const activeContent=make("div","investigation-active-content");
   activeHost.append(activeContent);

   const archiveCount=archivedOwn.length+archivedRelated.length;
   const archiveShell=target.archiveHistoryDisclosure;
   const disclosure=compact?make("details","investigation-collapse"):make("section","investigation-archive-records");
   if(compact){
    disclosure.open=openSections.has(sectionKey);
    disclosure.classList.toggle("is-empty",archiveCount===0);
    const summary=make("summary","investigation-collapse-heading");
    const actions=make("div","investigation-heading-actions");
    actions.append(make("h4","",sectionTitle),
     window.BSDialogs.tooltip("About Project Archive","Entries archived from this Work Instruction."),
     make("span","workspace-record-count","("+archiveCount+(archiveCount===1?" record)":" records)")));
    summary.append(actions);disclosure.append(summary);
    disclosure.addEventListener("toggle",()=>{
     if(disclosure.open)openSections.add(sectionKey);else openSections.delete(sectionKey);
    });
   }else if(archiveShell){
    const count=archiveShell.querySelector(".workspace-archive-count");
    const total=activeOwn.length+archiveCount;
    if(count)count.textContent="("+total+(total===1?" record)":" records)");
   }
   const content=make("div","investigation-collapse-content");
   // Part snapshots have their own Revisions section; step archives stay local.
   disclosure.append(content);
   target.append(disclosure);

   const renderCard=(record,destination,{historical=false,inherited=false}={})=>{
    const card=make("details","investigation-card bs-content-card");
    if(categoryOf(record)==="photos")card.classList.add("investigation-photos-entry");
    if(record.parentRecordId)card.classList.add("investigation-nested-card");
    card.dataset.recordId=record.id;
    if(compact&&!historical&&!inherited&&!record.parentRecordId)card.dataset.workTile="record:"+record.id;
    const openKey=context.ownerType+":"+context.ownerId+":"+(context.stepId||"")+":"+(historical?"history:":"")+record.id;
    card.open=openCards.has(openKey);
    card.addEventListener("toggle",()=>{if(card.open)openCards.add(openKey);else openCards.delete(openKey)});
    const title=make("summary","investigation-summary bs-content-card-heading");
    const heading=make("span","investigation-title-actions");
    const displayTitle=record.title?.trim();
    if(displayTitle)heading.append(make("strong","",displayTitle));
    title.append(heading);
    // An untitled Notes entry is identified by its type, without repeating
    // a placeholder heading such as "Untitled".
    title.append(make("span","small muted",categories[categoryOf(record)]?.label||"Entry"));
    // Record dates are secondary metadata: show them at the end of expanded
    // content instead of crowding the common header/chevron layout.
    card.append(title);
    const body=make("div","investigation-body bs-content-card-body");
    const children=own.filter(child=>child.parentRecordId===record.id);
    const isChild=Boolean(record.parentRecordId);
    if(inherited){
     const source=record.scope==="step"?"Work instruction":record.ownerType==="part"?"Part":"Assembly";
     body.append(make("p","investigation-origin","From "+source+" · "+record.title));
    }
    if(record.ownerType==="part"&&Object.hasOwn(record,"implementationId")){
     const latest=(getPartList?.()||[]).find(part=>part.id===record.ownerId)||
      (getPart?.()?.id===record.ownerId?getPart():null);
     const changed=latest&&latest.selectedImplementationId!==record.implementationId;
     const context=make("p","investigation-implementation-context",
      "Recorded with: "+(record.implementationName||"No implementation selected")+
      (changed?" · Different implementation selected now":""));
     body.append(context);
    }
    let editing=false;
    const edit=btn("Edit",event=>{
     event.preventDefault();event.stopPropagation();card.open=true;editing=true;draw();
    },"btn investigation-rename");
    const editActions=make("span","investigation-title-controls");
    const archive=btn("Archive",event=>{
     event.preventDefault();event.stopPropagation();archiveRecord(record);
    },"btn investigation-archive-button");
    if(allowEntryEditing&&!inherited){
     if(historical){
      const removeHistory=btn("Delete archived entry",async event=>{
       event.preventDefault();event.stopPropagation();
       if(!await window.BSDialogs.danger('Delete archived entry "'+record.title+'"? This permanently removes the historical record.',{
        title:"Delete archived entry?",confirmLabel:"Delete archived entry"
       }))return;
       removeHistory.disabled=true;
       try{await save({action:"deleteRecord",id:record.id})}
       catch(error){removeHistory.disabled=false;report(error.message,target)}
      },"btn investigation-history-delete");
      removeHistory.title="Delete this archived entry";
      editActions.append(removeHistory);
     }else editActions.append(edit);
     title.append(editActions);
    }
    const draw=()=>{
     body.replaceChildren();
     if(historical&&record.archiveNote?.trim())
      body.append(make("p","investigation-archive-reason","Reason: "+record.archiveNote));
     edit.hidden=editing||historical;
     archive.hidden=true;
     attach(record,body,target,editing,()=>{editing=false;draw()},false,
      null);
     // Nested records sit below their parent entry and may use any existing
     // type (Notes, Tests/Measurements, Revisions, Failures).
     if(!isChild&&!inherited){
      const childSection=make("section","investigation-nested-section");
      childSection.dataset.parentRecordId=record.id;
      for(const child of children.filter(item=>!isArchived(item)))
       renderCard(child,childSection,{nested:true});
      const archivedChildren=children.filter(isArchived);
      if(archivedChildren.length){
       const archiveChildren=make("details","investigation-nested-archive");
       archiveChildren.append(make("summary","","Archived nested entries ("+archivedChildren.length+")"));
       const archiveContent=make("div","investigation-nested-archive-content");
       for(const child of archivedChildren)renderCard(child,archiveContent,{historical:true,nested:true});
       archiveChildren.append(archiveContent);childSection.append(archiveChildren);
      }
      if(canCreate&&context.stepId&&!historical){
       const addNested=btn("+ Add nested entry",event=>{
        event.preventDefault();event.stopPropagation();
        card.open=true;
        newRecord(context,target,record.id);
       },"btn investigation-add-nested");
       childSection.append(addNested);
      }
      if(childSection.childElementCount)body.append(childSection);
     }
     if(!editing&&!inherited&&admin()&&["test","revision","failure"].includes(categoryOf(record))){
      // Never publish automatically. Prefill a draft and let the author
      // explain why this particular result belongs in the project narrative.
      const milestone=btn("Add to Project Milestones",event=>{
       event.preventDefault();event.stopPropagation();
       const preferred=categoryOf(record)==="test"?["result","attempt"]:
        categoryOf(record)==="revision"?["revision","result"]:["observation","resolution"];
       const details=(record.entries||[]).filter(entry=>preferred.includes(entry.type)&&entry.text?.trim());
       const text=details.length?details[details.length-1].text.trim():record.title||"";
       window.BSProjectMilestones?.offer(project,{
        kind:"investigation",id:record.id,
        title:(categories[categoryOf(record)]?.label||"Entry")+(record.title?" · "+record.title:""),
        prefill:text
       });
      },"btn investigation-milestone-button");
      milestone.title="Draft a deliberate milestone; no record is added unless you save it.";
      body.append(milestone);
     }
     if(!editing){
      // Show a single, unobtrusive timestamp at the very end of the tile.
      const savedAt=historical?record.archivedAt||record.partSnapshot?.archivedAt:
       record.createdAt||record.date;
      if(savedAt){
       const timestamp=make("time","investigation-record-date investigation-record-footer-date",
        (historical?"Archived ":"Created ")+formatTimestamp(savedAt));
       timestamp.dateTime=savedAt;body.append(timestamp);
      }
     }
     if(card.open)showAttachmentNames(body);
    };
    card.addEventListener("toggle",()=>{if(card.open)showAttachmentNames(body)});
    draw();card.append(body);destination.append(card);
   };

   if(compact&&stepSlot?.mainTile){
    stepSlot.mainTile.dataset.workTile="main";
    activeContent.append(stepSlot.mainTile);
   }
   activeOwn.forEach(record=>renderCard(record,activeContent));
   if(compact&&stepSlot){
    const getTiles=()=>[...activeContent.children].filter(node=>node.dataset.workTile);
    const savedOrder=Array.isArray(stepSlot.step?.tileOrder)?stepSlot.step.tileOrder:[];
    const rank=key=>{const position=savedOrder.indexOf(key);return position<0?100000:position};
    const initial=getTiles().map((node,index)=>({node,index}));
    initial.sort((a,b)=>rank(a.node.dataset.workTile)-rank(b.node.dataset.workTile)||a.index-b.index);
    for(const {node} of initial)activeContent.append(node);
    const updateOrder=()=>stepSlot.onReorder?.(getTiles().map(node=>node.dataset.workTile));
    const moveTile=(tile,other,after)=>{
     if(!tile||!other||tile===other)return;
     activeContent.insertBefore(tile,after?other.nextSibling:other);
     updateOrder();
    };
    const resetDrag=()=>getTiles().forEach(tile=>tile.classList.remove("bs-tile-dragging","bs-tile-drop-before","bs-tile-drop-after"));
    for(const tile of getTiles()){
     const header=tile.querySelector(":scope > summary");
     if(!header)continue;
     if(!admin())continue;
     const grip=make("button","bs-tile-grip");
     grip.type="button";grip.draggable=admin();
     grip.title="Drag to reorder tiles. Alt+Up/Down also moves this tile.";
     grip.setAttribute("aria-label","Move this tile up or down");
     grip.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" width="17" height="17" fill="currentColor"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>';
     grip.addEventListener("click",event=>{event.preventDefault();event.stopPropagation()});
     grip.addEventListener("keydown",event=>{
      if(!event.altKey||!["ArrowUp","ArrowDown"].includes(event.key))return;
      event.preventDefault();event.stopPropagation();
      const tiles=getTiles(),index=tiles.indexOf(tile);
      const other=tiles[index+(event.key==="ArrowUp"?-1:1)];
      if(other)moveTile(tile,other,event.key==="ArrowDown");
      grip.focus();
     });
     grip.addEventListener("dragstart",event=>{
      if(!admin()||!event.dataTransfer){event.preventDefault();return}
      event.stopPropagation();
      event.dataTransfer.setData("application/x-bs-work-tile",tile.dataset.workTile);
      event.dataTransfer.effectAllowed="move";
      tile.classList.add("bs-tile-dragging");
     });
     grip.addEventListener("dragend",resetDrag);
     tile.addEventListener("dragover",event=>{
      if(!event.dataTransfer?.types.includes("application/x-bs-work-tile"))return;
      event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect="move";
      const after=event.clientY>tile.getBoundingClientRect().top+tile.offsetHeight/2;
      tile.classList.toggle("bs-tile-drop-before",!after);
      tile.classList.toggle("bs-tile-drop-after",after);
     });
     tile.addEventListener("dragleave",event=>{
      if(!tile.contains(event.relatedTarget))tile.classList.remove("bs-tile-drop-before","bs-tile-drop-after");
     });
     tile.addEventListener("drop",event=>{
      if(!event.dataTransfer?.types.includes("application/x-bs-work-tile"))return;
      event.preventDefault();event.stopPropagation();
      const id=event.dataTransfer.getData("application/x-bs-work-tile");
      const source=getTiles().find(item=>item.dataset.workTile===id);
      const after=event.clientY>tile.getBoundingClientRect().top+tile.offsetHeight/2;
      resetDrag();moveTile(source,tile,after);
     });
     header.prepend(grip);
    }
   }
   // An empty active section adds no value in read mode. The chevrons
   // on actual entries and Project Archive already communicate structure.
   activeContent.append(make("p","investigation-feedback muted"));
   // The shared action row precedes records, including in step Edit mode. Avoid
   // displaying a blank active-entry wrapper when there are no cards yet.
   activeHost.hidden=!activeOwn.length&&!stepSlot?.mainTile&&!activeHost.querySelector("button");

   archivedOwn.forEach(record=>renderCard(record,content,{historical:true}));
   if(archivedRelated.length){
    const group=make("details","investigation-rollup");
    group.append(make("summary","","Archived records in child parts, assemblies and steps ("+archivedRelated.length+")"));
    const inner=make("div","investigation-rollup-body");
    archivedRelated.forEach(record=>renderCard(record,inner,{historical:true,inherited:true}));
    group.append(inner);content.append(group);
   }
   if(!archiveCount&&compact)content.append(make("p","muted investigation-empty","No archived records yet."));
   if(!compact&&!archiveCount)disclosure.hidden=true;
   if(!compact)target.hidden=!archiveCount;
   if(context.ownerType==="part"&&!context.stepId)revisions.render({part:getPart(),getSource:()=>({partRevision:getPart()?.revision??null,workspaceRevision:getWorkspaceRevision()??null}),records:own.filter(record=>record.partSnapshot),save});
  }

  function renameRecord(record,target){
   const box=make("div","investigation-create");
   const input=make("input","field");input.value=record.title;input.maxLength=180;
   const saveBtn=btn("Save name",async()=>{
    if(!input.value.trim()){input.focus();return}
    saveBtn.disabled=true;
    try{await save({action:"rename",id:record.id,title:input.value.trim()});report("Name updated.",target)}
    catch(error){report(error.message,target);saveBtn.disabled=false}
   },"btn primary");
   box.append(input,saveBtn,btn("Cancel",()=>box.remove(),"btn"));
   target.querySelector(".investigation-heading")?.after(box);input.focus();input.select();
  }
  function newRecord(context,target,parentRecordId=""){
   const activeContent=target.activeEntriesHost?.querySelector(".investigation-active-content")||target.querySelector(".investigation-active-content");
   const content=parentRecordId
    ?[...target.querySelectorAll(".investigation-nested-section")].find(section=>section.dataset.parentRecordId===parentRecordId)
    :activeContent;
   if(!content)return;
   const activeHost=target.activeEntriesHost||activeContent?.closest(".investigation-active-area");
   if(!parentRecordId&&activeHost)activeHost.hidden=false;
   // One unfinished form per destination, to avoid duplicate draft entries.
   const existing=[...content.children].find(child=>child.classList.contains("investigation-new-record"));
   if(existing){existing.querySelector("select")?.focus();return;}
   const form=make("div","investigation-create investigation-new-record");
   const label=make("label","investigation-record-title","Entry type");
   const select=make("select","field");
   const prompt=make("option","","Choose an entry type");prompt.value="";prompt.disabled=true;prompt.selected=true;
   select.append(prompt);
   for(const [value,category] of Object.entries(categories)){
    const option=make("option","",category.label);option.value=value;select.append(option);
   }
   const fields=make("div","investigation-new-fields");fields.hidden=true;
   label.append(select);
   const cancel=btn("Cancel",()=>{
    form.remove();
    if(!parentRecordId&&context.stepId&&activeHost&&!content.querySelector(".investigation-card"))activeHost.hidden=!activeHost.querySelector("button");
   });
   form.append(label,cancel,fields);
   content.append(form);
   // A new record opens after its existing siblings, not above them.
   requestAnimationFrame(()=>form.scrollIntoView({block:"nearest",behavior:"smooth"}));
   select.onchange=()=>{
    fields.replaceChildren();
    fields.hidden=false;cancel.hidden=true;
    attach({...context,parentRecordId,category:select.value,title:"",entries:[]},fields,target,true,()=>form.remove(),true);
   };
   select.focus();
  }
  function renderAll(){
   if(assemblySlot)render(assemblySlot.target,assemblySlot.context);
   if(partSlot)render(partSlot.target,partSlot.context);
   for(const {target,context} of stepSlots.values())if(target.isConnected)render(target,context,true);
  }
  function showAssembly(target,id){
   assemblySlot={target,context:makeContext("assembly",id??"__root__")};
   partSlot=null;stepSlots.clear();renderAll();void load();
  }
  function showPart(target,id){
   partSlot={target,context:makeContext("part",id)};
   assemblySlot=null;stepSlots.clear();renderAll();void load();
  }
  function resetStepDisclosures(stepId,ownerType,ownerId){
   if(!stepId||!ownerType||!ownerId)return;
   const prefix=ownerType+":"+ownerId+":"+stepId;
   openSections.delete(prefix);
   for(const key of [...openCards]){
    if(key.startsWith(prefix+":"))openCards.delete(key);
   }
   // An individual entry can be reopened without reopening the archive.
   const slot=stepSlots.get(stepId);
   if(slot?.target?.isConnected){
    slot.target.querySelectorAll("details.investigation-card,details.investigation-rollup,details.investigation-collapse").forEach(item=>{item.open=false});
   }
  }
  async function saveStepEdits(stepId){
   const slot=stepSlots.get(stepId);
   if(!slot?.editing)return;
   if(slot.target.querySelector(".investigation-new-record"))
    throw Error("Save or cancel the new entry before saving this step.");
   // Keep the forms mounted during the sequence: each API write updates the
   // revision token, but only re-render once all existing entries are saved.
   for(const commit of slot.pendingEdits||[])await commit();
   if(slot.pendingEdits?.length)renderAll();
  }
  function showStep(target,step,ownerType,ownerId,editing=false,mainTile=null,onReorder=null){
   if(!target||!step?.id||!ownerId)return;
   const context=makeContext(ownerType,ownerId,step.id);
   stepSlots.set(step.id,{target,context,editing,mainTile,onReorder,step});render(target,context,true);
  }
  // Knowledge links preserve the exact record ID. Reuse the existing record
  // renderer in a read-only standard dialog; do not duplicate editor fields or
  // require the owning part/assembly to still exist to read a saved record.
  let linkedDialog=null;
  async function showLinkedRecord(){
   const url=new URL(location.href),id=url.searchParams.get("record");
   if(!id||url.hash.slice(1).split("/")[0]!==project){linkedDialog?.close();return;}
   if(linkedDialog?.dataset.recordId===id)return;
   linkedDialog?.close();
   const dialog=make("dialog","bs-dialog linked-record-dialog");linkedDialog=dialog;dialog.dataset.recordId=id;
   const heading=make("h2","","Project record");heading.id="linked-record-title-"+project;
   dialog.setAttribute("aria-labelledby",heading.id);
   const body=make("div","linked-record-body","Loading record…");body.setAttribute("role","status");
   const actions=make("div","bs-dialog-actions");
   actions.append(window.BSUI.button("Close",()=>dialog.close()));dialog.append(heading,body,actions);
   dialog.addEventListener("close",()=>{
    if(linkedDialog===dialog)linkedDialog=null;
    const current=new URL(location.href);
    if(current.searchParams.get("record")===id&&current.hash.slice(1).split("/")[0]===project){
     current.searchParams.delete("record");history.replaceState(null,"",current);
    }
    dialog.remove();
   },{once:true});
   document.body.append(dialog);dialog.showModal();
   try{
    const response=await fetch(api,{credentials:"same-origin",cache:"no-store"});
    const data=await response.json();if(!response.ok)throw Error(data.error||"Unable to load this record.");
    if(!dialog.isConnected)return;
    const saved=Array.isArray(data.records)?data.records:[],record=saved.find(entry=>entry.id===id);
    body.replaceChildren();
    if(!record){heading.textContent="Record unavailable";body.textContent="This record no longer exists. Its Knowledge link keeps the last known name.";return;}
    heading.textContent=record.title||"Untitled record";
    body.append(make("p","muted",record.partSnapshot?"Part revision":(categories[categoryOf(record)]?.label||"Entry")+(isArchived(record)?" · Archived":"")));
    const appendRecord=(entry,container)=>{
     if(entry.partSnapshot)renderSnapshot(entry.partSnapshot,container,entry.id);
     if(entry.archiveNote?.trim())container.append(make("p","",(entry.partSnapshot?"Reason: ":"Archive reason: ")+entry.archiveNote));
     attach(entry,container,null,false);
     const timestamp=entry.archivedAt||entry.createdAt||entry.date;
     if(timestamp){const label=make("time","investigation-record-date",(entry.partSnapshot?"Revision created ":isArchived(entry)?"Archived ":"Created ")+formatTimestamp(timestamp));label.dateTime=timestamp;container.append(label);}
    };
    appendRecord(record,body);
    for(const child of saved.filter(entry=>entry.parentRecordId===record.id)){
     const section=make("section","bs-content-card");section.append(make("h3","",child.title||categories[categoryOf(child)]?.label||"Entry"));
     appendRecord(child,section);body.append(section);
    }
    showAttachmentNames(body);
   }catch(error){if(dialog.isConnected){heading.textContent="Record unavailable";body.textContent=error.message;}}
  }
  window.addEventListener("hashchange",()=>void showLinkedRecord());
  void showLinkedRecord();
  return {showAssembly,showPart,showStep,saveStepEdits,resetStepDisclosures,load};
 }
 window.BSInvestigations={mount};
})();
