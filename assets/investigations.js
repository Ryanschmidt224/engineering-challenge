/* Project, assembly, part, and work-instruction records. */
(function(){
 "use strict";
 const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el};
 const btn=(label,fn,cls="btn")=>{const b=make("button",cls,label);b.type="button";b.onclick=fn;return b};
 const types=[["observation","What happened?"],["theory","What do you think caused it?"],["note","Additional notes"]]; 
 const legacyType={attempt:"Attempt / change",theory:"Hypothesis",lesson:"How was it fixed?",revision:"Revision / design change",result:"Result"};
 const categories={
  note:{label:"Notes",fields:[]},
  test:{label:"Tests/Measurements",fields:[["theory","What did you want to verify?"],["attempt","How did you test it?"] ,["result","What happened?"]]},
  revision:{label:"Revisions",fields:[["revision","What changed?"],["theory","Why did you change it?"]]},
  failure:{label:"Failures",fields:[...types.slice(0,2),["resolution","Did you fix it?"]]},
  // Keep this legacy definition so previously saved Practice records remain readable/editable.
  practice:{label:"Practice (legacy)",fields:[["attempt","What did you practice?"]]}
 };
 const retiredLabels={practice:{lesson:"What did you learn?"},revision:{result:"What was the result?"},note:{note:"Notes"}};
 const categoryOf=record=>record.category||(record.partSnapshot?"revision":"failure");
 const sectionTitle="Project Archive";
 const acceptedAttachments=globalThis.BSAttachmentTypes.accept;
 const photoExt=/\.(jpg|jpeg|png|webp|gif|heic|heif)$/i;
 const fileUrl=id=>"/api/recipe-files?id="+encodeURIComponent(id);
 const recordDate=record=>record.date||[...(record.entries||[])].reverse().find(entry=>entry.date)?.date||record.createdAt?.slice(0,10)||"";
 function dateLabelFor(record){
  const value=recordDate(record);
  const label=make("time","investigation-record-date",value);
  if(value)label.dateTime=value;else label.hidden=true;
  return label;
 }
 function mount({project,admin,getTree,getPart,getPartList,onReplacePart}){
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
  const report=(message,target)=>{const p=feedback(target);if(p)p.textContent=message};
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
  async function save(change){
   if(!admin())throw Error("Sign in as administrator to save.");
   const r=await fetch(api,{method:"POST",credentials:"same-origin",
    headers:{"content-type":"application/json"},body:JSON.stringify({...change,expectedRevision:revision})});
   const d=await r.json();if(!r.ok)throw Error(d.error||"Save failed");
   records=d.records;revision=d.revision;renderAll();
   return d;
  }
  function attach(record,container,target,editing=false,onDone=()=>{},creating=false){
   const reportHere=message=>report(message,target);
   const category=categories[categoryOf(record)];
   const entryList=make("div","investigation-entries");
   for(const entry of [...(record.entries||[]),...(record.notes||[])]){
    const item=make("article","investigation-entry");
    const label=entry.descriptor||(entry.type==="resolution"?("Did you fix it? "+({yes:"Yes — How?",no:"No — Why?",maybe:"Maybe — How?"})[entry.resolution]):category.fields.find(x=>x[0]===entry.type)?.[1]||types.find(x=>x[0]===entry.type)?.[1]||legacyType[entry.type]||"Update");
    const stamp=entry.date||entry.createdAt?.slice(0,10)||"";
    const labelRow=make("div","investigation-entry-heading");
    labelRow.append(make("strong","",label));
    if(stamp)labelRow.append(make("time","investigation-entry-date",stamp));
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
   if(!editing){if(categoryOf(record)==="note"&&record.description?.trim())container.append(make("p","investigation-note-description",record.description));if(entryList.childElementCount)container.append(entryList);return;}
   if(!admin())return;
   const descriptionInput=categoryOf(record)==="note"?make("textarea","field investigation-description-input"):null;
   if(descriptionInput){descriptionInput.rows=3;descriptionInput.maxLength=5000;descriptionInput.value=record.description||"";descriptionInput.placeholder="Description (optional)"}
   const latest=new Map();for(const entry of record.entries||[])latest.set(entry.type,entry);

   const controls=make("div","investigation-add-controls");
   const nameRow=make("label","investigation-field-label");
   const titleInput=make("input","field");titleInput.value=record.title;titleInput.maxLength=180;
   nameRow.append(make("span","investigation-field-descriptor","Title"),titleInput);controls.append(nameRow);
   const dateLabel=make("label","investigation-date-field","Date");
   const date=make("input","field");date.type="date";
   const now=new Date();date.value=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10);
   date.value=record.date||[...(record.entries||[])].reverse().find(entry=>entry.date)?.date||date.value;
   dateLabel.append(date);controls.append(dateLabel);
   if(descriptionInput){const descriptionLabel=make("label","investigation-description-label","Description");descriptionLabel.append(descriptionInput);controls.append(descriptionLabel)}
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
    attachments.append(btn("+ Add attachments",()=>uploader.open(),"investigation-attachment-link"),fileChoice,uploader.panel);
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
   noteSection.append(noteList,add);controls.append(noteSection);
   for(const note of record.notes||[])addNote(note);
   add.disabled=notes.length>=30;
   const saveBtn=btn("Save",async()=>{
    const fields=inputs.filter(item=>item.type==="resolution"?!!fixed.value:!!(item.field.value.trim()||item.selected.length||item.existingFiles.length));
    if(!titleInput.value.trim()){titleInput.focus();return}
    if(!date.value){reportHere("Choose a date.");date.focus();return}
    const notesToSave=notes.filter(note=>note.name.value.trim()||note.field.value.trim()||note.selected.length||note.existingFiles.length);
    for(const note of notesToSave){
     if(!note.name.value.trim()){reportHere("Enter a descriptor for the note.");note.name.focus();return}
     if(!note.field.value.trim()){reportHere("Enter a description for the note.");note.field.focus();return}
    }
    saveBtn.disabled=true;
    try{
     const entries=[],savedNotes=[];
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
     const details={title:titleInput.value.trim(),date:date.value,entries,notes:savedNotes,...(descriptionInput?{description:descriptionInput.value}:{})};
     const result=await save(creating?{...record,...details,action:"create"}:{...details,action:"editRecord",id:record.id});
     if(creating){
      const card=[...target.querySelectorAll(".investigation-card[data-record-id]")].find(item=>item.dataset.recordId===result.createdId);
      if(card){
       card.open=true;
       openCards.add(record.ownerType+":"+record.ownerId+":"+(record.stepId||"")+":"+result.createdId);
      }
     }
     onDone();reportHere("Record saved.");
    }catch(error){reportHere(error.message);saveBtn.disabled=false}
   },"btn primary");
   const actions=make("div","investigation-edit-actions");
   actions.append(saveBtn,btn("Cancel",onDone));
   if(!creating)actions.append(btn("Delete",async()=>{
    const deleteBtn=actions.querySelector(".investigation-delete");
    if(!await window.BSDialogs.danger('Delete "'+record.title+'"? This removes the record from the project.',{title:"Delete record?"}))return;
    deleteBtn.disabled=true;saveBtn.disabled=true;
    try{await save({action:"deleteRecord",id:record.id});reportHere("Record deleted.")}
    catch(error){reportHere(error.message);deleteBtn.disabled=false;saveBtn.disabled=false}
   },"btn investigation-delete"));
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
   const existing=target.querySelector(".investigation-collapse");
   if(existing){if(existing.open)openSections.add(sectionKey);else openSections.delete(sectionKey)}
   const activeHost=target.activeEntriesHost||make("section","investigation-active-area");
   activeHost.classList.add("investigation-active-area");
   activeHost.replaceChildren();target.replaceChildren();
   if(!target.activeEntriesHost)target.append(activeHost);
   activeContext={...context,target};
   const own=records.filter(record=>owns(record,context));
   const activeOwn=own.filter(record=>!isArchived(record));
   const archivedOwn=own.filter(isArchived);
   const archivedRelated=records.filter(record=>within(record,context)&&!owns(record,context)&&isArchived(record));
   // A step has one edit-mode switch: its Work Instruction header.
   // Other workspace pages have no parent editor and retain their own controls.
   const allowEntryEditing=admin()&&(!compact||Boolean(stepSlots.get(context.stepId)?.editing));
   const activeHeader=make("div","investigation-active-heading");
   // The step editor has its own Edit mode. Other workspace sections have no
   // separate editing toggle, so retain their Add entry button.
   const canCreate=allowEntryEditing;
   if(canCreate)activeHeader.append(btn("+ Add entry",event=>{
    event.preventDefault();newRecord(context,target);
   },"btn investigation-add investigation-create-button"));
   if(canCreate)activeHost.append(activeHeader);
   const activeContent=make("div","investigation-active-content");
   activeHost.append(activeContent);

   const disclosure=make("details","investigation-collapse");
   disclosure.open=openSections.has(sectionKey);
   disclosure.classList.toggle("is-empty",archivedOwn.length+archivedRelated.length===0);
   const summary=make("summary","investigation-collapse-heading");
   const heading=make("div","investigation-heading-label");
   const actions=make("div","investigation-heading-actions");
   const archiveCount=archivedOwn.length+archivedRelated.length;
   actions.append(make(compact?"h4":"h2","",sectionTitle),
    window.BSDialogs.tooltip("About Project Archive","Entries archived from this section and its child parts and assemblies."),
    make("span","workspace-record-count","("+archiveCount+(archiveCount===1?" record)":" records)")));
   heading.append(actions);summary.append(heading);disclosure.append(summary);
   disclosure.addEventListener("toggle",()=>{
    if(disclosure.open)openSections.add(sectionKey);else openSections.delete(sectionKey);
   });
   const content=make("div","investigation-collapse-content");
   disclosure.append(content);target.append(disclosure);

   const renderCard=(record,destination,{historical=false,inherited=false}={})=>{
    const card=make("details","investigation-card bs-content-card");
    card.dataset.recordId=record.id;
    const openKey=context.ownerType+":"+context.ownerId+":"+(context.stepId||"")+":"+(historical?"history:":"")+record.id;
    card.open=openCards.has(openKey);
    card.addEventListener("toggle",()=>{if(card.open)openCards.add(openKey);else openCards.delete(openKey)});
    const title=make("summary","investigation-summary bs-content-card-heading");
    const heading=make("span","investigation-title-actions");
    heading.append(make("strong","",record.title));
    title.append(heading,make("span","small muted",categories[categoryOf(record)]?.label||"Entry"));
    if(historical){
     const stamp=archiveDate(record);
     if(stamp){const date=make("time","investigation-record-date","Archived "+stamp);date.dateTime=stamp;title.append(date)}else title.append(dateLabelFor(record));
    }else title.append(dateLabelFor(record));
    card.append(title);
    const body=make("div","investigation-body bs-content-card-body");
    if(inherited){
     const source=record.scope==="step"?"Work instruction":record.ownerType==="part"?"Part":"Assembly";
     body.append(make("p","investigation-origin","From "+source+" · "+record.title));
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
      const removeHistory=btn("Delete",async event=>{
       event.preventDefault();event.stopPropagation();
       if(!await window.BSDialogs.danger('Delete archived entry "'+record.title+'"? This permanently removes the record from Project Archive.',{
        title:"Delete history entry?",confirmLabel:"Delete"
       }))return;
       removeHistory.disabled=true;
       try{await save({action:"deleteRecord",id:record.id})}
       catch(error){removeHistory.disabled=false;report(error.message,target)}
      },"btn investigation-history-delete");
      removeHistory.title="Delete this archived history entry";
      editActions.append(removeHistory);
     }else editActions.append(edit,archive);
     title.append(editActions);
    }
    const draw=()=>{
     body.replaceChildren();
     if(record.partSnapshot)showSnapshot(record.partSnapshot,body);
     if(historical){
      const stamp=archiveDate(record);
      if(stamp)body.append(make("p","investigation-archive-meta","Archived on "+stamp));
      if(record.archiveNote?.trim())body.append(make("p","investigation-archive-reason","Reason: "+record.archiveNote));
     }
     edit.hidden=editing;
     archive.hidden=!editing;
     attach(record,body,target,editing,()=>{editing=false;draw()});
     if(card.open)showAttachmentNames(body);
    };
    card.addEventListener("toggle",()=>{if(card.open)showAttachmentNames(body)});
    draw();card.append(body);destination.append(card);
   };

   activeOwn.forEach(record=>renderCard(record,activeContent));
   // An empty active section adds no value in read mode. The chevrons
   // on actual entries and Project Archive already communicate structure.
   if(admin()&&context.ownerType==="part"&&!context.stepId&&getPart?.()?.id===context.ownerId&&typeof onReplacePart==="function"){
    activeContent.append(btn("Replace part / save revision",()=>replacePart(context,target),"btn investigation-add"));
   }
   activeContent.append(make("p","investigation-feedback muted"));
   activeHost.hidden=!activeOwn.length&&!canCreate&&!activeContent.querySelector("button");

   archivedOwn.forEach(record=>renderCard(record,content,{historical:true}));
   if(archivedRelated.length){
    const group=make("details","investigation-rollup");
    group.append(make("summary","","Archived records in child parts, assemblies and steps ("+archivedRelated.length+")"));
    const inner=make("div","investigation-rollup-body");
    archivedRelated.forEach(record=>renderCard(record,inner,{historical:true,inherited:true}));
    group.append(inner);content.append(group);
   }
   if(!archiveCount)content.append(make("p","muted investigation-empty","No archived records yet."));
  }

  function showSnapshot(snapshot,target){
   const details=make("details","investigation-snapshot");
   details.append(make("summary","","Archived part and tests (before replacement)"));
   const part=snapshot.part||{},workspace=snapshot.workspace||{};
   const content=make("div","investigation-snapshot-content");
   content.append(make("h4","",part.fullName||part.name||"Original component"));
   for(const key of ["manufacturer","model","supplier","asin","quantity","quantityUnit","historicalPurchasePrice"]){
    if(part[key]!==null&&part[key]!==undefined&&String(part[key]))content.append(make("p","",key.replace(/([A-Z])/g," $1")+": "+part[key]));
   }
   for(const spec of part.specifications||[])content.append(make("p","",spec.name+": "+spec.value));
   if(snapshot.thumbnailKey){
    const picture=make("img","investigation-image");
    picture.src="/api/investigations?project="+encodeURIComponent(project)+"&thumbnail="+encodeURIComponent(snapshot.thumbnailKey);
    picture.alt="Previous part photograph";picture.loading="lazy";content.append(picture);
   }
   const steps=workspace.recipe||[];
   if(steps.length){
    content.append(make("h4","","Archived work instructions and test notes"));
    for(const step of steps){
     const block=make("div","investigation-snapshot-step");
     block.append(make("strong","",step.title||"Step"));
     for(const note of [step.standard,step.detail,...(step.notes||[])])if(note)block.append(make("p","",note));
     for(const file of step.photos||[]){
      const link=make("a","investigation-file",step.photoNames?.[file]||"Saved instruction attachment");
      link.href=file.startsWith("recipe-files/")?fileUrl(file):"/api/photo?id="+encodeURIComponent(file);
      link.target="_blank";link.rel="noopener noreferrer";block.append(link);
     }
     content.append(block);
    }
   }
   for(const test of workspace.experiments||[])content.append(make("p","",test.text||""));
   details.append(content);target.append(details);
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
  function replacePart(context,target){
   const part=getPart();
   if(!part||part.id!==context.ownerId)return;
   const form=make("div","investigation-create investigation-replace");
   form.append(make("p","","Save the current part specifications, work instructions, tests and photograph as a historical revision before editing the replacement. This does not delete the original records."));
   const field=make("textarea","field");field.rows=2;field.placeholder="Why is this part being replaced? (e.g. 20 A ESC replaced by a smaller-rated ESC)";
   const date=make("input","field");date.type="date";
   const now=new Date();date.value=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10);
   const saveBtn=btn("Archive and edit replacement",async()=>{
    if(!field.value.trim()||!date.value){report("Enter a reason and date.",target);return}
    saveBtn.disabled=true;
    try{
     await save({action:"archivePart",partId:part.id,reason:field.value.trim(),date:date.value});
     report("Previous revision saved. Opening part editor.",target);
     onReplacePart(part);
    }catch(error){report(error.message,target);saveBtn.disabled=false}
   },"btn primary");
   form.append(field,date,saveBtn,btn("Cancel",()=>form.remove(),"btn"));
   (target.activeEntriesHost?.querySelector(".investigation-active-content")||target.querySelector(".investigation-active-content"))?.append(form);
   field.focus();
  }
  function newRecord(context,target){
   const content=target.activeEntriesHost?.querySelector(".investigation-active-content")||target.querySelector(".investigation-active-content");
   if(!content)return;
   const existing=content.querySelector(".investigation-new-record");
   if(existing){existing.querySelector("select")?.focus();return;}
   const form=make("div","investigation-create investigation-new-record");
   const label=make("label","investigation-record-title","Entry type");
   const select=make("select","field");
   const prompt=make("option","","Choose an entry type");prompt.value="";prompt.disabled=true;prompt.selected=true;
   select.append(prompt);
   for(const [value,category] of Object.entries(categories).filter(([value])=>value!=="practice")){
    const option=make("option","",category.label);option.value=value;select.append(option);
   }
   const fields=make("div","investigation-new-fields");fields.hidden=true;
   label.append(select);
   const cancel=btn("Cancel",()=>form.remove());
   form.append(label,cancel,fields);
   content.prepend(form);
   select.onchange=()=>{
    fields.replaceChildren();
    fields.hidden=false;cancel.hidden=true;
    attach({...context,category:select.value,title:"",entries:[]},fields,target,true,()=>form.remove(),true);
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
  function showStep(target,step,ownerType,ownerId,editing=false){
   if(!target||!step?.id||!ownerId)return;
   const context=makeContext(ownerType,ownerId,step.id);
   stepSlots.set(step.id,{target,context,editing});render(target,context,true);
  }
  return {showAssembly,showPart,showStep,resetStepDisclosures,load};
 }
 window.BSInvestigations={mount};
})();
