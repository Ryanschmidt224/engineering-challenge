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
  .workshop-recommend-search-label{display:block;margin:12px 0 6px;font-size:.88rem;font-weight:650}
  #workshop-recommend-search{display:block;width:100%;max-width:500px}
  .workshop-recommend-results:not(:empty){margin:10px 0 16px;border:1px solid var(--color-border,#ddd);padding:10px;border-radius:10px}
  .workshop-recommend-results .workshop-reco{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
  #commonparts .workshop-catalog{margin:12px 0 20px}
  #commonparts .workshop-catalog-bar{display:flex;justify-content:space-between;align-items:end;gap:16px;border-bottom:2px solid var(--color-border,#cbd5d1);padding:0 0 12px}
  #commonparts .workshop-catalog-bar h3{margin:0;font-size:1.15rem}
  #commonparts .workshop-catalog-subtitle{margin:4px 0 0;font-size:.82rem}
  #commonparts .workshop-sort-label{font-size:.78rem;font-weight:600;white-space:nowrap}
  #commonparts .workshop-sort-label select{display:block;width:155px;max-width:100%;padding:5px}
  #commonparts .workshop-catalog-count{color:var(--color-text-muted,#667);font-size:.82rem;margin:10px 0}
  #commonparts .workshop-catalog-columns,#commonparts .workshop-catalog-line{display:grid;grid-template-columns:minmax(180px,2fr) minmax(100px,.9fr) minmax(140px,2.2fr) 120px;gap:12px;align-items:center}
  #commonparts .workshop-catalog-columns{background:var(--color-sidebar,#edf2ef);padding:9px 12px;font-weight:650;font-size:.76rem;color:var(--color-text-muted,#52645c)}
  #commonparts .workshop-catalog-entry{border-bottom:1px solid var(--color-border,#d7dedb)}
  #commonparts .workshop-catalog-line{padding:10px 12px;min-height:57px}
  #commonparts .workshop-catalog-entry:nth-child(even){background:var(--color-surface-muted,#fafbfa)}
  #commonparts .workshop-catalog-entry:hover{background:var(--color-hover,#eff5f0)}
  #commonparts .workshop-catalog-main-item{display:flex;flex-direction:column;align-items:start;gap:3px;min-width:0}
  #commonparts .workshop-catalog-name{background:none;border:0;padding:0;text-align:left;font:inherit;font-weight:650;color:var(--color-accent,#2d7159);text-decoration:underline;text-underline-offset:2px;cursor:pointer}
  #commonparts .workshop-catalog-main-item small{font-size:.77rem;line-height:1.3}
  #commonparts .workshop-catalog-category,#commonparts .workshop-catalog-use{font-size:.79rem;line-height:1.4}
  #commonparts .workshop-catalog-add{font-size:.75rem;padding:6px 8px;white-space:nowrap}
  #commonparts .workshop-catalog-detail{border-top:1px solid var(--color-border,#ddd);padding:14px 18px 16px 26px;background:var(--color-page,#fff);font-size:.85rem}
  #commonparts .workshop-catalog-detail p{margin:0 0 8px}
  #commonparts .workshop-catalog-detail[hidden]{display:none!important}
  #commonparts .workshop-recommend-results{display:none}
  #commonparts .workshop-recommendations,#commonparts .workshop-scope>details{margin-top:18px}
  #commonparts .workshop-item{border-radius:3px;padding:12px 14px;gap:14px}
  @media(max-width:850px){
   #commonparts .workshop-catalog-columns{display:none}
   #commonparts .workshop-catalog-line{grid-template-columns:minmax(0,1fr) auto;gap:6px}
   #commonparts .workshop-catalog-category,#commonparts .workshop-catalog-use{grid-column:1}
   #commonparts .workshop-catalog-add{grid-column:2;grid-row:1/4}
   #commonparts .workshop-catalog-bar{align-items:start;flex-wrap:wrap}
  }

 `;
 const style=el("style");style.textContent=styles;document.head.append(style);
 function init(){
  const root=$("#commonparts .resource-page");if(!root)return;
  const header=$(".resource-heading",root);
  const personal=el("section",undefined,"workshop-scope");
  personal.innerHTML='<h2>My Workshop</h2><p class="muted">Private to your account. Record equipment and materials you actually own; recommendations are not assumed owned.</p><p class="workshop-status" role="status"></p><div class="workshop-private"></div>';
  const shared=el("section",undefined,"workshop-scope");
  shared.innerHTML='<h2>Website Workshop — recommended equipment</h2><p class="muted">Recommended specifications are separate from what you own. Everyday consumables such as solder are excluded from BOMs by default.</p><label class="workshop-recommend-search-label" for="workshop-recommend-search">Find a recommended tool or supply</label><input id="workshop-recommend-search" class="field" type="search" placeholder="Search solder, multimeter, heat shrink…" autocomplete="off"><div class="workshop-recommend-results" aria-live="polite"></div><div class="workshop-row"><label for="workshop-level">Show recommendations up to</label><select id="workshop-level" class="field"><option value="0">Beginner</option><option value="1">Intermediate</option><option value="2">Advanced</option></select></div><div class="workshop-recommendations"></div><details><summary>Browse all five Workshop categories</summary><p class="muted">Open a category for specifications, choices, and recommended products.</p></details>';
  header.after(personal,shared);
  // Existing shared tree remains canonical and admin-managed; visually group it under the shared Workshop.
  const sharedDetails=$("details",shared);
  const sharedItems=$(".workshop-essentials",root),saved=$(".workshop-saved-details",root);
  if(sharedItems)sharedDetails.append(sharedItems);
  if(saved)sharedDetails.append(saved);
  // One McMaster-style browsing shell, shared with Projects and Knowledge.
  // Only visibility changes here; personal inventory and standard items are
  // still stored separately and keep all their existing identifiers.
  sharedDetails.open=false;
  const sidebar=el("div",undefined,"bs-workshop-category-sidebar");
  const allPanels=[shared,personal,...[...root.children].filter(node=>node!==header&&node!==shared&&node!==personal)];
  window.BSCatalogUI?.build(root,sidebar,allPanels);
  const workshopCategories=window.BSResources?.workshopCategories||[];
  let selectedWorkshopCategory="all";
  const applyWorkshopCategory=()=>{
   const key=selectedWorkshopCategory;
   shared.hidden=key==="mine";
   personal.hidden=key!=="mine";
   const details=$("#workshop-essentials-list",shared);
   for(const branch of details?.querySelectorAll('[data-workshop-branch^="category-"]')||[]){
    const category=branch.dataset.workshopBranch.slice("category-".length);
    branch.hidden=key!=="all"&&category!==key;
    if(key!=="all"&&category===key)branch.open=true;
   }
   // Keep the long legacy reference tree collapsed; catalog rows are the primary browse surface.
   const intro=$(".workshop-recommendations",shared);
   const level=$(".workshop-row",shared);
   if(intro)intro.hidden=key!=="all";
   if(level)level.hidden=key!=="all";
  };
  const nav=window.BSCatalogUI?.categories(sidebar,{
   heading:"Browse Workshop",
   onChange:key=>{selectedWorkshopCategory=key;applyWorkshopCategory();queueMicrotask(()=>root.querySelector(".workshop-catalog-sort")?.dispatchEvent(new Event("change")))}
  });
  nav?.setItems([{value:"all",label:"All workshop items"},
   ...workshopCategories.map(([id,name])=>({value:id,label:name})),
   {value:"mine",label:"My Workshop"}]);
  root.addEventListener("bsworkshopupdated",applyWorkshopCategory);
  window.addEventListener("bsworkshopfocus",event=>{
   const id=event.detail?.id;
   const category=workshopCategories.find(([, ,ids])=>ids.includes(id))?.[0];
   if(category)nav?.select(category);
  });
  applyWorkshopCategory();
  const standards=()=>window.BSResources?.workshopReferences||[];
  // McMaster-style catalog: category on the left, quick-filtered item table on
  // the right, and specifications expanded in context. All records are the
  // existing curated Workshop references; this does not scrape third parties.
  const catalog=el("section",undefined,"workshop-catalog");
  catalog.innerHTML='<div class="workshop-catalog-bar"><div><h3>Workshop catalog</h3><p class="muted workshop-catalog-subtitle">Browse reference equipment, components, and materials. These are not automatically in your inventory.</p></div><label class="workshop-sort-label">Sort <select class="field workshop-catalog-sort"><option value="name">Name A–Z</option><option value="type">Type</option><option value="level">Skill level</option></select></label></div><p class="workshop-catalog-count" role="status"></p><div class="workshop-catalog-list"></div>';
  const searchLabel=$("#workshop-recommend-search",shared).parentElement.querySelector(".workshop-recommend-search-label");
  if(searchLabel)searchLabel.textContent="Search catalog by name, size, type, or specification";
  const results=$("#workshop-recommend-search",shared);
  results.placeholder="Search wire, ferrules, oscilloscope, MOSFET…";
  results.after(catalog);
  const categoryFor=item=>{
   const found=workshopCategories.find(([, ,ids])=>ids?.includes(item.id));
   return found?.[0]||item.category||"other";
  };
  const categoryLabelFor=item=>workshopCategories.find(([key])=>key===categoryFor(item))?.[1]||"Other";
  const friendlyTier=item=>item.tier==="core"?"Beginner / essential":"Additional / specialized";
  const renderCatalog=()=>{
   const query=results.value.trim().toLowerCase(),sort=$(".workshop-catalog-sort",catalog).value;
   const list=$(".workshop-catalog-list",catalog);
   list.replaceChildren();
   const matched=standards().filter(item=>(selectedWorkshopCategory==="all"||categoryFor(item)===selectedWorkshopCategory)&&
    [item.name,item.subtitle,item.spec,item.use,item.kind,item.category,categoryLabelFor(item)].join(" ").toLowerCase().includes(query));
   matched.sort((a,b)=>{
    const col=sort==="type"?(String(a.kind||"").localeCompare(String(b.kind||""))):sort==="level"?(String(a.tier||"").localeCompare(String(b.tier||""))):0;
    return col||a.name.localeCompare(b.name,undefined,{numeric:true});
   });
   $(".workshop-catalog-count",catalog).textContent=matched.length+" reference items"+(query?" matching search":"");
   if(!matched.length){list.append(el("p","No matching catalog items. Try another search or category.","muted"));return}
   const heading=el("div",undefined,"workshop-catalog-columns");
   for(const t of ["Item / description","Category","Recommended use",""])heading.append(el("span",t));
   list.append(heading);
   for(const item of matched){
    const row=el("article",undefined,"workshop-catalog-entry");
    const summary=el("div",undefined,"workshop-catalog-line");
    const name=el("button",undefined,"workshop-catalog-name");
    name.type="button";name.textContent=item.name;name.setAttribute("aria-expanded","false");
    const main=el("div",undefined,"workshop-catalog-main-item");
    main.append(name);
    if(item.subtitle)main.append(el("small",item.subtitle,"muted"));
    summary.append(main,el("span",categoryLabelFor(item),"workshop-catalog-category"),
     el("span",item.use||friendlyTier(item),"workshop-catalog-use"));
    const add=el("button","+ My Workshop","btn workshop-catalog-add");
    add.type="button";add.title="Create a private inventory item based on this reference";
    add.onclick=()=>{
     if(!$("#workshop-editor",personal)){nav?.select("mine");setStatus("Sign in to add items to your personal Workshop.");return}
     nav?.select("mine");
     fill({name:item.name,kind:item.kind==="tool"?"tool":item.kind==="component"?"component":"material",
      category:categoryLabelFor(item),specifications:item.spec?[{name:"Recommended specification",value:item.spec}]:[]});
     $("#workshop-editor",personal)?.scrollIntoView({block:"start",behavior:"smooth"});
     $("#workshop-name",personal)?.focus();
    };
    summary.append(add);
    const detail=el("div",undefined,"workshop-catalog-detail");detail.hidden=true;
    const section=(label,value)=>{if(!value)return;const p=el("p");p.append(el("strong",label+" "),document.createTextNode(value));detail.append(p)};
    section("Specification:",item.spec);
    section("Typical use:",item.use);
    section("Important:",item.caution);
    section("Level:",friendlyTier(item));
    if(item.source&&/^https:\/\//.test(item.source)){
     const link=el("a","Manufacturer / reference source","workshop-catalog-link");
     link.href=item.source;link.target="_blank";link.rel="noopener noreferrer";detail.append(link);
    }
    name.onclick=()=>{detail.hidden=!detail.hidden;name.setAttribute("aria-expanded",String(!detail.hidden))};
    row.append(summary,detail);list.append(row);
   }
  };
  results.addEventListener("input",renderCatalog);
  $(".workshop-catalog-sort",catalog).addEventListener("change",renderCatalog);
  root.addEventListener("bsworkshopupdated",renderCatalog);
  // A category switch must update the searchable table as well as the old tree.
  // category callbacks use this shared listener, without changing any canonical data.
  sidebar.addEventListener("click",event=>{
   if(event.target.closest(".bs-catalog-category"))queueMicrotask(renderCatalog);
  });
  window.addEventListener("bsworkshopfocus",()=>queueMicrotask(renderCatalog));
  renderCatalog();

  const showRecommendation=id=>{
   document.querySelector('[data-nav="commonparts"]')?.click();
   sharedDetails.open=true;
   window.BSResources?.focusWorkshopItem(id);
  };
  const renderSearch=()=>{
   const term=$("#workshop-recommend-search",shared).value.trim().toLowerCase();
   const results=$(".workshop-recommend-results",shared);results.replaceChildren();
   if(!term)return;
   const found=standards().filter(item=>[item.name,item.spec,item.use,item.category].join(" ").toLowerCase().includes(term));
   if(!found.length){results.append(el("p","No matching recommendations.","muted"));return}
   for(const item of found.slice(0,20)){
    const row=el("div",undefined,"workshop-reco");
    row.append(el("span",item.name+" · "+(item.bomDefault==="exclude"?"Not added to BOM by default":"BOM item when specified")));
    const view=el("button","View recommendation","btn");view.type="button";view.onclick=()=>showRecommendation(item.id);
    row.append(view);results.append(row);
   }
  };
  $("#workshop-recommend-search",shared).addEventListener("input",renderSearch);
  const renderRecs=()=>{
   const level=Number($("#workshop-level",shared).value),list=$(".workshop-recommendations",shared);
   list.replaceChildren();
   recommendations.slice(0,level+1).forEach((group)=>{
    const details=el("details");details.open=true;
    details.append(el("summary",group.group));
    for(const [name,kind] of group.items){
     const row=el("div",undefined,"workshop-reco");
     row.append(el("span",name));
     const standard=standards().find(item=>item.name.toLowerCase()===name.toLowerCase());
     if(standard){
      const view=el("button","View recommendation","btn");view.type="button";
      view.onclick=()=>showRecommendation(standard.id);row.append(view);
     }
     const add=el("button","+ Add to My Workshop","btn");add.type="button";
     add.onclick=()=>{
      if(!$("#workshop-editor",personal)){setStatus("Sign in to add recommended equipment to your private Workshop.");return}
      fill({name,kind,category:standard?.category||"tools"});
      $("#workshop-name",personal).focus();personal.scrollIntoView({block:"start",behavior:"smooth"});
     };
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
      <label>Availability<select id="workshop-stockstatus" class="field"><option value="in_stock">In stock</option><option value="in_use_reusable">In use (reusable)</option><option value="committed">Committed</option></select></label>
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
  const fields={name:"name",kind:"kind",category:"category",manufacturer:"manufacturer",model:"model",partNumber:"partnumber",quantity:"quantity",unit:"unit",stockStatus:"stockstatus",notes:"notes"};
  function fill(item){
   editingId=item.id||null;photoId=item.photoId||"";
   for(const [key,id] of Object.entries(fields)){
    const input=$("#workshop-"+id,personal);
    if(input)input.value=item[key]??(key==="quantity"?1:key==="unit"?"pcs":key==="kind"?"other":key==="stockStatus"?"in_stock":"");
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
    details.append(el("strong",item.name),el("p",[item.manufacturer,item.model,item.category].filter(Boolean).join(" · ")+" · Qty "+item.quantity+" "+item.unit+" · "+({in_stock:"In stock",in_use_reusable:"In use (reusable)",committed:"Committed"}[item.stockStatus||"in_stock"]),"muted"));
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
    const counts={owned:0,reusable:0,short:0,unknown:0,check:0};
    for(const part of data.comparison){counts[part.status]=(counts[part.status]||0)+1;
     const line=el("div",undefined,"workshop-check");
     const label={owned:"In stock",reusable:"Available after reuse",short:"Not enough uncommitted stock",unknown:"Unknown — check inventory",check:"Check details"}[part.status];
     line.append(el("strong",label+" · "+part.name),el("div",(part.required===null?"Quantity not specified":"Need "+part.required+" "+part.unit)+(part.available===null?"":" · In stock "+part.available+" "+part.unit)+(part.reusable?" · Reusable "+part.reusable+" "+part.unit:"")+(part.committed?" · Committed "+part.committed+" "+part.unit:""),"muted"));target.append(line);
    }
    target.prepend(el("p",counts.owned+" in stock · "+counts.reusable+" reusable · "+counts.short+" short · "+counts.unknown+" unknown · "+counts.check+" need review"));
   }catch(e){setStatus(e.message)}
  }
  (async()=>{try{if(!await auth())return;buildUI();items=(await req("/api/personal-workshop")).items;render();await loadProjects()}catch(e){setStatus(e.message)}})();
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
