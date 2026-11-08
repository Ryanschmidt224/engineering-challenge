/* New part dialog: shared library selection and wire assembly templates. */
(function(){
"use strict";
const AWG=[{g:24,r:84.22},{g:22,r:53},{g:20,r:33.3},{g:18,r:20.95},{g:16,r:13.17},{g:14,r:8.286},{g:12,r:5.211},{g:10,r:3.277},{g:8,r:2.061}];
const el=(tag,cls,txt)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(txt!==undefined)x.textContent=txt;return x};
const field=(label,tag="input",value="")=>{const l=el("label","library-field",label),v=el(tag,"field");if(tag==="input"){v.type="text";v.value=value}l.append(v);return {label:l,input:v}};
const option=(sel,value,label)=>{const o=el("option","",label);o.value=value;sel.append(o)};
function recommend(voltage,current,length,dropPercent=3){
 if(![voltage,current,length,dropPercent].every(n=>Number.isFinite(n)&&n>0))return null;
 const maxDrop=voltage*dropPercent/100;
 const matches=AWG.filter(({r})=>current*(2*length*r/1000)<=maxDrop);
 const chosen=matches[0]||null;
 return {chosen,drop:chosen?current*(2*length*chosen.r/1000):null,maxDrop};
}
function open({onCreate,bomOnly=false}){
 return new Promise(resolve=>{
 const dialog=el("dialog","library-part-dialog"),form=el("form","library-part-form");form.method="dialog";
 const heading=el("h2","",bomOnly?"New non-inventory part":"New feature-tree part"),subtitle=el("p","muted",bomOnly?"Create a BOM-only material or consumable. It will not appear in the feature tree.":"Create a custom part, or start from a reusable library part or wire assembly.");
 const mode=field("Part source","select");option(mode.input,"custom","Custom part");option(mode.input,"library","Library part");
 const customName=field("Part name");
 const chooser=el("div","library-picker-section hide");
 const category=field("Category","select");option(category.input,"wire","Wire & cable");option(category.input,"components","Fasteners, converters & other library parts");
 const workflow=el("div","wire-workflow-choice");
 const manualButton=el("button","btn","Manual Entry");manualButton.type="button";
 const wizardButton=el("button","btn","Wire Wizard");wizardButton.type="button";
 workflow.append(manualButton,wizardButton);
 const manualFields=el("div","wire-manual-fields hide");
 const wizardFields=el("div","wire-wizard-fields hide");
 const workflowHint=el("p","muted wire-workflow-hint","Choose Manual Entry to specify a wire, or Wire Wizard to calculate a preliminary size from your electrical requirements.");
 const wireType=field("Wire part type","select");option(wireType.input,"crimped","Crimped wire (wire assembly)");option(wireType.input,"raw","Wire / cable material");
 const search=field("Filter saved materials (name, AWG, construction)");
 search.input.placeholder="e.g. 18 AWG, stranded, black";
 const material=field("Saved library material (optional)","select");
 const gauge=field("Wire gauge (AWG)","select");AWG.forEach(({g})=>option(gauge.input,String(g),g+" AWG"));gauge.input.value="18";
 const construction=field("Conductor construction","select");option(construction.input,"stranded","Stranded / flexible");option(construction.input,"braided","Braided");option(construction.input,"solid","Solid");
 const length=field("Cut length (mm)");length.input.type="number";length.input.min="1";length.input.step="1";length.input.value="300";
 const endA=field("End A termination");endA.input.placeholder="e.g. ferrule, JST crimp, bare";
 const endB=field("End B termination");endB.input.placeholder="e.g. ferrule, JST crimp, bare";
 const qty=field(bomOnly?"Quantity (optional)":"Quantity");qty.input.type="number";qty.input.min="0.000001";qty.input.max="10000000";qty.input.step="any";qty.input.placeholder=bomOnly?"Leave blank if unknown":"1";qty.input.value=bomOnly?"":"1";
 const unit=field("Unit (optional)","select");
 for(const [value,title] of [["pcs","pieces (pcs)"],["m","meters (m)"],["mm","millimeters (mm)"],["ft","feet (ft)"],["g","grams (g)"],["kg","kilograms (kg)"],["mL","milliliters (mL)"],["L","liters (L)"],["","unspecified"]])option(unit.input,value,title);
 const hintUnits=el("p","muted library-picker-hint","Optional: leave quantity blank for consumables such as solder when usage is not yet known.");
 const results=el("p","library-picker-hint muted","Wire templates are selectable without an existing saved wire; a matching wire material will be reused or created in the shared wire library.");
 const calc=el("section","wire-gauge-helper");
 calc.append(el("h3","","Wire Wizard · electrical requirements"));
 const calcGrid=el("div","wire-gauge-grid");
 const voltage=field("DC supply voltage (V)");voltage.input.type="number";voltage.input.min="0.01";voltage.input.step="any";voltage.input.value="24";
 const current=field("Maximum continuous current (A)");current.input.type="number";current.input.min="0.001";current.input.step="any";current.input.value="2";
 const run=field("One-way wire length (m)");run.input.type="number";run.input.min="0.001";run.input.step="any";run.input.value="1";
 const drop=field("Maximum voltage drop (%)");drop.input.type="number";drop.input.min="0.1";drop.input.max="20";drop.input.step="0.1";drop.input.value="3";
 const useCase=field("Mechanical use","select");
 option(useCase.input,"moving","Moving, flexible, or subject to vibration");
 option(useCase.input,"stationary","Stationary, protected installation");
 const calcResult=el("div","wire-gauge-result");
 const apply=el("button","btn primary","Apply recommendation & review");apply.type="button";apply.disabled=true;
 const wizardBack=el("button","btn","Back to choices");wizardBack.type="button";
 const calcNote=el("p","muted","Preliminary DC copper voltage-drop sizing at 20°C, assuming equal outbound and return wire lengths. NOT an ampacity or safety rating. Before building, verify wire current rating, operating temperature, installation/bundling, insulation, and terminal/crimp compatibility against manufacturer specifications. Crimped and moving wires generally use stranded conductors.");
 calcGrid.append(voltage.label,current.label,run.label,drop.label,useCase.label,calcResult,apply,wizardBack,calcNote);
 calc.append(calcGrid);wizardFields.append(calc);
 const compSection=el("div","library-components hide");
 const commonCategory=field("Filter parts","select");[["all","All"],["screws","Fasteners"],["buck-converters","Buck converters"],["other","Other"]].forEach(([v,n])=>option(commonCategory.input,v,n));
 const commonSearch=field("Search saved library parts");commonSearch.input.placeholder="Search name, manufacturer, model";
 const commonSelect=field("Select part","select");
 compSection.append(commonCategory.label,commonSearch.label,commonSelect.label);
 const status=el("p","library-dialog-status");status.setAttribute("role","status");
 const footer=el("div","library-dialog-actions"),save=el("button","btn primary","Create part"),cancel=el("button","btn","Cancel");
 save.type="submit";cancel.type="button";footer.append(cancel,save);
 const wireSection=el("div","library-wire-section");
 manualFields.append(wireType.label,search.label,material.label,gauge.label,construction.label,length.label,endA.label,endB.label,results);
 wireSection.append(workflow,workflowHint,manualFields,wizardFields);
 chooser.append(category.label,wireSection,compSection);
 form.append(heading,subtitle,mode.label,customName.label,chooser,qty.label,unit.label,hintUnits,status,footer);
 dialog.append(form);document.body.append(dialog);
 let wires=[],commons=[],selectedRecommendation=null,finished=false,wireWorkflow=null;
 const close=result=>{if(finished)return;finished=true;dialog.close();dialog.remove();resolve(result||null)};
 cancel.onclick=()=>close(null);dialog.addEventListener("cancel",e=>{e.preventDefault();close(null)});
 const selectedWire=()=>wires.find(w=>w.id===material.input.value)||null;
 const refreshMaterials=()=>{
  const q=search.input.value.toLowerCase().trim(),previous=material.input.value;material.input.replaceChildren();
  option(material.input,"","Use gauge and construction below (create/reuse matching library material)");
  for(const w of wires.filter(w=>[w.name,w.awg,w.construction,w.color,w.insulation].join(" ").toLowerCase().includes(q)))option(material.input,w.id,[w.name,w.awg?w.awg+" AWG":"",w.construction].filter(Boolean).join(" · "));
  if([...material.input.options].some(o=>o.value===previous))material.input.value=previous;
 };
 const refreshCommon=()=>{
  const q=commonSearch.input.value.toLowerCase().trim(),cat=commonCategory.input.value;
  const filtered=commons.filter(p=>(cat==="all"||p.category===cat)&&[p.name,p.manufacturer,p.partNumber,p.specifications].join(" ").toLowerCase().includes(q));
  commonSelect.input.replaceChildren();option(commonSelect.input,"",filtered.length?"Select a saved part":"No saved parts match this filter");
  filtered.forEach(p=>option(commonSelect.input,p.id,p.name+(p.partNumber?" · "+p.partNumber:"")));
 };
 const selectWorkflow=value=>{
  wireWorkflow=value;
  manualFields.classList.toggle("hide",value!=="manual");
  wizardFields.classList.toggle("hide",value!=="wizard");
  workflowHint.classList.toggle("hide",value!==null);
  manualButton.classList.toggle("primary",value==="manual");
  wizardButton.classList.toggle("primary",value==="wizard");
  update();
 };
 manualButton.onclick=()=>selectWorkflow("manual");
 wizardButton.onclick=()=>{selectWorkflow("wizard");updateCalc()};
 wizardBack.onclick=()=>selectWorkflow(null);
 const update=()=>{
  const lib=mode.input.value==="library",wire=category.input.value==="wire";
  customName.label.classList.toggle("hide",lib);
  chooser.classList.toggle("hide",!lib);
  wireSection.classList.toggle("hide",!lib||!wire);
  compSection.classList.toggle("hide",!lib||wire);
  const crimp=wireType.input.value==="crimped";
  for(const f of [length,endA,endB])f.label.classList.toggle("hide",!crimp);
  save.classList.toggle("hide",lib&&wire&&wireWorkflow!=="manual");
 };
 const applyWire=()=>{
  const w=selectedWire();if(!w)return;
  const found=AWG.find(a=>String(a.g)===String(w.awg).replace(/\s*awg/i,"").trim());
  if(found)gauge.input.value=String(found.g);
  const c=(w.construction||"").toLowerCase();if(c.includes("solid"))construction.input.value="solid";else if(c.includes("braid"))construction.input.value="braided";else if(c.includes("strand"))construction.input.value="stranded";
 };
 function updateCalc(){
  const r=recommend(+voltage.input.value,+current.input.value,+run.input.value,+drop.input.value);
  selectedRecommendation=r?.chosen?.g??null;apply.disabled=selectedRecommendation===null;
  if(!r){calcResult.textContent="Enter positive voltage, current, wire length and voltage-drop percentage.";return}
  calcResult.textContent=r.chosen?"Preliminary recommendation: "+r.chosen.g+" AWG copper, "+((useCase.input.value==="moving"||wireType.input.value==="crimped")?"stranded / flexible":"solid for fixed, protected wiring (stranded also acceptable)")+". Estimated DC voltage drop "+r.drop.toFixed(3)+" V ("+(100*r.drop/(+voltage.input.value)).toFixed(2)+"%). This is not an ampacity check.":"No gauge in this 24–8 AWG range meets the selected voltage-drop target. Consider a larger wire, shorter run, or a different design.";
 }
 [voltage.input,current.input,run.input,drop.input].forEach(e=>e.addEventListener("input",updateCalc));
 useCase.input.onchange=updateCalc;
 wireType.input.addEventListener("change",updateCalc);
 apply.onclick=()=>{
  if(selectedRecommendation===null)return;
  gauge.input.value=String(selectedRecommendation);
  construction.input.value=useCase.input.value==="moving"||wireType.input.value==="crimped"?"stranded":"solid";
  material.input.value="";
  length.input.value=String(Math.max(1,Math.round(Number(run.input.value)*1000)));
  selectWorkflow("manual");
  status.textContent="Wizard applied "+selectedRecommendation+" AWG "+construction.input.value+" copper and "+length.input.value+" mm cut length. Review the wire and termination details before creating the part; ampacity is not verified.";
 };
 unit.input.value="pcs";
 mode.input.onchange=()=>{if(bomOnly&&mode.input.value==="library"&&category.input.value==="wire"&&unit.input.value==="pcs")unit.input.value="m";update()};
 category.input.onchange=()=>{if(bomOnly&&category.input.value==="wire"&&mode.input.value==="library"&&unit.input.value==="pcs")unit.input.value="m";update()};wireType.input.onchange=update;search.input.oninput=refreshMaterials;material.input.onchange=applyWire;gauge.input.onchange=()=>{material.input.value=""};construction.input.onchange=()=>{material.input.value=""};commonCategory.input.onchange=refreshCommon;commonSearch.input.oninput=refreshCommon;
 form.addEventListener("submit",async e=>{
  e.preventDefault();
  if(!form.reportValidity())return;
  let payload;
  const rawCount=qty.input.value.trim();const count=rawCount===""?null:Number(rawCount);
  if(count!==null&&(!Number.isFinite(count)||count<=0||count>10000000)){status.textContent="Quantity must be positive, or left blank.";return}
  if(mode.input.value==="custom"){
   const name=customName.input.value.trim();if(!name||name.length>100){status.textContent="Enter a part name (up to 100 characters).";return}
   payload={name,quantity:count,specifications:[]};
  }else if(category.input.value==="components"){
   const p=commons.find(p=>p.id===commonSelect.input.value);if(!p){status.textContent="Select a saved library part.";return}
   payload={name:p.name,quantity:count,manufacturer:p.manufacturer||"",model:p.partNumber||"",category:p.category||"Library part",specifications:[{name:"Library part ID",value:p.id},{name:"Library specifications",value:p.specifications||"Shared library component"}]};
  }else{
   if(wireWorkflow!=="manual"){status.textContent="Choose Manual Entry or apply the Wire Wizard recommendation first.";return}
   const g=Number(gauge.input.value),str=construction.input.value,crimp=wireType.input.value==="crimped";
   const mm=Number(length.input.value);
   if(crimp&&(!Number.isFinite(mm)||mm<=0||mm>1000000)){status.textContent="Enter a valid cut length between 1 and 1,000,000 mm.";return}
   const w=selectedWire(),designation=g+" AWG "+(str==="solid"?"solid":str==="braided"?"braided":"stranded")+" copper";
   const name=(crimp?"Crimped wire — ":"Wire — ")+designation;
   const specs=[{name:"AWG",value:String(g)},{name:"Conductor",value:str},{name:"Material",value:"Copper (assumed; verify with supplier)"}];
   if(w){specs.push({name:"Library wire ID",value:w.id});if(w.insulation)specs.push({name:"Insulation",value:w.insulation});if(w.color)specs.push({name:"Color",value:w.color})}
   if(crimp)specs.push({name:"Cut length (mm)",value:String(mm)},{name:"End A",value:endA.input.value.trim()||"Unspecified"},{name:"End B",value:endB.input.value.trim()||"Unspecified"});
   payload={name,quantity:count,category:crimp?"Crimped wire":"Wire & cable",manufacturer:w?.manufacturer||"",model:w?.partNumber||"",specifications:specs};
   payload.wireInfo={gauge:g,construction:str,crimp,mm,endA:endA.input.value.trim(),endB:endB.input.value.trim(),wireId:w?.id||null};
  }
  payload.quantityUnit=unit.input.value;
  save.disabled=true;status.textContent="Creating part…";
  try{await onCreate(payload);close({created:true})}catch(err){status.textContent=err.message||String(err);save.disabled=false}
 });
 update();refreshMaterials();refreshCommon();updateCalc();dialog.showModal();
 Promise.all([fetch("/api/wires",{cache:"no-store"}).then(r=>r.ok?r.json():Promise.reject(Error("Wire library unavailable"))),fetch("/api/commonparts",{cache:"no-store"}).then(r=>r.ok?r.json():Promise.reject(Error("Part library unavailable")))]).then(([w,c])=>{
  if(finished)return;wires=w.wires||[];commons=c.parts||[];refreshMaterials();refreshCommon();
 }).catch(err=>{if(!finished)status.textContent="Could not load all saved library entries: "+err.message+". Wire templates can still be used."});
 customName.input.focus();
 });
}
window.BSLibraryPartPicker={open,recommend};
})();