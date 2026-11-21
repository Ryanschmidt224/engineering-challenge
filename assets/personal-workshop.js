// Two Workshop scopes: public recommended catalog, private account-owned inventory.
(function(){
 "use strict";
 const $=(q,root=document)=>root.querySelector(q);
 const el=(tag,text,cls)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=text;if(cls)x.className=cls;return x};
 const req=async(path,method="GET",body=null)=>{
  const opts={method,credentials:"same-origin",cache:"no-store"};
  if(body){opts.headers={"content-type":"application/json"};opts.body=JSON.stringify(body)}
  const res=await fetch(path,opts),data=await res.json().catch(()=>({}));
  if(!res.ok)throw Object.assign(Error(data.error||"Request failed"),{lookupUsage:data.lookupUsage});return data;
 };

 const lookupCostMessage=window.BSProductLookup.costMessage;
 const missingSpecsMessage=specs=>specs?.length?"Could not verify: "+specs.join(", ")+".":"";

 // All Workshop confirmations now use the site's shared white dialog.
 const confirmDelete=(title,message)=>window.BSDialogs.danger(message,{title,confirmLabel:"Delete"});
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
   if(root.querySelector(".workshop-item-page:not([hidden])"))return;
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
   onChange:key=>{selectedWorkshopCategory=key;selectedFamily="";selectedType="";applyWorkshopCategory();queueMicrotask(()=>root.querySelector(".workshop-catalog-sort")?.dispatchEvent(new Event("change")))}
  });
  nav?.setItems([{value:"all",label:"All workshop items"},
   ...workshopCategories.map(([id,name])=>({
    value:id,label:name,
    ...(id.startsWith("electrical-")?{parent:"electronics"}:
      window.BSResources.otherWorkshopGroups.find(([key])=>key===id)?
       {parent:window.BSResources.otherWorkshopGroups.find(([key])=>key===id)[2]}:{})
   })),
   {value:"mine",label:"My Workshop"}]);
  root.addEventListener("bsworkshopupdated",applyWorkshopCategory);
  window.addEventListener("bsworkshopfocus",event=>{
   const id=event.detail?.id;
   const category=workshopCategories.find(([, ,ids])=>ids.includes(id))?.[0];
   if(category)nav?.select(category);
  });
  applyWorkshopCategory();
  let workshopOverrides={},canEditReferences=false,canCreateReferences=false,canDeleteReferences=false,canDeletePersonal=false,editableReferenceIds=new Set(),accountSignedIn=false;
  const canEditCatalog=item=>canEditReferences||editableReferenceIds.has(item?.id);
  let items=[],editingId=null,photoId="",catalogId="";
  // Seeded references keep stable IDs; administrator-created parts are loaded
  // from R2 and appear in exactly the same browsing and editing workflows.
  const standards=()=>{
   const seeded=window.BSResources?.workshopReferences||[];
   const generated=Object.entries(workshopOverrides)
    .filter(([id,details])=>details?.created&&!seeded.some(item=>item.id===id))
    .map(([id,details])=>({id,...details}));
   return [...seeded.map(item=>({...item,...(workshopOverrides[item.id]||{})})),...generated];
  };
  const saveableFields=["name","subtitle","featureTreeDescription","spec","use","caution","manufacturer","model","partNumber","supplier","supplierPartNumber","supplierUrl","asin","price","packageQuantity","orderNotes","documentationUrl","notes","category","kind","familyId","familyName","typeName"];
  const families=()=>{
   const groups=(window.BSResources?.workshopGroups||[]).map(group=>({...group,items:[...group.items]}));
   for(const item of standards()){
    if(!item.familyId)continue;
    let group=groups.find(entry=>entry.id===item.familyId);
    if(!group){
     group={id:item.familyId,label:item.familyName||"Other Workshop items",
      description:"Workshop catalog products",items:[]};
     groups.push(group);
    }
    if(!group.items.includes(item.id))group.items.push(item.id);
   }
   return groups;
  };

  const model=window.BSWorkshopModel.create({standards,families,categoryFor,getItems:()=>items});
  const {stockLabels,matchingReference,familyOfPersonal,categoryOfPersonal,ownedFor,ownershipLabel,familyFor,typeRules,typeFor}=model;
  let selectedFamily="";
  let selectedType="";
  // McMaster-style catalog: category on the left, quick-filtered item table on
  // the right, and specifications expanded in context. All records are the
  // existing curated Workshop references; this does not scrape third parties.
  const catalog=el("section",undefined,"workshop-catalog");
  catalog.innerHTML='<div class="workshop-catalog-bar"><div><h3>Workshop catalog</h3><p class="muted workshop-catalog-subtitle">Browse reference equipment, components, and materials. These are not automatically in your inventory.</p></div><div class="workshop-catalog-controls"><button type="button" class="btn workshop-personal-create">+ Add to My Workshop</button><button type="button" class="btn primary workshop-catalog-create" hidden>+ Add catalog item</button><label class="workshop-sort-label">Sort <select class="field workshop-catalog-sort"><option value="name">Name A–Z</option><option value="type">Type</option><option value="level">Skill level</option></select></label></div></div><p class="workshop-catalog-count" role="status"></p><div class="workshop-catalog-list"></div>';
  const searchLabel=$("#workshop-recommend-search",shared).parentElement.querySelector(".workshop-recommend-search-label");
  if(searchLabel)searchLabel.textContent="Search catalog by name, size, type, or specification";
  const results=$("#workshop-recommend-search",shared);
  results.placeholder="Search wire, ferrules, oscilloscope, MOSFET…";
  results.after(catalog);
  function categoryFor(item){
   return window.BSResources.electricalCategoryFor(item);
  }
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
   // Seeded essentials have local illustrative images. An administrator's
   // uploaded product photo, if present, always takes priority.
   if(item.illustration&&/^[a-z0-9-]+$/.test(item.illustration)){
    const frame=el("span",undefined,"workshop-catalog-thumb workshop-catalog-photo-thumb workshop-reference-illustration");
    const img=el("img");
    img.src="/assets/workshop-illustrations/"+item.illustration+".svg";
    img.alt="Illustration of "+item.name;
    frame.append(img);return frame;
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
  // A project part opening a Workshop reference carries a return route.
  // Validate it before navigating; never accept arbitrary external destinations.
  const projectReturnRoute=()=>{
   const route=new URLSearchParams(location.search).get("workshop-return")||"";
   return /^#[a-z0-9-]+\/part\/[0-9a-f-]{36}$/i.test(route)?route:"";
  };
  const goBackToProject=()=>{
   const route=projectReturnRoute();
   if(!route)return;
   const url=new URL(location.href);
   const savedPosition=url.searchParams.get("workshop-return-y");
   url.searchParams.delete("workshop-return");
   url.searchParams.delete("workshop-return-y");
   url.searchParams.delete("workshop-item");
   url.hash=route.slice(1);
   const y=Number(savedPosition);
   history.pushState({projectPartScrollY:Number.isFinite(y)&&y>=0?y:0},"",url.pathname+url.search+url.hash);
   window.dispatchEvent(new Event("hashchange"));
  };
  const browseProjectBack=itemButton("← Back to project part",goBackToProject,"btn workshop-return-to-project");
  browseProjectBack.hidden=true;
  header.append(browseProjectBack);
  const addProjectBackButton=()=>{
   browseProjectBack.hidden=true;
   if(!projectReturnRoute())return;
   // Make the return control obvious in the main content area.
   itemPage.append(itemButton("← Back to project part",goBackToProject,"btn workshop-return-to-project"));
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
    selectedFamily="";selectedType="";
    results.value="";
    nav?.select("all");
    closeItem();
    renderCatalog();
   });
  });
  function closeItem(navigate=true){
   if(navigate&&readSelected())changeUrl("");
   openedItem="";itemPage.hidden=true;itemSide.hidden=true;sidebar.hidden=false;
   browseProjectBack.hidden=location.hash!=="#commonparts"||!projectReturnRoute();
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
   addProjectBackButton();
   itemSide.append(itemButton("← Back to Workshop",()=>closeItem(),"workshop-item-back"));
   itemSide.append(el("h2",item.name,"workshop-item-side-title"));
   const small=(label,value)=>{if(value){
    const part=el("section",undefined,"workshop-item-side-row");
    part.append(el("h3",label),el("p",String(value)));itemSide.append(part);
   }};
   small("Category",item.category);
   small("Manufacturer",item.manufacturer);
   small("Mfg part number",item.model);
   small("Part number",item.partNumber);
   small("Stock status",stockLabels[item.stockStatus]||"In stock");
   small("Quantity",item.quantity+" "+(item.unit||"pcs"));
   small("Notes",item.notes);
   itemPage.append(el("p","My Workshop / "+item.name,"workshop-item-breadcrumb"));
   const head=el("div",undefined,"workshop-item-title-line");
   head.append(el("h2",item.name));

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
   const edit=itemButton("Edit",()=>{
    closeItem();nav?.select("mine");fill(item);
    $("#workshop-editor",personal)?.scrollIntoView({block:"start"});
   },"btn primary workshop-under-image-edit");
   const media=el("div",undefined,"workshop-item-media-actions");
   media.append(hero.firstElementChild,edit);
   hero.prepend(media);
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
   addProjectBackButton();
   itemSide.append(itemButton("← Back to Workshop",()=>closeItem(),"workshop-item-back"));
   itemSide.append(el("p",categoryLabelFor(item),"workshop-item-eyebrow"));
   itemSide.append(el("h2",item.name,"workshop-item-side-title"));
   const sideRow=(title,value)=>{
    if(!value)return;
    const section=el("section",undefined,"workshop-item-side-row");
    section.append(el("h3",title),el("p",value));
    itemSide.append(section);
   };
   sideRow("Manufacturer part number",item.partNumber||item.model);
   sideRow("Supplier part number",item.supplierPartNumber);
   sideRow("Manufacturer",item.manufacturer);
   sideRow("Description",item.subtitle||item.name);
   sideRow("Feature tree description",item.featureTreeDescription);
   sideRow("Vendor",item.supplier);
   sideRow("Specification",item.spec);
   sideRow("Typical use",item.use);
   sideRow("Considerations",item.caution);
   sideRow("Level",friendlyTier(item));
   sideRow("Product family",familyFor(item)?.label);
   sideRow("Buying suggestion",item.orderNotes);
   sideRow("Picture",item.illustration?"Illustrative reference; not an exact manufacturer photograph":"");
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
   if(family){
    crumb.append(itemButton(family.label,()=>{closeItem();selectedFamily=family.id;selectedType="";renderCatalog();},"workshop-item-crumb-link"));
    const type=typeFor(item);
    crumb.append(el("span"," / "));
    crumb.append(itemButton(type.label,()=>{closeItem();selectedFamily=family.id;selectedType=type.id;renderCatalog();},"workshop-item-crumb-link"));
   }
   crumb.append(el("span"," / "+item.name));
   itemPage.append(crumb);
   const header=el("div",undefined,"workshop-item-page-heading");
   const titleLine=el("div",undefined,"workshop-item-title-line");
   titleLine.append(el("h2",item.name));

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
   const owned=ownedFor(item);
   if(owned.length){
    info.append(el("p",ownershipLabel(owned),"workshop-owned-note"));
    info.append(itemButton("View in My Workshop",()=>showPersonalItem(owned[0].id),"btn workshop-personal-record-link"));
   }else info.append(el("p","This reference does not imply you own the item.","muted"));
   info.append(itemButton("+ Add to My Workshop",()=>addReference(item),"btn primary"));
   const mediaWithEdit=el("div",undefined,"workshop-item-media-actions");
   mediaWithEdit.append(big);
   const mediaButtons=el("div",undefined,"workshop-item-media-buttons");
   let detailUI=null;
   if(canEditCatalog(item))
    mediaButtons.append(itemButton("Edit",()=>detailUI?.setEditing(true),"btn workshop-under-image-edit"));
   if(canDeleteReferences&&item.created)
    mediaButtons.append(itemButton("Delete",async()=>{
     if(!await confirmDelete("Delete Workshop item?","Permanently delete \""+item.name+"\" from the public Workshop? This cannot be undone."))return;
     try{
      await req("/api/workshop-reference","DELETE",{id:item.id,expectedRevision:item.revision||null});
      delete workshopOverrides[item.id];
      closeItem();renderCatalog();window.dispatchEvent(new Event("bsworkshopupdated"));
     }catch(error){alert(error.message||"Unable to delete Workshop item.")}
    },"btn workshop-under-image-delete"));
   if(mediaButtons.childElementCount)mediaWithEdit.append(mediaButtons);
   if(item.documentationUrl){
    const docs=el("a","Documentation","btn workshop-reference-doc-link workshop-under-image-documentation");
    docs.href=item.documentationUrl;docs.target="_blank";docs.rel="noopener noreferrer";
    mediaWithEdit.append(docs);
   }
   const pricing=el("dl",undefined,"workshop-item-pricing");
   for(const [label,value] of [["Reference price",item.price],["Quantity / package",item.packageQuantity]]){
    if(value)pricing.append(el("dt",label),el("dd",value));
   }
   if(pricing.childElementCount)mediaWithEdit.append(pricing);
   if(item.supplierUrl&&/^https:\/\//i.test(item.supplierUrl)){
    const order=el("a","Supplier / ordering page","btn workshop-reference-order-link");
    order.href=item.supplierUrl;order.target="_blank";order.rel="noopener noreferrer";
    mediaWithEdit.append(order);
   }
   hero.append(mediaWithEdit,info);itemPage.append(hero);
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
   const related=standards().filter(x=>x.id!==id&&familyFor(x)?.id===familyFor(item)?.id&&typeFor(x).id===typeFor(item).id);
   const editorMount=el("section",undefined,"workshop-item-editor-mount");
   editorMount.setAttribute("aria-label","Workshop item editor");
   itemPage.append(editorMount);
   detailUI=openItemEditor(item,{viewOnly:true});
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

  function createCatalogItem(){
   if(!canCreateReferences)return;
   selectedType="";openedItem="";
   shared.hidden=true;personal.hidden=true;sidebar.hidden=true;
   itemPage.hidden=false;itemSide.hidden=false;
   itemSide.replaceChildren();itemPage.replaceChildren();
   addProjectBackButton();
   itemSide.append(itemButton("← Back to catalog",()=>closeItem(),"workshop-item-back"));
   itemSide.append(el("h2","Create catalog item","workshop-item-side-title"));
   const heading=el("div",undefined,"workshop-item-page-heading");
   heading.append(el("h2","New Workshop item"),
    el("p","Add a product to the shared website catalog.","muted"));
   itemPage.append(heading);
   const mount=el("section",undefined,"workshop-item-editor-mount");
   itemPage.append(mount);
   openItemEditor({category:["all","mine"].includes(selectedWorkshopCategory)?"tools":selectedWorkshopCategory,
    kind:"equipment",photos:[]});
  }
  $(".workshop-catalog-create",catalog).onclick=createCatalogItem;
  $(".workshop-personal-create",catalog).onclick=()=>{
   nav?.select("mine");
   if($("#workshop-editor",personal)){
    fill({});
    $("#workshop-editor",personal)?.scrollIntoView({block:"start"});
    $("#workshop-name",personal)?.focus();
   }else{
    setStatus("Sign in to add items to your personal Workshop.");
    document.getElementById("accountMenuButton")?.click();
   }
  };
  function openItemEditor(item,{viewOnly=false}={}){
   const isNew=!item.id;
   if(!viewOnly&&(isNew?!canCreateReferences:!canEditCatalog(item)))return;
   const mount=$(".workshop-item-editor-mount",itemPage);
   if(!mount)return;
   mount.replaceChildren();
   const form=el("form",undefined,"workshop-item-edit-form");
   const heading=el("div",undefined,"workshop-item-editor-heading");
   heading.append(el("h3",isNew?"Create new catalog item":"Component details"),
    el("p","Public Workshop catalog · any signed-in member may edit shared items","muted"));
   form.append(heading);
   // AI lookup fills a draft; only the existing Save action publishes an item.
   const aiLookup=window.BSProductLookup.create({
    getQuery:()=>({
     partNumber:controls.partNumber.value.trim(),featureTreeDescription:controls.featureTreeDescription.value.trim(),
     supplierPartNumber:controls.supplierPartNumber.value.trim(),supplier:controls.supplier.value.trim()
    }),
    onStart:()=>{pendingSuggestion=null;viewSuggested.hidden=true;closeReview()},
    onResult:response=>{pendingSuggestion=response;showReview()}
   });
   const lookupActions=aiLookup.element;
   lookupActions.classList.add("workshop-identity-priority-field");
   const lookupResults=aiLookup.results,lookupMessage=aiLookup.message;
   const lookupHint=aiLookup.hint;
   const grid=el("div",undefined,"workshop-item-edit-grid");
   // Reuse the New Part editor's canonical identity/additional/specification
   // sections and fields order, keeping Workshop-specific ordering fields.
   const fieldDescriptors={
    name:["Item name","text"],subtitle:["Short description","text"],featureTreeDescription:["Feature tree description (20 characters max)","text"],
    manufacturer:["Manufacturer","text"],model:["Mfg part number","text"],
    partNumber:["Manufacturer part number","text"],supplier:["Supplier","text"],
    supplierPartNumber:["Supplier part number","text"],supplierUrl:["Supplier / ordering URL","url"],asin:["Amazon ASIN","text"],
    price:["Reference price","text"],packageQuantity:["Quantity / package","text"],
    documentationUrl:["Documentation URL","url"],typeName:["Product type (e.g. Multimeters)","text"],
    spec:["Specifications","textarea"],use:["Typical use","textarea"],
    caution:["Important considerations","textarea"],orderNotes:["How to order","textarea"],
    notes:["Additional notes","textarea"]
   };
   const sectionFields=window.BSPartFields?.sectionFields;
   const sections=[
    ["identity","Product identity",[
     "partNumber","featureTreeDescription","manufacturer","name","subtitle","model"
    ]],
    ["ordering","Ordering",[
     "supplier","supplierPartNumber","supplierUrl","asin","price","packageQuantity"
    ]],
    ["characteristics","Part characteristics",[
     "typeName","spec"
    ]],
    ["notes","Extra notes",[
     "use","caution","orderNotes","documentationUrl","notes"
    ]]
   ];
   const controls={};
   for(const [key,title,fields] of sections){
    const section=el("section",undefined,"workshop-part-editor-section");
    section.dataset.partEditorSection=key;
    section.append(el("h3",title,"part-editor-section-heading"));
    const fieldsGrid=el("div",undefined,"workshop-item-edit-grid");
    for(const name of [...new Set(fields)]){
     const [labelText,type]=fieldDescriptors[name];
     const label=el("label",undefined,type==="textarea"?"workshop-edit-wide":"");
     if(key==="identity"&&(name==="partNumber"||name==="featureTreeDescription"))label.classList.add("workshop-identity-priority-field");
     label.append(el("span",labelText));
     const control=type==="textarea"?el("textarea"):el("input");
     if(type==="textarea")control.rows=3;else control.type=type;
     control.className="field";control.value=item[name]||"";
     if(name==="partNumber")control.placeholder="Optional for generic items";
      if(name==="featureTreeDescription"){control.maxLength=20;control.placeholder="e.g. Motor switch";}
     label.append(control);fieldsGrid.append(label);controls[name]=control;
     if(name==="featureTreeDescription")fieldsGrid.append(lookupActions);
    }
    section.append(fieldsGrid);grid.append(section);
   }
   const classification=el("div",undefined,"workshop-item-classification");
   const addSelect=(labelText,values,value)=>{
    const label=el("label");
    label.append(el("span",labelText));
    const field=el("select",undefined,"field");
    for(const [id,title] of values){const option=el("option",title);option.value=id;field.append(option)}
    field.value=value;label.append(field);classification.append(label);return field;
   };
   const kind=addSelect("Item type",[
    ["tool","Tool"],["equipment","Equipment"],["component","Component"],
    ["material","Material"],["other","Other"]],item.kind||"equipment");
   const category=addSelect("Website category",workshopCategories.map(([id,label])=>[id,label]),
    categoryFor(item)==="other"?"tools":categoryFor(item));
   // Generic parts describe a configurable type; specific parts identify a
   // manufacturer's purchasable product. Existing MPN records infer specific.
   const identityKind=el("fieldset",undefined,"workshop-product-identity-kind");
   identityKind.append(el("legend","", "Product identity"));
   const identityRadios={};
   for(const [value,title] of [["generic","Generic component"],["specific","Specific product"]]){
    const label=el("label");
    const radio=el("input");radio.type="radio";radio.name="workshop-product-identity";radio.value=value;
    radio.checked=window.BSResources.workshopIdentityKind(item)===value;
    identityRadios[value]=radio;
    label.append(radio,document.createTextNode(title));identityKind.append(label);
   }
   const identityHelp=el("p","Generic components are configured for each project; specific products may have a manufacturer part number.","muted");
   identityKind.append(identityHelp);
   grid.querySelector('[data-part-editor-section="identity"]')
    .querySelector(".part-editor-section-heading").after(identityKind);
   // The left Workshop category tree is the only classification hierarchy.
   // Preserve historical family metadata silently for existing records.
   const family={value:item.familyId||""};
   const familyName={value:item.familyName||""};
   const updateFamily=()=>{};

   form.append(grid);
   // Workshop specifications: family templates are optional suggestions, never
   // a fixed schema or a required checklist.
   const specTemplates={
    mosfet:[
     ["drain_source_voltage","Drain-source voltage","V"],
     ["continuous_drain_current","Continuous drain current","A"],
     ["pulsed_drain_current","Pulsed drain current","A"],
     ["gate_source_voltage","Gate-source voltage","V"],
     ["gate_threshold_voltage","Gate threshold voltage","V"],
     ["on_resistance","On-state resistance","Ω"],
     ["power_dissipation","Power dissipation","W"],
     ["operating_temperature","Operating temperature","°C"],
     ["package","Package",""]
    ],
    endMill:[
     ["cutting_diameter","Cutting diameter",""],["shank_diameter","Shank diameter",""],
     ["length_of_cut","Length of cut",""],["overall_length","Overall length",""],
     ["flute_count","Flute count",""],["tool_material","Tool material",""],
     ["coating","Coating",""],["end_geometry","End geometry",""]
    ],
    resistor:[["resistance","Resistance","Ω"],["tolerance","Tolerance","%"],["rated_power","Power rating","W"],["temperature_coefficient","Temperature coefficient","ppm/°C"]],
    capacitor:[["capacitance","Capacitance","F"],["rated_voltage","Rated voltage","V"],["tolerance","Tolerance","%"],["dielectric","Dielectric",""],["esr","ESR","Ω"]],
    motor:[["rated_voltage","Rated voltage","V"],["rated_current","Rated current","A"],["torque","Torque","N·cm"],["rated_speed","Speed","rpm"],["step_angle","Step angle","°"]],
    power:[["input_voltage","Input voltage","V"],["output_voltage","Output voltage","V"],["output_current","Output current","A"],["efficiency","Efficiency","%"]],
    fastener:[["thread","Thread",""],["length","Length","mm"],["material","Material",""],["strength_grade","Strength grade",""],["finish","Finish",""]],
    bearing:[["bore_diameter","Bore diameter","mm"],["outside_diameter","Outside diameter","mm"],["dynamic_load","Dynamic load rating","N"],["material","Material",""]],
    electrical:[["rated_voltage","Voltage rating","V"],["rated_current","Current rating","A"],["rated_power","Power rating","W"],["operating_temperature","Operating temperature","°C"]],
    general:[["material","Material",""],["dimensions","Dimensions",""],["weight","Weight","g"]]
   };
   const suggestedTemplate=()=>{
    if(identityRadios.generic.checked){
     const named=window.BSResources.genericSpecificationTemplate({
      name:controls.name.value||item.name,
      featureTreeDescription:controls.featureTreeDescription.value,
      typeName:controls.typeName.value
     });
     if(named.length)return named.map(([label,unit])=>
      [label.toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,""),label,unit]);
    }
    const description=[family.value,families().find(f=>f.id===family.value)?.label,
     familyName.value,controls.typeName?.value,controls.name?.value,controls.subtitle?.value,controls.featureTreeDescription?.value].filter(Boolean).join(" ").toLowerCase();
    if(/\bend[\s-]*mills?\b/.test(description))return specTemplates.endMill;
    if(/mosfet|field.effect.transistor/.test(description))return specTemplates.mosfet;
    if(/resistor/.test(description))return specTemplates.resistor;
    if(/capacitor/.test(description))return specTemplates.capacitor;
    if(/stepper|\bmotor\b|servo/.test(description))return specTemplates.motor;
    if(/regulator|converter|power supply|buck/.test(description))return specTemplates.power;
    if(/screw|bolt|fastener|nut\b/.test(description))return specTemplates.fastener;
    if(/bearing|bushing/.test(description))return specTemplates.bearing;
    return (category.value==="electronics"||category.value.startsWith("electrical-"))?specTemplates.electrical:specTemplates.general;
   };
   const structuredSection=el("section",undefined,"workshop-structured-specs");
   structuredSection.append(el("h3","Specifications for this product"));
   structuredSection.append(el("p","Common specifications appear automatically based on product type. Enter the values you know; empty fields are not saved.","muted"));
   const specRows=el("div",undefined,"workshop-structured-spec-rows");
   const storedSpecs=()=>[...specRows.children].map(row=>({
    propertyId:row.dataset.propertyId||"",
    label:row.querySelector('[data-spec="label"]')?.value.trim()||"",
    value:row.querySelector('[data-spec="value"]')?.value.trim()||"",
    unit:row.querySelector('[data-spec="unit"]')?.value.trim()||"",
    conditions:row.querySelector('[data-spec="conditions"]')?.value.trim()||""
   })).filter(row=>row.label&&row.value);
   const addSpec=(spec={})=>{
    if(specRows.children.length>=60)return;
    const row=el("div",undefined,"workshop-structured-spec-row");
    row.dataset.propertyId=spec.propertyId||"";
    for(const [key,placeholder,max] of [
     ["label","Property (e.g. Drain voltage)",100],
     ["value","Value",220],["unit","Unit",32],["conditions","Conditions (optional)",300]
    ]){
     const field=el("input");field.type="text";field.className="field";field.placeholder=placeholder;
     field.maxLength=max;field.value=spec[key]||"";field.dataset.spec=key;
     if(key==="label")field.addEventListener("input",()=>{if(field.value!==(spec.label||""))row.dataset.propertyId=""});
     row.append(field);
    }
    row.append(itemButton("Remove",()=>row.remove(),"btn"));
    specRows.append(row);
    return row;
   };
   const addSuggestedSpecs=()=>{
    const current=new Map([...specRows.children].flatMap(row=>[
     row.dataset.propertyId,row.querySelector('[data-spec="label"]').value.trim().toLowerCase()
    ].filter(Boolean).map(key=>[key,row])));
    const suggestedRows=[];
    let added=0,atLimit=false;
    for(const [propertyId,label,unit] of suggestedTemplate()){
     const existing=current.get(propertyId)||current.get(label.toLowerCase());
     const row=existing||addSpec({propertyId,label,unit});
     if(!row){atLimit=true;continue}
     if(!existing)added++;
     suggestedRows.push(row);
    }
    return {suggestedRows,added,atLimit};
   };
   const specStatus=el("p","","muted");
   specStatus.setAttribute("role","status");
   specStatus.hidden=true;
   const reportSpecStatus=message=>{specStatus.hidden=false;specStatus.textContent=message};
   const specActions=el("div",undefined,"workshop-structured-spec-actions");
   specActions.append(itemButton("Suggest fields for this category",()=>{
    const {suggestedRows,added,atLimit}=addSuggestedSpecs();
    const next=suggestedRows.map(row=>row.querySelector('[data-spec="value"]')).find(field=>!field.value.trim());
    const message=added?"Added "+added+" suggested "+(added===1?"field.":"fields."):
     next?"Suggested fields are ready for values.":"All suggested fields are already filled.";
    reportSpecStatus(atLimit?"Limit reached. Remove a specification to add more suggested fields.":message);
    next?.focus();
   },"btn"),
    itemButton("+ Add specification",()=>{
     const row=addSpec();
     if(!row){reportSpecStatus("Limit reached. Remove a specification to add another.");return}
     reportSpecStatus("Added a blank specification.");
     row.querySelector('[data-spec="label"]').focus();
    },"btn"));
   structuredSection.append(specActions,specStatus,specRows);
   for(const spec of item.specifications||[])addSpec(spec);
   // Existing saved specifications take precedence over suggested empty fields.
   // When reclassifying, only discard unsaved blank template rows.
   const refreshSuggestions=()=>{
    for(const row of [...specRows.children]){
     if(row.dataset.propertyId&&row.querySelector('[data-spec="value"]')?.value.trim()==="")row.remove();
    }
    addSuggestedSpecs();
   };
   identityRadios.generic.addEventListener("change",refreshSuggestions);
   identityRadios.specific.addEventListener("change",refreshSuggestions);
   controls.name.addEventListener("change",refreshSuggestions);
   category.addEventListener("change",refreshSuggestions);
   controls.typeName.addEventListener("change",refreshSuggestions);
   controls.featureTreeDescription.addEventListener("change",refreshSuggestions);
   if(!viewOnly)refreshSuggestions();
   // Classification and specification values are part characteristics—not
   // separate browsing levels or independent editor categories.
   const characteristics=grid.querySelector('[data-part-editor-section="characteristics"]');
   characteristics.append(classification,structuredSection);
   const photoTitle=el("h4","Photos");
   const notesSection=grid.querySelector('[data-part-editor-section="notes"]');
   notesSection.append(photoTitle);
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
   redrawPhotos();notesSection.append(gallery);
   // Lookup populates the existing editable fields, not an alternate AI record.
   const identitySection=grid.querySelector('[data-part-editor-section="identity"]');
   const identityHeading=identitySection.querySelector(".part-editor-section-heading");
   const viewSuggested=itemButton("View suggested changes",()=>{},"btn workshop-ai-review-trigger");
   viewSuggested.type="button";viewSuggested.hidden=true;identityHeading.append(viewSuggested);
   const reviewPanel=el("section",undefined,"workshop-ai-changes-panel");
   reviewPanel.hidden=true;identityHeading.after(reviewPanel);
   let pendingSuggestion=null;
   const closeReview=()=>{reviewPanel.hidden=true;reviewPanel.replaceChildren()};
   const applySuggestion=response=>{
    const draft=response.draft||{};
     if(response.moveSupplierNumber)controls.partNumber.value="";
     for(const key of saveableFields){
      if(controls[key]&&typeof draft[key]==="string"&&draft[key].trim())controls[key].value=draft[key];
     }
     if(draft.kind)kind.value=draft.kind;
     if(draft.category)category.value=draft.category;
     refreshSuggestions();
     const categoryTitle=workshopCategories.find(([id])=>id===category.value)?.[1]||category.value;
     lookupResults.append(el("p","Suggested Workshop category: "+categoryTitle+". Review it before saving.","muted"));
     lookupResults.append(el("p",response.note||"Review these AI-generated details carefully.","muted"));
     const research=response.research||{};
     if(research.specs?.length){
      // Retain existing user-entered specifications instead of wiping them.
      const template=suggestedTemplate();
      for(const spec of research.specs){
       const key=String(spec.name||"").trim().toLowerCase();
       const match=template.find(([,label])=>label.toLowerCase()===key)||
        template.find(([,label])=>label.toLowerCase().includes(key)||key.includes(label.toLowerCase()));
       const id=match?.[0]||key.replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"").slice(0,80);
       const existing=[...specRows.children].find(row=>row.dataset.propertyId===id||
        row.querySelector('[data-spec="label"]')?.value.trim().toLowerCase()===key);
       if(existing){
        existing.querySelector('[data-spec="value"]').value=spec.value||"";
        existing.querySelector('[data-spec="unit"]').value=spec.unit||"";
        existing.querySelector('[data-spec="conditions"]').value=spec.conditions||"";
       }else addSpec({propertyId:/^[a-z][a-z0-9_]*$/.test(id)?id:"",label:spec.name,value:spec.value,unit:spec.unit||"",conditions:spec.conditions||""});
      }
     }
     if(research.specs?.length||research.pins?.length||research.applications?.length){
      const review=el("section",undefined,"workshop-ai-engineering-review");
      review.append(el("h4","Engineering details — verify against datasheet"));
      if(research.specs?.length){
       review.append(el("h5","Key specifications"));
       const list=el("ul");
       for(const spec of research.specs){
        const li=el("li");
        li.append(el("strong",(spec.name||"Specification")+": "),
         document.createTextNode((spec.value||"")+(spec.conditions?" — "+spec.conditions:"")));
        if(spec.sourceUrl&&/^https:\/\//i.test(spec.sourceUrl)){
         const source=el("a"," Datasheet");source.href=spec.sourceUrl;
         source.target="_blank";source.rel="noopener noreferrer";li.append(source);
        }
        list.append(li);
       }
       review.append(list);
      }
      if(research.pins?.length){
       review.append(el("h5","Pinout"+(research.package?" — "+research.package:"")));
       if(research.pinoutOrientation)review.append(el("p",research.pinoutOrientation,"muted"));
       const list=el("ol");
       for(const pin of research.pins){
        const li=el("li","Pin "+pin.number+": "+pin.name+(pin.function?" — "+pin.function:""));
        list.append(li);
       }
       review.append(list);
      }
      if(research.applications?.length){
       review.append(el("h5","Common applications"));
       const list=el("ul");
       for(const entry of research.applications)list.append(el("li",entry));
       review.append(list);
      }
      lookupResults.append(review);
     }
     const sources=(response.sources||[]).filter(url=>/^https:\/\//i.test(url));
     if(sources.length){
      const sourcesBox=el("div",undefined,"workshop-ai-source-list");
      sourcesBox.append(el("strong","Sources to check"));
      for(const [index,url] of sources.entries()){
       const link=el("a","Source "+(index+1));link.href=url;link.target="_blank";link.rel="noopener noreferrer";
       sourcesBox.append(link);
      }
      lookupResults.append(sourcesBox);
     }else lookupResults.append(el("p","No sources returned. Confirm the exact part against its manufacturer datasheet.","muted"));
     lookupMessage.textContent="Suggested changes applied. Saving the Workshop item…";
    
   };
   const showReview=()=>{
    if(!pendingSuggestion)return;
    const draft=pendingSuggestion.draft||{};
    reviewPanel.replaceChildren(el("h4","Suggested changes"),
     el("p","Review the proposed values. Applying saves the Workshop item and closes this editor after a successful save.","muted"));
    const changes=[];
    for(const [key,control] of Object.entries(controls)){
     if(typeof draft[key]!=="string"||!draft[key].trim()||draft[key].trim()===control.value.trim())continue;
     changes.push([fieldDescriptors[key]?.[0]||key,control.value.trim(),draft[key].trim()]);
    }
    if(pendingSuggestion.moveSupplierNumber&&!draft.partNumber)changes.push(["Manufacturer part number",controls.partNumber.value.trim(),"—"]);
    if(draft.kind&&draft.kind!==kind.value)changes.push(["Item type",kind.value,draft.kind]);
    if(draft.category&&draft.category!==category.value)changes.push(["Website category",category.value,draft.category]);
    if(changes.length){
     const table=el("table",undefined,"workshop-ai-diff-table");
     const head=el("tr");for(const name of ["Field","Current","Suggested"])head.append(el("th",name));
     const thead=el("thead");thead.append(head);table.append(thead);
     const tbody=el("tbody");
     for(const [label,oldValue,newValue] of changes){
      const tr=el("tr");tr.append(el("th",label),el("td",oldValue||"—"),el("td",newValue));tbody.append(tr);
     }
     table.append(tbody);reviewPanel.append(table);
    }else reviewPanel.append(el("p","No new identity field values were suggested.","muted"));
    const specs=pendingSuggestion.research?.specs||[];
    if(specs.length){
     reviewPanel.append(el("h5","Suggested specifications ("+specs.length+")"));
     const list=el("ul");
     for(const spec of specs)list.append(el("li",spec.name+": "+spec.value+(spec.unit?" "+spec.unit:"")+(spec.conditions?" ("+spec.conditions+")":"")));
     reviewPanel.append(list);
    }
    const missing=missingSpecsMessage(pendingSuggestion.missingSpecs);
    if(missing)reviewPanel.append(el("p",missing,"muted"));
    const actions=el("div",undefined,"workshop-ai-changes-actions");
    actions.append(
     itemButton("Apply suggested changes and save",()=>{
      if(!pendingSuggestion)return;
      const result=pendingSuggestion;
      pendingSuggestion=null;viewSuggested.hidden=true;closeReview();
      applySuggestion(result);
      // Reuse the ordinary validated Workshop save, which closes only on success.
      lookupMessage.textContent="Applying suggestions and saving Workshop item…";
      form.requestSubmit();
     },"btn primary"),
     itemButton("Cancel",()=>{closeReview();viewSuggested.hidden=false;viewSuggested.focus()},"btn"));
    viewSuggested.hidden=true;
    reviewPanel.append(actions);reviewPanel.hidden=false;reviewPanel.scrollIntoView({block:"nearest"});
   };
   viewSuggested.onclick=showReview;
   const clearSuggestion=()=>{pendingSuggestion=null;viewSuggested.hidden=true;closeReview()};
   for(const field of [controls.partNumber,controls.featureTreeDescription,controls.supplierPartNumber,controls.supplier,lookupHint]){
    field.addEventListener("input",clearSuggestion);
   }
   const uploadRow=el("div",undefined,"workshop-item-photo-upload");
   const uploadStatus=el("p","","muted");
   const uploadPreviews=el("div",undefined,"workshop-pending-photo-thumbnails");
   let previewUrls=[];
   const showPendingPreviews=files=>{
    previewUrls.forEach(url=>URL.revokeObjectURL(url));
    previewUrls=[];uploadPreviews.replaceChildren();
    for(const file of files){
     if(!["image/jpeg","image/png","image/webp"].includes(file.type))continue;
     const img=el("img");img.className="workshop-pending-photo-thumbnail";
     const url=URL.createObjectURL(file);previewUrls.push(url);
     img.src=url;img.alt=file.name||"New Workshop photo";uploadPreviews.append(img);
    }
   };
   const uploadFiles=async files=>{
    const images=[...files].filter(file=>["image/jpeg","image/png","image/webp"].includes(file.type));
    if(!images.length){uploadStatus.textContent="Paste or select a JPEG, PNG, or WebP image.";return}
    if(photos.length+images.length>12){uploadStatus.textContent="Up to 12 photos per item.";return}
    showPendingPreviews(images);
    upload.disabled=true;uploadStatus.textContent="Uploading image…";
    try{
     for(const file of images){
      const body=new FormData();body.append("photo",file,file.name||"pasted-image.png");
      const res=await fetch("/api/workshop-reference",{method:"POST",credentials:"same-origin",body});
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw Error(data.error||"Photo upload failed");
      photos.push(data.photo);
     }
     redrawPhotos();showPendingPreviews([]);uploadStatus.textContent="Photo added to draft. Save the item to publish it.";
    }catch(error){uploadStatus.textContent=error.message}
    finally{upload.disabled=false}
   };
   const uploader=window.BSPhotoEditor.uploadPanel({
    title:"Add photos",accept:"image/jpeg,image/png,image/webp",onFiles:uploadFiles,
    hint:"Select JPEG, PNG, or WebP photos. Up to 12 photos per item."
   });
   const upload=itemButton("Add photos",()=>uploader.open(),"btn");
   upload.type="button";
   uploadRow.append(upload);
   form.append(uploadRow,uploader.panel,uploadPreviews,uploadStatus);
   const status=el("p","","workshop-item-editor-status");
   status.setAttribute("role","status");
   const actions=el("div",undefined,"workshop-item-editor-actions");
   const save=itemButton(isNew?"Create catalog item":"Save changes",()=>form.requestSubmit(),"btn primary");
   const cancel=itemButton("Cancel",()=>isNew?closeItem():showItem(item.id,false),"btn");
   actions.append(save,cancel);form.append(actions,status);
   let editingEnabled=!viewOnly;
   form.addEventListener("submit",async event=>{
    event.preventDefault();
    if(!editingEnabled)return;
    const details={photos,specifications:storedSpecs()};
    for(const field of saveableFields)if(controls[field])details[field]=controls[field].value;
    details.kind=kind.value;details.category=category.value;
    details.productIdentity=identityRadios.generic.checked?"generic":"specific";
    // Legacy family metadata is retained for existing items, not edited or
    // required for new items. The category tree owns classification.
    details.familyId=item.familyId||"";
    details.familyName=item.familyName||"";
    if(!details.name?.trim()){status.textContent="Enter an item name.";return}
    status.textContent=isNew?"Creating item…":"Saving…";save.disabled=true;
    try{
     const response=await req("/api/workshop-reference",isNew?"POST":"PUT",
      isNew?{details}:{id:item.id,details,expectedRevision:item.revision||null});
     workshopOverrides[response.id]=response.details;
     if(isNew)editableReferenceIds.add(response.id);
     selectedFamily=details.familyId;selectedType="";
     renderCatalog();
     showItem(response.id,isNew);
    }catch(error){status.textContent=error.message;save.disabled=false}
   });
   mount.append(form);
   // View and Edit share this exact DOM. Editing merely unlocks the controls;
   // Save or Cancel returns to the read-only view without moving sections.
   const setEditing=editing=>{
    editingEnabled=editing;
    form.classList.toggle("is-readonly",!editing);
    form.classList.toggle("is-editing",editing);
    for(const control of form.querySelectorAll("input,textarea,select")){
     if(control.matches('input[type="hidden"]'))continue;
     if(control.matches('input[type="radio"],input[type="checkbox"],select'))control.disabled=!editing;
     else control.readOnly=!editing;
    }
    for(const control of form.querySelectorAll("button"))control.disabled=!editing;
    actions.hidden=!editing;
    uploadRow.hidden=!editing;
    if(!editing)uploader.panel.hidden=true;
    uploadPreviews.hidden=!editing;
    uploadStatus.hidden=!editing;
    specActions.hidden=!editing;
    lookupActions.hidden=!editing;
    if(!editing)viewSuggested.hidden=true;
    for(const btn of gallery.querySelectorAll("button"))btn.hidden=!editing;
    if(!editing)reviewPanel.hidden=true;
    if(editing&&viewOnly){
     // Explicitly requested templates may be added while editing, not in view.
     form.querySelector("input:not([disabled])")?.focus();
    }
   };
   if(viewOnly)setEditing(false);
   else{setEditing(true);form.scrollIntoView({block:"start"})}
   return {setEditing,form};
  }
  // Linked items may not yet be in memory when arriving from a project.
  // Resolve the exact record before showing the item view. Never silently
  // replace a failed deep link with the general Workshop catalog.
  let linkedItemRequest=0;
  const openLinkedWorkshopItem=async id=>{
   if(!id)return;
   const request=++linkedItemRequest;
   const current=()=>request===linkedItemRequest&&readSelected()===id&&location.hash==="#commonparts";
   const found=()=>id.startsWith("my:")
    ?items.some(item=>"my:"+item.id===id)
    :standards().some(item=>item.id===id);
   if(found()){if(current())showItem(id,false);return}
   itemPage.replaceChildren();
   itemSide.replaceChildren();
   shared.hidden=true;personal.hidden=true;sidebar.hidden=true;
   itemPage.hidden=false;itemSide.hidden=false;
   addProjectBackButton();
   itemPage.append(el("p","Opening Workshop item…","muted"));
   try{
    if(id.startsWith("my:")){
     const data=await req("/api/personal-workshop");
     if(!current())return;
     items=data.items||[];
    }else{
     const data=await req("/api/workshop-reference");
     if(!current())return;
     workshopOverrides=data.items||{};
     renderCatalog();
    }
    if(!current())return;
    if(!found())throw Error("The linked Workshop item could not be found. It may have been removed or the project link may need updating.");
    showItem(id,false);
   }catch(error){
    if(!current())return;
    itemPage.replaceChildren();
    addProjectBackButton();
    itemPage.append(el("h2","Unable to open Workshop item"),
     el("p",error.message||"The Workshop item could not be loaded.","muted"));
   }
  };
  const syncItemRoute=()=>{
   const id=location.hash==="#commonparts"?readSelected():"";
   if(id){
    if(openedItem===id)itemPage.scrollIntoView({block:"start"});
    else void openLinkedWorkshopItem(id);
   }else{
    linkedItemRequest++;
    closeItem(false);
   }
  };
  // Browser history can change the item query without changing the hash.
  window.addEventListener("popstate",event=>{
   if(location.hash==="#commonparts"&&event.state?.workshopItem!==openedItem)syncItemRoute();
  });
  window.addEventListener("hashchange",syncItemRoute);

  // The left sidebar is the only product hierarchy. Show actual parts
  // immediately—never insert an extra product-family or product-type screen.
  const renderCatalog=()=>{
   const query=results.value.trim().toLowerCase();
   const sort=$(".workshop-catalog-sort",catalog).value;
   const list=$(".workshop-catalog-list",catalog);
   list.replaceChildren();
   const group=window.BSResources.otherWorkshopGroups||[];
   const inCategory=category=>selectedWorkshopCategory==="all"||category===selectedWorkshopCategory||
    selectedWorkshopCategory==="electronics"&&category.startsWith("electrical-")||
    group.some(([key,,parent])=>parent===selectedWorkshopCategory&&key===category);
   const matches=(item,personal=false)=>{
    const terms=[item.name,item.partNumber,item.model,item.manufacturer,item.supplierPartNumber,
     item.subtitle,item.featureTreeDescription,item.spec,item.use,item.kind,item.category,
     ...(personal?(item.specifications||[]).flatMap(spec=>[spec.name,spec.value]):[])];
    return terms.join(" ").toLowerCase().includes(query);
   };
   const shared=standards().filter(item=>inCategory(categoryFor(item))&&matches(item));
   const owned=items.filter(item=>inCategory(categoryOfPersonal(item))&&matches(item,true));
   const personalOnly=owned.filter(item=>!matchingReference(item)||
    !shared.some(ref=>ref.id===matchingReference(item)?.id));
   const compare=(a,b)=>{
    if(sort==="type"){
     const difference=String(a.kind||"").localeCompare(String(b.kind||""));
     if(difference)return difference;
    }else if(sort==="level"){
     const difference=String(a.tier||"").localeCompare(String(b.tier||""));
     if(difference)return difference;
    }
    return String(a.partNumber||a.model||a.name||"").localeCompare(String(b.partNumber||b.model||b.name||""),undefined,{numeric:true});
   };
   shared.sort(compare);
   personalOnly.sort(compare);
   const title=$(".workshop-catalog-bar h3",catalog);
   title.textContent=selectedWorkshopCategory==="all"?"Workshop parts":
    workshopCategories.find(([id])=>id===selectedWorkshopCategory)?.[1]||"Workshop parts";
   const count=$(".workshop-catalog-count",catalog);
   count.textContent=shared.length+" catalog parts"+(personalOnly.length?" · "+personalOnly.length+" personal parts":"");
   if(!shared.length&&!personalOnly.length){
    list.append(el("p",query?"No matching parts. Try another search.":"No parts in this category yet.","muted"));
    return;
   }
   const rows=el("div",undefined,"workshop-direct-parts");
   const createRow=(item,isPersonal)=>{
    const row=el("article",undefined,"workshop-direct-part");
    const open=()=>isPersonal?showPersonalItem(item.id):showItem(item.id);
    const photo=itemButton("",open,"workshop-direct-part-photo");
    photo.setAttribute("aria-label","Open "+item.name);
    photo.append(isPersonal?personalThumb(item):catalogThumb(item));
    const body=el("div",undefined,"workshop-direct-part-details");
    const mpn=String(item.partNumber||item.model||"").trim();
    // Name remains the fallback for generic supplies that have no MPN.
    body.append(itemButton(mpn||item.name,open,"workshop-direct-part-number"));
    if(mpn&&item.name!==mpn)body.append(el("span",item.name,"workshop-direct-part-name"));
    if(item.manufacturer)body.append(el("small",item.manufacturer,"muted"));
    if(isPersonal){
     body.append(el("small","My Workshop · "+(stockLabels[item.stockStatus]||"In stock"),"muted"));
    }else if(ownedFor(item).length){
     body.append(el("small",ownershipLabel(ownedFor(item)),"muted"));
    }
    row.append(photo,body);
    if(!isPersonal){
     row.append(itemButton(ownedFor(item).length?"Edit My Workshop":"Add to My Workshop",
      ()=>editPersonalReference(item),"btn workshop-direct-part-add"));
    }else{
     row.append(itemButton("Edit",()=>{
      nav?.select("mine");fill(item);
      $("#workshop-editor",personal)?.scrollIntoView({block:"start"});
     },"btn workshop-direct-part-add"));
    }
    return row;
   };
   for(const item of shared)rows.append(createRow(item,false));
   for(const item of personalOnly)rows.append(createRow(item,true));
   list.append(rows);
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
  if(readSelected()&&location.hash==="#commonparts")void openLinkedWorkshopItem(readSelected());
  (async()=>{
   try{
    const data=await req("/api/workshop-reference");
    workshopOverrides=data.items||{};
    canEditReferences=!!data.canEdit;
    canCreateReferences=!!data.canCreate||canEditReferences;
    canDeleteReferences=!!data.canDelete;
    editableReferenceIds=new Set(data.editableIds||[]);
    $(".workshop-catalog-create",catalog).hidden=!canCreateReferences;
    renderCatalog();
    if(openedItem&&!openedItem.startsWith("my:")&&location.hash==="#commonparts")showItem(openedItem,false);
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
      <label>Mfg part number<input id="workshop-model" class="field" maxlength="120"></label>
      <label>Part number<input id="workshop-partnumber" class="field" maxlength="120"></label>
       <label>Feature tree description (20 characters max)<input id="workshop-featuretreedescription" class="field" maxlength="20" placeholder="e.g. Hall sensor"></label>
      <label>Quantity<input id="workshop-quantity" class="field" type="number" min="0" step="any" value="1"></label>
      <label>Unit<input id="workshop-unit" class="field" maxlength="32" value="pcs"></label>
      <label>Availability<select id="workshop-stockstatus" class="field"><option value="in_stock">In stock</option><option value="in_use_reusable">In use (reusable)</option><option value="committed">Committed</option></select></label>
     </div>
     <label>Specifications (one per line: name: value)<textarea id="workshop-specifications" class="field" rows="3"></textarea></label>
     <section class="workshop-structured-specs" id="workshop-personal-specs">
      <h3>Additional specifications</h3>
      <p class="muted">Optional. AI can populate these, or add your own properties.</p>
      <div class="workshop-structured-spec-rows" id="workshop-personal-spec-rows"></div>
      <button type="button" id="workshop-add-personal-spec" class="btn">+ Add specification</button>
     </section>
     <label>Notes<textarea id="workshop-notes" class="field" maxlength="1500"></textarea></label>
     <div class="workshop-row"><button id="workshop-photo-upload" type="button" class="btn">+ Add equipment photo</button><img id="workshop-photo-preview" class="workshop-photo-thumb" hidden alt="Equipment photo"></div>
     <div id="workshop-private-photo-paste"></div>
     <p class="muted">AI identification is a draft. Check the model and specifications yourself before saving.</p>
     <div class="workshop-row"><button id="workshop-save" type="button" class="btn primary">Save item</button><button id="workshop-cancel" type="button" class="btn">Cancel</button></div>
    </details>
    <section class="workshop-compare"><h3>Project readiness</h3><p class="muted">Compare project BOM items with confirmed inventory. An unknown item is not assumed missing.</p>
     <div class="workshop-row"><select id="workshop-project" class="field" aria-label="Select project"><option value="">Select a project</option></select><button id="workshop-compare" class="btn" type="button">Compare BOM</button></div>
     <div id="workshop-comparison"></div>
    </section>`;
   $("#workshop-add-personal-spec",personal).onclick=()=>addPersonalSpec();
   const mineLookup=el("section",undefined,"workshop-ai-lookup");
   mineLookup.append(el("h3","Fill product details with AI"),
    el("p","Search using the manufacturer's part number and feature tree description below. Either field can be used on its own.","muted"));
   const mineFind=itemButton("Fill details with AI",()=>{},"btn primary");
   const minePartNumber=$("#workshop-partnumber",personal);
   const mineDescription=$("#workshop-featuretreedescription",personal);
   const mineMessage=el("p",undefined,"workshop-ai-lookup-status");mineMessage.setAttribute("role","status");
   const mineResults=el("div",undefined,"workshop-ai-lookup-results");
   mineLookup.append(mineFind,mineMessage,mineResults);
   $("#workshop-editor > summary",personal).after(mineLookup);
   mineFind.onclick=async()=>{
    const itemId=editingId;
    const partNumber=minePartNumber.value.trim();
    const featureTreeDescription=mineDescription.value.trim();
    if(!partNumber&&!featureTreeDescription){mineMessage.textContent="Enter a manufacturer part number or feature tree description.";return}
    mineFind.disabled=true;mineMessage.textContent="Searching product information…";
    mineResults.replaceChildren();
    try{
     const result=await req("/api/workshop-lookup","POST",{partNumber,featureTreeDescription});
     if(itemId!==editingId||partNumber!==minePartNumber.value.trim()||featureTreeDescription!==mineDescription.value.trim()){
      mineMessage.textContent="Search fields changed. Run the lookup again.";return;
     }
     const d=result.draft||{};
     const values={
      name:d.name||$("#workshop-name",personal).value||partNumber||featureTreeDescription,partNumber:d.partNumber||partNumber,featureTreeDescription:d.featureTreeDescription||featureTreeDescription,
      manufacturer:d.manufacturer||"",model:d.partNumber||partNumber,
      kind:d.kind||"component",
      category:workshopCategories.find(([id])=>id===d.category)?.[1]||d.category||"",
      notes:[d.subtitle,d.use,d.caution,d.notes].filter(Boolean).join("\n\n").slice(0,1500)
     };
     for(const [key,value] of Object.entries(values)){
      const field=$("#workshop-"+fields[key],personal);if(field)field.value=value;
     }
     $("#workshop-specifications",personal).value=(d.spec||"").split(/\r?\n/).filter(Boolean).map(line=>line.includes(":")?line:"Spec: "+line).join("\n");
     if(result.research?.specs?.length){
      const target=$("#workshop-personal-spec-rows",personal);target.replaceChildren();
      for(const spec of result.research.specs)addPersonalSpec({label:spec.name,value:spec.value,unit:spec.unit||"",conditions:spec.conditions||""});
     }
     for(const message of [lookupCostMessage(result.lookupUsage),missingSpecsMessage(result.missingSpecs),
      result.note||"Review AI suggestions before saving."]){
      if(message)mineResults.append(el("p",message,"muted"));
     }
     if(result.research?.pins?.length){
      const pinSummary=el("div",undefined,"workshop-ai-engineering-review");
      pinSummary.append(el("strong","Pinout — verify package and orientation"));
      pinSummary.append(el("p",[result.research.package,result.research.pinoutOrientation].filter(Boolean).join(" · "),"muted"));
      for(const pin of result.research.pins)pinSummary.append(el("p","Pin "+pin.number+": "+pin.name));
      mineResults.append(pinSummary);
     }
     const urls=(result.sources||[]).filter(url=>/^https:\/\//i.test(url));
     if(urls.length){
      const sources=el("div",undefined,"workshop-ai-source-list");sources.append(el("strong","Sources"));
      for(const [index,url] of urls.entries()){
       const link=el("a","Source "+(index+1));link.href=url;link.target="_blank";link.rel="noopener noreferrer";sources.append(link);
      }mineResults.append(sources);
     }
     mineMessage.textContent="Draft filled. Confirm the exact product and specifications before saving.";
    }catch(error){mineMessage.textContent=[error.message,lookupCostMessage(error.lookupUsage)].filter(Boolean).join(" ")||"Lookup failed."}
    finally{mineFind.disabled=false}
   };
   $("#workshop-search",personal).addEventListener("input",render);
   $("#workshop-type-filter",personal).addEventListener("change",render);
   $("#workshop-new",personal).onclick=()=>fill({});
   $("#workshop-save",personal).onclick=save;
   $("#workshop-cancel",personal).onclick=()=>$("#workshop-editor",personal).open=false;
   const equipmentUploader=window.BSPhotoEditor.uploadPanel({
    title:"Add equipment photo",multiple:false,accept:"image/jpeg,image/png,image/webp",
    hint:"JPG, PNG or WebP. The image will be checked for equipment identification.",
    onFiles:files=>uploadPhoto(files[0])
   });
   $("#workshop-photo-upload",personal).onclick=()=>equipmentUploader.open();
   $("#workshop-private-photo-paste",personal).replaceWith(equipmentUploader.panel);
   $("#workshop-compare",personal).onclick=compare;
  }
  const fields={name:"name",kind:"kind",category:"category",manufacturer:"manufacturer",model:"model",partNumber:"partnumber",featureTreeDescription:"featuretreedescription",quantity:"quantity",unit:"unit",stockStatus:"stockstatus",notes:"notes"};
  function addPersonalSpec(spec={}){
   const target=$("#workshop-personal-spec-rows",personal);
   if(!target||target.children.length>=60)return;
   const row=el("div",undefined,"workshop-structured-spec-row");row.dataset.propertyId=spec.propertyId||"";
   for(const [name,placeholder,max] of [["label","Property",100],["value","Value",220],["unit","Unit",32],["conditions","Conditions (optional)",300]]){
    const field=el("input");field.type="text";field.className="field";field.dataset.spec=name;
    field.maxLength=max;field.placeholder=placeholder;field.value=spec[name]||"";
    if(name==="label")field.oninput=()=>{row.dataset.propertyId=""};
    row.append(field);
   }
   row.append(itemButton("Remove",()=>row.remove(),"btn"));target.append(row);
  }
  function personalSpecRecords(){
   return [...$("#workshop-personal-spec-rows",personal).children].map(row=>({
    propertyId:row.dataset.propertyId||"",
    label:row.querySelector('[data-spec="label"]').value.trim(),
    value:row.querySelector('[data-spec="value"]').value.trim(),
    unit:row.querySelector('[data-spec="unit"]').value.trim(),
    conditions:row.querySelector('[data-spec="conditions"]').value.trim()
   })).filter(row=>row.label&&row.value);
  }
  function fill(item){
   editingId=item.id||null;photoId=item.photoId||"";catalogId=item.catalogId||"";
   const aiResults=$("#workshop-editor .workshop-ai-lookup-results",personal);
   if(aiResults)aiResults.replaceChildren();
   const aiStatus=$("#workshop-editor .workshop-ai-lookup-status",personal);
   if(aiStatus)aiStatus.textContent="";
   for(const [key,id] of Object.entries(fields)){
    const input=$("#workshop-"+id,personal);
    if(input)input.value=item[key]??(key==="quantity"?1:key==="unit"?"pcs":key==="kind"?"other":key==="stockStatus"?"in_stock":"");
   }
   const preview=$("#workshop-photo-preview",personal);
   if(preview){preview.hidden=!photoId;if(photoId)preview.src="/api/workshop-photo?id="+encodeURIComponent(photoId)}
   const specTarget=$("#workshop-personal-spec-rows",personal);
   if(specTarget){specTarget.replaceChildren();for(const spec of item.specRecords||[])addPersonalSpec(spec)}
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
    const actions=el("div",undefined,"workshop-actions"),edit=el("button","Edit","btn");
    edit.onclick=()=>{fill(item);$("#workshop-editor",personal).scrollIntoView({block:"nearest"})};
    actions.append(edit);
    if(canDeletePersonal){
     const remove=el("button","Delete","btn");
     remove.onclick=async()=>{if(!await confirmDelete("Delete Workshop item?","Permanently delete \""+item.name+"\" from this Workshop? This cannot be undone."))return;
      try{items=(await req("/api/personal-workshop","DELETE",{id:item.id})).items;render();renderCatalog()}catch(e){setStatus(e.message)}};
     actions.append(remove);
    }
    row.append(details,actions);list.append(row);
   }
  }
  async function save(){
   const input={};for(const [key,id] of Object.entries(fields))input[key]=$("#workshop-"+id,personal).value;
   input.photoId=photoId;
   input.catalogId=catalogId;
   input.specRecords=personalSpecRecords();
   input.specifications=$("#workshop-specifications",personal).value.split(/\r?\n/).map(row=>{
    const split=row.indexOf(":");return split<1?null:{name:row.slice(0,split).trim(),value:row.slice(split+1).trim()};
   }).filter(Boolean);
   if(editingId)input.id=editingId;
   try{const data=await req("/api/personal-workshop",editingId?"PUT":"POST",input);
    items=data.items;$("#workshop-editor",personal).open=false;render();renderCatalog();if(openedItem)showItem(openedItem,false);setStatus(input.name+" saved to your private Workshop.");
   }catch(e){setStatus(e.message)}
  }
  async function uploadPhoto(fileOverride=null){
   const file=fileOverride;if(!file){setStatus("Select a photo first.");return}
   const preview=$("#workshop-photo-preview",personal);
   const originalSrc=preview.getAttribute("src"),originalHidden=preview.hidden;
   const localUrl=URL.createObjectURL(file);
   preview.src=localUrl;preview.hidden=false;
   const body=new FormData();body.append("photo",file);
   setStatus("Uploading and checking photo...");
   try{
    const res=await fetch("/api/workshop-photo",{method:"POST",body,credentials:"same-origin"});
    const data=await res.json();if(!res.ok)throw Error(data.error||"Upload failed");
    photoId=data.photoId;
    preview.src="/api/workshop-photo?id="+encodeURIComponent(photoId);preview.hidden=false;
    if(data.suggestion){for(const [key,id] of Object.entries(fields)){
     if(typeof data.suggestion[key]==="string"&&data.suggestion[key].trim())$("#workshop-"+id,personal).value=data.suggestion[key];
    }}
    if(Array.isArray(data.suggestion?.specifications))$("#workshop-specifications",personal).value=data.suggestion.specifications.map(x=>x.name+": "+x.value).join("\n");
    setStatus(data.recognitionError||"Identification proposed. Review every detail, then save.");
   }catch(e){
    if(originalSrc)preview.src=originalSrc;else preview.removeAttribute("src");
    preview.hidden=originalHidden;
    setStatus(e.message);
   }finally{URL.revokeObjectURL(localUrl)}
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
  (async()=>{try{if(!await auth())return;buildUI();{const inventory=await req("/api/personal-workshop");items=inventory.items;canDeletePersonal=!!inventory.canDelete;}render();renderCatalog();await loadProjects()}catch(e){setStatus(e.message)}})();
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
