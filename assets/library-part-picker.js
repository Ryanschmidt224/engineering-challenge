/* New part dialog: shared library selection and wire assembly templates. */
(function(){
"use strict";
const AWG=[{g:24,r:84.22},{g:22,r:53},{g:20,r:33.3},{g:18,r:20.95},{g:16,r:13.17},{g:14,r:8.286},{g:12,r:5.211},{g:10,r:3.277},{g:8,r:2.061}];
const el=(tag,cls,txt)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(txt!==undefined)x.textContent=txt;return x};
const field=(label,tag="input",value="")=>{const l=el("label","library-field",label),v=el(tag,"field");if(tag==="input"){v.type="text";v.value=value}l.append(v);return {label:l,input:v}};
const option=(sel,value,label)=>{const o=el("option","",label);o.value=value;sel.append(o)};
// Conservative planning thresholds, NOT rated ampacity values. Manufacturer
// wire, insulation, routing, bundling, terminations and applicable codes govern.
const PLANNING_AMPS={24:1,22:2,20:3,18:5,16:8,14:12,12:15,10:20,8:30};
function recommend(voltage,current,length,dropPercent=3,purpose="power"){
 if(![voltage,current,length,dropPercent].every(n=>Number.isFinite(n)&&n>0))return null;
 const preferred=purpose==="signal"?22:18;
 const maxDrop=voltage*dropPercent/100;
 const candidates=AWG.filter(({g,r})=>g<=preferred&&
  current<=PLANNING_AMPS[g]&&current*(2*length*r/1000)<=maxDrop);
 const chosen=candidates[0]||null;
 const pref=AWG.find(w=>w.g===preferred);
 const preferredDrop=current*(2*length*pref.r/1000);
 const reasons=[];
 if(current>PLANNING_AMPS[preferred])reasons.push("the planning current threshold ("+PLANNING_AMPS[preferred]+" A)");
 if(preferredDrop>maxDrop)reasons.push("the voltage-drop limit ("+preferredDrop.toFixed(3)+" V estimated)");
 return {chosen,drop:chosen?current*(2*length*chosen.r/1000):null,maxDrop,preferred,reasons};
}
function open({onCreate,bomOnly=false}){
 return new Promise(resolve=>{
 const dialog=el("dialog","library-part-dialog"),form=el("form","library-part-form");form.method="dialog";
 const heading=el("h2","",bomOnly?"New BOM-only part":"New feature-tree part"),subtitle=el("p","muted",bomOnly?"Create a BOM-only material or consumable. It will not appear in the feature tree.":"Enter the details for any part, whether purchased or made, or choose a reusable part or wire configuration.");
 const mode=field("How would you like to add this part?","select");option(mode.input,"custom","Enter part details");option(mode.input,"library","Choose from saved parts / wire tools");
 const customName=field("Part name");
 const chooser=el("div","library-picker-section hide");
 const category=field("Part category","select");option(category.input,"wire","Wire & cable");option(category.input,"components","Fasteners, converters & other saved parts");
 const workflow=el("div","wire-workflow-choice");
 const manualButton=el("button","btn","Manual Entry");manualButton.type="button";
 const wizardButton=el("button","btn","Wire Wizard");wizardButton.type="button";
 workflow.append(manualButton,wizardButton);
 const manualFields=el("div","wire-manual-fields hide");
 const wizardFields=el("div","wire-wizard-fields hide");
 const workflowHint=el("p","muted wire-workflow-hint","Choose Manual Entry to specify a wire, or Wire Wizard to calculate a preliminary size from your electrical requirements.");
 const wireType=field("Wire part type","select");option(wireType.input,"crimped","Crimped wire (wire assembly)");option(wireType.input,"raw","Wire / cable material");
 const gauge=field("Wire gauge (AWG)","select");AWG.forEach(({g})=>option(gauge.input,String(g),g+" AWG"));gauge.input.value="18";
 const construction=field("Conductor construction","select");option(construction.input,"stranded","Stranded / flexible");option(construction.input,"braided","Braided");option(construction.input,"solid","Solid");
 const length=field("Cut length (inches)");length.input.type="number";length.input.min="0.001";length.input.step="any";length.input.value="12";
 const terminationOptions=[["","Not specified"],["bare","Bare / stripped"],["ferrule","Ferrule"],["ring","Ring terminal"],["spade","Spade / fork terminal"],["quick-disconnect","Quick-disconnect terminal"],["jst","JST-style crimp contact"],["dupont","DuPont-style crimp contact"],["solder","Soldered connection"],["other","Other — specify"]];
 // Preferred terminations depend on the mating hardware, not the wire alone.
 const terminationOrder={
  terminal:["ferrule","bare"],connector:["jst","dupont"],stud:["ring","spade"],
  blade:["quick-disconnect"],pcb:["solder"],unknown:[]
 };
 const terminationField=side=>{
  const target=field("End "+side+" connects to","select");
  for(const [value,label] of [["unknown","Not sure / select manually"],["terminal","Screw / spring terminal block"],["connector","Connector housing (JST / DuPont style)"],["stud","Stud / screw terminal"],["blade","Blade / quick-disconnect tab"],["pcb","PCB solder pad"]])option(target.input,value,label);
  const choice=field("End "+side+" termination","select");
  const other=field("Other termination — End "+side);
  const hint=el("p","library-picker-hint muted","Choose the matching connector or terminal first. Recommended options are preferred only when supported by that hardware.");
  other.input.maxLength=120;other.input.placeholder="Describe terminal or connector";
  other.label.classList.add("hide");
  const populate=()=>{
   const previous=choice.input.value;
   const recommended=terminationOrder[target.input.value]||[];
   const ranked=[...recommended,...terminationOptions.map(([value])=>value).filter(value=>!recommended.includes(value))];
   choice.input.replaceChildren();
   for(const value of ranked){
    const entry=terminationOptions.find(([id])=>id===value);
    option(choice.input,value,entry[1]+(recommended.includes(value)?" — Recommended":""));
   }
   choice.input.value=[...choice.input.options].some(o=>o.value===previous)?previous:"";
   other.label.classList.toggle("hide",choice.input.value!=="other");
  };
  target.input.onchange=populate;
  choice.input.onchange=()=>other.label.classList.toggle("hide",choice.input.value!=="other");
  populate();
  return {target,choice,other,hint,value:()=>choice.input.value==="other"?other.input.value.trim():choice.input.value};
 };
 const endA=terminationField("A"),endB=terminationField("B");
 const qty=field(bomOnly?"Quantity (optional)":"Quantity");qty.input.type="number";qty.input.min="0.000001";qty.input.max="10000000";qty.input.step="any";qty.input.placeholder=bomOnly?"Leave blank if unknown":"1";qty.input.value=bomOnly?"":"1";
 const unit=field("Unit (optional)","select");
 for(const [value,title] of [["pcs","pieces (pcs)"],["in","inches (in)"],["ft","feet (ft)"],["m","meters (m)"],["mm","millimeters (mm)"],["g","grams (g)"],["kg","kilograms (kg)"],["mL","milliliters (mL)"],["L","liters (L)"],["","unspecified"]])option(unit.input,value,title);
 const hintUnits=el("p","muted library-picker-hint","Optional: leave quantity blank for consumables such as solder when usage is not yet known.");
 const results=el("p","library-picker-hint muted","Choose the wire size and construction here. A matching saved wire material is reused automatically when the part is created.");
 const calc=el("section","wire-gauge-helper");
 calc.append(el("h3","","Wire Wizard · electrical requirements"));
 const calcGrid=el("div","wire-gauge-grid");
 const voltage=field("DC supply voltage (V)");voltage.input.type="number";voltage.input.min="0.01";voltage.input.step="any";voltage.input.value="24";
 const current=field("Maximum continuous current (A)");current.input.type="number";current.input.min="0.001";current.input.step="any";current.input.value="2";
 const run=field("One-way wire length (inches)");run.input.type="number";run.input.min="0.001";run.input.step="any";run.input.value="36";
 const drop=field("Maximum voltage drop (%)");drop.input.type="number";drop.input.min="0.1";drop.input.max="20";drop.input.step="0.1";drop.input.value="3";
 const purpose=field("Circuit purpose","select");
 option(purpose.input,"power","Power · prefer 18 AWG");
 option(purpose.input,"signal","Signal / control · prefer 22 AWG");
 const useCase=field("Mechanical use","select");
 option(useCase.input,"moving","Moving, flexible, or subject to vibration");
 option(useCase.input,"stationary","Stationary, protected installation");
 const calcResult=el("div","wire-gauge-result");
 const apply=el("button","btn primary","Apply recommendation & review");apply.type="button";apply.disabled=true;
 const wizardBack=el("button","btn","Back to choices");wizardBack.type="button";
 const calcNote=el("p","muted","Preferred standards: 22 AWG signal, 18 AWG power. The Wizard chooses the preferred size unless it fails voltage drop or conservative planning-current thresholds (22: 2 A, 18: 5 A; larger sizes have separate thresholds). These thresholds are NOT approved ampacity ratings. Sizing assumes copper at 20°C and equal outbound/return DC lengths. Verify manufacturer ampacity, heating, insulation, routing, fusing, and terminal/crimp compatibility before building.");
 calcGrid.append(purpose.label,voltage.label,current.label,run.label,drop.label,useCase.label,calcResult,apply,wizardBack,calcNote);
 calc.append(calcGrid);wizardFields.append(calc);
 const compSection=el("div","library-components hide");
 const commonCategory=field("Filter parts","select");[["all","All"],["screws","Fasteners"],["buck-converters","Buck converters"],["other","Other"]].forEach(([v,n])=>option(commonCategory.input,v,n));
 const commonSearch=field("Search saved parts");commonSearch.input.placeholder="Search name, manufacturer, model";
 const commonSelect=field("Select part","select");
 compSection.append(commonCategory.label,commonSearch.label,commonSelect.label);
 const status=el("p","library-dialog-status");status.setAttribute("role","status");
 const footer=el("div","library-dialog-actions"),save=el("button","btn primary","Create part"),cancel=el("button","btn","Cancel");
 save.type="submit";cancel.type="button";footer.append(cancel,save);
 const wireSection=el("div","library-wire-section");
 manualFields.append(wireType.label,gauge.label,construction.label,length.label,endA.target.label,endA.choice.label,endA.other.label,endB.target.label,endB.choice.label,endB.other.label,results);
 wireSection.append(workflow,workflowHint,manualFields,wizardFields);
 chooser.append(category.label,wireSection,compSection);
 form.append(heading,subtitle,mode.label,customName.label,chooser,qty.label,unit.label,hintUnits,status,footer);
 dialog.append(form);document.body.append(dialog);
 let commons=[],selectedRecommendation=null,finished=false,wireWorkflow=null;
 const close=result=>{if(finished)return;finished=true;dialog.close();dialog.remove();resolve(result||null)};
 cancel.onclick=()=>close(null);dialog.addEventListener("cancel",e=>{e.preventDefault();close(null)});
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
  length.label.classList.toggle("hide",!crimp);
  for(const end of [endA,endB]){
   end.target.label.classList.toggle("hide",!crimp);
   end.choice.label.classList.toggle("hide",!crimp);
   end.other.label.classList.toggle("hide",!crimp||end.choice.input.value!=="other");
  }
  save.classList.toggle("hide",lib&&wire&&wireWorkflow!=="manual");
 };
 function updateCalc(){
  const r=recommend(+voltage.input.value,+current.input.value,+run.input.value*0.0254,+drop.input.value,purpose.input.value);
  selectedRecommendation=r?.chosen?.g??null;apply.disabled=selectedRecommendation===null;
  if(!r){calcResult.textContent="Enter positive voltage, current, wire length and voltage-drop percentage.";return}
  calcResult.textContent=r.chosen?"Preliminary recommendation: "+r.chosen.g+" AWG copper "+((useCase.input.value==="moving"||wireType.input.value==="crimped")?"stranded / flexible":"solid or stranded for fixed wiring")+". "+(r.chosen.g===r.preferred?"Uses preferred "+r.preferred+" AWG standard.":"Larger than preferred "+r.preferred+" AWG because of "+r.reasons.join(" and ")+".")+" Estimated round-trip DC voltage drop "+r.drop.toFixed(3)+" V ("+(100*r.drop/(+voltage.input.value)).toFixed(2)+"%). Check actual wire and terminal ampacity.":"No 8–"+r.preferred+" AWG conductor meets both the provisional current screening and voltage-drop criteria. A different wire or circuit design needs review.";
 }
 [voltage.input,current.input,run.input,drop.input].forEach(e=>e.addEventListener("input",updateCalc));
 useCase.input.onchange=updateCalc;
 purpose.input.onchange=updateCalc;
 wireType.input.addEventListener("change",updateCalc);
 apply.onclick=()=>{
  if(selectedRecommendation===null)return;
  gauge.input.value=String(selectedRecommendation);
  construction.input.value=useCase.input.value==="moving"||wireType.input.value==="crimped"?"stranded":"solid";
  length.input.value=String(Number(Number(run.input.value).toFixed(3)));
  selectWorkflow("manual");
  status.textContent="Wizard applied "+selectedRecommendation+" AWG "+construction.input.value+" copper and "+length.input.value+" in cut length. Review the wire and termination details before creating the part; ampacity is not verified.";
 };
 unit.input.value="pcs";
 mode.input.onchange=update;
 category.input.onchange=update;wireType.input.onchange=update;commonCategory.input.onchange=refreshCommon;commonSearch.input.oninput=refreshCommon;
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
   const inches=Number(length.input.value),mm=Number((inches*25.4).toFixed(3));
   if(crimp&&(!Number.isFinite(inches)||inches<=0||mm>1000000)){status.textContent="Enter a valid positive cut length in inches.";return}
   const designation=g+" AWG "+(str==="solid"?"solid":str==="braided"?"braided":"stranded")+" copper";
   const name=(crimp?"Crimped wire — ":"Wire — ")+designation;
   const specs=[{name:"AWG",value:String(g)},{name:"Conductor",value:str},{name:"Material",value:"Copper (assumed; verify with supplier)"}];
   if(crimp)specs.push({name:"Cut length (in)",value:String(inches)},{name:"End A",value:endA.value()||"Unspecified"},{name:"End B",value:endB.value()||"Unspecified"});
   payload={name,quantity:count,category:crimp?"Crimped wire":"Wire & cable",specifications:specs};
   payload.wireInfo={gauge:g,construction:str,crimp,mm,endA:endA.value(),endB:endB.value(),wireId:null};
  }
  payload.quantityUnit=unit.input.value;
  save.disabled=true;status.textContent="Creating part…";
  try{await onCreate(payload);close({created:true})}catch(err){status.textContent=err.message||String(err);save.disabled=false}
 });
 update();refreshCommon();updateCalc();dialog.showModal();
 fetch("/api/commonparts",{cache:"no-store"}).then(r=>r.ok?r.json():Promise.reject(Error("Saved parts unavailable"))).then(c=>{
  if(finished)return;commons=c.parts||[];refreshCommon();
 }).catch(err=>{if(!finished)status.textContent="Could not load saved parts: "+err.message+". Manual Entry and Wire Wizard are still available.";});
 customName.input.focus();
 });
}
window.BSLibraryPartPicker={open,recommend};
})();