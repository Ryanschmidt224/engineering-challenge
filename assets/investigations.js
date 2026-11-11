/* Shared failure and lessons component, used at project, assembly, part, and step levels. */
(function(){
 "use strict";
 const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el};
 const btn=(label,fn,cls="btn")=>{const b=make("button",cls,label);b.type="button";b.onclick=fn;return b};
 const types=[["observation","What happened?"],["theory","What do you think caused it?"],["note","Additional notes"]]; 
 const legacyType={attempt:"Attempt / change",theory:"Hypothesis",lesson:"How was it fixed?",revision:"Revision / design change",result:"Result"};
 const statuses=[["investigating","Investigating"],["resolved","Resolved"],["unresolved","Unresolved"]];
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
  const openSections=new Set();
  const api="/api/investigations?project="+encodeURIComponent(project);
  const feedback=target=>(target||activeContext?.target)?.querySelector(".investigation-feedback");
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
  function attach(record,container,target,editing=false,onDone=()=>{}){
   const reportHere=message=>report(message,target);
   const entryList=make("div","investigation-entries");
   for(const entry of record.entries||[]){
    const item=make("article","investigation-entry");
    const label=entry.type==="resolution"?("Did you fix it? "+({yes:"Yes — How?",no:"No — Why?",maybe:"Maybe — How?"})[entry.resolution]):types.find(x=>x[0]===entry.type)?.[1]||legacyType[entry.type]||"Update";
    const stamp=entry.date||entry.createdAt?.slice(0,10)||"";
    const labelRow=make("div","investigation-entry-heading");
    labelRow.append(make("strong","",label));
    if(stamp)labelRow.append(make("time","investigation-entry-date",stamp));
    item.append(labelRow);if(entry.text)item.append(make("p","",entry.text));
    for(const file of entry.files||[]){
     if(photoExt.test(file)){
      const img=make("img","investigation-image");img.src=fileUrl(file);img.loading="lazy";img.alt=entry.fileName||"Investigation evidence";item.append(img);
     }else{
      const link=make("a","investigation-file",entry.fileName||"View attached evidence");
      link.href=fileUrl(file);link.target="_blank";link.rel="noopener noreferrer";item.append(link);
     }
    }
    entryList.append(item);
   }
   if(!editing){if(entryList.childElementCount)container.append(entryList);return;}
   if(!admin())return;
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
   const descriptions={observation:"Describe what happened or failed.",theory:"Describe your suspected cause or explanation.",note:"Other relevant details, measurements, or notes."};
   function fieldRow(type,label,placeholder){
    const wrap=make("div","investigation-entry-field");
    const caption=make("label","investigation-field-label");
    const descriptor=make("span","investigation-field-descriptor",label);
    const field=make("textarea","field");field.rows=2;field.maxLength=5000;
    field.placeholder=placeholder;field.value=latest.get(type)?.text||"";caption.append(descriptor,field);
    const fileInput=make("input");fileInput.type="file";fileInput.multiple=true;fileInput.hidden=true;
    fileInput.accept=".jpg,.jpeg,.png,.webp,.gif,.heic,.heif,.pdf,.dwg,.dxf,.stp,.step,.stl,.txt,.csv,.doc,.docx,.xls,.xlsx,.zip";
    const fileChoice=make("span","investigation-file-label");
    fileInput.onchange=()=>{fileChoice.textContent=[...fileInput.files].map(x=>x.name).join(", ")};
    const attachments=make("div","investigation-field-attachments");
    attachments.append(btn("+ Add photo / document",()=>fileInput.click(),"investigation-attachment-link"),fileInput,fileChoice);
    const existingFiles=[...(latest.get(type)?.files||[])];
    const existingList=make("div","investigation-existing-files");
    function drawFiles(){
     existingList.replaceChildren();
     for(const file of existingFiles){
      const row=make("div","investigation-existing-file");
      const link=make("a","investigation-file",latest.get(type)?.fileName||"Existing attachment");
      link.href=fileUrl(file);link.target="_blank";link.rel="noopener noreferrer";
      if(photoExt.test(file)){const img=make("img","investigation-edit-thumbnail");img.src=fileUrl(file);img.alt="Attached photo";link.replaceChildren(img)}
      row.append(link,btn("Remove",()=>{existingFiles.splice(existingFiles.indexOf(file),1);drawFiles()},"investigation-attachment-link"));
      existingList.append(row);
     }
    }
    drawFiles();
    wrap.append(caption,attachments,existingList);controls.append(wrap);
    return {type,field,fileInput,wrap,descriptor,existingFiles};
   }
   const inputs=types.map(([type,label])=>fieldRow(type,label,descriptions[type]));
   const fixedRow=make("label","investigation-fixed-row");
   fixedRow.append(make("span","","Did you fix it?"));
   const fixed=make("select","field investigation-fixed-select");
   for(const [value,label] of [["","Select"],["yes","Yes"],["no","No"],["maybe","Maybe"]]){
    const option=make("option","",label);option.value=value;fixed.append(option);
   }
   fixedRow.append(fixed);controls.append(fixedRow);
   const resolution=fieldRow("resolution","How?","Describe the fix and how you verified it.");
   resolution.wrap.hidden=true;
   let previousResolution=latest.get("resolution")?.resolution||"";
   fixed.onchange=()=>{
    const nextResolution=fixed.value;
    const previousGroup=previousResolution==="no"?"why":(["yes","maybe"].includes(previousResolution)?"how":"");
    const nextGroup=nextResolution==="no"?"why":(["yes","maybe"].includes(nextResolution)?"how":"");
    if(previousGroup&&nextGroup&&previousGroup!==nextGroup)resolution.field.value="";
    if(nextGroup)previousResolution=nextResolution;
    resolution.wrap.hidden=!fixed.value;
    resolution.descriptor.textContent=fixed.value==="no"?"Why?":"How?";
    resolution.field.placeholder=fixed.value==="no"?"Explain why the problem remains unresolved.":"Describe what you changed and what happened.";
   };
   // Keep the cause directly after the observation, followed by the resolution.
   controls.insertBefore(fixedRow,inputs[2].wrap);
   controls.insertBefore(resolution.wrap,inputs[2].wrap);
   inputs.splice(2,0,resolution);
   fixed.value=latest.get("resolution")?.resolution||"";fixed.onchange();
   const saveBtn=btn("Save",async()=>{
    const fields=inputs.filter(item=>item.type==="resolution"?!!fixed.value:!!(item.field.value.trim()||item.fileInput.files.length||item.existingFiles.length));
    if(!titleInput.value.trim()){titleInput.focus();return}
    if(!date.value){reportHere("Choose a date.");date.focus();return}
    saveBtn.disabled=true;
    try{
     const entries=[];
     for(const {type,field,fileInput,existingFiles} of fields){
      const selected=[...fileInput.files];
      if(selected.length+existingFiles.length>12)throw Error("Attach no more than 12 files to each field.");
      const files=[...existingFiles];
      for(const file of selected){
       if(file.size>20*1024*1024)throw Error("An attachment exceeds 20 MB.");
       const up=await fetch("/api/recipe-files?project="+encodeURIComponent(project),{method:"POST",
        credentials:"same-origin",headers:{"content-type":"application/octet-stream","x-file-name":encodeURIComponent(file.name)},body:file});
       const data=await up.json();if(!up.ok)throw Error(data.error||"Attachment failed");
       files.push(data.id);
      }
      entries.push({type,text:field.value,date:date.value,files,fileName:selected[0]?.name.slice(0,120)||latest.get(type)?.fileName||"",...(type==="resolution"?{resolution:fixed.value}:{})});
     }
     await save({action:"editRecord",id:record.id,title:titleInput.value.trim(),date:date.value,entries});
     onDone();reportHere("Record saved.");
    }catch(error){reportHere(error.message);saveBtn.disabled=false}
   },"btn primary");
   const actions=make("div","investigation-edit-actions");
   const deleteBtn=btn("Delete revision",async()=>{
    if(!confirm('Delete "'+record.title+'"? This removes the revision record and its notes from the project.'))return;
    deleteBtn.disabled=true;saveBtn.disabled=true;
    try{await save({action:"deleteRecord",id:record.id});reportHere("Revision deleted.")}
    catch(error){reportHere(error.message);deleteBtn.disabled=false;saveBtn.disabled=false}
   },"btn investigation-delete");
   actions.append(saveBtn,btn("Cancel",onDone),deleteBtn);controls.append(actions);
   container.append(controls);
  }
  function render(target,context,compact=false){
   if(!target)return;
   const sectionKey=context.ownerType+":"+context.ownerId+":"+(context.stepId||"");
   const existing=target.querySelector(".investigation-collapse");
   if(existing){if(existing.open)openSections.add(sectionKey);else openSections.delete(sectionKey)}
   target.replaceChildren();
   activeContext={...context,target};
   const disclosure=make("details","investigation-collapse");
   disclosure.open=openSections.has(sectionKey);
   const summary=make("summary","investigation-collapse-heading");
   const title=make(compact?"h4":"h2","",compact?"Revisions & lessons":"Revisions, Failures & Lessons Learned");
   const toggleLabel=make("span","investigation-toggle-label",disclosure.open?(compact?"Hide":"Minimize details"):(compact?"Show":"Show details"));
   summary.append(title,toggleLabel);
   disclosure.append(summary);
   disclosure.addEventListener("toggle",()=>{
    toggleLabel.textContent=disclosure.open?(compact?"Hide":"Minimize details"):(compact?"Show":"Show details");
    if(disclosure.open)openSections.add(sectionKey);else openSections.delete(sectionKey);
   });
   const content=make("div","investigation-collapse-content");
   const header=make("div","investigation-heading");
   if(admin()){
    header.append(btn("+ Add record",()=>newRecord(context,target),"btn investigation-add"));
    if(context.ownerType==="part"&&!context.stepId&&typeof getPart==="function"&&getPart()?.id===context.ownerId&&
     typeof onReplacePart==="function")header.append(btn("Replace part / save revision",()=>replacePart(context,target),"btn investigation-add"));
   }
   disclosure.append(content);
   target.append(disclosure);
   const own=records.filter(item=>owns(item,context));
   const rolled=records.filter(item=>within(item,context)&&!owns(item,context));
   const renderRecord=(record,inherited=false)=>{
    const card=make("details","investigation-card");
    card.dataset.recordId=record.id;
    const openKey=context.ownerType+":"+context.ownerId+":"+(context.stepId||"")+":"+record.id;
    card.open=openCards.has(openKey);
    card.addEventListener("toggle",()=>{if(card.open)openCards.add(openKey);else openCards.delete(openKey)});
    const summary=make("summary","investigation-summary");
    summary.append(make("strong","",record.title));
    summary.append(dateLabelFor(record));
    card.append(summary);
    const body=make("div","investigation-body");
    if(inherited){
     const source=record.scope==="step"?"Step":record.ownerType==="part"?"Part":"Assembly";
     body.append(make("p","investigation-origin","From "+source+" · "+record.title));
    }
    let editing=false;
    const edit=btn("Edit",event=>{
     event.preventDefault();event.stopPropagation();card.open=true;editing=true;draw();
    },"btn investigation-rename");
    if(admin()){summary.append(edit);edit.addEventListener("click",event=>{event.preventDefault();event.stopPropagation()})}
    const draw=()=>{
     body.replaceChildren();
     if(record.partSnapshot)showSnapshot(record.partSnapshot,body);
     edit.hidden=editing;
     attach(record,body,target,editing,()=>{editing=false;draw()});
    };
    draw();card.append(body);content.append(card);
   };
   own.forEach(item=>renderRecord(item));
   if(header.childElementCount)content.append(header);
   if(rolled.length){
    const group=make("details","investigation-rollup");
    const summary=make("summary","", "Related failures in child parts, assemblies and steps ("+rolled.length+")");
    group.append(summary);
    const inner=make("div","investigation-rollup-body");
    for(const record of rolled){
     const wrapper=make("div","investigation-inherited");
     const card=make("details","investigation-card");
     const openKey=context.ownerType+":"+context.ownerId+":related:"+record.id;
     card.open=openCards.has(openKey);
     card.addEventListener("toggle",()=>{if(card.open)openCards.add(openKey);else openCards.delete(openKey)});
     const title=make("summary","investigation-summary");
     title.append(make("strong","",record.title),dateLabelFor(record));
     card.append(title);
     const body=make("div","investigation-body");
     const sourceName=record.ownerType==="part"?
      (getPartList().find(item=>item.id===record.ownerId)?.name||"Part"):
      record.ownerId==="__root__"?"Project":(getTree().find(item=>item.id===record.ownerId)?.name||"Assembly");
     const origin=make("a","investigation-origin",sourceName+(record.scope==="step"?" · Work instruction":""));
     origin.href="#"+project+(record.ownerType==="part"?"/part/":"/workspace/")+encodeURIComponent(record.ownerId);
     body.append(origin);
     attach(record,body,target);card.append(body);wrapper.append(card);inner.append(wrapper);
    }
    group.append(inner);content.append(group);
   }
   if(!own.length&&!rolled.length)content.append(make("p","muted investigation-empty","No failures recorded yet."));
   content.append(make("p","investigation-feedback muted"));
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
   target.querySelector(".investigation-heading")?.after(form);
   field.focus();
  }
  function newRecord(context,target){
   const heading=target.querySelector(".investigation-heading");
   if(!heading)return;
   const existing=target.querySelector(".investigation-new-record");
   if(existing){existing.querySelector("input")?.focus();return;}
   const reportHere=message=>report(message,target);
   const form=make("div","investigation-create investigation-new-record");
   const name=make("input","field");name.placeholder="Enter a short, descriptive title";name.maxLength=180;
   const saveBtn=btn("Save",async()=>{
    if(!name.value.trim()){name.focus();return}
    saveBtn.disabled=true;
    try{
     const previousIds=new Set(records.map(record=>record.id));
     const result=await save({action:"create",...context,title:name.value.trim()});
     const created=result.records.find(record=>!previousIds.has(record.id)&&localRecord(record,context)&&record.title===name.value.trim());
     if(created){
      const card=[...target.querySelectorAll(".investigation-card[data-record-id]")].find(item=>item.dataset.recordId===created.id);
      if(card){
       card.open=true;
       openCards.add(context.ownerType+":"+context.ownerId+":"+(context.stepId||"")+":"+created.id);
       card.querySelector(".investigation-rename")?.click();
       card.querySelector(".investigation-add-controls textarea")?.focus();
      }
     }
     window.BSTransient?.show(feedback(target),"Record saved.");
    }
    catch(error){reportHere(error.message);saveBtn.disabled=false}
   },"btn primary");
   const cancel=btn("Cancel",()=>form.remove(),"btn");
   const titleLabel=make("label","investigation-record-title");titleLabel.append(make("span","investigation-field-descriptor","Title"),name);
   form.append(titleLabel,saveBtn,cancel);
   heading.before(form);
   name.focus();
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
  function showStep(target,step,ownerType,ownerId){
   if(!target||!step?.id||!ownerId)return;
   const context=makeContext(ownerType,ownerId,step.id);
   stepSlots.set(step.id,{target,context});render(target,context,true);
  }
  return {showAssembly,showPart,showStep,load};
 }
 window.BSInvestigations={mount};
})();