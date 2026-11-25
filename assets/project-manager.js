// Project dashboard. Private project data is authorized by the API, never by these DOM filters.
window.BSProjectManager=(()=>{
 let currentProjects=[],openAccount=()=>{},updateProjectSummary=()=>{};
 const api=async(method,path,body)=>{
  const response=await fetch(path,{method,credentials:"same-origin",cache:"no-store",
   ...(body?{headers:{"content-type":"application/json"},body:JSON.stringify(body)}:{})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){
    const error=new Error(data.error||"Server returned HTTP "+response.status+" without a detailed error");
    error.status=response.status;error.code=data.code||"";error.reference=data.reference||"";
    throw error
   }
  return data;
 };
 const element=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node};
 const init=async({setupAssemblyTrees,setupComponents,setupPhotos,navigate})=>{
  const root=document.querySelector("#home .project-index"),grid=root?.querySelector(".ui-project-list");if(!grid)return;
  const entryURL=new URL(location.href),keepLegacyHome=entryURL.searchParams.has("legacy")||entryURL.searchParams.has("account");
  const loading=root.querySelector(".project-catalog-loading");
  let legacyReadOnly=false;
  const readOnlyNotice=element("p","ui-page muted");readOnlyNotice.hidden=true;readOnlyNotice.setAttribute("role","status");
  const engineLink=element("a","","Open new Projects");engineLink.href="/project.html";
  readOnlyNotice.append("Legacy projects are read-only. Saved data, files and exports remain available. ",engineLink);
  document.querySelector("main").prepend(readOnlyNotice);
  const newButton=element("button","ui-button ui-button--primary project-directory-new","+ New project");newButton.type="button";
  const archiveButton=element("button","ui-button","Archived projects");archiveButton.type="button";
  const more=element("details","project-directory-menu ui-toolbar-menu");
  more.append(element("summary","ui-button","More"),archiveButton);
  const filters=element("div","project-directory-controls ui-directory-toolbar");
  const searchLabel=element("label","project-directory-label project-directory-search ui-toolbar-search","");
  const searchInput=element("input","ui-control project-search");searchInput.type="search";searchInput.placeholder="Search projects…";searchInput.setAttribute("aria-label","Search projects");searchLabel.append(searchInput);
  const sortLabel=element("label","project-directory-label ui-toolbar-field","Sort by");
  const sortSelect=element("select","ui-control project-sort-filter");
  for(const [value,label] of [["name_asc","Name A–Z"],["name_desc","Name Z–A"],["newest","Newest first"],["oldest","Oldest first"]]){
   const option=element("option","",label);option.value=value;sortSelect.append(option);
  }
  sortLabel.append(sortSelect);
  const directoryStatus=element("span","project-directory-count muted ui-toolbar-count");directoryStatus.setAttribute("role","status");
  root.classList.add("compact-project-directory");
  let updateDirectory=()=>{};
  const {createDirectoryFilters}=await import("./directory-filters.js");
  const {menu:filterMenu,selected:selectedTags,active:activeTags,render:renderTagFilters}=createDirectoryFilters({items:()=>projects,onChange:()=>updateDirectory()});
  filters.append(newButton,searchLabel,filterMenu,sortLabel,directoryStatus,more);
  grid.before(filters,selectedTags);
  const suggestions=["Mechanical","Electronics","Software","Controls","CAD","3D Printing","Woodworking","PCB Design","Machining","Robotics","Measurement","Fabrication"];
  const projectTags=project=>Array.isArray(project?.tags)?project.tags:[];
  const parseTags=text=>[...new Map(String(text||"").split(",").map(x=>x.trim().replace(/\\s+/g," ")).filter(Boolean).map(x=>[x.toLowerCase(),x])).values()].slice(0,20);
  const makeTagPicker=(initial=[])=>{
   const holder=element("div","bs-project-tag-picker");
   const label=element("label","","Project tags (choose any that apply)");
   const input=element("input","field");input.type="text";input.placeholder="Add tags separated by commas";input.maxLength=600;
   input.value=initial.join(", ");
   const choices=element("div","bs-project-tag-suggestions");
   const options=[...new Set([...suggestions,...projects.flatMap(projectTags),...initial])].sort();
   const draw=()=>{
    choices.replaceChildren();const current=parseTags(input.value);
    for(const name of options){
     const selected=current.some(tag=>tag.toLowerCase()===name.toLowerCase());
     const chip=element("button","ui-chip",name);
     chip.type="button";chip.setAttribute("aria-pressed",String(selected));
     chip.onclick=()=>{
      const next=selected?current.filter(tag=>tag.toLowerCase()!==name.toLowerCase()):[...current,name];
      input.value=next.slice(0,20).join(", ");draw()
     };
     choices.append(chip);
    }
   };
   input.oninput=draw;draw();label.append(input);holder.append(label,choices);
   return {element:holder,getTags:()=>parseTags(input.value)};
  };
  const empty=element("p","project-directory-empty muted");empty.hidden=true;grid.after(empty);
  const {initProjectDirectory}=await import("./project-directory.js");
  ({render:updateDirectory}=initProjectDirectory({grid,toolbar:filters,projects:()=>projects,tags:()=>activeTags,search:searchInput,sort:sortSelect,status:directoryStatus,empty,photoUrl:id=>window.BSPhotoMarkup.displayUrl("gallery",id)}));
  updateProjectSummary=(id,summary)=>{
   const project=projects.find(item=>item.id===id);
   if(project){Object.assign(project,summary);updateDirectory()}
  };
  const dialog=element("dialog","project-account-dialog");
  dialog.innerHTML='<form class="project-account-form"><div class="project-account-header"><h2 class="project-account-title">Sign in</h2><button type="button" class="btn project-close" aria-label="Close account window">×</button></div><p class="project-account-subtitle muted">Private engineering application. Sign in with the existing owner account.</p><p class="project-account-message" role="status" aria-live="polite"></p><label class="project-account-email">Email<input class="field" type="email" name="email" autocomplete="email" required></label><label class="project-account-password">Password<input class="field" type="password" name="password" autocomplete="current-password" minlength="12" required></label><div class="project-account-buttons"><button class="btn primary project-signin" type="submit">Sign in</button><button class="btn project-signout hide" type="button">Sign out</button></div></form>';
  document.body.append(dialog);
  const form=dialog.querySelector(".project-account-form");
  form.noValidate=true; // Use specific, actionable inline errors instead of browser bubbles.
  const passwordHint=element("p","project-password-hint muted","Use 12–256 characters.");
  dialog.querySelector(".project-account-password")?.append(passwordHint);
  const retryHelp=element("p","project-account-recovery muted");
  retryHelp.hidden=true;
  dialog.querySelector(".project-account-message")?.after(retryHelp);
  const note=dialog.querySelector(".project-account-message"),email=dialog.querySelector('[name="email"]'),
   password=dialog.querySelector('[name="password"]');
  let user=null,projects=[];
  const clearAccountError=()=>{
   note.textContent="";note.classList.remove("is-error");retryHelp.textContent="";retryHelp.hidden=true;
   for(const control of [email,password])control.removeAttribute("aria-invalid");
  };
  const showAccountError=(message,detail="",field=null)=>{
   note.classList.add("is-error");note.textContent=message;
   retryHelp.textContent=detail;retryHelp.hidden=!detail;
   if(field){field.setAttribute("aria-invalid","true");field.focus()}
  };
  for(const control of [email,password])control.addEventListener("input",()=>{
   control.removeAttribute("aria-invalid");
   if(note.classList.contains("is-error"))clearAccountError();
  });
  const explainAccountFailure=error=>{
   if(error.status===401)return ["Email or password not recognized.","Use the existing owner account.",password];
   if(error.status===403)return ["Sign-in request was not accepted.","Reload this website and try again.",null];
   if(error.status===503)return ["Sign-in is temporarily unavailable.","The account service could not be reached. Try again later.",null];
   return ["We couldn't sign you in.",error.message||"Check your connection and try again.",null];
  };
  const updateAccount=()=>{
   const signed=!!user;
   dialog.querySelector(".project-account-title").textContent=signed?"Owner account":"Sign in";
   dialog.querySelector(".project-account-subtitle").textContent=signed?user.email:"Private engineering application. Public registration is closed.";
   for(const selector of [".project-account-email",".project-account-password",".project-signin"])dialog.querySelector(selector).classList.toggle("hide",signed);
   dialog.querySelector(".project-signout").classList.toggle("hide",!signed);
  };
  const showAccount=()=>{clearAccountError();updateAccount();dialog.showModal()};
  dialog.querySelector(".project-close").onclick=()=>dialog.close();
  async function sign(){
   clearAccountError();
   const address=email.value.trim(),secret=password.value;
   if(!address||!email.validity.valid){
    showAccountError("Enter a valid email address.","Example: name@example.com",email);return
   }
   if(secret.length<12||secret.length>256){
    showAccountError("Your password must be between 12 and 256 characters.",
     secret.length<12?"Add "+(12-secret.length)+" more character"+(12-secret.length===1?"":"s")+" to continue.":"Shorten the password to 256 characters or fewer.",password);return
   }
   const submit=dialog.querySelector(".project-signin");submit.disabled=true;
   note.textContent="Signing in…";
   try{
    const data=await api("POST","/api/accounts",{action:"login",email:address,password:secret});
    user=data.user;password.value="";dialog.close();location.href="#home";location.reload();
   }catch(error){
    const [message,detail,control]=explainAccountFailure(error);
    showAccountError(message,detail,control);
   }finally{submit.disabled=false}
  }
  dialog.querySelector("form").onsubmit=event=>{event.preventDefault();void sign()};
  dialog.querySelector(".project-signout").onclick=async()=>{await api("DELETE","/api/accounts");user=null;dialog.close();location.href="#home";location.reload()};
  openAccount=showAccount;
  const editor=element("dialog","project-create-dialog");
  editor.innerHTML='<form method="dialog" class="project-create-form"><h2>New project</h2><p class="muted">Projects are private. Only you can view and edit them.</p><label>Project name<input class="field" name="name" maxlength="100" required></label><label>Description<textarea class="field" name="description" maxlength="500"></textarea></label><p class="project-create-message" role="status"></p><div class="row"><button type="button" class="btn primary project-create-save">Create project</button><button type="button" class="btn project-create-cancel">Cancel</button></div></form>';
  document.body.append(editor);
  const createTagPicker=makeTagPicker();
  editor.querySelector('.project-create-form [name="name"]')?.closest("label")?.after(createTagPicker.element);
  editor.querySelector(".project-create-cancel").onclick=()=>editor.close();
  const openCreate=()=>{
   if(!user){showAccount();note.textContent="Sign in with the owner account before creating a project.";return}
   editor.querySelector(".project-create-message").textContent="";
   editor.showModal();
  };
  newButton.onclick=openCreate;
  editor.querySelector(".project-create-save").onclick=async()=>{
   const form=editor.querySelector("form"),button=editor.querySelector(".project-create-save");
   if(!form.reportValidity())return;
   button.disabled=true;
   try{
    const response=await api("POST","/api/projects",{name:form.elements.name.value,description:form.elements.description.value,
     tags:createTagPicker.getTags(),kind:"project"});
    const name=form.elements.name.value;
    const created=response.projects.find(project=>project.name===name&&project.ownerId===user?.id);
    editor.close();form.reset();createTagPicker.element.querySelector("input").value="";await refresh();navigate(created?.id||"home");
   }catch(error){editor.querySelector(".project-create-message").textContent=error.message}
   finally{button.disabled=false}
  };
  // Reuse a single project workspace template for all projects.
  // It is captured before any controller mutates the DOM.
  const template=document.getElementById("project-workspace-template")?.content.firstElementChild;
  const ensureProjectPage=project=>{
   const existing=document.getElementById(project.id);
   if(existing?.querySelector("[data-assembly-tree]"))return;
   if(!template)return;
   const section=template.cloneNode(true);
   section.id=project.id;section.classList.add("project-view");
   const ids=new Map();
   section.querySelectorAll("[id]").forEach(node=>{const old=node.id;node.id=project.id+"-"+old;ids.set(old,node.id)});
   section.querySelectorAll("[for],[aria-controls],[aria-labelledby]").forEach(node=>{
    for(const attribute of ["for","aria-controls","aria-labelledby"]){const value=node.getAttribute(attribute);if(value)node.setAttribute(attribute,value.split(" ").map(id=>ids.get(id)||id).join(" "))}
   });
   // All projects, including original mini projects, use the identical assembly template.
   if(existing)existing.replaceWith(section);
   else document.getElementById("project-workspace-template").before(section);
   section.querySelectorAll("[data-assembly-tree],[data-components],[data-photos]").forEach(node=>{
    if(node.hasAttribute("data-assembly-tree"))node.dataset.assemblyTree=project.id;
    if(node.hasAttribute("data-components"))node.dataset.components=project.id;
    if(node.hasAttribute("data-photos"))node.dataset.photos=project.id;
   });
   section.querySelectorAll('[data-nav="home"]').forEach(node=>node.dataset.nav="home");
   const heading=section.querySelector(".assembly-main h1");
   if(heading)heading.textContent=project.name;
  };
  const manageDialog=element("dialog","project-manage-dialog");document.body.append(manageDialog);
  archiveButton.onclick=async()=>{
   more.open=false;
   if(!user&&!adminAuthenticated){showAccount();return}
   try{
    const all=(await api("GET","/api/projects?includeArchived=1")).projects.filter(p=>p.archived&&p.isOwner);
    manageDialog.replaceChildren();
    const pane=element("div","project-manage-form");pane.append(element("h2","","Archived projects"));
    if(!all.length)pane.append(element("p","muted","No archived projects."));
    for(const project of all){
     const row=element("div","row");row.append(element("span","",project.name));
     const restore=element("button","btn","Restore");restore.onclick=async()=>{await api("PATCH","/api/projects",{id:project.id,action:"restore"});manageDialog.close();await refresh()};
     row.append(restore);pane.append(row);
    }
    const close=element("button","btn","Close");close.onclick=()=>manageDialog.close();pane.append(close);
    manageDialog.append(pane);manageDialog.showModal();
   }catch(e){alert(e.message)}
  };

  // Project-wide settings open independently from the summary.
  function mountProjectSettings(project){
   const section=document.getElementById(project.id)?.querySelector(".project-summary-owner-settings");
   if(!section)return;
   section.replaceChildren();
   section.hidden=legacyReadOnly||!project.isOwner;
   if(legacyReadOnly||!project.isOwner)return;
   section.append(element("h2","","General"));
   const intro=element("p","muted","Rename this project, manage its descriptors, or delete it.");
   section.append(intro);
   const form=element("div","project-summary-settings-form");
   const nameLabel=element("label","","Project name");
   const nameInput=element("input","field project-settings-name");
   nameInput.type="text";nameInput.maxLength=100;nameInput.required=true;
   nameInput.autocomplete="off";nameInput.value=project.name;
   nameInput.setAttribute("aria-label","Project name");
   nameLabel.append(nameInput);
   const settingsTags=makeTagPicker(projectTags(project));
   form.append(nameLabel,settingsTags.element);
   const status=element("p","project-summary-settings-status");status.setAttribute("role","status");
   const actions=element("div","project-summary-settings-actions");
   const save=element("button","btn primary","Save settings");save.type="button";
   save.onclick=async()=>{
    const name=nameInput.value.trim();
    if(!name){status.textContent="Enter a project name.";nameInput.focus();return}
    if(name.length>100){status.textContent="Project names must be 100 characters or fewer.";return}
    const renamed=name!==project.name;
    save.disabled=true;status.textContent="Saving…";
    try{
     await api("PATCH","/api/projects",{id:project.id,name,tags:settingsTags.getTags()});
     if(renamed){
      // Assembly controller caches the initial project title. Reload the
      // current route after saving so every heading, card and BOM uses the new name.
      location.reload();return;
     }
     status.textContent="Project settings saved.";await refresh();
    }catch(error){status.textContent=error.message}
    finally{save.disabled=false}
   };
   const remove=element("button","btn project-delete-button","Delete Project");remove.type="button";
   remove.onclick=()=>{
    const dialog=element("dialog","project-delete-dialog");
    const form=element("form","project-delete-form");form.method="dialog";
    form.append(element("h2","","Delete project?"));
    form.append(element("p","","This will remove “"+project.name+"” from your active projects. All parts, photos and instructions will be archived, not permanently erased; you can restore them from Archived projects."));
    const confirmLabel=element("label","","Type the exact project name to confirm:");
    const confirmation=element("input","field");confirmation.type="text";confirmation.autocomplete="off";confirmation.setAttribute("aria-label","Confirm project name");confirmLabel.append(confirmation);form.append(confirmLabel);
    const feedback=element("p","project-delete-feedback");feedback.setAttribute("role","status");form.append(feedback);
    const buttons=element("div","project-delete-actions");
    const cancel=element("button","btn","Cancel");cancel.type="button";cancel.onclick=()=>dialog.close();
    const submit=element("button","btn project-delete-confirm","Delete Project");submit.type="button";submit.disabled=true;
    confirmation.addEventListener("input",()=>{submit.disabled=confirmation.value!==project.name});
    submit.onclick=async()=>{
     submit.disabled=true;feedback.textContent="Deleting project…";
     try{
      await api("DELETE","/api/projects",{id:project.id,confirmName:confirmation.value});
      dialog.close();navigate("home");await refresh();
     }catch(error){feedback.textContent=error.message;submit.disabled=confirmation.value!==project.name}
    };
    buttons.append(cancel,submit);form.append(buttons);dialog.append(form);
    dialog.addEventListener("close",()=>dialog.remove(),{once:true});
    document.body.append(dialog);dialog.showModal();confirmation.focus();
   };
   actions.append(save,remove);
   const projectSettingsCard=element("section","project-settings-card");
   projectSettingsCard.append(section.querySelector("h2"),intro,form,actions,status);
   section.append(projectSettingsCard);
   // A project has two independent sequential ranges: assemblies 001–099,
   // and custom parts 100 onward. Formatting can change without renumbering.
   const numbering=element("section","project-numbering-settings");
   numbering.append(element("h3","","Part numbering"));
   const explanation=element("p","muted","One sequence per project. Numbers 1–99 are reserved for assemblies; custom parts start at 100. Purchased parts and tools are numbered only when requested.");
   numbering.append(explanation);
   const fields=element("div","project-numbering-fields");
   const prefixLabel=element("label","","Prefix"),prefix=element("input","field");
   prefix.maxLength=10;prefix.value="NR";prefix.placeholder="NR";prefix.autocomplete="off";prefixLabel.append(prefix);
   const digitsLabel=element("label","","Minimum digits"),digits=element("select","field");
   for(const value of [3,4,5,6,7,8]){const opt=element("option","",String(value));opt.value=String(value);digits.append(opt)}
   digits.value="3";digitsLabel.append(digits);fields.append(prefixLabel,digitsLabel);
   const preview=element("p","project-numbering-preview");
   const statusNumber=element("p","project-summary-settings-status");statusNumber.setAttribute("role","status");
   const previewUpdate=()=>{
    const label=prefix.value.toUpperCase().trim();
    const width=Number(digits.value);
    preview.textContent="Next assembly: "+label+String(numbering.dataset.nextAssembly||1).padStart(width,"0")+
     "   ·   Next custom part: "+label+String(numbering.dataset.nextPart||100).padStart(width,"0");
   };
   prefix.addEventListener("input",previewUpdate);digits.addEventListener("change",previewUpdate);
   const saveNumbers=element("button","btn","Save numbering format");saveNumbers.type="button";
   saveNumbers.onclick=async()=>{
    saveNumbers.disabled=true;statusNumber.textContent="Saving…";
    try{
     const response=await api("PUT","/api/numbering?project="+encodeURIComponent(project.id),
      {prefix:prefix.value.toUpperCase().trim(),digits:Number(digits.value)});
     prefix.value=response.settings.prefix;digits.value=String(response.settings.digits);
     numbering.dataset.nextAssembly=response.settings.nextAssembly;
     numbering.dataset.nextPart=response.settings.nextPart;
     previewUpdate();statusNumber.textContent="Format saved. Existing numbers are unchanged.";
    }catch(error){statusNumber.textContent=error.message}
    finally{saveNumbers.disabled=false}
   };
   numbering.append(fields,preview,saveNumbers,statusNumber);
   const recommendations=element("section","project-numbering-nomenclature");
   recommendations.append(element("h3","","Suggested part nomenclature"));
   const hints=element("ul","");
   for(const suggestion of [
    "Use short, specific names: Motor Mount Plate rather than Plate.",
    "Let part numbers identify records, not categories or feature-tree locations.",
    "Keep revisions separate: NR100 · Rev A, rather than changing the part number.",
    "Keep manufacturer and supplier numbers separate from your project number.",
    "Don't reuse retired numbers or renumber a part when moving it between assemblies."
   ])hints.append(element("li","",suggestion));
   recommendations.append(hints);
   const numberingCard=element("section","project-numbering-card");
   numberingCard.append(numbering,recommendations);
   section.append(numberingCard);
   api("GET","/api/numbering?project="+encodeURIComponent(project.id)).then(data=>{
    if(!numbering.isConnected)return;
    prefix.value=data.prefix||"NR";digits.value=String(data.digits||4);
    numbering.dataset.nextAssembly=data.nextAssembly||1;
    numbering.dataset.nextPart=data.nextPart||100;
    previewUpdate();
   }).catch(error=>{statusNumber.textContent="Could not load numbering settings: "+error.message;previewUpdate()});

  }
  async function refresh(){
   try{
    if(grid.hidden)loading.textContent="Loading projects…";
    user=(await api("GET","/api/accounts")).user;
    const data=await api("GET","/api/projects");if(!Array.isArray(data.projects))throw Error("Project catalog response unavailable");projects=data.projects;currentProjects=projects;
    legacyReadOnly=data.readOnly===true;readOnlyNotice.hidden=!legacyReadOnly;
    newButton.hidden=legacyReadOnly;more.hidden=legacyReadOnly||!user&&!adminAuthenticated;
    const landingRoute=location.hash.slice(1);
    if(legacyReadOnly&&!keepLegacyHome&&["/","/index.html"].includes(location.pathname)&&(!landingRoute||landingRoute==="home")){
     location.replace("/project.html");return;
    }

    for(const project of projects){
     ensureProjectPage(project);
    }
    renderTagFilters();updateDirectory();
    grid.hidden=false;loading.hidden=true;
    await setupAssemblyTrees();setupComponents();setupPhotos();
    const route=location.hash.slice(1);
    const routedProject=projects.find(project=>(route===project.id||route.startsWith(project.id+"/")));
    if(routedProject&&!document.getElementById(routedProject.id)?.classList.contains("active"))navigate(route);
    if(typeof refreshAdminUI==="function")refreshAdminUI();
    for(const project of projects){mountProjectSettings(project)}
    document.querySelectorAll("[data-assembly-tree]").forEach(root=>root.dispatchEvent(new Event("projectpermissionschanged")));
   }catch(error){
    console.error("Project catalog unavailable",error);
    if(grid.hidden){
     const retry=element("button","btn","Retry");retry.type="button";retry.onclick=refresh;
     loading.replaceChildren("Projects could not load. ",retry);
    }
   }
  }
  void refresh();
  const accountUrl=new URL(location.href);
  if(accountUrl.searchParams.has("account")){accountUrl.searchParams.delete("account");history.replaceState(null,"",accountUrl);showAccount();}
 };
 return {init,openAccount:()=>openAccount(),updateProjectSummary:(...args)=>updateProjectSummary(...args),isOwner:id=>currentProjects.some(project=>project.id===id&&project.isOwner),getProject:id=>currentProjects.find(project=>project.id===id)};
})();
