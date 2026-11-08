/* Shared, reusable reference library for Building Schmidt. */
(function(){
 "use strict";
 const tools=[
  {id:"oscilloscope",name:"Oscilloscope",subtitle:"Voltage versus time",detail:"Measure startup transients, ripple, PWM, switching events and timing. Check bandwidth, sample rate, probe attenuation and the instrument's ground reference.",caution:"A bench scope ground clip may be earth-referenced. Never connect it to an arbitrary live node without an appropriate measurement setup."},
  {id:"multimeter",name:"Digital multimeter",subtitle:"Voltage, resistance and current",detail:"Check power rails, continuity, resistance and steady current. Confirm probe jack selection and meter category ratings before measuring.",caution:"Resistance and continuity measurements require an unpowered circuit; never measure voltage with leads in a current jack."},
  {id:"soldering-iron",name:"Soldering iron",subtitle:"Electronic assembly",detail:"Use temperature control, a suitable tip, flux and clean joints. Provide ventilation and strain relief. Inspect solder wetting and avoid overheating components.",caution:"The tip and recent joints remain hot; use an iron stand."}
 ];
 const calculators=[
  {id:"ohms-law",name:"Ohm's law",subtitle:"Current, voltage and resistance",detail:"Calculate I = V / R and power P = V × I for a simple resistive load."},
  {id:"surface-footage",name:"Surface speed / SFM",subtitle:"Machining surface feet per minute",detail:"Calculate SFM from tool/work diameter in inches and RPM, or RPM from desired SFM."}
 ];
 const baseParts=[
  {id:"common-wire",name:"Wire and cable",subtitle:"Wire gauge, conductor, insulation and color",detail:"Use the shared wire material records below for exact wire sizes, colors, manufacturer and part numbers. Link a specific wire to harness cut lists."},
  {id:"common-screws",name:"Screws / fasteners",subtitle:"Machine screws and threaded hardware",detail:"Reusable fastener reference. Document thread standard, diameter, pitch, length, head style, material and finish in each build."},
  {id:"common-buck",name:"DC–DC buck converters",subtitle:"Step-down switching power modules",detail:"Reusable power-converter reference. Record input/output ranges, current, ripple, protection and manufacturer part number. Check startup transients and ratings."}
 ];
 // Static defaults are reference specifications, not inventory records or purchase claims.
 // Only equipment useful for common low-voltage DIY builds goes into the starter list.
 const workshopSupplies=[
  {id:"workshop:wire22",kind:"material",tier:"core",name:"22 AWG signal hook-up wire",subtitle:"Preferred signal / control wire",spec:"Stranded, tinned copper; PVC insulation / jacket; UL AWM Style 1015, 105°C, 600 V or an equivalent listed wire; red, black and one contrasting signal color.",use:"Switches, sensors, low-current electronics and stationary control wiring.",caution:"Use only when current, voltage drop, terminal range and movement permit. Ratings are for the specific approved product and installation.",source:"https://www.alphawire.com/products/wire/hook-up-wire/premium/3071"},
  {id:"workshop:wire18",kind:"material",tier:"core",name:"18 AWG power hook-up wire",subtitle:"Preferred low-voltage power wire",spec:"Stranded copper (tinned preferred); PVC insulation / jacket; UL AWM Style 1015, 105°C, 600 V or equivalent rated wire; red and black.",use:"Short DC power leads and small equipment where the electrical and connector ratings allow.",caution:"18 AWG is a preferred stocking size, not an automatic current rating. Check load, run length, protection and installation.",source:"https://www.alphawire.com/"},
  {id:"workshop:wire16",kind:"material",tier:"conditional",name:"16 AWG power wire",subtitle:"Stock when loads exceed the preferred 18 AWG",spec:"Stranded copper, identified insulation type, voltage and temperature rating; PVC 105°C / 600 V UL 1015 is a useful fixed-installation example.",use:"Higher-current or longer low-voltage DC runs when calculated and verified.",caution:"Size and protection require engineering review. Don't infer an installation ampacity from the insulation voltage alone.",source:"https://www.alphawire.com/"},
  {id:"workshop:ferrule22",kind:"material",tier:"core",name:"Ferrules for 22 AWG",subtitle:"Reusable small signal-wire terminations",spec:"Insulated-collar, tin-plated copper wire-end ferrules; typically about 0.34 mm² conductor cross-section, correct barrel length for the terminal. Match the exact ferrule and crimp die to the actual wire.",use:"Fine-stranded signal wires entering screw terminals that allow ferrules.",caution:"Ferrules must fit both conductor stranding and terminal; not all spring terminals accept ferrules. Verify terminal data.",source:"https://catalog.weidmueller.com/catalog/Start.do?ObjectID=1638800000&localeId=en"},
  {id:"workshop:ferrule18",kind:"material",tier:"core",name:"Ferrules for 18 AWG",subtitle:"Reusable power-wire terminations",spec:"Insulated-collar, tin-plated copper wire-end ferrules; 18 AWG copper is approximately 0.82 mm². Choose a ferrule listed for the exact wire (often nominal 0.75 or 1.0 mm² depending on the product), barrel length, and terminal.",use:"Stranded low-voltage wires in ferrule-compatible terminal blocks.",caution:"Do not select ferrules by color alone; DIN, manufacturer, and country color codes differ.",source:"https://catalog.weidmueller.com/catalog/Start.do?ObjectID=1638800000&localeId=en"},
  {id:"workshop:heatshrink",kind:"material",tier:"core",name:"General-purpose heat shrink",subtitle:"Preferred: 2:1 single-wall polyolefin",spec:"Black, flame-retardant, flexible polyolefin 2:1 shrink ratio; a useful starter assortment of expanded diameters 1/16, 1/8, 3/16, 1/4 and 3/8 in. Example: 3M FP-301, up to 135°C continuous and listed variants at 600 V.",use:"Insulating and identifying splices, leads, crimp insulation and wire bundles.",caution:"Select tubing against actual pre- and post-shrink diameters; ordinary single-wall tubing is not a watertight seal.",source:"https://www.3m.com/3M/en_US/p/d/b00019872/"},
  {id:"workshop:sealshrink",kind:"material",tier:"conditional",name:"Adhesive-lined heat shrink",subtitle:"For exposed or damp connections",spec:"Dual-wall polyolefin with hot-melt adhesive, 3:1 shrink ratio, sized to connector and cable outside diameters. Example class: 3M EPS-300.",use:"Outdoor, automotive and moisture-exposed splices where a sealed connection is appropriate.",caution:"Not a substitute for correctly rated enclosures, strain relief or connector sealing.",source:"https://www.3m.com/"},
  {id:"workshop:solder",kind:"material",tier:"core",name:"Electronics solder and flux",subtitle:"Lead-free, rosin / no-clean electronics grade",spec:"Known-alloy lead-free electronic solder wire, ~0.5–0.8 mm diameter, flux cored; matching non-acid electronics flux. Example alloys: SAC305 or Sn99.3Cu0.7; follow component and alloy temperature guidance.",use:"PCB pads, electronics connections and repairs—not a default replacement for correctly crimped moving-wire terminals.",caution:"Use ventilation and eye protection; do not use plumbing acid-core flux on electronics."},
  {id:"workshop:silicone",kind:"material",tier:"conditional",name:"Highly flexible silicone-jacketed wire",subtitle:"For moving or high-flex DC leads",spec:"Fine-stranded copper, silicone rubber insulation, typically 18 or 22 AWG; choose voltage, temperature and abrasion ratings from the actual manufacturer.",use:"Repeated movement, vibration and flexible bench test leads where the mounting and insulation are suitable.",caution:"Silicone insulation is often softer and less abrasion-resistant; use protection and strain relief where necessary."}
 ];
 const workshopEquipment=[
  {id:"workshop:stripper",kind:"tool",tier:"core",name:"Adjustable wire stripper and flush cutters",spec:"Reliable range covering 22 and 18 AWG without nicking strands; flush cutters for clean wire ends.",use:"Cutting and preparing every harness."},
  {id:"workshop:ferrule-tool",kind:"tool",tier:"core",name:"Ferrule crimping tool",spec:"Ratcheting or controlled-cycle crimper with dies verified for the chosen ferrules and the 22/18 AWG conductor range.",use:"Repeatable ferrule crimps; inspect pull retention and barrel profile.",caution:"A generic crimper may not meet a given ferrule maker's crimp specification."},
  {id:"workshop:heatgun",kind:"tool",tier:"core",name:"Temperature-controlled heat gun",spec:"Variable temperature and airflow, narrow nozzle preferred; use the tubing manufacturer's recovery temperature.",use:"Heat shrink installation without a flame."},
  {id:"workshop:meter",kind:"tool",tier:"core",name:"Digital multimeter",spec:"DC voltage, resistance, continuity; appropriate measurement category and rated leads.",use:"Check polarity, shorts and continuity before first power-up."},
  {id:"workshop:solderstation",kind:"tool",tier:"core",name:"Temperature-controlled soldering station",spec:"Adjustable temperature, replaceable tips, stand, brass wool/sponge and suitable work ventilation.",use:"PCB work and soldered connections."},
  {id:"workshop:safety",kind:"tool",tier:"core",name:"Eye protection and bench ventilation",spec:"Safety glasses plus effective solder-fume removal or local exhaust appropriate to the work.",use:"Cutting, crimping, soldering and heating materials."}
 ];
 const workshopReferences=[...workshopSupplies,...workshopEquipment];
 const catalog={tools:[...tools,...workshopEquipment.map(x=>({id:x.id,name:x.name,subtitle:"Workshop standard",detail:x.spec+" "+x.use,caution:x.caution}))],calculators,parts:[...baseParts,...workshopSupplies.map(x=>({id:x.id,name:x.name,subtitle:x.subtitle,detail:x.spec+" "+x.use,caution:x.caution}))]};
 let wires=[],commonRecords=[],listeners=new Set(),admin=false;
 const byId=(kind,id)=>catalog[kind]?.find(item=>item.id===id);
 const wireName=w=>[w.name,w.awg?w.awg+" AWG":"",w.color,w.partNumber].filter(Boolean).join(" · ");
 function all(kind){
  if(kind==="parts")return [...catalog.parts,...wires.map(w=>({id:"wire:"+w.id,name:wireName(w),subtitle:"Shared wire type",detail:[w.construction,w.insulation,w.manufacturer,w.notes].filter(Boolean).join(" · ")})),...commonRecords.map(p=>({id:"common:"+p.id,name:p.name,subtitle:p.category==="screws"?"Shared fastener":p.category==="buck-converters"?"Shared buck converter":"Shared component",detail:[p.manufacturer,p.partNumber,p.specifications,p.notes].filter(Boolean).join(" · ")}))];
  return catalog[kind]||[];
 }
 function label(kind,id){return all(kind).find(item=>item.id===id)?.name||"Unavailable Workshop item ("+id+")"}
 function notify(){listeners.forEach(fn=>fn());renderCommonParts();}
 async function reloadWires(){
  try{const response=await fetch("/api/wires",{cache:"no-store"});const data=await response.json();if(!response.ok)throw Error(data.error||"Wire library unavailable");wires=data.wires||[];notify();return wires}
  catch(e){const status=document.querySelector(".resource-wire-status");if(status)status.textContent="Unable to load wire library: "+e.message;return []}
 }
 async function reloadCommonParts(){
  try{
   const response=await fetch("/api/commonparts",{cache:"no-store"}),data=await response.json();
   if(!response.ok)throw Error(data.error||"Common parts unavailable");
   commonRecords=data.parts||[];notify();return commonRecords;
  }catch(e){
   const status=document.querySelector(".resource-common-status");if(status)status.textContent="Unable to load shared parts: "+e.message;
   return [];
  }
 }
 function element(tag,className,text){
  const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;
 }
 function renderCatalog(id,items,kind){
  const mount=document.getElementById(id);if(!mount)return;
  mount.replaceChildren();
  for(const item of items){
   const card=element("article","resource-card");
   card.append(element("h2","",item.name),element("p","resource-subtitle",item.subtitle),element("p","",item.detail));
   if(item.caution)card.append(element("p","resource-caution",item.caution));
   if(kind==="calculator"){
    const controls=element("div","calculator-fields");
    if(item.id==="ohms-law"){
     const volts=makeNum("Voltage (V)",12,0.01),ohms=makeNum("Resistance (Ω)",6,0.01);
     const result=element("output","calculator-output");
     const calculate=()=>{
      const v=Number(volts.input.value),r=Number(ohms.input.value);
      result.textContent=Number.isFinite(v)&&Number.isFinite(r)&&r>0?"Current "+format(v/r)+" A · Power "+format(v*v/r)+" W":"Enter a resistance greater than 0 Ω.";
     };
     controls.append(volts.label,ohms.label,result);
     [volts.input,ohms.input].forEach(input=>input.addEventListener("input",calculate));
     calculate();
    }else{
     const diameter=makeNum("Diameter (in)",0.5,0.001),rpm=makeNum("RPM",4000,1),sfm=makeNum("SFM",523.599,0.01);
     const result=element("output","calculator-output");
     const computeSpeed=()=>{
      const d=Number(diameter.input.value),r=Number(rpm.input.value);
      sfm.input.value=d>0&&r>=0?String(Number((Math.PI*d*r/12).toFixed(3))):"";
      result.textContent=d>0&&r>=0?"Surface speed: "+format(Math.PI*d*r/12)+" ft/min":"Enter a positive diameter and nonnegative RPM.";
     };
     const computeRpm=()=>{
      const d=Number(diameter.input.value),speed=Number(sfm.input.value);
      if(d>0&&speed>=0){const value=12*speed/(Math.PI*d);rpm.input.value=String(Number(value.toFixed(1)));result.textContent="Required spindle speed: "+format(value)+" RPM";}
      else result.textContent="Enter a positive diameter and nonnegative SFM.";
     };
     controls.append(diameter.label,rpm.label,sfm.label,result);
     diameter.input.addEventListener("input",computeSpeed);rpm.input.addEventListener("input",computeSpeed);sfm.input.addEventListener("input",computeRpm);
     computeSpeed();
     card.append(element("p","resource-footnote","SFM = π × diameter (in) × RPM ÷ 12. Calculator is for cutting surface speed, not feed rate."));
    }
    card.append(controls);
   }
   mount.append(card);
  }
 }
 function makeNum(name,value,step){const label=element("label","calculator-label",name),input=element("input","field");input.type="number";input.step=String(step);input.value=String(value);label.append(input);return {label,input}}
 const format=value=>Number.isFinite(value)?Number(value.toFixed(4)).toLocaleString("en-US",{maximumFractionDigits:4}):"—";
 function normalize(raw){
  const data={tools:[],calculators:[],parts:[]};
  for(const kind of Object.keys(data)){const rawList=Array.isArray(raw?.[kind])?raw[kind]:[];data[kind]=[...new Set(rawList.filter(value=>typeof value==="string"&&value.length<120))].slice(0,60)}
  return data;
 }
 function mount(panel,{onChange=()=>{}}={}){
  let refs=normalize(null),editable=false;
  panel.classList.add("linked-resources");
  const heading=element("h2","","Linked resources");
  const description=element("p","muted","Add shared tools, calculators or library parts to these instructions. Save the workspace or part instructions to keep the links; linked parts are references, not additional BOM quantities.");
  const body=element("div","linked-resource-groups");
  panel.append(heading,description,body);
  const onLibraryUpdate=()=>render();listeners.add(onLibraryUpdate);
  function render(){
   body.replaceChildren();
   const kinds=[["tools","Tool","Tools"],["calculators","Calculator","Calculators"],["parts","Part from Workshop","Workshop parts"]];
   for(const [kind,singular,section] of kinds){
    const group=element("div","linked-resource-group");
    group.append(element("h3","",section));
    const selected=element("div","linked-resource-items");
    if(!refs[kind].length)selected.append(element("p","muted","None linked."));
    for(const id of refs[kind]){
     const row=element("div","linked-resource-row");
     const name=element("span","",label(kind,id));
     row.append(name);
     const target=kind==="tools"?"tools":kind==="calculators"?"calculators":"commonparts";
     const open=element("button","btn","Open");open.type="button";open.onclick=()=>{location.hash=target};row.append(open);
     if(editable){const remove=element("button","btn","Remove");remove.type="button";remove.onclick=()=>{refs[kind]=refs[kind].filter(x=>x!==id);render();onChange()};row.append(remove)}
     selected.append(row);
    }
    group.append(selected);
    if(editable){
     const actions=element("div","linked-resource-actions");
     const picker=element("select","field");picker.setAttribute("aria-label","Choose "+singular.toLowerCase());
     const options=all(kind).filter(item=>!refs[kind].includes(item.id));
     if(!options.length){const o=element("option","","No additional entries");picker.append(o);picker.disabled=true}
     else for(const item of options){const opt=element("option","",item.name);opt.value=item.id;picker.append(opt)}
     const add=element("button","btn","+ Add "+singular.toLowerCase());add.type="button";add.disabled=!options.length;
     add.onclick=()=>{if(!picker.value)return;refs[kind].push(picker.value);render();onChange()};
     actions.append(picker,add);group.append(actions);
    }
    body.append(group);
   }
  }
  function setData(value,admin){refs=normalize(value);editable=!!admin;render()}
  render();
  return {setData,getData:()=>normalize(refs),destroy:()=>listeners.delete(onLibraryUpdate)};
 }
 function renderWorkshopEssentials(){
  const mount=document.getElementById("workshop-essentials-list");if(!mount)return;
  mount.replaceChildren();
  const section=(name,items)=>{
   const group=element("section","workshop-group");
   group.append(element("h3","",name));
   const list=element("div","workshop-standard-list");
   for(const item of items){
    const details=element("details","workshop-standard-item");
    const summary=element("summary","","");
    const heading=element("span","workshop-standard-name",item.name);
    const meta=element("span","workshop-standard-caption",item.subtitle||item.use);
    const badge=item.tier==="core"?element("span","workshop-standard-tag","Standard"):null;
    summary.append(heading,meta);if(badge)summary.append(badge);
    const body=element("div","workshop-standard-body");
    body.append(element("p","",item.spec),element("p","muted",item.use));
    if(item.caution)body.append(element("p","resource-caution",item.caution));
    if(item.source){const link=element("a","workshop-spec-source","Example manufacturer specifications");link.href=item.source;link.target="_blank";link.rel="noopener noreferrer";body.append(link)}
    details.append(summary,body);list.append(details);
   }
   group.append(list);mount.append(group);
  };
  section("Core materials to keep on hand",workshopSupplies.filter(x=>x.tier==="core"));
  section("Basic equipment",workshopEquipment);
  const extras=element("details","workshop-optional-group");
  const heading=element("summary","","Special-purpose materials (only when needed)");
  extras.append(heading);
  const list=element("div","workshop-standard-list");
  for(const item of workshopSupplies.filter(x=>x.tier==="conditional")){
   const details=element("details","workshop-standard-item");
   details.append(element("summary","",item.name+" — "+item.subtitle));
   const body=element("div","workshop-standard-body");
   body.append(element("p","",item.spec),element("p","muted",item.use));
   if(item.caution)body.append(element("p","resource-caution",item.caution));
   if(item.source){const link=element("a","workshop-spec-source","Example manufacturer specifications");link.href=item.source;link.target="_blank";link.rel="noopener noreferrer";body.append(link)}
   details.append(body);list.append(details);
  }
  extras.append(list);mount.append(extras);
 }
 function renderCommonParts(){
  renderCatalog("resource-commonparts",all("parts"),"part");
  renderWorkshopEssentials();
  const mount=document.querySelector(".resource-wire-list");if(!mount)return;
  mount.replaceChildren();
  if(!wires.length)mount.append(element("p","muted","No wire types are saved yet."));
  for(const wire of wires){
   const row=element("div","resource-wire-item");
   row.append(element("span","",wireName(wire)),element("span","muted",[wire.construction,wire.insulation].filter(Boolean).join(" · ")));
   if(admin){const edit=element("button","btn","Edit");edit.type="button";edit.onclick=()=>editWire(wire);row.append(edit)}
   mount.append(row);
  }  const commonList=document.querySelector(".resource-common-list");
  if(commonList){
   commonList.replaceChildren();
   if(!commonRecords.length)commonList.append(element("p","muted","No specific screws or converters saved yet. Add a common part to define one."));
   for(const part of commonRecords){
    const row=element("div","resource-wire-item");
    const category=part.category==="screws"?"Screw / fastener":part.category==="buck-converters"?"Buck converter":"Other";
    row.append(element("span","",part.name),element("span","muted",category+" · "+[part.partNumber,part.specifications].filter(Boolean).join(" · ")));
    if(admin){const edit=element("button","btn","Edit");edit.type="button";edit.onclick=()=>editCommon(part);row.append(edit)}
    commonList.append(row);
   }
  }
 }
 const wireFields=[["name","Wire description"],["awg","AWG"],["construction","Construction / stranding"],["insulation","Insulation"],["color","Color"],["manufacturer","Manufacturer"],["partNumber","Part number"],["notes","Notes"]];
 let editingWire=null;
 function editWire(wire){
  const form=document.querySelector(".resource-wire-form");if(!form)return;
  editingWire=wire?.id||null;
  for(const [key] of wireFields)form.querySelector('[data-field="'+key+'"]').value=wire?.[key]||"";
  form.querySelector(".resource-wire-form-title").textContent=editingWire?"Edit wire type":"New wire type";
  form.classList.remove("hide");form.querySelector('[data-field="name"]').focus();
 }
 function initWireForm(){
  const form=document.querySelector(".resource-wire-form");if(!form)return;
  const fields=form.querySelector(".resource-wire-fields");
  for(const [key,title] of wireFields){
   const label=element("label","",title),input=element("input","field");input.dataset.field=key;input.name=key;label.append(input);fields.append(label);
  }
  document.querySelector(".resource-wire-new").onclick=()=>{if(admin)editWire(null)};
  form.querySelector(".resource-wire-cancel").onclick=()=>form.classList.add("hide");
  form.onsubmit=async event=>{
   event.preventDefault();const status=document.querySelector(".resource-wire-status");
   const payload={};for(const [key] of wireFields)payload[key]=form.querySelector('[data-field="'+key+'"]').value.trim();
   if(!payload.name){status.textContent="Wire description is required.";return}
   const button=form.querySelector('[type="submit"]');button.disabled=true;status.textContent="Saving wire…";
   try{
    const response=await fetch("/api/wires"+(editingWire?"?id="+encodeURIComponent(editingWire):""),{
     method:editingWire?"PUT":"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify(payload)
    });
    const data=await response.json();if(!response.ok)throw Error(data.error||"Unable to save wire material");
    status.textContent=payload.name+" saved to shared wire library.";
    form.classList.add("hide");await reloadWires();
   }catch(e){status.textContent=e.message}finally{button.disabled=false}
  };
 }
 const commonFields=[
  ["category","Category"],["name","Part name"],["manufacturer","Manufacturer"],
  ["partNumber","Part number"],["specifications","Specifications"],["notes","Notes"]
 ];
 let editingCommonId=null;
 function editCommon(part){
  const form=document.querySelector(".resource-common-form");if(!form)return;
  editingCommonId=part?.id||null;
  for(const [key] of commonFields)form.querySelector('[data-common-field="'+key+'"]').value=part?.[key]||(key==="category"?"screws":"");
  form.querySelector(".resource-common-form-title").textContent=editingCommonId?"Edit saved part":"New saved part";
  form.classList.remove("hide");form.querySelector('[data-common-field="name"]').focus();
 }
 function initCommonForm(){
  const form=document.querySelector(".resource-common-form");if(!form)return;
  const mount=form.querySelector(".resource-common-fields");
  for(const [key,name] of commonFields){
   const label=element("label","",name);
   let field;
   if(key==="category"){
    field=element("select","field");
    for(const [value,title] of [["screws","Screws / fasteners"],["buck-converters","Buck converters"],["other","Other shared components"]]){
     const opt=element("option","",title);opt.value=value;field.append(opt);
    }
   }else{field=element("input","field");field.type="text";field.maxLength=key==="notes"||key==="specifications"?1000:100}
   field.dataset.commonField=key;label.append(field);mount.append(label);
  }
  document.querySelector(".resource-common-new").onclick=()=>{if(admin)editCommon(null)};
  form.querySelector(".resource-common-cancel").onclick=()=>form.classList.add("hide");
  form.onsubmit=async event=>{
   event.preventDefault();const status=document.querySelector(".resource-common-status");
   if(!admin){status.textContent="Administrator login required.";return}
   const input={};for(const [key] of commonFields)input[key]=form.querySelector('[data-common-field="'+key+'"]').value.trim();
   if(!input.name){status.textContent="Enter a common part name.";return}
   const button=form.querySelector('[type="submit"]');button.disabled=true;status.textContent="Saving common part…";
   try{
    const res=await fetch("/api/commonparts"+(editingCommonId?"?id="+encodeURIComponent(editingCommonId):""),{method:editingCommonId?"PUT":"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify(input)});
    const data=await res.json();if(!res.ok)throw Error(data.error||"Unable to save common part");
    form.classList.add("hide");status.textContent=input.name+" saved to shared Common Parts.";
    await reloadCommonParts();
   }catch(e){status.textContent=e.message}finally{button.disabled=false}
  };
 }
 function setAdmin(value){admin=!!value;const button=document.querySelector(".resource-wire-new");if(button)button.classList.toggle("hide",!admin);const form=document.querySelector(".resource-wire-form");if(form&&!admin)form.classList.add("hide");
 const commonButton=document.querySelector(".resource-common-new");if(commonButton)commonButton.classList.toggle("hide",!admin);
 const commonForm=document.querySelector(".resource-common-form");if(commonForm&&!admin)commonForm.classList.add("hide");
 renderCommonParts()}
 let initialized=false;
 function init(){
  if(initialized)return;
  initialized=true;
  try{
   renderCatalog("resource-tools",tools,"tool");
   renderCatalog("resource-calculators",calculators,"calculator");
   renderCommonParts();
   initWireForm();
   initCommonForm();
   setAdmin(admin);
   void reloadWires();
   void reloadCommonParts();
   // Shared-resource pages must not depend on any other project script.
   fetch("/api/auth",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(data=>{if(data)setAdmin(!!data.authenticated)}).catch(()=>{});
  }catch(error){
   initialized=false;
   console.error("Shared resource pages did not initialize:",error);
   for(const [id,label] of [["resource-tools","Tools"],["resource-calculators","Calculators"],["resource-commonparts","Workshop parts"]]){
    const panel=document.getElementById(id);
    if(panel&&!panel.children.length)panel.textContent=label+" could not load. Refresh the page or report the browser console error.";
   }
  }
 }
 window.BSResources={catalog,all,mount,reloadWires,reloadCommonParts,init,normalize,setAdmin};
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
 else init();
})();