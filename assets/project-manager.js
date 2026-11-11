// Project dashboard. Private project data is authorized by the API, never by these DOM filters.
window.BSProjectManager=(()=>{
 let currentProjects=[];
 const api=async(method,path,body)=>{
  const response=await fetch(path,{method,credentials:"same-origin",cache:"no-store",
   ...(body?{headers:{"content-type":"application/json"},body:JSON.stringify(body)}:{})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error||"Request failed");
  return data;
 };
 const element=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node};
 const init=({setupAssemblyTrees,setupComponents,setupPhotos,navigate})=>{
  const root=document.querySelector("#home .project-index"),grid=root?.querySelector(".project-grid");if(!grid)return;
  const header=root.querySelector(".row.space"),controls=element("div","project-owner-actions");
  const newButton=element("button","btn primary","+ New project");newButton.type="button";
  const accountButton=element("button","btn","My account");accountButton.type="button";
  const archiveButton=element("button","btn","Archived projects");archiveButton.type="button";
  controls.append(newButton,archiveButton,accountButton);header.append(controls);
  const dialog=element("dialog","project-account-dialog");
  dialog.innerHTML='<form method="dialog" class="project-account-form"><h2>My account</h2><p class="project-account-message muted" role="status"></p><label>Email<input class="field" type="email" name="email" autocomplete="email" required></label><label>Password<input class="field" type="password" name="password" autocomplete="current-password" minlength="12" required></label><label class="project-account-name hide">Display name<input class="field" name="displayName" maxlength="80"></label><div class="row project-account-buttons"><button class="btn primary project-signin" type="button">Log in</button><button class="btn project-register" type="button">Create account</button><button class="btn project-signout hide" type="button">Log out</button><button class="btn project-close" type="button">Close</button></div></form>';
  document.body.append(dialog);
  const note=dialog.querySelector(".project-account-message"),email=dialog.querySelector('[name="email"]'),
   password=dialog.querySelector('[name="password"]'),name=dialog.querySelector('[name="displayName"]');
  let user=null,projects=[];
  const showAccount=()=>{note.textContent=user?"Signed in as "+user.displayName:"Sign in or create an account to manage your projects.";
   dialog.querySelectorAll(".project-signin,.project-register").forEach(button=>button.classList.toggle("hide",!!user));
   dialog.querySelector(".project-signout").classList.toggle("hide",!user);
   dialog.querySelectorAll('[name="email"],[name="password"]').forEach(input=>input.closest("label").classList.toggle("hide",!!user));
   dialog.showModal();
  };
  accountButton.onclick=showAccount;
  dialog.querySelector(".project-close").onclick=()=>dialog.close();
  async function sign(action){
   try{
    const data=await api("POST","/api/accounts",{action,email:email.value,password:password.value,displayName:name.value});
    user=data.user;password.value="";dialog.close();location.href="#home";location.reload();
   }catch(error){note.textContent=error.message}
  }
  dialog.querySelector(".project-signin").onclick=()=>sign("login");
  dialog.querySelector(".project-register").onclick=()=>sign("register");
  dialog.querySelector(".project-signout").onclick=async()=>{await api("DELETE","/api/accounts");user=null;dialog.close();location.href="#home";location.reload()};
  const editor=element("dialog","project-create-dialog");
  editor.innerHTML='<form method="dialog" class="project-create-form"><h2>New project</h2><p class="muted">Projects are private by default. Only you can edit them.</p><label>Project name<input class="field" name="name" maxlength="100" required></label><label>Description<textarea class="field" name="description" maxlength="500"></textarea></label><p class="project-create-message" role="status"></p><div class="row"><button type="button" class="btn primary project-create-save">Create project</button><button type="button" class="btn project-create-cancel">Cancel</button></div></form>';
  document.body.append(editor);
  editor.querySelector(".project-create-cancel").onclick=()=>editor.close();
  newButton.onclick=()=>{if(!user){showAccount();note.textContent="Create an account or log in before creating a project.";return}editor.showModal()};
  editor.querySelector(".project-create-save").onclick=async()=>{
   const form=editor.querySelector("form"),button=editor.querySelector(".project-create-save");button.disabled=true;
   try{const data=await api("POST","/api/projects",{name:form.elements.name.value,description:form.elements.description.value,kind:"project"});
    const createdName=form.elements.name.value,created=data.projects.find(p=>p.name===createdName&&p.ownerId===user?.id);
    editor.close();form.reset();await refresh();navigate(created?.id||"home");
   }catch(error){editor.querySelector(".project-create-message").textContent=error.message}
   finally{button.disabled=false}
  };
  // The legacy assembly HTML is a stable template until a reusable component replaces it.
  const template=document.getElementById("linear");
  const ensureProjectPage=project=>{
   if(document.getElementById(project.id))return;
   if(!template)return;
   const section=template.cloneNode(true);
   section.id=project.id;section.classList.add("personal-project-view");
   section.querySelectorAll("[data-assembly-tree],[data-components],[data-photos]").forEach(node=>{
    if(node.hasAttribute("data-assembly-tree"))node.dataset.assemblyTree=project.id;
    if(node.hasAttribute("data-components"))node.dataset.components=project.id;
    if(node.hasAttribute("data-photos"))node.dataset.photos=project.id;
   });
   const heading=section.querySelector(".assembly-main h1");
   if(heading)heading.textContent=project.name;
   template.parentNode.insertBefore(section,template.nextSibling);
  };
  const card=project=>{
   const article=element("article","project-card project-personal-card");article.dataset.catalogId=project.id;
   const link=element("button","project-link");link.type="button";link.dataset.project=project.id;
   link.append(element("div","project-art project-personal-art","◈"));
   const copy=element("div","project-copy");copy.append(element("h2","",project.name),element("p","",project.description||"New engineering project"));
   copy.append(element("div","project-tags",project.visibility==="private"?"Private project":project.visibility==="unlisted"?"Unlisted project":"Public project"));
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
   form.append(visibility,permissions);
   const note=element("p","muted","Changing to Private hides this project from other users. People may still have copies of previously published materials.");
   const status=element("p","project-summary-settings-status");status.setAttribute("role","status");
   const actions=element("div","project-summary-settings-actions");
   const save=element("button","btn primary","Save settings");save.type="button";
   save.onclick=async()=>{
    save.disabled=true;status.textContent="Saving…";
    try{
     await api("PATCH","/api/projects",{id:project.id,visibility:visibilitySelect.value,editMode:permissionsSelect.value});
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
   // A project has two independent sequential ranges: assemblies 0001–1000,
   // and custom parts 1001 onward. Formatting can change without renumbering.
   const numbering=element("section","project-numbering-settings");
   numbering.append(element("h3","","Part numbering"));
   const explanation=element("p","muted","One sequence per project. Numbers 1–1000 are reserved for assemblies; custom parts start at 1001. Purchased parts and tools are numbered only when requested.");
   numbering.append(explanation);
   const fields=element("div","project-numbering-fields");
   const prefixLabel=element("label","","Prefix"),prefix=element("input","field");
   prefix.maxLength=10;prefix.value="NR";prefix.placeholder="NR";prefix.autocomplete="off";prefixLabel.append(prefix);
   const digitsLabel=element("label","","Minimum digits"),digits=element("select","field");
   for(const value of [3,4,5,6,7,8]){const opt=element("option","",String(value));opt.value=String(value);digits.append(opt)}
   digits.value="4";digitsLabel.append(digits);fields.append(prefixLabel,digitsLabel);
   const preview=element("p","project-numbering-preview");
   const statusNumber=element("p","project-summary-settings-status");statusNumber.setAttribute("role","status");
   const previewUpdate=()=>{
    const label=prefix.value.toUpperCase().trim();
    const width=Number(digits.value);
    preview.textContent="Next assembly: "+label+String(numbering.dataset.nextAssembly||1).padStart(width,"0")+
     "   ·   Next custom part: "+label+String(numbering.dataset.nextPart||1001).padStart(width,"0");
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
    "Keep revisions separate: NR1001 · Rev A, rather than changing the part number.",
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
    numbering.dataset.nextPart=data.nextPart||1001;
    previewUpdate();
   }).catch(error=>{statusNumber.textContent="Could not load numbering settings: "+error.message;previewUpdate()});

  }
  async function refresh(){
   try{
    user=(await api("GET","/api/accounts")).user;
    const data=await api("GET","/api/projects");if(!Array.isArray(data.projects))throw Error("Project catalog response unavailable");projects=data.projects;currentProjects=projects;
    newButton.hidden=!user;archiveButton.hidden=!user&&!adminAuthenticated;
    document.querySelectorAll(".project-personal-card").forEach(node=>node.remove());
    for(const project of projects){
     if(!project.id.startsWith("p"))continue;
     ensureProjectPage(project);
     grid.append(card(project));
    }
    // Existing public cards are hidden when archived or made private.
    const ids=new Set(projects.map(p=>p.id));
    root.querySelectorAll(".project-card:not(.project-personal-card)").forEach(article=>{
     const link=article.querySelector("[data-project],[data-nav]");
     if(link&&["launcher","linear","robot"].includes(link.dataset.project||link.dataset.nav))
      article.hidden=!ids.has(link.dataset.project||link.dataset.nav);
    });
    setupAssemblyTrees();setupComponents();setupPhotos();
    if(typeof refreshAdminUI==="function")refreshAdminUI();
    for(const project of projects){window.BSReview?.attach(project,user);mountSummarySettings(project)}
    document.querySelectorAll("[data-assembly-tree]").forEach(root=>root.dispatchEvent(new Event("projectpermissionschanged")));
   }catch(error){console.error("Project catalog unavailable",error)}
  }
  void refresh();
 };
 return {init,isOwner:id=>currentProjects.some(project=>project.id===id&&project.isOwner),getProject:id=>currentProjects.find(project=>project.id===id)};
})();
