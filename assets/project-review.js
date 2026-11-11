// Account-aware, owner-reviewed changes to existing instruction steps.
window.BSReview=(()=>{
 const request=async(method,url,body)=>{
  const r=await fetch(url,{method,credentials:"same-origin",cache:"no-store",...(body?{headers:{"content-type":"application/json"},body:JSON.stringify(body)}:{})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(data.error||"Unable to process change");
  return data;
 };
 const el=(tag,klass,value)=>{const n=document.createElement(tag);if(klass)n.className=klass;if(value!==undefined)n.textContent=value;return n};
 const dialog=el("dialog","project-manage-dialog");document.body.append(dialog);
 const api=project=>"/api/proposals?project="+encodeURIComponent(project.id);
 function target(project){
  const hash=decodeURIComponent(location.hash.slice(1));
  const match=hash.match(new RegExp("^"+project.id+"/workspace/([^/]+)$"));
  return {scope:"assembly",targetId:match?match[1]:"__root__"};
 }
 async function suggest(project){
  const {scope,targetId}=target(project);
  const result=await request("GET","/api/workspace?project="+encodeURIComponent(project.id)+"&assembly="+encodeURIComponent(targetId));
  const steps=result.workspace?.recipe||[];
  dialog.replaceChildren();
  const form=el("div","project-manage-form");form.append(el("h2","","Suggest an instruction correction"));
  const stepLabel=el("label","","Step"),stepSelect=el("select","field");
  steps.forEach(step=>{const option=el("option","",step.title||"Untitled step");option.value=step.id;stepSelect.append(option)});
  stepLabel.append(stepSelect);form.append(stepLabel);
  const fieldLabel=el("label","","Field"),fieldSelect=el("select","field");
  for(const [field,label] of [["standard","Instruction"],["detail","Details"]]){
   const option=el("option","",label);option.value=field;fieldSelect.append(option);
  }
  fieldLabel.append(fieldSelect);form.append(fieldLabel);
  const original=el("p","muted");
  const display=()=>{const step=steps.find(step=>step.id===stepSelect.value);original.textContent="Current: "+String(step?.[fieldSelect.value]||"")};
  stepSelect.onchange=display;fieldSelect.onchange=display;display();form.append(original);
  const label=el("label","","Proposed replacement"),textarea=el("textarea","field");
  textarea.rows=5;label.append(textarea);form.append(label);
  const message=el("p","project-manage-message");form.append(message);
  const buttons=el("div","row"),send=el("button","btn primary","Submit suggestion"),close=el("button","btn","Close");
  if(!steps.length){send.disabled=true;message.textContent="This assembly does not have instruction steps yet."}
  send.onclick=async()=>{try{
   await request("POST",api(project),{scope,targetId,stepId:stepSelect.value,field:fieldSelect.value,suggestedText:textarea.value});
   dialog.close();
   // Suggestions are visible to the project owner in the summary queue.
  }catch(error){message.textContent=error.message}};
  close.onclick=()=>dialog.close();buttons.append(send,close);form.append(buttons);
  dialog.append(form);dialog.showModal();
 }

 const pendingCounts=new Map(),projectConfigs=new Map();
 const root=project=>document.querySelector('[data-assembly-tree="'+project.id+'"]');
 const targetLabel=p=>p.scope==="part"?"Part":p.targetId==="__root__"?"Top-level assembly":"Subassembly";
 const targetHash=(project,p)=>"#"+project.id+"/"+(p.scope==="part"?"part/":"workspace/")+encodeURIComponent(p.targetId);
 async function loadPending(project){
  const {proposals}=await request("GET",api(project));
  return (proposals||[]).filter(p=>p.status==="pending");
 }
 async function refresh(project){
  if(!project.isOwner)return;
  const pending=await loadPending(project);
  pendingCounts.set(project.id,pending.length);
  root(project)?.dispatchEvent(new Event("projectreviewchanged"));
  const section=document.getElementById(project.id);
  const heading=section?.querySelector(".assembly-workspace-page:not(.bom-part-workspace) > .workspace-heading");
  if(heading){
   heading.querySelector(".project-proposals-button")?.remove();
   // Review actions are useful only when the queue has actual work.
   if(pending.length){
    const button=el("button","btn project-proposals-button",pending.length+" "+(pending.length===1?"change":"changes")+" waiting");
    button.type="button";button.onclick=()=>review(project).catch(error=>alert(error.message));
    heading.append(button);
   }
  }
  let panel=section?.querySelector(".project-summary-review");
  if(!panel&&section){
   panel=el("section","project-summary-review");
   section.querySelector(".project-summary-owner-settings")?.before(panel);
  }
  if(!panel)return;
  panel.hidden=pending.length===0;
  panel.replaceChildren();
  if(!pending.length)return;
  const h=el("div","project-summary-review-header");
  h.append(el("h2","",pending.length+" "+(pending.length===1?"change":"changes")+" waiting"));
  const reviewButton=el("button","btn primary","Review suggestions");
  reviewButton.type="button";reviewButton.onclick=()=>review(project).catch(error=>alert(error.message));
  h.append(reviewButton);panel.append(h);
  const list=el("ul","project-summary-review-list");
  pending.forEach((p,i)=>{
   const row=el("li","");
   row.append(el("span","",targetLabel(p)+" · "+(i+1)+" of "+pending.length));
   const open=el("button","btn", "Open instruction");
   open.type="button";open.onclick=()=>{
    location.hash=targetHash(project,p);
    review(project).catch(error=>alert(error.message));
   };
   row.append(open);list.append(row);
  });
  panel.append(list);
 }
 async function review(project){
  const pending=await loadPending(project);
  dialog.replaceChildren();
  const form=el("div","project-manage-form");
  form.append(el("h2","",project.name+" — review changes"));
  if(!pending.length)form.append(el("p","muted","No suggested changes are awaiting review."));
  for(const proposal of pending){
   const section=el("section","project-proposal-review");
   section.append(el("strong","",targetLabel(proposal)+" · "+(proposal.field==="standard"?"Instruction change":"Details change")));
   section.append(el("p","muted","Original: "+proposal.originalText));
   section.append(el("p","","Suggested: "+proposal.suggestedText));
   const message=el("p","project-manage-message"),actions=el("div","row");
   const go=el("button","btn","Open instruction");
   go.type="button";go.onclick=()=>{
    dialog.close();location.hash=targetHash(project,proposal);
   };
   actions.append(go);
   for(const [action,label] of [["approve","Approve and apply"],["reject","Reject"]]){
    const button=el("button","btn"+(action==="approve"?" primary":""),label);
    button.onclick=async()=>{
     try{
      await request("PATCH",api(project),{id:proposal.id,action});
      section.remove();
      await refresh(project);
     }catch(error){message.textContent=error.message}
    };
    actions.append(button);
   }
   section.append(actions,message);form.append(section);
  }
  const close=el("button","btn","Close");close.onclick=()=>dialog.close();form.append(close);
  dialog.append(form);dialog.showModal();
 }
 function attach(project,user){
  projectConfigs.set(project.id,project);
  const heading=document.getElementById(project.id)?.querySelector(".assembly-workspace-page:not(.bom-part-workspace) > .workspace-heading");
  heading?.querySelector(".project-proposals-button")?.remove();
  if(project.isOwner){
   // Counts and review links are global for the project, not per-page.
   refresh(project).catch(error=>console.warn("Project review queue unavailable",error));
   return;
  }
  pendingCounts.delete(project.id);
  if(!user||project.editMode==="locked"||!heading)return;
  // Contributors still need a way to submit proposals; this is not a review button.
  const button=el("button","btn project-proposals-button","Suggest change");
  button.type="button";button.onclick=()=>suggest(project).catch(error=>alert(error.message));
  heading.append(button);
 }

 return {attach,getPendingCount:id=>pendingCounts.get(id),refresh:id=>{const project=projectConfigs.get(id);return project?refresh(project):Promise.resolve()}};
})();
