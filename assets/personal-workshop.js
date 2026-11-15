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


  /* Inventory ownership is visible during all shared-catalog searches. */
  /* Keep the related product strip at the bottom of the item viewport.
     A long edit form naturally pushes this section below its contents. */
  #commonparts .workshop-item-page:not([hidden]){
   display:flex;
   flex-direction:column;
   min-height:max(760px,calc(100vh - 180px));
   box-sizing:border-box;
  }
  #commonparts .workshop-item-related{
   margin-top:auto!important;
   padding-top:30px;
   border-top:2px solid var(--color-border);
   flex:none;
  }
  #commonparts .workshop-item-editor-mount:not(:empty){margin-bottom:34px}
  #commonparts .workshop-item-signin-prompt{margin:18px 0;padding:16px;border:1px solid var(--color-border);border-radius:7px;background:var(--color-surface)}
  #commonparts .workshop-detail-edit-actions{display:flex;gap:9px;flex-wrap:wrap;align-items:center;margin:8px 0 18px}
  #commonparts .workshop-detail-edit-actions .workshop-item-edit-button{min-height:42px}
  #commonparts .workshop-item-edit-button{display:inline-flex!important;align-items:center;justify-content:center;opacity:1!important;visibility:visible!important}
  @media(max-width:800px){
   #commonparts .workshop-item-page:not([hidden]){min-height:calc(100vh - 110px)}
  }
  #commonparts .workshop-catalog-entry.is-owned{background:color-mix(in srgb,var(--color-selected,#dcece4) 36%,var(--color-surface,#fff));border-left:3px solid var(--color-accent,#30795f)}
  #commonparts .workshop-personal-entry{border-left:3px solid var(--color-accent,#30795f);background:color-mix(in srgb,var(--color-selected,#dcece4) 24%,var(--color-surface,#fff))}
  #commonparts .workshop-owned-label,#commonparts .workshop-owned-note{display:inline-block;font-size:.78rem;line-height:1.45;font-weight:650;color:var(--color-accent,#30795f)}
  #commonparts .workshop-owned-note{font-size:.9rem;margin:12px 0}
  #commonparts .workshop-item-edit-button{border-color:var(--color-accent,#30795f);font-weight:650}
  #commonparts .workshop-catalog-thumb-action:hover .workshop-catalog-thumb{border-color:var(--color-accent,#30795f)}
  #commonparts .workshop-family-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(265px,1fr));gap:12px;margin-top:10px}
  #commonparts .workshop-family-tile{display:flex;align-items:flex-start;gap:14px;min-height:114px;padding:14px;border:1px solid var(--color-border);border-radius:5px;background:var(--color-surface);text-align:left;color:var(--color-text);cursor:pointer}
  #commonparts .workshop-family-tile:hover,#commonparts .workshop-family-tile:focus-visible{background:var(--color-hover);border-color:var(--color-accent)}
  #commonparts .workshop-family-tile .workshop-catalog-thumb{width:88px;height:88px;flex:none}
  #commonparts .workshop-family-tile .workshop-catalog-thumb svg{width:72px;height:72px}
  #commonparts .workshop-family-text{display:flex;flex-direction:column;gap:7px;min-width:0}
  #commonparts .workshop-family-text strong{font-size:.96rem;line-height:1.3}
  #commonparts .workshop-family-text small{font-size:.8rem;line-height:1.4}
  #commonparts .workshop-family-count{font-size:.75rem;color:var(--color-text-muted)}
  #commonparts .workshop-family-back{font:inherit;font-size:.85rem;font-weight:650;color:var(--color-accent);border:0;background:transparent;padding:6px 0;cursor:pointer}
  #commonparts .workshop-family-description{font-size:.85rem;color:var(--color-text-muted);margin:4px 0 14px}
  @media(max-width:650px){#commonparts .workshop-family-grid{grid-template-columns:1fr}}
  #commonparts .workshop-catalog-thumb-action{border:0;padding:0;background:transparent;cursor:pointer;text-align:left}
  #commonparts .workshop-catalog-thumb-action:focus-visible{outline:2px solid var(--color-accent);outline-offset:3px}
  #commonparts .workshop-item-page[hidden],#commonparts .workshop-item-side[hidden]{display:none!important}
  #commonparts .workshop-item-side{padding:0 12px 24px 0}
  #commonparts .workshop-item-back,#commonparts .workshop-item-crumb-link{padding:0;border:0;background:none;color:var(--color-accent);text-align:left;cursor:pointer;font:inherit;font-weight:650}
  #commonparts .workshop-item-back{margin:0 0 26px;font-size:.88rem}
  #commonparts .workshop-item-eyebrow{font-size:.8rem;color:var(--color-text-muted);margin:0 0 8px}
  #commonparts .workshop-item-side-title{font-size:1.25rem;line-height:1.3;margin:0 0 20px}
  #commonparts .workshop-item-side-row{padding:12px 0;border-top:1px solid var(--color-border)}
  #commonparts .workshop-item-side-row h3{font-size:.86rem;margin:0 0 7px}
  #commonparts .workshop-item-side-row p{font-size:.82rem;line-height:1.5;margin:0}
  #commonparts .workshop-item-side-action{width:100%;margin:14px 0}
  #commonparts .workshop-item-source{display:block;font-size:.83rem;margin:10px 0}
  #commonparts .workshop-item-page{min-width:0;padding:5px 0 30px}
  #commonparts .workshop-item-breadcrumb{display:flex;gap:5px;flex-wrap:wrap;font-size:.82rem;color:var(--color-text-muted);margin-bottom:18px}
  #commonparts .workshop-item-page-heading h2{font-size:clamp(1.5rem,2.2vw,2rem);margin:0}
  #commonparts .workshop-item-page-heading p{margin:5px 0 18px}
  #commonparts .workshop-item-hero{display:grid;grid-template-columns:minmax(200px,330px) minmax(0,1fr);align-items:start;gap:32px;padding:18px 0 28px;border-bottom:1px solid var(--color-border)}
  #commonparts .workshop-item-large-thumb{width:100%;height:auto;aspect-ratio:1.15;background:var(--color-surface-muted);border-radius:6px}
  #commonparts .workshop-item-large-thumb svg{width:min(70%,200px);height:min(70%,200px)}
  #commonparts .workshop-item-hero-info h3{margin:0 0 10px}
  #commonparts .workshop-item-hero-info p{max-width:650px;line-height:1.55}
  #commonparts .workshop-item-related{margin-top:25px}
  #commonparts .workshop-item-related{margin-top:104px;padding-top:26px;border-top:2px solid var(--color-border)}
  #commonparts .workshop-item-related:before{content:"Related Workshop items";display:block;color:var(--color-text-muted);font-weight:650;text-transform:uppercase;letter-spacing:.07em;font-size:.71rem;margin-bottom:14px}
  #commonparts .workshop-item-related-grid{grid-template-columns:repeat(auto-fill,minmax(115px,155px));gap:12px}
  #commonparts .workshop-item-related-choice{padding:9px;gap:6px;min-height:135px}
  #commonparts .workshop-item-related-choice .workshop-catalog-thumb{height:80px;width:100%}
  #commonparts .workshop-item-related-choice .workshop-catalog-thumb svg{height:55px;width:55px}
  #commonparts .workshop-item-related-choice strong{font-size:.78rem;line-height:1.3}
  #commonparts .workshop-item-related-choice small{font-size:.7rem}
  #commonparts .workshop-item-title-line{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
  #commonparts .workshop-item-edit-button{white-space:nowrap}
  #commonparts .workshop-catalog-photo-thumb img{height:100%;width:100%;object-fit:contain;border-radius:inherit}
  #commonparts .workshop-item-photo-gallery{display:flex;flex-wrap:wrap;gap:10px;margin:12px 0 0}
  #commonparts .workshop-item-photo-choice{padding:4px;border:1px solid var(--color-border);border-radius:5px;background:var(--color-surface);cursor:pointer}
  #commonparts .workshop-item-photo-choice:hover{border-color:var(--color-accent)}
  #commonparts .workshop-item-photo-choice img{display:block;width:72px;height:60px;object-fit:contain}
  #commonparts .workshop-reference-hero-image{display:block;width:100%;max-height:340px;object-fit:contain;background:var(--color-surface-muted);border:1px solid var(--color-border);border-radius:5px}
  #commonparts .workshop-reference-related-photo{width:100%;height:80px;object-fit:contain;background:var(--color-surface-muted)}
  #commonparts .workshop-reference-order-link,#commonparts .workshop-reference-doc-link{display:inline-block;margin:8px 8px 0 0;text-decoration:none}
  #commonparts .workshop-item-editor-mount:not(:empty){margin-top:28px}
  #commonparts .workshop-item-edit-form{background:var(--color-surface);border:1px solid var(--color-border);border-radius:8px;padding:22px}
  #commonparts .workshop-item-editor-heading{display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px}
  #commonparts .workshop-item-editor-heading h3{margin:0;font-size:1.12rem}
  #commonparts .workshop-item-editor-heading p{margin:0;font-size:.79rem}
  #commonparts .workshop-item-edit-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:15px}
  #commonparts .workshop-item-edit-grid label{display:flex;flex-direction:column;gap:5px;font-size:.83rem;font-weight:650;min-width:0}
  #commonparts .workshop-item-edit-grid label.workshop-edit-wide{grid-column:1/-1}
  #commonparts .workshop-item-edit-grid .field{width:100%;max-width:none;font-size:.86rem;font-weight:400}
  #commonparts .workshop-item-edit-form h4{margin:25px 0 12px}
  #commonparts .workshop-item-edit-photos{display:flex;flex-wrap:wrap;gap:12px}
  #commonparts .workshop-item-edit-photo{display:flex;flex-direction:column;gap:6px;width:180px;padding:8px;border:1px solid var(--color-border);border-radius:6px}
  #commonparts .workshop-item-edit-photo img{width:100%;height:125px;object-fit:contain}
  #commonparts .workshop-item-photo-upload{display:flex;align-items:center;flex-wrap:wrap;gap:12px;margin-top:15px}
  #commonparts .workshop-item-photo-upload input{font-size:.8rem;max-width:100%}
  #commonparts .workshop-item-editor-actions{display:flex;gap:12px;margin-top:22px}
  #commonparts .workshop-item-editor-status{font-size:.83rem;color:var(--color-text-muted)}
  @media(max-width:650px){
   #commonparts .workshop-item-related{margin-top:68px}
   #commonparts .workshop-item-edit-form{padding:14px}
  }

  #commonparts .workshop-item-related h3{font-size:1.07rem;margin:0 0 15px}
  #commonparts .workshop-item-related-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(165px,1fr));gap:12px}
  #commonparts .workshop-item-related-choice{display:flex;flex-direction:column;align-items:start;gap:8px;background:var(--color-surface);border:1px solid var(--color-border);padding:12px;border-radius:6px;text-align:left;color:var(--color-text);cursor:pointer}
  #commonparts .workshop-item-related-choice:hover{border-color:var(--color-accent);background:var(--color-hover)}
  #commonparts .workshop-item-related-choice .workshop-catalog-thumb{width:100%;height:105px}
  #commonparts .workshop-item-related-choice .workshop-catalog-thumb svg{width:73px;height:73px}
  #commonparts .workshop-item-related-choice strong{font-size:.86rem}
  #commonparts .workshop-item-related-choice small{font-size:.75rem;color:var(--color-text-muted)}
  @media(max-width:800px){
   #commonparts .workshop-item-hero{grid-template-columns:1fr;gap:18px}
   #commonparts .workshop-item-large-thumb{max-width:340px}
   #commonparts .workshop-item-side{border-bottom:1px solid var(--color-border);margin-bottom:20px}
  }

  #commonparts .workshop-recommend-results{display:none}
  #commonparts .workshop-legacy-details[hidden]{display:none!important}
  #commonparts .workshop-item{border-radius:3px;padding:12px 14px;gap:14px}

  /* Product catalog rows with meaningful, non-photographic thumbnails. */
  #commonparts .workshop-catalog-columns,#commonparts .workshop-catalog-line{grid-template-columns:82px minmax(210px,2.3fr) minmax(105px,.8fr) minmax(170px,1.7fr);gap:14px}
  #commonparts .workshop-catalog-line{min-height:102px}
  #commonparts .workshop-catalog-thumb{width:78px;height:78px;display:grid;place-items:center;border:1px solid var(--color-border,#d6ded9);border-radius:5px;background:#f6f8f7;color:#50736a;flex:none}
  #commonparts .workshop-catalog-thumb svg{width:63px;height:63px;display:block}
  #commonparts .workshop-catalog-main-item{gap:6px}
  #commonparts .workshop-catalog-add{align-self:start;margin-top:2px}
  #commonparts .workshop-catalog-detail{padding-left:107px}
  #commonparts .workshop-catalog-columns span:first-child{text-align:center}
  #commonparts .workshop-scope{padding:12px 16px}
  #commonparts #workshop-recommend-search{max-width:none}
  @media(max-width:850px){
   #commonparts .workshop-catalog-line{grid-template-columns:72px minmax(0,1fr);gap:8px 12px}
   #commonparts .workshop-catalog-thumb{grid-column:1;grid-row:1/4;width:68px;height:68px}
   #commonparts .workshop-catalog-thumb svg{width:56px;height:56px}
   #commonparts .workshop-catalog-main-item{grid-column:2;grid-row:1}
   #commonparts .workshop-catalog-category,#commonparts .workshop-catalog-use{grid-column:2}
   #commonparts .workshop-catalog-detail{padding-left:16px}
  }
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
  shared.innerHTML='<h2>Website Workshop</h2><p class="muted">Browse equipment, materials, and components by product family. Reference items are not automatically owned.</p><label class="workshop-recommend-search-label" for="workshop-recommend-search">Search Workshop</label><input id="workshop-recommend-search" class="field" type="search" placeholder="Search wire, ferrules, power supplies…" autocomplete="off"><div class="workshop-recommend-results" hidden></div><details class="workshop-legacy-details" hidden><summary>Legacy references</summary></details>';
  header.after(personal,shared);
  // Existing shared tree remains canonical and admin-managed; visually group it under the shared Workshop.
  const sharedDetails=$(".workshop-legacy-details",shared);
  const sharedItems=$(".workshop-essentials",root),saved=$(".workshop-saved-details",root);
  if(sharedItems)sharedDetails.append(sharedItems);
  if(saved)sharedDetails.append(saved);
  // One McMaster-style browsing shell, shared with Projects and Knowledge.
  // Only visibility changes here; personal inventory and standard items are
  // still stored separately and keep all their existing identifiers.
  sharedDetails.open=false;
  sharedDetails.hidden=true;
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
  };
  const nav=window.BSCatalogUI?.categories(sidebar,{
   heading:"Browse Workshop",
   onChange:key=>{selectedWorkshopCategory=key;selectedFamily="";applyWorkshopCategory();queueMicrotask(()=>root.querySelector(".workshop-catalog-sort")?.dispatchEvent(new Event("change")))}
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
  let workshopOverrides={},canEditReferences=false,accountSignedIn=false;
  let items=[],editingId=null,photoId="",catalogId="";
  const standards=()=>(window.BSResources?.workshopReferences||[]).map(item=>({...item,...(workshopOverrides[item.id]||{})}));
  const saveableFields=["name","subtitle","spec","use","caution","manufacturer","model","partNumber","supplier","supplierUrl","asin","price","packageQuantity","orderNotes","documentationUrl","notes"];
  const families=()=>window.BSResources?.workshopGroups||[];

  const normalizeName=value=>String(value||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
  const stockLabels={in_stock:"In stock",in_use_reusable:"In use · reusable",committed:"Committed"};
  const matchingReference=item=>standards().find(ref=>ref.id===item.catalogId)||
   standards().find(ref=>normalizeName(ref.name)===normalizeName(item.name));
  const familyOfPersonal=item=>{
   const linked=matchingReference(item);
   if(linked)return families().find(group=>group.items.includes(linked.id))?.id||"";
   const str=[item.name,item.category,item.kind].join(" ").toLowerCase();
   const patterns=[
    ["power-supplies",/power supply|converter|regulator|\bbuck\b|\bpsu\b/],
    ["wire-termination",/ferrule|terminal|crimp/],
    ["heat-shrink",/heat.?shrink|shrink tubing/],
    ["soldering",/solder|rework|heat gun/],
    ["measurement",/multimeter|oscilloscope|scope|logic analyzer|meter|probe/],
    ["wire-tools",/stripper|wire cutter/],
    ["wire",/\bwire\b|\bcable\b/],
    ["semiconductors",/mosfet|resistor|capacitor|transistor|diode/],
    ["controllers",/arduino|microcontroller|sensor|\bplc\b/],
    ["prototyping",/breadboard|jumper/],
    ["fasteners",/screw|washer|nut|bolt|fastener/],
    ["raw-materials",/aluminum|plastic stock|sheet metal/],
    ["safety",/safety|glasses|ventilation/]
   ];
   return patterns.find(([,pattern])=>pattern.test(str))?.[0]||"";
  };
  const categoryOfPersonal=item=>{
   const linked=matchingReference(item);
   if(linked)return categoryFor(linked);
   const raw=String(item.category||"").toLowerCase(),kind=String(item.kind||"");
   if(/safety|protect/.test(raw))return "safety";
   if(/consumable|wire|cable|solder|shrink|suppl/.test(raw))return "consumables";
   if(/electronic|power|component|controller|sensor/.test(raw))return "electronics";
   if(/hardware|fastener|material|stock/.test(raw))return "hardware";
   if(/tool|equipment|measure|instrument/.test(raw))return "tools";
   return kind==="tool"||kind==="equipment"?"tools":kind==="component"?"electronics":"hardware";
  };
  const ownedFor=ref=>items.filter(item=>item.catalogId===ref.id||
   (!item.catalogId&&normalizeName(item.name)===normalizeName(ref.name)));
  const ownershipLabel=records=>records.length?
   "My Workshop · "+records.map(item=>(stockLabels[item.stockStatus]||"In stock")+
    " ("+item.quantity+" "+(item.unit||"pcs")+")").join(", "):"";

  const familyFor=item=>families().find(g=>g.items.includes(item.id));
  let selectedFamily="";
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
  // Catalog illustrations where a verified product image is not available.
  const personalThumb=item=>{
   if(item.photoId){
    const frame=el("span",undefined,"workshop-catalog-thumb workshop-catalog-photo-thumb");
    const img=el("img");img.src="/api/workshop-photo?id="+encodeURIComponent(item.photoId);
    img.alt=item.name;frame.append(img);return frame;
   }
   return catalogThumb(item);
  };
  const catalogThumb=item=>{
   if(item.photos?.length){
    const frame=el("span",undefined,"workshop-catalog-thumb workshop-catalog-photo-thumb");
    const img=el("img");img.src="/api/workshop-reference?photo="+encodeURIComponent(item.photos[0].id);
    img.alt=item.photos[0].caption||item.name;frame.append(img);return frame;
   }
   const term=(item.name+" "+item.kind).toLowerCase();
   const kind=/wire|cable|shrink|ferrule/.test(term)?"wire":
    /screw|fastener|bolt|nut/.test(term)?"fastener":
    /multimeter|oscilloscope|meter|supply|load/.test(term)?"meter":
    /resistor|mosfet|arduino|sensor|breadboard|component/.test(term)?"pcb":
    /solder|stripper|crimp|gun|tool|cutter/.test(term)?"tool":"material";
   const drawings={
    wire:'<path d="M13 45c8-34 18-34 25 0s17 34 25 0 17-34 25 0"/><path d="M13 57c8-34 18-34 25 0s17 34 25 0 17-34 25 0"/>',
    fastener:'<path d="M20 42h58v19H20z"/><path d="M25 35h15v33H25z"/><path d="M48 43l8 17m0-17 8 17m0-17 8 17"/>',
    meter:'<rect x="27" y="12" width="49" height="76" rx="8"/><rect x="36" y="23" width="31" height="21" rx="2"/><circle cx="52" cy="61" r="9"/><path d="M35 78h11m12 0h11"/>',
    pcb:'<rect x="18" y="19" width="65" height="63" rx="5"/><path d="M29 32h20v17H29zM57 29h12v12H57zM27 63h21m0 0v9h22m-13-24v10h13M37 49v14"/><circle cx="30" cy="70" r="2"/>',
    tool:'<path d="M70 17a20 20 0 0 0-25 27L21 68a11 11 0 0 0 16 16l24-24a20 20 0 0 0 27-25L75 48 58 31z"/>',
    material:'<path d="M50 13 84 32v38L50 89 16 70V32zM16 32l34 19 34-19M50 51v38"/>'
   };
   const frame=el("span",undefined,"workshop-catalog-thumb workshop-thumb-"+kind);
   frame.setAttribute("role","img");
   frame.setAttribute("aria-label","Illustrative "+kind+" thumbnail");
   frame.innerHTML='<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">'+drawings[kind]+'</svg>';
   return frame;
  };


  // Dedicated, URL-addressable Workshop item view. Existing catalog records
  // remain the single source of truth and personal inventory stays separate.
  const itemPage=el("section",undefined,"workshop-item-page");
  itemPage.hidden=true;
  shared.after(itemPage);
  const sideHost=root.querySelector(".bs-catalog-sidebar");
  const itemSide=el("div",undefined,"workshop-item-side");
  itemSide.hidden=true;
  sideHost?.append(itemSide);
  const readSelected=()=>new URLSearchParams(location.search).get("workshop-item")||"";
  let openedItem="";
  const itemButton=(label,callback,cls="btn")=>{
   const b=el("button",label,cls);b.type="button";b.onclick=callback;return b;
  };
  const changeUrl=id=>{
   const u=new URL(location.href);
   if(id)u.searchParams.set("workshop-item",id);else u.searchParams.delete("workshop-item");
   history.pushState({workshopItem:id},"",u.pathname+u.search+u.hash);
  };
  // The main navigation must reset product detail even if the #commonparts
  // route is already active and no hashchange event will fire.
  document.querySelectorAll('[data-nav="commonparts"]').forEach(button=>{
   button.addEventListener("click",()=>{
    selectedFamily="";
    results.value="";
    nav?.select("all");
    closeItem();
    renderCatalog();
   });
  });
  function closeItem(navigate=true){
   if(navigate&&readSelected())changeUrl("");
   openedItem="";itemPage.hidden=true;itemSide.hidden=true;sidebar.hidden=false;
   applyWorkshopCategory();
  }
  const addReference=item=>{
   closeItem();
   nav?.select("mine");
   if(!$("#workshop-editor",personal)){
    setStatus("Sign in to add items to your personal Workshop.");
    return;
   }
   fill({name:item.name,catalogId:item.id,kind:item.kind==="tool"?"tool":item.kind==="component"?"component":item.kind==="equipment"?"equipment":"material",
    category:categoryLabelFor(item),specifications:item.spec?[{name:"Recommended specification",value:item.spec}]:[]});
   $("#workshop-editor",personal).scrollIntoView({block:"start"});
   $("#workshop-name",personal).focus();
  };
  function editPersonalReference(item){
   if(!accountSignedIn||!$("#workshop-editor",personal)){
    const mount=$(".workshop-item-editor-mount",itemPage)||itemPage;
    const message=el("div",undefined,"workshop-item-signin-prompt");
    message.append(el("p","Sign in to create or edit your own Workshop item. Editing the website-wide reference requires administrator access."));
    message.append(itemButton("Sign in / My account",()=>document.getElementById("accountMenuButton")?.click(),"btn primary"));
    mount.replaceChildren(message);
    return;
   }
   const copy=ownedFor(item)[0];
   closeItem();
   nav?.select("mine");
   if(copy)fill(copy);
   else fill({name:item.name,catalogId:item.id,kind:item.kind==="tool"?"tool":item.kind==="equipment"?"equipment":item.kind==="component"?"component":"material",
    category:categoryLabelFor(item),manufacturer:item.manufacturer||"",model:item.model||"",partNumber:item.partNumber||"",
    specifications:item.spec?[{name:"Specification",value:item.spec}]:[],notes:item.notes||""});
   $("#workshop-editor",personal)?.scrollIntoView({block:"start"});
   $("#workshop-name",personal)?.focus();
  }
  function showPersonalItem(id,navigate=true){
   const item=items.find(record=>record.id===id);
   if(!item){closeItem(false);return}
   const route="my:"+item.id;
   if(navigate&&readSelected()!==route)changeUrl(route);
   openedItem=route;
   shared.hidden=true;personal.hidden=true;sidebar.hidden=true;
   itemPage.hidden=false;itemSide.hidden=false;
   itemSide.replaceChildren();itemPage.replaceChildren();
   itemSide.append(itemButton("← Back to Workshop",()=>closeItem(),"workshop-item-back"));
   itemSide.append(el("h2",item.name,"workshop-item-side-title"));
   const small=(label,value)=>{if(value){
    const part=el("section",undefined,"workshop-item-side-row");
    part.append(el("h3",label),el("p",String(value)));itemSide.append(part);
   }};
   small("Category",item.category);
   small("Manufacturer",item.manufacturer);
   small("Model",item.model);
   small("Part number",item.partNumber);
   small("Stock status",stockLabels[item.stockStatus]||"In stock");
   small("Quantity",item.quantity+" "+(item.unit||"pcs"));
   small("Notes",item.notes);
   itemPage.append(el("p","My Workshop / "+item.name,"workshop-item-breadcrumb"));
   const head=el("div",undefined,"workshop-item-title-line");
   head.append(el("h2",item.name));
   head.append(itemButton("Edit item",()=>{
    closeItem();nav?.select("mine");fill(item);
    $("#workshop-editor",personal)?.scrollIntoView({block:"start"});
   },"btn primary workshop-item-edit-button"));
   itemPage.append(head);
   const hero=el("div",undefined,"workshop-item-hero");
   if(item.photoId){
    const img=el("img",undefined,"workshop-reference-hero-image");
    img.src="/api/workshop-photo?id="+encodeURIComponent(item.photoId);
    img.alt=item.name;hero.append(img);
   }else{
    const media=catalogThumb(item);media.classList.add("workshop-item-large-thumb");hero.append(media);
   }
   const detail=el("div");
   detail.append(el("h3","Your inventory"),el("p",(stockLabels[item.stockStatus]||"In stock")+" · "+item.quantity+" "+(item.unit||"pcs")));
   for(const specification of item.specifications||[]){
    const line=el("p");line.append(el("strong",specification.name+": "),document.createTextNode(specification.value));detail.append(line);
   }
   hero.append(detail);itemPage.append(hero);
   itemPage.scrollIntoView({block:"start"});
  }
  function showItem(id,navigate=true){
   if(id.startsWith("my:")){showPersonalItem(id.slice(3),navigate);return}
   const item=standards().find(x=>x.id===id);
   if(!item){closeItem(false);return}
   if(navigate&&readSelected()!==id)changeUrl(id);
   openedItem=id;
   shared.hidden=true;personal.hidden=true;sidebar.hidden=true;
   itemPage.hidden=false;itemSide.hidden=false;
   itemSide.replaceChildren();itemPage.replaceChildren();
   itemSide.append(itemButton("← Back to Workshop",()=>closeItem(),"workshop-item-back"));
   itemSide.append(el("p",categoryLabelFor(item),"workshop-item-eyebrow"));
   itemSide.append(el("h2",item.name,"workshop-item-side-title"));
   const sideRow=(title,value)=>{
    if(!value)return;
    const section=el("section",undefined,"workshop-item-side-row");
    section.append(el("h3",title),el("p",value));
    itemSide.append(section);
   };
   sideRow("Specification",item.spec);
   sideRow("Typical use",item.use);
   sideRow("Considerations",item.caution);
   sideRow("Level",friendlyTier(item));
   sideRow("Product family",familyFor(item)?.label);
   sideRow("Manufacturer",item.manufacturer);
   sideRow("Model / part number",[item.model,item.partNumber].filter(Boolean).join(" · "));
   sideRow("Supplier",item.supplier);
   sideRow("Price / package",[item.price,item.packageQuantity].filter(Boolean).join(" · "));
   sideRow("Ordering notes",item.orderNotes);
   sideRow("Notes",item.notes);

   if(item.source&&/^https:\/\//.test(item.source)){
    const link=el("a","Manufacturer reference","workshop-item-source");
    link.href=item.source;link.target="_blank";link.rel="noopener noreferrer";itemSide.append(link);
   }
   const crumb=el("nav",undefined,"workshop-item-breadcrumb");
   crumb.setAttribute("aria-label","Workshop item breadcrumb");
   crumb.append(itemButton("Workshop",()=>closeItem(),"workshop-item-crumb-link"));
   crumb.append(el("span"," / "+categoryLabelFor(item)+" / "));
   const family=familyFor(item);
   if(family)crumb.append(itemButton(family.label,()=>{closeItem();selectedFamily=family.id;renderCatalog();},"workshop-item-crumb-link"));
   crumb.append(el("span"," / "+item.name));
   itemPage.append(crumb);
   const header=el("div",undefined,"workshop-item-page-heading");
   const titleLine=el("div",undefined,"workshop-item-title-line");
   titleLine.append(el("h2",item.name));
   titleLine.append(itemButton(canEditReferences?"Edit shared catalog":"Edit My Workshop item",()=>{
    if(canEditReferences)openItemEditor(item);else editPersonalReference(item);
   },"btn primary workshop-item-edit-button"));
   header.append(titleLine);
   if(item.subtitle)header.append(el("p",item.subtitle,"muted"));
   itemPage.append(header);
   const hero=el("section",undefined,"workshop-item-hero");
   const big=el("div",undefined,"workshop-item-primary-media");
   if(item.photos?.length){
    const img=el("img",undefined,"workshop-reference-hero-image");
    img.src="/api/workshop-reference?photo="+encodeURIComponent(item.photos[0].id);
    img.alt=item.photos[0].caption||item.name;
    big.append(img);
   }else{
    const fallback=catalogThumb(item);
    fallback.classList.add("workshop-item-large-thumb");
    big.append(fallback);
   }
   const info=el("div",undefined,"workshop-item-hero-info");
   info.append(el("h3","Workshop item details"));
   const controls=el("div",undefined,"workshop-detail-edit-actions");
   if(canEditReferences){
    controls.append(itemButton("Edit shared item",()=>openItemEditor(item),"btn primary workshop-item-edit-button"));
    if(accountSignedIn)controls.append(itemButton("Edit My Workshop copy",()=>editPersonalReference(item),"btn"));
   }else{
    controls.append(itemButton(accountSignedIn?"Edit item in My Workshop":"Sign in to edit item",
     ()=>editPersonalReference(item),"btn primary workshop-item-edit-button"));
   }
   info.append(controls);
   info.append(el("p",item.spec||item.use||"Reference specifications have not been provided."));
   const owned=ownedFor(item);
   if(owned.length){
    info.append(el("p",ownershipLabel(owned),"workshop-owned-note"));
    info.append(itemButton("Edit My Workshop item",()=>editPersonalReference(item),"btn"));
   }else info.append(el("p","This reference does not imply you own the item.","muted"));
   info.append(itemButton("+ Add to My Workshop",()=>addReference(item),"btn primary"));
   if(item.supplierUrl){
    const order=el("a","Supplier / ordering page","btn workshop-reference-order-link");
    order.href=item.supplierUrl;order.target="_blank";order.rel="noopener noreferrer";info.append(order);
   }
   if(item.documentationUrl){
    const docs=el("a","Documentation","workshop-reference-doc-link");
    docs.href=item.documentationUrl;docs.target="_blank";docs.rel="noopener noreferrer";info.append(docs);
   }

   hero.append(big,info);itemPage.append(hero);
   if(item.photos?.length>1){
    const gallery=el("div",undefined,"workshop-item-photo-gallery");
    for(const photo of item.photos){
     const select=itemButton("",()=>{
      const view=big.querySelector("img");
      if(view){view.src="/api/workshop-reference?photo="+encodeURIComponent(photo.id);view.alt=photo.caption||item.name}
     },"workshop-item-photo-choice");
     const thumb=el("img");thumb.src="/api/workshop-reference?photo="+encodeURIComponent(photo.id);
     thumb.alt=photo.caption||"Select item photo";select.append(thumb);gallery.append(select);
    }
    itemPage.append(gallery);
   }
   const related=standards().filter(x=>x.id!==id&&familyFor(x)?.id===familyFor(item)?.id);
   const editorMount=el("section",undefined,"workshop-item-editor-mount");
   editorMount.setAttribute("aria-label","Workshop item editor");
   itemPage.append(editorMount);
   const relatedSection=el("section",undefined,"workshop-item-related");
   relatedSection.append(el("h3","Other selections in "+(familyFor(item)?.label||categoryLabelFor(item))));
   const grid=el("div",undefined,"workshop-item-related-grid");
   for(const other of related){
    const tile=itemButton("",()=>showItem(other.id),"workshop-item-related-choice");
    if(other.photos?.length){
     const img=el("img",undefined,"workshop-reference-related-photo");
     img.src="/api/workshop-reference?photo="+encodeURIComponent(other.photos[0].id);
     img.alt=other.name;tile.append(img);
    }else tile.append(catalogThumb(other));
    tile.append(el("strong",other.name));
    if(other.subtitle)tile.append(el("small",other.subtitle));
    grid.append(tile);
   }
   if(!related.length)grid.append(el("p","No other references in this category yet.","muted"));
   relatedSection.append(grid);itemPage.append(relatedSection);
   itemPage.scrollIntoView({block:"start"});
  }

  function openItemEditor(item){
   if(!canEditReferences)return;
   const mount=$(".workshop-item-editor-mount",itemPage);
   if(!mount)return;
   mount.replaceChildren();
   const form=el("form",undefined,"workshop-item-edit-form");
   const heading=el("div",undefined,"workshop-item-editor-heading");
   heading.append(el("h3","Edit "+item.name),el("p","Shared Workshop catalog · administrator only","muted"));
   form.append(heading);
   const grid=el("div",undefined,"workshop-item-edit-grid");
   const descriptors=[
    ["name","Item name","text"],["subtitle","Short description","text"],
    ["manufacturer","Manufacturer","text"],["model","Model","text"],
    ["partNumber","Manufacturer part number","text"],["supplier","Supplier","text"],
    ["supplierUrl","Supplier / ordering URL","url"],["asin","Amazon ASIN","text"],
    ["price","Reference price","text"],["packageQuantity","Quantity / package","text"],
    ["documentationUrl","Documentation URL","url"],
    ["spec","Specifications","textarea"],["use","Typical use","textarea"],
    ["caution","Important considerations","textarea"],["orderNotes","How to order","textarea"],
    ["notes","Additional notes","textarea"]
   ];
   const controls={};
   for(const [key,title,type] of descriptors){
    const label=el("label",undefined,type==="textarea"?"workshop-edit-wide":"");
    label.append(el("span",title));
    const control=type==="textarea"?el("textarea"):el("input");
    if(type==="textarea")control.rows=3;else control.type=type;
    control.className="field";control.value=item[key]||"";
    label.append(control);grid.append(label);controls[key]=control;
   }
   form.append(grid);
   const photoTitle=el("h4","Photos");
   form.append(photoTitle);
   const photos=(item.photos||[]).map(p=>({...p}));
   const gallery=el("div",undefined,"workshop-item-edit-photos");
   const redrawPhotos=()=>{
    gallery.replaceChildren();
    for(const photo of photos){
     const card=el("div",undefined,"workshop-item-edit-photo");
     const img=el("img");img.src="/api/workshop-reference?photo="+encodeURIComponent(photo.id);
     img.alt=photo.caption||"Workshop reference photo";card.append(img);
     const cap=el("input");cap.className="field";cap.value=photo.caption||"";
     cap.placeholder="Photo caption";cap.maxLength=180;cap.setAttribute("aria-label","Photo caption");
     cap.oninput=()=>{photo.caption=cap.value};
     card.append(cap,itemButton("Remove",()=>{photos.splice(photos.indexOf(photo),1);redrawPhotos()},"btn"));
     gallery.append(card);
    }
   };
   redrawPhotos();form.append(gallery);
   const uploadRow=el("div",undefined,"workshop-item-photo-upload");
   const picker=el("input");picker.type="file";picker.accept="image/jpeg,image/png,image/webp";
   picker.multiple=true;picker.setAttribute("aria-label","Upload item photos");
   const uploadStatus=el("p","","muted");
   const upload=itemButton("Upload photos",async()=>{
    if(!picker.files?.length)return;
    if(photos.length+picker.files.length>12){uploadStatus.textContent="Up to 12 photos per item.";return}
    upload.disabled=true;
    try{
     for(const file of picker.files){
      const body=new FormData();body.append("photo",file);
      const res=await fetch("/api/workshop-reference",{method:"POST",credentials:"same-origin",body});
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw Error(data.error||"Photo upload failed");
      photos.push(data.photo);
     }
     picker.value="";redrawPhotos();uploadStatus.textContent="Photos uploaded. Save changes to publish.";
    }catch(error){uploadStatus.textContent=error.message}
    finally{upload.disabled=false}
   });
   uploadRow.append(picker,upload);form.append(uploadRow,uploadStatus);
   const status=el("p","","workshop-item-editor-status");
   status.setAttribute("role","status");
   const actions=el("div",undefined,"workshop-item-editor-actions");
   const save=itemButton("Save changes",()=>form.requestSubmit(),"btn primary");
   const cancel=itemButton("Cancel",()=>mount.replaceChildren(),"btn");
   actions.append(save,cancel);form.append(actions,status);
   form.addEventListener("submit",async event=>{
    event.preventDefault();
    const details={photos};
    for(const field of saveableFields)details[field]=controls[field]?.value||"";
    status.textContent="Saving…";save.disabled=true;
    try{
     const response=await req("/api/workshop-reference","PUT",{id:item.id,details});
     workshopOverrides[item.id]=response.details;
     renderCatalog();
     showItem(item.id,false);
    }catch(error){status.textContent=error.message;save.disabled=false}
   });
   mount.append(form);
   form.scrollIntoView({block:"start"});
  }
  window.addEventListener("popstate",()=>{
   const id=readSelected();if(id)showItem(id,false);else closeItem(false);
  });
  window.addEventListener("hashchange",()=>{
   if(location.hash&&location.hash!=="#commonparts"&&openedItem)closeItem(false);
  });

  const renderCatalog=()=>{
   const query=results.value.trim().toLowerCase(),sort=$(".workshop-catalog-sort",catalog).value;
   const list=$(".workshop-catalog-list",catalog);
   list.replaceChildren();
   const allowed=item=>selectedWorkshopCategory==="all"||categoryFor(item)===selectedWorkshopCategory;
   const byCategory=standards().filter(allowed);
   const personalAllowed=items.filter(item=>selectedWorkshopCategory==="all"||categoryOfPersonal(item)===selectedWorkshopCategory);
   const matched=byCategory.filter(item=>(!selectedFamily||familyFor(item)?.id===selectedFamily)&&
    [item.name,item.subtitle,item.spec,item.use,item.kind,item.category,categoryLabelFor(item),familyFor(item)?.label]
     .join(" ").toLowerCase().includes(query));
   const personalMatched=personalAllowed.filter(item=>(!selectedFamily||
    (selectedFamily==="personal-other"?!familyOfPersonal(item):familyOfPersonal(item)===selectedFamily))&&
    [item.name,item.manufacturer,item.model,item.partNumber,item.category,item.kind,item.notes,
     ...(item.specifications||[]).flatMap(spec=>[spec.name,spec.value])].join(" ").toLowerCase().includes(query));
   const personalOnly=personalMatched.filter(item=>!matchingReference(item)||
    !matched.some(ref=>ref.id===matchingReference(item)?.id));
   const familyGrid=families().map(group=>({...group,
    visible:byCategory.filter(item=>group.items.includes(item.id)),
    owned:personalAllowed.filter(item=>familyOfPersonal(item)===group.id)}))
    .filter(group=>group.visible.length||group.owned.length);
   const count=$(".workshop-catalog-count",catalog);
   const title=$(".workshop-catalog-bar h3",catalog);
   if(!selectedFamily&&!query){
    title.textContent="Browse product families";
    const ungrouped=personalAllowed.filter(item=>!familyOfPersonal(item));
   count.textContent=familyGrid.length+" product families · "+byCategory.length+" shared references · "+personalAllowed.length+" personal items";
    const grid=el("div",undefined,"workshop-family-grid");
    for(const group of familyGrid){
     const tile=el("button",undefined,"workshop-family-tile");tile.type="button";
     const sample=group.visible[0]||group.owned[0];
     tile.append(group.owned[0]?.photoId&&!group.visible.length?personalThumb(group.owned[0]):catalogThumb(sample));
     const text=el("span",undefined,"workshop-family-text");
     text.append(el("strong",group.label),el("small",group.description,"muted"),
      el("span",group.visible.length+" references"+(group.owned.length?" · "+group.owned.length+" in My Workshop":""),"workshop-family-count"));
     tile.append(text);
     tile.onclick=()=>{selectedFamily=group.id;renderCatalog();catalog.scrollIntoView({block:"start"})};
     grid.append(tile);
    }
    if(ungrouped.length){
     const tile=itemButton("",()=>{selectedFamily="personal-other";renderCatalog()},"workshop-family-tile");
     const title=el("span",undefined,"workshop-family-text");
     title.append(el("strong","Other items in My Workshop"),el("small","Uncategorized personal inventory","muted"),
      el("span",ungrouped.length+" items","workshop-family-count"));
     tile.append(catalogThumb({name:"Workshop equipment",kind:"equipment"}),title);grid.append(tile);
    }
    list.append(grid);
    return;
   }
   const family=families().find(group=>group.id===selectedFamily);
   title.textContent=family?.label||(selectedFamily==="personal-other"?"Other items in My Workshop":"Search Workshop");
   if(selectedFamily){
    const back=el("button","← All product families","workshop-family-back");back.type="button";
    back.onclick=()=>{selectedFamily="";renderCatalog()};
    list.append(back);
    if(family)list.append(el("p",family.description,"workshop-family-description"));
   }else if(query){
    const clear=el("button","Show product families","workshop-family-back");clear.type="button";
    clear.onclick=()=>{results.value="";renderCatalog()};
    list.append(clear);
   }
   matched.sort((a,b)=>{
    const col=sort==="type"?String(a.kind||"").localeCompare(String(b.kind||"")):
     sort==="level"?String(a.tier||"").localeCompare(String(b.tier||"")):0;
    return col||a.name.localeCompare(b.name,undefined,{numeric:true});
   });
   count.textContent=matched.length+" shared references · "+personalOnly.length+" personal items";
   if(!matched.length&&!personalOnly.length){list.append(el("p","No matching items. Change the search or product family.","muted"));return}
   const heading=el("div",undefined,"workshop-catalog-columns");
   for(const t of ["Image","Item / description","Category","Recommended use",""])heading.append(el("span",t));
   list.append(heading);
   for(const item of matched){
    const row=el("article",undefined,"workshop-catalog-entry");
    if(ownedFor(item).length)row.classList.add("is-owned");
    const summary=el("div",undefined,"workshop-catalog-line");
    const name=el("button",undefined,"workshop-catalog-name");
    name.type="button";name.textContent=item.name;name.setAttribute("aria-expanded","false");
    const main=el("div",undefined,"workshop-catalog-main-item");
    main.append(name);
    if(item.subtitle)main.append(el("small",item.subtitle,"muted"));
    if(ownedFor(item).length)main.append(el("span",ownershipLabel(ownedFor(item)),"workshop-owned-label"));
    const thumbButton=itemButton("",()=>showItem(item.id),"workshop-catalog-thumb-action");
    thumbButton.setAttribute("aria-label","Open "+item.name);
    thumbButton.append(catalogThumb(item));
    summary.append(thumbButton,main,el("span",categoryLabelFor(item),"workshop-catalog-category"),
     el("span",item.use||friendlyTier(item),"workshop-catalog-use"));
    const add=el("button",ownedFor(item).length?"Edit My Workshop item":"+ My Workshop","btn workshop-catalog-add");
    add.type="button";add.title="Create a private inventory item based on this reference";
    add.onclick=()=>editPersonalReference(item);
    main.append(add);
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
    name.onclick=()=>showItem(item.id);
    row.append(summary,detail);list.append(row);
   }
   for(const item of personalOnly){
    const row=el("article",undefined,"workshop-catalog-entry workshop-personal-entry");
    const summary=el("div",undefined,"workshop-catalog-line");
    const main=el("div",undefined,"workshop-catalog-main-item");
    main.append(itemButton(item.name,()=>showPersonalItem(item.id),"workshop-catalog-name"));
    main.append(el("span","My Workshop · "+(stockLabels[item.stockStatus]||"In stock")+
     " · "+item.quantity+" "+(item.unit||"pcs"),"workshop-owned-label"));
    if(item.manufacturer||item.model)main.append(el("small",[item.manufacturer,item.model].filter(Boolean).join(" · "),"muted"));
    const photo=itemButton("",()=>showPersonalItem(item.id),"workshop-catalog-thumb-action");
    photo.setAttribute("aria-label","Open personal Workshop item "+item.name);
    photo.append(personalThumb(item));
    summary.append(photo,main,el("span",item.category||"My Workshop","workshop-catalog-category"),
     el("span",item.notes||"Personal inventory item","workshop-catalog-use"));
    main.append(itemButton("Edit item",()=>{
     nav?.select("mine");fill(item);
     $("#workshop-editor",personal)?.scrollIntoView({block:"start"});
    },"btn workshop-catalog-add"));
    row.append(summary);list.append(row);
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
  if(readSelected())showItem(readSelected(),false);
  (async()=>{
   try{
    const data=await req("/api/workshop-reference");
    workshopOverrides=data.items||{};
    canEditReferences=!!data.canEdit;
    renderCatalog();
    if(openedItem)showItem(openedItem,false);
   }catch(error){
    console.warn("Workshop reference edits are unavailable",error);
   }
  })();

  const privateArea=$(".workshop-private",personal),status=$(".workshop-status",personal);
  const setStatus=msg=>status.textContent=msg;
  async function auth(){
   const user=(await req("/api/accounts")).user;
   accountSignedIn=!!user;
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
   editingId=item.id||null;photoId=item.photoId||"";catalogId=item.catalogId||"";
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
    if(!item.photoId)row.append(catalogThumb(item));
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
   input.catalogId=catalogId;
   input.specifications=$("#workshop-specifications",personal).value.split(/\r?\n/).map(row=>{
    const split=row.indexOf(":");return split<1?null:{name:row.slice(0,split).trim(),value:row.slice(split+1).trim()};
   }).filter(Boolean);
   if(editingId)input.id=editingId;
   try{const data=await req("/api/personal-workshop",editingId?"PUT":"POST",input);
    items=data.items;$("#workshop-editor",personal).open=false;render();renderCatalog();if(openedItem)showItem(openedItem,false);setStatus(input.name+" saved to your private Workshop.");
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
  (async()=>{try{if(!await auth())return;buildUI();items=(await req("/api/personal-workshop")).items;render();renderCatalog();if(openedItem)showItem(openedItem,false);await loadProjects()}catch(e){setStatus(e.message)}})();
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
