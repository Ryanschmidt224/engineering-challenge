/* Project-only part creation. Reusable items are created through Workshop families. */
const el=(tag,cls="",text="")=>{const node=document.createElement(tag);node.className=cls;node.textContent=text;return node;};
const field=(label,tag="input",value="")=>{const row=el("label","library-field",label),input=el(tag,"field");if(tag==="input")input.type="text";input.value=value;row.append(input);return {label:row,input};};
const option=(select,value,label)=>{const entry=el("option","",label);entry.value=value;select.append(entry);};
export function openPartCreator({onCreate,project="",assemblyId=null}){
 return new Promise(resolve=>{
  const dialog=el("dialog","library-part-dialog"),form=el("form","library-part-form");
  const close=value=>{dialog.close();dialog.remove();resolve(value);};
  dialog.oncancel=event=>{event.preventDefault();close({created:false});};
  const itemKind=field("Item type","select");for(const [value,label] of [["part","Part"],["document","Document"],["code","Code"]])option(itemKind.input,value,label);
  const source=el("fieldset","library-workshop-choice-group");source.append(el("legend","","Part source"));
  const workshop=el("button","btn","Use from Workshop");workshop.type="button";
  workshop.onclick=()=>{const url=new URL("workshop.html",location.href);if(project)url.searchParams.set("project",project);if(assemblyId)url.searchParams.set("assembly",assemblyId);url.searchParams.set("return",location.hash);close({created:false});location.href=url.href;};
  source.append(workshop,el("p","muted","Choose a family or product in Workshop, or create a project-only part below."));
  const numberChoice=el("fieldset","library-number-choice");numberChoice.append(el("legend","","Part number"));
  const numbering=el("div","library-number-options");
  const auto=el("input");auto.type="radio";auto.name="new-part-number-mode";auto.value="auto";auto.checked=true;
  const automatic=el("label","library-auto-number","Auto assign part number");automatic.prepend(auto);
  const tip=el("button","library-auto-number-tip","ⓘ");tip.type="button";tip.title="Part number will be assigned according to the next available part number as defined in the part settings page.";tip.setAttribute("aria-label",tip.title);tip.dataset.bsHelpTitle="Automatic part number";
  const manual=el("input");manual.type="radio";manual.name=auto.name;manual.value="manual";
  const manualLabel=el("label","library-auto-number","User assign part number");manualLabel.prepend(manual);numbering.append(automatic,tip,manualLabel);
  const number=field("Project BOM number (not manufacturer's number)");number.input.maxLength=30;numberChoice.append(numbering,number.label);
  const identity=el("section","library-identity-section");
  const partClassification=field("Part type","select");for(const [value,label] of [["purchased","Off-the-shelf"],["custom","Custom — made in-house"],["custom_purchased","Custom — purchased"]])option(partClassification.input,value,label);
  const container=field("Container"),caption=el("span","library-function-caption","Container");caption.append(el("span","library-container-name-hint","(name)"));
  const help=el("button","library-function-tip","ⓘ");help.type="button";help.dataset.bsHelpTopic="container";help.dataset.bsHelpTitle="How containers work";help.title="A container is an item in the project hierarchy that keeps its work instructions, tests and history. Give it a short project name.";help.setAttribute("aria-label","Container help — double-click for examples");caption.append(help);container.label.replaceChildren(caption,container.input);container.input.maxLength=20;container.input.placeholder="e.g. Motor switch";
  const name=field("Name");name.input.maxLength=100;
  const manufacturer=field("Manufacturer"),mpn=field("Mfg part # (MPN)"),description=field("Full description","textarea");manufacturer.input.maxLength=160;mpn.input.maxLength=160;description.input.maxLength=2000;
  const quantity=field("Quantity");quantity.input.type="number";quantity.input.step="any";quantity.input.min="0.000001";quantity.input.max="10000000";
  identity.append(partClassification.label,container.label,name.label,manufacturer.label,mpn.label,description.label,quantity.label);
  const status=el("p","library-status");status.setAttribute("role","status");
  const actions=el("div","library-dialog-actions"),save=el("button","btn primary","Create part"),cancel=el("button","btn","Cancel");save.type="submit";cancel.type="button";cancel.onclick=()=>close({created:false});actions.append(save,cancel);
  form.append(el("h2","","New part"),itemKind.label,source,numberChoice,identity,status,actions);dialog.append(form);document.body.append(dialog);
  const update=()=>{const part=itemKind.input.value==="part";source.hidden=!part;partClassification.label.hidden=!part;container.label.hidden=!part;container.input.required=part;name.label.hidden=part;name.input.required=!part;manufacturer.label.hidden=mpn.label.hidden=!part||partClassification.input.value==="custom";description.label.hidden=!part;quantity.label.hidden=!part;numberChoice.hidden=!part;number.label.hidden=auto.checked;number.input.required=part&&manual.checked;save.textContent=part?"Create part":itemKind.input.value==="code"?"Create code item":"Create document";};
  itemKind.input.onchange=update;partClassification.input.onchange=update;auto.onchange=update;manual.onchange=update;
  form.onsubmit=async event=>{
   event.preventDefault();if(!form.reportValidity())return;
   const part=itemKind.input.value==="part",count=quantity.input.value===""?null:Number(quantity.input.value);
   const payload={name:(part?container.input:name.input).value.trim(),itemType:part?"part":"document",partType:itemKind.input.value==="code"?"code":partClassification.input.value,quantity:part?count:itemKind.input.value==="code"?null:1,quantityUnit:"pcs",specifications:[],assignNumber:part&&auto.checked,partNumber:part&&manual.checked?number.input.value.trim().toUpperCase()||null:null,hideFromFeatureTree:false,isTool:false};
   if(part)Object.assign(payload,{manufacturer:payload.partType==="custom"?"":manufacturer.input.value.trim(),model:payload.partType==="custom"?"":mpn.input.value.trim(),description:description.input.value.trim(),projectDetails:{featureTreeName:container.input.value.trim()}});
   save.disabled=true;status.textContent="Creating project item…";
   try{await onCreate(payload);close({created:true});}catch(error){status.textContent=error.message||"Could not create item. Your form is preserved.";save.disabled=false;}
  };
  update();dialog.showModal();itemKind.input.focus();
 });
}
