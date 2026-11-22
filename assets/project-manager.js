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
 const init=({setupAssemblyTrees,setupComponents,setupPhotos,navigate})=>{
  const root=document.querySelector("#home .project-index"),grid=root?.querySelector(".project-grid");if(!grid)return;
  const loading=root.querySelector(".project-catalog-loading");
  const newButton=element("button","ui-button ui-button--primary project-directory-new","+ New project");newButton.type="button";
  const archiveButton=element("button","ui-button","Archived projects");archiveButton.type="button";
  const more=element("details","project-directory-menu");
  more.append(element("summary","ui-button","More"),archiveButton);
  const filters=element("div","project-directory-controls");
  const searchLabel=element("label","project-directory-label project-directory-search","Find a project");
  const searchInput=element("input","ui-control project-search");searchInput.type="search";searchInput.placeholder="Search projects…";searchInput.setAttribute("aria-label","Search projects");searchLabel.append(searchInput);
  const sortLabel=element("label","project-directory-label","Sort by");
  const sortSelect=element("select","ui-control project-sort-filter");
  for(const [value,label] of [["name_asc","Name A–Z"],["name_desc","Name Z–A"],["newest","Newest first"],["oldest","Oldest first"]]){
   const option=element("option","",label);option.value=value;sortSelect.append(option);
  }
  sortLabel.append(sortSelect);
  const directoryStatus=element("span","project-directory-count muted");directoryStatus.setAttribute("role","status");
  root.classList.add("compact-project-directory");
  const filterMenu=element("details","project-filter-menu");
  filterMenu.append(element("summary","ui-button","Filters"));
  const selectedTags=element("div","project-selected-descriptors");
  filters.append(newButton,searchLabel,filterMenu,sortLabel,directoryStatus,more);
  grid.before(filters,selectedTags);
  const suggestions=["Mechanical","Electronics","Software","Controls","CAD","3D Printing","Woodworking","PCB Design","Machining","Robotics","Measurement","Fabrication"];
  const projectTags=project=>Array.isArray(project?.tags)?project.tags:[];
  const parseTags=text=>[...new Map(String(text||"").split(",").map(x=>x.trim().replace(/\\s+/g," ")).filter(Boolean).map(x=>[x.toLowerCase(),x])).values()].slice(0,20);
  const tagFilter=element("div","bs-project-tag-filter");
  const tagTitle=element("span","bs-project-tag-title","Descriptors");
  const tagSearchLabel=element("label","bs-project-descriptor-search-label","Find a descriptor");
  const tagSearch=element("input","field bs-project-descriptor-search");
  tagSearch.type="search";tagSearch.placeholder="e.g. Electronics or CAD";
  tagSearch.setAttribute("aria-label","Search descriptor tiles");
  tagSearchLabel.append(tagSearch);
  const tagChoices=element("div","bs-project-tag-options");
  const clearTags=element("button","bs-project-tag-clear","Clear selected");clearTags.type="button";
  const tagHeader=element("div","bs-project-tag-filter-heading");
  tagHeader.append(tagTitle,clearTags);
  tagFilter.append(tagHeader,tagSearchLabel,tagChoices);
  filterMenu.append(tagFilter);
  const activeTags=new Set();
  clearTags.onclick=()=>{activeTags.clear();renderTagFilters();updateDirectory()};
  const renderTagFilters=()=>{
   tagChoices.replaceChildren();
   selectedTags.replaceChildren();
   const counts=new Map();
   for(const project of projects)for(const tag of projectTags(project)){
    const key=tag.toLowerCase();
    if(!counts.has(key))counts.set(key,{name:tag,count:0});
    counts.get(key).count++;
   }
   const filter=tagSearch.value.trim().toLowerCase();
   let visibleCount=0;
   for(const [key,{name,count}] of [...counts].sort((a,b)=>a[1].name.localeCompare(b[1].name))){
    if(filter&&!key.includes(filter)&&!activeTags.has(key))continue;
    visibleCount++;
    const chip=element("button","bs-project-tag-chip"+(activeTags.has(key)?" is-active":""),name);
    chip.type="button";chip.setAttribute("aria-pressed",String(activeTags.has(key)));
    chip.append(element("span","bs-project-tag-count",String(count)));
    chip.onclick=()=>{activeTags.has(key)?activeTags.delete(key):activeTags.add(key);renderTagFilters();updateDirectory()};
    tagChoices.append(chip);
   }
   if(!visibleCount)tagChoices.append(element("p","muted bs-project-tag-empty","No matching descriptors"));
   filterMenu.hidden=!counts.size;
   for(const key of activeTags){
    const name=counts.get(key)?.name;
    if(!name){activeTags.delete(key);continue}
    const chip=element("button","bs-project-tag-chip is-active",name+" ×");
    chip.type="button";chip.setAttribute("aria-label","Remove "+name+" filter");
    chip.onclick=()=>{
     activeTags.delete(key);renderTagFilters();updateDirectory();
     (selectedTags.querySelector("button")||filterMenu.querySelector("summary")).focus();
    };
    selectedTags.append(chip);
   }
   clearTags.hidden=!activeTags.size;
  };
  tagSearch.oninput=renderTagFilters;
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
     const chip=element("button","bs-project-tag-chip"+(selected?" is-active":""),name);
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
  const updateDirectory=()=>{
   const search=searchInput.value.trim().toLowerCase(),terms=search.split(/\s+/).filter(Boolean),
    byId=new Map(projects.map(project=>[project.id,project]));
   const cards=[...grid.querySelectorAll(".project-card")];
   const info=card=>{
    const link=card.querySelector("[data-project],[data-nav]");
    return byId.get(link?.dataset.project||link?.dataset.nav);
   };
   const title=card=>info(card)?.name||card.querySelector(".project-copy h2")?.textContent||"";
   const date=card=>Date.parse(info(card)?.createdAt||"")||0;
   cards.sort((a,b)=>{
    if(sortSelect.value==="newest")return date(b)-date(a)||title(a).localeCompare(title(b));
    if(sortSelect.value==="oldest")return date(a)-date(b)||title(a).localeCompare(title(b));
    return (sortSelect.value==="name_desc"?-1:1)*title(a).localeCompare(title(b),undefined,{numeric:true,sensitivity:"base"});
   });
   for(const card of cards){
    const project=info(card);
    const description=card.querySelector(".project-copy p");
    if(project&&description)description.textContent=project.shortSummary||project.description||"";
    card.hidden=!project||
     [...activeTags].some(tag=>!projectTags(project).some(value=>value.toLowerCase()===tag))||
     terms.some(term=>![project.name,project.shortSummary,project.description,...projectTags(project)].join(" ").toLowerCase().includes(term));
    grid.append(card);
   }
   const shown=cards.filter(card=>!card.hidden).length;
   directoryStatus.textContent=shown+" of "+projects.length+" projects";
   empty.hidden=shown>0;
   empty.textContent=projects.length?"No projects match your search or filters.":"No projects yet.";
  };
  searchInput.oninput=updateDirectory;
  sortSelect.onchange=updateDirectory;
  updateProjectSummary=(id,summary)=>{
   const project=projects.find(item=>item.id===id);
   if(project){Object.assign(project,summary);updateDirectory()}
  };
  const dialog=element("dialog","project-account-dialog");
  dialog.innerHTML='<form class="project-account-form"><div class="project-account-header"><h2 class="project-account-title">Sign in</h2><button type="button" class="btn project-close" aria-label="Close account window">×</button></div><p class="project-account-subtitle muted">Private engineering application. Sign in with the existing owner account.</p><p class="project-account-message" role="status" aria-live="polite"></p><label class="project-account-email">Email<input class="field" type="email" name="email" autocomplete="email" required></label><label class="project-account-password">Password<input class="field" type="password" name="password" autocomplete="current-password" minlength="12" required></label><div class="project-account-buttons"><button class="btn primary project-signin" type="submit">Sign in</button><button class="btn project-signout hide" type="button">Sign out</button></div><div class="project-admin-link hide"><p class="muted">Already manage this website? Link your existing administrator access to this account.</p><label>Existing administrator password<input class="field" type="password" name="adminPassword" autocomplete="off"></label><button type="button" class="btn project-link-admin">Link administrator access</button></div></form>';
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
   dialog.querySelector(".project-admin-link").classList.toggle("hide",!signed||user.role==="admin");
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
  dialog.querySelector(".project-link-admin").onclick=async()=>{
   const field=dialog.querySelector('[name="adminPassword"]'),button=dialog.querySelector(".project-link-admin");
   if(!field.value){note.textContent="Enter your existing administrator password.";return}
   button.disabled=true;note.textContent="Verifying administrator access…";
   try{
    const data=await api("POST","/api/accounts",{action:"claim-admin",adminPassword:field.value});
    user=data.user;field.value="";dialog.close();location.reload();
   }catch(error){note.textContent=error.message}finally{button.disabled=false}
  };
  openAccount=showAccount;
  const editor=element("dialog","project-create-dialog");
  editor.innerHTML='<form method="dialog" class="project-create-form"><h2>New project</h2><p class="muted">Projects are private by default. Only you can edit them.</p><label>Project name<input class="field" name="name" maxlength="100" required></label><label>Description<textarea class="field" name="description" maxlength="500"></textarea></label><p class="project-create-message" role="status"></p><div class="row"><button type="button" class="btn primary project-create-save">Create project</button><button type="button" class="btn project-create-cancel">Cancel</button></div></form>';
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
  const template=window.BSProjectTemplate;
  const ensureProjectPage=project=>{
   const existing=document.getElementById(project.id);
   if(existing?.querySelector("[data-assembly-tree]"))return;
   if(!template)return;
   const section=template.cloneNode(true);
   section.id=project.id;section.classList.add("personal-project-view");
   // All projects, including original mini projects, use the identical assembly template.
   if(existing)existing.replaceWith(section);
   else document.getElementById("linear")?.after(section);
   section.querySelectorAll("[data-assembly-tree],[data-components],[data-photos]").forEach(node=>{
    if(node.hasAttribute("data-assembly-tree"))node.dataset.assemblyTree=project.id;
    if(node.hasAttribute("data-components"))node.dataset.components=project.id;
    if(node.hasAttribute("data-photos"))node.dataset.photos=project.id;
   });
   section.querySelectorAll('[data-nav="home"]').forEach(node=>node.dataset.nav="home");
   const heading=section.querySelector(".assembly-main h1");
   if(heading)heading.textContent=project.name;
  };
  const card=project=>{
   const article=element("article","project-card project-personal-card");article.dataset.catalogId=project.id;
   const link=element("button","project-link");link.type="button";link.dataset.project=project.id;
   const art=element("div","project-art project-personal-art");
   art.setAttribute("aria-hidden","true");
   art.append(element("span","project-personal-initial",(project.name||"P").trim().charAt(0).toUpperCase()));
   link.append(art);
   const copy=element("div","project-copy");copy.append(element("h2","",project.name),element("p","project-row-description",project.description||""));
   const tags=element("div","project-tags");
   const descriptors=projectTags(project);
   for(const tag of descriptors.slice(0,3))tags.append(element("span","",tag));
   if(descriptors.length>3){
    const extra=element("span","project-other-tags","+"+(descriptors.length-3));
    extra.title=descriptors.slice(3).join(", ");tags.append(extra);
   }
   const visibility=project.visibility==="private"?"Private":project.visibility==="unlisted"?"Unlisted":"Public";
   const metadata=project.authorName?visibility+" · By "+project.authorName:visibility;
   copy.append(tags,element("p","project-author",metadata));
   link.append(copy);article.append(link);
   return article;
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
   section.hidden=!project.isOwner;
   if(!project.isOwner)return;
   section.append(element("h2","","General"));
   const intro=element("p","muted","Only the owner can rename this project, change its visibility or permissions, or delete it.");
   section.append(intro);
   const form=element("div","project-summary-settings-form");
   const nameLabel=element("label","","Project name");
   const nameInput=element("input","field project-settings-name");
   nameInput.type="text";nameInput.maxLength=100;nameInput.required=true;
   nameInput.autocomplete="off";nameInput.value=project.name;
   nameInput.setAttribute("aria-label","Project name");
   nameLabel.append(nameInput);
   const visibility=element("label","","Visibility");
   const visibilitySelect=element("select","field");
   for(const [value,label] of [["private","Private — only you can view"],["public","Public — everyone can view"]]){
    const option=element("option","",label);option.value=value;visibilitySelect.append(option);
   }
   visibilitySelect.value=project.visibility||"public";
   visibility.append(visibilitySelect);
   const permissions=element("label","","Editing permissions");
   const permissionsSelect=element("select","field");
   for(const [value,label] of [["locked","Locked — owner only"],["approval","Allow suggestions — owner approval"]]){
    const option=element("option","",label);option.value=value;permissionsSelect.append(option);
   }
   permissionsSelect.value=project.editMode||"approval";
   permissions.append(permissionsSelect);
   const settingsTags=makeTagPicker(projectTags(project));
   form.append(nameLabel,settingsTags.element,visibility,permissions);
   const note=element("p","muted","Changing to Private hides this project from other users. People may still have copies of previously published materials.");
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
     await api("PATCH","/api/projects",{id:project.id,name,tags:settingsTags.getTags(),
      visibility:visibilitySelect.value,editMode:permissionsSelect.value});
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
   projectSettingsCard.append(section.querySelector("h2"),intro,form,note,actions,status);
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
    newButton.hidden=false;more.hidden=!user&&!adminAuthenticated;

    document.querySelectorAll(".project-personal-card").forEach(node=>node.remove());
    for(const project of projects){
     ensureProjectPage(project);
     if(project.id.startsWith("p"))grid.append(card(project));
    }
    renderTagFilters();updateDirectory();
    grid.hidden=false;loading.hidden=true;
    setupAssemblyTrees();setupComponents();setupPhotos();
    const route=location.hash.slice(1);
    const routedProject=projects.find(project=>route.startsWith(project.id+"/"));
    if(routedProject&&!document.getElementById(routedProject.id)?.classList.contains("active"))navigate(route);
    if(typeof refreshAdminUI==="function")refreshAdminUI();
    for(const project of projects){window.BSReview?.attach(project,user);mountProjectSettings(project)}
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
 };
 return {init,openAccount:()=>openAccount(),updateProjectSummary:(...args)=>updateProjectSummary(...args),isOwner:id=>currentProjects.some(project=>project.id===id&&project.isOwner),getProject:id=>currentProjects.find(project=>project.id===id)};
})();
