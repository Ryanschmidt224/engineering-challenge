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
 document.querySelectorAll("[data-assembly-tree]").forEach(root=>{
  const project=root.dataset.assemblyTree,view=document.getElementById(project),nodesEl=root.querySelector(".assembly-tree-nodes"),status=root.querySelector(".assembly-tree-status"),controls=root.querySelector(".assembly-edit");
  let title=view.querySelector(".assembly-main h1")?.textContent||"Project";let nodes=[],selected=null,expanded=new Set([null]);
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
  const oldRootTile=main.querySelector(".assembly-unified-tile");
  // Some legacy project sections have no unified root tile. Do not let one
  // incomplete section abort initialization of every subsequent project.
  if(!oldRootTile){console.warn("Skipping assembly controller without root tile:",project);return;}
  const rootBom=oldRootTile.querySelector(".component-section");
  const rootStatus=oldRootTile.querySelector(".root-photo-status");
  const newRootTile=createUnifiedTile();
  newRootTile.classList.add("assembly-main-tile");
  newRootTile.querySelector(".assembly-content-tiles").append(rootBom);
  oldRootTile.replaceWith(newRootTile);
  if(rootStatus)main.insertBefore(rootStatus,newRootTile.nextSibling);
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
  // The Projects landing page also exposes a small editing entry point.
  // Project names are edited here; photos use the shared workspace image editor.
  const landingCard=document.querySelector('.project-link[data-nav="'+project+'"]')?.closest(".project-card");
  const cardEdit=document.createElement("button");
  cardEdit.type="button";cardEdit.className="btn project-card-edit hide";
  cardEdit.textContent="Edit project";
  cardEdit.setAttribute("aria-label","Rename project");
  if(landingCard)landingCard.append(cardEdit);
  cardEdit.onclick=()=>{
   navigate(project);
   main.scrollIntoView({block:"start",behavior:"instant"});
   editProjectName.focus();
  };
  const updateProjectTitle=value=>{
   title=value;
   projectHeading.textContent=value;
   const card=document.querySelector('.project-link[data-nav="'+project+'"]');
   const cardHeading=card?.querySelector(".project-copy h2");
   if(cardHeading)cardHeading.textContent=value;
   if(card)card.setAttribute("aria-label","Open "+value+" project");
   render();
  };
  const refreshProjectCover=async()=>{
   const card=document.querySelector('.project-link[data-nav="'+project+'"]');
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
     image.src=cover.url;
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
   const value=prompt("Project name",title);
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
    updateProjectTitle(data.title);
    projectMetaStatus.textContent="Project name saved.";
   }catch(error){projectMetaStatus.textContent=error.message}
   finally{editProjectName.disabled=false}
  };
  // Shared image tile renderer for root projects and all subassemblies.
  function makeAssemblyPhotoStage(photos,name,onAdd,onDelete,allowEditing=false){
   let active=0;
   const stage=document.createElement("div");stage.className="assembly-photo-stage";
   const picture=document.createElement("img");picture.className="assembly-stage-image";picture.alt="";
   const empty=document.createElement("div");empty.className="assembly-photo-placeholder";empty.textContent="No photo yet";
   const prev=document.createElement("button"),next=document.createElement("button");
   prev.type=next.type="button";prev.className="assembly-photo-arrow previous";next.className="assembly-photo-arrow next";prev.textContent="‹";next.textContent="›";prev.setAttribute("aria-label","Previous photo");next.setAttribute("aria-label","Next photo");
   const label=document.createElement("span");label.className="assembly-photo-name";label.textContent=name;
   const actions=document.createElement("div");actions.className="assembly-photo-actions";
   const add=document.createElement("button");add.type="button";add.className="assembly-photo-icon";add.textContent="+";add.title="Add photo";add.setAttribute("aria-label","Add photo");add.onclick=onAdd;
   const del=document.createElement("button");del.type="button";del.className="assembly-photo-icon";del.textContent="×";del.title="Delete current photo";del.setAttribute("aria-label","Delete current photo");del.onclick=()=>onDelete(photos[active]);
   if(adminAuthenticated&&allowEditing)actions.append(add,del);
   const show=()=>{const p=photos[active];picture.hidden=!p;empty.hidden=!!p;if(p){picture.src=p.url;picture.alt=p.caption||name}else picture.removeAttribute("src");prev.hidden=next.hidden=photos.length<2;del.hidden=!p};
   prev.onclick=()=>{active=(active+photos.length-1)%photos.length;show()};
   next.onclick=()=>{active=(active+1)%photos.length;show()};
   stage.append(picture,empty,prev,next,label,actions);show();return stage;
  }
  // Separate workspace route; the existing assembly overview remains unchanged.
  const workspace=document.createElement("section");workspace.className="assembly-workspace-page hide";
  workspace.innerHTML='<button type="button" class="btn workspace-back">← Assembly overview</button><div class="workspace-heading"><div class="workspace-cover"><span>No photo yet</span></div><div><h1 class="workspace-title"></h1><p class="muted">Workspace</p></div></div><section class="workspace-panels"><article class="workspace-bom"><div class="workspace-bom-heading"><h2>Bill of materials</h2><button type="button" class="btn primary workspace-new-part">+ New BOM-only part</button></div><div class="workspace-saved-parts" aria-live="polite">Loading saved parts…</div><div class="workspace-bom-mount"></div></article><article class="recipe-instructions"><h2>Work instructions</h2></article><article class="workspace-resources"></article><div class="workspace-actions"><button type="button" class="btn primary workspace-save">Save workspace</button><span class="workspace-status" role="status"></span></div></section>';
  detail.after(workspace);
  // Assembly photo management lives in the workspace, not the read-only overview.
  const workspacePhotoEditor=document.createElement("article");
  workspacePhotoEditor.className="workspace-photos-editor is-editing-photo";
  workspacePhotoEditor.innerHTML='<h2>Assembly photos</h2><p class="muted">Browse, add, or delete assembly photos.</p><div class="assembly-unified-photo"><div class="assembly-photos"></div></div><div class="workspace-photo-tools"><div class="assembly-photo-admin hide"><div class="assembly-photo-zone"><button type="button" class="assembly-photo-pick">+ Add photo</button><input class="assembly-photo-input" type="file" accept="image/*,.heic,.heif" hidden><span class="assembly-photo-drop-hint">or drop an image here</span></div><label class="assembly-photo-caption-label">Caption <input class="field assembly-photo-caption" placeholder="Photo description"></label></div></div><p class="workspace-photo-status muted" role="status" aria-live="polite"></p>';
  const photoDialog=document.createElement("dialog");
  photoDialog.className="workspace-photo-dialog";
  photoDialog.setAttribute("aria-label","Edit assembly photos");
  const dialogHeader=document.createElement("div");
  dialogHeader.className="workspace-photo-dialog-header";
  const closePhotoDialog=document.createElement("button");
  closePhotoDialog.type="button";closePhotoDialog.className="btn workspace-photo-close";
  closePhotoDialog.textContent="Done";
  closePhotoDialog.onclick=()=>photoDialog.close();
  dialogHeader.append(closePhotoDialog);photoDialog.append(dialogHeader,workspacePhotoEditor);
  workspace.append(photoDialog);
  photoDialog.addEventListener("click",event=>{if(event.target===photoDialog)photoDialog.close()});
  const cover=workspace.querySelector(".workspace-cover");
  const coverShell=document.createElement("div");coverShell.className="workspace-cover-shell";
  cover.before(coverShell);coverShell.append(cover);
  const openPhotoEditor=document.createElement("button");openPhotoEditor.type="button";
  openPhotoEditor.className="workspace-photo-launch";
  openPhotoEditor.textContent="✎";openPhotoEditor.title="Edit assembly image";
  openPhotoEditor.setAttribute("aria-label","Edit assembly image");
  coverShell.append(openPhotoEditor);
  openPhotoEditor.onclick=()=>{
   if(!adminAuthenticated)return;
   photoDialog.showModal();
   void workspacePhotoController.refresh();
  };
  const workspacePhotoController=createPhotoController(workspacePhotoEditor,()=>selected,
   workspacePhotoEditor.querySelector(".workspace-photo-status"),true);
  // The feature tree and the assembly BOM share one persistent left sidebar.
  // The BOM is shown only on an assembly workspace, never on its overview.
  const assemblyLayout=view.querySelector(".assembly-layout");
  const sidebar=root;
  const bomPanel=workspace.querySelector(".workspace-bom");
  sidebar.append(bomPanel);
  // Keep the existing feature-tree controls and their handlers intact while
  // grouping them in a distinct panel beside the BOM panel.
  const featureTreeFrame=document.createElement("div");
  featureTreeFrame.className="feature-tree-frame";
  while(sidebar.firstChild&&sidebar.firstChild!==bomPanel)featureTreeFrame.append(sidebar.firstChild);
  sidebar.insertBefore(featureTreeFrame,bomPanel);
  const bomResizer=document.createElement("div");
  bomResizer.className="workspace-bom-resizer";
  bomResizer.setAttribute("role","separator");
  bomResizer.setAttribute("tabindex","0");
  bomResizer.setAttribute("aria-orientation","vertical");
  bomResizer.setAttribute("aria-label","Resize feature tree and BOM sidebar");
  bomResizer.setAttribute("aria-valuemin","20");
  bomResizer.setAttribute("aria-valuemax","70");
  assemblyLayout.insertBefore(bomResizer,view.querySelector(".assembly-content"));
  const bomWidthKey="bs-workspace-bom-width";
  const clampSidebarWidth=value=>{
   const available=assemblyLayout.getBoundingClientRect().width;
   return Math.round(Math.max(290,Math.min(Number(value)||available*.30,available-390)));
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
   const next=event.key==="Home"?290:event.key==="End"?available-390:
    current+(event.key==="ArrowRight"?32:-32);
   const width=setBomWidth(next);
   try{localStorage.setItem(bomWidthKey,String(width))}catch{}
  });
  // Each saved BOM part has its own independent instructions document.
  const partWorkspace=document.createElement("section");partWorkspace.className="assembly-workspace-page bom-part-workspace hide";
  partWorkspace.innerHTML='<button type="button" class="btn part-workspace-back">← Assembly BOM</button><div class="workspace-heading"><div class="workspace-cover part-workspace-cover"><span>No picture yet</span></div><div><h1 class="part-workspace-title">Part instructions</h1><p class="muted">Part build instructions</p></div></div><section class="workspace-panels"><article class="recipe-instructions"><h2>Work instructions</h2></article><article class="part-harness-preview hide"><h2>Wire harness cutting list</h2><div class="part-harness-preview-content"></div></article><article class="part-linked-resources"></article><div class="workspace-actions"><button type="button" class="btn primary part-workspace-save">Save part instructions</button><span class="part-workspace-status" role="status"></span></div></section>';
  workspace.after(partWorkspace);
  // Safe project portability: export is read-only; import currently verifies only.
  // No operation here can overwrite or delete Cloudflare project records.
  const archiveActions=document.createElement("div");archiveActions.className="workspace-archive-actions";
  const backupButton=document.createElement("button");backupButton.type="button";backupButton.className="btn";backupButton.textContent="Download project backup";
  const inspectButton=document.createElement("button");inspectButton.type="button";inspectButton.className="btn";inspectButton.textContent="Check project backup";
  const archiveInput=document.createElement("input");archiveInput.type="file";archiveInput.accept=".bsproject,application/json";archiveInput.hidden=true;
  const archiveStatus=document.createElement("span");archiveStatus.className="muted workspace-archive-status";archiveStatus.setAttribute("role","status");
  const archiveUrl=()=>"/api/project/archive?project="+encodeURIComponent(project);
  backupButton.onclick=async()=>{
   if(!adminAuthenticated){archiveStatus.textContent="Administrator login required to export private data.";return}
   backupButton.disabled=true;archiveStatus.textContent="Preparing complete project archive…";
   try{
    const response=await fetch(archiveUrl(),{credentials:"same-origin",cache:"no-store"});
    if(!response.ok){const error=await response.json().catch(()=>({}));throw Error(error.error||"Project export failed")}
    const blob=await response.blob();
    const archive=JSON.parse(await blob.text());
    if(archive.format!=="building-schmidt-project"||archive.projectId!==project||archive.objectCount!==archive.objects?.length)throw Error("Archive response is incomplete");
    const url=URL.createObjectURL(blob);
    const link=document.createElement("a");link.href=url;link.download="building-schmidt-"+project+"-"+new Date().toISOString().slice(0,10)+".bsproject";
    document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),3000);
    archiveStatus.textContent="Downloaded "+archive.objectCount+" records. Keep a copy outside Cloudflare and verify it using Check project backup.";
   }catch(error){archiveStatus.textContent="Backup failed: "+error.message}
   finally{backupButton.disabled=false}
  };
  inspectButton.onclick=()=>{if(!adminAuthenticated){archiveStatus.textContent="Administrator login required to inspect backups.";return}archiveInput.click()};
  archiveInput.onchange=async()=>{
   const file=archiveInput.files?.[0];archiveInput.value="";if(!file)return;
   inspectButton.disabled=true;archiveStatus.textContent="Checking archive contents and checksums…";
   try{
    if(!window.BSArchiveCheck)throw Error("Archive checker not loaded");
    const data=await window.BSArchiveCheck.inspect(file,project);
    if(!window.BSLocalProject)throw Error("Local project reader unavailable");
    // Actually hydrate every record into an independent local store and rebuild
    // a project archive to prove that export/import retains the same bytes.
    const local=await window.BSLocalProject.open(JSON.parse(await file.text()));
    const recovered=await local.exportArchive();
    if(recovered.objectCount!==data.objectCount||recovered.totalBytes!==data.totalBytes)
     throw Error("Local recovery round-trip mismatch");
    const expected=JSON.parse(await file.text());
    const before=new Map(expected.objects.map(o=>[o.key,o.sha256]));
    for(const entry of recovered.objects){
     if(before.get(entry.key)!==entry.sha256)throw Error("Local recovery changed "+entry.key);
    }
    const model=local.model();
    archiveStatus.textContent="Verified and reopened locally: "+data.objectCount+" records, "+
     (model?.partDefinitions.length||0)+" parts, "+(model?.bomOccurrences.length||0)+" BOM entries. "+
     "All file checksums survived export/import. No upload or live data changes.";
   }catch(error){archiveStatus.textContent="Backup check failed: "+error.message}
   finally{inspectButton.disabled=false}
  };
  // An archive can be inspected entirely locally, or explicitly staged in a
  // separate recovery namespace. Neither operation overwrites project data.
  const recoveryButton=document.createElement("button");recoveryButton.type="button";
  recoveryButton.className="btn";recoveryButton.textContent="Create safe recovery copy";
  const recoveryInput=document.createElement("input");recoveryInput.type="file";
  recoveryInput.accept=".bsproject,application/json";recoveryInput.hidden=true;
  recoveryButton.onclick=()=>{if(!adminAuthenticated){archiveStatus.textContent="Administrator login required.";return}recoveryInput.click()};
  recoveryInput.onchange=async()=>{
   const file=recoveryInput.files?.[0];recoveryInput.value="";if(!file)return;
   recoveryButton.disabled=true;archiveStatus.textContent="Verifying archive locally…";
   try{
    if(!window.BSArchiveCheck)throw Error("Archive checker not loaded");
    const verified=await window.BSArchiveCheck.inspect(file,project);
    if(!confirm("Upload this verified archive ("+verified.objectCount+" records) as a SEPARATE recovery copy in Cloudflare? The active project will NOT be overwritten. No records will be deleted."))return;
    archiveStatus.textContent="Creating isolated recovery copy…";
    const response=await fetch("/api/project/staging?project="+encodeURIComponent(project),{
     method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:await file.text()
    });
    const data=await response.json();if(!response.ok)throw Error(data.error||"Recovery copy failed");
    archiveStatus.textContent="Isolated recovery copy verified. Recovery ID: "+data.id+". Active project unchanged.";
   }catch(error){archiveStatus.textContent="Recovery copy failed: "+error.message}
   finally{recoveryButton.disabled=false}
  };
  const historyButton=document.createElement("button");historyButton.type="button";
  historyButton.className="btn";historyButton.textContent="Automatic backups";
  const historyList=document.createElement("div");historyList.className="workspace-backup-history hide";
  historyButton.onclick=async()=>{
   if(!adminAuthenticated){archiveStatus.textContent="Administrator login required.";return}
   if(!historyList.classList.contains("hide")){historyList.classList.add("hide");return}
   historyButton.disabled=true;archiveStatus.textContent="Loading backup history…";
   try{
    const response=await fetch("/api/project/backups?project="+encodeURIComponent(project),{credentials:"same-origin",cache:"no-store"});
    const data=await response.json();if(!response.ok)throw Error(data.error||"Backups unavailable");
    historyList.replaceChildren();
    if(!data.backups?.length){historyList.textContent="No scheduled backups have been saved yet."}
    for(const entry of data.backups||[]){
     const row=document.createElement("div");row.className="workspace-backup-item";
     const label=document.createElement("span");
     label.textContent=(entry.date?new Date(entry.date).toLocaleDateString():"Backup")+" · "+entry.count+" records · "+Math.round(entry.size/1024)+" KB";
     const download=document.createElement("a");download.className="btn";
     download.textContent="Download";download.href="/api/project/backups?project="+encodeURIComponent(project)+"&id="+encodeURIComponent(entry.id);
     download.download=project+"-"+entry.id+".bsproject";
     row.append(label,download);historyList.append(row);
    }
    historyList.classList.remove("hide");
    archiveStatus.textContent="These copies remain in Cloudflare. Download one for an independent backup.";
   }catch(error){archiveStatus.textContent=error.message}
   finally{historyButton.disabled=false}
  };
  archiveActions.append(backupButton,inspectButton,recoveryButton,historyButton,archiveInput,recoveryInput,archiveStatus);
  // Backups are maintenance tools, not a primary step in building an assembly.
  // Keep them available below the workspace inside a collapsed disclosure.
  const backupDetails=document.createElement("details");
  backupDetails.className="workspace-backup-details";
  const backupSummary=document.createElement("summary");
  backupSummary.textContent="Project backups & recovery";
  backupDetails.append(backupSummary,archiveActions,historyList);
  workspace.append(backupDetails);
  const partDrawingPanel=window.BSDrawings?.mount(partWorkspace.querySelector(".part-drawing-panel"),()=>adminAuthenticated);
  const partFilesPanel=window.BSPartFiles?.mount(partWorkspace.querySelector(".part-files-panel"),()=>adminAuthenticated);

  const assemblyResourcePicker=window.BSResources?.mount(workspace.querySelector(".workspace-resources"));
  const partResourcePicker=window.BSResources?.mount(partWorkspace.querySelector(".part-linked-resources"));

  // Optional progressive disclosure: the textarea remains the simplest authoring tool.
  // Steps, test logs and history never require separate forms or mandatory fields.
  function installInstructionExtras(panel,prefix,onRestoreResources,onRestoreRecipe){
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
     if(adminAuthenticated){const remove=document.createElement("button");remove.type="button";remove.className="btn";remove.textContent="Remove";remove.onclick=()=>{experiments=experiments.filter(x=>x.id!==entry.id);renderLogs()};row.append(remove)}
     logEntries.append(row);
    }
    logDetails.classList.toggle("hide",experiments.length===0);
   };
   const historyDetails=document.createElement("details");historyDetails.className="instruction-history";
   const historySummary=document.createElement("summary");historySummary.textContent="Recent changes";
   const historyList=document.createElement("div");historyList.className="instruction-history-list";
   historyDetails.append(historySummary,historyList);panel.querySelector(prefix==="part"?".part-workspace-save":".workspace-save").after(historyDetails);
   function setData(data){
    experiments=Array.isArray(data?.experiments)?data.experiments.map(x=>({...x})):[];
    renderLogs();historyList.replaceChildren();
    const history=Array.isArray(data?.history)?[...data.history].reverse():[];
    for(const snapshot of history){
     const item=document.createElement("div");item.className="instruction-history-item";
     const label=document.createElement("span");
     label.textContent=new Date(snapshot.savedAt).toLocaleString();
     item.append(label);
     if(adminAuthenticated){
      const restore=document.createElement("button");restore.type="button";restore.className="btn";restore.textContent="Load this version";
      restore.onclick=()=>{
       experiments=Array.isArray(snapshot.experiments)?snapshot.experiments.map(x=>({...x})):[];
       renderLogs();onRestoreResources?.(snapshot.resources);onRestoreRecipe?.(snapshot);
       panel.querySelector(prefix==="part"?".part-workspace-status":".workspace-status").textContent="Previous version loaded. Click Save to keep it.";
      };
      item.append(restore);
     }
     historyList.append(item);
    }
    historyDetails.classList.toggle("hide",history.length===0);
   }
   return {setData,getExperiments:()=>experiments};
  }
  let investigations=null,investigationParts=[];
  const assemblyRecipe=window.BSRecipes?.mount(workspace.querySelector(".recipe-instructions"),{admin:()=>adminAuthenticated,project,renderInvestigations:(step,target)=>investigations?.showStep(target,step,"assembly",selected??"__root__"),onSave:()=>new Promise((resolve,reject)=>{if(!adminAuthenticated){reject(Error("Administrator login required"));return}const status=workspace.querySelector(".workspace-status");const observer=new MutationObserver(()=>{if(status.textContent==="Saved."){observer.disconnect();resolve()}else if(status.textContent&&status.textContent!=="Saving…"){observer.disconnect();reject(Error(status.textContent))}});observer.observe(status,{childList:true,subtree:true,characterData:true});workspace.querySelector(".workspace-save").click();})});
  const partRecipe=window.BSRecipes?.mount(partWorkspace.querySelector(".recipe-instructions"),{admin:()=>adminAuthenticated,project,renderInvestigations:(step,target)=>investigations?.showStep(target,step,"part",partRoute()),onSave:()=>new Promise((resolve,reject)=>{if(!adminAuthenticated){reject(Error("Administrator login required"));return}const status=partWorkspace.querySelector(".part-workspace-status");const observer=new MutationObserver(()=>{if(status.textContent==="Part instructions saved."){observer.disconnect();resolve()}else if(status.textContent&&status.textContent!=="Saving…"){observer.disconnect();reject(Error(status.textContent))}});observer.observe(status,{childList:true,subtree:true,characterData:true});partWorkspace.querySelector(".part-workspace-save").click();})});
  const assemblyInvestigationPanel=document.createElement("article");
  assemblyInvestigationPanel.className="investigations-panel";
  const partInvestigationPanel=document.createElement("article");
  partInvestigationPanel.className="investigations-panel";
  workspace.querySelector(".recipe-instructions").after(assemblyInvestigationPanel);
  partWorkspace.querySelector(".recipe-instructions").after(partInvestigationPanel);
  investigations=window.BSInvestigations?.mount({project,admin:()=>adminAuthenticated,getTree:()=>nodes,
   getPart:()=>currentPartInfo,getPartList:()=>investigationParts,
    onReplacePart:()=>detailsPanel.querySelector(".part-details-edit")?.click()});
  const assemblyExtras=installInstructionExtras(workspace,"workspace",resources=>assemblyResourcePicker?.setData(resources,adminAuthenticated),snapshot=>assemblyRecipe?.setData(snapshot));
  const partExtras=installInstructionExtras(partWorkspace,"part",resources=>partResourcePicker?.setData(resources,adminAuthenticated),snapshot=>partRecipe?.setData(snapshot));

  const detailsPanel=document.createElement("section");detailsPanel.className="part-details-view";
  detailsPanel.innerHTML='<details class="part-details-collapse"><summary class="part-details-view-heading"><h2>Part details</h2><span class="part-details-toggle-label">Show details</span></summary><div class="part-details-view-rows"></div><div class="part-details-view-actions"><button type="button" class="btn part-details-edit">Edit part details</button></div><div class="part-drawing-panel"></div><div class="part-files-panel"></div></details>';
  const partDetailsCollapse=detailsPanel.querySelector(".part-details-collapse");
  partDetailsCollapse.addEventListener("toggle",()=>{partDetailsCollapse.querySelector(".part-details-toggle-label").textContent=partDetailsCollapse.open?"Minimize details":"Show details"});
  partWorkspace.querySelector(".workspace-heading").after(detailsPanel);
  const detailRows=detailsPanel.querySelector(".part-details-view-rows");
  const renderPartDetails=part=>{
   detailRows.replaceChildren();
   const type=document.createElement("div");type.className="part-details-view-row";
   const typeLabel=document.createElement("strong");typeLabel.textContent="Part type";
   type.append(typeLabel,document.createTextNode(" - "+(part.partType==="custom"?"Custom":"Purchased")));
   detailRows.append(type);
   const fields=[["Full name",part.fullName||part.name],["Qty",part.quantity===null||part.quantity===undefined?"Not specified":String(part.quantity)+(part.quantityUnit?" "+part.quantityUnit:"")],...(part.partType!=="custom"&&part.historicalPrice!==null&&part.historicalPrice!==undefined&&Number.isFinite(Number(part.historicalPrice))?[["Historical part price",part.historicalPriceBasis==="per_package"?"$"+Number(part.historicalPurchasePrice??0).toFixed(2)+" per package of "+part.historicalPackageQuantity+" ($"+Number(part.historicalPrice).toFixed(4)+" per part)"+(part.historicalPriceDate?" · "+part.historicalPriceDate:""):"$"+Number(part.historicalPrice).toFixed(2)+" per part"+(part.historicalPriceDate?" · "+part.historicalPriceDate:"")]]:[]),...(part.partType==="custom"?[["Category",part.category]]:[["Manufacturer",part.manufacturer],["Model",part.model],["Category",part.category],["Supplier",part.supplier],["ASIN",part.asin]])];
   for(const [title,value] of fields){
    if(value===null||value===undefined||String(value).trim()==="")continue;
    const line=document.createElement("div");line.className="part-details-view-row";
    const label=document.createElement("strong");label.textContent=title;
    const separator=document.createElement("span");separator.textContent=" - ";
    const content=document.createElement("span");content.textContent=String(value);
    line.append(label,separator,content);detailRows.append(line);
   }
   if(part.specifications?.length){
    const heading=document.createElement("h3");heading.textContent="Specifications";detailRows.append(heading);
    for(const spec of part.specifications){
     const line=document.createElement("div");line.className="part-details-view-row";
     const label=document.createElement("strong");label.textContent=spec.name||"Specification";
     const separator=document.createElement("span");separator.textContent=" - ";
     const value=document.createElement("span");value.textContent=(spec.value||"")+(spec.source==="inferred"?" (inferred)":"");
     line.append(label,separator,value);detailRows.append(line);
    }
   }
   detailsPanel.classList.remove("hide");
  };

  let currentPartInfo=null;
  const pictureCover=partWorkspace.querySelector(".part-workspace-cover");
  const partCoverShell=document.createElement("div");partCoverShell.className="workspace-cover-shell";
  pictureCover.before(partCoverShell);partCoverShell.append(pictureCover);
  const editPartPicture=document.createElement("button");
  editPartPicture.type="button";editPartPicture.className="workspace-photo-launch";
  editPartPicture.textContent="✎";editPartPicture.title="Edit part image";
  editPartPicture.setAttribute("aria-label","Edit part image");editPartPicture.hidden=true;
  partCoverShell.append(editPartPicture);
  const partPhotoDialog=document.createElement("dialog");partPhotoDialog.className="workspace-photo-dialog part-photo-dialog";
  partPhotoDialog.setAttribute("aria-label","Edit part image");
  partPhotoDialog.innerHTML='<div class="workspace-photo-dialog-header"><button type="button" class="btn part-photo-done">Done</button></div><div class="workspace-photos-editor is-editing-photo"><h2>Part image</h2><p class="muted">Add, replace, or delete this part photo.</p><div class="assembly-unified-photo"><div class="part-photo-stage"><img class="part-photo-preview" alt="Part image"><span class="part-photo-placeholder">No picture yet</span></div></div><div class="workspace-photo-tools"><div class="part-photo-actions"><button type="button" class="btn part-photo-add">+ Add / replace image</button><button type="button" class="btn part-photo-delete">Delete image</button><input class="part-photo-file" type="file" accept="image/jpeg,image/png,image/webp" hidden></div></div><p class="part-photo-status muted" role="status" aria-live="polite"></p></div>';
  partWorkspace.append(partPhotoDialog);
  const partPhotoFile=partPhotoDialog.querySelector(".part-photo-file");
  const partPhotoAdd=partPhotoDialog.querySelector(".part-photo-add");
  const partPhotoDelete=partPhotoDialog.querySelector(".part-photo-delete");
  const partPhotoPreview=partPhotoDialog.querySelector(".part-photo-preview");
  const partPhotoPlaceholder=partPhotoDialog.querySelector(".part-photo-placeholder");
  const partPhotoStatus=partPhotoDialog.querySelector(".part-photo-status");
  partPhotoDialog.querySelector(".part-photo-done").onclick=()=>partPhotoDialog.close();
  partPhotoDialog.addEventListener("click",event=>{if(event.target===partPhotoDialog)partPhotoDialog.close()});
  function showPartPicture(partId,bust=false){
   if(!partId)return;
   const src=partPhotoUrl(partId)+(bust?"&v="+Date.now():"");
   const image=document.createElement("img");image.src=src;image.alt=currentPartInfo?.name||"Part image";
   partPhotoPreview.hidden=true;partPhotoPreview.removeAttribute("src");partPhotoPlaceholder.hidden=false;
   image.onload=()=>{
    if(currentPartInfo?.id!==partId)return;
    const main=document.createElement("img");main.src=src;main.alt=image.alt;
    pictureCover.replaceChildren(main);
    partPhotoPreview.src=src;partPhotoPreview.hidden=false;partPhotoPlaceholder.hidden=true;
    partPhotoDelete.disabled=false;
   };
   image.onerror=()=>{
    if(currentPartInfo?.id!==partId)return;
    pictureCover.replaceChildren(Object.assign(document.createElement("span"),{textContent:"No picture yet"}));
    partPhotoPreview.hidden=true;partPhotoPreview.removeAttribute("src");
    partPhotoPlaceholder.hidden=false;partPhotoDelete.disabled=true;
   };
  }
  editPartPicture.onclick=()=>{
   if(!adminAuthenticated||!currentPartInfo)return;
   partPhotoStatus.textContent="";
   showPartPicture(currentPartInfo.id);partPhotoDialog.showModal();
  };
  partPhotoAdd.onclick=()=>partPhotoFile.click();
  partPhotoFile.onchange=()=>void uploadPartPicture(partPhotoFile.files?.[0]);
  async function uploadPartPicture(file){
   const partId=currentPartInfo?.id;
   if(!file||!partId||!adminAuthenticated)return;
   const mime=file.type||({jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp"}[file.name.split(".").pop().toLowerCase()]||"");
   if(!["image/jpeg","image/png","image/webp"].includes(mime)||file.size>3*1024*1024){
    partPhotoStatus.textContent="Choose JPG, PNG, or WebP under 3 MB.";return;
   }
   partPhotoAdd.disabled=true;partPhotoStatus.textContent="Uploading picture…";
   try{
    const response=await fetch(partPhotoUrl(partId),{method:"POST",credentials:"same-origin",headers:{"content-type":mime},body:file});
    const data=await response.json();if(!response.ok)throw Error(data.error||"Upload failed");
    if(currentPartInfo?.id===partId){showPartPicture(partId,true);partPhotoStatus.textContent="Picture saved."}
   }catch(error){partPhotoStatus.textContent=error.message||"Upload failed"}
   finally{partPhotoAdd.disabled=false;partPhotoFile.value=""}
  }
  partPhotoDelete.onclick=async()=>{
   const partId=currentPartInfo?.id;
   if(!partId||!adminAuthenticated||!confirm("Delete this part picture? The BOM part and instructions remain."))return;
   partPhotoDelete.disabled=true;partPhotoStatus.textContent="Deleting picture…";
   try{
    const response=await fetch(partPhotoUrl(partId),{method:"DELETE",credentials:"same-origin"});
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(result.error||"Picture deletion failed");
    if(currentPartInfo?.id===partId){
     pictureCover.replaceChildren(Object.assign(document.createElement("span"),{textContent:"No picture yet"}));
     partPhotoPreview.hidden=true;partPhotoPreview.removeAttribute("src");
     partPhotoPlaceholder.hidden=false;partPhotoStatus.textContent="Picture deleted.";
    }
   }catch(error){partPhotoStatus.textContent=error.message||"Delete failed";partPhotoDelete.disabled=false}
  };
  const partPhotoStage=partPhotoDialog.querySelector(".part-photo-stage");
  partPhotoStage.addEventListener("dragover",event=>{
   if(!adminAuthenticated||!Array.from(event.dataTransfer?.types||[]).includes("Files"))return;
   event.preventDefault();event.dataTransfer.dropEffect="copy";
  });
  partPhotoStage.addEventListener("drop",event=>{
   if(!adminAuthenticated)return;
   const file=Array.from(event.dataTransfer?.files||[]).find(f=>f.type.startsWith("image/")||/\.(jpe?g|png|webp)$/i.test(f.name));
   if(!file)return;event.preventDefault();void uploadPartPicture(file);
  });
  detailsPanel.querySelector(".part-details-edit").onclick=()=>{
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
  async function showPartWorkspace(){
   const partId=partRoute();if(!partId)return;
   const version=++partLoadVersion;
   detailsPanel.querySelector(".part-details-view-actions").classList.toggle("hide",!adminAuthenticated);
   partWorkspace.classList.remove("hide");workspace.classList.add("hide");main.classList.add("hide");detail.classList.add("hide");
   const heading=partWorkspace.querySelector(".part-workspace-title"),cover=partWorkspace.querySelector(".part-workspace-cover");
   if(partPhotoDialog.open)partPhotoDialog.close();editPartPicture.hidden=true;
   heading.textContent="Loading part…";currentPartInfo=null;partSavedRevision=null;partStatus.textContent="Loading instructions…";partDetailsCollapse.open=false;
   detailRows.replaceChildren();detailsPanel.classList.add("hide");
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
    heading.textContent=part.name;
    currentPartInfo=part;
    editPartPicture.hidden=!adminAuthenticated;
    investigationParts=partData.components||[];
    investigations?.showPart(partInvestigationPanel,partId);
    renderPartDetails(part);
    void partDrawingPanel?.load(project,"part",partId);
    void partFilesPanel?.load(project,partId);
    void showHarnessPreview(partId,version);
    if(partBackAssembly===null)partBackAssembly=part.assemblyId??null;
    partResourcePicker?.setData(data.workspace?.resources,adminAuthenticated);
    partRecipe?.setData(data.workspace);
    partSavedRevision=data.workspace?.revision??null;
    partExtras.setData(data.workspace);
    showPartPicture(partId);
    partStatus.textContent="";
    if(partEditReturn?.id===partId){
     const y=partEditReturn.scrollY;partEditReturn=null;
     requestAnimationFrame(()=>window.scrollTo(0,y));
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
  partWorkspace.querySelector(".part-workspace-back").onclick=()=>{
   selected=partBackAssembly;
   partBackAssembly=null;
   history.pushState(null,"","#"+project+"/workspace/"+encodeURIComponent(selected??"__root__"));
   render();notify();window.scrollTo(0,0);
  };
  partWorkspace.querySelector(".part-workspace-save").onclick=async()=>{
   const id=partRoute();if(!id)return;
   if(!adminAuthenticated){partStatus.textContent="Sign in as administrator to save.";return}
   const data={};
   data.resources=partResourcePicker?.getData();data.experiments=partExtras.getExperiments();data.recipe=partRecipe?.getData()||[];data.expectedRevision=partSavedRevision;
   const button=partWorkspace.querySelector(".part-workspace-save");button.disabled=true;partStatus.textContent="Saving…";
   try{
    const response=await fetch("/api/workspace?project="+encodeURIComponent(project)+"&part="+encodeURIComponent(id),{method:"PUT",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify(data)});
    const result=await response.json();
    if(!response.ok)throw Error(result.error||"Save failed (HTTP "+response.status+")");
    partSavedRevision=result.revision??partSavedRevision;
    partStatus.textContent="Part instructions saved.";
   }catch(e){partStatus.textContent=e.message}finally{button.disabled=false}
  };
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
  bomPanel.querySelector(".workspace-bom-heading").after(bomNotice);
  workspace.addEventListener("click",async event=>{
   const target=event.target;
   if(!(target instanceof Element))return;
   const button=target.closest(".component-extract");
   if(!button)return;
   event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
   const section=workspace.querySelector(".component-section");
   const notify=message=>{
    bomNotice.textContent=message;
    bomNotice.classList.add("visible");
    const status=section?.querySelector(".component-status");
    if(status){status.textContent=message;status.style.display="block";status.hidden=false}
   };
   notify("Extract clicked — checking the product information.");
   if(!section){notify("BOM form missing. Refresh the website.");return}
   const description=section.querySelector(".component-description")?.value.trim();
   if(!description){notify("Paste a product description or an HTTPS product URL.");return}
   if(!adminAuthenticated){notify("Sign in using Admin login to extract product specifications.");return}
   extractedPictureUrl=null;extractedSnapshotId=null;
   button.disabled=true;notify("Connecting to the extraction API…");
   try{
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),25000);
    let response;
    try{response=await fetch("/api/components/extract",{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({description,project}),signal:controller.signal})}finally{clearTimeout(timeout)}
    const raw=await response.text();
    let data;try{data=JSON.parse(raw)}catch{throw Error("Server returned HTTP "+response.status+" instead of valid JSON: "+raw.slice(0,120))}
    if(!response.ok)throw Error((data.error||"Extraction failed")+" (HTTP "+response.status+")");
    if(!data.component||typeof data.component!=="object")throw Error("No product data returned");
    const part=data.component;
    extractedPictureUrl=typeof data.imageUrl==="string"?data.imageUrl:null;
    extractedSnapshotId=typeof data.snapshotId==="string"?data.snapshotId:null;
    for(const fieldName of ["name","manufacturer","model","category","supplier","asin"]){
     const field=section.querySelector(".component-"+fieldName);if(field)field.value=part[fieldName]||""
    }
    const specs=section.querySelector(".component-specs");if(specs){
     specs.replaceChildren();
     for(const spec of part.specifications||[]){
      const row=document.createElement("div");row.className="row component-spec-row";
      const name=document.createElement("input"),value=document.createElement("input"),source=document.createElement("select"),remove=document.createElement("button");
      name.className=value.className="field";name.placeholder="Specification";value.placeholder="Value";name.value=spec.name||"";value.value=spec.value||"";
      for(const optionValue of ["explicit","inferred"]){const option=document.createElement("option");option.value=optionValue;option.textContent=optionValue==="explicit"?"Stated in listing":"Inferred";source.append(option)}
      source.value=spec.source==="inferred"?"inferred":"explicit";
      remove.type="button";remove.className="btn";remove.textContent="Remove";remove.onclick=()=>row.remove();
      row.append(name,value,source,remove);specs.append(row);
     }
    }
    section.querySelector(".component-review")?.classList.remove("hide");
    notify("Specifications extracted."+(extractedPictureUrl?" Product picture found and will be added when saved.":" No product picture found.")+" Review and save the part.");
   }catch(error){
    section.querySelector(".component-review")?.classList.remove("hide");
    const message="Extraction failed: "+(error.name==="AbortError"?"The request timed out":error.message);
    notify(message);
   }finally{button.disabled=false}
  },true);
  // Display saved parts independently of the legacy editor's <details> DOM.
  let bomDisplayVersion=0;
  // One readable, hierarchical BOM presentation; no competing view modes.
  let editingPart=null;
  let editingPartAssembly=null;
  const partPhotoUrl=id=>"/api/components/photo?project="+encodeURIComponent(project)+"&id="+encodeURIComponent(id);
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
      body:JSON.stringify({workshopChoice:item.id})
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
   if(!shopCandidate(part)||!adminAuthenticated)return null;
   const button=document.createElement("button");button.type="button";button.className="btn bom-material-preference";
   button.textContent=part.assumedOnHand?"Treat as purchase item":"Assume on hand";
   button.title="Only changes how this material appears in the BOM. No inventory tracking.";
   button.onclick=async event=>{
    event.preventDefault();event.stopPropagation();button.disabled=true;
    try{
     const response=await fetch("/api/components?project="+encodeURIComponent(project)+"&id="+encodeURIComponent(part.id),{
      method:"PATCH",credentials:"same-origin",headers:{"content-type":"application/json"},
      body:JSON.stringify({purchaseOverride:part.assumedOnHand?true:false})
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
    name.className="bom-part-name bom-part-name-link";name.textContent=part.name;
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
  // Sidebar BOM is a read-only index. Open navigates to part details; editing is a separate admin action.
  // Detailed specifications, purchasing and picture actions belong to that form,
  // never inside the narrow feature-tree sidebar.
  function createSavedPart(part,originId){
   const item=document.createElement("div");item.className="bom-part bom-compact-part";
   if(part.bomOnly)item.classList.add("bom-only-part");
   if(part.generatedFrom)item.classList.add("bom-generated-part");
   const row=document.createElement("div");row.className="bom-part-summary";
   const name=document.createElement("span");
   name.className="bom-part-name bom-part-name-link";name.textContent=part.name;
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
  const bomIdentity=part=>[part.name,part.manufacturer,part.model,part.partType,part.sharedPartRef]
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
    const {shopItems,shopIds}=window.BSBomModel.selectWorkspaceParts(parts,nodes,assemblyId);
    container.replaceChildren();
    // A real subassembly is shown once as an expandable BOM row, not duplicated as a normal part.
    const renderAssembly=(parentId,mount,level)=>{
     const linkedIds=new Set(nodes.filter(n=>isPartNode(n)).map(n=>n.partId));
     const ownParts=parts.filter(p=>(p.assemblyId??null)===parentId&&!linkedIds.has(p.id)&&!shopIds.has(p.id));
     const children=nodes.filter(n=>n.parentId===parentId);
     const entries=ownParts.map(part=>({part,originId:parentId,feature:false}));
     for(const node of children)if(isPartNode(node)){
      const part=parts.find(p=>p.id===node.partId);
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
      const nParts=parts.filter(part=>descendantIds.has(part.assemblyId??null)||nodes.some(x=>isPartNode(x)&&x.partId===part.id&&descendantIds.has(x.parentId))).length;
      count.textContent=nParts+" part"+(nParts===1?"":"s");
      summary.append(name,count);item.append(summary);
      const body=document.createElement("div");body.className="bom-part-body bom-subassembly-children";
      const inner=document.createElement("div");inner.className="bom-part-stack";
      renderAssembly(node.id,inner,level+1);
      if(!inner.childElementCount){const empty=document.createElement("p");empty.className="bom-empty";empty.textContent="No parts in this subassembly yet.";inner.append(empty)}
      const open=document.createElement("button");open.type="button";open.className="btn bom-open-subassembly";open.textContent="Open subassembly instructions";
      open.onclick=()=>{selected=node.id;expanded.add(node.parentId);render();notify();history.pushState(null,"","#"+project+"/workspace/"+encodeURIComponent(node.id));showAssemblyPage();window.scrollTo(0,0)};
      body.append(inner,open);item.append(body);mount.append(item);
     }
    };
    const count=document.createElement("p");count.className="bom-count";
    const treeIds=new Set([assemblyId]);
    const visit=id=>{for(const node of nodes.filter(n=>n.parentId===id))if(!treeIds.has(node.id)){treeIds.add(node.id);visit(node.id)}};visit(assemblyId);
    const partCount=parts.filter(p=>(treeIds.has(p.assemblyId??null)&&!nodes.some(n=>isPartNode(n)&&n.partId===p.id))||nodes.some(n=>isPartNode(n)&&n.partId===p.id&&treeIds.has(n.parentId))).length;
    const componentCount=Math.max(0,partCount-shopItems.length);
    count.textContent=componentCount+" BOM part"+(componentCount===1?"":"s")+(shopItems.length?" · "+shopItems.length+" standard shop materials":"")+" · "+nodes.filter(n=>!isPartNode(n)&&treeIds.has(n.id)&&n.id!==assemblyId).length+" subassemblies";
    container.append(count);
    const stack=document.createElement("div");stack.className="bom-part-stack";
    renderAssembly(assemblyId,stack,0);
    if(!stack.childElementCount){const empty=document.createElement("p");empty.className="bom-empty";empty.textContent=shopItems.length?"No purchased components in this assembly. Standard materials appear below.":"No parts yet. Use + New BOM-only part to add one.";stack.append(empty)}
    container.append(stack);
    const shopSection=shopMaterialsPanel(shopItems);if(shopSection)container.append(shopSection);
   }catch(error){
    if(version!==bomDisplayVersion)return;
    container.replaceChildren();
    const message=document.createElement("p");message.className="bom-error";message.textContent="Unable to load BOM: "+error.message;container.append(message);
   }
  }
  // Workspace owns its part editor actions. Keep the mini-project component
  // editors separate; this panel saves one assembly part per request.
  const bomEditorMount=bomPanel.querySelector(".workspace-bom-mount");
  // Explicit type, shared by the overview and main editor. Older records default
  // to Purchased to preserve their existing manufacturer/supplier fields.
  const partTypeRow=document.createElement("label");
  partTypeRow.className="part-type-field";
  partTypeRow.textContent="Part type";
  const partTypeSelect=document.createElement("select");
  partTypeSelect.className="field part-type-select";
  for(const [value,label] of [["purchased","Purchased"],["custom","Custom"]]){
   const option=document.createElement("option");option.value=value;option.textContent=label;partTypeSelect.append(option);
  }
  partTypeRow.append(partTypeSelect);
  // The legacy form is mounted asynchronously into the editor container.
  // Attach this selector when opening the form, not during initial page setup.
  const updatePartTypeFields=()=>{
   const custom=partTypeSelect.value==="custom";
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
  bomEditorHeader.append(bomEditorHeading,bomEditorCancel);
  bomEditorMount.prepend(bomEditorHeader);
  // Editing takes over the spacious main pane. Only the editor DOM moves;
  // its event handlers, form state and save API remain unchanged.
  const bomEditPanel=document.createElement("article");
  bomEditPanel.className="workspace-main-bom-editor hide";
  bomEditPanel.setAttribute("aria-label","BOM part editor");
  workspace.querySelector(".workspace-panels").prepend(bomEditPanel);
  let editorDisclosureObserver=null;
  const moveBomEditorToTop=()=>{
   bomEditPanel.append(bomEditorMount);
   bomReport("");
   workspace.classList.add("is-editing-bom-part");
   bomEditPanel.classList.remove("hide");
   bomEditorMount.classList.add("is-editing");
   bomEditorHeading.textContent=editingPart?"Edit part: "+(bomField("name")?.value||"Part"):"Add new BOM part";
   bomEditorCancel.textContent="Cancel";
   bomEditorHeader.classList.remove("hide");
  };
  const dismissBomEditor=()=>{
   editorDisclosureObserver?.disconnect();
   editorDisclosureObserver=null;
   bomEditorMount.classList.remove("is-editing");
   bomEditorHeader.classList.add("hide");
   bomSavedList.after(bomEditorMount);
   workspace.classList.remove("is-editing-bom-part");
   bomEditPanel.classList.add("hide");
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
   editingPart=null;editingPartAssembly=null;
   partTypeSelect.value="purchased";updatePartTypeFields();
   for(const name of ["name","full-name","manufacturer","model","category","supplier","asin","description","historical-price","historical-price-date"]){const el=bomField(name);if(el)el.value=""}
   const priceBasis=bomField("historical-price-basis"),packageQty=bomField("historical-package-quantity");
   if(priceBasis)priceBasis.value="per_part";if(packageQty)packageQty.value="";priceBasis?.dispatchEvent(new Event("change"));
   const qty=bomField("quantity");if(qty)qty.value="";
   const unit=bomField("quantity-unit");if(unit)unit.value="pcs";
   bomRoot()?.querySelector(".component-specs")?.replaceChildren();
   bomRoot()?.querySelector(".component-review")?.classList.remove("hide");
   const save=bomField("save");if(save)save.textContent="Save part";
  }
  function editBomPart(part,originId){
   if(savingBom)return;
   clearBomDraft();editingPart=part.id;editingPartAssembly=originId;
   partTypeSelect.value=part.partType==="custom"?"custom":"purchased";
   updatePartTypeFields();
   for(const key of ["name","manufacturer","model","supplier","asin","category"]){const field=bomField(key);if(field)field.value=part[key]||""}
   const fullName=bomField("full-name");if(fullName)fullName.value=part.fullName||part.name||"";
   const qty=bomField("quantity");if(qty)qty.value=part.quantity??"";
   const unit=bomField("quantity-unit");if(unit)unit.value=part.quantityUnit??"pcs";
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
   openBomDraft();
   const save=bomField("save");if(save)save.textContent="Save changes";
   bomReport("");
   // Editing can begin from an overview or build-instructions page, too.
   // Route into the assembly workspace so the full-width editor is visible.
   if(!workspaceRoute()){
    if(originId!==undefined)selected=originId;
    history.pushState(null,"","#"+project+"/workspace/"+encodeURIComponent(selected??"__root__"));
    void showAssemblyPage();
    render();notify();
   }
  }
  function openBomDraft(){
   const root=bomRoot();if(!root){bomReport("BOM editor unavailable. Refresh the page.");return}
   const review=root.querySelector(".component-review");
   const lookup=root.querySelector(".component-lookup-panel");
   if(lookup){
    if(partTypeRow.nextElementSibling!==lookup)lookup.before(partTypeRow);
   }else if(review&&!review.contains(partTypeRow))review.prepend(partTypeRow);
   if(review){
    let actions=review.querySelector(".component-editor-actions");
    if(!actions){
     actions=document.createElement("div");actions.className="component-editor-actions";
     const right=document.createElement("div");right.className="component-editor-primary-actions";
     actions.append(root.querySelector(".component-add-spec"),right);
     review.append(actions);
    }
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
   bomEditorMount.scrollIntoView({behavior:"smooth",block:"start"});
   bomField("name")?.focus({preventScroll:true});
  }
  let savingBom=false;
  async function saveBomDraft(){
   if(savingBom)return false;
   const name=bomField("name")?.value.trim()||"";
   if(!name){bomReport("Enter a part name before saving.");openBomDraft();return false}
   if(!adminAuthenticated){bomReport("Use Admin login before saving BOM parts.");return false}
   const rawQty=bomField("quantity")?.value.trim()??"";
   const amount=rawQty===""?null:Number(rawQty);
   if(amount!==null&&(!Number.isFinite(amount)||amount<=0||amount>10000000)){bomReport("Quantity must be positive or left blank.");return false}
   const component={assemblyId:editingPart?editingPartAssembly:selected,quantity:amount,quantityUnit:bomField("quantity-unit")?.value??"pcs",partType:partTypeSelect.value};
   const priceInput=partTypeSelect.value==="custom"?"":(bomField("historical-price")?.value.trim()||"");
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
   for(const key of ["name","manufacturer","model","category","supplier","asin"])component[key]=bomField(key)?.value.trim()||"";
   component.fullName=bomField("full-name")?.value.trim()||component.name;
   if(component.partType==="custom")Object.assign(component,{manufacturer:"",model:"",supplier:"",asin:"",historicalPurchasePrice:null,historicalPriceDate:null,historicalPriceBasis:"per_part",historicalPackageQuantity:null});
   component.specifications=[...(bomRoot()?.querySelectorAll(".component-spec-row")||[])].map(row=>({
    name:row.children[0]?.value.trim()||"",value:row.children[1]?.value.trim()||"",source:row.children[2]?.value==="inferred"?"inferred":"explicit"
   })).filter(entry=>entry.name&&entry.value);
   savingBom=true;
   const saveButton=bomField("save");if(saveButton)saveButton.disabled=true;
   bomReport("Saving "+name+"…");
   try{
    const wasEdit=!!editingPart;
    const imageToImport=extractedPictureUrl,snapshotToAttach=extractedSnapshotId;
    const address="/api/components?project="+encodeURIComponent(project)+(editingPart?"&id="+encodeURIComponent(editingPart):"");
    const response=await fetch(address,{method:wasEdit?"PUT":"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify(component)});
    const raw=await response.text();let result;
    try{result=JSON.parse(raw)}catch{throw Error("Unexpected save response (HTTP "+response.status+")")}
    if(!response.ok)throw Error(result.error||"Save failed (HTTP "+response.status+")");
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
    clearBomDraft();
    const editor=bomRoot()?.querySelector(".component-admin");if(editor)editor.open=false;
    bomRoot()?.querySelector(".component-review")?.classList.add("hide");
    bomRoot()?.dispatchEvent(new Event("bom:refresh"));
    await renderWorkspaceParts();
    bomReport(name+(wasEdit?" updated.":" saved to the BOM.")+photoMessage);
    if(wasEdit)returnToEditedPart();
    return true;
   }catch(error){bomReport("Could not save part: "+error.message);return false}
   finally{savingBom=false;if(saveButton)saveButton.disabled=false}
  }
  // BOM-only items share the library/manual/wire wizard, but never create a feature-tree node.
  bomPanel.querySelector(".workspace-new-part").onclick=async()=>{
   if(savingBom)return;
   if(!window.BSLibraryPartPicker){bomReport("Part library unavailable. Refresh and try again.");return}
   const targetAssembly=selected;
   await window.BSLibraryPartPicker.open({bomOnly:true,onCreate:async payload=>{
    const {wireInfo,...part}=payload;
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
        body:JSON.stringify({name:wireInfo.gauge+" AWG "+wireInfo.construction+" copper (verify)",awg:String(wireInfo.gauge),construction:wireInfo.construction,insulation:wireInfo.insulation,notes:"Created through BOM-only library selection. Verify insulation and terminal compatibility."})});
       const data=await response.json();if(!response.ok)throw Error(data.error||"Could not save wire library material");
       wireId=data.wire.id;
      }
     }
     if(wireId){part.sharedPartRef="wire:"+wireId;if(!part.specifications.some(spec=>spec.name==="Library wire ID"))part.specifications.push({name:"Library wire ID",value:wireId,source:"explicit"})}
     const response=await fetch("/api/components?project="+encodeURIComponent(project),{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({...part,assemblyId:targetAssembly,bomOnly:true})});
     const data=await response.json();if(!response.ok)throw Error(data.error||"Could not create BOM-only part");
     newPart=data.component;
     // A cutting list needs an integer wire count; do not invent a count for unspecified quantities.
     if(wireInfo?.crimp&&wireId&&part.quantityUnit==="pcs"&&Number.isInteger(part.quantity)&&part.quantity>0&&Number.isFinite(wireInfo.mm)&&wireInfo.mm>0){
      const res=await fetch("/api/harness?project="+encodeURIComponent(project)+"&part="+encodeURIComponent(newPart.id),{
       method:"PUT",credentials:"same-origin",headers:{"content-type":"application/json"},
       body:JSON.stringify({cuts:[{wireId,qty:part.quantity,cutLengthMm:wireInfo.mm,stripAmm:0,stripBmm:0,endA:wireInfo.endA,endB:wireInfo.endB}]})
      });
      const data=await res.json();if(!res.ok)throw Error(data.error||"Could not save wire cutting list");
     }
     await renderWorkspaceParts();
     bomReport(newPart.name+" saved to the BOM. Required ferrules are calculated automatically.");
    }catch(error){
     if(newPart)await fetch("/api/components?project="+encodeURIComponent(project)+"&id="+encodeURIComponent(newPart.id),{method:"DELETE",credentials:"same-origin"}).catch(()=>{});
     bomReport("Could not create BOM-only part: "+error.message);
     throw error;
    }
   }});
  };
  bomPanel.addEventListener("click",event=>{
   const target=event.target;
   if(!(target instanceof Element))return;
   if(target.closest(".component-add-spec")){
    event.preventDefault();event.stopImmediatePropagation();
    const container=bomRoot()?.querySelector(".component-specs");
    if(!container){bomReport("Specification editor unavailable.");return}
    const row=document.createElement("div");row.className="row component-spec-row";
    const name=document.createElement("input"),value=document.createElement("input"),source=document.createElement("select"),remove=document.createElement("button");
    name.className=value.className="field";name.placeholder="Specification";value.placeholder="Value";
    for(const entry of ["explicit","inferred"]){const option=document.createElement("option");option.value=entry;option.textContent=entry==="explicit"?"Stated in listing":"Inferred";source.append(option)}
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
  async function loadWorkspaceCover(){const id=selected,version=++workspacePhotoVersion,cover=workspace.querySelector(".workspace-cover");cover.replaceChildren();const placeholder=document.createElement("span");placeholder.textContent="No photo yet";cover.append(placeholder);try{const r=await fetch("/api/photos?project="+encodeURIComponent(project)+"&assembly="+encodeURIComponent(id??"__root__"));if(!r.ok)return;const data=await r.json();if(version!==workspacePhotoVersion||selected!==id||!workspaceRoute())return;const photo=(data.photos||[]).find(p=>(p.assembly??null)===id);if(photo){const img=document.createElement("img");img.src=photo.url;img.alt="Assembly photo";cover.replaceChildren(img)}}catch(e){/* cover is optional */}}
  let workspaceLoadVersion=0;
  let workspaceSavedRevision=null;
  const workspaceStatus=workspace.querySelector(".workspace-status");
  const workspaceUrl=()=>"/api/workspace?project="+encodeURIComponent(project)+"&assembly="+encodeURIComponent(selected??"__root__");
  async function loadWorkspace(){
   const version=++workspaceLoadVersion,url=workspaceUrl();workspaceSavedRevision=null;workspaceStatus.textContent="Loading…";
   try{const res=await fetch(url,{credentials:"same-origin",cache:"no-store"});const data=await res.json();if(!res.ok)throw Error(data.error||"Unable to load workspace");
    if(version!==workspaceLoadVersion||url!==workspaceUrl())return;
    assemblyResourcePicker?.setData(data.workspace?.resources,adminAuthenticated);
    assemblyRecipe?.setData(data.workspace);
    workspaceSavedRevision=data.workspace?.revision??null;
    assemblyExtras.setData(data.workspace);
    workspaceStatus.textContent="";
   }catch(e){workspaceStatus.textContent=e.message}
  }
  workspace.querySelector(".workspace-save").onclick=async()=>{
   if(!adminAuthenticated){workspaceStatus.textContent="Use Admin login at the top of the website to save.";return}
   const button=workspace.querySelector(".workspace-save"),url=workspaceUrl(),data={};
   data.resources=assemblyResourcePicker?.getData();data.experiments=assemblyExtras.getExperiments();data.recipe=assemblyRecipe?.getData()||[];data.expectedRevision=workspaceSavedRevision;
   button.disabled=true;workspaceStatus.textContent="Saving…";
   try{const res=await fetch(url,{method:"PUT",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify(data)});const result=await res.json();if(!res.ok)throw Error(result.error||"Save failed (HTTP "+res.status+")");workspaceSavedRevision=result.revision??workspaceSavedRevision;workspaceStatus.textContent="Saved."}
   catch(e){workspaceStatus.textContent=e.message}finally{button.disabled=false}
  };
  function openWorkspace(){history.pushState(null,"","#"+project+"/workspace/"+encodeURIComponent(selected??"__root__"));showAssemblyPage();window.scrollTo(0,0)}
  workspace.querySelector(".workspace-back").onclick=()=>{history.pushState(null,"",selected===null?"#"+project:"#"+project+"/assembly/"+encodeURIComponent(selected));showAssemblyPage();window.scrollTo(0,0)};
  async function showAssemblyPage(){
   const version=++detailVersion;
   const isAssembly=selected!==null;
   // The BOM is project navigation, so it stays mounted under the feature tree
   // on overview, assembly, part-detail and workspace pages alike.
   // Never move the form back into the sidebar while an edit is in progress.
   const isEditingBom=workspace.classList.contains("is-editing-bom-part");
   const bom=isEditingBom?null:(main.querySelector(".component-section")||detail.querySelector(".component-section")||bomPanel.querySelector(".component-section"));
   if(bom&&bom.parentElement!==bomPanel.querySelector(".workspace-bom-mount")){
    bomPanel.querySelector(".workspace-bom-mount").append(bom);
   }
   sidebar.classList.add("bom-sidebar-active");
   // Refresh on page transitions, but not while an editor has unsaved changes.
   if(!isEditingBom)void renderWorkspaceParts();
   const inPart=!!partRoute();partWorkspace.classList.toggle("hide",!inPart);
   if(inPart){void showPartWorkspace();return;}
   const inWorkspace=workspaceRoute();workspace.classList.toggle("hide",!inWorkspace);detail.classList.toggle("hide",!isAssembly||inWorkspace);main.classList.toggle("hide",isAssembly);if(inWorkspace){workspace.querySelector(".workspace-title").textContent=selected===null?title:(nodes.find(n=>n.id===selected)?.name||"Assembly");if(photoDialog.open)photoDialog.close();openPhotoEditor.hidden=!adminAuthenticated;loadWorkspaceCover();loadWorkspace();investigations?.showAssembly(assemblyInvestigationPanel,selected??"__root__");void fetch("/api/components?project="+encodeURIComponent(project),{cache:"no-store"}).then(r=>r.ok?r.json():null).then(d=>{if(d?.components){investigationParts=d.components;investigations?.load()}}).catch(()=>{});if(bom){const details=bom.querySelector("details");if(details)details.open=true;bom.dispatchEvent(new Event("assemblychange"));}return;}
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
  detail.querySelector(".assembly-back").onclick=()=>{selected=null;render();notify();history.pushState(null,"","#"+project);window.scrollTo(0,0)};
  // One description loader/saver for the same tile at every depth.
  async function loadDescription(id,container,message){
   const editor=container.querySelector(".assembly-description-edit");
   const display=container.querySelector(".assembly-description");
   const input=container.querySelector(".assembly-description-input");
   editor.classList.toggle("hide",!adminAuthenticated);
   container.querySelector(".assembly-photo-admin").classList.toggle("hide",!adminAuthenticated);
   display.textContent="Loading…";
   const url="/api/tree?project="+encodeURIComponent(project)+"&assembly="+encodeURIComponent(id??"__root__");
   try{
    const r=await fetch(url),data=await r.json();
    if(!r.ok)throw Error(data.error||"Unable to load description");
    if(id!==selected)return;
    display.textContent=data.page?.description||"";
    input.value=data.page?.description||"";
    container.dataset.descriptionRevision=data.revision||"";
    display.classList.toggle("hide",adminAuthenticated);
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
   let busy=false;
   const report=message=>{statusElement.textContent=message};
   const currentId=()=>getAssemblyId();
   async function refresh(){
    const id=currentId();
    admin.classList.toggle("hide",!adminAuthenticated||!allowEditing);
    const url="/api/photos?project="+encodeURIComponent(project)+(id?"&assembly="+encodeURIComponent(id):"");
    try{
     const r=await fetch(url),data=await r.json();
     if(!r.ok)throw Error(data.error||"Unable to load photos");
     if(id!==currentId())return;
     const photos=(data.photos||[]).filter(p=>id?p.assembly===id:!p.assembly);
     const name=id?nodes.find(n=>n.id===id)?.name||title:title;
     gallery.replaceChildren(makeAssemblyPhotoStage(photos,name,()=>input.click(),async p=>{
      if(!p||!confirm("Delete this photo?"))return;
      try{
       const r=await fetch("/api/photos?id="+encodeURIComponent(p.id),{method:"DELETE",credentials:"same-origin"});
       if(!r.ok)throw Error("Delete failed (HTTP "+r.status+")");
       await refresh();if(tile===workspacePhotoEditor)void loadWorkspaceCover();if(!id)void refreshProjectCover();
      }catch(e){report(e.message)}
     },allowEditing));
    }catch(e){report(e.message)}
   }
   async function upload(file){
    if(!file||busy)return;
    const id=currentId();
    if(!adminAuthenticated){report("Sign in as administrator to upload.");return}
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
     await refresh();if(tile===workspacePhotoEditor)void loadWorkspaceCover();if(!id)void refreshProjectCover();report("Photo uploaded.");
    }catch(e){report(e.message||"Upload failed.")}
    finally{busy=false;zone.removeAttribute("aria-busy")}
   }
   pick.onclick=event=>{event.stopPropagation();input.click()};
   input.onchange=()=>upload(input.files?.[0]);
   // The zone is hidden in the modern photo-first layout; bind drops to the visible stage.
   const dropTarget=tile.querySelector(".assembly-unified-photo");
   if(dropTarget&&allowEditing){
    dropTarget.addEventListener("dragover",event=>{if(!adminAuthenticated||!event.dataTransfer.types.includes("Files"))return;event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect="copy";dropTarget.classList.add("is-dragover")});
    dropTarget.addEventListener("dragleave",event=>{if(!dropTarget.contains(event.relatedTarget))dropTarget.classList.remove("is-dragover")});
    dropTarget.addEventListener("drop",event=>{if(!adminAuthenticated)return;event.preventDefault();event.stopPropagation();dropTarget.classList.remove("is-dragover");void upload(event.dataTransfer.files?.[0])});
   }
   zone.ondragover=e=>{e.preventDefault();zone.classList.add("drag-over")};
   zone.ondragleave=()=>zone.classList.remove("drag-over");
   zone.ondrop=e=>{e.preventDefault();zone.classList.remove("drag-over");void upload(e.dataTransfer.files?.[0])};
   return {refresh};
  }
  // A single explicit entry point on the large assembly photo, not on child tiles.
  function addWorkspaceEntry(container){
   const gallery=container.querySelector(".assembly-photos");
   if(!gallery)return;
   const install=()=>{
    const stage=gallery.querySelector(".assembly-photo-stage");
    if(!stage||stage.querySelector(".assembly-open-workspace"))return;
    const btn=document.createElement("button");btn.type="button";btn.className="assembly-open-workspace";btn.textContent="Open workspace →";btn.title="Open work instructions, drawings, resources and the bill of materials";
    btn.onclick=e=>{e.stopPropagation();openWorkspace()};
    stage.append(btn);
   };
   new MutationObserver(install).observe(gallery,{childList:true});install();
  }
  addWorkspaceEntry(detail);
  addWorkspaceEntry(main);
  const rootPhotoController=createPhotoController(main,()=>null,main.querySelector(".root-photo-status"));
  const detailPhotoController=createPhotoController(detail,()=>selected,detailStatus);
  async function renderRootPhotos(){await rootPhotoController.refresh()}
  function renderTiles(){
   const target=(selected===null?main:detail).querySelector(".assembly-workflow");if(!target)return;
   target.replaceChildren();const children=nodes.filter(n=>n.parentId===selected);
   
   if(!children.length)return;
   const bomGrid=document.createElement("div");bomGrid.className="assembly-tile-grid";
   const partCount=children.filter(isPartNode).length;
   const subassemblyCount=children.length-partCount;
   const sorted=[...children];
   for(const n of sorted){
    const tile=document.createElement("article");tile.className="assembly-tile "+(isPartNode(n)?"assembly-bom-part-tile":"assembly-bom-subassembly-tile");
    const cover=document.createElement("div");cover.className="assembly-tile-cover";cover.textContent="▧";const overlay=document.createElement("span");overlay.className="assembly-tile-overlay";overlay.textContent=n.name;cover.append(overlay);tile.append(cover);if(isPartNode(n)){const img=document.createElement("img");img.src=partPhotoUrl(n.partId);img.alt="";img.onerror=()=>{img.src=missingPicture;img.onerror=null};cover.replaceChildren(img,overlay,...[...cover.children].filter(child=>child!==overlay&&child!==img))}
    else fetch("/api/photos?project="+project+"&assembly="+encodeURIComponent(n.id)).then(r=>r.json()).then(data=>{if(!tile.isConnected||!data.photos?.length)return;const img=document.createElement("img");img.src=data.photos[0].url;img.alt="";cover.replaceChildren(img,overlay,...[...cover.children].filter(child=>child!==overlay&&child!==img))}).catch(()=>{});
    const openAssembly=()=>{if(isPartNode(n)){openTreePart(n);return}selected=n.id;expanded.add(n.parentId);render();history.pushState(null,"","#"+project+"/assembly/"+encodeURIComponent(n.id));notify();window.scrollTo(0,0)};cover.setAttribute("role","button");cover.tabIndex=0;cover.setAttribute("aria-label","Open "+n.name);cover.onclick=openAssembly;cover.title="Open "+n.name+" overview";cover.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openAssembly()}};
    // Photo-first overview tile: title stays in the image overlay.
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
  root.addEventListener("openpart",()=>{void showAssemblyPage()});
  root.addEventListener("openassembly",e=>{const id=e.detail;if(id==="__root__"){selected=null;render();notify();return}if(!nodes.some(n=>n.id===id))return;selected=id;let cursor=nodes.find(n=>n.id===id);while(cursor){expanded.add(cursor.parentId);cursor=nodes.find(n=>n.id===cursor.parentId)}render();notify()});
  const validSelection=()=>selected===null||nodes.some(n=>n.id===selected);
  const notify=()=>{assemblySelections[project]=selected;assemblyTreeSnapshots[project]={nodes:[...nodes],title};showAssemblyPage();renderTiles();view.querySelectorAll(".component-section").forEach(section=>section.dispatchEvent(new Event("assemblychange")));};
  let treeSavedRevision=null;
  async function load(){void loadProjectMetadata();try{const r=await fetch("/api/tree?project="+project),data=await r.json();if(!r.ok)throw Error(data.error);nodes=data.nodes||[];treeSavedRevision=data.revision??null;if(!validSelection())selected=null;const deepLink=decodeURIComponent(location.hash.slice(1)).match(new RegExp("^"+project+"/(?:assembly|workspace)/([^/]+)$"));if(deepLink&&(deepLink[1]==="__root__"||nodes.some(n=>n.id===deepLink[1])))selected=deepLink[1]==="__root__"?null:deepLink[1];render();notify()}catch(e){status.textContent="Feature tree unavailable: "+e.message}}
  async function save(next){const r=await fetch("/api/tree?project="+project,{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({nodes:next,expectedRevision:treeSavedRevision})});const data=await r.json();if(!r.ok)throw Error(data.error||"Save failed");treeSavedRevision=data.revision??treeSavedRevision;nodes=next;render();notify()}
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
     const update=await fetch("/api/components?project="+encodeURIComponent(project)+"&id="+encodeURIComponent(part.id),{method:"PUT",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({...part,assemblyId:newParent})});
     const result=await update.json();if(!update.ok)throw Error(result.error||"Unable to update BOM parent");
    }catch(error){warning=" Tree moved, but BOM parent could not be updated: "+error.message}
    openTreePart({...node,parentId:newParent});status.textContent="Part moved."+warning;
   }else{selected=id;render();notify();status.textContent="Subassembly moved."}
  }
  async function moveToChoice(){
   if(selected===null){status.textContent="Select a subassembly first.";return}
   const options=[{id:null,name:"Top-level project"},...nodes.filter(n=>!isPartNode(n)&&n.id!==selected&&!wouldCycle(selected,n.id))];
   const help=options.map((n,i)=>(i+1)+". "+n.name).join("\\n");
   const answer=prompt("Move the selected subassembly into:\\n"+help);
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
  window.addEventListener("hashchange",closeTreeMenu);
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
   const value=prompt("Rename part",node.name);
   if(!value?.trim()||value.trim()===node.name)return;
   const response=await fetch("/api/components?project="+encodeURIComponent(project),{cache:"no-store"});
   const data=await response.json();
   if(!response.ok)throw Error(data.error||"Could not load part");
   const part=(data.components||[]).find(item=>item.id===node.partId);
   if(!part)throw Error("Linked part no longer exists.");
   if(part.generatedFrom)throw Error("Calculated parts must be renamed through their source.");
   const updated=await fetch("/api/components?project="+encodeURIComponent(project)+"&id="+encodeURIComponent(node.partId),{
    method:"PUT",credentials:"same-origin",headers:{"content-type":"application/json"},
    body:JSON.stringify({...part,name:value.trim()})
   });
   const result=await updated.json();
   if(!updated.ok)throw Error(result.error||"Unable to rename part");
   await save(nodes.map(item=>item.id===node.id?{...item,name:value.trim()}:item));
  };
  const deleteTreeItem=async node=>{
   if(!node)return;
   if(!isPartNode(node)){
    selected=node.id;
    root.querySelector(".assembly-remove").click();
    return;
   }
   if(!confirm("Remove "+node.name+" from the feature tree? Its BOM part and details will be kept."))return;
   await save(nodes.filter(item=>item.id!==node.id));
   status.textContent="Removed tree link; BOM part retained.";
  };
  const openTreeMenu=(node,x,y,trigger)=>{
   if(!adminAuthenticated)return;
   closeTreeMenu();
   menuTarget=node;
   const isPart=isPartNode(node);
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
   addItem("Rename",()=>node?renameTreeItem(node):editProjectName.click());
   addItem(isPart?"Remove from tree":"Delete",()=>deleteTreeItem(node),!node);
   if(node){
    const moveSeparator=document.createElement("div");
    moveSeparator.className="assembly-context-separator";moveSeparator.setAttribute("role","separator");treeMenu.append(moveSeparator);
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
  function render(){nodesEl.replaceChildren();controls.classList.toggle("hide",!adminAuthenticated);projectActions.classList.toggle("hide",!adminAuthenticated);cardEdit.classList.toggle("hide",!adminAuthenticated);const row=(node,depth)=>{
   const id=node?.id??null,children=nodes.filter(n=>n.parentId===id),el=document.createElement("div");el.className="assembly-node"+(selected===id?" selected":"");el.style.paddingLeft=(depth*17+3)+"px";
   const expand=document.createElement("button");expand.type="button";expand.className="assembly-expander";expand.textContent=children.length?(expanded.has(id)?"▾":"▸"):" ";expand.setAttribute("aria-label",expanded.has(id)?"Collapse":"Expand");expand.onclick=()=>{expanded.has(id)?expanded.delete(id):expanded.add(id);render()};
   const name=document.createElement("button");name.type="button";name.className="assembly-name";name.textContent=node?(isPartNode(node)?"🔩  ":"📦  ")+node.name:"🟨  "+title;
   if(isPartNode(node)&&partRoute()===node.partId)el.classList.add("selected");name.onclick=()=>{if(isPartNode(node)){openTreePart(node);return}selected=id;history.pushState(null,"",id===null?"#"+project:"#"+project+"/assembly/"+encodeURIComponent(id));render();notify();window.scrollTo(0,0)};
   el.append(expand,name);
   if(adminAuthenticated){
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
   if(node&&adminAuthenticated){
    el.draggable=true;el.title="Drag to reorder or drop into another assembly";
    el.ondragstart=event=>{event.dataTransfer.setData("text/plain",node.id);event.dataTransfer.effectAllowed="move";el.classList.add("assembly-dragging")};
    el.ondragend=()=>el.classList.remove("assembly-dragging");
    el.ondragover=event=>{const dragged=Array.from(event.dataTransfer.types).includes("text/plain");if(!dragged)return;event.preventDefault();el.classList.add("assembly-drop-target");event.dataTransfer.dropEffect="move"};
    el.ondragleave=()=>el.classList.remove("assembly-drop-target");
    el.ondrop=async event=>{
     event.preventDefault();event.stopPropagation();el.classList.remove("assembly-drop-target");
     const sourceId=event.dataTransfer.getData("text/plain"),source=nodes.find(n=>n.id===sourceId);
     if(!source||source.id===node.id)return;
     try{
      // Dropping on a sibling's upper/lower edge reorders it; dropping in the middle nests it.
      const rect=el.getBoundingClientRect(),fraction=(event.clientY-rect.top)/rect.height;
      if(source.parentId===node.parentId&&(fraction<.25||fraction>.75)){
       const next=[...nodes],from=next.findIndex(n=>n.id===source.id);
       const item=next.splice(from,1)[0];let to=next.findIndex(n=>n.id===node.id);
       if(fraction>.75)to++;next.splice(to,0,item);await save(next);status.textContent="Subassembly reordered.";
      }else await reparent(source.id,node.id);
     }catch(e){status.textContent=e.message}
    };
   }else if(!node&&adminAuthenticated){
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
     const {wireInfo,...part}=payload;
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
     const next=[...nodes,{id:crypto.randomUUID(),kind:"part",partId:newPart.id,name:newPart.name,parentId:selected}];
     await save(next);expanded.add(selected);
     openTreePart(next[next.length-1]);
     status.textContent="Part added to the feature tree and BOM. Required ferrules are calculated automatically.";
    }catch(error){
     if(newPart)await fetch("/api/components?project="+encodeURIComponent(project)+"&id="+encodeURIComponent(newPart.id),{method:"DELETE",credentials:"same-origin"}).catch(()=>{});
     status.textContent="Could not add part: "+error.message;throw error;
    }finally{newPartButton.disabled=false}
   }});
  };
  root.querySelector(".assembly-add").onclick=async()=>{if(isPartNode(nodes.find(n=>n.id===selected))){status.textContent="Select an assembly first; parts cannot contain children.";return}const name=prompt("New subassembly name");if(!name?.trim())return;const id=crypto.randomUUID();try{await save([...nodes,{id,name:name.trim(),parentId:selected}]);expanded.add(selected);selected=id;render();notify()}catch(e){status.textContent=e.message}};
  root.querySelector(".assembly-rename").onclick=async()=>{if(selected===null){status.textContent="Select a subassembly to rename.";return}const node=nodes.find(n=>n.id===selected),name=prompt("Rename subassembly",node.name);if(!name?.trim())return;try{await save(nodes.map(n=>n.id===selected?{...n,name:name.trim()}:n))}catch(e){status.textContent=e.message}};
  root.querySelector(".assembly-remove").onclick=async()=>{if(selected===null){status.textContent="Select a subassembly to delete.";return}const node=nodes.find(n=>n.id===selected);if(!confirm("Delete "+node.name+" and its nested subassemblies? Existing BOM components will remain in the project but may become unassigned."))return;const removed=new Set([selected]);let changed=true;while(changed){changed=false;for(const n of nodes)if(removed.has(n.parentId)&&!removed.has(n.id)){removed.add(n.id);changed=true}}try{await save(nodes.filter(n=>!removed.has(n.id)));selected=null;render();notify()}catch(e){status.textContent=e.message}};
  load();
 })
}
