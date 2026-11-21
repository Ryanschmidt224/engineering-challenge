/* Optional, deliberately curated, append-only project narrative.
 * Only explicit Save publishes an entry. No background activity logging.
 */
(function(){
 "use strict";
 const mounts=new Map();
 const el=(tag,cls,text)=>{
  const node=document.createElement(tag);
  if(cls)node.className=cls;
  if(text!==undefined)node.textContent=text;
  return node;
 };
 const button=(text,fn,cls="btn")=>{
  const node=el("button",cls,text);node.type="button";node.onclick=fn;return node;
 };
 const time=(stamp)=>{
  const date=new Date(stamp);
  if(Number.isNaN(date.getTime()))return "";
  return date.toLocaleString(undefined,{year:"numeric",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});
 };
 const sourceTitle=source=>{
  if(!source)return "";
  const kind=source.kind==="archive"?"Archived "+(source.category==="part"?"part":"assembly"):
   source.category==="test"?"Test / measurement":source.category==="revision"?"Revision":"Failure";
  return kind+" · "+(source.title||"Untitled");
 };
 const api=project=>"/api/project-milestones?project="+encodeURIComponent(project);
 const fetchJSON=async(project,options)=>{
  const response=await fetch(api(project),{credentials:"same-origin",cache:"no-store",...options});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error||"Could not load project milestones");
  return data;
 };
 const field=(label,placeholder="",rows=3,limit=3000)=>{
  const wrap=el("label","project-milestone-field");
  const caption=el("span","",label);
  const input=el("textarea","field");input.rows=rows;input.maxLength=limit;input.placeholder=placeholder;
  wrap.append(caption,input);return {wrap,input};
 };
 function mount({project,summary,canEdit}){
  let revision=null,originalIntent=null,milestones=[],loadId=0;
  const panel=el("section","project-overview-card project-intent-milestones");
  const header=el("div","project-milestone-heading");
  const expand=button("Project Intent & Milestones",()=>{
   const isOpen=expand.getAttribute("aria-expanded")==="true";
   expand.setAttribute("aria-expanded",String(!isOpen));
   content.hidden=isOpen;
  },"project-milestone-expand");
  expand.setAttribute("aria-expanded","false");
  expand.setAttribute("aria-controls","project-milestone-content-"+project);
  const chevron=el("span","project-milestone-chevron");
  chevron.setAttribute("aria-hidden","true");
  expand.prepend(chevron);
  header.append(expand);panel.append(header);
  const content=el("div","project-milestone-content");
  content.id="project-milestone-content-"+project;
  content.hidden=true;
  const actions=el("div","project-milestone-actions");
  const createIntent=button("Record original intent",()=>openEditor("intent"),"btn");
  const addMilestone=button("Add milestone",()=>openEditor("milestone"),"btn");
  actions.append(createIntent,addMilestone);content.append(actions);
  content.append(el("p","muted project-milestone-intro",
   "What did you set out to achieve, and which discoveries or decisions were significant? Nothing is recorded automatically."));
  const feedback=el("p","muted project-milestone-feedback");feedback.setAttribute("role","status");
  const intentHost=el("div","project-milestone-intent");
  const historyHost=el("div","project-milestone-history");
  content.append(feedback,intentHost,historyHost);
  panel.append(content);
  summary.querySelector(".project-summary-overview")?.after(panel);
  function setFeedback(text){feedback.textContent=text||""}
  function addText(host,label,value){
   if(!value)return;
   const item=el("div","project-milestone-field-view");
   item.append(el("strong","",label),el("p","",value));host.append(item);
  }
  function render(){
   // Don't add an empty public-facing section to every existing project.
   panel.hidden=!canEdit()&&!originalIntent&&!milestones.length;
   createIntent.hidden=!canEdit()||!!originalIntent;
   addMilestone.hidden=!canEdit();
   intentHost.replaceChildren();
   if(originalIntent){
    const card=el("section","project-milestone-original");
    card.append(el("h3","",originalIntent.preExistingMilestones?"First recorded intent":"Original intent"));
    addText(card,"What am I trying to accomplish?",originalIntent.objective);
    addText(card,"What would success look like?",originalIntent.successCriteria);
    addText(card,"What was my initial plan?",originalIntent.plan);
    card.append(el("p","muted project-milestone-date","Recorded "+time(originalIntent.createdAt)+
     " · Original record is preserved"+(originalIntent.preExistingMilestones?
      " · Documented after "+originalIntent.preExistingMilestones+" prior milestone(s)":"")));
    intentHost.append(card);
   }else{
    intentHost.append(el("p","muted","No original intent recorded. This is optional; milestones can still be added."));
   }
   historyHost.replaceChildren();
   historyHost.append(el("h3","","Milestones"+(milestones.length?" ("+milestones.length+")":"")));
   if(!milestones.length){
    historyHost.append(el("p","muted","No milestones recorded yet. Add only the results or decisions that genuinely changed your understanding."));
    return;
   }
   const list=el("ol","project-milestone-list");
   for(const record of milestones){
    const item=el("li","project-milestone-record");
    item.append(el("h4","","Milestone "+record.sequence));
    addText(item,"What happened?",record.whatHappened);
    addText(item,"Why is this significant to the project?",record.significance);
    if(record.source){
     const source=el("p","project-milestone-source","Source: "+sourceTitle(record.source));
     // Use a project route only for investigations; the archived content
     // may no longer have an active route, so retain its source identifier.
     if(record.source.kind==="investigation"){
      const owner=record.source.ownerType==="part"?"part/"+encodeURIComponent(record.source.ownerId):
       "workspace/"+encodeURIComponent(record.source.ownerId||"__root__");
      const link=el("a","","View source area");
      link.href="#"+project+(owner?"/"+owner:"");
      source.append(document.createTextNode(" · "),link);
     }
     if(record.source.kind==="archive"&&record.source.originPath?.length)
      source.append(document.createTextNode(" · "+record.source.originPath.join(" / ")));
     item.append(source);
    }
    item.append(el("p","muted project-milestone-date","Recorded "+time(record.createdAt)));
    list.append(item);
   }
   historyHost.append(list);
  }
  async function refresh(){
   const token=++loadId;
   try{
    const result=await fetchJSON(project);
    if(token!==loadId)return;
    revision=result.revision??null;
    originalIntent=result.originalIntent||null;
    milestones=Array.isArray(result.milestones)?result.milestones:[];
    setFeedback("");render();return true;
   }catch(error){if(token===loadId)setFeedback(error.message);return false}
  }
  async function openEditor(mode,offeredSource=null){
   if(!canEdit())return;
   const existing=document.querySelector("dialog.project-milestone-dialog[open]");
   if(existing){existing.focus();return}
   // A source action can be invoked without ever opening Project Summary.
   // Read the latest revision first so its first Save works immediately.
   if(!await refresh())return;
   if(mode==="intent"&&originalIntent){setFeedback("Original intent is already recorded.");return}
   const dialog=el("dialog","project-milestone-dialog");
   const form=el("form","project-milestone-editor");form.method="dialog";
   const heading=el("h2","",mode==="intent"?"Record original project intent":"Add Project Milestone");
   form.append(heading);
   form.append(el("p","muted",mode==="intent"
    ?"Describe your original aim before judging the results. All three prompts are optional, but enter at least one. This record will not be overwritten."
    :"Only record something worth preserving. Explain why it matters; ordinary changes belong in their existing records."));
   let controls=[],source=offeredSource?{kind:offeredSource.kind,id:offeredSource.id}:null;
   if(mode==="intent"){
    controls=[
     field("What am I trying to accomplish?","Describe the project's original objective.",3,2000),
     field("What would success look like?","What measurable or observable result would demonstrate success?",3,2000),
     field("What's my initial plan?","How do I intend to get there?",3,3000)
    ];
   }else{
    controls=[
     field("What happened?","Significant decision, result, discovery or change.",4,3000),
     field("Why is this significant to the project?","What did it teach you, change, or help you decide?",3,2000)
    ];
    if(offeredSource){
     controls[0].input.value=String(offeredSource.prefill||offeredSource.title||"").slice(0,3000);
     const sourceArea=el("div","project-milestone-draft-source");
     const label=el("span","muted","Link to original: "+(offeredSource.title||"Related record"));
     const unlink=button("Remove link",()=>{source=null;sourceArea.remove()},"btn");
     sourceArea.append(label,unlink);form.append(sourceArea);
    }
   }
   for(const item of controls){
    if(mode==="intent"){
     item.input.spellcheck=true;
     item.input.setAttribute("spellcheck","true");
    }
    form.append(item.wrap);
   }
   if(mode==="intent")form.append(el("p","muted project-milestone-spelling-hint",
    "Check spelling and wording before saving. Your browser may underline misspelled words; right-click them for suggestions."));
   const message=el("p","project-milestone-form-feedback muted");message.setAttribute("role","status");form.append(message);
   const footer=el("div","project-milestone-editor-actions");
   const save=button(mode==="intent"?"Save original intent":"Save milestone",async()=>{
    const values=controls.map(item=>item.input.value.trim());
    if(mode==="intent"&&!values.some(Boolean)){
     message.textContent="Enter at least one original goal, success criterion or plan.";return
    }
    if(mode==="milestone"&&(!values[0]||!values[1])){
     message.textContent="Describe both what happened and why it is significant.";return
    }
    if(mode==="intent"){
     const confirmed=await window.BSDialogs.confirm(
      "Once saved, your original project intent cannot be changed or deleted. Review the spelling and wording of all three fields before confirming. You can cancel to continue editing.",
      {title:"Save original project intent?",confirmLabel:"Confirm and save"}
     );
     if(!confirmed)return;
     // Recheck the draft because the confirmation is asynchronous.
     if(controls.some((item,i)=>item.input.value.trim()!==values[i])){
      message.textContent="The draft changed. Review it and click Save again.";return;
     }
    }
    save.disabled=true;message.textContent="Saving…";
    const draft=mode==="intent"?{action:"createIntent",objective:values[0],successCriteria:values[1],plan:values[2]}:
     {action:"addMilestone",whatHappened:values[0],significance:values[1],source};
    try{
     const data=await fetchJSON(project,{method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({...draft,expectedRevision:revision})});
     ++loadId; // Cancel older GET responses that could hide this successful append.
     revision=data.revision;
     if(mode==="intent")originalIntent=data.record;
     else milestones.push(data.record);
     render();dialog.close();
     setFeedback(mode==="intent"?"Original intent recorded. Future changes become new milestones.":"Milestone recorded.");
    }catch(error){
     message.textContent=error.message;
     save.disabled=false;
     // Refresh the revision token without losing the current draft.
     if(/another tab|saved first|already recorded/i.test(error.message)){
      try{const latest=await fetchJSON(project);revision=latest.revision??null;
       originalIntent=latest.originalIntent||null;milestones=latest.milestones||[];render()}
      catch{}
     }
    }
   },"btn primary");
   const cancel=button("Cancel",()=>dialog.close());
   footer.append(save,cancel);form.append(footer);dialog.append(form);
   document.body.append(dialog);dialog.addEventListener("close",()=>dialog.remove(),{once:true});
   dialog.showModal();controls[0].input.focus();
  }
  const state={refresh,openMilestone:source=>openEditor("milestone",source),openIntent:()=>openEditor("intent")};
  mounts.set(project,state);
  render();
  return state;
 }
 function offer(project,source){
  const mounted=mounts.get(project);
  if(!mounted)return false;
  mounted.openMilestone(source||null);return true;
 }
 window.BSProjectMilestones=Object.freeze({mount,offer});
})();
