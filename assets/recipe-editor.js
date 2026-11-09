/* Discrete, progressively disclosed recipe steps. Existing API/schema unchanged. */
(function(){
 "use strict";
 const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node};
 const button=(label,fn,cls="btn")=>{const node=el("button",cls,label);node.type="button";node.onclick=fn;return node};
 const normalize=x=>({id:x.id,title:x.title||"",standard:x.standard||"",detail:x.detail||"",kind:x.kind||"action"});
 const kinds=[["action","Action"],["inspection","Inspection"],["measurement","Measurement"],["explanation","Explanation"]];
 const newId=()=>crypto?.randomUUID?.()||"step_"+Date.now()+"_"+Math.random().toString(36).slice(2);
 function mount(article,options={}){
  if(!article)return null;
  const panel=el("section","recipe-editor recipe-compact"),content=el("div","recipe-content"),feedback=el("p","recipe-feedback muted");
  panel.append(content,feedback);
  article.querySelector("h2")?.after(panel);
  const admin=()=>!!options.admin?.();
  let steps=[],expanded=null,dirty=false,level="standard";
  try{const saved=localStorage.getItem("bs-recipe-detail");if(["brief","standard","detailed"].includes(saved))level=saved}catch{}
  const changed=()=>{dirty=true;options.onChange?.()};
  const saveHint=()=>{feedback.textContent="Step edited. Use Save instructions below to keep your changes."};
  const editField=(value,placeholder,onValue,rows=0)=>{
   const field=el(rows?"textarea":"input","field recipe-input");
   if(rows)field.rows=rows;else field.type="text";
   field.value=value;field.placeholder=placeholder;
   // On the first click or keyboard focus, select the old value so typing
   // replaces it. Later clicks within the focused field allow caret edits.
   let firstFocus=false;
   field.addEventListener("focus",()=>{firstFocus=true;field.select()});
   field.addEventListener("click",()=>{if(firstFocus){field.select();firstFocus=false}});
   field.addEventListener("blur",()=>{firstFocus=false});
   field.oninput=()=>{onValue(field.value);changed();saveHint()};
   return field;
  };
  const selectedText=area=>{
   const selection=window.getSelection?.();
   if(!selection||selection.isCollapsed)return "";
   const text=String(selection).trim();
   if(!text||text.length>220||!area.contains(selection.getRangeAt(0).commonAncestorContainer))return "";
   return text;
  };
  const move=(index,offset)=>{
   const destination=index+offset;if(destination<0||destination>=steps.length)return;
   [steps[index],steps[destination]]=[steps[destination],steps[index]];
   expanded=steps[destination].id;changed();saveHint();render();
  };
  function render(){
   content.replaceChildren();
   const hasDetail=steps.some(s=>s.standard?.trim()||s.detail?.trim());
   if(hasDetail){
    const preferences=el("div","recipe-detail-controls");
    preferences.append(el("span","muted","Show"));
    for(const [key,label] of [["brief","Brief"],["standard","Standard"],["detailed","Detailed"]]){
     const choice=button(label,()=>{level=key;try{localStorage.setItem("bs-recipe-detail",key)}catch{}render()},"btn recipe-detail-button"+(key===level?" active":""));
     choice.setAttribute("aria-pressed",String(key===level));preferences.append(choice);
    }
    content.append(preferences);
   }
   for(let i=0;i<steps.length;i++){
    const step=steps[i],card=el("details","recipe-one-step");
    card.dataset.stepId=step.id;card.open=expanded===step.id;
    const summary=el("summary","recipe-one-step-summary");
    const name=el("span","recipe-one-step-title",(i+1)+". "+(step.title||"Untitled step"));
    summary.append(name);
    if(step.kind!=="action")summary.append(el("small","recipe-kind-caption",kinds.find(k=>k[0]===step.kind)?.[1]||step.kind));
    card.append(summary);
    card.addEventListener("toggle",()=>{if(card.open)expanded=step.id;else if(expanded===step.id)expanded=null});
    const body=el("div","recipe-one-step-body");
    if(admin()){
     const title=el("label","recipe-one-field","Step");
     const nameInput=editField(step.title,"Describe the action",v=>{step.title=v;name.textContent=(i+1)+". "+(v||"Untitled step")});
     nameInput.maxLength=180;title.append(nameInput);body.append(title);
     const optional=(property,label,placeholder)=>{
      const present=!!step[property]?.trim();
      if(present){
       const fieldLabel=el("label","recipe-one-field",label);
       const input=editField(step[property],placeholder,v=>step[property]=v,3);
       input.maxLength=property==="standard"?4000:8000;
       fieldLabel.append(input);body.append(fieldLabel);
       const clear=button("Remove "+label.toLowerCase(),()=>{step[property]="";changed();saveHint();render()},"btn recipe-small-action");
       body.append(clear);
      }else{
       body.append(button("+ Add "+label.toLowerCase(),()=>{
        const fieldLabel=el("label","recipe-one-field",label);
        const input=editField("",placeholder,v=>step[property]=v,3);
        input.maxLength=property==="standard"?4000:8000;
        fieldLabel.append(input);
        // Replace this single optional action with its editor without re-rendering the step.
        fieldLabel.dataset.property=property;
        const action=[...body.querySelectorAll("button")].find(b=>b.dataset.addField===property);
        action?.replaceWith(fieldLabel);input.focus();
       },"btn recipe-small-action"));
       body.lastElementChild.dataset.addField=property;
      }
     };
     optional("standard","Instructions","How to perform this action");
     optional("detail","Extra guidance","Optional clarification for learners who want more detail");
     if(step.kind!=="action"){
      const kind=el("label","recipe-one-field","Type"),select=el("select","field");
      for(const [value,label] of kinds){const option=el("option","",label);option.value=value;select.append(option)}
      select.value=step.kind;select.onchange=()=>{step.kind=select.value;changed();saveHint();render()};
      kind.append(select);body.append(kind);
     }else{
      const setType=button("+ Set step type",()=>{step.kind="inspection";changed();saveHint();render()},"btn recipe-small-action");
      body.append(setType);
     }
     const actions=el("div","recipe-edit-controls");
     const up=button("↑",()=>move(i,-1));up.disabled=i===0;up.title="Move up";
     const down=button("↓",()=>move(i,1));down.disabled=i===steps.length-1;down.title="Move down";
     const duplicate=button("Duplicate",()=>{const copy={...normalize(step),id:newId()};steps.splice(i+1,0,copy);expanded=copy.id;changed();saveHint();render()});
     const remove=button("Remove",()=>{if(!confirm("Remove this step?"))return;steps.splice(i,1);expanded=null;changed();saveHint();render()});
     actions.append(up,down,duplicate,remove);body.append(actions);
    }else{
     const displayed=el("div","recipe-reader-text");
     if(level!=="brief"&&step.standard.trim())displayed.append(el("p","",step.standard));
     if(level==="detailed"&&step.detail.trim())displayed.append(el("p","",step.detail));
     if(displayed.childElementCount){
      body.append(displayed);
      let highlighted="";
      displayed.addEventListener("mouseup",()=>{highlighted=selectedText(displayed)||highlighted});
      displayed.addEventListener("keyup",()=>{highlighted=selectedText(displayed)||highlighted});
      body.append(button("Please explain this",()=>{
       const selected=selectedText(displayed)||highlighted;
       if(!selected){feedback.textContent="Highlight an instruction phrase first.";return}
       if(window.BSExplainText)window.BSExplainText(selected,{stepId:step.id,stepTitle:step.title,fullText:step.standard+"\n"+step.detail});
      },"btn recipe-explain"));
     }
    }
    card.append(body);content.append(card);
   }
   if(admin()){
    const add=button("+ Add step",()=>{
     const item={id:newId(),title:"New step",standard:"",detail:"",kind:"action"};
     steps.push(item);expanded=item.id;changed();saveHint();render();
     const newCard=[...content.querySelectorAll(".recipe-one-step")].find(x=>x.dataset.stepId===item.id);
     newCard?.querySelector("input")?.focus();
    },"btn recipe-add-step");
    content.append(add);
   }
  }
  function setData(data){
   steps=Array.isArray(data?.recipe)?data.recipe.map(normalize):[];
   dirty=false;expanded=null;feedback.textContent="";
   render();
  }
  render();
  return {setData,getData:()=>steps.map(normalize),isDirty:()=>dirty,render};
 }
 window.BSRecipes={mount};
})();