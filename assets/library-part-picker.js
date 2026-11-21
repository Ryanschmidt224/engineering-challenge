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
// Called after the BOM part has been created successfully, so Workshop
// publication failures cannot delete or duplicate an otherwise valid part.
async function saveCreatedPartToWorkshop({part,destination,category,projectTitle=""}){
 if(!destination)return "";
 const chosen=destination===true?"private":destination;
 if(chosen==="public"){
  const valid=["tools","consumables","electronics","hardware","safety"];
  if(!valid.includes(category))throw Error("Select a public Workshop category");
  const specs=(part.specifications||[]).map(x=>
   [String(x.name||"").trim(),String(x.value||"").trim()].filter(Boolean).join(": ")).filter(Boolean);
  const response=await fetch("/api/workshop-reference",{
   method:"POST",credentials:"same-origin",
   headers:{"content-type":"application/json"},
   body:JSON.stringify({details:{
    name:part.name,kind:"component",category,
    familyId:"community-"+category,familyName:"Community contributions",
    manufacturer:part.manufacturer||"",model:part.model||"",supplier:part.supplier||"",
    partNumber:part.model||"", // Manufacturer MPN, never the project BOM number.
    subtitle:part.description||"Community-contributed purchased part",
     featureTreeDescription:part.featureTreeDescription||"",
    spec:specs.join("\n").slice(0,5000),
    photos:[]
   }})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error||"Public Workshop save failed");
  window.dispatchEvent(new Event("bsworkshopupdated"));
  return {id:data.id,destination:"public",message:"Added to the public Workshop."};
 }
 if(chosen!=="private")throw Error("Unknown Workshop destination");
 const response=await fetch("/api/personal-workshop",{
  method:"POST",credentials:"same-origin",
  headers:{"content-type":"application/json"},
  body:JSON.stringify({
   name:part.name,kind:"component",category:part.category||"Purchased parts",
   manufacturer:part.manufacturer||"",model:part.model||"",supplier:part.supplier||"",
   partNumber:part.model||"",description:part.description||"",featureTreeDescription:part.featureTreeDescription||"",quantity:0,unit:"pcs",stockStatus:"committed",
   notes:"",
   specifications:part.specifications||[]
  })
 });
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(data.error||"My Workshop save failed");
 window.dispatchEvent(new Event("bsworkshopupdated"));
 return {id:data.items?.at(-1)?.id||null,destination:"private",message:"Added to My Workshop (quantity not confirmed)."};
}
function open({onCreate,hideDefault=false}){
 return new Promise(resolve=>{
 const dialog=el("dialog","library-part-dialog"),form=el("form","library-part-form");form.method="dialog";
 const heading=el("h2","","New part"),subtitle=el("p","muted","Create a part for this project or select an item from the Workshop.");
 // Choose the item type first, then select how a Part is created.
 // The workshop-origin choices are exclusive; saving a newly created part to
 // a Workshop is a separate, optional action.
 const workshopChoice=el("label","library-workshop-first");
 const workshopCheckbox=el("input");workshopCheckbox.type="radio";workshopCheckbox.name="new-part-source";workshopCheckbox.value="from";
 const fromText=el("span","library-workshop-choice-copy");
 fromText.append(el("strong","","Use from"),document.createTextNode(" Workshop"));
 const fromHelp=el("small","muted library-workshop-choice-description","Choose an existing shared or saved item");
 workshopChoice.append(workshopCheckbox,fromText,fromHelp);
 const newPartChoice=el("label","library-workshop-first");
 const newPartRadio=el("input");newPartRadio.type="radio";newPartRadio.name="new-part-source";newPartRadio.value="new";newPartRadio.checked=true;
 const newText=el("span","library-workshop-choice-copy");
 newText.append(el("strong","","Create new"),document.createTextNode(" part"));
 newPartChoice.append(newPartRadio,newText,el("small","muted library-workshop-choice-description","Make a new part for this project"));
 const quickSearch=el("div","library-workshop-quick-search hide");
 const quickSearchLabel=el("label","library-workshop-search-label");
 quickSearchLabel.append(el("span","","Search all Workshop items"));
 const quickQuery=el("input","field");quickQuery.type="search";
 quickQuery.placeholder="Search name or MPN, e.g. 2N7000";quickQuery.autocomplete="off";
 quickQuery.setAttribute("aria-label","Search all Workshop items");
 quickSearchLabel.append(quickQuery);
 const quickResults=el("div","library-workshop-quick-results");
 const quickCreate=el("button","btn library-workshop-quick-create","Not listed? Create a purchased part");
 quickCreate.type="button";
 quickSearch.append(quickSearchLabel,quickResults,quickCreate);
 const addToWorkshopChoice=el("label","library-workshop-first library-workshop-add");
 const addToWorkshopCheckbox=el("input");addToWorkshopCheckbox.type="checkbox";
 const addText=el("span","library-workshop-choice-copy");
 addText.append(document.createTextNode("Add this part to a Workshop"));
 const addHelp=el("small","muted library-workshop-choice-description","Optional, for purchased parts only");
 addToWorkshopChoice.append(addToWorkshopCheckbox,addText,addHelp);
 const saveScope=el("fieldset","library-workshop-scope hide");
 saveScope.append(el("legend","","Where should it be saved?"));
 const privateScope=el("label","library-workshop-scope-option");
 const privateRadio=el("input");privateRadio.type="radio";privateRadio.name="workshop-destination";privateRadio.value="private";privateRadio.checked=true;
 privateScope.append(privateRadio,document.createTextNode("Private Workshop"),el("small","muted","Only your account can see and edit it"));
 const publicScope=el("label","library-workshop-scope-option");
 const publicRadio=el("input");publicRadio.type="radio";publicRadio.name="workshop-destination";publicRadio.value="public";
 publicScope.append(publicRadio,document.createTextNode("Public Workshop"),el("small","muted","Visible to everyone; any signed-in user can contribute"));
 saveScope.append(privateScope,publicScope);
 const publicCategory=field("Public Workshop category","select");
 for(const [id,label] of [["tools","Tools & Equipment"],["consumables","Consumables & Supplies"],["electronics","Electronics & Components"],["hardware","Hardware & Materials"],["safety","Safety & Measurement"]])option(publicCategory.input,id,label);
 publicCategory.input.value="electronics";
 saveScope.append(publicCategory.label);
 const workshopAddHelp=el("p","muted library-workshop-add-help","Public Workshop items are shared and may be edited by any signed-in member. Changes to existing items are checked for conflicts.");
 const customName=field("Part name");
 const genericWorkshopHelp=el("small","muted","For a generic Workshop item, enter a name and leave the manufacturer part number blank.");
 genericWorkshopHelp.hidden=true;
 customName.label.append(genericWorkshopHelp);
 const itemKind=field("Item type","select");option(itemKind.input,"part","Part");option(itemKind.input,"document","Document");option(itemKind.input,"code","Code");
 const partClassification=field("Part type","select");option(partClassification.input,"purchased","Off-the-shelf");option(partClassification.input,"custom","Custom — made in-house");option(partClassification.input,"custom_purchased","Custom — purchased");
 const partNumberField=field("Project BOM number (not manufacturer's number)");
 partNumberField.input.placeholder="Project-specific number, e.g. 100";partNumberField.input.maxLength=30;
 const manufacturerNumber=field("Mfg part # (MPN)");
 manufacturerNumber.input.placeholder="Optional, e.g. 2N7000";manufacturerNumber.input.maxLength=160;
 const manufacturerName=field("Manufacturer");
 manufacturerName.input.placeholder="e.g. onsemi (select actual manufacturer)";
 manufacturerName.input.maxLength=160;
 const workshopDescription=field("Full description","textarea");
 const shortTreeDescription=field("Function");
 const functionHelp=el("span","library-function-tip","ⓘ");functionHelp.tabIndex=0;
 functionHelp.title="Maximum 20 characters. This is the part name shown in the project feature tree.";
 functionHelp.setAttribute("role","img");functionHelp.setAttribute("aria-label",functionHelp.title);
 const functionCaption=el("span","library-function-caption","Function");
 functionCaption.append(functionHelp);
 shortTreeDescription.label.replaceChildren(functionCaption,shortTreeDescription.input);
 shortTreeDescription.input.maxLength=20;shortTreeDescription.input.placeholder="e.g. Motor switch";
 workshopDescription.input.rows=2;workshopDescription.input.maxLength=2000;
 workshopDescription.input.placeholder="Describe what this part is and how it will be used";
 const ownSupplier=field("Supplier name");ownSupplier.input.maxLength=120;ownSupplier.input.placeholder="e.g. JLCPCB";
 const vendorField=field("Preferred supplier","select");
 const supplierCaption=el("span","library-function-caption","Preferred supplier");
 const supplierHelp=el("span","library-function-tip","ⓘ");supplierHelp.tabIndex=0;
 supplierHelp.title="Supplier search links use the MPN. Verify the manufacturer, package, specifications, stock, and price before ordering.";
 supplierHelp.setAttribute("role","img");supplierHelp.setAttribute("aria-label",supplierHelp.title);
 supplierCaption.append(supplierHelp);vendorField.label.replaceChildren(supplierCaption,vendorField.input);
 for(const [id,label] of [["DigiKey","DigiKey"],["Mouser","Mouser"],["Newark","Newark"],["Arrow","Arrow"],["Other","Other / not yet selected"]])option(vendorField.input,id,label);
 const vendorLinks=el("div","library-vendor-links muted");
 const vendorInfo=el("p","muted library-vendor-info","Vendor links search by manufacturer part number. Confirm manufacturer, package, specifications, stock and price before ordering.");
 const renderVendorLinks=()=>{
  vendorLinks.replaceChildren();
  const part=manufacturerNumber.input.value.trim();if(!part)return;
  for(const [name,base] of [["DigiKey","https://www.digikey.com/en/products/result?keywords="],
   ["Mouser","https://www.mouser.com/c/?q="]]){
   const link=el("a","library-vendor-search-link",name+" search");
   link.href=base+encodeURIComponent(part);link.target="_blank";link.rel="noopener noreferrer";
   vendorLinks.append(link);
  }
 };
 manufacturerNumber.input.oninput=renderVendorLinks;
 const partValue=field("Value (optional)");const valueCaption=el("span","","Value (optional)");valueCaption.append(window.BSDialogs.valueTooltip());partValue.label.replaceChildren(valueCaption,partValue.input);partValue.input.maxLength=120;partValue.input.placeholder="e.g. 10 kΩ or 100 nF";
 const projectDetailsPanel=el("section","library-project-only");
 projectDetailsPanel.append(el("h3","","Project-specific information"),
  el("p","library-project-only-warning","Changes below apply only to this project. They will not modify the original Workshop part."));
 const projectNotes=field("Project notes","textarea");projectNotes.input.rows=3;projectNotes.input.maxLength=6000;
 const projectChanges=field("Project changes / modifications","textarea");projectChanges.input.rows=3;projectChanges.input.maxLength=6000;
 projectDetailsPanel.append(projectNotes.label,projectChanges.label);
 const kicad=el("details","library-project-kicad");
 const summary=el("summary","","Schematic / KiCad information (optional)");
 kicad.append(summary);
 const kicadFields=[
  ["referenceDesignators","Reference designators","Q1, Q2",500],
  ["footprint","Footprint","Package_TO_SOT_THT:TO-92_Inline",240],
  ["schematicValue","Schematic value","2N7000",240],
  ["sourceApplication","Source application","KiCad",80],
  ["sourceFile","Source schematic file","motor-control.kicad_sch",500],
  ["sourceComponentId","Source component ID","Identifier from source schematic",240]
 ];
 const projectCadFields={};
 for(const [key,title,placeholder,limit] of kicadFields){
  const fieldRow=field(title);fieldRow.input.placeholder=placeholder;fieldRow.input.maxLength=limit;
  projectCadFields[key]=fieldRow.input;kicad.append(fieldRow.label);
 }
 projectDetailsPanel.append(kicad);
 const getProjectDetails=()=>({
  value:partValue.input.value.trim(),notes:projectNotes.input.value.trim(),changes:projectChanges.input.value.trim(),
  ...Object.fromEntries(Object.entries(projectCadFields).map(([key,input])=>[key,input.value.trim()]))
 });
 const numberChoice=el("fieldset","library-number-choice");
 const numberLegend=el("legend","","Part number");numberChoice.append(numberLegend);
 const autoNumberRow=el("label","library-auto-number");
 const autoNumberCheckbox=el("input");autoNumberCheckbox.type="radio";autoNumberCheckbox.name="new-part-number-mode";autoNumberCheckbox.value="auto";autoNumberCheckbox.checked=true;
 const autoNumberText=el("span","","Auto assign part number");
 const autoNumberHelp=el("span","library-auto-number-tip","ⓘ");
 autoNumberHelp.tabIndex=0;
 autoNumberHelp.setAttribute("role","img");
 autoNumberHelp.setAttribute("aria-label","Automatically assigns the next unused project part number when the part is saved. The number follows this project's numbering settings and cannot be reused.");
 autoNumberHelp.title="Automatically assigns the next unused project part number when the part is saved. The number follows this project's numbering settings and cannot be reused.";
 autoNumberRow.append(autoNumberCheckbox,autoNumberText,autoNumberHelp);
 const manualNumberRow=el("label","library-auto-number");
 const manualNumberCheckbox=el("input");manualNumberCheckbox.type="radio";manualNumberCheckbox.name="new-part-number-mode";manualNumberCheckbox.value="manual";
 manualNumberRow.append(manualNumberCheckbox,document.createTextNode(" User assign part number"));
 numberChoice.append(autoNumberRow,manualNumberRow);

 const chooser=el("div","library-picker-section hide");
 const category=field("Part category","select");
 for(const [id,label] of [["tools","Tools & Equipment"],["consumables","Consumables & Supplies"],["electronics","Electronics & Components"],["hardware","Hardware & Materials"],["safety","Safety & Measurement"]])option(category.input,id,label);
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
 const insulation=field("Wire insulation / jacket","select");
 option(insulation.input,"PVC 105°C (UL AWM 1015 or equivalent; verify)","Standard — PVC 105°C (verify wire rating)");
 option(insulation.input,"Silicone rubber (manufacturer rating to verify)","Flexible — silicone rubber");
 option(insulation.input,"Other (verify manufacturer insulation specification)","Other / special-purpose");
 const wireAdvanced=el("details","wire-advanced");
 wireAdvanced.append(el("summary","","Wire jacket / insulation (optional)"),insulation.label);
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
 const qty=field("Quantity (optional)");
 const quantityCaption=el("span","library-function-caption","Quantity (optional)");
 const quantityHelp=el("span","library-function-tip","ⓘ");quantityHelp.tabIndex=0;
 quantityHelp.title="Leave blank if the required quantity is not known yet, such as with consumables.";
 quantityHelp.setAttribute("role","img");quantityHelp.setAttribute("aria-label",quantityHelp.title);
 quantityCaption.append(quantityHelp);qty.label.replaceChildren(quantityCaption,qty.input);
 qty.input.type="number";qty.input.min="0.000001";qty.input.max="10000000";qty.input.step="any";qty.input.placeholder="Leave blank if unknown";qty.input.value="";
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
 // Only power/electronics needs a second filter; category is already selected above.
 const powerType=field("Component type","select");
 const powerTypes=[
  ["all","All power and electronics"],
  ["supplies","Power supplies & converters"],
  ["motors","Motors & motor drives"],
  ["controllers","Controllers & circuit boards"],
  ["sensors","Sensors & switches"],
  ["other","Other electronics"]
 ];
 for(const [id,label] of powerTypes)option(powerType.input,id,label);
 const commonGroup=p=>{
  const category=String(p.category||"").toLowerCase();
  if(["tools","consumables","electronics","hardware","safety"].includes(category))return category;
  if(["wire","wire and cable"].includes(category))return "consumables";
  if(["power","buck-converters"].includes(category))return "electronics";
  if(["fasteners","screws"].includes(category))return "hardware";
  if(["tool"].includes(category))return "tools";
  const words=[p.name,p.model,p.specifications].filter(Boolean).join(" ").toLowerCase();
  if(/\b(?:solder|flux|heat.?shrink|electrical tape|wire|cable|adhesive|lubricant)\b/.test(words))return "consumables";
  if(/\b(?:motor|servo|stepper|esc|mosfet|sensor|controller|arduino|relay|pcb|buck|converter)\b/.test(words))return "electronics";
  if(/\b(?:multimeter|oscilloscope|soldering iron|wire stripper|crimper|heat gun|wrench)\b/.test(words))return "tools";
  if(/\b(?:gloves|safety glasses|fume extractor|ventilation)\b/.test(words))return "safety";
  return "hardware";
 };
 const powerGroup=p=>{
  // Existing saved items have no subtype; classify from their recorded names
  // without changing old records or inventing an ownership claim.
  const words=[p.name,p.manufacturer,p.model,p.specifications].filter(Boolean).join(" ").toLowerCase();
  if(/\b(?:power supply|psu|buck|boost|converter|regulator|transformer|battery|charger|dc[- ]?dc|ac[- ]?dc)\b/.test(words))return "supplies";
  if(/\b(?:motor|stepper|servo|esc|driver|h-bridge|vfd|inverter|actuator)\b/.test(words))return "motors";
  if(/\b(?:arduino|raspberry|controller|microcontroller|plc|pcb|board|opta|relay|processor|mosfet)\b/.test(words))return "controllers";
  if(/\b(?:sensor|switch|encoder|hall|proximity|thermistor|photodiode|ultrasonic|limit)\b/.test(words))return "sensors";
  return "other";
 };
 const commonSearch=field("Search saved parts");commonSearch.input.placeholder="Search name, manufacturer, model";
 const commonSelect=field("Select part","select");
 compSection.append(powerType.label,commonSearch.label,commonSelect.label);
 const status=el("p","library-dialog-status");status.setAttribute("role","status");
 const workshopFinishNote=el("p","muted library-workshop-finish-note",
  "Add further details, notes, and changes on the part page after saving.");
 const footer=el("div","library-dialog-actions"),save=el("button","btn primary","Create part"),cancel=el("button","btn","Cancel");
 save.type="submit";cancel.type="button";footer.append(cancel,save);
 const wireModeChoice=el("label","library-wire-mode");
 const wireModeCheckbox=el("input");wireModeCheckbox.type="checkbox";
 wireModeChoice.append(wireModeCheckbox,document.createTextNode(" Create a custom wire or cable using the Wire Wizard"));
 const wireSection=el("div","library-wire-section");
 manualFields.append(wireType.label,gauge.label,construction.label,wireAdvanced,length.label,endA.target.label,endA.choice.label,endA.other.label,endB.target.label,endB.choice.label,endB.other.label,results);
 wireSection.append(workflow,workflowHint,manualFields,wizardFields);
 const referencePreview=el("section","library-workshop-reference-preview hide");
 referencePreview.append(el("h3","","Selected Workshop item"),
   el("p","muted library-workshop-readonly-note","Reference details are read-only here. Add project-specific details on the Part page afterward."));
 const referenceRows=el("div","library-workshop-reference-rows");referenceRows.hidden=true;
 referencePreview.append(referenceRows);
 chooser.append(category.label,wireModeChoice,wireSection,compSection,referencePreview);
 const workshopChoices=el("fieldset","library-workshop-choice-group");
 const workshopLegend=el("legend","","Part source");
 workshopChoices.append(workshopLegend,workshopChoice,newPartChoice,quickSearch);
 form.append(heading,subtitle,itemKind.label,workshopChoices,addToWorkshopChoice,saveScope,workshopAddHelp,
  shortTreeDescription.label,manufacturerNumber.label,manufacturerName.label,vendorField.label,ownSupplier.label,workshopDescription.label,
  partClassification.label,numberChoice,partNumberField.label,customName.label,vendorLinks,vendorInfo,
  chooser,qty.label,hintUnits,partValue.label,projectDetailsPanel,status,workshopFinishNote,footer);
 dialog.append(form);document.body.append(dialog);
 let commons=[],purchased=[],sharedOverrides={},personalItems=[],selectedRecommendation=null,finished=false,wireWorkflow=null;
 let savedWorkshopItem=null;
 const close=result=>{if(finished)return;finished=true;dialog.close();dialog.remove();resolve(result||null)};
 cancel.onclick=()=>close(null);dialog.addEventListener("cancel",e=>{e.preventDefault();close(null)});
 const workshopStandardRows=()=>[...(window.BSResources?.catalog?.tools||[]),...(window.BSResources?.catalog?.parts||[])]
  .filter(item=>item.id?.startsWith("workshop:")).map(item=>({...item,...(sharedOverrides[item.id]||{})}));
 const publishedRows=()=>Object.entries(sharedOverrides)
  .filter(([id,item])=>item?.created&&!workshopStandardRows().some(seed=>seed.id===id))
  .map(([id,item])=>({id,...item}));
 const selectedReference=()=>{
  const value=commonSelect.input.value;
  const idx=value.indexOf(":");if(idx<0)return null;
  const origin=value.slice(0,idx),itemId=value.slice(idx+1);
  return allSearchable().find(item=>item.origin===origin&&item.id===itemId)||null;
 };
 const showReference=()=>{
  const item=selectedReference();
  const usingWorkshop=workshopCheckbox.checked;
  referencePreview.classList.toggle("hide",!usingWorkshop);
  referenceRows.replaceChildren();
  if(usingWorkshop){
   manufacturerNumber.input.value=item?.partNumber||item?.model||"";
   manufacturerName.input.value=item?.manufacturer||"";
   workshopDescription.input.value=item?.subtitle||item?.description||item?.detail||item?.name||"";
   shortTreeDescription.input.value=item?.featureTreeDescription||"";
   const supplier=item?.supplier||"";
   vendorField.input.value=[...vendorField.input.options].some(option=>option.value===supplier)?supplier:"Other";
  }
  if(!item)return;
  for(const [label,value] of [
   ["Manufacturer part number",item.partNumber||item.model||""],
   ["Manufacturer",item.manufacturer||""],
   ["Description",item.subtitle||item.description||item.detail||item.name],
    ["Feature tree description",item.featureTreeDescription||""],
   ["Vendor",item.supplier||"Not specified"]
  ]){
   const row=el("div","library-workshop-reference-row");
   row.append(el("strong","",label),el("span","",value||"Not specified"));referenceRows.append(row);
  }
 };
 const allSearchable=()=>[
  ...commons.map(item=>({...item,origin:"saved"})),
  ...purchased.map(item=>({...item,origin:"purchased"})),
  ...workshopStandardRows().map(item=>({...item,origin:"standard"})),
  ...publishedRows().map(item=>({...item,origin:"public"})),
  ...personalItems.map(item=>({...item,origin:"mine"}))
 ];
 const renderQuickSearch=()=>{
  quickResults.replaceChildren();
  const query=quickQuery.value.trim().toLowerCase();
  if(!query){quickResults.append(el("p","muted","Search the shared and personal Workshop before creating a new part."));return}
  const found=allSearchable().filter(item=>
   [item.name,item.partNumber,item.supplierPartNumber,item.model,item.manufacturer,item.spec,item.detail]
    .filter(Boolean).join(" ").toLowerCase().includes(query)).slice(0,15);
  for(const item of found){
   const choice=el("button","library-workshop-found-item");
   choice.type="button";
   choice.append(el("strong","",item.name),el("small","muted",
    item.origin==="mine"?"My Workshop":item.origin==="public"||item.origin==="standard"?"Public Workshop":"Saved part"));
   choice.onclick=()=>{
    category.input.value=commonGroup(item);
    powerType.input.value="all";
    commonSearch.input.value="";
    refreshCommon();
    commonSelect.input.value=item.origin+":"+item.id;
    status.textContent="Selected "+item.name+". Review the part details before saving.";
    update();
   };
   quickResults.append(choice);
  }
  if(!found.length)quickResults.append(el("p","muted","No matching Workshop items."));
 };
 quickQuery.addEventListener("input",renderQuickSearch);
 quickCreate.onclick=()=>{
  const query=quickQuery.value.trim();
  newPartRadio.checked=true;
  if(query){shortTreeDescription.input.value=query.slice(0,20);manufacturerNumber.input.value=query}
  partClassification.input.value="purchased";
  addToWorkshopCheckbox.checked=true;
  publicCategory.input.value="electronics";
  update();renderVendorLinks();
  manufacturerNumber.input.focus();
  status.textContent="New purchased part. Confirm its manufacturer, part number and supplier, then choose a Workshop.";
 };
 const refreshCommon=()=>{
  const q=commonSearch.input.value.toLowerCase().trim(),cat=category.input.value,subtype=powerType.input.value;
  const saved=commons.filter(p=>commonGroup(p)===cat&&(cat!=="electronics"||subtype==="all"||powerGroup(p)===subtype));
  const recorded=purchased.filter(p=>commonGroup(p)===cat&&(cat!=="electronics"||subtype==="all"||powerGroup(p)===subtype));
  const standards=workshopStandardRows().filter(item=>item.category===cat);
  const published=publishedRows().filter(item=>commonGroup(item)===cat&&(cat!=="electronics"||subtype==="all"||powerGroup(item)===subtype));
  const personal=personalItems.filter(item=>commonGroup(item)===cat&&(cat!=="electronics"||subtype==="all"||powerGroup(item)===subtype));
  const matches=item=>[item.name,item.manufacturer,item.partNumber,item.supplierPartNumber,item.specifications,item.detail,item.spec,item.model].filter(Boolean).join(" ").toLowerCase().includes(q);
  const filtered=[...saved.map(item=>({...item,origin:"saved"})),
   ...recorded.map(item=>({...item,origin:"purchased"})),
   ...standards.map(item=>({...item,origin:"standard"})),
   ...published.map(item=>({...item,origin:"public"})),
   ...personal.map(item=>({...item,origin:"mine"}))].filter(matches);
  const previous=commonSelect.input.value;
  commonSelect.input.replaceChildren();
  option(commonSelect.input,"",filtered.length?"Select a Workshop item":"No Workshop items match");
  filtered.forEach(p=>option(commonSelect.input,p.origin+":"+p.id,p.name+(
   p.origin==="standard"?" · Shared starter item":
   p.origin==="public"?" · Public Workshop":
   p.origin==="mine"?" · My Workshop":
   p.origin==="purchased"?" · Recorded part":
   p.partNumber?" · "+p.partNumber:"")));
  if(filtered.some(p=>p.origin+":"+p.id===previous))commonSelect.input.value=previous;
  showReference();
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
  const isPart=itemKind.input.value==="part";
  if(!isPart){newPartRadio.checked=true;addToWorkshopCheckbox.checked=false}
  const lib=isPart&&workshopCheckbox.checked;
  const adding=isPart&&!lib&&addToWorkshopCheckbox.checked;
  const workshopMode=lib||adding;
  const newPart=isPart&&!lib;
  // The Workshop selection/creation flow is deliberately short. More
  // project-specific choices can be made in the full Part Editor after creation.
  workshopFinishNote.classList.toggle("hide",!workshopMode);
  save.textContent=lib?"Add to project":"Create part";
   if(adding)partClassification.input.value="purchased";
  const purchased=!lib&&isPart&&["purchased","custom_purchased"].includes(partClassification.input.value);
  for(const label of [manufacturerNumber.label,manufacturerName.label,workshopDescription.label,shortTreeDescription.label,vendorField.label])
   label.classList.toggle("hide",!newPart);
  // Workshop values are visible for reference, but only editable from Workshop itself.
  for(const input of [manufacturerNumber.input,manufacturerName.input,workshopDescription.input,shortTreeDescription.input])
   input.readOnly=lib;
  vendorField.input.disabled=lib;
  ownSupplier.label.hidden=!newPart||vendorField.input.value!=="Other";
  shortTreeDescription.input.required=newPart;
  // Project-only annotations belong to Edit Part for Workshop-linked items.
  projectDetailsPanel.classList.add("hide");
  partValue.label.hidden=true; // Project-specific values belong in Edit Part for Workshop-linked items.
  vendorLinks.classList.toggle("hide",!purchased||workshopMode);
  vendorInfo.classList.toggle("hide",!purchased||workshopMode);
   if(savedWorkshopItem&&!adding)savedWorkshopItem=null;
  workshopChoices.classList.toggle("hide",!isPart);
  addToWorkshopChoice.classList.toggle("hide",!newPart);
  if(!newPart)addToWorkshopCheckbox.checked=false;
  saveScope.classList.toggle("hide",!adding);
  publicCategory.label.classList.toggle("hide",!adding||!publicRadio.checked);
  workshopAddHelp.hidden=!adding||!publicRadio.checked;
  const wire=category.input.value==="consumables"&&wireModeCheckbox.checked;
  if(lib&&!wire)refreshCommon();
  wireModeChoice.classList.toggle("hide",!lib||category.input.value!=="consumables");
  powerType.label.classList.toggle("hide",!lib||category.input.value!=="electronics");
  customName.label.classList.toggle("hide",isPart);
  genericWorkshopHelp.hidden=!adding;

  const documentMode=!lib&&itemKind.input.value!=="part";
  partClassification.label.classList.toggle("hide",lib||documentMode||adding);
  qty.label.classList.toggle("hide",documentMode||workshopMode);
  hintUnits.classList.toggle("hide",documentMode||workshopMode);
  if(documentMode&&itemKind.input.value==="document")qty.input.value="1";
  numberChoice.classList.toggle("hide",workshopMode);
  partNumberField.label.classList.toggle("hide",workshopMode||autoNumberCheckbox.checked);
  partNumberField.input.required=!workshopMode&&manualNumberCheckbox.checked;
  // Hidden numeric and project-only fields should not participate in native
  // form validation when the user is only selecting/creating a Workshop part.
  quickSearch.classList.toggle("hide",!lib);
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
  construction.input.value="stranded";
  insulation.input.value=useCase.input.value==="moving"?"Silicone rubber (manufacturer rating to verify)":"PVC 105°C (UL AWM 1015 or equivalent; verify)";
  length.input.value=String(Number(Number(run.input.value).toFixed(3)));
  selectWorkflow("manual");
  status.textContent="Wizard applied "+selectedRecommendation+" AWG "+construction.input.value+" copper and "+length.input.value+" in cut length. Review the wire and termination details before creating the part; ampacity is not verified.";
 };
 workshopCheckbox.onchange=()=>{addToWorkshopCheckbox.checked=false;update()};
 newPartRadio.onchange=update;
 addToWorkshopCheckbox.onchange=update;
 privateRadio.onchange=update;publicRadio.onchange=update;
 itemKind.input.onchange=update;partClassification.input.onchange=update;autoNumberCheckbox.onchange=update;manualNumberCheckbox.onchange=update;
 category.input.onchange=()=>{powerType.input.value="all";wireModeCheckbox.checked=false;update()};wireModeCheckbox.onchange=update;wireType.input.onchange=update;powerType.input.onchange=refreshCommon;commonSearch.input.oninput=refreshCommon;commonSelect.input.onchange=showReference;
 form.addEventListener("submit",async e=>{
  e.preventDefault();
  if(!form.reportValidity())return;
  let payload;
  const rawCount=qty.input.value.trim();const count=rawCount===""?null:Number(rawCount);
  if(count!==null&&(!Number.isFinite(count)||count<=0||count>10000000)){status.textContent="Quantity must be positive, or left blank.";return}
  if(itemKind.input.value!=="part"||!workshopCheckbox.checked){
   const adding=addToWorkshopCheckbox.checked&&itemKind.input.value==="part";
   const name=itemKind.input.value==="part"?shortTreeDescription.input.value.trim():customName.input.value.trim();
   if(!name||name.length>100){
    status.textContent=itemKind.input.value==="part"?"Enter a Function (maximum 20 characters).":"Enter a name (up to 100 characters).";
    (itemKind.input.value==="part"?shortTreeDescription.input:customName.input).focus();return;
   }
   const autoNumber=autoNumberCheckbox.checked;
   payload={name,quantity:itemKind.input.value==="code"?null:itemKind.input.value==="document"?1:count,specifications:[],itemType:itemKind.input.value==="code"?"document":itemKind.input.value,partType:itemKind.input.value==="code"?"code":partClassification.input.value,
    assignNumber:autoNumber,partNumber:autoNumber?null:partNumberField.input.value.trim().toUpperCase()||null};
   if(itemKind.input.value==="part"){
    payload.manufacturer=manufacturerName.input.value.trim();
    payload.model=manufacturerNumber.input.value.trim(); // Manufacturer MPN; never the project's issued part number.
    payload.description=workshopDescription.input.value.trim();
     payload.featureTreeDescription=shortTreeDescription.input.value.trim();
    payload.supplier=vendorField.input.value==="Other"?ownSupplier.input.value.trim():vendorField.input.value;
   }
  }else if(!(category.input.value==="consumables"&&wireModeCheckbox.checked)){
   const choice=commonSelect.input.value;
   const isStandard=choice.startsWith("standard:"),isPurchased=choice.startsWith("purchased:");
   const isPublic=choice.startsWith("public:"),isMine=choice.startsWith("mine:");
   const p=isStandard?workshopStandardRows().find(item=>item.id===choice.slice(9)):
    isPurchased?purchased.find(item=>item.id===choice.slice(10)):
    isPublic?publishedRows().find(item=>item.id===choice.slice(7)):
    isMine?personalItems.find(item=>item.id===choice.slice(5)):
    commons.find(item=>item.id===choice.slice(6));
   if(!p){status.textContent="Select a Workshop item.";return}
   payload=isStandard?{
    name:p.name,quantity:count,category:commonGroup(p),manufacturer:p.manufacturer||"",
    model:p.partNumber||p.model||"",supplier:p.supplier||"",description:p.subtitle||p.description||"",
    isTool:commonGroup(p)==="tools",
    specifications:[{name:"Workshop reference",value:p.id},{name:"Tool specification",value:String(p.detail||p.spec||"Workshop reference").slice(0,300)}]
   }:(isPublic||isMine)?{
    name:p.name,quantity:count,category:commonGroup(p),manufacturer:p.manufacturer||"",
    model:p.partNumber||p.model||"",supplier:p.supplier||"",description:p.subtitle||p.description||"",isTool:commonGroup(p)==="tools",
    specifications:[
     {name:isPublic?"Public Workshop reference":"My Workshop reference",value:p.id},
     ...(Array.isArray(p.specifications)?p.specifications:
       [{name:"Specifications",value:String(p.spec||"Reference specifications not supplied").slice(0,300)}])
    ].filter(spec=>spec.name&&spec.value).slice(0,40)
   }:isPurchased?{
    name:p.name,quantity:count,sharedPartRef:"purchased:"+p.id,manufacturer:p.manufacturer||"",
    model:p.partNumber||p.model||"",supplier:p.supplier||"",description:p.subtitle||p.description||"",asin:p.asin||"",category:commonGroup(p),
    isTool:commonGroup(p)==="tools",specifications:Array.isArray(p.specifications)?p.specifications:[]
   }:{
    name:p.name,quantity:count,sharedPartRef:"common:"+p.id,manufacturer:p.manufacturer||"",model:p.partNumber||"",
    description:p.subtitle||p.description||"",supplier:p.supplier||"",category:commonGroup(p),isTool:commonGroup(p)==="tools",
    specifications:[{name:"Workshop item ID",value:p.id},{name:"Workshop specifications",value:p.specifications||"Saved Workshop item"}]
   };
  }else{
   if(wireWorkflow!=="manual"){status.textContent="Choose Manual Entry or apply the Wire Wizard recommendation first.";return}
   const g=Number(gauge.input.value),str=construction.input.value,crimp=wireType.input.value==="crimped";
   const inches=Number(length.input.value),mm=Number((inches*25.4).toFixed(3));
   if(crimp&&(!Number.isFinite(inches)||inches<=0||mm>1000000)){status.textContent="Enter a valid positive cut length in inches.";return}
   const designation=g+" AWG "+(str==="solid"?"solid":str==="braided"?"braided":"stranded")+" copper";
   const name=(crimp?"Crimped wire — ":"Wire — ")+designation;
   const specs=[{name:"AWG",value:String(g)},{name:"Conductor",value:str},{name:"Insulation",value:insulation.input.value},{name:"Material",value:"Copper (assumed; verify with supplier)"}];
   if(crimp)specs.push({name:"Cut length (in)",value:String(inches)},{name:"End A",value:endA.value()||"Unspecified"},{name:"End B",value:endB.value()||"Unspecified"});
   payload={name,quantity:count,category:"consumables",specifications:specs};
   payload.wireInfo={gauge:g,construction:str,insulation:insulation.input.value,crimp,mm,endA:endA.value(),endB:endB.value(),wireId:null};
  }
  if(itemKind.input.value==="part"){
   payload.projectDetails={...getProjectDetails(),...(!workshopCheckbox.checked?{featureTreeName:shortTreeDescription.input.value.trim()}:{})};
   if(addToWorkshopCheckbox.checked)payload.projectDetails.workshopTreeDescription=shortTreeDescription.input.value.trim();
   if(workshopCheckbox.checked&&selectedReference())payload.projectDetails.workshopTreeDescription=String(selectedReference().featureTreeDescription||"").slice(0,20);
   const reference=workshopCheckbox.checked?selectedReference():null;
   if(reference?.origin==="mine")payload.projectDetails.workshopReferenceId="my:"+reference.id;
   if(reference?.origin==="public"||reference?.origin==="standard")payload.projectDetails.workshopReferenceId=reference.id;
  }
  payload.quantityUnit="pcs";
  // This client-only instruction is consumed by the project controller after
  // the BOM part is saved; it must never enter the components API record.
  if(addToWorkshopCheckbox.checked&&itemKind.input.value==="part"&&!workshopCheckbox.checked){
   if(payload.itemType!=="part"||payload.partType!=="purchased"){
    status.textContent="Only purchased parts can be saved to a Workshop.";return;
   }
   payload.addToWorkshop=publicRadio.checked?"public":"private";
   if(publicRadio.checked)payload.workshopCategory=publicCategory.input.value;
  }
  // Workshop category determines whether this part is a reusable tool.
  // Keep any existing tool designation supplied by a selected Workshop item.
  payload.hideFromFeatureTree=false;
  payload.isTool=payload.itemType==="document"?false:!!payload.isTool||(workshopCheckbox.checked&&["tools","safety"].includes(category.input.value));
  save.disabled=true;
  try{
   if(payload.addToWorkshop){
    // Save the Workshop item *before* creating its project BOM occurrence.
    // Otherwise the dialog closes first and a failed Workshop write is hidden
    // on the page behind it. Reuse a successful publication if BOM creation
    // fails, so retrying cannot publish duplicate Workshop entries.
    if(!savedWorkshopItem){
     const target=payload.addToWorkshop;
     status.textContent="Saving to "+(target==="public"?"Public Workshop":"My Workshop")+"…";
     savedWorkshopItem=await saveCreatedPartToWorkshop({
      part:payload,destination:target,category:payload.workshopCategory
     });
     if(!savedWorkshopItem?.id)throw Error("Workshop did not confirm the new item. Please check your Workshop before retrying.");
    }
    payload.projectDetails={
     ...(payload.projectDetails||{}),workshopReferenceId:savedWorkshopItem.destination==="private"?"my:"+savedWorkshopItem.id:savedWorkshopItem.id
    };
    payload.workshopSavedMessage=savedWorkshopItem.message;
    delete payload.addToWorkshop;
    delete payload.workshopCategory;
   }
   status.textContent="Creating project part…";
   await onCreate(payload);
   close({created:true,workshop:savedWorkshopItem});
  }catch(err){
   status.textContent=(err.message||String(err))+
    (savedWorkshopItem?" The item is already in the Workshop; you can retry creating the project part.":"");
   save.disabled=false;
  }
 });
 vendorField.input.addEventListener("change",update);
 update();refreshCommon();updateCalc();dialog.showModal();
 Promise.allSettled([
  fetch("/api/commonparts",{cache:"no-store"}).then(r=>r.ok?r.json():Promise.reject(Error("Saved parts unavailable"))),
  fetch("/api/purchased-parts",{cache:"no-store",credentials:"same-origin"}).then(r=>r.ok?r.json():Promise.reject(Error("Recorded parts unavailable"))),
  fetch("/api/workshop-reference",{cache:"no-store",credentials:"same-origin"}).then(r=>r.ok?r.json():Promise.reject(Error("Public Workshop unavailable"))),
  fetch("/api/personal-workshop",{cache:"no-store",credentials:"same-origin"}).then(r=>r.ok?r.json():Promise.reject(Error("Personal Workshop unavailable")))
 ]).then(([saved,recorded,shared,mine])=>{
  if(finished)return;
  if(saved.status==="fulfilled")commons=saved.value.parts||[];
  if(recorded.status==="fulfilled")purchased=recorded.value.parts||[];
  if(shared.status==="fulfilled")sharedOverrides=shared.value.items||{};
  if(mine.status==="fulfilled")personalItems=mine.value.items||[];
  if(saved.status==="rejected"&&recorded.status==="rejected"&&shared.status==="rejected"&&mine.status==="rejected")
   status.textContent="Workshop items are unavailable; wire tools remain available.";
  refreshCommon();renderQuickSearch();
 });
 itemKind.input.focus();
 });
}
window.BSLibraryPartPicker={open,recommend,saveCreatedPartToWorkshop};
})();