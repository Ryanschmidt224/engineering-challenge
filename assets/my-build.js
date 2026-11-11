/* Personal learner notebook and scoped confusion feedback. Never edits canonical project content. */
(()=>{
 "use strict";
 const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e};
 const button=(label,fn,cls="btn")=>{const e=node("button",cls,label);e.type="button";e.onclick=fn;return e};
 const id=()=>("t"+crypto.randomUUID().replace(/-/g,""));
 const stores=new Map();
 const loginHint="Sign in through Projects → My account to save your own build notes.";
 async function load(project){
  if(stores.has(project))return stores.get(project);
  const res=await fetch("/api/my-build?project="+encodeURIComponent(project),{credentials:"same-origin",cache:"no-store"});
  const data=await res.json();if(!res.ok)throw Error(data.loginRequired?loginHint:data.error||"My Build unavailable");
  const state={revision:data.revision||0,entries:data.entries||{},queue:Promise.resolve()};
  stores.set(project,state);return state;
 }
 const empty=()=>({note:"",progress:"not_started",tasks:[]});
 async function mutate(project,change){
  const state=await load(project);
  const job=state.queue.catch(()=>{}).then(async()=>{
   const before=structuredClone(state.entries);
   change(state.entries);
   try{
    const res=await fetch("/api/my-build?project="+encodeURIComponent(project),{method:"PUT",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({revision:state.revision,entries:state.entries})});
    const data=await res.json();if(!res.ok)throw Error(data.error||"Could not save My Build");
    state.revision=data.revision;
   }catch(error){state.entries=before;throw error}
  });
  state.queue=job;return job;
 }
 function mount(target,{project,context}){
  const section=node("section","my-build-panel"),details=node("details","my-build-disclosure");
  const heading=node("summary","","My Build — personal notes and tasks");
  const body=node("div","my-build-body");
  const hint=node("p","muted","Your notes, progress and tasks are private to your account. They never change the project instructions.");
  const progress=node("select","field my-build-progress");
  for(const [value,label] of [["not_started","Not started"],["in_progress","In progress"],["complete","Complete"]]){
   const option=node("option","",label);option.value=value;progress.append(option);
  }
  progress.setAttribute("aria-label","My build progress");
  const note=node("textarea","field my-build-note");note.rows=3;note.maxLength=4000;note.placeholder="Your observations, measurements, problems, or changes";
  const noteState=node("span","my-build-save-state");
  const tasks=node("div","my-build-tasks");
  const taskForm=node("form","my-build-task-form");
  const taskInput=node("input","field");taskInput.maxLength=220;taskInput.placeholder="Something to do before continuing";
  const taskAdd=button("+ Add task",()=>{});taskAdd.type="submit";taskForm.append(taskInput,taskAdd);
  body.append(hint,progress,note,noteState,tasks,taskForm);details.append(heading,body);section.append(details);target.append(section);
  let state=null,loaded=false,noteTimer=null;
  const scope=()=>context().scope;
  const message=text=>{noteState.textContent=text};
  async function write(change,targetScope=scope()){
   if(!state)return;
   message("Saving…");
   try{await mutate(project,entries=>{entries[targetScope]??=empty();change(entries[targetScope])});message("Saved")}
   catch(error){message(error.message)}
  }
  function redraw(){
   if(!state)return;
   const entry=state.entries[scope()]||empty();
   progress.value=entry.progress;note.value=entry.note;
   tasks.replaceChildren();
   for(const task of entry.tasks){
    const row=node("label","my-build-task-row"),check=node("input");check.type="checkbox";check.checked=task.done;
    check.onchange=()=>void write(entry=>{const found=entry.tasks.find(t=>t.id===task.id);if(found)found.done=check.checked});
    const label=node("span","",task.text);
    const remove=button("×",()=>void write(entry=>{entry.tasks=entry.tasks.filter(t=>t.id!==task.id)}),"btn my-build-remove");
    row.append(check,label,remove);tasks.append(row);
   }
  }
  async function ensure(){
   if(loaded)return;
   try{state=await load(project);loaded=true;redraw()}
   catch(error){body.replaceChildren(node("p","muted",error.message))}
  }
  details.addEventListener("toggle",()=>{if(details.open)void ensure()});
  progress.onchange=()=>void write(entry=>{entry.progress=progress.value});
  note.oninput=()=>{
   clearTimeout(noteTimer);const value=note.value;
   const targetScope=scope();
   noteTimer=setTimeout(()=>void write(entry=>{entry.note=value},targetScope),650);
  };
  taskForm.onsubmit=e=>{
   e.preventDefault();const text=taskInput.value.trim();if(!text)return;
   const targetScope=scope();
   void write(entry=>{entry.tasks.push({id:id(),text,done:false})},targetScope).then(()=>{taskInput.value="";redraw()});
  };
  return {refresh:()=>{if(loaded&&document.activeElement!==note)redraw()},open:()=>{details.open=true}};
 }
 async function report(project,scope,status){
  const kind=window.prompt("Where did you get stuck? Enter 'stuck' or 'confused'.","confused");
  if(kind===null)return;
  const choice=kind.trim().toLowerCase();if(!["stuck","confused"].includes(choice)){status.textContent="Enter stuck or confused.";return}
  const comment=window.prompt("Optional explanation for the project creator (no personal information).","");if(comment===null)return;
  status.textContent="Sending…";
  try{
   const res=await fetch("/api/build-confusion?project="+encodeURIComponent(project),{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({scope,kind:choice,comment})});
   const data=await res.json();if(!res.ok)throw Error(data.loginRequired?loginHint:data.error);
   status.textContent="Feedback saved. The creator can see this section's feedback count, not your identity.";
  }catch(error){status.textContent=error.message}
 }
 function reportControl(target,{project,scope}){
  if(!target||target.querySelector(":scope > .build-confusion-control"))return;
  const line=node("div","build-confusion-control"),status=node("span","build-confusion-status");
  line.append(button("Stuck or confused?",()=>void report(project,typeof scope==="function"?scope():scope,status),"btn build-confusion-button"),status);
  target.append(line);
 }
 function decorateStep(target,{project,step}){
  reportControl(target,{project,scope:()=> "step:"+step.id});
 }
 function insights(target,{project}){
  const panel=node("details","build-confusion-insights");
  const heading=node("summary","","Where learners get stuck");
  const body=node("div","build-confusion-insights-body");
  panel.append(heading,body);target.append(panel);
  panel.addEventListener("toggle",async()=>{
   if(!panel.open)return;
   body.textContent="Loading feedback…";
   try{
    const response=await fetch("/api/build-confusion?project="+encodeURIComponent(project),{credentials:"same-origin",cache:"no-store"});
    const data=await response.json();if(!response.ok)throw Error(data.error);
    body.replaceChildren();
    if(!data.reports.length){body.append(node("p","muted","No confusion reports yet."));return}
    for(const item of data.reports){
     const row=node("div","build-confusion-insight");
     row.append(node("strong","",item.scope),node("span","",item.count+" reports · "+item.stuck+" stuck · "+item.confused+" confused"));
     for(const comment of item.comments)row.append(node("p","",comment));
     body.append(row);
    }
   }catch(error){body.textContent=error.message}
  });
 }
 window.BSMyBuild={mount,reportControl,decorateStep,insights};
})();
