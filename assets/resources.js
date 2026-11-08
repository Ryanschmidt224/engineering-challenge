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
 const catalog={tools,calculators,parts:baseParts};
 let wires=[],commonRecords=[],listeners=new Set(),admin=false;
 const byId=(kind,id)=>catalog[kind]?.find(item=>item.id===id);
 const wireName=w=>[w.name,w.awg?w.awg+" AWG":"",w.color,w.partNumber].filter(Boolean).join(" · ");
 function all(kind){
  if(kind==="parts")return [...baseParts,...wires.map(w=>({id:"wire:"+w.id,name:wireName(w),subtitle:"Shared wire type",detail:[w.construction,w.insulation,w.manufacturer,w.notes].filter(Boolean).join(" · ")})),...commonRecords.map(p=>({id:"common:"+p.id,name:p.name,subtitle:p.category==="screws"?"Shared fastener":p.category==="buck-converters"?"Shared buck converter":"Shared component",detail:[p.manufacturer,p.partNumber,p.specifications,p.notes].filter(Boolean).join(" · ")}))];
  return catalog[kind]||[];
 }
 function label(kind,id){return all(kind).find(item=>item.id===id)?.name||"Unavailable library item ("+id+")"}
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
   const kinds=[["tools","Tool","Tools"],["calculators","Calculator","Calculators"],["parts","Part from library","Common Parts"]];
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
 function renderCommonParts(){
  renderCatalog("resource-commonparts",all("parts"),"part");
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
  form.querySelector(".resource-common-form-title").textContent=editingCommonId?"Edit common part":"New common part";
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
   for(const [id,label] of [["resource-tools","Tools"],["resource-calculators","Calculators"],["resource-commonparts","Common Parts"]]){
    const panel=document.getElementById(id);
    if(panel&&!panel.children.length)panel.textContent=label+" could not load. Refresh the page or report the browser console error.";
   }
  }
 }
 window.BSResources={catalog,all,mount,reloadWires,reloadCommonParts,init,normalize,setAdmin};
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
 else init();
})();