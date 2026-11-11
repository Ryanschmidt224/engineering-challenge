/* Project-scoped return points, task list and explicit build-readiness checks. */
(()=>{
 "use strict";
 const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node};
 const button=(label,fn,cls="btn")=>{const node=el("button",cls,label);node.type="button";node.onclick=fn;return node};
 const id=()=>globalThis.crypto?.randomUUID?.().replace(/-/g,"")||"t"+Date.now().toString(36)+Math.random().toString(36).slice(2);
 const cache=new Map(),listeners=new Map();
 async function load(project){
  if(cache.has(project))return cache.get(project);
  const response=await fetch("/api/project-tasks?project="+encodeURIComponent(project),{cache:"no-store"});
  const data=await response.json();if(!response.ok)throw Error(data.error||"Unable to load tasks");
  const state={revision:data.revision||0,tasks:data.tasks||[],readiness:data.readiness||{}};
  cache.set(project,state);return state;
 }
 function announce(project){for(const refresh of listeners.get(project)||[])refresh()}
 async function update(project,change){
  const state=await load(project);
  // Serialize writes per project; no silent overwriting after revision conflicts.
  const pending=state.pending||Promise.resolve();
  const next=pending.catch(()=>{}).then(async()=>{
   const previous={tasks:structuredClone(state.tasks),readiness:{...state.readiness},revision:state.revision};
   change(state);announce(project);
   try{
    const response=await fetch("/api/project-tasks?project="+encodeURIComponent(project),{
     method:"PUT",headers:{"content-type":"application/json"},
     body:JSON.stringify({expectedRevision:state.revision,tasks:state.tasks,readiness:state.readiness})
    });
    const data=await response.json();if(!response.ok)throw Error(data.error||"Save failed");
    state.revision=data.revision;announce(project);
   }catch(error){state.tasks=previous.tasks;state.readiness=previous.readiness;state.revision=previous.revision;announce(project);throw error}
  });
  state.pending=next;return next;
 }
 function mount(panel,{project,context,editable=()=>false,resources=()=>({}),steps=()=>[]}){
  panel.classList.add("project-work-tracker");
  const heading=el("div","tracker-heading"),title=el("h2","","Continue working"),status=el("span","tracker-status");
  const toolbar=el("div","tracker-tools"),list=el("div","tracker-task-list");
  const form=el("form","tracker-add-form");
  const input=el("input","field");input.placeholder="What needs to be done?";input.maxLength=200;
  const note=el("textarea","field");note.placeholder="Where you left off / what to do next";note.rows=2;note.maxLength=3000;
  form.append(input,note,button("Add task",()=>{},"btn primary"));form.querySelector("button").type="submit";
  const resume=el("div","tracker-resume");
  const readiness=el("details","tracker-readiness"),readTitle=el("summary","","Parts & tools checklist"),readBody=el("div","tracker-readiness-body");
  readiness.append(readTitle,readBody);
  heading.append(title,status);panel.append(heading,resume,toolbar,list,form,readiness);
  let stored=null,loading=false,readinessLoaded=false,parts=[];
  const message=text=>{status.textContent=text;status.hidden=!text};
  const here=()=>context();
  const currentPath=()=>here().path;
  const go=task=>{
   const hash=task.path.startsWith("#")?task.path:"#"+task.path;
   if(location.hash!==hash){location.hash=hash}else window.dispatchEvent(new Event("hashchange"));
   if(task.stepId)sessionStorage.setItem("bs-resume-step:"+hash,task.stepId);
  };
  function render(){
   const current=here();
   form.hidden=!editable();
   toolbar.replaceChildren();resume.replaceChildren();list.replaceChildren();
   if(!stored)return;
   const currentTasks=stored.tasks.filter(task=>task.path===current.path);
   const unfinished=stored.tasks.filter(task=>!task.done);
   const latest=unfinished.find(task=>task.path===current.path)||unfinished[0];
   if(latest){
    const card=el("div","tracker-resume-card");
    const label=el("strong","",latest.title);
    const detail=el("p","",latest.note||"Return to this task.");
    const actions=button("Continue",()=>go(latest),"btn primary");
    card.append(label,detail,actions);resume.append(card);
   }else resume.append(el("p","muted","No unfinished tasks. Add one whenever you need to remember where to pick up."));
   toolbar.append(button("Bookmark this step",()=>{
    if(!editable())return;
    const ctx=here();
    const name=ctx.stepTitle?"Continue: "+ctx.stepTitle:"Continue: "+ctx.title;
    void update(project,s=>s.tasks.unshift({id:id(),title:name,note:"",path:ctx.path,stepId:ctx.stepId||"",done:false})).catch(error=>message(error.message));
   },"btn"));
   toolbar.append(el("span","muted",unfinished.length+" open · "+stored.tasks.filter(t=>t.done).length+" complete"));
   for(const task of [...currentTasks.filter(x=>!x.done),...stored.tasks.filter(x=>x.path!==current.path&&!x.done),...stored.tasks.filter(x=>x.done)]){
    const row=el("div","tracker-task"+(task.done?" is-done":""));
    const check=el("input");check.type="checkbox";check.checked=task.done;check.disabled=!editable();
    check.setAttribute("aria-label","Complete "+task.title);
    check.onchange=()=>void update(project,s=>{const found=s.tasks.find(x=>x.id===task.id);if(found)found.done=check.checked}).catch(error=>message(error.message));
    const body=el("div","tracker-task-body");
    body.append(el("strong","",task.title));
    if(task.note)body.append(el("p","",task.note));
    const link=button(task.path===current.path?"Go to step":"Open location",()=>go(task),"btn tracker-link");
    row.append(check,body,link);
    if(editable())row.append(button("×",()=>void update(project,s=>{s.tasks=s.tasks.filter(t=>t.id!==task.id)}).catch(error=>message(error.message)),"btn tracker-remove"));
    list.append(row);
   }
   if(readiness.open)renderReadiness();
  }
  form.onsubmit=event=>{
   event.preventDefault();
   const title=input.value.trim();if(!title)return;
   const ctx=here();
   void update(project,s=>s.tasks.unshift({id:id(),title,note:note.value.trim(),path:ctx.path,stepId:ctx.stepId||"",done:false})).then(()=>{input.value="";note.value="";message("")}).catch(error=>message(error.message));
  };
  async function fetchParts(){
   const response=await fetch("/api/components?project="+encodeURIComponent(project),{cache:"no-store"});
   const data=await response.json();if(!response.ok)throw Error(data.error||"Unable to load BOM");
   parts=data.components||[];readinessLoaded=true;renderReadiness();
  }
  function renderReadiness(){
   if(!stored)return;
   readBody.replaceChildren();
   const ctx=here(),assembly=ctx.assemblyId??null;
   const bom=parts.filter(p=>(p.assemblyId??null)===assembly&&p.itemType!=="document");
   const resourceTools=resources()?.tools||[];
   readBody.append(el("p","muted","Manually confirm what is available. A BOM entry or linked resource does not mean you own it. This list covers direct BOM parts for the selected assembly."));
   const items=[...bom.map(p=>({key:"part:"+p.id,name:(p.partNumber?p.partNumber+" · ":"")+(p.name||"Unnamed part"),category:"Parts"})),...resourceTools.map(tool=>({key:"tool:"+String(tool),name:"Linked tool: "+tool,category:"Tools"}))];
   const ready=items.filter(item=>stored.readiness[item.key]).length;
   readBody.append(el("p","tracker-ready-count",ready+" of "+items.length+" confirmed"));
   if(!items.length)readBody.append(el("p","muted",readinessLoaded?"No direct BOM parts or linked tools found.":"Loading BOM…"));
   for(const item of items){
    const label=el("label","tracker-ready-item"),check=el("input");check.type="checkbox";check.checked=!!stored.readiness[item.key];check.disabled=!editable();
    check.onchange=()=>void update(project,s=>{s.readiness[item.key]=check.checked}).catch(error=>message(error.message));
    label.append(check,el("span","",item.name),el("small","",item.category));readBody.append(label);
   }
   readBody.append(button("Refresh BOM",()=>void fetchParts().catch(e=>message(e.message)),"btn"));
  }
  readiness.addEventListener("toggle",()=>{if(readiness.open){if(!readinessLoaded)void fetchParts().catch(e=>message(e.message));else renderReadiness()}});
  const refresh=()=>{stored=cache.get(project)||null;render()};
  if(!listeners.has(project))listeners.set(project,new Set());
  listeners.get(project).add(refresh);
  if(!loading){loading=true;void load(project).then(()=>{loading=false;refresh()}).catch(e=>{loading=false;message(e.message)})}
  return {refresh,openReadiness:()=>{readiness.open=true;readiness.scrollIntoView({block:"nearest"})}};
 }
 window.BSWorkTracker={mount};
})();
