// Two Workshop scopes: public recommended catalog, private account-owned inventory.
(function(){
 "use strict";
 const $=(q,root=document)=>root.querySelector(q);
 const el=(tag,text,cls)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=text;if(cls)x.className=cls;return x};
 const req=async(path,method="GET",body=null)=>{
  const opts={method,credentials:"same-origin",cache:"no-store"};
  if(body){opts.headers={"content-type":"application/json"};opts.body=JSON.stringify(body)}
  const res=await fetch(path,opts),data=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(data.error||"Request failed");return data;
 };
 const recommendations=[
  {group:"Beginner",items:[
   ["Digital multimeter","tool"],["Temperature-controlled soldering station","tool"],
   ["Electronics solder and flux","material"],["22 AWG signal hook-up wire","material"],
   ["Wire stripper and flush cutters","tool"],["Breadboard and jumper wires","tool"],
   ["Safety glasses and solder-fume ventilation","tool"]]},
  {group:"Intermediate",items:[
   ["Logic-level N-channel MOSFET assortment","component"],["Arduino-compatible microcontroller","equipment"],
   ["Resistor and capacitor assortment","component"],["Adjustable DC bench supply","equipment"],
   ["Crimp terminals and crimper","tool"],["Microcontroller programmer","tool"]]},
  {group:"Advanced",items:[
   ["Oscilloscope and suitable probes","equipment"],["Logic analyzer","equipment"],
   ["Electronic DC load","equipment"],["Hot-air rework station","tool"],
   ["Precision current measurement","equipment"]]}
 ];
 const styles=`
  .workshop-scope{margin:16px 0 24px;padding:18px;border:1px solid var(--border,#cbd5d1);border-radius:14px}
  .workshop-scope h2{margin:0 0 8px}
  .workshop-scope .workshop-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:10px 0}
  .workshop-scope .workshop-row input,.workshop-scope .workshop-row select{min-width:135px;max-width:300px;flex:1}
  .workshop-scope .workshop-form-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:10px}
  .workshop-scope label{display:flex;flex-direction:column;gap:4px}
  .workshop-scope .workshop-items{display:grid;gap:8px;margin-top:12px}
  .workshop-scope .workshop-item{display:flex;flex-wrap:wrap;gap:10px;justify-content:space-between;align-items:center;padding:10px;border:1px solid var(--border,#cbd5d1);border-radius:10px}
  .workshop-scope .workshop-actions{display:flex;gap:8px}
  .workshop-scope .workshop-reco{padding:9px 0;border-bottom:1px solid var(--border,#ddd)}
  .workshop-scope .workshop-reco:last-child{border-bottom:0}
  .workshop-scope .workshop-check{padding:9px 0;border-bottom:1px solid var(--border,#ddd)}
  .workshop-scope .workshop-status{margin:8px 0;min-height:18px}
  .workshop-photo-thumb{max-height:100px;max-width:150px;object-fit:contain}
 `;
 const style=el("style");style.textContent=styles;document.head.append(style);
 function init(){
  const root=$("#commonparts .resource-page");if(!root)return;
  const header=$(".resource-heading",root);
  const personal=el("section",undefined,"workshop-scope");
  personal.innerHTML='<h2>My Workshop</h2><p class="muted">Private to your account. Record equipment and materials you actually own; recommendations are not assumed owned.</p><p class="workshop-status" role="status"></p><div class="workshop-private"></div>';
  const shared=el("section",undefined,"workshop-scope");
  shared.innerHTML='<h2>Website Workshop — recommended equipment</h2><p class="muted">A suggested starting kit, not an inventory of what you own. Filter by experience level.</p><div class="workshop-row"><label for="workshop-level">Show recommendations up to</label><select id="workshop-level" class="field"><option value="0">Beginner</option><option value="1">Intermediate</option><option value="2">Advanced</option></select></div><div class="workshop-recommendations"></div><details><summary>Detailed shared Workshop reference</summary><p class="muted">Detailed specifications, wire and tool recommendations, and shared catalog entries appear below.</p></details>';
  header.after(personal,shared);
  // Existing shared tree remains canonical and admin-managed; visually group it under the shared Workshop.
  const sharedDetails=$("details",shared);
  const sharedItems=$(".workshop-essentials",root),saved=$(".workshop-saved-details",root);
  if(sharedItems)sharedDetails.append(sharedItems);
  if(saved)sharedDetails.append(saved);
  const renderRecs=()=>{
   const level=Number($("#workshop-level",shared).value),list=$(".workshop-recommendations",shared);
   list.replaceChildren();
   recommendations.slice(0,level+1).forEach((group)=>{
    const details=el("details");details.open=true;
    details.append(el("summary",group.group));
    for(const [name,kind] of group.items){
     const row=el("div",undefined,"workshop-reco");
     row.append(el("span",name));
     const add=el("button","+ Add to My Workshop","btn");add.type="button";
     add.onclick=()=>{if(!$("#workshop-editor",personal)){setStatus("Sign in to add recommended equipment to your private Workshop.");return}fill({name,kind,category:group.group});$("#workshop-name",personal).focus();personal.scrollIntoView({block:"start",behavior:"smooth"})};
     row.append(add);details.append(row);
    }
    list.append(details);
   });
  };
  $("#workshop-level",shared).addEventListener("change",renderRecs);renderRecs();
  const privateArea=$(".workshop-private",personal),status=$(".workshop-status",personal);
  let items=[],editingId=null,photoId="";
  const setStatus=msg=>status.textContent=msg;
  async function auth(){
   const user=(await req("/api/accounts")).user;
   if(!user){privateArea.replaceChildren(el("p","Sign in through My account on the Projects page to use your personal Workshop."));return false}
   return true;
  }
  function buildUI(){
   privateArea.innerHTML=`
    <div class="workshop-row"><input id="workshop-search" class="field" type="search" placeholder="Search my equipment and parts" aria-label="Search my Workshop"><select class="field" id="workshop-type-filter" aria-label="Filter inventory by type"><option value="">All types</option><option value="tool">Tools</option><option value="equipment">Equipment</option><option value="component">Components</option><option value="material">Materials</option><option value="other">Other</option></select><button class="btn" type="button" id="workshop-new">+ Add item</button></div>
    <div class="workshop-items" id="workshop-items"></div>
    <details id="workshop-editor"><summary>Item details</summary>
     <div class="workshop-form-grid">
      <label>Name<input id="workshop-name" class="field" maxlength="180"></label>
      <label>Type<select id="workshop-kind" class="field"><option value="tool">Tool</option><option value="equipment">Equipment</option><option value="component">Component</option><option value="material">Material</option><option value="other">Other</option></select></label>
      <label>Category<input id="workshop-category" class="field" maxlength="80"></label>
      <label>Manufacturer<input id="workshop-manufacturer" class="field" maxlength="100"></label>
      <label>Model<input id="workshop-model" class="field" maxlength="120"></label>
      <label>Part number<input id="workshop-partnumber" class="field" maxlength="120"></label>
      <label>Quantity<input id="workshop-quantity" class="field" type="number" min="0" step="any" value="1"></label>
      <label>Unit<input id="workshop-unit" class="field" maxlength="32" value="pcs"></label>
     </div>
     <label>Specifications (one per line: name: value)<textarea id="workshop-specifications" class="field" rows="3"></textarea></label>
     <label>Notes<textarea id="workshop-notes" class="field" maxlength="1500"></textarea></label>
     <div class="workshop-row"><label>Photo of equipment<input id="workshop-photo" type="file" accept="image/jpeg,image/png,image/webp"></label><button id="workshop-photo-upload" type="button" class="btn">Import photo and identify</button><img id="workshop-photo-preview" class="workshop-photo-thumb" hidden alt="Equipment photo"></div>
     <p class="muted">AI identification is a draft. Check the model and specifications yourself before saving.</p>
     <div class="workshop-row"><button id="workshop-save" type="button" class="btn primary">Save item</button><button id="workshop-cancel" type="button" class="btn">Cancel</button></div>
    </details>
    <section class="workshop-compare"><h3>Project readiness</h3><p class="muted">Compare project BOM items with confirmed inventory. An unknown item is not assumed missing.</p>
     <div class="workshop-row"><select id="workshop-project" class="field" aria-label="Select project"><option value="">Select a project</option></select><button id="workshop-compare" class="btn" type="button">Compare BOM</button></div>
     <div id="workshop-comparison"></div>
    </section>`;
   $("#workshop-search",personal).addEventListener("input",render);
   $("#workshop-type-filter",personal).addEventListener("change",render);
   $("#workshop-new",personal).onclick=()=>fill({});
   $("#workshop-save",personal).onclick=save;
   $("#workshop-cancel",personal).onclick=()=>$("#workshop-editor",personal).open=false;
   $("#workshop-photo-upload",personal).onclick=uploadPhoto;
   $("#workshop-compare",personal).onclick=compare;
  }
  const fields={name:"name",kind:"kind",category:"category",manufacturer:"manufacturer",model:"model",partNumber:"partnumber",quantity:"quantity",unit:"unit",notes:"notes"};
  function fill(item){
   editingId=item.id||null;photoId=item.photoId||"";
   for(const [key,id] of Object.entries(fields)){
    const input=$("#workshop-"+id,personal);
    if(input)input.value=item[key]??(key==="quantity"?1:key==="unit"?"pcs":key==="kind"?"other":"");
   }
   const preview=$("#workshop-photo-preview",personal);
   if(preview){preview.hidden=!photoId;if(photoId)preview.src="/api/workshop-photo?id="+encodeURIComponent(photoId)}
   const specs=$("#workshop-specifications",personal);
   if(specs)specs.value=(item.specifications||[]).map(x=>x.name+": "+x.value).join("\n");
   $("#workshop-editor",personal).open=true;
  }
  function render(){
   const list=$("#workshop-items",personal);if(!list)return;list.replaceChildren();
   const search=$("#workshop-search",personal).value.toLowerCase();
   const type=$("#workshop-type-filter",personal).value;
   const matches=items.filter(x=>(!type||x.kind===type)&&[x.name,x.manufacturer,x.model,x.category,x.partNumber].join(" ").toLowerCase().includes(search));
   if(!matches.length){list.append(el("p","No matching items in your personal Workshop.","muted"));return}
   for(const item of matches){
    const row=el("article",undefined,"workshop-item"),details=el("div");
    details.append(el("strong",item.name),el("p",[item.manufacturer,item.model,item.category].filter(Boolean).join(" · ")+" · Qty "+item.quantity+" "+item.unit,"muted"));
    if(item.photoId){const img=el("img",undefined,"workshop-photo-thumb");img.src="/api/workshop-photo?id="+encodeURIComponent(item.photoId);img.alt="Photo of "+item.name;details.append(img)}
    const actions=el("div",undefined,"workshop-actions"),edit=el("button","Edit","btn"),remove=el("button","Delete","btn");
    edit.onclick=()=>{fill(item);$("#workshop-editor",personal).scrollIntoView({block:"nearest"})};
    remove.onclick=async()=>{if(!confirm("Delete "+item.name+" from your private Workshop?"))return;
     try{items=(await req("/api/personal-workshop","DELETE",{id:item.id})).items;render()}catch(e){setStatus(e.message)}};
    actions.append(edit,remove);row.append(details,actions);list.append(row);
   }
  }
  async function save(){
   const input={};for(const [key,id] of Object.entries(fields))input[key]=$("#workshop-"+id,personal).value;
   input.photoId=photoId;
   input.specifications=$("#workshop-specifications",personal).value.split(/\r?\n/).map(row=>{
    const split=row.indexOf(":");return split<1?null:{name:row.slice(0,split).trim(),value:row.slice(split+1).trim()};
   }).filter(Boolean);
   if(editingId)input.id=editingId;
   try{const data=await req("/api/personal-workshop",editingId?"PUT":"POST",input);
    items=data.items;$("#workshop-editor",personal).open=false;render();setStatus(input.name+" saved to your private Workshop.");
   }catch(e){setStatus(e.message)}
  }
  async function uploadPhoto(){
   const input=$("#workshop-photo",personal),file=input.files?.[0];if(!file){setStatus("Select a photo first.");return}
   const body=new FormData();body.append("photo",file);
   setStatus("Uploading and checking photo...");
   try{
    const res=await fetch("/api/workshop-photo",{method:"POST",body,credentials:"same-origin"});
    const data=await res.json();if(!res.ok)throw Error(data.error||"Upload failed");
    photoId=data.photoId;
    const preview=$("#workshop-photo-preview",personal);preview.src="/api/workshop-photo?id="+encodeURIComponent(photoId);preview.hidden=false;
    if(data.suggestion){for(const [key,id] of Object.entries(fields)){
     if(typeof data.suggestion[key]==="string"&&data.suggestion[key].trim())$("#workshop-"+id,personal).value=data.suggestion[key];
    }}
    if(Array.isArray(data.suggestion?.specifications))$("#workshop-specifications",personal).value=data.suggestion.specifications.map(x=>x.name+": "+x.value).join("\n");
    setStatus(data.recognitionError||"Identification proposed. Review every detail, then save.");
   }catch(e){setStatus(e.message)}
  }
  async function loadProjects(){
   try{const projects=(await req("/api/projects")).projects||[],select=$("#workshop-project",personal);
    for(const p of projects){const opt=el("option",p.name+(p.visibility==="private"?" (private)":""));opt.value=p.id;select.append(opt)}
   }catch(e){setStatus(e.message)}
  }
  async function compare(){
   const project=$("#workshop-project",personal).value,target=$("#workshop-comparison",personal);
   if(!project){setStatus("Select a project.");return}
   target.replaceChildren();try{
    const data=await req("/api/personal-workshop?project="+encodeURIComponent(project));
    const counts={owned:0,short:0,unknown:0,check:0};
    for(const part of data.comparison){counts[part.status]=(counts[part.status]||0)+1;
     const line=el("div",undefined,"workshop-check");
     const label={owned:"Owned",short:"Not enough",unknown:"Unknown — check inventory",check:"Check details"}[part.status];
     line.append(el("strong",label+" · "+part.name),el("div",(part.required===null?"Quantity not specified":"Need "+part.required+" "+part.unit)+(part.available===null?"":" · In Workshop "+part.available+" "+part.unit),"muted"));target.append(line);
    }
    target.prepend(el("p",counts.owned+" covered · "+counts.short+" short · "+counts.unknown+" unknown · "+counts.check+" need review"));
   }catch(e){setStatus(e.message)}
  }
  (async()=>{try{if(!await auth())return;buildUI();items=(await req("/api/personal-workshop")).items;render();await loadProjects()}catch(e){setStatus(e.message)}})();
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
