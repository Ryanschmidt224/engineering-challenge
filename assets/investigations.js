/* Shared failure and lessons component, used at project, assembly, part, and step levels. */
(function(){
 "use strict";
 const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el};
 const btn=(label,fn,cls="btn")=>{const b=make("button",cls,label);b.type="button";b.onclick=fn;return b};
 const types=[["observation","What happened"],["attempt","What I tried / changed"],["lesson","What I learned"]]; 
 const legacyType={theory:"Hypothesis",revision:"Revision / design change",result:"Result"};
 const statuses=[["investigating","Investigating"],["resolved","Resolved"],["unresolved","Unresolved"]];
 const photoExt=/\.(jpg|jpeg|png|webp|gif|heic|heif)$/i;
 const fileUrl=id=>"/api/recipe-files?id="+encodeURIComponent(id);
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
  function attach(record,container,target){
   const reportHere=message=>report(message,target);
   const entryList=make("div","investigation-entries");
   for(const entry of record.entries||[]){
    const item=make("article","investigation-entry");
    const label=types.find(x=>x[0]===entry.type)?.[1]||legacyType[entry.type]||"Update";
    const stamp=entry.date||entry.createdAt?.slice(0,10)||"";
    const labelRow=make("div","investigation-entry-heading");
    labelRow.append(make("strong","",label));
    if(stamp)labelRow.append(make("time","investigation-entry-date",stamp));
    item.append(labelRow,make("p","",entry.text));
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
   container.append(entryList);
   if(!admin())return;

   // A simple, shared three-bucket form replaces the old update-type dropdown.
   const controls=make("div","investigation-add-controls");
   const dateLabel=make("label","investigation-date-field","Date");
   const date=make("input","field");date.type="date";
   const now=new Date();date.value=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10);
   dateLabel.append(date);controls.append(dateLabel);
   const inputs=types.map(([type,label])=>{
    const wrap=make("label","investigation-entry-field");
    wrap.append(make("span","",label));
    const field=make("textarea","field");field.rows=2;field.maxLength=5000;
    field.placeholder=type==="observation"?"What happened?":type==="attempt"?"What did you change or test?":"What did you learn or conclude?";
    wrap.append(field);controls.append(wrap);return {type,field};
   });
   const fileInput=make("input");fileInput.type="file";fileInput.multiple=true;fileInput.hidden=true;
   fileInput.accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.dwg,.dxf,.stp,.step,.stl,.txt,.csv,.doc,.docx,.xls,.xlsx,.zip";
   const fileChoice=make("span","investigation-file-label");
   fileInput.onchange=()=>{fileChoice.textContent=[...fileInput.files].map(x=>x.name).join(", ")};
   const attachBtn=btn("+ Add photo / document",()=>fileInput.click(),"btn");
   const saveBtn=btn("Save update",async()=>{
    const fields=inputs.filter(item=>item.field.value.trim());
    if(!fields.length){reportHere("Add an observation, attempted change, or lesson.");inputs[0].field.focus();return}
    if(!date.value){reportHere("Choose a date.");date.focus();return}
    saveBtn.disabled=true;
    try{
     const files=[];
     for(const file of [...fileInput.files]){
      if(file.size>20*1024*1024)throw Error("An attachment exceeds 20 MB.");
      const up=await fetch("/api/recipe-files?project="+encodeURIComponent(project),{method:"POST",
       credentials:"same-origin",headers:{"content-type":"application/octet-stream","x-file-name":encodeURIComponent(file.name)},body:file});
      const data=await up.json();if(!up.ok)throw Error(data.error||"Attachment failed");
      files.push(data.id);
     }
     const entries=fields.map(({type,field},index)=>({type,text:field.value,date:date.value,
      files:index===0?files:[],fileName:index===0?([...(fileInput.files||[])][0]?.name||""):""}));
     await save({action:"appendBatch",id:record.id,entries});
     reportHere("Update saved. Earlier findings are preserved.");
    }catch(error){reportHere(error.message);saveBtn.disabled=false}
   },"btn primary");
   controls.append(attachBtn,fileInput,fileChoice,saveBtn);
   const state=make("select","field investigation-status");
   for(const [value,label] of statuses){const o=make("option","",label);o.value=value;state.append(o)}
   state.value=record.status;
   state.setAttribute("aria-label","Investigation status");
   state.onchange=async()=>{
    state.disabled=true;
    try{await save({action:"status",id:record.id,status:state.value});reportHere("Status saved.")}
    catch(error){reportHere(error.message);state.disabled=false}
   };
   container.append(controls,state);
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
   const title=make(compact?"h4":"h2","",compact?"Revisions, Failures & Lessons Learned":"Revisions, Failures & Lessons Learned");
   const toggleLabel=make("span","investigation-toggle-label",disclosure.open?"Minimize details":"Show details");
   summary.append(title,toggleLabel);
   disclosure.append(summary);
   disclosure.addEventListener("toggle",()=>{
    toggleLabel.textContent=disclosure.open?"Minimize details":"Show details";
    if(disclosure.open)openSections.add(sectionKey);else openSections.delete(sectionKey);
   });
   const content=make("div","investigation-collapse-content");
   const header=make("div","investigation-heading");
   if(admin()){
    header.append(btn("+ Add record",()=>newRecord(context,target),"btn investigation-add"));
    if(context.ownerType==="part"&&!context.stepId&&typeof getPart==="function"&&getPart()?.id===context.ownerId&&
     typeof onReplacePart==="function")header.append(btn("Replace part / save revision",()=>replacePart(context,target),"btn investigation-add"));
   }
   if(header.childElementCount)content.append(header);
   disclosure.append(content);
   target.append(disclosure);
   const own=records.filter(item=>owns(item,context));
   const rolled=records.filter(item=>within(item,context)&&!owns(item,context));
   const renderRecord=(record,inherited=false)=>{
    const card=make("details","investigation-card");
    const openKey=context.ownerType+":"+context.ownerId+":"+(context.stepId||"")+":"+record.id;
    card.open=openCards.has(openKey);
    card.addEventListener("toggle",()=>{if(card.open)openCards.add(openKey);else openCards.delete(openKey)});
    const summary=make("summary","investigation-summary");
    summary.append(make("strong","",record.title));
    const badge=make("span","investigation-status-pill",statuses.find(x=>x[0]===record.status)?.[1]||record.status);
    summary.append(badge);
    if(admin()){
     const rename=btn("Rename",event=>{
      event.preventDefault();event.stopPropagation();
      renameRecord(record,target);
     },"btn investigation-rename");
     summary.append(rename);
     rename.addEventListener("click",event=>{event.preventDefault();event.stopPropagation()});
    }
    card.append(summary);
    const body=make("div","investigation-body");
    if(inherited){
     const source=record.scope==="step"?"Step":record.ownerType==="part"?"Part":"Assembly";
     body.append(make("p","investigation-origin","From "+source+" · "+record.title));
    }
    if(record.partSnapshot)showSnapshot(record.partSnapshot,body);
    attach(record,body,target);card.append(body);content.append(card);
   };
   own.forEach(item=>renderRecord(item));
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
     title.append(make("strong","",record.title),make("span","investigation-status-pill",record.status));
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
   const reportHere=message=>report(message,target);
   const form=make("div","investigation-create");
   const name=make("input","field");name.placeholder="Revision, failure, or lesson title";name.maxLength=180;
   const saveBtn=btn("Save record",async()=>{
    if(!name.value.trim()){name.focus();return}
    saveBtn.disabled=true;
    try{await save({action:"create",...context,title:name.value.trim()});reportHere("Failure recorded. Open it to add evidence, attempts and lessons.")}
    catch(error){reportHere(error.message);saveBtn.disabled=false}
   },"btn primary");
   const cancel=btn("Cancel",()=>form.remove(),"btn");
   form.append(name,saveBtn,cancel);
   target.querySelector(".investigation-heading")?.after(form);
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