/* Canonical assembly controllers: project tree, BOM, workspaces and photo editing.
 * This is the single source of truth for those features.
 * Loaded before assets/site.js; setupAssemblyTrees() is called from site.js
 * after shared application globals are initialized. Existing APIs and IDs are unchanged.
 */
// Project assembly trees are public; editing requires administrator login.
const assemblySelections={};
// Public tree snapshots let each assembly BOM roll up all descendant parts.
const assemblyTreeSnapshots={};
function setupAssemblyTrees(){
 document.querySelectorAll("[data-assembly-tree]:not([data-tree-ready])").forEach(root=>{
  root.dataset.treeReady="true";
  const project=root.dataset.assemblyTree,view=document.getElementById(project),nodesEl=root.querySelector(".assembly-tree-nodes"),status=root.querySelector(".assembly-tree-status"),controls=root.querySelector(".assembly-edit");
  // Navigation is visually divided into two independent cards without changing
  // the underlying project, tree data, or existing event listeners.
  const summaryCard=document.createElement("div");
  summaryCard.className="assembly-summary-sidebar-card";
  summaryCard.setAttribute("aria-label","Project navigation");
  const featureTreeCard=document.createElement("div");
  featureTreeCard.className="assembly-feature-tree-card";
  while(root.firstChild)featureTreeCard.append(root.firstChild);
  root.append(featureTreeCard,summaryCard);
  // Legacy project pages share the same workspace styling as newer projects.
  if(project==="linear"||project==="robot")view.classList.add("personal-project-view");
  const canEdit=()=>window.BSProjectManager?.isOwner?.(project)===true || (["launcher","linear","robot"].includes(project)&&adminAuthenticated);
  let title=view.querySelector(".assembly-main h1")?.textContent||"Project";let nodes=[],selected=null,expanded=new Set([null]);
  let showWorkshopItems=true,showTreeDocuments=true,showTreeDescriptions=true,showHiddenParts=false,showBomDocuments=true;
  const workshopReferences=new Map();const partDocuments=new Map(),partVisibility=new Map(),partTools=new Map(),partWorkshopItems=new Map(),partNumbers=new Map(),partProgress=new Map(),partAttention=new Map(),partQuantities=new Map(),partTreeLabels=new Map();
  const isHiddenPart=node=>isPartNode(node)&&partVisibility.get(node.partId)===true;
  const isToolNode=node=>isPartNode(node)&&partTools.get(node.partId)===true;
  const isDocumentNode=node=>isPartNode(node)&&partDocuments.get(node.partId)===true;
  const includeTreeNode=node=>{
   if(!isPartNode(node))return true;
   // Persisted hidden flags remain intact. Category filters also apply.
   if(isHiddenPart(node)&&!showHiddenParts)return false;
   if(isDocumentNode(node)&&!showTreeDocuments)return false;
   if(partWorkshopItems.get(node.partId)===true&&!showWorkshopItems)return false;
   return true;
  };
  const referenceTreeDescription=details=>{
   const reference=workshopReferences.get(details?.workshopReferenceId||"");
   return String(reference?.featureTreeDescription||reference?.subtitle||reference?.description||reference?.name||"").trim().slice(0,20);
  };
  const treeDescription=(details,description)=>String(details?.featureTreeName||referenceTreeDescription(details)||details?.workshopTreeDescription||description?.slice(0,20)||"").trim();
  // Refresh the shared/personal Workshop captions without changing project BOM records.
  const loadWorkshopCaptions=async()=>{
   const [shared,personal]=await Promise.allSettled([
    fetch("/api/workshop-reference",{credentials:"same-origin",cache:"no-store"}).then(r=>r.ok?r.json():null),
    fetch("/api/personal-workshop",{credentials:"same-origin",cache:"no-store"}).then(r=>r.ok?r.json():null)
   ]);
   const builtIn=window.BSResources?.workshopReferences||[];
   for(const item of builtIn)if(item.id)workshopReferences.set(item.id,item);
   if(shared.status==="fulfilled")for(const [id,item] of Object.entries(shared.value?.items||{}))
    workshopReferences.set(id,{...(workshopReferences.get(id)||{}),...item});
   if(personal.status==="fulfilled")for(const item of personal.value?.items||[])
    if(item.id){workshopReferences.set(item.id,item);workshopReferences.set("my:"+item.id,item)}
   render();
  };
  const syncPartNodes=parts=>{
   const known=new Set(nodes.filter(isPartNode).map(n=>n.partId));let changed=false;
   for(const part of parts){
    if(part.generatedFrom)continue;
    partVisibility.set(part.id,part.hideFromFeatureTree===true);
    partTools.set(part.id,part.isTool===true);
    partWorkshopItems.set(part.id,!!part.sharedPartRef||!!part.workshopChoice||!!part.projectDetails?.workshopReferenceId||part.isTool===true);
    partDocuments.set(part.id,part.itemType==="document");
    if(part.partNumber)partNumbers.set(part.id,part.partNumber);
    partProgress.set(part.id,part.progressStatus||"not_started");
    partAttention.set(part.id,part.needsAttention===true);
    partQuantities.set(part.id,part);
    partTreeLabels.set(part.id,{mpn:part.model||"",description:part.description||"",details:part.projectDetails||{},defaultPicture:defaultPartPicture(part)});
    for(const linked of nodes.filter(n=>isPartNode(n)&&n.partId===part.id))if(linked.name!==part.name){linked.name=part.name;changed=true}
    if(!known.has(part.id)){
     const parentId=nodes.some(n=>n.id===part.assemblyId&&!isPartNode(n))?part.assemblyId:null;
     nodes.push({id:"part-"+part.id,kind:"part",partId:part.id,name:part.name,parentId});
     known.add(part.id);changed=true;
    }
   }
   if(changed||parts.length)render();
  };
  const detail=view.querySelector(".assembly-detail"),main=view.querySelector(".assembly-main"),detailStatus=detail.querySelector(".assembly-detail-status");
  const isPartNode=node=>node?.kind==="part"&&!!node.partId;
  const openTreePart=node=>{
   if(!isPartNode(node))return;
   partBackAssembly=node.parentId;
   selected=node.parentId;
   history.pushState(null,"","#"+project+"/part/"+encodeURIComponent(node.partId));
   render();void showAssemblyPage();window.scrollTo(0,0);
  };
  let detailVersion=0;
  // All project and subassembly pages now instantiate the exact same tile DOM.
  // Preserve the existing BOM widget (and its event handlers) when replacing root markup.
  function createUnifiedTile(){
   const tile=detail.querySelector(".assembly-unified-tile").cloneNode(true);
   tile.querySelector(".assembly-photos").replaceChildren();
   tile.querySelector(".assembly-description").textContent="";
   tile.querySelector(".assembly-description-input").value="";
   tile.querySelector(".assembly-content-tiles").replaceChildren();
   return tile;
  }
  // All projects use the same assembly controller. Reuse existing BOM records.
  const oldRootTile=main.querySelector(".assembly-unified-tile");
  const rootBom=oldRootTile?.querySelector(".component-section")||
   view.querySelector('.component-section[data-components="'+project+'"]');
  if(!rootBom){console.error("Project BOM mount is missing:",project);return}
  let rootStatus=main.querySelector(".root-photo-status");
  if(!rootStatus){
   rootStatus=document.createElement("p");rootStatus.className="root-photo-status small";rootStatus.setAttribute("role","status");
  }
  const newRootTile=createUnifiedTile();
  newRootTile.classList.add("assembly-main-tile");
  newRootTile.querySelector(".assembly-content-tiles").append(rootBom);
  if(oldRootTile)oldRootTile.replaceWith(newRootTile);
  else main.append(newRootTile);
  main.insertBefore(rootStatus,newRootTile.nextSibling);
  // Legacy linear/robot galleries were standalone siblings of their main
  // content. Keep their DOM/data, but prevent the old gallery from appearing
  // alongside the new summary/workspace screens.
  const legacyGallery=view.querySelector('.photos[data-photos="'+project+'"]');
  if(legacyGallery&&legacyGallery.parentElement!==main)main.append(legacyGallery);
  // Project-level controls: unlike subassembly nodes, the root has no node ID.
  // Its name is stored in project-settings, and its cover uses existing photos.
  const projectHeading=main.querySelector("h1");
  const projectMetaUrl="/api/tree?project="+encodeURIComponent(project)+"&metadata=1";
  let projectMetaRevision=null;
  const projectActions=document.createElement("div");
  projectActions.className="project-root-actions";
  const editProjectName=document.createElement("button");
  editProjectName.type="button";editProjectName.className="btn project-root-rename";
  editProjectName.textContent="Rename project";editProjectName.title="Change the top-level project name";
  const projectMetaStatus=document.createElement("span");
  projectMetaStatus.className="project-root-status";projectMetaStatus.setAttribute("role","status");
  projectActions.append(editProjectName,projectMetaStatus);
  projectHeading.after(projectActions);
  const updateProjectTitle=value=>{
   title=value;
   projectHeading.textContent=value;
   const card=document.querySelector('.project-link[data-nav="'+project+'"],.project-link[data-project="'+project+'"]');
   const cardHeading=card?.querySelector(".project-copy h2");
   if(cardHeading)cardHeading.textContent=value;
   if(card)card.setAttribute("aria-label","Open "+value+" project");
   render();
  };
  const refreshProjectCover=async()=>{
   const card=document.querySelector('.project-link[data-nav="'+project+'"],.project-link[data-project="'+project+'"]');
   const art=card?.querySelector(".project-art");
   if(!art)return;
   try{
    const response=await fetch("/api/photos?project="+encodeURIComponent(project),{cache:"no-store"});
    if(!response.ok)return;
    const result=await response.json();
    const cover=(result.photos||[]).find(photo=>!photo.assembly);
    if(cover){
     let image=art.querySelector(".project-card-cover");
     if(!image){image=document.createElement("img");image.className="project-card-cover";image.alt="";art.append(image)}
     image.src=window.BSPhotoMarkup.displayUrl("gallery",cover.id);
     art.classList.add("has-project-cover");
    }else{
     art.querySelector(".project-card-cover")?.remove();
     art.classList.remove("has-project-cover");
    }
   }catch{/* Keep the existing illustration if photos are unavailable. */}
  };
  async function loadProjectMetadata(){
   try{
    const response=await fetch(projectMetaUrl,{cache:"no-store"});
    if(!response.ok)return;
    const data=await response.json();
    projectMetaRevision=data.revision??null;
    if(data.title)updateProjectTitle(data.title);
   }catch{/* Project remains readable with its default heading. */}
   void refreshProjectCover();
  }
  editProjectName.onclick=async()=>{
   const value=await window.BSDialogs.prompt("Enter a new project name",title,{title:"Rename project",label:"Project name"});
   if(!value?.trim()||value.trim()===title)return;
   editProjectName.disabled=true;projectMetaStatus.textContent="Saving…";
   try{
    const response=await fetch(projectMetaUrl,{
     method:"PUT",credentials:"same-origin",headers:{"content-type":"application/json"},
     body:JSON.stringify({title:value.trim(),expectedRevision:projectMetaRevision})
    });
    const data=await response.json();
    if(!response.ok)throw Error(data.error||"Unable to rename project");
    projectMetaRevision=data.revision??null;
    if(project.startsWith("p")){
     const update=await fetch("/api/projects",{method:"PATCH",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({id:project,name:data.title})});
     const updated=await update.json();if(!update.ok)throw Error(updated.error||"Project catalog rename failed");
    }
    updateProjectTitle(data.title);
    projectMetaStatus.textContent="Project name saved.";
   }catch(error){projectMetaStatus.textContent=error.message}
   finally{editProjectName.disabled=false}
  };
  // Shared image tile renderer for root projects and all subassemblies.
  function makeAssemblyPhotoStage(photos,name,onAdd,onDelete,allowEditing=false,onEdit=null){
   let active=0;
   const stage=document.createElement("div");stage.className="assembly-photo-stage";
   const picture=document.createElement("img");picture.className="assembly-stage-image";picture.alt="";
   const empty=document.createElement("div");empty.className="assembly-photo-placeholder";empty.textContent="No photo yet";
   const prev=document.createElement("button"),next=document.createElement("button");
   prev.type=next.type="button";prev.className="assembly-photo-arrow previous";next.className="assembly-photo-arrow next";prev.textContent="‹";next.textContent="›";prev.setAttribute("aria-label","Previous photo");next.setAttribute("aria-label","Next photo");
   const label=document.createElement("span");label.className="assembly-photo-name";label.textContent=name;
   const actions=document.createElement("div");actions.className="assembly-photo-actions";
   const add=document.createElement("button");add.type="button";add.className="assembly-photo-icon";add.textContent="+";add.title="Add photo";add.setAttribute("aria-label","Add photo");add.onclick=onAdd;
   const edit= document.createElement("button");edit.type="button";edit.className="btn bs-gallery-markup";edit.textContent="Markup / annotate";edit.title="Crop and mark up current photo";edit.setAttribute("aria-label","Edit current photo");edit.onclick=()=>onEdit?.(photos[active]);
   const del=document.createElement("button");del.type="button";del.className="assembly-photo-icon";del.textContent="×";del.title="Delete current photo";del.setAttribute("aria-label","Delete current photo");del.onclick=()=>onDelete(photos[active]);
   if(canEdit()&&allowEditing)actions.append(add,edit,del);
   const show=()=>{const p=photos[active];picture.hidden=!p;empty.hidden=!!p;if(p){picture.src=window.BSPhotoMarkup.displayUrl("gallery",p.id);picture.alt=p.caption||name}else picture.removeAttribute("src");prev.hidden=next.hidden=photos.length<2;edit.hidden=del.hidden=!p};
   prev.onclick=()=>{active=(active+photos.length-1)%photos.length;show()};
   next.onclick=()=>{active=(active+1)%photos.length;show()};
   stage.append(picture,empty,prev,next,label,actions);show();return stage;
  }
  // Project and subassembly workspaces remain independent of the BOM screen.
  const workspace=document.createElement("section");workspace.className="assembly-workspace-page hide";
  workspace.innerHTML='<div class="workspace-heading"><div class="workspace-cover"><span>No photo yet</span></div><div class="workspace-title-group"><h1 class="workspace-title"></h1><button type="button" class="btn workspace-back">Open BOM</button></div></div><section class="workspace-panels"><article class="workspace-bom"><div class="workspace-bom-heading"><h2>Bill of materials</h2><button type="button" class="btn primary workspace-new-part">+ New part</button></div><div class="workspace-saved-parts" aria-live="polite">Loading saved parts…</div><div class="workspace-bom-mount"></div></article><article class="recipe-instructions"><h2>Work instructions</h2></article><article class="workspace-resources"></article><div class="workspace-actions"><button type="button" class="btn primary workspace-save" hidden aria-hidden="true" tabindex="-1">Save workspace</button><span class="workspace-status" role="status"></span></div></section>';
  detail.after(workspace);
  // Assembly photo management lives in the workspace, not the read-only overview.
  const workspacePhotoEditor=document.createElement("article");
  workspacePhotoEditor.className="workspace-photos-editor is-editing-photo";
  workspacePhotoEditor.innerHTML='<h2>Assembly photos</h2><p class="muted">Browse, add, or delete assembly photos.</p><div class="assembly-unified-photo"><div class="assembly-photos"></div></div><div class="workspace-photo-tools"><div class="assembly-photo-admin hide"><div class="assembly-photo-zone"><button type="button" class="assembly-photo-pick">+ Add photo</button><input class="assembly-photo-input" type="file" accept="image/*,.heic,.heif" hidden><span class="assembly-photo-drop-hint">or drop an image here</span></div><label class="assembly-photo-caption-label">Caption <input class="field assembly-photo-caption" placeholder="Photo description"></label></div></div><p class="workspace-photo-status muted" role="status" aria-live="polite"></p>';
  const photoDialog=window.BSPhotoEditor.dialog({
   parent:workspace,label:"Edit assembly photos",className:"workspace-photo-dialog",
   doneClass:"workspace-photo-close",content:workspacePhotoEditor
  });
  // Keep the modal outside the hidden workspace so the project summary can open it.
  workspace.parentElement.append(photoDialog);
  // One inline Edit photo control below the thumbnail, shared with part pages.
  let workspacePhotos=[],workspacePhotoIndex=0;
  const workspacePhotoBar=window.BSPhotoEditor.actionBar(workspace.querySelector(".workspace-cover"),{
   onMarkup:()=>{const photo=workspacePhotos[workspacePhotoIndex];if(photo)window.BSPhotoMarkup.open({kind:"gallery",id:photo.id,onSave:()=>{void loadWorkspaceCover();void refreshProjectCover()}})},
   onAdd:()=>workspacePhotoInput.click(),
   onPaste:file=>uploadGalleryPhoto(file,workspacePhotoBar),
   onDelete:()=>void deleteGalleryPhoto(workspacePhotos[workspacePhotoIndex],workspacePhotoBar)
  });
  const workspacePhotoInput=document.createElement("input");workspacePhotoInput.type="file";
  workspacePhotoInput.accept="image/*,.heic,.heif";workspacePhotoInput.hidden=true;
  workspacePhotoBar.shell.append(workspacePhotoInput);
  workspacePhotoInput.onchange=()=>{const file=workspacePhotoInput.files?.[0];workspacePhotoInput.value="";if(file)void uploadGalleryPhoto(file,workspacePhotoBar)};
  workspacePhotoBar.setEnabled(canEdit());
  function galleryStatus(bar,message){bar.setStatus(message)}
  async function uploadGalleryPhoto(file,bar){
   galleryStatus(bar,"Uploading photo…");
   const ok=await workspacePhotoController.upload(file);
   galleryStatus(bar,ok?"Photo uploaded.":"Photo upload failed. Check the photo type and your sign-in.");
   if(ok){if(isProjectSummary())await refreshProjectSummary();else await loadWorkspaceCover()}
  }
  async function deleteGalleryPhoto(photo,bar){
   if(!photo||!canEdit()||!await window.BSDialogs.danger("Delete this photo?",{title:"Delete photo?"}))return;
   galleryStatus(bar,"Deleting photo…");
   try{
    const response=await fetch("/api/photos?id="+encodeURIComponent(photo.id),{method:"DELETE",credentials:"same-origin"});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(data.error||"Photo deletion failed");
    galleryStatus(bar,"Photo deleted.");
    if(isProjectSummary())await refreshProjectSummary();else await loadWorkspaceCover();
    void refreshProjectCover();
   }catch(error){galleryStatus(bar,error.message)}
  }
  window.BSPhotoMarkup.pasteOn(photoDialog,file=>workspacePhotoController.upload(file));
  window.BSPhotoMarkup.dropOn(photoDialog,file=>workspacePhotoController.upload(file),{
   canUpload:canEdit,
   onBlocked:message=>{workspacePhotoEditor.querySelector(".workspace-photo-status").textContent=message||"Sign in as administrator before uploading photos."}
  });
  const workspacePhotoController=createPhotoController(workspacePhotoEditor,()=>isProjectSummary()?"project-summary":(selected??"root-assembly"),
   workspacePhotoEditor.querySelector(".workspace-photo-status"),true);
  window.BSPhotoMarkup.dropOn(workspace.querySelector(".workspace-cover"),file=>workspacePhotoController.upload(file),{
   canUpload:canEdit,
   onBlocked:message=>{workspacePhotoEditor.querySelector(".workspace-photo-status").textContent=message||"Sign in as administrator before uploading photos."}
  });
  // The project summary is a landing page, not a separate source of BOM data.
  // It rolls up all assembly occurrences and standard shop materials at project scope.
  const summary=document.createElement("section");
  summary.className="project-summary-page hide";
  summary.innerHTML='<header class="project-summary-heading"><div><p class="muted">Project summary</p><h1 class="project-summary-title"></h1></div></header><section class="project-summary-gallery"><div class="project-summary-gallery-heading"><h2>Project photos</h2></div><div class="project-summary-photo-stage"><img alt="Project photo" class="project-summary-photo" hidden><p class="project-summary-photo-empty">No project photos yet.</p><button type="button" class="project-summary-previous" aria-label="Previous project photo">‹</button><button type="button" class="project-summary-next" aria-label="Next project photo">›</button></div><div class="project-summary-photo-footer"><p class="project-summary-photo-caption"></p><span class="project-summary-photo-position"></span></div></section><div class="project-summary-lists"><section class="project-summary-bom-section"><h2>Project BOM</h2><div class="project-summary-bom-items" aria-live="polite"></div></section><section class="project-summary-tools-section"><h2>Tools needed</h2><div class="project-summary-tool-items" aria-live="polite"></div></section></div>';
  detail.after(summary);
  const overview=document.createElement("section");overview.className="project-summary-overview";
  overview.innerHTML=`<section class="project-overview-card">
   <h2>Project summary</h2>
   <p class="project-short-summary-text" hidden></p>
   <p class="project-summary-text"></p>
   <label class="project-short-summary-label">Short summary (40 characters max)
    <input class="field project-short-summary" type="text" maxlength="40">
   </label>
   <textarea class="field" aria-label="Project summary" rows="5" maxlength="5000" placeholder="Describe your project"></textarea>
   <div class="project-summary-edit-actions" hidden><button type="button" class="btn primary project-summary-save">Save</button><button type="button" class="btn project-summary-cancel">Cancel</button></div>
   <p class="muted project-summary-message" role="status"></p>
  </section>
  <section class="project-overview-card project-descriptor-card"><h2>Descriptors</h2><div class="project-tags project-summary-tags"></div></section>
  <section class="project-overview-card"><h2>Estimated project cost</h2><p class="project-summary-cost" aria-live="polite">Loading estimate…</p><p class="project-summary-package-cost" aria-live="polite"></p><p class="project-summary-cost-missing muted"></p></section>`;
  summary.querySelector(".project-summary-gallery").after(overview);
  const summaryInput=overview.querySelector("textarea");
  const summarySave=overview.querySelector(".project-summary-save");
  const summaryMessage=overview.querySelector(".project-summary-message");
  const summaryCost=overview.querySelector(".project-summary-cost");
  const summaryPackageCost=overview.querySelector(".project-summary-package-cost");
  const summaryCostMissing=overview.querySelector(".project-summary-cost-missing");
  const summaryActions=overview.querySelector(".project-summary-edit-actions");
  const summaryCancel=overview.querySelector(".project-summary-cancel");
  const shortSummaryLabel=overview.querySelector(".project-short-summary-label");
  const shortSummaryText=overview.querySelector(".project-short-summary-text");
  const summaryText=overview.querySelector(".project-summary-text");
  const summaryFields={shortSummary:shortSummaryLabel.querySelector("input"),summary:summaryInput};
  const summaryBaseline={shortSummary:"",summary:""};
  let summaryRevision=null;
  const summaryEntries=Object.entries(summaryFields);
  const hasSummaryChanges=()=>summaryEntries.some(([key,field])=>field.value!==summaryBaseline[key]);
  const showSummaryActions=()=>{summaryActions.hidden=!canEdit()||!hasSummaryChanges()};
  for(const field of Object.values(summaryFields))field.oninput=()=>{summaryMessage.textContent="";showSummaryActions()};
  summaryCancel.onclick=()=>{
   const changed=summaryEntries.find(([key,field])=>field.value!==summaryBaseline[key]);
   for(const [key,field] of summaryEntries)field.value=summaryBaseline[key];
   summaryMessage.textContent="";showSummaryActions();changed?.[1].focus();
  };
  summarySave.onclick=async()=>{
   if(!canEdit()||!hasSummaryChanges())return;
   const draft=Object.fromEntries(summaryEntries.map(([key,field])=>[key,field.value]));
   const changes=Object.fromEntries(Object.entries(draft).filter(([key,value])=>value!==summaryBaseline[key]));
   summarySave.disabled=summaryCancel.disabled=true;summaryMessage.textContent="Saving…";
   try{
    const data=await window.BSEditConflicts.save("/api/projects",{original:{...summaryBaseline},changes,
     extra:{id:project},revision:summaryRevision});
    const saved=data.projects?.find(item=>item.id===project);
    summaryRevision=saved?.summaryRevision??null;
    for(const [key,field] of summaryEntries){
     const value=saved?.[key]??changes[key]?.trim()??summaryBaseline[key];
     summaryBaseline[key]=value;
     if(field.value===draft[key])field.value=value;
    }
    window.BSProjectManager?.updateProjectSummary(project,{...summaryBaseline,summaryRevision});
    renderSummaryOverview();
    summaryMessage.textContent="Summary saved.";
   }catch(error){summaryMessage.textContent=error.message}
   finally{summarySave.disabled=summaryCancel.disabled=false;showSummaryActions()}
  };
  function renderSummaryOverview(){
   const record=window.BSProjectManager?.getProject(project);
   const values={shortSummary:record?.shortSummary??"",summary:record?.summary??record?.description??""};
   shortSummaryText.textContent=values.shortSummary;
   shortSummaryText.hidden=canEdit()||!values.shortSummary;
   shortSummaryLabel.hidden=!canEdit();
   summaryText.textContent=values.summary||"No summary yet.";summaryText.hidden=canEdit();
   summaryInput.hidden=!canEdit();
   if(!hasSummaryChanges()&&!summarySave.disabled){
    for(const [key,field] of summaryEntries){field.value=values[key];summaryBaseline[key]=values[key]}
    summaryRevision=record?.summaryRevision??null;
   }
   showSummaryActions();
   const tags=overview.querySelector(".project-summary-tags");
   tags.replaceChildren(...(record?.tags||[]).map(tag=>{
    const tile=document.createElement("span");tile.textContent=tag;return tile;
   }));
   if(!tags.childElementCount)tags.textContent="No descriptors yet.";
  }
  const rolledUpPart=part=>({...part,quantity:window.BSBomModel.projectQuantity(part,nodes)});
  function createQuantityField(container,{assembly=false,saveQuantity}){
   const row=document.createElement("div");
   row.className="workspace-quantity";
   row.hidden=true;
   row.innerHTML='<label>Quantity <input class="field" type="number" inputmode="decimal" max="10000000" step="any"></label><span class="workspace-quantity-total"></span><span class="muted workspace-quantity-status" role="status"></span>';
   container.append(row);
   const input=row.querySelector("input"),total=row.querySelector(".workspace-quantity-total"),feedback=row.querySelector(".workspace-quantity-status");
   if(assembly){input.step="1";input.min="1";input.inputMode="numeric"}
   let record=null,revision=0;
   const show=value=>{
    revision++;
    record=value;
    row.hidden=!value;
    if(!value)return;
    input.disabled=!canEdit();
    input.value=value.quantity??"";
    total.textContent=value.total||"";
    feedback.textContent="";
   };
   input.onchange=async()=>{
    if(!record||!canEdit())return;
    const quantity=input.value===""?null:input.valueAsNumber;
    if(!input.validity.valid||(quantity!==null&&quantity<=0)||(assembly&&quantity===null)){
     feedback.textContent=assembly?"Enter a whole quantity from 1 to 10,000,000.":"Enter a positive quantity up to 10,000,000, or leave it blank.";
     input.value=record.quantity??"";
     return;
    }
    if(quantity===record.quantity)return;
    const version=revision;
    input.disabled=true;feedback.textContent="Saving…";
    try{
     const saved=await saveQuantity(record.id,quantity,record);
     if(version!==revision)return;
     show(saved);
     feedback.textContent="Saved.";
    }catch(error){
     if(version!==revision)return;
     input.disabled=!canEdit();
     feedback.textContent=error.message;
    }
   };
   return show;
  }
  function renderEstimatedCost(parts){
   const {total,priced,materials,packageTotal,packagePriced,missingQuantity,missingPrice,priceAvailable}=window.BSPartFields.estimateCost(parts);
   const dollars=new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"});
   summaryCost.textContent="Parts used: "+(priced?dollars.format(total)+" · "+priced+" of "+materials+" materials priced":"No priced quantities yet");
   summaryPackageCost.textContent="Whole packages to purchase: "+(packagePriced?dollars.format(packageTotal)+" · "+packagePriced+" of "+materials+" materials priced":"Package prices and quantities are needed");
   summaryCostMissing.textContent=[
    priceAvailable+" of "+materials+" materials have prices; "+priced+" also have project quantities",
    missingQuantity?missingQuantity+" materials need a project quantity":"",
    missingPrice?missingPrice+" materials need a usable price":"",
    priced>packagePriced?(priced-packagePriced)+" priced materials need a package size":""
   ].filter(Boolean).join(" · ");
  }
  const settingsPage=document.createElement("section");
  settingsPage.className="assembly-parts-page project-settings-page hide";
  settingsPage.innerHTML='<button type="button" class="btn project-settings-back">← Project summary</button><h1>Project settings</h1><p class="project-settings-unavailable muted" hidden>Only the project owner can edit these settings.</p>';
  const settingsSection=document.createElement("section");
  settingsSection.className="project-summary-owner-settings";settingsSection.hidden=true;
  settingsPage.append(settingsSection);
  summary.after(settingsPage);
  settingsPage.querySelector(".project-settings-back").onclick=()=>{
   selected=null;history.pushState(null,"","#"+project);render();notify();window.scrollTo(0,0);
  };
  const settingsRoute=()=>location.hash.slice(1)===project+"/settings";
  const settingsEntry=document.createElement("button");
  settingsEntry.type="button";settingsEntry.className="assembly-project-summary-entry assembly-project-settings-entry";
  settingsEntry.textContent="Project Settings";settingsEntry.hidden=true;
  settingsEntry.onclick=()=>{
   selected=null;history.pushState(null,"","#"+project+"/settings");render();notify();window.scrollTo(0,0);
  };

  let summaryPhotos=[],summaryPhotoIndex=0,summaryVersion=0;
  const isProjectSummary=()=>decodeURIComponent(location.hash.slice(1))===project;
  const summaryPhotoStage=summary.querySelector(".project-summary-photo-stage");
  const summaryPhotoBar=window.BSPhotoEditor.actionBar(summaryPhotoStage,{
   onMarkup:()=>{const photo=summaryPhotos[summaryPhotoIndex];if(photo)window.BSPhotoMarkup.open({kind:"gallery",id:photo.id,onSave:()=>void refreshProjectSummary()})},
   onAdd:()=>summaryPhotoInput.click(),
   onPaste:file=>uploadGalleryPhoto(file,summaryPhotoBar),
   onDelete:()=>void deleteGalleryPhoto(summaryPhotos[summaryPhotoIndex],summaryPhotoBar)
  });
  summaryPhotoBar.setEnabled(canEdit());
  const summaryPhotoInput=document.createElement("input");summaryPhotoInput.type="file";summaryPhotoInput.accept="image/*,.heic,.heif";summaryPhotoInput.hidden=true;
  summaryPhotoBar.shell.append(summaryPhotoInput);
  summaryPhotoInput.onchange=()=>{const file=summaryPhotoInput.files?.[0];summaryPhotoInput.value="";if(file)void uploadGalleryPhoto(file,summaryPhotoBar)};
  window.BSPhotoMarkup.dropOn(summaryPhotoStage,file=>{
   selected=null;
   void workspacePhotoController.upload(file);
  },{
   canUpload:canEdit,
   onBlocked:message=>{summary.querySelector(".project-summary-photo-empty").textContent=message||"Sign in as administrator before uploading photos."}
  });
  const displaySummaryPhoto=()=>{
   const photo=summaryPhotos[summaryPhotoIndex],picture=summary.querySelector(".project-summary-photo");
   picture.hidden=!photo;summary.querySelector(".project-summary-photo-empty").hidden=!!photo;
   if(photo){picture.src=window.BSPhotoMarkup.displayUrl("gallery",photo.id);picture.alt=photo.caption||"Project photo"}else picture.removeAttribute("src");
   summary.querySelector(".project-summary-photo-caption").textContent=photo?.caption||"";
   summary.querySelector(".project-summary-photo-position").textContent=summaryPhotos.length?(summaryPhotoIndex+1)+" of "+summaryPhotos.length:"";
   for(const selector of [".project-summary-previous",".project-summary-next"])summary.querySelector(selector).hidden=summaryPhotos.length<2;
   summaryPhotoBar.setPhotoPresent(!!photo);
  };
  const moveSummaryPhoto=step=>{if(!summaryPhotos.length)return;summaryPhotoIndex=(summaryPhotoIndex+step+summaryPhotos.length)%summaryPhotos.length;displaySummaryPhoto()};
  summary.querySelector(".project-summary-previous").onclick=()=>moveSummaryPhoto(-1);
  summary.querySelector(".project-summary-next").onclick=()=>moveSummaryPhoto(1);
  summaryPhotoStage.tabIndex=0;
  summaryPhotoStage.onkeydown=event=>{if(event.key==="ArrowLeft"||event.key==="ArrowRight"){event.preventDefault();moveSummaryPhoto(event.key==="ArrowLeft"?-1:1)}};
  const makeSummaryList=(container,items,emptyText)=>{
   container.replaceChildren();
   if(!items.length){container.append(Object.assign(document.createElement("p"),{className:"muted",textContent:emptyText}));return}
   const list=document.createElement("ul");list.className="project-summary-part-list";
   for(const part of items){
    const row=document.createElement("li"),name=document.createElement(part.id&&/^[0-9a-f-]{36}$/i.test(part.id)&&!part.generatedFrom?"button":"span"),quantity=document.createElement("span");
    name.className="project-summary-part-name";name.textContent=(part.partNumber?part.partNumber+" · ":"")+window.BSPartFields.displayName(part);
    if(name.tagName==="BUTTON"){
     name.type="button";name.classList.add("project-summary-part-link");
     name.setAttribute("aria-label","Open "+part.name+" part page");
     name.onclick=()=>openPartInstructions(part,part.assemblyId??null);
    }
    quantity.className="project-summary-part-quantity";quantity.textContent=window.BSBomModel.quantityText(part);
    row.append(name,quantity);list.append(row);
   }
   container.append(list);
  };
  // Mirror feature-tree hierarchy without changing BOM records or quantities.
  const makeSummaryBomTree=(container,parts)=>{
   const previousOpen=new Set([...container.querySelectorAll("details[data-assembly-id]")].filter(item=>item.open).map(item=>item.dataset.assemblyId));
   container.replaceChildren();
   const included=parts.filter(part=>!part.isTool&&part.itemType!=="document");
   const children=new Map();
   for(const node of nodes){
    if(node.kind==="part")continue;
    const parent=node.parentId??null;
    if(!children.has(parent))children.set(parent,[]);
    children.get(parent).push(node);
   }
   const linkedIds=new Set(nodes.filter(node=>node.kind==="part"&&node.partId).map(node=>node.partId));
   const createParts=(parent,mount)=>{
    const group=included.filter(part=>(part.assemblyId??null)===parent&&!linkedIds.has(part.id));
    const linked=nodes.filter(node=>node.kind==="part"&&(node.parentId??null)===parent).map(node=>included.find(part=>part.id===node.partId)).filter(Boolean);
    const unique=new Map([...group,...linked].map(part=>[part.id,part]));
    if(unique.size){
     const list=document.createElement("ul");list.className="project-summary-part-list";
     for(const part of unique.values()){
      const row=document.createElement("li"),name=document.createElement(part.id&&/^[0-9a-f-]{36}$/i.test(part.id)&&!part.generatedFrom?"button":"span"),quantity=document.createElement("span");
      name.className="project-summary-part-name";name.textContent=(part.partNumber?part.partNumber+" · ":"")+window.BSPartFields.displayName(part);
    if(name.tagName==="BUTTON"){
     name.type="button";name.classList.add("project-summary-part-link");
     name.setAttribute("aria-label","Open "+part.name+" part page");
     name.onclick=()=>openPartInstructions(part,part.assemblyId??null);
    }
      quantity.className="project-summary-part-quantity";quantity.textContent=window.BSBomModel.quantityText(part);
      row.append(name,quantity);list.append(row);
     }
     mount.append(list);
    }
   };
   let count=0;
   const visit=(parent,mount,seen)=>{
    createParts(parent,mount);
    for(const node of children.get(parent)||[]){
     if(seen.has(node.id))continue;
     count++;
     const detail=document.createElement("details");detail.className="project-summary-assembly";detail.dataset.assemblyId=node.id;
     detail.open=previousOpen.has(node.id);
     const heading=document.createElement("summary");
     const title=document.createElement("strong");title.textContent=(node.partNumber?node.partNumber+" · ":"")+(node.name||"Assembly");
     const countLabel=document.createElement("span");countLabel.className="muted";
     const descendants=window.BSBomModel.assemblyIds(nodes,node.id);
     const qty=included.filter(p=>descendants.has(p.assemblyId??null)).length;
     const copies=window.BSBomModel.quantityMultiplier(nodes,node.id);
     countLabel.textContent=(copies>1?copies+" pcs · ":"")+qty+" "+(qty===1?"part":"parts");
     heading.append(title,countLabel);detail.append(heading);
     const body=document.createElement("div");body.className="project-summary-assembly-contents";
     visit(node.id,body,new Set([...seen,node.id]));
     detail.append(body);mount.append(detail);
    }
   };
   visit(null,container,new Set());
   if(!included.length&&!count)container.append(Object.assign(document.createElement("p"),{className:"muted",textContent:"No BOM parts yet."}));
  };
  async function refreshProjectSummary(){
   const version=++summaryVersion;
   summary.querySelector(".project-summary-title").textContent=title;
   summaryPhotoBar.setEnabled(canEdit());
   renderSummaryOverview();
   const bomList=summary.querySelector(".project-summary-bom-items"),toolList=summary.querySelector(".project-summary-tool-items");
   try{
    const [photosResponse,partsResponse]=await Promise.all([
     fetch("/api/photos?project="+encodeURIComponent(project)+"&assembly=project-summary",{credentials:"same-origin",cache:"no-store"}),
     fetch("/api/components?project="+encodeURIComponent(project),{credentials:"same-origin",cache:"no-store"})
    ]);
    if(!photosResponse.ok||!partsResponse.ok)throw Error("Project summary unavailable.");
    const [photoData,partData]=await Promise.all([photosResponse.json(),partsResponse.json()]);
    if(version!==summaryVersion||!isProjectSummary())return;
    const previousPhotoId=summaryPhotos[summaryPhotoIndex]?.id;
    summaryPhotos=(photoData.photos||[]).filter(photo=>photo.assembly==="project-summary"||!photo.assembly);
    summaryPhotoIndex=Math.max(0,summaryPhotos.findIndex(photo=>photo.id===previousPhotoId));
    displaySummaryPhoto();
    // Include generated cutting-list materials, matching the canonical BOM rollup.
    const parts=partData.components||[];
    const rollup=window.BSBomModel.selectWorkspaceParts(parts,nodes,null);
    // Tool status is independent of feature-tree visibility.
    makeSummaryBomTree(bomList,[...rollup.listItems,...rollup.shopItems].map(rolledUpPart));
    renderEstimatedCost(rollup.listItems.map(rolledUpPart));
    makeSummaryList(toolList,parts.filter(part=>part.isTool),"No tools specified yet.");
   }catch(error){
    if(version!==summaryVersion)return;
    bomList.textContent="Could not load project BOM: "+error.message;
    toolList.textContent="Could not load tools.";
    summaryCost.textContent="Cost estimate unavailable.";
    summaryPackageCost.textContent="";summaryCostMissing.textContent="";
   }
  }
  const refreshVisibleSummary=()=>{
   if(isProjectSummary()&&view.classList.contains("active")&&document.visibilityState!=="hidden")void refreshProjectSummary();
  };
  window.addEventListener("focus",refreshVisibleSummary);
  window.addEventListener("bsworkshopupdated",refreshVisibleSummary);
  document.addEventListener("visibilitychange",refreshVisibleSummary);
  // Reuse the canonical BOM panel on its own screen. The editor alone moves
  // into the workspace when editing; no duplicate BOM data or forms.
  const partsPage=document.createElement("section");partsPage.className="assembly-parts-page hide";
  workspace.after(partsPage);
  const bomScreen=document.createElement("section");
  bomScreen.className="assembly-bom-screen hide";
  bomScreen.innerHTML='<div class="assembly-bom-screen-header"><div><button type="button" class="btn assembly-bom-back">← Workspace</button><h1 class="assembly-bom-screen-title">BOM</h1></div><div class="assembly-bom-view-switch" role="group" aria-label="BOM view"><button type="button" class="btn assembly-bom-list is-active" aria-pressed="true">List</button><button type="button" class="btn assembly-bom-pictures" aria-pressed="false">Pictures</button></div></div><div class="assembly-bom-list-view"></div><div class="assembly-bom-picture-view hide"></div>';
  workspace.after(bomScreen);
  let bomView="list";
  const bomPictureMount=bomScreen.querySelector(".assembly-bom-picture-view");
  const setBomView=viewName=>{
   bomView=viewName==="pictures"?"pictures":"list";
   bomScreen.querySelector(".assembly-bom-list-view").classList.toggle("hide",bomView!=="list");
   bomPictureMount.classList.toggle("hide",bomView!=="pictures");
   for(const [kind,selector] of [["list",".assembly-bom-list"],["pictures",".assembly-bom-pictures"]]){
    const button=bomScreen.querySelector(selector);
    button.classList.toggle("is-active",bomView===kind);
    button.setAttribute("aria-pressed",String(bomView===kind));
   }
   if(bomView==="pictures")renderTiles();
  };
  bomScreen.querySelector(".assembly-bom-list").onclick=()=>setBomView("list");
  bomScreen.querySelector(".assembly-bom-pictures").onclick=()=>setBomView("pictures");
  const bomDocumentsLabel=document.createElement("label");
  bomDocumentsLabel.className="assembly-bom-documents-toggle";
  const bomDocumentsCheckbox=document.createElement("input");bomDocumentsCheckbox.type="checkbox";bomDocumentsCheckbox.checked=true;
  bomDocumentsLabel.append(bomDocumentsCheckbox,document.createTextNode(" Documents"));
  bomDocumentsCheckbox.onchange=()=>{showBomDocuments=bomDocumentsCheckbox.checked;void renderWorkspaceParts();renderTiles()};

  const assemblyLayout=view.querySelector(".assembly-layout");
  const sidebar=root;
  const bomPanel=workspace.querySelector(".workspace-bom");
  bomScreen.querySelector(".assembly-bom-list-view").append(bomPanel);
  const purchasingMount=document.createElement("div");purchasingMount.className="bs-bom-purchasing-mount";
  bomScreen.querySelector(".assembly-bom-list-view").append(purchasingMount);
  // Shared BOM toolbar: show view and document controls, without a New part action.
  const bomHeading=bomPanel.querySelector(".workspace-bom-heading");
  const viewSwitch=bomScreen.querySelector(".assembly-bom-view-switch");
  if(bomHeading&&viewSwitch){
   const tools=document.createElement("div");
   tools.className="assembly-bom-heading-actions";
   const newPart=bomHeading.querySelector(".workspace-new-part");
   tools.append(viewSwitch,bomDocumentsLabel);
   // Retain the button only for the existing creation handler, not as a BOM control.
   if(newPart){newPart.hidden=true;newPart.classList.add("hide");}
   bomHeading.append(tools);
   bomScreen.querySelector(".assembly-bom-list-view").before(bomHeading);
  }
  // Keep the established feature-tree styling without nesting workspace content.
  const featureTreeFrame=document.createElement("div");
  featureTreeFrame.className="feature-tree-frame";
  while(sidebar.firstChild)featureTreeFrame.append(sidebar.firstChild);
  // Keep the summary card outside the scrolling tree card, immediately above Parts Management.
  sidebar.append(featureTreeFrame,summaryCard);
  const bomResizer=document.createElement("div");
  bomResizer.className="workspace-bom-resizer";
  bomResizer.setAttribute("role","separator");
  bomResizer.setAttribute("tabindex","0");
  bomResizer.setAttribute("aria-orientation","vertical");
  bomResizer.setAttribute("aria-label","Resize feature tree width");
  bomResizer.title="Drag left or right to resize the feature tree. Arrow keys also work.";
  bomResizer.setAttribute("aria-valuemin","20");
  bomResizer.setAttribute("aria-valuemax","70");
  assemblyLayout.insertBefore(bomResizer,view.querySelector(".assembly-content"));
  const bomWidthKey="bs-feature-tree-width";
  const clampSidebarWidth=value=>{
   const available=assemblyLayout.getBoundingClientRect().width;
   return Math.round(Math.max(220,Math.min(Number(value)||available*.25,Math.max(220,available-390))));
  };
  const setBomWidth=value=>{
   const width=clampSidebarWidth(value);
   assemblyLayout.style.setProperty("--assembly-sidebar-width",width+"px");
   bomResizer.setAttribute("aria-valuenow",String(Math.round(width/assemblyLayout.getBoundingClientRect().width*100)));
   return width;
  };
  try{
   const stored=Number(localStorage.getItem(bomWidthKey));
   if(Number.isFinite(stored)&&stored>0)setBomWidth(stored);
  }catch{/* Storage may be disabled. */}
  let draggingBom=false;
  bomResizer.addEventListener("pointerdown",event=>{
   if(event.button!==0||matchMedia("(max-width:1099px)").matches)return;
   draggingBom=true;
   bomResizer.setPointerCapture(event.pointerId);
   document.body.classList.add("is-resizing-bom");
   event.preventDefault();
  });
  bomResizer.addEventListener("pointermove",event=>{
   if(!draggingBom)return;
   const left=assemblyLayout.getBoundingClientRect().left;
   setBomWidth(event.clientX-left-5);
  });
  const endBomDrag=()=>{
   if(!draggingBom)return;
   draggingBom=false;
   document.body.classList.remove("is-resizing-bom");
   try{localStorage.setItem(bomWidthKey,String(sidebar.getBoundingClientRect().width))}catch{}
  };
  bomResizer.addEventListener("pointerup",endBomDrag);
  bomResizer.addEventListener("pointercancel",endBomDrag);
  bomResizer.addEventListener("lostpointercapture",endBomDrag);
  bomResizer.addEventListener("keydown",event=>{
   if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
   event.preventDefault();
   const available=assemblyLayout.getBoundingClientRect().width;
   const current=sidebar.getBoundingClientRect().width;
   const next=event.key==="Home"?220:event.key==="End"?available-390:
    current+(event.key==="ArrowRight"?32:-32);
   const width=setBomWidth(next);
   try{localStorage.setItem(bomWidthKey,String(width))}catch{}
  });
  // Each saved BOM part has its own independent instructions document.
  const partWorkspace=document.createElement("section");partWorkspace.className="assembly-workspace-page bom-part-workspace hide";
  partWorkspace.innerHTML='<div class="workspace-heading"><div class="workspace-cover part-workspace-cover"><span>No picture yet</span></div><div><h1 class="part-workspace-title">Part instructions</h1></div></div><section class="workspace-panels"><article class="recipe-instructions"><h2>Work instructions</h2></article><article class="part-harness-preview hide"><h2>Wire harness cutting list</h2><div class="part-harness-preview-content"></div></article><article class="part-linked-resources"></article><div class="workspace-actions"><button type="button" class="btn primary part-workspace-save" hidden aria-hidden="true" tabindex="-1">Save workspace</button><span class="part-workspace-status" role="status"></span></div></section>';
  workspace.after(partWorkspace);
  const archiveActions=document.createElement("div");archiveActions.className="workspace-archive-actions";
  const archiveStatus=document.createElement("span");archiveStatus.className="muted workspace-archive-status";
  archiveStatus.setAttribute("role","status");
  const backupButton=(label,readable)=>{
   const button=document.createElement("button");button.type="button";button.className="btn";button.textContent=label;
   button.onclick=async()=>{
    button.disabled=true;archiveStatus.textContent="Preparing backup…";
    try{
     const response=await fetch("/api/project/archive?project="+encodeURIComponent(project),{credentials:"same-origin",cache:"no-store"});
     if(!response.ok){const error=await response.json().catch(()=>({}));throw Error(error.error||"Project export failed")}
     const source=await response.blob();
     const archive=JSON.parse(await source.text());
     if(archive.format!=="building-schmidt-project"||archive.projectId!==project||archive.objectCount!==archive.objects?.length)throw Error("Archive response is incomplete");
     const blob=readable?new Blob([window.BSReadableBackup.build(archive,window.BSProjectManager?.getProject(project)?.name)],{type:"text/html;charset=utf-8"}):source;
     const url=URL.createObjectURL(blob);
     const link=document.createElement("a");link.href=url;
     link.download="building-schmidt-"+project+"-"+new Date().toISOString().slice(0,10)+(readable?".html":".bsproject");
     document.body.append(link);link.click();link.remove();
     setTimeout(()=>URL.revokeObjectURL(url),3000);
     archiveStatus.textContent=readable?"HTML backup downloaded. Open it in any browser, or print it to PDF.":"Project backup downloaded.";
    }catch(error){archiveStatus.textContent="Backup failed: "+error.message}
    finally{button.disabled=false}
   };
   return button;
  };
  archiveActions.append(backupButton("Create project backup",false),backupButton("Create readable backup (HTML)",true),archiveStatus);
  const backupDetails=document.createElement("details");
  backupDetails.className="workspace-backup-details workspace-secondary-disclosure";
  const backupSummary=document.createElement("summary");
  backupSummary.textContent="Project backups";
  backupDetails.append(backupSummary,archiveActions);
  workspace.append(backupDetails);
  const partDrawingPanel=window.BSDrawings?.mount(partWorkspace.querySelector(".part-drawing-panel"),()=>canEdit());
  const partFilesPanel=window.BSPartFiles?.mount(partWorkspace.querySelector(".part-files-panel"),()=>canEdit());

  // Optional progressive disclosure: the textarea remains the simplest authoring tool.
  // Steps, test logs and history never require separate forms or mandatory fields.
  function installInstructionExtras(panel,prefix,onRestoreResources,onRestoreRecipe,ownerId){
   const article=panel.querySelector(".recipe-instructions");
   const logDetails=document.createElement("details");logDetails.className="instruction-log";
   const logSummary=document.createElement("summary");logSummary.textContent="Experiments & decisions";
   const logEntries=document.createElement("div");logEntries.className="instruction-log-entries";
   logDetails.append(logSummary,logEntries);article.append(logDetails);
   let experiments=[];
   const renderLogs=()=>{
    logEntries.replaceChildren();
    for(const entry of experiments){
     const row=document.createElement("div");row.className="instruction-log-item";
     const timestamp=document.createElement("small");timestamp.textContent=new Date(entry.createdAt).toLocaleDateString();
     const text=document.createElement("p");text.textContent=entry.text;
     row.append(timestamp,text);
     if(canEdit()){const remove=document.createElement("button");remove.type="button";remove.className="btn";remove.textContent="Delete";remove.onclick=()=>{experiments=experiments.filter(x=>x.id!==entry.id);renderLogs();scheduleWorkspaceAutosave(prefix==="part"?"part":"assembly")};row.append(remove)}
     logEntries.append(row);
    }
    logDetails.classList.toggle("hide",experiments.length===0);
   };
   const historyDetails=document.createElement("details");historyDetails.className="instruction-history workspace-secondary-disclosure";
   const historySummary=document.createElement("summary");historySummary.textContent="Recent changes";
   const historyList=document.createElement("div");historyList.className="instruction-history-list";
   historyDetails.append(historySummary,historyList);panel.querySelector(prefix==="part"?".part-workspace-save":".workspace-save").after(historyDetails);
   const olderButton=document.createElement("button");
   olderButton.type="button";olderButton.className="instruction-history-restore";olderButton.textContent="Load older changes";
   historyDetails.append(olderButton);
   let olderHistory=null,loadedOwner=null,generation=0;
   olderButton.onclick=async()=>{
    const token=generation;
    if(!olderHistory||loadedOwner!==ownerId())return;
    const params=new URLSearchParams({project,[prefix==="part"?"part":"assembly"]:loadedOwner,historyPage:olderHistory});
    olderButton.disabled=true;
    try{
     const response=await fetch("/api/workspace?"+params,{cache:"no-store"});
     if(!response.ok)throw Error("Unable to load older changes");
     const page=await response.json();
     if(token!==generation||loadedOwner!==ownerId())return;
     appendHistory(page.history);
     olderHistory=page.olderHistory;olderButton.hidden=!olderHistory;
     olderButton.textContent="Load older changes";
    }catch{if(token===generation)olderButton.textContent="Retry loading older changes"}
    finally{if(token===generation)olderButton.disabled=false}
   };
   function appendHistory(entries){
    const history=[...(entries||[])].reverse();
    for(const snapshot of history){
     const item=document.createElement("div");item.className="instruction-history-item";
     const label=document.createElement("span");
     label.textContent=new Date(snapshot.savedAt).toLocaleString();
     item.append(label);
     if(canEdit()){
      const restore=document.createElement("button");restore.type="button";restore.className="instruction-history-restore";restore.textContent="Load this version";
      restore.onclick=()=>{
       if(loadedOwner!==ownerId())return;
       experiments=Array.isArray(snapshot.experiments)?snapshot.experiments.map(x=>({...x})):[];
       renderLogs();onRestoreResources?.(snapshot.resources);onRestoreRecipe?.(snapshot);
       panel.querySelector(prefix==="part"?".part-workspace-status":".workspace-status").textContent="Previous version loaded. Saving…";
       scheduleWorkspaceAutosave(prefix==="part"?"part":"assembly",true);
      };
      item.append(restore);
     }
     historyList.append(item);
    }
   }
   function setData(data){
    generation++;loadedOwner=ownerId();olderHistory=data?.olderHistory;
    olderButton.disabled=false;olderButton.hidden=!olderHistory;olderButton.textContent="Load older changes";
    experiments=Array.isArray(data?.experiments)?data.experiments.map(x=>({...x})):[];
    renderLogs();historyList.replaceChildren();appendHistory(data?.history);
    historyDetails.classList.toggle("hide",!data?.history?.length&&!olderHistory);
   }
   return {setData,getExperiments:()=>experiments};
  }
  let investigations=null,investigationParts=[];
  const workspaceAutosaveTimers={assembly:null,part:null};
  const workspaceAutosaveRecipe={assembly:false,part:false};
  // Workspace data (linked tools and resources) is saved after it changes,
  // while Work Instruction forms retain their explicit Save/Cancel workflow.
  const scheduleWorkspaceAutosave=(scope,includeRecipe=false)=>{
   if(!canEdit())return;
   workspaceAutosaveRecipe[scope] ||= includeRecipe;
   clearTimeout(workspaceAutosaveTimers[scope]);
   workspaceAutosaveTimers[scope]=setTimeout(async()=>{
    workspaceAutosaveTimers[scope]=null;
    const saveRecipe=workspaceAutosaveRecipe[scope];
    workspaceAutosaveRecipe[scope]=false;
    try{
     if(scope==="part"){
      if(partSaveFlight)await partSaveFlight;
      await savePartWorkspace({resourcesOnly:!saveRecipe});
     }else{
      if(assemblySaveFlight)await assemblySaveFlight;
      await saveAssemblyWorkspace({resourcesOnly:!saveRecipe});
     }
    }catch(error){
     const status=scope==="part"?partStatus:workspaceStatus;
     status.textContent="Autosave failed: "+(error.message||"Please retry your change.");
    }
   },650);
  };
  window.addEventListener("beforeunload",event=>{
   if(!workspaceAutosaveTimers.assembly&&!workspaceAutosaveTimers.part)return;
   event.preventDefault();event.returnValue="";
  });
  function mountWorkspaceSections(panel,{scope,ownerId,save,saveInProgress}){
   const instructions=panel.querySelector(".recipe-instructions");
   const recipe=window.BSRecipes?.mount(instructions,{
    admin:canEdit,project,
    renderInvestigations:(step,target,editing,mainTile,onReorder)=>investigations?.showStep(target,step,scope,ownerId(),editing,mainTile,onReorder),
    onStepSelected:stepId=>investigations?.resetStepDisclosures(stepId,scope,ownerId()),
    saveStepEdits:stepId=>investigations?.saveStepEdits(stepId),
    onSave:async()=>{await saveInProgress();return save()}
   });
   const resourcesPanel=panel.querySelector(".workspace-resources,.part-linked-resources");
   resourcesPanel.classList.add("workspace-resources");
   const tools=document.createElement("details");
   tools.className="workspace-resource-disclosure workspace-primary-disclosure";
   const toolsSummary=document.createElement("summary");
   const toolsHeading=document.createElement("h2");toolsHeading.textContent="Helpful tools";
   const toolsActions=document.createElement("div");toolsActions.className="workspace-tool-actions";
   toolsActions.append(toolsHeading,window.BSDialogs.tooltip("About Helpful tools","Link calculators, tools, and Workshop references for this work."));
   const toolsCount=document.createElement("span");toolsCount.className="workspace-record-count";
   const toolsLabel=document.createElement("div");toolsLabel.append(toolsActions,toolsCount);
   toolsSummary.append(toolsLabel);tools.append(toolsSummary,resourcesPanel);
   const history=document.createElement("article");history.className="investigations-panel";
   // Active records live with the workspace; only archived records appear
   // below the divider in Project History.
   const activeRecords=document.createElement("section");activeRecords.className="investigations-active-panel";
   history.activeEntriesHost=activeRecords;
   instructions.after(tools);
   const divider=document.createElement("hr");divider.className="workspace-history-divider";
   panel.querySelector(".workspace-panels").after(activeRecords,divider,history);
   const resources=window.BSResources?.mount(resourcesPanel,{addTo:toolsActions,onChange:()=>scheduleWorkspaceAutosave(scope),onCount:count=>{
    toolsCount.textContent="("+count+(count===1?" record)":" records)");
    tools.classList.toggle("is-empty",count===0);
   }});
   const extras=installInstructionExtras(panel,scope==="part"?"part":"workspace",
    data=>resources?.setData(data,canEdit()),data=>recipe?.setData(data),ownerId);
   return {recipe,history,resources,extras};
  }
  const {recipe:assemblyRecipe,history:assemblyInvestigationPanel,resources:assemblyResourcePicker,extras:assemblyExtras}=
   mountWorkspaceSections(workspace,{scope:"assembly",ownerId:()=>selected??"__root__",save:saveAssemblyWorkspace,saveInProgress:()=>assemblySaveFlight});
  const {recipe:partRecipe,history:partInvestigationPanel,resources:partResourcePicker,extras:partExtras}=
   mountWorkspaceSections(partWorkspace,{scope:"part",ownerId:()=>partRoute(),save:savePartWorkspace,saveInProgress:()=>partSaveFlight});
  investigations=window.BSInvestigations?.mount({project,admin:()=>canEdit(),getTree:()=>nodes,
   getPart:()=>currentPartInfo,getPartList:()=>investigationParts,
    onReplacePart:()=>detailsPanel.querySelector(".part-details-edit")?.click()});
  const creatorInsightsTarget=document.createElement("div");
  creatorInsightsTarget.className="creator-feedback-target";
  // Creator feedback is mounted at the end of the summary, after the notes and settings.
  if(canEdit())window.BSMyBuild?.insights(creatorInsightsTarget,{project});
  // A single feedback control on each Work Instructions section.
  const instructionsFeedback=(panel,scope)=>window.BSMyBuild?.reportControl(panel.querySelector(".recipe-instructions"),{project,scope});
  instructionsFeedback(workspace,()=> "section:instructions_"+(selected||"root"));
  instructionsFeedback(partWorkspace,()=> "section:instructions_"+(partRoute()||"root"));

  const detailsPanel=document.createElement("section");detailsPanel.className="part-details-view";
  detailsPanel.innerHTML='<details class="part-details-collapse"><summary class="part-details-view-heading"><div class="part-details-heading-copy"><h2>Part details</h2><span class="part-details-summary-fields"></span></div></summary><div class="part-details-view-rows"></div><div class="part-details-view-actions"><button type="button" class="btn part-details-edit">Edit part details</button></div><div class="part-drawing-panel"></div><div class="part-files-panel"></div></details>';
  const partDetailsCollapse=detailsPanel.querySelector(".part-details-collapse");
  // Edit belongs beside the heading, not at the bottom of the expanded details.
  const detailEditButton=detailsPanel.querySelector(".part-details-edit");
  const editWorkshopButton=document.createElement("button");
  editWorkshopButton.type="button";
  editWorkshopButton.className="btn part-details-edit-workshop";
  editWorkshopButton.textContent="View in Workshop";
  editWorkshopButton.hidden=true;
  let currentDocumentation=[];
  const documentationButton=document.createElement("button");
  documentationButton.type="button";documentationButton.className="btn part-details-edit-workshop part-documentation-button";
  documentationButton.textContent="Documentation";documentationButton.hidden=true;
  const documentationDialog=document.createElement("dialog");
  documentationDialog.className="project-manage-dialog part-documentation-dialog";
  documentationDialog.setAttribute("aria-label","Part documentation");
  documentationButton.onclick=event=>{
   event.preventDefault();event.stopPropagation();
   const links=currentDocumentation;
   if(links.length===1){window.open(links[0].url,"_blank","noopener,noreferrer");return}
   if(!links.length)return;
   documentationDialog.replaceChildren();
   const title=document.createElement("h2");title.textContent="Documentation";
   const list=document.createElement("ul");
   for(const entry of links){
    const item=document.createElement("li"),link=document.createElement("a");
    link.href=entry.url;link.target="_blank";link.rel="noopener noreferrer";
    link.textContent=entry.label+" · "+new URL(entry.url).hostname;
    item.append(link);list.append(item);
   }
   const close=document.createElement("button");close.type="button";close.className="btn";close.textContent="Close";
   close.onclick=()=>documentationDialog.close();
   documentationDialog.append(title,list,close);documentationDialog.showModal();
  };
  view.append(documentationDialog);

  detailEditButton.hidden=true;
  const reloadWorkshopButton=document.createElement("button");
  reloadWorkshopButton.type="button";
  reloadWorkshopButton.className="btn part-details-edit";
  reloadWorkshopButton.textContent="Reload Workshop data";
  reloadWorkshopButton.hidden=true;
  const reloadWorkshopStatus=document.createElement("p");
  reloadWorkshopStatus.setAttribute("role","status");
  reloadWorkshopStatus.hidden=true;
  const detailHeading=detailsPanel.querySelector(".part-details-view-heading");
  // Keep the linked-part actions beside the Part details heading.
  // Collapsed sections hide both actions through the existing heading styles.
  detailHeading.append(detailEditButton);
  detailHeading.insertBefore(editWorkshopButton,detailEditButton);
  detailHeading.insertBefore(documentationButton,detailEditButton);
  detailEditButton.textContent="Modify part";
  detailHeading.append(reloadWorkshopButton);
  detailsPanel.querySelector(".part-details-view-actions").replaceWith(reloadWorkshopStatus);
  partDetailsCollapse.addEventListener("toggle",()=>{
   if(partDetailsCollapse.open&&currentPartInfo){
    detailEditButton.hidden=!canEdit();
    reloadWorkshopButton.hidden=!canEdit()||!workshopLinkId(currentPartInfo)||!!currentPartInfo.generatedFrom;
   }
  });
  const detailRows=detailsPanel.querySelector(".part-details-view-rows");
  const detailSummary=detailsPanel.querySelector(".part-details-summary-fields");
  const progressPanel=document.createElement("section");progressPanel.className="part-progress-panel";
  progressPanel.innerHTML='<label class="part-progress-inline-label" for="part-progress-select-'+project+'">Status</label><select id="part-progress-select-'+project+'" class="field part-progress-select" aria-label="Status"><option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="complete">Complete</option></select><label class="part-attention-toggle"><input type="checkbox" class="part-needs-attention"> Needs attention</label><label class="part-attention-note-field" hidden>What needs to be fixed?<textarea class="field part-attention-note" rows="2" maxlength="2000" placeholder="What needs attention?"></textarea></label><span class="part-progress-feedback" role="status" aria-live="polite"></span><button type="button" class="part-progress-save" hidden>Save status</button>';
  partWorkspace.querySelector(".workspace-heading > div:not(.workspace-cover)").append(progressPanel);
  partWorkspace.querySelector(".workspace-heading").after(detailsPanel);
  const codeHost=document.createElement("div");codeHost.className="part-source-code-host";detailsPanel.after(codeHost);
  const codePanel=window.BSPartCode.mount(codeHost,{project,canEdit});
  const progressSelect=progressPanel.querySelector(".part-progress-select"),attentionCheckbox=progressPanel.querySelector(".part-needs-attention"),attentionText=progressPanel.querySelector(".part-attention-note");
  function installAttentionExpander(panel){
   const field=panel.querySelector(".part-attention-note-field");
   const button=document.createElement("button");
   button.type="button";button.className="btn attention-note-expand";
   const textarea=field.querySelector("textarea");
   textarea.id=project+(panel===progressPanel?"-part":"-assembly")+"-attention-note";
   button.setAttribute("aria-controls",textarea.id);
   const setExpanded=expanded=>{
    panel.classList.toggle("attention-note-expanded",expanded);
    button.setAttribute("aria-expanded",String(expanded));
    button.textContent=expanded?"Minimize":"Expand";
    button.setAttribute("aria-label",expanded?"Minimize attention note":"Expand attention note");
   };
   setExpanded(false);
   button.onclick=()=>setExpanded(!panel.classList.contains("attention-note-expanded"));
   field.after(button);
   return ()=>setExpanded(false);
  }
  // Assembly status uses its own record rather than rewriting the tree or instructions.
  const assemblyProgressPanel=progressPanel.cloneNode(true);
  assemblyProgressPanel.classList.add("assembly-progress-panel");
  assemblyProgressPanel.hidden=true;
  const assemblyProgressSelect=assemblyProgressPanel.querySelector(".part-progress-select");
  assemblyProgressSelect.id="assembly-progress-select-"+project;
  assemblyProgressPanel.querySelector(".part-progress-inline-label").htmlFor=assemblyProgressSelect.id;
  const assemblyAttention=assemblyProgressPanel.querySelector(".part-needs-attention");
  const assemblyAttentionNote=assemblyProgressPanel.querySelector(".part-attention-note");
  const assemblyProgressFeedback=assemblyProgressPanel.querySelector(".part-progress-feedback");
  const assemblyAttentionField=assemblyProgressPanel.querySelector(".part-attention-note-field");
  workspace.querySelector(".workspace-title-group").append(assemblyProgressPanel);
  const assemblyQuantityDisplay=node=>{
   const quantity=window.BSBomModel.assemblyQuantity(node);
   const total=window.BSBomModel.quantityMultiplier(nodes,node.id);
   return {id:node.id,quantity,total:total!==quantity?total+" pcs in project":""};
  };
  const showAssemblyQuantity=createQuantityField(workspace.querySelector(".workspace-title-group"),{
   assembly:true,
   saveQuantity:async(id,quantity)=>{
    await save(nodes.map(node=>node.id===id?{...node,quantity}:node),refreshBom);
    return assemblyQuantityDisplay(nodes.find(node=>node.id===id));
   }
  });
  const partQuantityDisplay=part=>{
   const rolledUp=rolledUpPart(part);
   return {id:part.id,revision:part.revision??null,quantity:part.quantity??null,total:rolledUp.quantity!==part.quantity
    ?window.BSBomModel.quantityText(rolledUp)+" in project":part.quantityUnit||"pcs"};
  };
  const showPartQuantity=createQuantityField(progressPanel.parentElement,{
   saveQuantity:async(id,quantity,record)=>{
    const data=await window.BSEditConflicts.save("/api/components?project="+encodeURIComponent(project)+"&id="+encodeURIComponent(id),
     {original:record,changes:{quantity},revision:currentPartInfo?.id===id&&currentPartInfo.quantity===record.quantity
      ?currentPartInfo.revision??null:record.revision,active:()=>currentPartInfo?.id===id});
    syncPartNodes([data.component]);
    if(currentPartInfo?.id===id){
     currentPartInfo=data.component;
     renderPartDetails(data.component);
    }
    refreshBom();
    return partQuantityDisplay(data.component);
   }
  });
  const resetPartAttention=installAttentionExpander(progressPanel);
  const resetAssemblyAttention=installAttentionExpander(assemblyProgressPanel);
  let assemblyStatusId=null,assemblyStatusVersion=0,assemblyStatusQueue=Promise.resolve();
  let assemblyStatusRecord=null;
  const assemblyStatusUrl=id=>"/api/tree?project="+encodeURIComponent(project)+"&statusAssembly="+encodeURIComponent(id);
  async function loadAssemblyStatus(){
   const id=selected;
   if(assemblyStatusId===id&&id!==null)return;
   assemblyStatusId=id;assemblyStatusRecord=null;resetAssemblyAttention();
   const version=++assemblyStatusVersion;
   assemblyProgressPanel.hidden=true;assemblyProgressFeedback.textContent="";
   if(id===null)return;
   try{
    await assemblyStatusQueue.catch(()=>{});
    const response=await fetch(assemblyStatusUrl(id),{credentials:"same-origin",cache:"no-store"});
    const data=await response.json();
    if(!response.ok)throw Error(data.error||"Unable to load status");
    if(version!==assemblyStatusVersion||selected!==id)return;
    assemblyStatusRecord={...data.status,revision:data.revision??null};
    assemblyProgressSelect.value=data.status.progressStatus;
    assemblyAttention.checked=data.status.needsAttention;
    assemblyAttentionNote.value=data.status.attentionNote;
    assemblyAttentionField.hidden=!assemblyAttention.checked;
    assemblyProgressSelect.disabled=!canEdit();
    assemblyAttention.disabled=!canEdit();
    assemblyAttentionNote.readOnly=!canEdit();
    assemblyProgressPanel.hidden=false;
   }catch(error){if(version===assemblyStatusVersion){assemblyProgressPanel.hidden=false;assemblyProgressSelect.disabled=true;assemblyAttention.disabled=true;assemblyAttentionNote.readOnly=true;assemblyProgressFeedback.textContent=error.message;assemblyStatusId=null}}
  }
  function saveAssemblyStatus(event){
   const id=assemblyStatusId,version=assemblyStatusVersion;
   const record=assemblyStatusRecord;
   if(!id||!record||!canEdit())return;
   const body={progressStatus:assemblyProgressSelect.value,needsAttention:assemblyAttention.checked,attentionNote:assemblyAttentionNote.value};
   assemblyAttentionField.hidden=!assemblyAttention.checked;
   if(!assemblyAttention.checked)resetAssemblyAttention();
   assemblyProgressFeedback.textContent="Saving…";
   const field=event.target===assemblyProgressSelect?"progressStatus":event.target===assemblyAttention?"needsAttention":"attentionNote";
   assemblyStatusQueue=assemblyStatusQueue.catch(()=>{}).then(async()=>{
    const active=()=>assemblyStatusVersion===version&&assemblyStatusId===id;
    const data=await window.BSEditConflicts.save(assemblyStatusUrl(id),{original:{...record},changes:{[field]:body[field]},active});
    Object.assign(record,data.status,{revision:data.revision??null});
    if(active()){
     if(assemblyProgressSelect.value===body.progressStatus)assemblyProgressSelect.value=data.status.progressStatus;
     if(assemblyAttention.checked===body.needsAttention)assemblyAttention.checked=data.status.needsAttention;
     if(assemblyAttentionNote.value===body.attentionNote)assemblyAttentionNote.value=data.status.attentionNote;
     assemblyAttentionField.hidden=!assemblyAttention.checked;
     window.BSTransient?.show(assemblyProgressFeedback,"Saved.");
    }
   }).catch(error=>{if(assemblyStatusVersion===version&&assemblyStatusId===id)assemblyProgressFeedback.textContent=error.message});
  }
  assemblyProgressSelect.addEventListener("change",saveAssemblyStatus);
  assemblyAttention.addEventListener("change",saveAssemblyStatus);
  assemblyAttentionNote.addEventListener("change",saveAssemblyStatus);
  assemblyAttentionNote.addEventListener("blur",()=>{if(assemblyAttentionNote.value!==assemblyAttentionNote.defaultValue)assemblyAttentionNote.defaultValue=assemblyAttentionNote.value});
  const refreshAttentionForm=()=>{progressPanel.querySelector(".part-attention-note-field").hidden=!attentionCheckbox.checked};
  let partStatusTimer=null,partStatusSavePromise=null,partStatusChangeVersion=0;
  const schedulePartStatusSave=(immediate=false)=>{
   clearTimeout(partStatusTimer);
   if(!canEdit()||!currentPartInfo)return;
   partStatusChangeVersion++;
   partStatusTimer=setTimeout(()=>{void savePartProgress()},immediate?0:650);
  };
  progressSelect.addEventListener("change",()=>schedulePartStatusSave(true));
  attentionCheckbox.addEventListener("change",()=>{if(!attentionCheckbox.checked)resetPartAttention();refreshAttentionForm();schedulePartStatusSave(true)});
  attentionText.addEventListener("input",()=>schedulePartStatusSave());
  const fillProgressPanel=part=>{
   if(!part.needsAttention)resetPartAttention();
   progressSelect.value=part.progressStatus||"not_started";
   attentionCheckbox.checked=part.needsAttention===true;attentionText.value=part.attentionNote||"";refreshAttentionForm();
   progressPanel.classList.toggle("is-flagged",part.needsAttention===true);
   progressSelect.disabled=!canEdit();
   attentionCheckbox.disabled=!canEdit();
   attentionText.readOnly=!canEdit();
  };
  async function savePartProgress(){
   if(!canEdit()||!currentPartInfo)return;
   if(partStatusSavePromise){await partStatusSavePromise;return}
   const id=currentPartInfo.id,version=partStatusChangeVersion;
   const changes={progressStatus:progressSelect.value,needsAttention:attentionCheckbox.checked,attentionNote:attentionText.value.trim()};
   const feedback=progressPanel.querySelector(".part-progress-feedback");
   feedback.textContent="Saving…";
   partStatusSavePromise=(async()=>{
    const data=await window.BSEditConflicts.save("/api/components?project="+encodeURIComponent(project)+"&id="+encodeURIComponent(id),
     {original:currentPartInfo,changes,active:()=>currentPartInfo?.id===id});
    partQuantities.set(id,data.component);
    partProgress.set(id,data.component.progressStatus);partAttention.set(id,data.component.needsAttention===true);
    if(currentPartInfo?.id===id){
     currentPartInfo=data.component;
     if(version===partStatusChangeVersion){fillProgressPanel(data.component);window.BSTransient?.show(feedback,"Saved.")}
     render();
    }
   })();
   try{await partStatusSavePromise}
   catch(error){if(currentPartInfo?.id===id)feedback.textContent=error.message}
   finally{
    partStatusSavePromise=null;
    if(currentPartInfo?.id===id&&version!==partStatusChangeVersion)schedulePartStatusSave(true);
   }
  }
  const renderPartDetails=part=>{
   detailRows.replaceChildren();
   currentDocumentation=window.BSPartFields.documentationLinks({
    ...part,workshopDocumentation:part.workshopDocumentation??currentDocumentation
   });
   documentationButton.hidden=currentDocumentation.length===0;
   const fields=window.BSPartFields.detailRows(part);
   const values=new Map(fields);
   const quantity=part.quantity==null?"":"Qty "+values.get("Quantity");
   const sourcing=window.BSPartFields.sourcingFor(part);
   const {unitCost}=sourcing;
   let cost="";
   if(unitCost!==null){
    const dollars=new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:4});
    cost=dollars.format(unitCost)+" per unit";
    if(part.quantity!=null&&Number.isFinite(Number(part.quantity)))
     cost+=" · "+dollars.format(Number(unitCost)*Number(part.quantity))+" total";
   }
   const summary=[window.BSPartFields.displayName(part),treeDescription(part.projectDetails,part.description),quantity,cost];
   detailSummary.textContent=summary.filter(Boolean).join(" · ");
   const makeDetailLine=(title,value,isLink=false)=>{
    const line=document.createElement("details");line.className="part-details-view-row part-detail-item";
    const heading=document.createElement("summary");heading.className="part-detail-item-toggle";
    const label=document.createElement("strong");label.textContent=title;
    heading.append(label);
    const body=document.createElement("div");body.className="part-detail-item-content";
    const content=document.createElement(isLink?"a":"span");content.textContent=String(value);
    if(isLink){content.href=value;content.target="_blank";content.rel="noopener noreferrer";content.className="part-order-url"}
    body.append(content);line.append(heading,body);
    return line;
   };
   const appendDetail=(title,value,isLink=false)=>{
    if(value===null||value===undefined||String(value).trim()==="")return;
    detailRows.append(makeDetailLine(title,value,isLink));
   };
   for(const [title,value] of fields)appendDetail(title,value);
   appendDetail("Order URL",sourcing.url,true);
   const specs=(part.specifications||[]).filter(spec=>!window.BSPartFields.isPurchased(part)||!window.BSPartFields.sourcingLabels.includes(spec.name)&&spec.name!=="Supplier part number");
   if(specs.length){
    const heading=document.createElement("h3");heading.textContent="Specifications";detailRows.append(heading);
    for(const spec of specs){
     detailRows.append(makeDetailLine(spec.name||"Specification",(spec.value||"")+(spec.source==="inferred"?" (inferred)":"")));
    }
   }
   const annotations=part.projectDetails||{};
   if(Object.values(annotations).some(Boolean)){
    const projectSection=document.createElement("section");
    projectSection.className="part-project-only-view";
    const title=document.createElement("h3");title.textContent="Project-specific information";
    const notice=document.createElement("p");notice.className="part-project-only-warning";
    notice.textContent="These notes and schematic details apply only to this project; they do not modify the Workshop reference.";
    projectSection.append(title,notice);
    for(const [key,label] of [
     ["notes","Project notes"],["changes","Project changes / modifications"],
     ["featureTreeName","Feature tree name"],
     ["referenceDesignators","Reference designators"],["footprint","Footprint"],
     ["schematicValue","Schematic value"],["sourceApplication","Source application"],
     ["sourceFile","Source schematic file"],["sourceComponentId","Source component ID"]
    ]){
     if(!annotations[key])continue;
     projectSection.append(makeDetailLine(label,annotations[key]));
    }
    detailRows.append(projectSection);
   }
   window.BSPartSuppliers?.renderLinks(detailRows,part);
   detailsPanel.classList.remove("hide");
  };

  let currentPartInfo=null;
  const pictureCover=partWorkspace.querySelector(".part-workspace-cover");
  const partPhotoActions=window.BSPhotoEditor.actionBar(pictureCover,{
   onMarkup:()=>{if(currentPartInfo?.id)window.BSPhotoMarkup.open({kind:"part",id:currentPartInfo.id,project,onSave:()=>showPartPicture(currentPartInfo.id,true)})},
   onAdd:()=>directPartPhotoInput.click(),
   onPaste:uploadPartPicture,
   onDelete:()=>void deletePartPicture()
  });
  const directPartPhotoInput=document.createElement("input");directPartPhotoInput.type="file";directPartPhotoInput.accept="image/jpeg,image/png,image/webp";directPartPhotoInput.hidden=true;
  partPhotoActions.shell.append(directPartPhotoInput);
  directPartPhotoInput.onchange=()=>{const file=directPartPhotoInput.files?.[0];directPartPhotoInput.value="";if(file)void uploadPartPicture(file)};
  partPhotoActions.setEnabled(false);
  const partPhotoDialog=window.BSPhotoEditor.dialog({
   parent:partWorkspace,label:"Edit part image",
   className:"workspace-photo-dialog part-photo-dialog",doneClass:"part-photo-done",
   contentHtml:'<div class="workspace-photos-editor is-editing-photo"><h2>Part image</h2><p class="muted">Add, replace, or delete this part photo.</p><div class="assembly-unified-photo"><div class="part-photo-stage"><img class="part-photo-preview" alt="Part image"><span class="part-photo-placeholder">No picture yet</span></div></div><div class="workspace-photo-tools"><div class="part-photo-actions"><button type="button" class="btn part-photo-add">+ Add / replace image</button><button type="button" class="btn part-photo-markup">Crop / annotate</button><button type="button" class="btn part-photo-delete">Delete image</button><input class="part-photo-file" type="file" accept="image/jpeg,image/png,image/webp" hidden></div></div><p class="part-photo-status muted" role="status" aria-live="polite"></p></div>'
  });
  const partPhotoFile=partPhotoDialog.querySelector(".part-photo-file");
  const partPhotoAdd=partPhotoDialog.querySelector(".part-photo-add");
  const partPhotoDelete=partPhotoDialog.querySelector(".part-photo-delete");
  const partPhotoMarkup=partPhotoDialog.querySelector(".part-photo-markup");
  const partPhotoPreview=partPhotoDialog.querySelector(".part-photo-preview");
  const partPhotoPlaceholder=partPhotoDialog.querySelector(".part-photo-placeholder");
  const partPhotoStatus=partPhotoDialog.querySelector(".part-photo-status");
  let partPictureLoad=0;
  function showPartPictureFallback(){
   const fallback=defaultPartPicture(currentPartInfo);
   if(fallback){
    const image=document.createElement("img");
    image.src=fallback;image.alt=currentPartInfo.partType==="code"?"Default code picture":"Default document picture";
    pictureCover.replaceChildren(image);
   }else pictureCover.replaceChildren(Object.assign(document.createElement("span"),{textContent:"No picture yet"}));
  }
  function showPartPicture(partId,bust=false){
   if(!partId)return;
   const load=++partPictureLoad;
   const src=window.BSPhotoMarkup.displayUrl("part",partId,project)+(bust?"&v="+Date.now():"");
   const image=document.createElement("img");image.src=src;image.alt=currentPartInfo?.name||"Part image";
   partPhotoPreview.hidden=true;partPhotoPreview.removeAttribute("src");partPhotoPlaceholder.hidden=false;partPhotoMarkup.disabled=true;partPhotoActions.setPhotoPresent(false);
   image.onload=()=>{
    if(load!==partPictureLoad||currentPartInfo?.id!==partId)return;
    const main=document.createElement("img");main.src=src;main.alt=image.alt;
    pictureCover.replaceChildren(main);
    partPhotoPreview.src=src;partPhotoPreview.hidden=false;partPhotoPlaceholder.hidden=true;
    partPhotoDelete.disabled=false;partPhotoMarkup.disabled=false;partPhotoActions.setPhotoPresent(true);
   };
   image.onerror=()=>{
    if(load!==partPictureLoad||currentPartInfo?.id!==partId)return;
    showPartPictureFallback();
    partPhotoPreview.hidden=true;partPhotoPreview.removeAttribute("src");
    partPhotoPlaceholder.hidden=false;partPhotoDelete.disabled=true;partPhotoMarkup.disabled=true;partPhotoActions.setPhotoPresent(false);
   };
  }
  partPhotoAdd.onclick=()=>partPhotoFile.click();
  partPhotoMarkup.onclick=()=>{if(currentPartInfo&&canEdit())window.BSPhotoMarkup.open({kind:"part",id:currentPartInfo.id,project,onSave:()=>showPartPicture(currentPartInfo.id,true)})};
  window.BSPhotoMarkup.pasteOn(partPhotoDialog,file=>uploadPartPicture(file));
  window.BSPhotoMarkup.dropOn(partPhotoDialog,file=>uploadPartPicture(file),{
   canUpload:()=>canEdit()&&!!currentPartInfo,
   onBlocked:message=>{partPhotoStatus.textContent=message||"Sign in as administrator before uploading photos."}
  });
  window.BSPhotoMarkup.dropOn(pictureCover,file=>uploadPartPicture(file),{
   canUpload:()=>canEdit()&&!!currentPartInfo,
   onBlocked:message=>{partPhotoStatus.textContent=message||"Sign in as administrator before uploading photos."}
  });
  partPhotoFile.onchange=()=>void uploadPartPicture(partPhotoFile.files?.[0]);
  async function uploadPartPicture(file){
   const partId=currentPartInfo?.id;
   if(!file||!partId||!canEdit())return;
   const mime=file.type||({jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp"}[file.name.split(".").pop().toLowerCase()]||"");
   if(!["image/jpeg","image/png","image/webp"].includes(mime)||file.size>3*1024*1024){
    partPhotoStatus.textContent="Choose JPG, PNG, or WebP under 3 MB.";partPhotoActions.setStatus(partPhotoStatus.textContent);return;
   }
   partPhotoAdd.disabled=true;partPhotoStatus.textContent="Uploading picture…";partPhotoActions.setStatus("Uploading photo…");
   try{
    const response=await fetch(partPhotoUrl(partId),{method:"POST",credentials:"same-origin",headers:{"content-type":mime},body:file});
    const data=await response.json();if(!response.ok)throw Error(data.error||"Upload failed");
    if(currentPartInfo?.id===partId){showPartPicture(partId,true);partPhotoStatus.textContent="Picture saved.";partPhotoActions.setStatus("Photo saved.")}
   }catch(error){partPhotoStatus.textContent=error.message||"Upload failed";partPhotoActions.setStatus(partPhotoStatus.textContent)}
   finally{partPhotoAdd.disabled=false;partPhotoFile.value=""}
  }
  async function deletePartPicture(){
   const partId=currentPartInfo?.id;
   if(!partId||!canEdit()||!await window.BSDialogs.danger("Delete this part picture? The BOM part and instructions remain.",{title:"Delete part picture?"}))return;
   partPhotoDelete.disabled=true;partPhotoStatus.textContent="Deleting picture…";partPhotoActions.setStatus("Deleting photo…");
   try{
    const response=await fetch(partPhotoUrl(partId),{method:"DELETE",credentials:"same-origin"});
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(result.error||"Picture deletion failed");
    if(currentPartInfo?.id===partId){
     showPartPictureFallback();
     partPhotoPreview.hidden=true;partPhotoPreview.removeAttribute("src");
     partPhotoPlaceholder.hidden=false;partPhotoMarkup.disabled=true;partPhotoActions.setPhotoPresent(false);partPhotoStatus.textContent="Picture deleted.";partPhotoActions.setStatus("Photo deleted.");
    }
   }catch(error){partPhotoStatus.textContent=error.message||"Delete failed";partPhotoActions.setStatus(partPhotoStatus.textContent);partPhotoDelete.disabled=false}
  }
  const {workshopLinkId}=window.BSResources;
  editWorkshopButton.onclick=event=>{
   event.preventDefault();event.stopPropagation();
   const workshopId=workshopLinkId(currentPartInfo);
   if(!workshopId)return;
   // Switch to the Workshop's item page; only saving inside Workshop edits the reference.
   const url=new URL(location.href);
   url.searchParams.set("workshop-item",workshopId);
   url.searchParams.set("workshop-return",location.hash);
   url.searchParams.set("workshop-return-y",String(Math.max(0,Math.round(window.scrollY))));
   url.hash="commonparts";
   history.pushState({workshopItem:workshopId},"",url.pathname+url.search+url.hash);
   window.dispatchEvent(new Event("hashchange"));
  };
  reloadWorkshopButton.onclick=async event=>{
   event.preventDefault();event.stopPropagation();
   const part=currentPartInfo;
   if(!part||!canEdit()||!workshopLinkId(part)||reloadWorkshopButton.disabled)return;
   reloadWorkshopButton.disabled=true;
   try{
    if(!await window.BSDialogs.danger(
     "Replace this part’s details with the current Workshop data? Project edits to its part details, status and photo will be cleared. If the Workshop item has no photo, the current photo will be removed.",
     {title:"Reload Workshop data?",confirmLabel:"Reload Workshop data"}))return;
    reloadWorkshopStatus.hidden=false;
    reloadWorkshopStatus.textContent="Reloading Workshop data…";
    const response=await fetch("/api/components?project="+encodeURIComponent(project)+"&id="+encodeURIComponent(part.id),{
     method:"PATCH",credentials:"same-origin",headers:{"content-type":"application/json"},
     body:JSON.stringify({reloadWorkshop:true,expectedRevision:part.revision??null})
    });
    const data=await response.json();
    if(!response.ok)throw Error(data.error||"Unable to reload Workshop data.");
    syncPartNodes([data.component]);
    if(partRoute()!==part.id)return;
    await showPartWorkspace({keepDetailsOpen:true});
    if(partRoute()===part.id){
     reloadWorkshopStatus.hidden=false;
     reloadWorkshopStatus.textContent="Workshop data reloaded.";
    }
    view.querySelectorAll(".component-section").forEach(section=>section.dispatchEvent(new Event("assemblychange")));
   }catch(error){
    if(partRoute()===part.id){
     reloadWorkshopStatus.hidden=false;reloadWorkshopStatus.textContent=error.message;
    }
   }finally{reloadWorkshopButton.disabled=false}
  };
  detailEditButton.onclick=event=>{
   event.preventDefault();event.stopPropagation();
   const part=currentPartInfo;if(!part)return;
   const linked=nodes.find(n=>isPartNode(n)&&n.partId===part.id);
   selected=linked?linked.parentId:(part.assemblyId??null);
   partEditReturn={id:part.id,scrollY:window.scrollY};
   partBackAssembly=selected;
   history.pushState(null,"","#"+project+"/workspace/"+encodeURIComponent(selected??"__root__"));
   render();notify();
   editBomPart(part,selected);
   window.scrollTo(0,0);
  };


  const partRoute=()=>location.hash.slice(1).match(new RegExp("^"+project+"/part/([0-9a-f-]{36})$","i"))?.[1]||null;
  let partLoadVersion=0,partBackAssembly=null,partEditReturn=null;
  function returnToEditedPart(){
   if(!partEditReturn)return;
   const id=partEditReturn.id;
   history.replaceState(null,"","#"+project+"/part/"+encodeURIComponent(id));
   render();notify();
  }
  const partStatus=partWorkspace.querySelector(".part-workspace-status");
  let partSavedRevision=null;
  async function showPartWorkspace({keepDetailsOpen=false}={}){
   const partId=partRoute();if(!partId)return;
   const version=++partLoadVersion;
   detailEditButton.hidden=!canEdit();
   editWorkshopButton.hidden=true;documentationButton.hidden=true;currentDocumentation=[];
   if(documentationDialog.open)documentationDialog.close();
   reloadWorkshopButton.hidden=true;reloadWorkshopStatus.hidden=true;
   detailEditButton.textContent="Edit part details";
   partWorkspace.classList.remove("hide");workspace.classList.add("hide");main.classList.add("hide");detail.classList.add("hide");
   const heading=partWorkspace.querySelector(".part-workspace-title"),cover=partWorkspace.querySelector(".part-workspace-cover");
   if(partPhotoDialog.open)partPhotoDialog.close();partPhotoActions.setEnabled(false);partPhotoActions.collapse();
   clearTimeout(partStatusTimer);partStatusChangeVersion++;progressPanel.hidden=true;heading.textContent="Loading part…";currentPartInfo=null;partSavedRevision=null;partStatus.textContent="Loading instructions…";partDetailsCollapse.open=false;resetPartAttention();
   detailRows.replaceChildren();detailsPanel.classList.add("hide");
   showPartQuantity(null);
   partRecipe?.setLoading(true);
   partWorkspace.querySelector(".part-harness-preview").classList.add("hide");
   cover.replaceChildren();
   const placeholder=document.createElement("span");placeholder.textContent="No picture yet";cover.append(placeholder);
   try{
    const [partResponse,response]=await Promise.all([fetch("/api/components?project="+encodeURIComponent(project),{cache:"no-store"}),fetch("/api/workspace?project="+encodeURIComponent(project)+"&part="+encodeURIComponent(partId),{cache:"no-store"})]);
    const partData=await partResponse.json(),data=await response.json();
    if(!partResponse.ok)throw Error(partData.error||"Unable to load part");
    if(!response.ok)throw Error(data.error||"Unable to load instructions");
    if(version!==partLoadVersion||partRoute()!==partId)return;
    const part=partData.components?.find(item=>item.id===partId);
    if(!part)throw Error("Part not found");
    heading.textContent=(part.partNumber?part.partNumber+" · ":"")+window.BSPartFields.displayName(part);
    currentPartInfo=part;
    if(window.BSPartFields.itemTypeFor(part)==="part"&&!part.generatedFrom)showPartQuantity(partQuantityDisplay(part));
    const hasWorkshopLink=!!workshopLinkId(part);
    editWorkshopButton.hidden=!hasWorkshopLink;
    reloadWorkshopButton.hidden=!hasWorkshopLink||!canEdit()||!!part.generatedFrom;
    partDetailsCollapse.open=keepDetailsOpen;
    detailEditButton.textContent=hasWorkshopLink?"Modify part":"Edit part details";
    codePanel.setVisible(part.partType==="code");
    if(part.partType==="code")void codePanel.load(part.id,part.name);
    progressPanel.hidden=part.isTool===true;
    if(!part.isTool)fillProgressPanel(part);
    partPhotoActions.setEnabled(canEdit());
    investigationParts=partData.components||[];
    investigations?.showPart(partInvestigationPanel,partId);
    renderPartDetails(part);
    void partDrawingPanel?.load(project,"part",partId);
    void partFilesPanel?.load(project,partId);
    void showHarnessPreview(partId,version);
    if(partBackAssembly===null)partBackAssembly=part.assemblyId??null;
    partResourcePicker?.setData(data.workspace?.resources,canEdit());
    partRecipe?.setData(data.workspace,partId);
    partSavedRevision=data.workspace?.revision??null;
    partExtras.setData(data.workspace);
    showPartPicture(partId,keepDetailsOpen);
    partStatus.textContent="";
    if(partEditReturn?.id===partId){
     const y=partEditReturn.scrollY;partEditReturn=null;
     requestAnimationFrame(()=>window.scrollTo(0,y));
    }else if(Number.isFinite(history.state?.projectPartScrollY)){
     const y=history.state.projectPartScrollY;
     requestAnimationFrame(()=>{if(partRoute()===partId)window.scrollTo(0,y)});
    }
   }catch(e){if(version===partLoadVersion)partStatus.textContent=e.message}
  }
  async function showHarnessPreview(partId,version){
   const panel=partWorkspace.querySelector(".part-harness-preview"),body=panel.querySelector(".part-harness-preview-content");
   try{
    const [response,wiresResponse]=await Promise.all([
     fetch("/api/harness?project="+encodeURIComponent(project)+"&part="+encodeURIComponent(partId),{cache:"no-store"}),
     fetch("/api/wires",{cache:"no-store"})
    ]);
    const data=await response.json(),wireData=await wiresResponse.json();
    if(!response.ok)throw Error(data.error||"Could not load cutting list");
    if(!wiresResponse.ok)throw Error(wireData.error||"Could not load wire materials");
    if(version!==partLoadVersion||partRoute()!==partId)return;
    const cuts=data.cuts||[];
    panel.classList.toggle("hide",!cuts.length);body.replaceChildren();
    const byId=new Map((wireData.wires||[]).map(w=>[w.id,w]));
    for(const cut of cuts){
     const wire=byId.get(cut.wireId),row=document.createElement("div");row.className="part-harness-cut";
     const title=document.createElement("strong");title.textContent=(wire?.name||"Wire material")+" · "+cut.qty+" × "+Number((cut.cutLengthMm/25.4).toFixed(3))+" in";
     const detail=document.createElement("span");detail.textContent=[wire?.awg?wire.awg+" AWG":"",wire?.construction||"",cut.endA?"A: "+cut.endA:"",cut.endB?"B: "+cut.endB:""].filter(Boolean).join(" · ");
     row.append(title,detail);body.append(row);
    }
   }catch(error){
    if(version!==partLoadVersion||partRoute()!==partId)return;
    panel.classList.remove("hide");body.textContent="Cutting list unavailable: "+error.message;
   }
  }
  let partSaveFlight=null;
  function savePartWorkspace({resourcesOnly=false}={}){
   if(partSaveFlight)return partSaveFlight;
   const work=(async()=>{
    const id=partRoute();
    if(!id)throw Error("No part selected for saving.");
    if(!canEdit())throw Error("Sign in as administrator to save.");
    if(partRecipe?.hasPendingUploads())throw Error("Finish uploading attachments before saving.");
    const data={
     resources:partResourcePicker?.getData(),
     experiments:partExtras.getExperiments(),
     ...(resourcesOnly?{}:{recipe:partRecipe?.getData()||[]}),
     expectedRevision:partSavedRevision
    };
    const button=partWorkspace.querySelector(".part-workspace-save");
    button.disabled=true;partStatus.textContent="Saving…";
    try{
     const controller=new AbortController();
     const timeout=setTimeout(()=>controller.abort(),20000);
     let response;
     try{response=await fetch("/api/workspace?project="+encodeURIComponent(project)+"&part="+encodeURIComponent(id),{
      method:"PUT",credentials:"same-origin",headers:{"content-type":"application/json"},
      body:JSON.stringify(data),signal:controller.signal
     })}finally{clearTimeout(timeout)}
     const result=await response.json();
     if(!response.ok)throw Error(result.error||"Save failed (HTTP "+response.status+")");
     partSavedRevision=result.revision??partSavedRevision;
     if(!resourcesOnly)partRecipe?.markSaved();
     window.BSTransient?.show(partStatus,"Part instructions saved.");
    }catch(error){
     partStatus.textContent=error.name==="AbortError"?"Save timed out. Try again.":error.message;
     throw error;
    }finally{button.disabled=false}
   })();
   partSaveFlight=work;
   void work.finally(()=>{if(partSaveFlight===work)partSaveFlight=null}).catch(()=>{});
   return work;
  }
  partWorkspace.querySelector(".part-workspace-save").onclick=()=>void savePartWorkspace().catch(()=>{});

  function openPartInstructions(part,originId){
   partBackAssembly=selected;
   history.pushState(null,"","#"+project+"/part/"+encodeURIComponent(part.id));
   void showAssemblyPage();window.scrollTo(0,0);
  }
  let extractedPictureUrl=null,extractedSnapshotId=null;
  // Workspace-owned extraction handler. Runs even when the legacy component
  // editor failed to initialize; captured before the editor's click listeners.
  const bomNotice=document.createElement("p");
  bomNotice.className="workspace-bom-notice";
  bomNotice.setAttribute("role","status");
  bomNotice.setAttribute("aria-live","assertive");
  bomPanel.prepend(bomNotice);
  // Display saved parts independently of the legacy editor's <details> DOM.
  let bomDisplayVersion=0;
  // One readable, hierarchical BOM presentation; no competing view modes.
  let editingPart=null;
  let editingPartAssembly=null,editingPartOriginal=null;
  const partPhotoUrl=id=>"/api/components/photo?project="+encodeURIComponent(project)+"&id="+encodeURIComponent(id);
  const defaultPartPicture=part=>part?.partType==="code"?"/assets/default-code-photo.webp":
   part?.itemType==="document"?"/assets/default-document-photo.webp":"";
  // Local SVG fallback: always show a clear frowny face when a thumbnail is missing.
  const missingPicture="data:image/svg+xml,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" rx="18" fill="#243642"/><circle cx="80" cy="80" r="53" fill="#667b87" stroke="#718894" stroke-width="3"/><circle cx="61" cy="70" r="5" fill="#354b57"/><circle cx="99" cy="70" r="5" fill="#354b57"/><path d="M54 108 Q80 87 106 108" fill="none" stroke="#354b57" stroke-width="6" stroke-linecap="round"/></svg>');
  function makeBomThumbnail(url,alt){
   const image=document.createElement("img");image.className="bom-row-thumbnail";image.alt=alt||"Part picture";image.loading="lazy";
   image.onerror=()=>{image.onerror=null;image.src=missingPicture;image.classList.add("bom-thumbnail-empty");image.alt="Picture unavailable";};
   if(url)image.src=url;else{image.src=missingPicture;image.classList.add("bom-thumbnail-empty")}
   return image;
  }
  // Default to the Workshop's two stocking gauges, with specific heat-shrink and solder choices.
  function recommendedWorkshop(part){
   const name=String(part.name||"").toLowerCase();
   const specs=part.specifications||[];
   const insulation=String(specs.find(x=>String(x.name).toLowerCase()==="insulation")?.value||"").toLowerCase();
   if(/silicone/.test(insulation)||/silicone/.test(name))return "workshop:silicone";
   if(/ferrule/.test(name)){
    if(/\b22\s*awg\b/.test(name))return "workshop:ferrule22";
    if(/\b18\s*awg\b/.test(name))return "workshop:ferrule18";
    return null;
   }
   if(/heat[- ]?shrink/.test(name))return /adhesive|dual.wall|waterproof|seal/.test(name)?"workshop:sealshrink":"workshop:heatshrink";
   if(/\bsolder\b/.test(name))return "workshop:solder";
   if(/\bwire\b|\bcable\b/.test(name)){
    if(/\b18\s*awg\b/.test(name))return "workshop:wire18";
    if(/\b22\s*awg\b/.test(name))return "workshop:wire22";
    return "workshop:wire22";
   }
   return null;
  }
  function allowedWorkshopChoices(part){
   const recommended=recommendedWorkshop(part);
   if(!recommended)return [];
   if(recommended==="workshop:heatshrink"||recommended==="workshop:sealshrink")return ["workshop:heatshrink","workshop:sealshrink"];
   if(recommended==="workshop:wire18"||recommended==="workshop:wire22"){
    const hasGauge=/\b(?:18|22)\s*awg\b/i.test(String(part.name||""));
    return hasGauge?[recommended,"workshop:silicone"]:["workshop:wire22","workshop:wire18","workshop:silicone"];
   }
   return [recommended];
  }
  function workshopLink(part){
   const link=document.createElement("button");link.type="button";link.className="btn bom-workshop-link";
   link.textContent=part.workshopChoice?"Change selection":recommendedWorkshop(part)?"Choose recommended":"Browse Workshop";
   link.onclick=async e=>{
    e.preventDefault();e.stopPropagation();
    const original=location.hash.slice(1);
    const allowed=allowedWorkshopChoices(part);
    const initial=allowed.includes(part.workshopChoice)?part.workshopChoice:recommendedWorkshop(part);
    navigate("commonparts");
    const choose=async item=>{
     const response=await fetch("/api/components?project="+encodeURIComponent(project)+"&id="+encodeURIComponent(part.id),{
      method:"PATCH",credentials:"same-origin",headers:{"content-type":"application/json"},
      body:JSON.stringify({workshopChoice:item.id,expectedRevision:part.revision??null})
     });
     const data=await response.json().catch(()=>({}));
     if(!response.ok)throw Error(data.error||"Could not save Workshop selection");
     navigate(original);
     bomReport(item.name+" selected from The Workshop for "+part.name+".");
    };
    requestAnimationFrame(()=>window.BSResources?.focusWorkshopItem(initial,choose,allowed));
   };
   return link;
  }
  const shopCandidate=part=>part.generatedKind==="ferrule"||part.generatedKind==="wire"||/\b(?:ferrules?|solder|heat[- ]?shrink|wire|cable)\b/i.test(part.name||"");
  const materialQuantity=part=>part.quantity===null||part.quantity===undefined?"Quantity not specified":String(part.quantity)+(part.quantityUnit?" "+part.quantityUnit:"");
  function preferenceButton(part){
   if(!shopCandidate(part)||!canEdit())return null;
   const button=document.createElement("button");button.type="button";button.className="btn bom-material-preference";
   button.textContent=part.assumedOnHand?"Treat as purchase item":"Assume on hand";
   button.title="Only changes how this material appears in the BOM. No inventory tracking.";
   button.onclick=async event=>{
    event.preventDefault();event.stopPropagation();button.disabled=true;
    try{
     const response=await fetch("/api/components?project="+encodeURIComponent(project)+"&id="+encodeURIComponent(part.id),{
      method:"PATCH",credentials:"same-origin",headers:{"content-type":"application/json"},
      body:JSON.stringify({purchaseOverride:part.assumedOnHand?true:false,expectedRevision:part.revision??null})
     });
     const data=await response.json().catch(()=>({}));
     if(!response.ok)throw Error(data.error||"Could not update material preference");
     await renderWorkspaceParts();
     bomReport(part.name+(data.component.assumedOnHand?" moved to standard shop materials.":" moved to the main BOM."));
    }catch(error){bomReport("Could not change material: "+error.message);button.disabled=false}
   };
   return button;
  }
  let shopPanelExpanded=false;
  function shopMaterialsPanel(items){
   if(!items.length)return null;
   const section=document.createElement("details");section.className="bom-shop-materials";
   section.open=shopPanelExpanded;
   section.addEventListener("toggle",()=>{shopPanelExpanded=section.open});
   const summary=document.createElement("summary");
   summary.textContent="Standard shop materials · "+items.length+" item"+(items.length===1?"":"s")+" (assumed available)";
   const rows=document.createElement("div");rows.className="bom-shop-material-rows";
   for(const part of items){
    const row=document.createElement("div");row.className="bom-shop-material-row";
    const name=document.createElement("span");
    name.className="bom-part-name bom-part-name-link";name.textContent=(part.partNumber?part.partNumber+" · ":"")+window.BSPartFields.displayName(part);
    const quantity=document.createElement("span");quantity.className="bom-shop-qty";
    quantity.textContent=materialQuantity(part);
    row.append(name,quantity);
    const open=document.createElement("button");open.type="button";
    open.className="btn bom-part-edit";open.textContent="Open";
    open.setAttribute("aria-label","Open "+part.name);
    open.onclick=()=>openPartInstructions(part,part.assemblyId??null);
    row.append(open);
    rows.append(row);
   }
   section.append(summary,rows);return section;
  }
  // The BOM list is a text-first index. Open navigates to part details;
  // specifications, purchasing and images remain in each part workspace.
  function createSavedPart(part,originId){
   const item=document.createElement("div");item.className="bom-part bom-compact-part";
   if(part.hideFromFeatureTree)item.classList.add("bom-only-part");
   if(part.generatedFrom)item.classList.add("bom-generated-part");
   const row=document.createElement("div");row.className="bom-part-summary";
   const name=document.createElement("span");
   name.className="bom-part-name bom-part-name-link";name.textContent=(part.partNumber?part.partNumber+" · ":"")+window.BSPartFields.displayName(part);
   const qty=document.createElement("span");qty.className="bom-part-meta";
   qty.textContent="Qty "+window.BSBomModel.quantityText(part);
   row.append(name,qty);
   const open=document.createElement("button");open.type="button";
   open.className="btn bom-part-edit";open.textContent="Open";
   open.setAttribute("aria-label","Open "+part.name);
   open.onclick=()=>openPartInstructions(part,originId);
   row.append(open);
   item.append(row);
   return item;
  }
  // Group matching displayed names while preserving each underlying saved record.
  const bomIdentity=part=>[part.name,window.BSPartFields.valueFor(part),part.manufacturer,part.model,part.partType,part.sharedPartRef]
   .map(value=>String(value||"").trim().replace(/\s+/g," ").toLowerCase()).join("|");
  function appendGroupedBomParts(mount,entries){
   const groups=new Map();
   for(const entry of entries){
    const key=bomIdentity(entry.part);
    if(!groups.has(key))groups.set(key,[]);
    if(!groups.get(key).some(item=>item.part.id===entry.part.id))groups.get(key).push(entry);
   }
   for(const group of groups.values()){
    const first=group[0],row=createSavedPart(first.part,first.originId);
    if(first.feature)row.classList.add("bom-feature-part");
    if(group.length===1){mount.append(row);continue}
    const list=document.createElement("details");list.className="bom-duplicate-group";
    const heading=document.createElement("summary");heading.className="bom-duplicate-heading";
    heading.textContent=group.length+" saved records · Show each";
    list.append(heading);
    const children=document.createElement("div");children.className="bom-duplicate-records";
    for(const entry of group){
     const child=createSavedPart(entry.part,entry.originId);
     child.classList.add("bom-duplicate-record");children.append(child);
    }
    list.append(children);
    row.querySelector(".bom-part-meta").textContent=group.length+" records";
    row.append(list);mount.append(row);
   }
  }
  async function renderWorkspaceParts(){
   const version=++bomDisplayVersion,assemblyId=selected,container=bomPanel.querySelector(".workspace-saved-parts");
   // Keep the last list visible while fetching, rather than flashing the BOM
   // empty every time the user navigates to a different project page.
   if(!container.childElementCount){
    const pending=document.createElement("p");pending.className="bom-count";pending.textContent="Loading saved parts…";container.append(pending);
   }
   try{
    const response=await fetch("/api/components?project="+encodeURIComponent(project),{cache:"no-store"});
    const result=await response.json();if(!response.ok)throw Error(result.error||"Unable to load parts");
    if(version!==bomDisplayVersion||assemblyId!==selected)return;
    const parts=Array.isArray(result.components)?result.components:[];
    syncPartNodes(parts);
    if(bomView==="pictures"&&bomRoute())renderTiles();
    const visibleParts=(showBomDocuments?parts:parts.filter(part=>part.itemType!=="document")).map(rolledUpPart);
    const {shopItems,shopIds}=window.BSBomModel.selectWorkspaceParts(visibleParts,nodes,assemblyId);
    container.replaceChildren();
    // A real subassembly is shown once as an expandable BOM row, not duplicated as a normal part.
    const renderAssembly=(parentId,mount,level)=>{
     const linkedIds=new Set(nodes.filter(n=>isPartNode(n)).map(n=>n.partId));
     const ownParts=visibleParts.filter(p=>(p.assemblyId??null)===parentId&&!linkedIds.has(p.id)&&!shopIds.has(p.id));
     const children=nodes.filter(n=>n.parentId===parentId);
     const entries=ownParts.map(part=>({part,originId:parentId,feature:false}));
     for(const node of children)if(isPartNode(node)){
      const part=visibleParts.find(p=>p.id===node.partId);
      if(part&&!shopIds.has(part.id))entries.push({part,originId:node.parentId,feature:true});
     }
     appendGroupedBomParts(mount,entries);
     for(const node of children){
      if(isPartNode(node))continue;
      const item=document.createElement("details");item.className="bom-part bom-subassembly";item.dataset.assemblyId=node.id;item.open=false;item.setAttribute("aria-label",node.name+" subassembly BOM");
      const summary=document.createElement("summary");summary.className="bom-part-summary";
      const name=document.createElement("span");name.className="bom-part-name";name.textContent=node.name;
      const descendantIds=new Set([node.id]);const collect=id=>{for(const child of nodes.filter(x=>x.parentId===id))if(!descendantIds.has(child.id)){descendantIds.add(child.id);collect(child.id)}};collect(node.id);
      const count=document.createElement("span");count.className="bom-subassembly-count";
      const nParts=visibleParts.filter(part=>descendantIds.has(part.assemblyId??null)||nodes.some(x=>isPartNode(x)&&x.partId===part.id&&descendantIds.has(x.parentId))).length;
      const copies=window.BSBomModel.quantityMultiplier(nodes,node.id);
      count.textContent=(copies>1?copies+" pcs · ":"")+nParts+" part"+(nParts===1?"":"s");
      summary.append(name,count);item.append(summary);
      const body=document.createElement("div");body.className="bom-part-body bom-subassembly-children";
      const inner=document.createElement("div");inner.className="bom-part-stack";
      renderAssembly(node.id,inner,level+1);
      if(!inner.childElementCount){const empty=document.createElement("p");empty.className="bom-empty";empty.textContent="No parts in this subassembly yet.";inner.append(empty)}
      const open=document.createElement("button");open.type="button";open.className="btn bom-open-subassembly";open.textContent="Open subassembly instructions";
      open.onclick=()=>{selected=node.id;expanded.add(node.parentId);history.pushState(null,"",workspaceHash(node.id));render();notify();window.scrollTo(0,0)};
      body.append(inner,open);item.append(body);mount.append(item);
     }
    };
    const count=document.createElement("p");count.className="bom-count";
    const treeIds=new Set([assemblyId]);
    const visit=id=>{for(const node of nodes.filter(n=>n.parentId===id))if(!treeIds.has(node.id)){treeIds.add(node.id);visit(node.id)}};visit(assemblyId);
    const partCount=visibleParts.filter(p=>(treeIds.has(p.assemblyId??null)&&!nodes.some(n=>isPartNode(n)&&n.partId===p.id))||nodes.some(n=>isPartNode(n)&&n.partId===p.id&&treeIds.has(n.parentId))).length;
    const componentCount=Math.max(0,partCount-shopItems.length);
    count.textContent=componentCount+" BOM part"+(componentCount===1?"":"s")+(shopItems.length?" · "+shopItems.length+" standard shop materials":"")+" · "+nodes.filter(n=>!isPartNode(n)&&treeIds.has(n.id)&&n.id!==assemblyId).length+" subassemblies";
    container.append(count);
    const stack=document.createElement("div");stack.className="bom-part-stack";
    renderAssembly(assemblyId,stack,0);
    if(!stack.childElementCount){const empty=document.createElement("p");empty.className="bom-empty";empty.textContent=shopItems.length?"No purchased components in this assembly. Standard materials appear below.":"No parts yet. Use + New part to add one.";stack.append(empty)}
    container.append(stack);
    const shopSection=shopMaterialsPanel(shopItems);if(shopSection)container.append(shopSection);
    const purchasedParts=visibleParts.filter(part=>treeIds.has(part.assemblyId??null)||
     nodes.some(node=>isPartNode(node)&&node.partId===part.id&&treeIds.has(node.parentId)));
    window.BSBomPurchasing?.render(purchasingMount,purchasedParts);
   }catch(error){
    if(version!==bomDisplayVersion)return;
    container.replaceChildren();purchasingMount.replaceChildren();
    const message=document.createElement("p");message.className="bom-error";message.textContent="Unable to load BOM: "+error.message;container.append(message);
   }
  }
  // Workspace owns its part editor actions. Keep the mini-project component
  // editors separate; this panel saves one assembly part per request.
  const bomEditorMount=bomPanel.querySelector(".workspace-bom-mount");
  const supplierEditor=window.BSPartSuppliers?.createEditor();
  // Explicit type, shared by the overview and main editor. Older records default
  // to Purchased to preserve their existing manufacturer/supplier fields.
  const toolRow=document.createElement("label");toolRow.className="part-visibility-field";
  const toolCheckbox=document.createElement("input");toolCheckbox.type="checkbox";
  toolRow.append(toolCheckbox,document.createTextNode(" Tool?"));
  const toolHelp=document.createElement("span");toolHelp.className="part-option-help";toolHelp.textContent="ⓘ";toolHelp.tabIndex=0;
  toolHelp.title="Tools are used to complete work, but aren't consumed or assembled into the finished product. They appear in the Tools needed list, not the build BOM.";
  toolHelp.setAttribute("aria-label",toolHelp.title);toolRow.append(toolHelp);toolRow.title=toolHelp.title;
  const visibilityRow=document.createElement("label");visibilityRow.className="part-visibility-field";
  const visibilityCheckbox=document.createElement("input");visibilityCheckbox.type="checkbox";
  visibilityRow.append(visibilityCheckbox,document.createTextNode(" Hide from feature tree?"));
  const visibilityHelp=document.createElement("span");visibilityHelp.className="part-option-help";visibilityHelp.textContent="ⓘ";visibilityHelp.tabIndex=0;
  visibilityHelp.title="Hides this part from the feature tree while keeping the part, BOM entry, details and history. The part remains available in Parts Management and the BOM.";
  visibilityHelp.setAttribute("aria-label",visibilityHelp.title);visibilityRow.append(visibilityHelp);visibilityRow.title=visibilityHelp.title;
  const partNumberRow=document.createElement("label");partNumberRow.className="part-number-field";
  const partNumberInput=document.createElement("input");partNumberInput.className="field part-number-input";partNumberInput.placeholder="Automatic for custom parts; optional for purchased";partNumberInput.maxLength=30;
  partNumberRow.append(document.createTextNode("Part number"),partNumberInput);
  const partDescriptionRow=document.createElement("label");partDescriptionRow.className="part-description-field";
  const partDescriptionInput=document.createElement("textarea");partDescriptionInput.className="field part-description-input";partDescriptionInput.rows=2;partDescriptionInput.maxLength=2000;partDescriptionInput.placeholder="What is this part and what does it do?";
  partDescriptionRow.append(document.createTextNode("Description"),partDescriptionInput);
  // Same project-only fields used in the New Part picker; editing these never
  // sends a PUT to /api/workshop-reference or /api/personal-workshop.
  const projectOnlyPanel=document.createElement("section");
  projectOnlyPanel.className="part-project-only-editor";
  const onlyTitle=document.createElement("h3");onlyTitle.textContent="Project-specific information";
  projectOnlyPanel.append(onlyTitle);
  const treeDescriptionToggle=document.createElement("label");treeDescriptionToggle.className="part-project-only-field";
  const treeDescriptionCheckbox=document.createElement("input");treeDescriptionCheckbox.type="checkbox";treeDescriptionCheckbox.checked=true;
  treeDescriptionToggle.append(treeDescriptionCheckbox,document.createTextNode(" Show description in feature tree"));
  projectOnlyPanel.append(treeDescriptionToggle);
  const projectOnlyFields={};
  for(const [key,title,multiline,limit] of [
   ["value","Value (e.g. 10 kΩ or 100 nF)",false,120],
   ["notes","Project notes",true,6000],["changes","Project changes / modifications",true,6000],
   ["featureTreeName","Feature tree name (optional override)",false,120],
   ["referenceDesignators","Reference designators",false,500],["footprint","Footprint",false,240],
   ["schematicValue","Schematic value",false,240],["sourceApplication","Source application",false,80],
   ["sourceFile","Source schematic file",false,500],["sourceComponentId","Source component ID",false,240]
  ]){
   const label=document.createElement("label");label.className="part-project-only-field";
   const caption=document.createElement("span");caption.textContent=title;
   if(key==="value")caption.append(window.BSDialogs.valueTooltip());
   const input=document.createElement(multiline?"textarea":"input");
   input.className="field part-project-"+key;input.maxLength=limit;
   if(multiline)input.rows=3;
   label.append(caption,input);
   projectOnlyFields[key]=input;projectOnlyPanel.append(label);
  }
  const projectOnlyCad=document.createElement("details");projectOnlyCad.className="part-project-only-cad";
  const cadTitle=document.createElement("summary");cadTitle.textContent="Schematic / KiCad information (optional)";
  projectOnlyCad.append(cadTitle);
  for(const key of ["referenceDesignators","footprint","schematicValue","sourceApplication","sourceFile","sourceComponentId"])
   projectOnlyCad.append(projectOnlyFields[key].parentElement);
  projectOnlyPanel.append(projectOnlyCad);
  let editingProjectReferenceId="",editingWorkshopTreeDescription="";
  const readProjectOnly=()=>({
   ...Object.fromEntries(Object.entries(projectOnlyFields).map(([key,input])=>[key,input.value.trim()])),
   workshopReferenceId:editingProjectReferenceId,
   showTreeDescription:treeDescriptionCheckbox.checked?"true":"false"
  });
  const setProjectOnly=details=>{
   for(const [key,input] of Object.entries(projectOnlyFields))input.value=details?.[key]||"";
   editingProjectReferenceId=details?.workshopReferenceId||"";
   editingWorkshopTreeDescription=details?.workshopTreeDescription||"";
   treeDescriptionCheckbox.checked=details?.showTreeDescription!=="false";
  };
  let autoNumberChosen=false;
  partNumberInput.addEventListener("input",()=>{autoNumberChosen=false});
  const nextNumberButton=document.createElement("button");nextNumberButton.type="button";nextNumberButton.className="btn part-number-next";nextNumberButton.textContent="Choose next available part number";
  const partNumberHelp=document.createElement("small");partNumberHelp.className="part-number-help";partNumberHelp.textContent="A number is assigned only when the part is saved.";
  partNumberRow.append(nextNumberButton,partNumberHelp);
  nextNumberButton.onclick=async event=>{
   event.preventDefault();event.stopPropagation();
   if(partNumberInput.readOnly)return;
   nextNumberButton.disabled=true;partNumberHelp.textContent="Looking up the next unused number…";
   try{
    const response=await fetch("/api/numbering?project="+encodeURIComponent(project),{credentials:"same-origin",cache:"no-store"});
    const data=await response.json();if(!response.ok)throw Error(data.error||"Could not retrieve part number");
    if(!Number.isSafeInteger(data.nextPart)||data.nextPart<100)throw Error("No available part number");
    partNumberInput.value=String(data.prefix||"")+String(data.nextPart).padStart(Number(data.digits)||3,"0");
    autoNumberChosen=true;
    partNumberHelp.textContent="Available now; the number is reserved when you save. If another part takes it first, you'll be asked to choose again.";
   }catch(error){partNumberHelp.textContent=error.message}
   finally{nextNumberButton.disabled=partNumberInput.readOnly}
  };
  const itemTypeRow=document.createElement("label");itemTypeRow.className="part-type-field";
  itemTypeRow.textContent="Item type";
  const itemTypeSelect=document.createElement("select");itemTypeSelect.className="field part-item-type-select";
  for(const [value,label] of [["part","Part"],["document","Document"],["code","Code"]]){const option=document.createElement("option");option.value=value;option.textContent=label;itemTypeSelect.append(option)}
  itemTypeRow.append(itemTypeSelect);
  const partTypeRow=document.createElement("label");
  partTypeRow.className="part-type-field";
  partTypeRow.textContent="Part type";
  const partTypeSelect=document.createElement("select");
  partTypeSelect.className="field part-type-select";
  for(const [value,label] of [["purchased","Off-the-shelf"],["custom","Custom — made in-house"],["custom_purchased","Custom — purchased"],["code","Code"]]){
   const option=document.createElement("option");option.value=value;option.textContent=label;if(value==="code")option.hidden=true;partTypeSelect.append(option);
  }
  partTypeRow.append(partTypeSelect);
  // The legacy form is mounted asynchronously into the editor container.
  // Attach this selector when opening the form, not during initial page setup.
  const updatePartTypeFields=()=>{
   // Code is an item type, not a third sourcing classification.
   const codeMode=itemTypeSelect.value==="code";
   if(codeMode)partTypeSelect.value="code";
   else if(partTypeSelect.value==="code")partTypeSelect.value="purchased";
   const custom=["custom","code"].includes(partTypeSelect.value);
   const documentMode=itemTypeSelect.value!=="part";
   partTypeRow.hidden=codeMode;
   toolRow.hidden=documentMode;
   const qtyControl=bomEditorMount.querySelector(".component-quantity");if(qtyControl?.closest("label"))qtyControl.closest("label").hidden=documentMode;
   bomEditorMount.classList.toggle("is-custom-part",custom);
   for(const name of ["manufacturer","model","supplier","asin"]){
    const control=bomEditorMount.querySelector(".component-"+name);
    const label=control?.closest("label");
    if(label)label.hidden=custom;
   }
   const priceGroup=bomEditorMount.querySelector(".historical-price-fields");
   if(priceGroup)priceGroup.hidden=custom;
   const lookup=bomEditorMount.querySelector(".component-lookup-panel");
   if(lookup)lookup.hidden=custom;
  };
  partTypeSelect.onchange=updatePartTypeFields;
  itemTypeSelect.onchange=updatePartTypeFields;
  updatePartTypeFields();
  const bomSavedList=bomPanel.querySelector(".workspace-saved-parts");
  const bomEditorHeader=document.createElement("div");
  bomEditorHeader.className="workspace-bom-editor-header hide";
  const bomEditorHeading=document.createElement("h3");
  bomEditorHeading.className="workspace-bom-editor-title";
  const bomEditorCancel=document.createElement("button");
  bomEditorCancel.type="button";
  bomEditorCancel.className="btn workspace-bom-editor-cancel";
  bomEditorCancel.textContent="Cancel editing";
  const bomDialogClose=document.createElement("button");
  bomDialogClose.type="button";bomDialogClose.className="part-editor-close";
  bomDialogClose.textContent="×";bomDialogClose.title="Close part editor";
  bomDialogClose.setAttribute("aria-label","Close part editor");
  bomEditorHeader.append(bomEditorHeading,bomDialogClose,bomEditorCancel);
  bomDialogClose.onclick=()=>bomEditorCancel.click();
  bomEditorMount.prepend(bomEditorHeader);
  // Editing takes over the spacious main pane. Only the editor DOM moves;
  // its event handlers, form state and save API remain unchanged.
  const bomEditPanel=document.createElement("article");
  bomEditPanel.className="workspace-main-bom-editor hide";
  bomEditPanel.setAttribute("aria-label","BOM part editor");
  const partEditDialog=document.createElement("dialog");
  partEditDialog.className="part-editor-dialog";partEditDialog.setAttribute("aria-label","Part editor");
  // Keep dialog under the workspace so existing API extraction listeners still
  // receive clicks. Moving the existing form preserves its controllers.
  workspace.append(partEditDialog);
  partEditDialog.append(bomEditPanel);
  const partDialogError=document.createElement("p");partDialogError.className="part-editor-validation-error";partDialogError.setAttribute("role","alert");partDialogError.hidden=true;
  bomEditPanel.prepend(partDialogError);
  const projectEditNotice=document.createElement("div");
  projectEditNotice.className="part-project-edit-notice";
  projectEditNotice.hidden=true;
  projectEditNotice.setAttribute("role","note");
  const noticeHeading=document.createElement("strong");
  noticeHeading.textContent="Modifying this project's part only";
  const noticeBody=document.createElement("p");
  noticeBody.textContent="Changes here are saved to the part in this project, not the original Workshop item.";
  projectEditNotice.append(noticeHeading,noticeBody);
  partDialogError.after(projectEditNotice);
  partEditDialog.addEventListener("cancel",event=>{
   if(savingBom){event.preventDefault();return}
   event.preventDefault();bomEditorCancel.click();
  });
  let editorDisclosureObserver=null;
  const moveBomEditorToTop=()=>{
   bomEditPanel.append(bomEditorMount);
   bomReport("");
   workspace.classList.add("is-editing-bom-part");
   bomEditPanel.classList.remove("hide");
   bomEditorMount.classList.add("is-editing");
   bomEditorHeading.textContent=editingPart?(projectEditNotice.hidden?"Edit part details":"Modify project part"):"New part";
   bomEditorCancel.textContent="Cancel";
   bomEditorHeader.classList.remove("hide");
   if(!partEditDialog.open)partEditDialog.showModal();
  };
  const dismissBomEditor=()=>{
   editorDisclosureObserver?.disconnect();
   editorDisclosureObserver=null;
   bomEditorMount.classList.remove("is-editing");
   bomEditorHeader.classList.add("hide");
   bomSavedList.after(bomEditorMount);
   workspace.classList.remove("is-editing-bom-part");
   bomEditPanel.classList.add("hide");
   if(partEditDialog.open)partEditDialog.close();
  };
  bomEditorCancel.onclick=()=>{
   if(savingBom)return;
   clearBomDraft();
   const form=bomRoot()?.querySelector(".component-admin");
   if(form)form.open=false;
   bomRoot()?.querySelector(".component-review")?.classList.add("hide");
   bomReport("Part editing cancelled.");
   returnToEditedPart();
  };
  const bomRoot=()=>bomEditorMount.querySelector(".component-section");
  const bomField=name=>bomRoot()?.querySelector(".component-"+name);
  const bomReport=message=>{
   const label=bomPanel.querySelector(".workspace-bom-notice");
   if(label){label.textContent=message;label.classList.toggle("visible",!!message)}
   const el=bomRoot()?.querySelector(".component-status");
   if(el){el.textContent=message;el.hidden=!message;el.style.display=message?"block":"none"}
  };
  function clearBomDraft(){
   dismissBomEditor();
   extractedPictureUrl=null;
   editingPart=null;editingPartAssembly=null;editingPartOriginal=null;
   projectEditNotice.hidden=true;
   itemTypeSelect.value="part";partTypeSelect.value="purchased";visibilityCheckbox.checked=false;toolCheckbox.checked=false;partDescriptionInput.value="";setProjectOnly({});partNumberInput.value="";autoNumberChosen=false;partNumberInput.readOnly=false;nextNumberButton.disabled=false;partNumberHelp.textContent="A number is assigned only when the part is saved.";updatePartTypeFields();
   for(const name of ["name","manufacturer","model","supplier","asin","description","historical-price","historical-price-date"]){const el=bomField(name);if(el)el.value=""}
   supplierEditor?.setOffers([]);
   const priceBasis=bomField("historical-price-basis"),packageQty=bomField("historical-package-quantity");
   if(priceBasis)priceBasis.value="per_part";if(packageQty)packageQty.value="";priceBasis?.dispatchEvent(new Event("change"));
   const qty=bomField("quantity");if(qty)qty.value="";
   const unit=bomField("quantity-unit");if(unit)unit.value="pcs";if(unit?.closest("label"))unit.closest("label").hidden=true;
   bomRoot()?.querySelector(".component-specs")?.replaceChildren();
   bomRoot()?.querySelector(".component-review")?.classList.remove("hide");
   const save=bomField("save");if(save)save.textContent="Save part";
  }
  function editBomPart(part,originId){
   if(savingBom)return;
   clearBomDraft();editingPart=part.id;editingPartAssembly=originId;editingPartOriginal=structuredClone(part);
   projectEditNotice.hidden=!workshopLinkId(part);
   itemTypeSelect.value=part.partType==="code"?"code":part.itemType==="document"?"document":"part";
   partTypeSelect.value=["custom","custom_purchased","code"].includes(part.partType)?part.partType:"purchased";visibilityCheckbox.checked=part.hideFromFeatureTree===true;toolCheckbox.checked=part.isTool===true;
   partDescriptionInput.value=part.description||"";
   setProjectOnly(part.projectDetails||{});
   partNumberInput.value=part.partNumber||"";autoNumberChosen=false;partNumberInput.readOnly=!!part.partNumber;
   nextNumberButton.disabled=!!part.partNumber;
   partNumberHelp.textContent=part.partNumber?"Issued number. Existing part numbers are permanent.":"Enter a number or click Choose next available part number.";
   updatePartTypeFields();
   for(const key of ["name","manufacturer","model","supplier","asin","category"]){const field=bomField(key);if(field)field.value=part[key]||""}
   supplierEditor?.setOffers(part.supplierOffers||[]);

   const qty=bomField("quantity");if(qty)qty.value=part.quantity??"";
   const unit=bomField("quantity-unit");if(unit)unit.value=part.quantityUnit??"pcs";if(unit?.closest("label"))unit.closest("label").hidden=true;
   const price=bomField("historical-price"),date=bomField("historical-price-date");
   const priceBasis=bomField("historical-price-basis"),packageQty=bomField("historical-package-quantity");
   if(price)price.value=part.historicalPurchasePrice??part.historicalPrice??"";
   if(date)date.value=part.historicalPriceDate||"";
   if(priceBasis)priceBasis.value=part.historicalPriceBasis==="per_package"?"per_package":"per_part";
   if(packageQty)packageQty.value=part.historicalPriceBasis==="per_package"?(part.historicalPackageQuantity??""):"";
   priceBasis?.dispatchEvent(new Event("change"));
   const specs=bomRoot()?.querySelector(".component-specs");
   if(specs){for(const spec of part.specifications||[]){
    const row=document.createElement("div");row.className="row component-spec-row";
    const a=document.createElement("input"),b=document.createElement("input"),c=document.createElement("select"),remove=document.createElement("button");
    a.className=b.className="field";a.placeholder="Specification";b.placeholder="Value";a.value=spec.name;b.value=spec.value;
    c.className="field component-spec-source";c.setAttribute("aria-label","Specification source");
    for(const v of ["explicit","inferred"]){const opt=document.createElement("option");opt.value=v;opt.textContent=v==="explicit"?"✓ From product listing":"◇ Estimated / inferred";c.append(opt)}
    c.value=spec.source==="inferred"?"inferred":"explicit";
    remove.type="button";remove.className="btn component-spec-remove";remove.textContent="×";remove.title="Remove specification";remove.setAttribute("aria-label","Remove specification");remove.onclick=()=>row.remove();
    row.append(a,b,c,remove);specs.append(row);
   }}
   // Ensure the workspace is visible before opening the modal. In particular,
   // editing from a part detail route must not open a dialog under a hidden page.
   if(!workspaceRoute()){
    if(originId!==undefined)selected=originId;
    history.pushState(null,"","#"+project+"/workspace/"+encodeURIComponent(selected??"__root__"));
    render();notify();
   }
   openBomDraft();
   const save=bomField("save");if(save)save.textContent="Save changes";
   bomReport("");
  }
  function openBomDraft(){
   const root=bomRoot();if(!root){bomReport("BOM editor unavailable. Refresh the page.");return}
   const aiLookup=window.BSProductLookup.mountPart(root,{canSearch:canEdit});
   aiLookup.setIdentity({
    partNumber:bomField("model")?.value.trim()||"",
    featureTreeDescription:projectOnlyFields.featureTreeName.value.trim().slice(0,20)||
     editingWorkshopTreeDescription||partDescriptionInput.value.trim().slice(0,20),
    searchHint:""
   });
   const review=root.querySelector(".component-review");
   const lookup=root.querySelector(".component-lookup-panel");
   if(review){
    // One consistent information hierarchy for New Part and Edit Part.
    // Move existing controls only; never reconstruct inputs or alter saved data.
    const sectionHeading=(key,title)=>{
     let h=review.querySelector('[data-part-editor-section="'+key+'"]');
     if(!h){h=document.createElement("h3");h.className="part-editor-section-heading";h.dataset.partEditorSection=key}
     h.textContent=title;return h;
    };
    const field=name=>bomField(name)?.closest("label");
    // Legacy fields stay in the DOM for the reusable component controller,
    // but they are no longer editable. Their stored category isn't discarded.
    const legacyFullName=field("full-name"),legacyCategory=field("category");
    if(legacyFullName)legacyFullName.hidden=true;
    if(legacyCategory)legacyCategory.hidden=true;
    const identity=[field("name")];
    if(identity[0]?.firstChild?.nodeType===Node.TEXT_NODE)identity[0].firstChild.nodeValue="Part name";
    const quantities=[field("quantity"),field("quantity-unit")];
    const sourcing=[field("manufacturer"),field("model"),field("supplier"),field("asin"),
     review.querySelector(".historical-price-fields")||bomRoot()?.querySelector(".historical-price-fields")];
    const specs=bomRoot()?.querySelector(".component-specs");
    const specsHeading=[...review.children].find(el=>el.tagName==="H3"&&!el.classList.contains("part-editor-section-heading"));
    const addSpec=bomRoot()?.querySelector(".component-add-spec");
    const existingActions=review.querySelector(".component-editor-actions");
    const apiPanel=root.querySelector(".component-lookup-panel");
    const known=new Set([itemTypeRow,partTypeRow,partNumberRow,partDescriptionRow,...identity,...quantities,...sourcing,
      toolRow,visibilityRow,review.querySelector(".part-display-options"),specsHeading,specs,addSpec,existingActions,apiPanel].filter(Boolean));
    const otherFields=[...review.children].filter(el=>!known.has(el)&&!el.classList.contains("part-editor-section-heading"));
    const move=(...elements)=>{for(const el of elements)if(el)review.append(el)};
    // Use one canonical field order for the editor and expanded part details.
    const fields=window.BSPartFields.sectionFields;
    const controls={partNumber:partNumberRow,name:identity[0],itemType:itemTypeRow,
     partType:partTypeRow,description:partDescriptionRow,quantity:quantities[0],
     manufacturer:sourcing[0],model:sourcing[1],category:legacyCategory,
     supplier:sourcing[2],asin:sourcing[3],historicalPrice:sourcing[4],
     isTool:toolRow,hideFromFeatureTree:visibilityRow};
    const ordered=keys=>keys.map(key=>controls[key]).filter(Boolean);
    move(...ordered(fields.identity),apiPanel);
    move(sectionHeading("additional","Additional details"),...ordered(fields.additional),quantities[1]);
    if(supplierEditor)move(supplierEditor.element);
    const displayGroup=review.querySelector(".part-display-options")||document.createElement("div");
    displayGroup.className="part-display-options";
    displayGroup.append(...ordered(fields.display));
    move(sectionHeading("display","Display options"),displayGroup);
    move(...otherFields);
    move(specsHeading||sectionHeading("specifications","Specifications"),specs,projectOnlyPanel);
    let actions=review.querySelector(".component-editor-actions");
    if(!actions){
     actions=document.createElement("div");actions.className="component-editor-actions";
     const right=document.createElement("div");right.className="component-editor-primary-actions";
     actions.append(root.querySelector(".component-add-spec"),right);
     review.append(actions);
    }
    review.append(actions); // Keep add-spec, Save and Cancel together at the bottom.
    const buttons=actions.querySelector(".component-editor-primary-actions");
    buttons.append(root.querySelector(".component-save"),bomEditorCancel);
   }
   moveBomEditorToTop();
   updatePartTypeFields();
   // The reusable legacy component controller can close its parent disclosure
   // asynchronously; keep it expanded only while the full-size editor is active.
   const outer=root.querySelector(":scope > details");
   if(outer){
    outer.open=true;
    editorDisclosureObserver?.disconnect();
    editorDisclosureObserver=new MutationObserver(()=>{
     if(workspace.classList.contains("is-editing-bom-part")&&!outer.open)outer.open=true;
    });
    editorDisclosureObserver.observe(outer,{attributes:true,attributeFilter:["open"]});
   }
   const form=root.querySelector(".component-admin");if(form)form.open=true;
   root.querySelector(".component-review")?.classList.remove("hide");
   partEditDialog.scrollTop=0;
   partDialogError.hidden=true;partDialogError.textContent="";
   partNumberInput.focus({preventScroll:true});
  }
  let savingBom=false;
  async function saveBomDraft(){
   if(savingBom)return false;
   const name=bomField("name")?.value.trim()||"";
   if(!name){bomReport("Enter a part name before saving.");openBomDraft();return false}
   if(!canEdit()){bomReport("Use Admin login before saving BOM parts.");return false}
   const rawQty=bomField("quantity")?.value.trim()??"";
   const amount=rawQty===""?null:Number(rawQty);
   if(amount!==null&&(!Number.isFinite(amount)||amount<=0||amount>10000000)){bomReport("Quantity must be positive or left blank.");return false}
   const component={assemblyId:editingPart?editingPartAssembly:selected,quantity:partTypeSelect.value==="code"?null:amount,quantityUnit:editingPart?bomField("quantity-unit")?.value??"pcs":"pcs",itemType:partTypeSelect.value==="code"?"document":itemTypeSelect.value,partType:partTypeSelect.value,hideFromFeatureTree:visibilityCheckbox.checked,isTool:toolCheckbox.checked,partNumber:autoNumberChosen?null:(partNumberInput.value.trim().toUpperCase()||null),assignNumber:autoNumberChosen};
   const priceInput=!["purchased","custom_purchased"].includes(partTypeSelect.value)?"":(bomField("historical-price")?.value.trim()||"");
   const dateInput=partTypeSelect.value==="custom"?"":(bomField("historical-price-date")?.value||"");
   if(priceInput&&(!Number.isFinite(Number(priceInput))||Number(priceInput)<0||Math.round(Number(priceInput)*100)!==Number(priceInput)*100&&Math.abs(Math.round(Number(priceInput)*100)-Number(priceInput)*100)>1e-6)){
    bomReport("Historical price must be a positive USD amount with at most two decimal places.");return false;
   }
   const pricingBasis=bomField("historical-price-basis")?.value??"per_part";
   const countInput=bomField("historical-package-quantity")?.value.trim()??"";
   if(priceInput&&pricingBasis==="per_package"&&(!countInput||!Number.isSafeInteger(Number(countInput))||Number(countInput)<1||Number(countInput)>1000000)){
    bomReport("Enter a whole number of parts per package.");return false;
   }
   component.historicalPurchasePrice=priceInput===""?null:Number(priceInput);
   component.historicalPriceBasis=pricingBasis;
   component.historicalPackageQuantity=pricingBasis==="per_package"?(countInput||null):null;
   component.historicalPriceDate=priceInput===""?null:(dateInput||new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10));
   for(const key of ["name","manufacturer","model","supplier","asin"])component[key]=bomField(key)?.value.trim()||"";
   try{component.supplierOffers=supplierEditor?.getOffers()||[]}catch(error){bomReport(error.message);return false}
   // Preserve the hidden category for existing parts and product extraction.
   component.category=bomField("category")?.value.trim()||"";
   // The API automatically generates the display/file label: part number + name.
   component.description=partDescriptionInput.value.trim();
   component.projectDetails=readProjectOnly();
   if(!["purchased","custom_purchased"].includes(component.partType))Object.assign(component,{manufacturer:"",model:"",supplier:"",asin:"",historicalPurchasePrice:null,historicalPriceDate:null,historicalPriceBasis:"per_part",historicalPackageQuantity:null});
   component.specifications=[...(bomRoot()?.querySelectorAll(".component-spec-row")||[])].map(row=>({
    name:row.children[0]?.value.trim()||"",value:row.children[1]?.value.trim()||"",source:row.children[2]?.value==="inferred"?"inferred":"explicit"
   })).filter(entry=>entry.name&&entry.value);
   savingBom=true;
   const saveButton=bomField("save");if(saveButton)saveButton.disabled=true;
   const validationMessage=partEditDialog.querySelector(".part-editor-validation-error");
   if(validationMessage){validationMessage.hidden=true;validationMessage.textContent=""}
   bomReport("Saving "+name+"…");
   try{
    const wasEdit=!!editingPart;
    const imageToImport=extractedPictureUrl,snapshotToAttach=extractedSnapshotId;
    const address="/api/components?project="+encodeURIComponent(project)+(editingPart?"&id="+encodeURIComponent(editingPart):"");
    let result;
    if(wasEdit){
     result=await window.BSEditConflicts.save(address,{method:"PUT",original:editingPartOriginal,changes:component,active:()=>partEditDialog.open});
    }else{
     const response=await fetch(address,{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify(component)});
     result=await response.json();
     if(!response.ok)throw Error(result.error||"Save failed (HTTP "+response.status+")");
    }
    let photoMessage="";
    if(snapshotToAttach&&result.component?.id){
     try{
      const snapshotResponse=await fetch("/api/part-pages?project="+encodeURIComponent(project)+"&id="+encodeURIComponent(result.component.id),{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({snapshotId:snapshotToAttach})});
      const snapshotData=await snapshotResponse.json();if(!snapshotResponse.ok)throw Error(snapshotData.error||"Could not attach saved product page");
      photoMessage+=" Product webpage archived with part details.";
     }catch(error){photoMessage+=" Warning: product webpage was not attached: "+error.message}
    }
    if(imageToImport&&result.component?.id){
     try{
      const photoResponse=await fetch(partPhotoUrl(result.component.id),{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({imageUrl:imageToImport})});
      const photoData=await photoResponse.json().catch(()=>({}));
      photoMessage=photoResponse.ok?" Product picture added.":" Product picture unavailable; you can upload one manually.";
     }catch{photoMessage=" Product picture unavailable; you can upload one manually."}
    }
    if(wasEdit){
     const linked=nodes.filter(n=>isPartNode(n)&&n.partId===result.component?.id&&n.name!==result.component.name);
     if(linked.length){
      try{await save(nodes.map(n=>linked.some(x=>x.id===n.id)?{...n,name:result.component.name}:n))}
      catch(error){photoMessage+=" Part saved; feature-tree name could not be updated: "+error.message}
     }
    }
    if(result.component&&!result.component.generatedFrom){
     partVisibility.set(result.component.id,result.component.hideFromFeatureTree===true);
     partTools.set(result.component.id,result.component.isTool===true);
     partWorkshopItems.set(result.component.id,!!result.component.sharedPartRef||!!result.component.workshopChoice||!!result.component.projectDetails?.workshopReferenceId||result.component.isTool===true);
     partDocuments.set(result.component.id,result.component.itemType==="document");
      partTreeLabels.set(result.component.id,{mpn:result.component.model||"",description:result.component.description||"",details:result.component.projectDetails||{},defaultPicture:defaultPartPicture(result.component)});
     if(result.component.partNumber)partNumbers.set(result.component.id,result.component.partNumber);
     if(!nodes.some(n=>isPartNode(n)&&n.partId===result.component.id))nodes.push({id:"part-"+result.component.id,kind:"part",partId:result.component.id,name:result.component.name,parentId:component.assemblyId??null});
     render();
    }
    clearBomDraft();
    const editor=bomRoot()?.querySelector(".component-admin");if(editor)editor.open=false;
    bomRoot()?.querySelector(".component-review")?.classList.add("hide");
    bomRoot()?.dispatchEvent(new Event("bom:refresh"));
    await renderWorkspaceParts();
    bomReport(name+(wasEdit?" updated.":" saved to the BOM.")+photoMessage);
    if(wasEdit)returnToEditedPart();
    return true;
   }catch(error){
    const message=error.message||"Unknown error";
    bomReport("Could not save part: "+message);
    const dialogMessage=partEditDialog.querySelector(".part-editor-validation-error");
    if(dialogMessage){dialogMessage.textContent=message;dialogMessage.hidden=false}
    return false;
   }
   finally{savingBom=false;if(saveButton)saveButton.disabled=false}
  }
  // BOM creation uses the shared part picker and creates a hideable tree occurrence.
  bomHeading.querySelector(".workspace-new-part").onclick=async()=>{
   if(savingBom)return;
   if(!window.BSLibraryPartPicker){bomReport("Part library unavailable. Refresh and try again.");return}
   const targetAssembly=selected;
   await window.BSLibraryPartPicker.open({hideDefault:true,onCreate:async payload=>{
    const {wireInfo,workshopSavedMessage="",addToWorkshop=false,workshopCategory="",...part}=payload;
    let newPart=null,wireId=wireInfo?.wireId||null;
    try{
     if(wireInfo&&!wireId){
      const r=await fetch("/api/wires",{cache:"no-store"}),data=await r.json();
      if(!r.ok)throw Error(data.error||"Unable to load wire library");
      const matched=(data.wires||[]).find(w=>String(w.awg).replace(/\\s*awg/i,"").trim()===String(wireInfo.gauge)&&
       (wireInfo.construction==="solid"?/solid/i.test(w.construction||""):wireInfo.construction==="braided"?/braid/i.test(w.construction||""):/strand/i.test(w.construction||""))&&String(w.insulation||"")===String(wireInfo.insulation||""));
      if(matched)wireId=matched.id;
      else{
       const response=await fetch("/api/wires",{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},
        body:JSON.stringify({name:wireInfo.gauge+" AWG "+wireInfo.construction+" copper (verify)",awg:String(wireInfo.gauge),construction:wireInfo.construction,insulation:wireInfo.insulation,notes:"Created through part library selection. Verify insulation and terminal compatibility."})});
       const data=await response.json();if(!response.ok)throw Error(data.error||"Could not save wire library material");
       wireId=data.wire.id;
      }
     }
     if(wireId){part.sharedPartRef="wire:"+wireId;if(!part.specifications.some(spec=>spec.name==="Library wire ID"))part.specifications.push({name:"Library wire ID",value:wireId,source:"explicit"})}
     const response=await fetch("/api/components?project="+encodeURIComponent(project),{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({...part,assemblyId:targetAssembly})});
     const data=await response.json();if(!response.ok)throw Error(data.error||"Could not create BOM-only part");
     newPart=data.component;
     partVisibility.set(newPart.id,newPart.hideFromFeatureTree===true);
     partTools.set(newPart.id,newPart.isTool===true);
     partWorkshopItems.set(newPart.id,!!newPart.sharedPartRef||!!newPart.workshopChoice||!!newPart.projectDetails?.workshopReferenceId||newPart.isTool===true);
     partDocuments.set(newPart.id,newPart.itemType==="document");
      partTreeLabels.set(newPart.id,{mpn:newPart.model||"",description:newPart.description||"",details:newPart.projectDetails||{},defaultPicture:defaultPartPicture(newPart)});
     if(newPart.partNumber)partNumbers.set(newPart.id,newPart.partNumber);
     nodes.push({id:"part-"+newPart.id,kind:"part",partId:newPart.id,name:newPart.name,parentId:targetAssembly});render();
     // A cutting list needs an integer wire count; do not invent a count for unspecified quantities.
     if(wireInfo?.crimp&&wireId&&part.quantityUnit==="pcs"&&Number.isInteger(part.quantity)&&part.quantity>0&&Number.isFinite(wireInfo.mm)&&wireInfo.mm>0){
      const res=await fetch("/api/harness?project="+encodeURIComponent(project)+"&part="+encodeURIComponent(newPart.id),{
       method:"PUT",credentials:"same-origin",headers:{"content-type":"application/json"},
       body:JSON.stringify({cuts:[{wireId,qty:part.quantity,cutLengthMm:wireInfo.mm,stripAmm:0,stripBmm:0,endA:wireInfo.endA,endB:wireInfo.endB}]})
      });
      const data=await res.json();if(!res.ok)throw Error(data.error||"Could not save wire cutting list");
     }
     await renderWorkspaceParts();
     // The picker now confirms Workshop publication *before* creating the BOM
     // part. Do not attempt a second Workshop write here.
     bomReport(newPart.name+" saved to the BOM."+(workshopSavedMessage?" "+workshopSavedMessage:""));
    }catch(error){
     if(newPart)await fetch("/api/components?project="+encodeURIComponent(project)+"&id="+encodeURIComponent(newPart.id),{method:"DELETE",credentials:"same-origin"}).catch(()=>{});
     if(newPart){nodes=nodes.filter(n=>n.partId!==newPart.id);partVisibility.delete(newPart.id);partTools.delete(newPart.id);render()}
     bomReport("Could not create part: "+error.message);
     throw error;
    }
   }});
  };
  // The editor moves from the BOM screen into workspace-main-bom-editor.
  // Delegate events from the stable workspace, not the original BOM panel.
  workspace.addEventListener("click",event=>{
   const target=event.target;
   if(!(target instanceof Element))return;
   if(target.closest(".component-add-spec")){
    event.preventDefault();event.stopImmediatePropagation();
    const container=bomRoot()?.querySelector(".component-specs");
    if(!container){bomReport("Specification editor unavailable.");return}
    const row=document.createElement("div");row.className="row component-spec-row";
    const name=document.createElement("input"),value=document.createElement("input"),source=document.createElement("select"),remove=document.createElement("button");
    name.className=value.className="field";name.placeholder="Specification";value.placeholder="Value";
    source.className="field component-spec-source";source.setAttribute("aria-label","Specification source");
    for(const entry of ["explicit","inferred"]){const option=document.createElement("option");option.value=entry;option.textContent=entry==="explicit"?"✓ From product listing":"◇ Estimated / inferred";source.append(option)}
    remove.className="btn";remove.type="button";remove.textContent="Remove";remove.onclick=()=>row.remove();
    row.append(name,value,source,remove);container.append(row);
    bomRoot()?.querySelector(".component-review")?.classList.remove("hide");
    name.focus();bomReport("Specification added. Enter the name and value.");
   }else if(target.closest(".component-save")){
    event.preventDefault();event.stopImmediatePropagation();void saveBomDraft();
   }else if(target.closest(".component-cancel")){
    event.preventDefault();event.stopImmediatePropagation();
    const form=bomRoot()?.querySelector(".component-admin");if(form)form.open=false;
    clearBomDraft();bomRoot()?.querySelector(".component-review")?.classList.add("hide");
    bomReport("Part editor collapsed.");
    returnToEditedPart();
   }
  },true);
  const workspaceRoute=()=>location.hash.slice(1).startsWith(project+"/workspace/");
  let workspacePhotoVersion=0;
  async function loadWorkspaceCover(){
   const id=selected,version=++workspacePhotoVersion,cover=workspace.querySelector(".workspace-cover");
   const previousId=workspacePhotos[workspacePhotoIndex]?.id;
   cover.replaceChildren();cover.append(Object.assign(document.createElement("span"),{textContent:"No photo yet"}));
   workspacePhotoBar.setPhotoPresent(false);
   try{
    const query="/api/photos?project="+encodeURIComponent(project)+"&assembly="+encodeURIComponent(id??"root-assembly");
    const response=await fetch(query,{credentials:"same-origin",cache:"no-store"});
    if(!response.ok)throw Error("Unable to load photos");
    const data=await response.json();
    if(version!==workspacePhotoVersion||selected!==id||!workspaceRoute())return;
    workspacePhotos=(data.photos||[]).filter(photo=>photo.assembly===(id??"root-assembly"));
    workspacePhotoIndex=previousId?Math.max(0,workspacePhotos.findIndex(photo=>photo.id===previousId)):0;
    const show=()=>{
     const photo=workspacePhotos[workspacePhotoIndex];
     workspacePhotoBar.setPhotoPresent(!!photo);cover.replaceChildren();
     if(!photo){cover.append(Object.assign(document.createElement("span"),{textContent:"No photo yet"}));return}
     const img=document.createElement("img");img.src=window.BSPhotoMarkup.displayUrl("gallery",photo.id);img.alt=photo.caption||"Assembly photo";
     cover.append(img);
     if(workspacePhotos.length>1){
      const prev=document.createElement("button"),next=document.createElement("button");
      prev.type=next.type="button";prev.className="bs-photo-previous";next.className="bs-photo-next";
      prev.textContent="‹";next.textContent="›";prev.setAttribute("aria-label","Previous photo");next.setAttribute("aria-label","Next photo");
      prev.onclick=()=>{workspacePhotoIndex=(workspacePhotoIndex+workspacePhotos.length-1)%workspacePhotos.length;show()};
      next.onclick=()=>{workspacePhotoIndex=(workspacePhotoIndex+1)%workspacePhotos.length;show()};
      cover.append(prev,next);
     }
    };
    show();
   }catch(e){workspacePhotoBar.setStatus(e.message)}
  }
  let workspaceLoadVersion=0;
  let workspaceSavedRevision=null;
  const workspaceStatus=workspace.querySelector(".workspace-status");
  const workspaceUrl=()=>"/api/workspace?project="+encodeURIComponent(project)+"&assembly="+encodeURIComponent(selected??"__root__");
  async function loadWorkspace(){
   const version=++workspaceLoadVersion,url=workspaceUrl();workspaceSavedRevision=null;workspaceStatus.textContent="Loading…";
   assemblyRecipe?.setLoading(true);
   try{const res=await fetch(url,{credentials:"same-origin",cache:"no-store"});const data=await res.json();if(!res.ok)throw Error(data.error||"Unable to load workspace");
    if(version!==workspaceLoadVersion||url!==workspaceUrl())return;
    assemblyResourcePicker?.setData(data.workspace?.resources,canEdit());
    assemblyRecipe?.setData(data.workspace,url);
    workspaceSavedRevision=data.workspace?.revision??null;
    assemblyExtras.setData(data.workspace);
    workspaceStatus.textContent="";
   }catch(e){workspaceStatus.textContent=e.message}
  }
  let assemblySaveFlight=null;
  function saveAssemblyWorkspace({resourcesOnly=false}={}){
   if(assemblySaveFlight)return assemblySaveFlight;
   const work=(async()=>{
    if(!canEdit())throw Error("Use Admin login to save.");
    if(assemblyRecipe?.hasPendingUploads())throw Error("Finish uploading attachments before saving.");
    const button=workspace.querySelector(".workspace-save"),url=workspaceUrl();
    const data={
     resources:assemblyResourcePicker?.getData(),
     experiments:assemblyExtras.getExperiments(),
     ...(resourcesOnly?{}:{recipe:assemblyRecipe?.getData()||[]}),
     expectedRevision:workspaceSavedRevision
    };
    button.disabled=true;workspaceStatus.textContent="Saving…";
    try{
     const controller=new AbortController();
     const timeout=setTimeout(()=>controller.abort(),20000);
     let response;
     try{response=await fetch(url,{method:"PUT",credentials:"same-origin",
      headers:{"content-type":"application/json"},body:JSON.stringify(data),signal:controller.signal
     })}finally{clearTimeout(timeout)}
     const result=await response.json();
     if(!response.ok)throw Error(result.error||"Save failed (HTTP "+response.status+")");
     workspaceSavedRevision=result.revision??workspaceSavedRevision;
     if(!resourcesOnly)assemblyRecipe?.markSaved();
     window.BSTransient?.show(workspaceStatus,"Saved.");
    }catch(error){
     workspaceStatus.textContent=error.name==="AbortError"?"Save timed out. Try again.":error.message;
     throw error;
    }finally{button.disabled=false}
   })();
   assemblySaveFlight=work;
   void work.finally(()=>{if(assemblySaveFlight===work)assemblySaveFlight=null}).catch(()=>{});
   return work;
  }
  workspace.querySelector(".workspace-save").onclick=()=>void saveAssemblyWorkspace().catch(()=>{});

  const partsRoute=()=>decodeURIComponent(location.hash.slice(1))===project+"/parts";
  const partsManager=window.BSPartsManager.mount(partsPage,{
   project,canEdit,
   onBack:()=>{history.pushState(null,"","#"+project);render();notify();window.scrollTo(0,0)},
   onOpenPart:id=>{
    const part=nodes.find(n=>isPartNode(n)&&n.partId===id);
    selected=part?.parentId??null;partBackAssembly=selected;
    history.pushState(null,"","#"+project+"/part/"+encodeURIComponent(id));
    render();notify();window.scrollTo(0,0);
   },
   onChanged:part=>{
    syncPartNodes([part]);render();
    view.querySelectorAll(".component-section").forEach(section=>section.dispatchEvent(new Event("assemblychange")));
   }
  });
  // Every project-level page gets the same notes component, but each page
  // keeps its own records. BOM and workspace for an assembly are independent.
  const notePanels=Object.fromEntries([
   ["summary",summary],["workspace",workspace],["bom",bomScreen],
   ["part",partWorkspace],["parts",partsPage]
  ].map(([scope,mount])=>[scope,window.BSUnstructuredNotes.mount(mount,{project,scope,canEdit})]));
  assemblyInvestigationPanel.after(notePanels.workspace.element);
  partInvestigationPanel.after(notePanels.part.element);
  // Both versions of Recent changes were originally inserted directly
  // beside the workspace Save button. Move each to the bottom instead,
  // after notes, archives, and backups, without replacing its handlers.
  const assemblyRecentChanges=workspace.querySelector(".instruction-history");
  const partRecentChanges=partWorkspace.querySelector(".instruction-history");
  if(assemblyRecentChanges)workspace.append(assemblyRecentChanges);
  if(partRecentChanges)partWorkspace.append(partRecentChanges);
  summary.append(creatorInsightsTarget);
  let lastNotePage="";
  const showNotes=(scope,id="root")=>{
   const page=scope+":"+id;
   if(page===lastNotePage)return;
   lastNotePage=page;
   void notePanels[scope].read(id);
  };
  const workspaceHash=id=>"#"+project+"/workspace/"+encodeURIComponent(id??"__root__");
  const bomHash=id=>"#"+project+"/bom/"+encodeURIComponent(id??"__root__");
  // Keep older overview deep links usable as BOM list destinations.
  const bomRoute=()=>{
   const hash=decodeURIComponent(location.hash.slice(1));
   return hash===project+"/overview"||new RegExp("^"+project+"/(?:bom/[^/]+|assembly/[^/]+(?:/overview)?)$").test(hash);
  };
  function openWorkspace(){history.pushState(null,"",workspaceHash(selected));void showAssemblyPage();window.scrollTo(0,0)}
  const openBom=()=>{
   setBomView("list");
   history.pushState(null,"",bomHash(selected));
   void showAssemblyPage();
   window.scrollTo(0,0);
  };
  // Assembly workspaces have BOM navigation; individual part pages do not.
  workspace.querySelector(".workspace-back").onclick=openBom;
  const refreshSettingsControls=()=>{
   const record=window.BSProjectManager?.getProject?.(project);
   const visibility=record?.visibility==="private"?"Private":"Public";
   summary.querySelector(".project-summary-heading .muted").textContent=record?"Project summary · "+visibility:"Project summary";
  };
  bomScreen.querySelector(".assembly-bom-back").onclick=openWorkspace;
  async function showAssemblyPage(){
   ++detailVersion;
   refreshSettingsControls();
   const isAssembly=selected!==null;
   // Reuse the existing part editor, but keep the BOM inside the workspace.
   const isEditingBom=workspace.classList.contains("is-editing-bom-part");
   const bomMount=bomPanel.querySelector(".workspace-bom-mount");
   const bom=isEditingBom?null:(main.querySelector(".component-section")||detail.querySelector(".component-section")||bomMount.querySelector(".component-section"));
   if(bom&&bom.parentElement!==bomMount)bomMount.append(bom);
   sidebar.classList.add("bom-sidebar-active");
   if(!isEditingBom)void renderWorkspaceParts();
   const inPart=!!partRoute();partWorkspace.classList.toggle("hide",!inPart);
   const inSummary=isProjectSummary(),inParts=partsRoute(),inSettings=settingsRoute(),inBom=bomRoute();
   const inWorkspace=!inPart&&!inBom&&!inSummary&&!inParts&&!inSettings;
   const quantityNode=inWorkspace&&nodes.find(node=>node.id===selected);
   showAssemblyQuantity(quantityNode?assemblyQuantityDisplay(quantityNode):null);
   summary.classList.toggle("hide",!inSummary);
   partsPage.classList.toggle("hide",!inParts);
   settingsPage.classList.toggle("hide",!inSettings);
   settingsPage.querySelector(".project-settings-unavailable").hidden=!!window.BSProjectManager?.isOwner?.(project);
   workspace.classList.toggle("hide",!inWorkspace);
   bomScreen.classList.toggle("hide",!inBom);
   // Legacy overview DOM remains available for image editing but isn't a page.
   detail.classList.add("hide");
   main.classList.add("hide");
   if(inPart){showNotes("part",partRoute());void showPartWorkspace();return;}
   if(inParts){showNotes("parts");void partsManager.refresh();return;}
   if(inSummary){showNotes("summary");void refreshProjectSummary();return;}
   if(inSettings)return;
   if(inBom){
    showNotes("bom",selected??"root");
    bomScreen.querySelector(".assembly-bom-screen-title").textContent=(selected===null?title:((nodes.find(n=>n.id===selected)?.partNumber||"")+(nodes.find(n=>n.id===selected)?.partNumber?" · ":"")+(nodes.find(n=>n.id===selected)?.name||"Assembly")))+" · BOM";
    if(bomView==="pictures")renderTiles();
    return;
   }
   if(inWorkspace){void refreshAssemblyArchives(selected??"__root__");showNotes("workspace",selected??"root");void loadAssemblyStatus();workspace.querySelector(".workspace-title").textContent=selected===null?title:((nodes.find(n=>n.id===selected)?.partNumber||"")+(nodes.find(n=>n.id===selected)?.partNumber?" · ":"")+(nodes.find(n=>n.id===selected)?.name||"Assembly"));if(photoDialog.open)photoDialog.close();workspacePhotoBar.setEnabled(canEdit());workspacePhotoBar.collapse();loadWorkspaceCover();loadWorkspace();investigations?.showAssembly(assemblyInvestigationPanel,selected??"__root__");void fetch("/api/components?project="+encodeURIComponent(project),{cache:"no-store"}).then(r=>r.ok?r.json():null).then(d=>{if(d?.components){investigationParts=d.components;investigations?.load()}}).catch(()=>{});if(bom){const details=bom.querySelector("details");if(details)details.open=true;bom.dispatchEvent(new Event("assemblychange"));}return;}
   if(!isAssembly){await loadDescription(null,main,main.querySelector(".root-photo-status"));await renderRootPhotos();return;}
   const node=nodes.find(n=>n.id===selected);if(!node)return;
   const assemblyId=selected;
   detail.querySelector(".assembly-detail-title").textContent=node.name;


   const path=[node.name];let cursor=node;while(cursor.parentId){cursor=nodes.find(n=>n.id===cursor.parentId);if(!cursor)break;path.unshift(cursor.name)}
   detail.querySelector(".assembly-breadcrumb").textContent=[title,...path].join(" / ");
   detailStatus.textContent="";
   await loadDescription(assemblyId,detail,detailStatus);
   await detailPhotoController.refresh();

  }
  detail.querySelector(".assembly-back").onclick=()=>{selected=null;history.pushState(null,"",workspaceHash(null));render();notify();window.scrollTo(0,0)};
  // One description loader/saver for the same tile at every depth.
  async function loadDescription(id,container,message){
   const editor=container.querySelector(".assembly-description-edit");
   const display=container.querySelector(".assembly-description");
   const input=container.querySelector(".assembly-description-input");
   editor.classList.toggle("hide",!canEdit());
   container.querySelector(".assembly-photo-admin").classList.toggle("hide",!canEdit());
   display.textContent="Loading…";
   const url="/api/tree?project="+encodeURIComponent(project)+"&assembly="+encodeURIComponent(id??"__root__");
   try{
    const r=await fetch(url),data=await r.json();
    if(!r.ok)throw Error(data.error||"Unable to load description");
    if(id!==selected)return;
    display.textContent=data.page?.description||"";
    input.value=data.page?.description||"";
    container.dataset.descriptionRevision=data.revision||"";
    display.classList.toggle("hide",canEdit());
   }catch(e){display.textContent="Unable to load description: "+e.message}
  }
  function bindDescriptionSave(container,getId,message){
   container.querySelector(".assembly-description-save").onclick=async()=>{
    const id=getId();
    message.textContent="Saving…";
    try{
     const r=await fetch("/api/tree?project="+encodeURIComponent(project)+"&assembly="+encodeURIComponent(id??"__root__"),{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({description:container.querySelector(".assembly-description-input").value,expectedRevision:container.dataset.descriptionRevision||null})});
     const data=await r.json();
     if(!r.ok)throw Error(data.error||"Save failed");
     message.textContent="Saved.";
     await loadDescription(id,container,message);
    }catch(e){message.textContent=e.message}
   };
  }
  bindDescriptionSave(main,()=>null,main.querySelector(".root-photo-status"));
  bindDescriptionSave(detail,()=>selected,detailStatus);
  // One controller for every project tile, including the root and nested assemblies.
  function createPhotoController(tile, getAssemblyId, statusElement, allowEditing=false){
   const gallery=tile.querySelector(".assembly-photos");
   const admin=tile.querySelector(".assembly-photo-admin");
   const input=tile.querySelector(".assembly-photo-input");
   const zone=tile.querySelector(".assembly-photo-zone");
   const caption=tile.querySelector(".assembly-photo-caption");
   const pick=tile.querySelector(".assembly-photo-pick");
   const uploader=window.BSPhotoEditor.uploadPanel({
    title:"Add photos",multiple:false,accept:"image/*,.heic,.heif",
    hint:"Maximum 10 MB per photo.",onFiles:files=>upload(files[0])
   });
   zone.after(uploader.panel);
   const captionField=caption.closest(".assembly-photo-caption-label");
   if(captionField)uploader.panel.append(captionField);
   zone.hidden=true;zone.style.display="none";
   let busy=false;
   const report=message=>{statusElement.textContent=message};
   const currentId=()=>getAssemblyId();
   async function refresh(){
    const id=currentId();
    admin.classList.toggle("hide",!canEdit()||!allowEditing);
    const url="/api/photos?project="+encodeURIComponent(project)+(id?"&assembly="+encodeURIComponent(id):"");
    try{
     const r=await fetch(url),data=await r.json();
     if(!r.ok)throw Error(data.error||"Unable to load photos");
     if(id!==currentId())return;
     const photos=(data.photos||[]).filter(p=>id==="project-summary"?(p.assembly==="project-summary"||!p.assembly):id?p.assembly===id:!p.assembly);
     const name=id?nodes.find(n=>n.id===id)?.name||title:title;
     gallery.replaceChildren(makeAssemblyPhotoStage(photos,name,()=>uploader.open(),async p=>{
      if(!p||!await window.BSDialogs.danger("Delete this photo?",{title:"Delete photo?"}))return;
      try{
       const r=await fetch("/api/photos?id="+encodeURIComponent(p.id),{method:"DELETE",credentials:"same-origin"});
       if(!r.ok)throw Error("Delete failed (HTTP "+r.status+")");
       await refresh();if(tile===workspacePhotoEditor)void loadWorkspaceCover();if(!id)void refreshProjectCover();
      }catch(e){report(e.message)}
     },allowEditing,p=>window.BSPhotoMarkup.open({kind:"gallery",id:p.id,onSave:()=>{void refresh();void loadWorkspaceCover();void refreshProjectCover();void refreshProjectSummary()}})));
    }catch(e){report(e.message)}
   }
   async function upload(file){
    if(!file||busy)return;
    const id=currentId();
    if(!canEdit()){report("Sign in as administrator to upload.");return}
    if(file.size>10*1024*1024){report("Maximum photo size: 10 MB.");return}
    const type=file.type||({jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp",gif:"image/gif",heic:"image/heic",heif:"image/heif"}[file.name.split(".").pop().toLowerCase()]||"");
    if(!type){report("Choose an image file.");return}
    busy=true;zone.setAttribute("aria-busy","true");report("Uploading photo…");
    try{
     const headers={"content-type":type,"x-photo-project":project,"x-photo-caption":encodeURIComponent(caption.value),"x-photo-name":encodeURIComponent(file.name)};
     if(id)headers["x-photo-assembly"]=id;
     const r=await fetch("/api/photos",{method:"POST",credentials:"same-origin",headers,body:file});
     const raw=await r.text();let data;try{data=JSON.parse(raw)}catch{data={error:raw.slice(0,160)||"Unexpected server response"}}
     if(!r.ok)throw Error((data.error||"Upload failed")+" (HTTP "+r.status+")");
     input.value="";caption.value="";
     await refresh();if(tile===workspacePhotoEditor)void loadWorkspaceCover();if(!id)void refreshProjectCover();if(id==="project-summary")void refreshProjectSummary();report("Photo uploaded.");
     return true;
    }catch(e){report(e.message||"Upload failed.");return false}
    finally{busy=false;zone.removeAttribute("aria-busy")}
   }
   pick.onclick=event=>{event.stopPropagation();uploader.open()};
   input.onchange=()=>upload(input.files?.[0]);
   // The visible photo dialog is the drop target; keep legacy zone support.
   zone.ondragover=e=>{if(!e.dataTransfer?.types?.includes("Files"))return;e.preventDefault();zone.classList.add("drag-over")};
   zone.ondragleave=()=>zone.classList.remove("drag-over");
   zone.ondrop=e=>{e.preventDefault();e.stopPropagation();zone.classList.remove("drag-over");void upload(e.dataTransfer.files?.[0])};
   return {refresh,upload};
  }
  // Legacy photo controllers remain available for assembly imagery.
  const rootPhotoController=createPhotoController(main,()=>null,main.querySelector(".root-photo-status"));
  const detailPhotoController=createPhotoController(detail,()=>selected,detailStatus);
  async function renderRootPhotos(){await rootPhotoController.refresh()}
  function renderTiles(){
   const target=bomPictureMount;
   target.replaceChildren();const children=nodes.filter(n=>n.parentId===selected&&(!isPartNode(n)||!isToolNode(n))&&(showBomDocuments||!isDocumentNode(n)));
   
   if(!children.length)return;
   const bomGrid=document.createElement("div");bomGrid.className="assembly-tile-grid";
   const partCount=children.filter(isPartNode).length;
   const subassemblyCount=children.length-partCount;
   const sorted=[...children];
   for(const n of sorted){
    const tile=document.createElement("article");tile.className="assembly-tile "+(isPartNode(n)?"assembly-bom-part-tile":"assembly-bom-subassembly-tile");
    const cover=document.createElement("div");cover.className="assembly-tile-cover";cover.textContent="▧";const overlay=document.createElement("span");overlay.className="assembly-tile-overlay";overlay.textContent=n.name;cover.append(overlay);tile.append(cover);if(isPartNode(n)){const img=document.createElement("img");img.src=partPhotoUrl(n.partId);img.alt="";img.onerror=()=>{img.onerror=null;img.src=partTreeLabels.get(n.partId)?.defaultPicture||missingPicture};cover.replaceChildren(img,overlay,...[...cover.children].filter(child=>child!==overlay&&child!==img))}
    else fetch("/api/photos?project="+project+"&assembly="+encodeURIComponent(n.id)).then(r=>r.json()).then(data=>{if(!tile.isConnected||!data.photos?.length)return;const img=document.createElement("img");img.src=window.BSPhotoMarkup.displayUrl("gallery",data.photos[0].id);img.alt="";cover.replaceChildren(img,overlay,...[...cover.children].filter(child=>child!==overlay&&child!==img))}).catch(()=>{});
    const openAssembly=()=>{if(isPartNode(n)){openTreePart(n);return}selected=n.id;expanded.add(n.parentId);history.pushState(null,"",workspaceHash(n.id));render();notify();window.scrollTo(0,0)};cover.setAttribute("role","button");cover.tabIndex=0;cover.setAttribute("aria-label","Open "+n.name);cover.onclick=openAssembly;cover.title="Open "+n.name+" workspace";cover.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openAssembly()}};
    const part=partQuantities.get(n.partId);
    const copies=isPartNode(n)?null:window.BSBomModel.quantityMultiplier(nodes,n.id);
    const quantity=part?.quantity!=null?window.BSBomModel.quantityText(rolledUpPart(part)):copies>1?copies+" pcs":"";
    if(quantity)overlay.append(document.createTextNode(" · "+quantity));
    // Picture BOM tiles reuse the established photo-first design.
    // The old stage/dependency/footer controls are not shown beneath tiles.
    bomGrid.append(tile)
   }
   if(children.length){
    const section=document.createElement("section");section.className="assembly-bom-parts-group";
    section.setAttribute("aria-label","Bill of materials parts and subassemblies");
    const heading=document.createElement("div");heading.className="assembly-bom-parts-heading";
    const title=document.createElement("h2");title.textContent="Bill of Materials";
    const count=document.createElement("span");count.className="assembly-bom-parts-count";
    count.textContent=[partCount?partCount+" "+(partCount===1?"part":"parts"):"",subassemblyCount?subassemblyCount+" "+(subassemblyCount===1?"subassembly":"subassemblies"):""].filter(Boolean).join(" · ");
    heading.append(title,count);
    const description=document.createElement("p");description.className="assembly-bom-parts-description";
    description.textContent="Parts and subassemblies belonging to this assembly";
    section.append(heading,description,bomGrid);
    target.append(section);
   }
  }
  root.addEventListener("projectpermissionschanged",()=>{refreshSettingsControls();render();notify()});
   root.addEventListener("projectreviewchanged",()=>render());
  root.addEventListener("openpart",()=>{void showAssemblyPage()});
  root.addEventListener("openprojectpage",()=>{render();void showAssemblyPage()});
  root.addEventListener("openassembly",e=>{const id=e.detail;if(id==="__root__"){selected=null;history.pushState(null,"",workspaceHash(null));render();notify();return}if(!nodes.some(n=>n.id===id))return;selected=id;history.pushState(null,"",workspaceHash(id));let cursor=nodes.find(n=>n.id===id);while(cursor){expanded.add(cursor.parentId);cursor=nodes.find(n=>n.id===cursor.parentId)}render();notify()});
  const validSelection=()=>selected===null||nodes.some(n=>n.id===selected);
  const publishTree=()=>{assemblySelections[project]=selected;assemblyTreeSnapshots[project]={nodes:[...nodes],title}};
  const refreshBom=()=>{
   publishTree();void renderWorkspaceParts();
   if(isProjectSummary())void refreshProjectSummary();
  };
  const notify=()=>{publishTree();showAssemblyPage();renderTiles();view.querySelectorAll(".component-section").forEach(section=>section.dispatchEvent(new Event("assemblychange")));};
  let treeSavedRevision=null;
  async function load(){void loadProjectMetadata();try{const [r,partsResponse]=await Promise.all([fetch("/api/tree?project="+project),fetch("/api/components?project="+encodeURIComponent(project),{cache:"no-store"})]);const data=await r.json();if(!r.ok)throw Error(data.error);nodes=data.nodes||[];
   if(partsResponse.ok){const partData=await partsResponse.json();syncPartNodes(partData.components||[])}void loadWorkshopCaptions();treeSavedRevision=data.revision??null;if(!validSelection())selected=null;const deepLink=decodeURIComponent(location.hash.slice(1)).match(new RegExp("^"+project+"/(?:assembly|workspace|bom)/([^/]+)(?:/overview)?$"));if(deepLink&&(deepLink[1]==="__root__"||nodes.some(n=>n.id===deepLink[1])))selected=deepLink[1]==="__root__"?null:deepLink[1];render();notify()}catch(e){status.textContent="Feature tree unavailable: "+e.message}}
  async function save(next,afterSave=notify){const r=await fetch("/api/tree?project="+project,{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({nodes:next,expectedRevision:treeSavedRevision})});const data=await r.json();if(!r.ok)throw Error(data.error||"Save failed");treeSavedRevision=data.revision??treeSavedRevision;nodes=data.nodes||next;render();afterSave()}
  // Tree ordering is the order of node records; moving a node keeps its permanent ID.
  const siblings=parent=>nodes.filter(n=>n.parentId===parent);
  async function moveSelected(direction){
   if(selected===null){status.textContent="Select a subassembly first.";return}
   const node=nodes.find(n=>n.id===selected);if(!node)return;
   const group=siblings(node.parentId),position=group.findIndex(n=>n.id===selected),other=group[position+direction];
   if(!other){status.textContent=direction<0?"Already first in this assembly.":"Already last in this assembly.";return}
   const a=nodes.findIndex(n=>n.id===node.id),b=nodes.findIndex(n=>n.id===other.id);
   const next=[...nodes];[next[a],next[b]]=[next[b],next[a]];
   try{await save(next);status.textContent="Subassembly reordered."}catch(e){status.textContent=e.message}
  }
  const wouldCycle=(id,newParent)=>{
   let cursor=newParent;while(cursor!==null){if(cursor===id)return true;cursor=nodes.find(n=>n.id===cursor)?.parentId??null}return false
  };
  async function reparent(id,newParent){
   const node=nodes.find(n=>n.id===id);
   if(!node)return;
   if(newParent===id||wouldCycle(id,newParent)||isPartNode(nodes.find(n=>n.id===newParent)))throw Error("Cannot move an assembly inside a part or one of its descendants.");
   if(node.parentId===newParent)return;
   const next=nodes.map(n=>n.id===id?{...n,parentId:newParent}:n);
   await save(next);expanded.add(newParent);
   if(isPartNode(node)){
    let warning="";
    try{
     const response=await fetch("/api/components?project="+encodeURIComponent(project),{cache:"no-store"});
     const data=await response.json();if(!response.ok)throw Error(data.error||"Could not load part");
     const part=data.components?.find(item=>item.id===node.partId);if(!part)throw Error("Linked BOM part not found");
     const update=await fetch("/api/components?project="+encodeURIComponent(project)+"&id="+encodeURIComponent(part.id),{method:"PUT",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({...part,expectedRevision:part.revision??null,assemblyId:newParent})});
     const result=await update.json();if(!update.ok)throw Error(result.error||"Unable to update BOM parent");
    }catch(error){warning=" Tree moved, but BOM parent could not be updated: "+error.message}
    openTreePart({...node,parentId:newParent});status.textContent="Part moved."+warning;
   }else{selected=id;render();notify();status.textContent="Subassembly moved."}
  }
  async function moveToChoice(){
   if(selected===null){status.textContent="Select a subassembly first.";return}
   const options=[{id:null,name:"Top-level project"},...nodes.filter(n=>!isPartNode(n)&&n.id!==selected&&!wouldCycle(selected,n.id))];
   const help=options.map((n,i)=>(i+1)+". "+n.name).join("\\n");
   const answer=await window.BSDialogs.prompt("Move the selected subassembly into:\\n"+help,"",{title:"Move subassembly",label:"Destination number"});
   if(answer===null)return;
   const choice=Number(answer)-1;
   if(!Number.isInteger(choice)||choice<0||choice>=options.length){status.textContent="Enter a number from the list.";return}
   try{await reparent(selected,options[choice].id)}catch(e){status.textContent=e.message}
  }
  const reorderControls=document.createElement("span");reorderControls.className="assembly-reorder-controls";
  for(const [label,title,action] of [["↑","Move up",()=>moveSelected(-1)],["↓","Move down",()=>moveSelected(1)],["Move to…","Change parent assembly",moveToChoice]]){
   const button=document.createElement("button");button.type="button";button.className="btn assembly-move-button";button.textContent=label;button.title=title;button.setAttribute("aria-label",title);button.onclick=action;reorderControls.append(button)
  }
  controls.append(reorderControls);
  // Feature-tree context menu: right click (or the row's ⋯ button on touch).
  // The existing add/rename/delete handlers remain the source of truth for
  // assemblies; linked parts use their own safe tree-reference operations.
  const treeMenu=document.createElement("div");
  treeMenu.className="assembly-context-menu";
  treeMenu.setAttribute("role","menu");
  treeMenu.setAttribute("aria-label","Feature tree actions");
  treeMenu.hidden=true;
  document.body.append(treeMenu);
  let menuTarget=null;
  const closeTreeMenu=()=>{treeMenu.hidden=true;menuTarget=null;treeMenu.replaceChildren()};
  document.addEventListener("pointerdown",event=>{if(!treeMenu.hidden&&!treeMenu.contains(event.target))closeTreeMenu()});
  document.addEventListener("keydown",event=>{if(event.key==="Escape")closeTreeMenu()});
  window.addEventListener("hashchange",()=>{
   closeTreeMenu();
   if(isProjectSummary()){
    selected=null;
    render();
    void showAssemblyPage();
   }
  });
  const useTreeTarget=node=>{
   // Context menu on a part acts on its containing assembly for Add actions.
   selected=isPartNode(node)?node.parentId:(node?.id??null);
  };
  const renameTreeItem=async node=>{
   if(!node)return;
   if(!isPartNode(node)){
    selected=node.id;
    root.querySelector(".assembly-rename").click();
    return;
   }
   const part=partQuantities.get(node.partId);
   if(!part||part.generatedFrom)throw Error("Open the source part to rename it.");
   const value=await window.BSDialogs.prompt("Enter a new name",part.name,{title:"Rename part",label:"Part name"});
   if(!value?.trim()||value.trim()===part.name)return;
   const result=await window.BSEditConflicts.save("/api/components?project="+encodeURIComponent(project)+"&id="+encodeURIComponent(node.partId),
    {original:part,changes:{name:value.trim()}});
   partQuantities.set(part.id,result.component);
   await save(nodes.map(item=>item.id===node.id?{...item,name:result.component.name}:item));
  };
  const deleteTreeItem=async node=>{
   if(!node)return;
   if(!isPartNode(node)){
    selected=node.id;
    root.querySelector(".assembly-remove").click();
    return;
   }
   const links=nodes.filter(item=>isPartNode(item)&&item.partId===node.partId);
   if(!await window.BSDialogs.danger("Delete \""+node.name+"\" from this project?\n\nThis removes the part from the feature tree and all assembly BOM references ("+links.length+"). Its stored details are moved to the recovery bin. This action cannot be undone on this page.",{title:"Delete project part?"}))return;
   // Delete the underlying part through the existing recovery-bin API, not
   // by simply removing the tree node. Only remove links after API success.
   const response=await fetch("/api/components?project="+encodeURIComponent(project)+"&id="+encodeURIComponent(node.partId),{
    method:"DELETE",credentials:"same-origin"
   });
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(data.error||"Part deletion failed");
   try{
    await save(nodes.filter(item=>!(isPartNode(item)&&item.partId===node.partId)));
    partDocuments.delete(node.partId);partVisibility.delete(node.partId);
    partTools.delete(node.partId);partNumbers.delete(node.partId);
    partProgress.delete(node.partId);partAttention.delete(node.partId);partQuantities.delete(node.partId);
    if(partRoute()===node.partId){
     selected=node.parentId??null;
     history.replaceState(null,"",workspaceHash(selected));
     render();notify();
    }
    status.textContent="Part deleted from this project. A recovery copy was retained.";
   }catch(error){
    status.textContent="Part was archived and removed from the BOM, but its tree link could not be saved: "+error.message+". Refresh the page to reconcile.";
   }
  };
  // Intentional, parent-scoped history. The API snapshots a complete subtree
  // before removing active tree/BOM references. Revisions remain a separate tool.
  const archivePanel=document.createElement("section");
  archivePanel.className="assembly-archived-items";
  const archiveDetails=document.createElement("details");
  archiveDetails.className="assembly-archived-disclosure";
  const archiveHeading=document.createElement("summary");
  archiveHeading.textContent="Archived items (0)";
  const archiveList=document.createElement("div");
  archiveList.className="assembly-archived-list";
  archiveDetails.append(archiveHeading,archiveList);
  archivePanel.append(archiveDetails);
  workspace.querySelector(".workspace-panels").append(archivePanel);
  let archiveRequestSerial=0;
  const archiveURL="/api/assembly-archive?project="+encodeURIComponent(project);
  const archiveFetch=async(url,init)=>{
   const response=await fetch(url,{credentials:"same-origin",cache:"no-store",...init});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(data.error||"Archive request failed");
   return data;
  };
  async function refreshAssemblyArchives(parentId){
   archivePanel.hidden=!canEdit();
   if(archivePanel.hidden)return;
   const serial=++archiveRequestSerial;
   archiveList.textContent="Loading archived items…";
   try{
    const result=await archiveFetch(archiveURL+"&parent="+encodeURIComponent(parentId));
    if(serial!==archiveRequestSerial)return;
    archiveHeading.textContent="Archived items ("+result.items.length+")";
    archiveList.replaceChildren();
    if(!result.items.length){
     const empty=document.createElement("p");empty.className="muted";
     empty.textContent="No archived parts or subassemblies.";
     archiveList.append(empty);return;
    }
    for(const item of result.items){
     const row=document.createElement("div");row.className="assembly-archived-row";
     const name=document.createElement("span");
     name.textContent=(item.partNumber?item.partNumber+" · ":"")+item.name+" · "+(item.kind==="part"?"Part":"Subassembly")+(item.restoredAt?" · Restored":"");
     const view=document.createElement("button");view.type="button";view.className="btn";view.textContent="View";
     view.onclick=()=>void viewAssemblyArchive(item.id);
     row.append(name,view);archiveList.append(row);
    }
   }catch(error){if(serial===archiveRequestSerial)archiveList.textContent=error.message}
  }
  async function viewAssemblyArchive(id){
   try{
    const {archive}=await archiveFetch(archiveURL+"&id="+encodeURIComponent(id));
    const dialog=document.createElement("dialog");dialog.className="assembly-archive-dialog";
    const header=document.createElement("h3");header.textContent=archive.name+" — Archived";
    const summary=document.createElement("p");
    summary.textContent="Archived "+new Date(archive.archivedAt).toLocaleString()+
      " · "+archive.nodes.length+" tree item(s) · "+archive.parts.length+" part definition(s) · "+
      archive.investigations.length+" history record(s) · "+archive.assets.length+" saved files";
    dialog.append(header,summary);
    if(archive.reason){const p=document.createElement("p");p.textContent="Reason: "+archive.reason;dialog.append(p)}
    const list=document.createElement("ul");
    for(const node of archive.nodes){
     const li=document.createElement("li");li.textContent=(node.partNumber?node.partNumber+" · ":"")+node.name+
      (node.kind==="part"?" (part)":" (subassembly)");list.append(li);
    }
    dialog.append(list);
    // An assembly can contain children that were archived before the assembly
    // itself. Keep that earlier history discoverable within the parent archive.
    if(archive.kind!=="part"){
     const children=await archiveFetch(archiveURL+"&parent="+encodeURIComponent(archive.nodeId)).catch(()=>({items:[]}));
     if(children.items.length){
      const section=document.createElement("details");section.className="assembly-archive-media";
      const heading=document.createElement("summary");heading.textContent="Previously archived children ("+children.items.length+")";
      section.append(heading);
      for(const child of children.items){
       const row=document.createElement("div");row.className="assembly-archived-row";
       const label=document.createElement("span");label.textContent=child.name;
       const open=document.createElement("button");open.type="button";open.className="btn";open.textContent="View";
       open.onclick=()=>void viewAssemblyArchive(child.id);
       row.append(label,open);section.append(row);
      }
      dialog.append(section);
     }
    }
    const media=(archive.assets||[]).map((asset,index)=>({...asset,index})).filter(asset=>
     !asset.original.startsWith("photo-annotations/")&&!asset.original.startsWith("photo-renders/"));
    const images=media.filter(asset=>/\.(jpg|jpeg|png|webp|gif|heic|heif)$/i.test(asset.original)||
     asset.original.startsWith("component-thumbnails/"));
    const documents=media.filter(asset=>!images.includes(asset));
    if(images.length){
     const photos=document.createElement("details");photos.className="assembly-archive-media";photos.open=images.length<=12;
     const title=document.createElement("summary");title.textContent="Saved photos ("+images.length+")";photos.append(title);
     const gallery=document.createElement("div");gallery.className="assembly-archive-gallery";
     for(const asset of images){
      const figure=document.createElement("figure");figure.className="assembly-archive-image";
      const image=document.createElement("img");image.loading="lazy";
      image.src=archiveURL+"&id="+encodeURIComponent(id)+"&asset="+asset.index;
      image.alt=asset.original.split("/").pop()||"Archived photo";figure.append(image);
      const caption=document.createElement("figcaption");caption.textContent=asset.original.split("/").pop();
      figure.append(caption);gallery.append(figure);
     }
     photos.append(gallery);dialog.append(photos);
    }
    if(documents.length){
     const docs=document.createElement("details");docs.className="assembly-archive-media";
     const title=document.createElement("summary");title.textContent="Saved documents and data files ("+documents.length+")";docs.append(title);
     const files=document.createElement("ul");
     for(const asset of documents){
      const li=document.createElement("li"),link=document.createElement("a");
      link.href=archiveURL+"&id="+encodeURIComponent(id)+"&asset="+asset.index;
      link.textContent=asset.original.split("/").pop()||asset.original;
      link.download="";li.append(link);files.append(li);
     }
     docs.append(files);dialog.append(docs);
    }
    const data=document.createElement("details"),label=document.createElement("summary");
    label.textContent="View saved record details";const pre=document.createElement("pre");
    pre.className="assembly-archive-json";pre.textContent=JSON.stringify({
     nodes:archive.nodes,parts:archive.parts,investigations:archive.investigations,assets:archive.assets
    },null,2);
    data.append(label,pre);dialog.append(data);
    const actions=document.createElement("div");actions.className="assembly-archive-actions";
    const close=document.createElement("button");close.type="button";close.className="btn";close.textContent="Close";close.onclick=()=>dialog.close();
    actions.append(close);
    if(canEdit()&&!archive.restoredAt){
     const restore=document.createElement("button");restore.type="button";restore.className="btn primary";restore.textContent="Restore";
     restore.onclick=async()=>{
      restore.disabled=true;
      try{
       await archiveFetch(archiveURL,{method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({action:"restore",id,expectedRevision:treeSavedRevision})});
       dialog.close();await load();
      }catch(error){status.textContent=error.message;restore.disabled=false}
     };
     actions.append(restore);
    }
    dialog.append(actions);document.body.append(dialog);
    dialog.addEventListener("close",()=>dialog.remove(),{once:true});dialog.showModal();
   }catch(error){status.textContent=error.message}
  }
  const archiveTreeItem=async node=>{
   if(!node||!canEdit())return;
   const descendantCount=nodes.filter(n=>n.parentId===node.id).length;
   const message="Archive \""+node.name+"\"?\\n\\nThis removes it from the active feature tree and BOM, preserves its saved information under the parent assembly, and allows restoration."+
    (descendantCount?"\\nIts nested items will be archived too.":"");
   if(!await window.BSDialogs.danger(message,{title:"Archive "+(isPartNode(node)?"part":"subassembly")+"?",confirmLabel:"Archive"}))return;
   const parent=node.parentId??null;
   const result=await archiveFetch(archiveURL,{method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({action:"archive",nodeId:node.id,expectedRevision:treeSavedRevision})});
   if(selected!==null&&!result.nodes.some(active=>active.id===selected)){
    selected=parent;
    history.replaceState(null,"",workspaceHash(selected));
   }
   status.textContent=node.name+" archived. You can restore it from its parent assembly.";
   await load();
   await refreshAssemblyArchives(parent??"__root__");
  };
  const openTreeMenu=(node,x,y,trigger)=>{
   if(!canEdit())return;
   closeTreeMenu();
   menuTarget=node;
   const isPart=isPartNode(node);
   const heading=document.createElement("div");heading.className="assembly-context-heading";
   const title=document.createElement("strong");title.textContent=node?.name||"Project";
   const subtitle=document.createElement("span");subtitle.textContent=isPart?"Part actions":"Assembly actions";
   heading.append(title,subtitle);treeMenu.append(heading);
   const sectionLabel=text=>{
    const el=document.createElement("div");el.className="assembly-context-section-label";
    el.textContent=text;treeMenu.append(el);
   };
   sectionLabel("Create");
   const addItem=(label,action,disabled=false)=>{
    const button=document.createElement("button");
    button.type="button";button.setAttribute("role","menuitem");
    button.textContent=label;button.disabled=disabled;
    button.onclick=async()=>{
     closeTreeMenu();
     try{await action()}catch(error){status.textContent=error.message}
    };
    treeMenu.append(button);
   };
   addItem("Add part",()=>{useTreeTarget(node);render();root.querySelector(".assembly-add-part").click()});
   addItem("Add subassembly",()=>{useTreeTarget(node);render();root.querySelector(".assembly-add").click()});
   const separator=document.createElement("div");separator.className="assembly-context-separator";separator.setAttribute("role","separator");treeMenu.append(separator);
   sectionLabel("Edit");
   addItem("Rename",()=>node?renameTreeItem(node):editProjectName.click());
   if(isPart)addItem(isToolNode(node)?"Mark as build component":"Mark as tool",async()=>{
    const res=await fetch("/api/components?project="+encodeURIComponent(project)+"&id="+encodeURIComponent(node.partId),{method:"PATCH",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({isTool:!isToolNode(node),expectedRevision:partQuantities.get(node.partId)?.revision??null})});
    const data=await res.json();if(!res.ok)throw Error(data.error||"Could not update tool classification");syncPartNodes([data.component]);
   });
   if(isPart)addItem(isHiddenPart(node)?"Unhide on feature tree":"Hide on feature tree",async()=>{
    const res=await fetch("/api/components?project="+encodeURIComponent(project)+"&id="+encodeURIComponent(node.partId),{method:"PATCH",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({hideFromFeatureTree:!isHiddenPart(node),expectedRevision:partQuantities.get(node.partId)?.revision??null})});
    const data=await res.json();if(!res.ok)throw Error(data.error||"Could not change visibility");syncPartNodes([data.component]);
   });
   if(node)addItem("Archive",()=>archiveTreeItem(node));
   if(node)addItem("Delete",()=>deleteTreeItem(node));
   if(node){
    const moveSeparator=document.createElement("div");
    moveSeparator.className="assembly-context-separator";moveSeparator.setAttribute("role","separator");treeMenu.append(moveSeparator);
    sectionLabel("Move");
    const moveButtons=[...root.querySelectorAll(".assembly-move-button")];
    for(const [label,index] of [["Move up",0],["Move down",1],["Move to…",2]]){
     addItem(label,()=>{
      selected=node.id;
      render();
      moveButtons[index]?.click();
     });
    }
   }
   treeMenu.hidden=false;
   treeMenu.style.left=Math.max(8,Math.min(x,window.innerWidth-treeMenu.offsetWidth-8))+"px";
   treeMenu.style.top=Math.max(8,Math.min(y,window.innerHeight-treeMenu.offsetHeight-8))+"px";
   if(trigger)treeMenu.dataset.target=trigger.textContent.trim();
   treeMenu.querySelector('button:not([disabled])')?.focus();
  };
  // Independent display filters leave all part records, BOM quantities and workspaces intact.
  const treeVisibilityControl=document.createElement("fieldset");treeVisibilityControl.className="assembly-tree-filters";
  const filterTitle=document.createElement("legend");filterTitle.textContent="Show / hide items in feature tree";treeVisibilityControl.append(filterTitle);
  const filterOption=(label,apply)=>{
   const wrapper=document.createElement("label");const input=document.createElement("input");input.type="checkbox";
   wrapper.append(input,document.createTextNode(label));input.onchange=()=>{apply(input.checked);render()};treeVisibilityControl.append(wrapper);return input;
  };
  const workshopFilter=filterOption("Show Workshop items",value=>{showWorkshopItems=value});
  const documentsFilter=filterOption("Show documents",value=>{showTreeDocuments=value});
  const descriptionsFilter=filterOption("Show descriptions",value=>{showTreeDescriptions=value});
  const hiddenPartsFilter=filterOption("Show hidden parts",value=>{showHiddenParts=value});
  workshopFilter.checked=showWorkshopItems;
  documentsFilter.checked=showTreeDocuments;
  descriptionsFilter.checked=showTreeDescriptions;
  hiddenPartsFilter.checked=showHiddenParts;
  nodesEl.parentNode.insertBefore(treeVisibilityControl,nodesEl);
  const partsEntry=document.createElement("button");
  partsEntry.type="button";partsEntry.textContent="Parts Management";
  partsEntry.className="assembly-project-summary-entry assembly-project-parts-entry";
  partsEntry.onclick=()=>{history.pushState(null,"","#"+project+"/parts");render();notify();window.scrollTo(0,0)};

  function render(){nodesEl.replaceChildren();
   workshopFilter.checked=showWorkshopItems;documentsFilter.checked=showTreeDocuments;descriptionsFilter.checked=showTreeDescriptions;hiddenPartsFilter.checked=showHiddenParts;
   controls.classList.toggle("hide",!canEdit()||isProjectSummary());projectActions.classList.toggle("hide",!canEdit());
   const summaryEntry=document.createElement("button");summaryEntry.type="button";summaryEntry.className="assembly-project-summary-entry"+(isProjectSummary()?" selected":"");
   summaryEntry.textContent="Project summary";summaryEntry.setAttribute("aria-current",isProjectSummary()?"page":"false");
   const pendingCount=window.BSReview?.getPendingCount?.(project);
   if(Number.isInteger(pendingCount)&&pendingCount>0&&canEdit()){
    summaryEntry.classList.add("has-pending-changes");
    const count=document.createElement("span");count.className="assembly-summary-pending-count";
    count.textContent=pendingCount+" "+(pendingCount===1?"change":"changes")+" waiting";
    summaryEntry.append(count);
   }
   summaryEntry.onclick=()=>{selected=null;history.pushState(null,"","#"+project);render();notify();window.scrollTo(0,0)};
   summaryCard.replaceChildren(summaryEntry,partsEntry,settingsEntry);
   settingsEntry.hidden=!window.BSProjectManager?.isOwner?.(project);
   settingsEntry.classList.toggle("selected",settingsRoute());
   settingsEntry.setAttribute("aria-current",settingsRoute()?"page":"false");
   backupDetails.hidden=!adminAuthenticated&&!window.BSProjectManager?.isOwner?.(project);
   // Project utilities live below, outside the actual feature tree.
   partsEntry.className="assembly-project-summary-entry assembly-project-parts-entry"+(partsRoute()?" selected":"");
   partsEntry.setAttribute("aria-current",partsRoute()?"page":"false");
   // Duplicate links to one part under the same assembly render once. Keep
   // all original nodes and their IDs untouched for storage and BOM accuracy.
   const duplicateLinks=new Map(),visiblePartLinks=new Set();
   for(const item of nodes){
    if(!isPartNode(item)||!includeTreeNode(item))continue;
    const group=String(item.parentId)+"|"+item.partId;
    const count=duplicateLinks.get(group)||0;
    duplicateLinks.set(group,count+1);
    if(count===0)visiblePartLinks.add(item.id);
   }
   const row=(node,depth)=>{
   const id=node?.id??null,children=nodes.filter(n=>n.parentId===id&&includeTreeNode(n)&&(!isPartNode(n)||visiblePartLinks.has(n.id))),el=document.createElement("div");el.className="assembly-node"+(selected===id&&!isProjectSummary()&&!settingsRoute()?" selected":"")+(node&&isHiddenPart(node)?" is-hidden-part":"")+(node&&isToolNode(node)?" is-tool-part":"");el.style.paddingLeft=(depth*17+3)+"px";
   const expand=document.createElement("button");expand.type="button";expand.className="assembly-expander";expand.textContent=children.length?(expanded.has(id)?"▾":"▸"):" ";expand.setAttribute("aria-label",expanded.has(id)?"Collapse":"Expand");expand.onclick=()=>{expanded.has(id)?expanded.delete(id):expanded.add(id);render()};
   const name=document.createElement("button");name.type="button";name.className="assembly-name";
   const nodeNumber=node?(isPartNode(node)?partNumbers.get(node.partId):node.partNumber):null;
   const treeInfo=isPartNode(node)?partTreeLabels.get(node.partId):null;
   const firstLine=treeInfo?.details?.value?window.BSPartFields.displayName({name:node?.name,projectDetails:treeInfo.details}):treeInfo?.mpn||nodeNumber||node?.name||title;
   const treeDetails=treeInfo?.details||{};
   const secondLine=String(treeDescription(treeDetails,treeInfo?.description)||(node?.name!==firstLine?node?.name:"")||(partWorkshopItems.get(node?.partId)?"Description not set":"")||"").trim();
   name.textContent=node?(isDocumentNode(node)?"📄  ":isToolNode(node)?"🛠  ":isPartNode(node)?"🔩  ":"📦  ")+(isPartNode(node)?firstLine:(nodeNumber?nodeNumber+" · ":"")+node.name):"📦  "+title;
   if(isPartNode(node)&&showTreeDescriptions&&treeDetails.showTreeDescription!=="false"&&secondLine&&secondLine!==firstLine){
    const detail=document.createElement("small");detail.className="assembly-tree-description";detail.textContent=secondLine;name.append(detail);
   }
   if(isPartNode(node)){
    const quantity=partQuantities.get(node.partId)?.quantity,links=duplicateLinks.get(String(node.parentId)+"|"+node.partId)||1;
    const count=Number.isFinite(quantity)&&quantity>1?Math.max(quantity,links):links;
    if(count>1)name.firstChild.textContent+=" ("+count+")";
    const status=partProgress.get(node.partId);
    if(status==="complete"||status==="in_progress")el.classList.add("part-progress-"+status);
    const needsAttention=partAttention.get(node.partId);
    if(needsAttention){el.classList.add("part-needs-attention");name.title="Needs attention — open part to view the reminder"}
    if(needsAttention||status==="complete"||status==="in_progress"){
     const marker=document.createElement("span");marker.className="assembly-tree-status-marker";
     marker.textContent=needsAttention?"⚑":status==="complete"?"✓":"◐";
     marker.title=needsAttention?"Needs attention":status==="complete"?"Complete":"In progress";
     marker.setAttribute("role","img");marker.setAttribute("aria-label",marker.title);
     // Keep status beside the name, before the optional description's block.
     name.insertBefore(marker,name.querySelector(".assembly-tree-description"));
    }
   }
   if(isPartNode(node)&&partRoute()===node.partId)el.classList.add("selected");name.onclick=()=>{if(isPartNode(node)){openTreePart(node);return}selected=id;history.pushState(null,"",workspaceHash(id));render();notify();window.scrollTo(0,0)};
   el.append(expand,name);
   if(canEdit()){
    el.addEventListener("contextmenu",event=>{
     event.preventDefault();event.stopPropagation();
     openTreeMenu(node,event.clientX,event.clientY,name);
    });
    name.addEventListener("keydown",event=>{
     if(event.key==="ContextMenu"||(event.shiftKey&&event.key==="F10")){
      event.preventDefault();
      const bounds=name.getBoundingClientRect();
      openTreeMenu(node,bounds.left+14,bounds.bottom+4,name);
     }
    });
    const more=document.createElement("button");
    more.type="button";more.className="assembly-row-menu-trigger";
    more.textContent="⋯";more.setAttribute("aria-label","Actions for "+(node?.name||title));
    more.setAttribute("aria-haspopup","menu");
    more.onclick=event=>{
     event.stopPropagation();
     const bounds=more.getBoundingClientRect();
     openTreeMenu(node,bounds.right,bounds.bottom+4,more);
    };
    el.append(more);
   }
   if(node&&canEdit()){
    el.draggable=true;el.title="Drag onto a sibling to reorder. Drop onto another assembly to move inside it; hold Alt to nest under a sibling.";
    el.ondragstart=event=>{event.dataTransfer.setData("text/plain",node.id);event.dataTransfer.effectAllowed="move";el.classList.add("assembly-dragging")};
    el.ondragend=()=>el.classList.remove("assembly-dragging");
    el.ondragover=event=>{const dragged=Array.from(event.dataTransfer.types).includes("text/plain");if(!dragged)return;event.preventDefault();el.classList.add("assembly-drop-target");event.dataTransfer.dropEffect="move"};
    el.ondragleave=()=>el.classList.remove("assembly-drop-target");
    el.ondrop=async event=>{
     event.preventDefault();event.stopPropagation();el.classList.remove("assembly-drop-target");
     const sourceId=event.dataTransfer.getData("text/plain"),source=nodes.find(n=>n.id===sourceId);
     if(!source||source.id===node.id)return;
     try{
      // A drop onto a sibling always reorders. Previously only the top/bottom
      // quarter reordered, so ordinary center drops tried to nest parts instead.
      // Hold Alt while dropping onto an assembly to deliberately nest it.
      const rect=el.getBoundingClientRect(),after=event.clientY>=rect.top+rect.height/2;
      if(source.parentId===node.parentId&&!event.altKey){
       const next=[...nodes],from=next.findIndex(n=>n.id===source.id);
       const item=next.splice(from,1)[0];let to=next.findIndex(n=>n.id===node.id);
       if(after)to++;next.splice(to,0,item);
       if(next.every((entry,i)=>entry.id===nodes[i].id))return;
       await save(next);status.textContent="Feature tree reordered.";
      }else await reparent(source.id,node.id);
     }catch(e){status.textContent=e.message}
    };
   }else if(!node&&canEdit()){
    el.ondragover=event=>{event.preventDefault();el.classList.add("assembly-drop-target")};
    el.ondragleave=()=>el.classList.remove("assembly-drop-target");
    el.ondrop=async event=>{event.preventDefault();el.classList.remove("assembly-drop-target");const sourceId=event.dataTransfer.getData("text/plain");if(nodes.some(n=>n.id===sourceId))try{await reparent(sourceId,null)}catch(e){status.textContent=e.message}};
   }
   nodesEl.append(el);
   if(expanded.has(id))children.forEach(child=>row(child,depth+1));
  };row(null,0);status.textContent="";renderTiles()}
  const newPartButton=document.createElement("button");newPartButton.type="button";newPartButton.className="btn assembly-add-part";newPartButton.textContent="+ Part";newPartButton.title="Create a BOM part inside the selected assembly";
  controls.prepend(newPartButton);
  newPartButton.onclick=async()=>{
   const parent=nodes.find(node=>node.id===selected);
   if(isPartNode(parent)){status.textContent="Select an assembly, not a part, before adding a new part.";return}
   if(!window.BSLibraryPartPicker){status.textContent="Part library is still loading. Refresh and try again.";return}
   await window.BSLibraryPartPicker.open({onCreate:async payload=>{
    newPartButton.disabled=true;status.textContent="Creating part…";
    let newPart=null;
    try{
     const info=payload.wireInfo||null;
     let wireId=info?.wireId||null;
     if(info&&!wireId){
      const listResponse=await fetch("/api/wires",{cache:"no-store"}),listData=await listResponse.json();
      if(!listResponse.ok)throw Error(listData.error||"Unable to load wire library");
      const existing=(listData.wires||[]).find(w=>String(w.awg).replace(/\\s*awg/i,"").trim()===String(info.gauge)&&
       (info.construction==="solid"?/solid/i.test(w.construction||""):info.construction==="braided"?/braid/i.test(w.construction||""):/strand/i.test(w.construction||""))&&String(w.insulation||"")===String(info.insulation||""));
      if(existing)wireId=existing.id;
      else{
       const label=info.gauge+" AWG "+info.construction+" copper (construction to verify)";
       const newWire=await fetch("/api/wires",{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({name:label,awg:String(info.gauge),construction:info.construction,insulation:info.insulation,notes:"Created through feature-tree part selection. Verify conductor material, insulation and crimp compatibility before use."})});
       const wireData=await newWire.json();if(!newWire.ok)throw Error(wireData.error||"Unable to save wire material");
       wireId=wireData.wire.id;
      }
     }
     const {wireInfo,workshopSavedMessage="",addToWorkshop=false,workshopCategory="",...part}=payload;
     if(wireId){part.sharedPartRef="wire:"+wireId;part.specifications.push({name:"Library wire ID",value:wireId,source:"explicit"})}
     const res=await fetch("/api/components?project="+encodeURIComponent(project),{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({assemblyId:selected,...part})});
     const data=await res.json();if(!res.ok)throw Error(data.error||"Unable to create part");
     newPart=data.component;
     if(info?.crimp&&wireId){
      const harnessResponse=await fetch("/api/harness?project="+encodeURIComponent(project)+"&part="+encodeURIComponent(newPart.id),{
       method:"PUT",credentials:"same-origin",headers:{"content-type":"application/json"},
       body:JSON.stringify({cuts:[{wireId,qty:part.quantity,cutLengthMm:info.mm,endA:info.endA,endB:info.endB,stripAmm:0,stripBmm:0}]})
      });
      const harnessData=await harnessResponse.json();
      if(!harnessResponse.ok)throw Error(harnessData.error||"Unable to save harness cutting list");
     }
     partVisibility.set(newPart.id,newPart.hideFromFeatureTree===true);
     partTools.set(newPart.id,newPart.isTool===true);
     partWorkshopItems.set(newPart.id,!!newPart.sharedPartRef||!!newPart.workshopChoice||!!newPart.projectDetails?.workshopReferenceId||newPart.isTool===true);
     partDocuments.set(newPart.id,newPart.itemType==="document");
      partTreeLabels.set(newPart.id,{mpn:newPart.model||"",description:newPart.description||"",details:newPart.projectDetails||{},defaultPicture:defaultPartPicture(newPart)});
     if(newPart.partNumber)partNumbers.set(newPart.id,newPart.partNumber);
     const next=[...nodes,{id:crypto.randomUUID(),kind:"part",partId:newPart.id,name:newPart.name,parentId:selected}];
     await save(next);expanded.add(selected);
     if(!newPart.hideFromFeatureTree&&!newPart.isTool)openTreePart(next[next.length-1]);
     status.textContent="Part added to the feature tree and BOM."+(workshopSavedMessage?" "+workshopSavedMessage:"");
    }catch(error){
     if(newPart)await fetch("/api/components?project="+encodeURIComponent(project)+"&id="+encodeURIComponent(newPart.id),{method:"DELETE",credentials:"same-origin"}).catch(()=>{});
     status.textContent="Could not add part: "+error.message;throw error;
    }finally{newPartButton.disabled=false}
   }});
  };
  const assemblyDialog=document.createElement("dialog");
  assemblyDialog.className="assembly-create-dialog";
  assemblyDialog.innerHTML='<form class="assembly-create-form" method="dialog"><h2>New assembly</h2><p class="muted">Choose a project part number for this assembly.</p><fieldset class="assembly-number-choice"><legend>Assembly number</legend><label><input type="radio" name="assembly-number-mode" value="auto" checked> Assign next available assembly number</label><label><input type="radio" name="assembly-number-mode" value="manual"> Enter an assembly number</label></fieldset><label class="assembly-manual-number" hidden>Assembly number<input type="text" class="field assembly-number-input" placeholder="NR0001" maxlength="30" autocomplete="off"></label><p class="muted assembly-number-hint">Assembly numbers use the project prefix and reserved range 0001–1000.</p><label>Assembly name<input class="field assembly-new-name" type="text" maxlength="100" required placeholder="Enter assembly name"></label><p class="assembly-create-status" role="status"></p><div class="assembly-create-actions"><button type="button" class="btn assembly-create-cancel">Cancel</button><button type="submit" class="btn primary assembly-create-submit">Create assembly</button></div></form>';
  document.body.append(assemblyDialog);
  const assemblyForm=assemblyDialog.querySelector("form");
  const manualAssemblyRow=assemblyDialog.querySelector(".assembly-manual-number");
  const manualAssemblyInput=assemblyDialog.querySelector(".assembly-number-input");
  const assemblyNameInput=assemblyDialog.querySelector(".assembly-new-name");
  const assemblyError=assemblyDialog.querySelector(".assembly-create-status");
  const assemblySubmit=assemblyDialog.querySelector(".assembly-create-submit");
  const assemblyNumberMode=()=>assemblyDialog.querySelector('input[name="assembly-number-mode"]:checked')?.value||"auto";
  assemblyDialog.querySelectorAll('input[name="assembly-number-mode"]').forEach(input=>input.onchange=()=>{
   const manual=assemblyNumberMode()==="manual";
   manualAssemblyRow.hidden=!manual;manualAssemblyInput.required=manual;
   if(manual)manualAssemblyInput.focus();
  });
  assemblyDialog.querySelector(".assembly-create-cancel").onclick=()=>assemblyDialog.close();
  assemblyForm.onsubmit=async event=>{
   event.preventDefault();if(!assemblyForm.reportValidity())return;
   const parentId=selected,name=assemblyNameInput.value.trim();
   if(!name){assemblyError.textContent="Enter an assembly name.";return}
   if(isPartNode(nodes.find(n=>n.id===parentId))){assemblyError.textContent="Select an assembly first.";return}
   const numberMode=assemblyNumberMode(),partNumber=manualAssemblyInput.value.trim().toUpperCase();
   if(numberMode==="manual"&&!partNumber){assemblyError.textContent="Enter an assembly number.";return}
   assemblySubmit.disabled=true;assemblyError.textContent="Creating assembly…";
   const id=crypto.randomUUID();
   try{
    await save([...nodes,{id,name,parentId,kind:"assembly",numberMode,...(numberMode==="manual"?{partNumber}:{})}]);
    expanded.add(parentId);selected=id;render();notify();assemblyDialog.close();
   }catch(error){assemblyError.textContent=error.message}
   finally{assemblySubmit.disabled=false}
  };
  root.querySelector(".assembly-add").onclick=()=>{
   if(isPartNode(nodes.find(n=>n.id===selected))){status.textContent="Select an assembly first; parts cannot contain children.";return}
   assemblyForm.reset();manualAssemblyRow.hidden=true;manualAssemblyInput.required=false;assemblyError.textContent="";
   assemblyDialog.showModal();assemblyNameInput.focus();
  };
  root.querySelector(".assembly-rename").onclick=async()=>{if(selected===null){status.textContent="Select a subassembly to rename.";return}const node=nodes.find(n=>n.id===selected),name=await window.BSDialogs.prompt("Enter a new name",node.name,{title:"Rename subassembly",label:"Name"});if(!name?.trim())return;try{await save(nodes.map(n=>n.id===selected?{...n,name:name.trim()}:n))}catch(e){status.textContent=e.message}};
  root.querySelector(".assembly-remove").onclick=async()=>{if(selected===null){status.textContent="Select a subassembly to delete.";return}const node=nodes.find(n=>n.id===selected);if(!await window.BSDialogs.danger("Delete "+node.name+" and its nested subassemblies? Existing BOM components will remain in the project but may become unassigned.",{title:"Delete subassembly?"}))return;const removed=new Set([selected]);let changed=true;while(changed){changed=false;for(const n of nodes)if(removed.has(n.parentId)&&!removed.has(n.id)){removed.add(n.id);changed=true}}try{await save(nodes.filter(n=>!removed.has(n.id)));selected=null;render();notify()}catch(e){status.textContent=e.message}};
  load();
 })
}
