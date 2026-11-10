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
  }catch(error){message.textContent=error.message}};
  close.onclick=()=>dialog.close();buttons.append(send,close);form.append(buttons);
  dialog.append(form);dialog.showModal();
 }
 async function review(project){
  const {proposals}=await request("GET",api(project));
  dialog.replaceChildren();
  const form=el("div","project-manage-form");form.append(el("h2","",project.name+" — review suggestions"));
  const pending=(proposals||[]).filter(proposal=>proposal.status==="pending");
  if(!pending.length)form.append(el("p","muted","No suggested changes are awaiting review."));
  for(const proposal of pending){
   const section=el("section","project-proposal-review");
   section.append(el("strong","",proposal.field==="standard"?"Instruction change":"Details change"));
   section.append(el("p","muted","Original: "+proposal.originalText));
   section.append(el("p","","Suggested: "+proposal.suggestedText));
   const message=el("p","project-manage-message"),actions=el("div","row");
   for(const [action,label] of [["approve","Approve and apply"],["reject","Reject"]]){
    const button=el("button","btn"+(action==="approve"?" primary":""),label);
    button.onclick=async()=>{try{
     await request("PATCH",api(project),{id:proposal.id,action});
     section.remove();
    }catch(error){message.textContent=error.message}};
    actions.append(button);
   }
   section.append(actions,message);form.append(section);
  }
  const close=el("button","btn","Close");close.onclick=()=>dialog.close();form.append(close);
  dialog.append(form);dialog.showModal();
 }
 function attach(project,user){
  const heading=document.getElementById(project.id)?.querySelector(".assembly-workspace-page:not(.bom-part-workspace) > .workspace-heading");
  if(!heading)return;
  heading.querySelector(".project-proposals-button")?.remove();
  if(!user&&!project.isOwner)return;
  if(!project.isOwner&&project.editMode==="locked")return;
  const button=el("button","btn project-proposals-button",project.isOwner?"Review suggestions":"Suggest change");
  button.type="button";
  button.onclick=()=>{(project.isOwner?review(project):suggest(project)).catch(error=>alert(error.message))};
  heading.append(button);
 }
 return {attach};
})();
