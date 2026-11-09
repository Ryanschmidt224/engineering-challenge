/* Shared failure and lessons component, used at project, assembly, part, and step levels. */
(function(){
 "use strict";
 const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el};
 const btn=(label,fn,cls="btn")=>{const b=make("button",cls,label);b.type="button";b.onclick=fn;return b};
 const types=[["observation","Observation"],["theory","Theory / hypothesis"],["attempt","Attempted fix"],["result","Test result"],["lesson","Lesson learned"]];
 const statuses=[["investigating","Investigating"],["resolved","Resolved"],["unresolved","Unresolved"]];
 const photoExt=/\.(jpg|jpeg|png|webp|gif|heic|heif)$/i;
 const fileUrl=id=>"/api/recipe-files?id="+encodeURIComponent(id);
 function mount({project,admin,getTree,getPart,getPartList}){
  let records=[],revision=null;
  let assemblySlot=null,partSlot=null,stepSlots=new Map(),activeContext=null,loadSerial=0;
  const openCards=new Set();
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
  function attach(record,container){
   const target=container.closest(".investigations-panel,.recipe-step-investigations");
   const reportHere=message=>report(message,target);
   const entryList=make("div","investigation-entries");
   for(const entry of record.entries||[]){
    const item=make("article","investigation-entry");
    const label=types.find(x=>x[0]===entry.type)?.[1]||"Update";
    item.append(make("strong","",label),make("p","",entry.text));
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
   const controls=make("div","investigation-add-controls");
   const kind=make("select","field");
   for(const [value,label] of types){const o=make("option","",label);o.value=value;kind.append(o)}
   const text=make("textarea","field");text.rows=3;text.placeholder="What happened, what did you try, or what did you learn?";
   const fileInput=make("input");fileInput.type="file";fileInput.multiple=true;fileInput.hidden=true;
   fileInput.accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.dwg,.dxf,.stp,.step,.stl,.txt,.csv,.doc,.docx,.xls,.xlsx,.zip";
   const fileChoice=make("span","investigation-file-label");
   fileInput.onchange=()=>{fileChoice.textContent=[...fileInput.files].map(x=>x.name).join(", ")};
   const attachBtn=btn("+ Add photo / document",()=>fileInput.click(),"btn");
   const saveBtn=btn("Save update",async()=>{
    if(!text.value.trim()){reportHere("Write an observation or lesson before saving.");text.focus();return}
    saveBtn.disabled=true;
    try{
     const files=[];
     for(const file of [...fileInput.files]){
      if(file.size>20*1024*1024)throw Error("An attachment exceeds 20 MB.");
      const up=await fetch("/api/recipe-files?project="+encodeURIComponent(project),{method:"POST",
       credentials:"same-origin",headers:{"content-type":"application/octet-stream","x-file-name":encodeURIComponent(file.name)},body:file});
      const d=await up.json();if(!up.ok)throw Error(d.error||"Attachment failed");
      files.push(d.id);
     }
     await save({action:"append",id:record.id,entry:{type:kind.value,text:text.value,files,fileName:[...fileInput.files][0]?.name||""}});
     reportHere("Update saved. Previous entries are preserved.");
    }catch(error){reportHere(error.message);saveBtn.disabled=false}
   },"btn primary");
   controls.append(kind,text,attachBtn,fileInput,fileChoice,saveBtn);
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
   target.replaceChildren();
   activeContext={...context,target};
   const header=make("div","investigation-heading");
   const title=make(compact?"h4":"h2","",compact?"Failures & lessons":"Failures & Lessons Learned");
   header.append(title);
   if(admin())header.append(btn("+ Add failure",()=>newRecord(context,target),"btn investigation-add"));
   target.append(header);
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
    summary.append(badge);card.append(summary);
    const body=make("div","investigation-body");
    if(inherited){
     const source=record.scope==="step"?"Step":record.ownerType==="part"?"Part":"Assembly";
     body.append(make("p","investigation-origin","From "+source+" · "+record.title));
    }
    attach(record,body);card.append(body);target.append(card);
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
     attach(record,body);card.append(body);wrapper.append(card);inner.append(wrapper);
    }
    group.append(inner);target.append(group);
   }
   if(!own.length&&!rolled.length)target.append(make("p","muted investigation-empty","No failures recorded yet."));
   target.append(make("p","investigation-feedback muted"));
  }
  function newRecord(context,target){
   const reportHere=message=>report(message,target);
   const form=make("div","investigation-create");
   const name=make("input","field");name.placeholder="What failed?";name.maxLength=180;
   const saveBtn=btn("Save failure",async()=>{
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