// Project dashboard. Private project data is authorized by the API, never by these DOM filters.
window.BSProjectManager=(()=>{
 let currentProjects=[],openAccount=()=>{};
 const api=async(method,path,body)=>{
  const response=await fetch(path,{method,credentials:"same-origin",cache:"no-store",
   ...(body?{headers:{"content-type":"application/json"},body:JSON.stringify(body)}:{})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){const error=new Error(data.error||"Request failed (HTTP "+response.status+")");error.status=response.status;error.code=data.code||"";throw error}
  return data;
 };
 const element=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node};
 const init=({setupAssemblyTrees,setupComponents,setupPhotos,navigate})=>{
  const root=document.querySelector("#home .project-index"),grid=root?.querySelector(".project-grid");if(!grid)return;
  const header=root.querySelector(".row.space"),controls=element("div","project-owner-actions");
  const newButton=element("button","btn primary","+ New project");newButton.type="button";
  const archiveButton=element("button","btn","Archived projects");archiveButton.type="button";
  controls.append(newButton,archiveButton);header.append(controls);
  const filters=element("div","project-directory-controls");
  const searchLabel=element("label","project-directory-label project-directory-search","Find a project");
  const searchInput=element("input","field project-search");searchInput.type="search";searchInput.placeholder="Search projects…";searchInput.setAttribute("aria-label","Search projects");searchLabel.append(searchInput);
  const sortLabel=element("label","project-directory-label","Sort by");
  const sortSelect=element("select","field project-sort-filter");
  for(const [value,label] of [["name_asc","Name A–Z"],["name_desc","Name Z–A"],["newest","Newest first"],["oldest","Oldest first"]]){
   const option=element("option","",label);option.value=value;sortSelect.append(option);
  }
  sortLabel.append(sortSelect);
  const directoryStatus=element("span","project-directory-count muted");directoryStatus.setAttribute("role","status");
  filters.append(searchLabel,sortLabel,directoryStatus);grid.before(filters);
  const catalogSidebar=element("div","bs-project-category-nav");
  const catalogLayout=window.BSCatalogUI?.build(root,catalogSidebar,[filters,grid]);
  const categoryNavigation=window.BSCatalogUI?.categories(catalogSidebar,{
   heading:"Browse projects",onChange:()=>updateDirectory()
  });
  const categoryOf=project=>String(project?.category||"Uncategorized").trim()||"Uncategorized";
  const suggestions=["Mechanical","Electronics","Software","Controls","CAD","3D Printing","Woodworking","PCB Design","Machining","Robotics","Measurement","Fabrication"];
  const projectTags=project=>Array.isArray(project?.tags)?project.tags:[];
  const parseTags=text=>[...new Map(String(text||"").split(",").map(x=>x.trim().replace(/\\s+/g," ")).filter(Boolean).map(x=>[x.toLowerCase(),x])).values()].slice(0,20);
  const tagFilter=element("div","bs-project-tag-filter");
  const tagTitle=element("span","bs-project-tag-title","Filter by skills and methods");
  const tagChoices=element("div","bs-project-tag-options");
  const clearTags=element("button","bs-project-tag-clear","Clear");clearTags.type="button";
  tagFilter.append(tagTitle,clearTags,tagChoices);
  grid.before(tagFilter);
  const activeTags=new Set();
  clearTags.onclick=()=>{activeTags.clear();renderTagFilters();updateDirectory()};
  const renderTagFilters=()=>{
   tagChoices.replaceChildren();
   const counts=new Map();
   for(const project of projects)for(const tag of projectTags(project)){
    const key=tag.toLowerCase();
    if(!counts.has(key))counts.set(key,{name:tag,count:0});
    counts.get(key).count++;
   }
   for(const [key,{name,count}] of [...counts].sort((a,b)=>a[1].name.localeCompare(b[1].name))){
    const chip=element("button","bs-project-tag-chip"+(activeTags.has(key)?" is-active":""),name);
    chip.type="button";chip.setAttribute("aria-pressed",String(activeTags.has(key)));
    chip.append(element("span","bs-project-tag-count",String(count)));
    chip.onclick=()=>{activeTags.has(key)?activeTags.delete(key):activeTags.add(key);renderTagFilters();updateDirectory()};
    tagChoices.append(chip);
   }
   tagFilter.hidden=!counts.size;
   clearTags.hidden=!activeTags.size;
  };
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
  const updateDirectory=()=>{
   const filter=categoryNavigation?.value||"all",search=searchInput.value.trim().toLowerCase(),byId=new Map(projects.map(project=>[project.id,project]));
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
    card.hidden=!project||(filter!=="all"&&categoryOf(project)!==filter)||
     [...activeTags].some(tag=>!projectTags(project).some(value=>value.toLowerCase()===tag))||
     !!search&&![project.name,project.description,categoryOf(project),...projectTags(project)].join(" ").toLowerCase().includes(search);
    grid.append(card);
   }
   directoryStatus.textContent=cards.filter(card=>!card.hidden).length+" projects";
  };
  searchInput.oninput=updateDirectory;
  sortSelect.onchange=updateDirectory;
  const dialog=element("dialog","project-account-dialog");
  dialog.innerHTML='<form class="project-account-form"><div class="project-account-header"><h2 class="project-account-title">Sign in</h2><button type="button" class="btn project-close" aria-label="Close account window">×</button></div><p class="project-account-subtitle muted">Your projects and Workshop are saved to your account.</p><p class="project-account-message" role="status" aria-live="polite"></p><label class="project-account-name hide">Display name<input class="field" name="displayName" maxlength="80" autocomplete="name"></label><label class="project-account-email">Email<input class="field" type="email" name="email" autocomplete="email" required></label><label class="project-account-password">Password<input class="field" type="password" name="password" autocomplete="current-password" minlength="12" required></label><div class="project-account-buttons"><button class="btn primary project-signin" type="submit">Sign in</button><button class="btn project-register" type="button">Create an account</button><button class="btn project-switch-login hide" type="button">Already have an account? Sign in</button><button class="btn project-signout hide" type="button">Sign out</button></div><div class="project-admin-link hide"><p class="muted">Already manage this website? Link your existing administrator access to this account.</p><label>Existing administrator password<input class="field" type="password" name="adminPassword" autocomplete="off"></label><button type="button" class="btn project-link-admin">Link administrator access</button></div></form>';
  document.body.append(dialog);
  const form=dialog.querySelector(".project-account-form");
  form.noValidate=true; // Use specific, actionable inline errors instead of browser bubbles.
  const passwordHint=element("p","project-password-hint muted","Use 12–256 characters.");
  dialog.querySelector(".project-account-password")?.append(passwordHint);
  const retryHelp=element("p","project-account-recovery muted");
  retryHelp.hidden=true;
  dialog.querySelector(".project-account-message")?.after(retryHelp);
  const note=dialog.querySelector(".project-account-message"),email=dialog.querySelector('[name="email"]'),
   password=dialog.querySelector('[name="password"]'),name=dialog.querySelector('[name="displayName"]');
  let user=null,projects=[],accountMode="login";
  const clearAccountError=()=>{
   note.textContent="";note.classList.remove("is-error");retryHelp.textContent="";retryHelp.hidden=true;
   for(const control of [email,password,name])control.removeAttribute("aria-invalid");
  };
  const showAccountError=(message,detail="",field=null)=>{
   note.classList.add("is-error");note.textContent=message;
   retryHelp.textContent=detail;retryHelp.hidden=!detail;
   if(field){field.setAttribute("aria-invalid","true");field.focus()}
  };
  for(const control of [email,password,name])control.addEventListener("input",()=>{
   control.removeAttribute("aria-invalid");
   if(note.classList.contains("is-error"))clearAccountError();
  });
  const explainAccountFailure=(error,action)=>{
   if(error.status===409||error.code==="EMAIL_IN_USE")
    return ["That email is already registered.","Select “Already have an account? Sign in” to use your existing account.",email];
   if(error.status===503||error.code==="ACCOUNT_STORAGE_UNAVAILABLE")
    return ["Account creation is temporarily unavailable.","The website could not access its account service. Please try again later. Your account may not have been created.",null];
   if(error.status===429)return ["Too many requests.","Try again later before submitting another request.",null];
   if(error.status===403)return ["Account request was not accepted.","Reload this website and try again. If the problem continues, the session or request origin may be invalid.",null];
   if(error.status===401)return ["Email or password not recognized.","Check both fields and try signing in again.",password];
   if(error.status===400||error.code==="INVALID_REGISTRATION")
    return ["Please check your account information.",error.message||"Use a valid email and a password between 12 and 256 characters.",null];
   return [action==="register"?"We couldn't create your account.":"We couldn't sign you in.",
    error.status?"Server error (HTTP "+error.status+"). "+error.message+" Try again later.":"Could not reach the server. Check your connection and try again.",null];
  };
  const updateAccount=()=>{
   const signed=!!user,registering=accountMode==="register"&&!signed;
   dialog.querySelector(".project-account-title").textContent=signed?"My account":registering?"Create account":"Sign in";
   dialog.querySelector(".project-account-subtitle").textContent=signed?user.email+" · "+(user.role==="admin"?"Administrator":"Member"):"Your projects and Workshop are saved to your account.";
   for(const selector of [".project-account-email",".project-account-password"])dialog.querySelector(selector).classList.toggle("hide",signed);
   dialog.querySelector(".project-account-name").classList.toggle("hide",!registering);
   dialog.querySelector(".project-signin").classList.toggle("hide",signed);
   dialog.querySelector(".project-signin").textContent=registering?"Create account":"Sign in";
   dialog.querySelector(".project-register").classList.toggle("hide",signed||registering);
   dialog.querySelector(".project-switch-login").classList.toggle("hide",signed||!registering);
   dialog.querySelector(".project-signout").classList.toggle("hide",!signed);
   dialog.querySelector(".project-admin-link").classList.toggle("hide",!signed||user.role==="admin");
   password.autocomplete=registering?"new-password":"current-password";
  };
  const showAccount=()=>{accountMode="login";clearAccountError();updateAccount();dialog.showModal()};
  dialog.querySelector(".project-close").onclick=()=>dialog.close();
  dialog.querySelector(".project-register").onclick=()=>{accountMode="register";clearAccountError();updateAccount();name.focus()};
  dialog.querySelector(".project-switch-login").onclick=()=>{accountMode="login";clearAccountError();updateAccount();email.focus()};
  async function sign(action){
   clearAccountError();
   const address=email.value.trim(),secret=password.value;
   if(!address||!email.validity.valid){
    showAccountError("Enter a valid email address.","Example: name@example.com",email);return
   }
   if(secret.length<12||secret.length>256){
    showAccountError("Your password must be between 12 and 256 characters.",
     secret.length<12?"Add "+(12-secret.length)+" more character"+(12-secret.length===1?"":"s")+" to continue.":"Shorten the password to 256 characters or fewer.",password);return
   }
   if(action==="register"&&!name.value.trim()){
    showAccountError("Enter a display name.","This is the name shown on projects you create.",name);return
   }
   const submit=dialog.querySelector(".project-signin");submit.disabled=true;
   note.textContent=action==="register"?"Creating account…":"Signing in…";
   try{
    const data=await api("POST","/api/accounts",{action,email:address,password:secret,displayName:name.value});
    user=data.user;password.value="";dialog.close();location.href="#home";location.reload();
   }catch(error){
    const [message,detail,control]=explainAccountFailure(error,action);
    showAccountError(message,detail,control);
   }finally{submit.disabled=false}
  }
  dialog.querySelector("form").onsubmit=event=>{event.preventDefault();void sign(accountMode)};
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
  editor.innerHTML='<form method="dialog" class="project-create-form"><h2>New project</h2><p class="muted">Projects are private by default. Only you can edit them.</p><label>Project name<input class="field" name="name" maxlength="100" required></label><label>Category<input class="field" name="category" maxlength="60" placeholder="Uncategorized" list="project-category-choices"></label><datalist id="project-category-choices"></datalist><label>Description<textarea class="field" name="description" maxlength="500"></textarea></label><p class="project-create-message" role="status"></p><div class="row"><button type="button" class="btn primary project-create-save">Create project</button><button type="button" class="btn project-create-cancel">Cancel</button></div></form>';
  document.body.append(editor);
  const createTagPicker=makeTagPicker();
  editor.querySelector(".project-create-form > label:nth-of-type(2)")?.after(createTagPicker.element);
  editor.querySelector(".project-create-cancel").onclick=()=>editor.close();
  const openCreate=()=>{
   if(!user){showAccount();note.textContent="Create an account or log in before creating a project.";return}
   const list=editor.querySelector("#project-category-choices");list.replaceChildren();
   for(const category of [...new Set(projects.map(categoryOf))].filter(value=>value!=="Uncategorized").sort()){
    const option=element("option");option.value=category;list.append(option);
   }
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
     category:form.elements.category.value.trim()||"Uncategorized",tags:createTagPicker.getTags(),kind:"project"});
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
   const copy=element("div","project-copy");copy.append(element("h2","",project.name),element("p","",project.description||"New engineering project"));
   const tags=element("div","project-tags");
   tags.append(element("span","",categoryOf(project)));
   for(const tag of projectTags(project))tags.append(element("span","",tag));
   tags.append(element("span","",project.visibility==="private"?"Private":project.visibility==="unlisted"?"Unlisted":"Public"));
   copy.append(tags);
   if(project.authorName)copy.append(element("p","project-author","By "+project.authorName));
   link.append(copy);article.append(link);
   return article;
  };
  const manageDialog=element("dialog","project-manage-dialog");document.body.append(manageDialog);
  archiveButton.onclick=async()=>{
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

  // Project-wide permissions belong to the summary, never to assembly instructions.
  function mountSummarySettings(project){
   const section=document.getElementById(project.id)?.querySelector(".project-summary-owner-settings");
   if(!section)return;
   section.replaceChildren();
   section.hidden=!project.isOwner;
   if(!project.isOwner)return;
   section.append(element("h2","","Project settings"));
   const intro=element("p","muted","Only the owner can change the visibility, permissions, or delete this project.");
   section.append(intro);
   const form=element("div","project-summary-settings-form");
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
   const groupLabel=element("label","","Category");
   const groupInput=element("input","field");groupInput.type="text";groupInput.maxLength=60;groupInput.required=true;
   groupInput.value=categoryOf(project);groupInput.placeholder="Uncategorized or a custom category";
   const suggestions=element("datalist");suggestions.id="project-groups-"+project.id;
   [...new Set(["Uncategorized",...projects.map(categoryOf)])].forEach(g=>{const opt=element("option");opt.value=g;suggestions.append(opt)});
   groupInput.setAttribute("list",suggestions.id);groupLabel.append(groupInput,suggestions);
   const settingsTags=makeTagPicker(projectTags(project));
   form.append(groupLabel,settingsTags.element,visibility,permissions);
   const note=element("p","muted","Changing to Private hides this project from other users. People may still have copies of previously published materials.");
   const status=element("p","project-summary-settings-status");status.setAttribute("role","status");
   const actions=element("div","project-summary-settings-actions");
   const save=element("button","btn primary","Save settings");save.type="button";
   save.onclick=async()=>{
    save.disabled=true;status.textContent="Saving…";
    try{
     await api("PATCH","/api/projects",{id:project.id,category:groupInput.value.trim()||"Uncategorized",tags:settingsTags.getTags(),visibility:visibilitySelect.value,editMode:permissionsSelect.value});
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
    user=(await api("GET","/api/accounts")).user;
    const data=await api("GET","/api/projects");if(!Array.isArray(data.projects))throw Error("Project catalog response unavailable");projects=data.projects;currentProjects=projects;
    newButton.hidden=false;archiveButton.hidden=!user&&!adminAuthenticated;

    document.querySelectorAll(".project-personal-card").forEach(node=>node.remove());
    for(const project of projects){
     ensureProjectPage(project);
     if(project.id.startsWith("p"))grid.append(card(project));
    }
    const categoryCounts=new Map();
    for(const project of projects)categoryCounts.set(categoryOf(project),(categoryCounts.get(categoryOf(project))||0)+1);
    categoryNavigation?.setItems([
     {value:"all",label:"All projects",count:projects.length},
     ...[...categoryCounts].sort(([a],[b])=>a.localeCompare(b)).map(([value,count])=>({value,label:value,count}))
    ]);
    renderTagFilters();updateDirectory();
    setupAssemblyTrees();setupComponents();setupPhotos();
    if(typeof refreshAdminUI==="function")refreshAdminUI();
    for(const project of projects){window.BSReview?.attach(project,user);mountSummarySettings(project)}
    document.querySelectorAll("[data-assembly-tree]").forEach(root=>root.dispatchEvent(new Event("projectpermissionschanged")));
   }catch(error){console.error("Project catalog unavailable",error)}
  }
  void refresh();
 };
 return {init,openAccount:()=>openAccount(),isOwner:id=>currentProjects.some(project=>project.id===id&&project.isOwner),getProject:id=>currentProjects.find(project=>project.id===id)};
})();
