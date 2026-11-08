/* Discrete recipe editor and learner-controlled instructions.
   The workspace API owns persistence; this module never saves independently. */
(function(){
 "use strict";
 const make=(tag,className,text)=>{
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(text!==undefined)node.textContent=text;
  return node;
 };
 const addButton=(label,handler,className="btn")=>{
  const button=make("button",className,label);button.type="button";button.onclick=handler;return button;
 };
 const copyStep=step=>({id:step.id,title:step.title,standard:step.standard||"",detail:step.detail||"",kind:step.kind||"action"});
 const kinds=[["action","Action"],["inspection","Inspection"],["measurement","Measurement"],["explanation","Explanation"]];
 function mount(article,options={}){
  if(!article)return null;
  const panel=make("section","recipe-editor");
  const head=make("div","recipe-heading"),headline=make("h3","","Recipe steps");
  const subtitle=make("p","muted","One action per step. Learners choose how much detail to see.");
  const actions=make("div","recipe-heading-actions");
  const toggle=addButton("Edit recipe",()=>{editing=!editing;render()},"btn");
  actions.append(toggle);head.append(headline,actions);
  const content=make("div","recipe-content");
  panel.append(head,subtitle,content);
  const instruction=article.querySelector("textarea");
  if(instruction){
   const legacy=make("details","recipe-legacy");
   const summary=make("summary","","Original written instructions");
   const hint=make("p","muted","These are preserved separately. You can copy them into recipe steps whenever you choose.");
   instruction.before(legacy);legacy.append(summary,hint,instruction);
   article.querySelector("h2")?.after(panel);
  }else article.append(panel);
  let steps=[],editing=false,selectedStep=0,level="standard",dirty=false;
  const isAdmin=()=>!!options.admin?.();
  const noteChange=()=>{dirty=true;options.onChange?.();};
  const textfield=(value,placeholder,onChange,rows=0)=>{
   const field=make(rows?"textarea":"input","field recipe-input");
   if(rows)field.rows=rows;else field.type="text";
   field.value=value;field.placeholder=placeholder;
   field.oninput=()=>{onChange(field.value);noteChange()};
   return field;
  };
  const select=(value,onChange)=>{
   const sel=make("select","field recipe-kind");
   for(const [id,label] of kinds){const opt=make("option","",label);opt.value=id;sel.append(opt)}
   sel.value=value;sel.onchange=()=>{onChange(sel.value);noteChange()};return sel;
  };
  const newId=()=>typeof crypto!=="undefined"&&crypto.randomUUID?crypto.randomUUID():"step_"+Date.now()+"_"+Math.random().toString(36).slice(2);
  const levelButtons=(mount)=>{
   const control=make("div","recipe-detail-controls");
   control.append(make("span","muted","Detail"));
   for(const [id,label] of [["brief","Brief"],["standard","Standard"],["detailed","Detailed"]]){
    const btn=addButton(label,()=>{level=id;render()},"btn recipe-detail-button"+(level===id?" active":""));
    btn.setAttribute("aria-pressed",String(level===id));
    control.append(btn);
   }
   mount.append(control);
  };
  const selectedText=(element)=>{
   const selection=window.getSelection?.();
   if(!selection||selection.isCollapsed)return "";
   const text=String(selection).trim();
   if(!text||text.length>220)return "";
   const range=selection.getRangeAt(0);
   if(!element.contains(range.commonAncestorContainer))return "";
   return text;
  };
  function renderBuilder(target){
   const layout=make("div","recipe-builder");
   if(!steps.length){layout.append(make("p","muted","No recipe steps yet. Add your first step below."))}
   for(let index=0;index<steps.length;index++){
    const step=steps[index],card=make("article","recipe-edit-step");
    const bar=make("div","recipe-step-toolbar");
    bar.append(make("strong","",String(index+1)+". "+(step.title||"Untitled")));
    const controls=make("div","recipe-edit-controls");
    const move=(direction)=>{const targetIndex=index+direction;if(targetIndex<0||targetIndex>=steps.length)return;[steps[index],steps[targetIndex]]=[steps[targetIndex],steps[index]];selectedStep=targetIndex;noteChange();render()};
    const up=addButton("↑",()=>move(-1),"btn");up.title="Move step up";up.disabled=index===0;
    const down=addButton("↓",()=>move(1),"btn");down.title="Move step down";down.disabled=index===steps.length-1;
    const duplicate=addButton("Duplicate",()=>{steps.splice(index+1,0,{...copyStep(step),id:newId()});noteChange();render()});
    const remove=addButton("Remove",()=>{if(!window.confirm("Remove this recipe step?"))return;steps.splice(index,1);selectedStep=Math.min(selectedStep,Math.max(0,steps.length-1));noteChange();render()});
    controls.append(up,down,duplicate,remove);bar.append(controls);card.append(bar);
    const fields=make("div","recipe-step-fields");
    const title=make("label","","Action / short title");
    title.append(textfield(step.title,"e.g. Strip 6 mm of insulation",v=>{step.title=v;bar.querySelector("strong").textContent=String(index+1)+". "+v}));
    const kind=make("label","","Step type");kind.append(select(step.kind,v=>step.kind=v));
    const standard=make("label","recipe-wide-field","Standard instructions (optional)");
    standard.append(textfield(step.standard,"Describe how to perform this action.",v=>step.standard=v,3));
    const detail=make("label","recipe-wide-field","Extra guidance (optional)");
    detail.append(textfield(step.detail,"Add the extra steps, checks or context a beginner might need.",v=>step.detail=v,3));
    fields.append(title,kind,standard,detail);card.append(fields);layout.append(card);
   }
   const add=addButton("+ Add step",()=>{steps.push({id:newId(),title:"New step",standard:"",detail:"",kind:"action"});selectedStep=steps.length-1;noteChange();render();layout.querySelector(".recipe-edit-step:last-of-type input")?.focus()},"btn primary");
   const importExisting=addButton("Import original instructions",()=>{
    const raw=instruction?.value?.trim()||"";
    if(!raw)return;
    if(steps.length&&!confirm("Add the original written instructions as more steps? Existing recipe steps will be kept."))return;
    const chunks=raw.split(/\n\s*\n|\n(?=\s*\d+[.)]\s)/).map(x=>x.trim().replace(/^\d+[.)]\s*/,"")).filter(Boolean);
    for(const chunk of chunks)steps.push({id:newId(),title:chunk.split("\n")[0].slice(0,120),standard:chunk,detail:"",kind:"action"});
    noteChange();render();
   });
   importExisting.disabled=!instruction?.value?.trim();
   const footer=make("div","recipe-edit-footer");footer.append(add,importExisting);layout.append(footer);
   target.append(layout);
  }
  function renderBuild(target){
   const body=make("section","recipe-builder-view");
   if(!steps.length){
    body.append(make("p","muted","No recipe steps yet. Existing written instructions remain available below."));
    target.append(body);return;
   }
   selectedStep=Math.max(0,Math.min(selectedStep,steps.length-1));
   levelButtons(body);
   const current=steps[selectedStep],bar=make("div","recipe-reader-heading");
   bar.append(make("span","muted","Step "+(selectedStep+1)+" of "+steps.length));
   bar.append(make("span","recipe-step-type",kinds.find(x=>x[0]===current.kind)?.[1]||"Action"));
   body.append(bar);
   body.append(make("h4","recipe-reader-title",current.title));
   const selectedArea=make("div","recipe-reader-text");
   if(level!=="brief"&&current.standard?.trim())selectedArea.append(make("p","",current.standard));
   if(level==="detailed"&&current.detail?.trim())selectedArea.append(make("p","",current.detail));
   if(!selectedArea.childElementCount&&level!=="brief")selectedArea.append(make("p","muted","No additional guidance for this step."));
   body.append(selectedArea);
   const explain=addButton("Please explain this",()=>{
    const text=selectedText(selectedArea)||selectedText(body);
    if(!text){feedback.textContent="Highlight a word or phrase in the instructions first.";return}
    feedback.textContent="";
    const context={stepId:current.id,stepTitle:current.title,fullText:current.standard+"\n"+current.detail};
    if(typeof window.BSExplainText==="function")window.BSExplainText(text,context);
    else feedback.textContent="Explanation lookup isn't available yet.";
   },"btn recipe-explain");
   body.append(explain);
   body.append(make("p","recipe-selection-hint muted","Highlight any phrase above, then choose Please explain this."));
   const nav=make("div","recipe-reader-nav");
   const previous=addButton("← Previous",()=>{selectedStep--;render()}),next=addButton("Next →",()=>{selectedStep++;render()},"btn primary");
   previous.disabled=selectedStep===0;next.disabled=selectedStep===steps.length-1;
   nav.append(previous,next);body.append(nav);
   target.append(body);
  }
  const feedback=make("p","recipe-feedback muted");panel.append(feedback);
  function render(){
   toggle.classList.toggle("hide",!isAdmin());
   toggle.textContent=editing?"View recipe":"Edit recipe";
   content.replaceChildren();
   if(editing&&isAdmin())renderBuilder(content);else renderBuild(content);
  }
  function setData(data){
   steps=Array.isArray(data?.recipe)?data.recipe.map(copyStep):[];
   selectedStep=0;editing=false;dirty=false;feedback.textContent="";render();
  }
  render();
  return {setData,getData:()=>steps.map(copyStep),isDirty:()=>dirty,render};
 }
 window.BSRecipes={mount};
})();