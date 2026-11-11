// Project dashboard. Private project data is authorized by the API, never by these DOM filters.
window.BSProjectManager=(()=>{
 let currentProjects=[],openSettingsDialog=null;
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
   if(project.isOwner){
    const settings=element("div","project-card-actions");
    const manage=element("button","btn","Manage");manage.type="button";
    manage.onclick=event=>{event.stopPropagation();showManage(project)};
    settings.append(manage);article.append(settings);
   }
   return article;
  };
  const manageDialog=element("dialog","project-manage-dialog");document.body.append(manageDialog);
  function showManage(project){
   manageDialog.replaceChildren();
   const form=element("form","project-manage-form");form.method="dialog";
   form.append(element("h2","",project.name));
   form.append(element("p","muted","Privacy and project ownership settings. Only the project owner can change these."));
   const visibility=element("label","","Visibility");
   const visibilitySelect=element("select","field");
   for(const [value,label] of [["private","Private"],["public","Public"]]){
    const option=element("option","",label);option.value=value;visibilitySelect.append(option);
   }
   visibilitySelect.value=project.visibility||"public";visibility.append(visibilitySelect);form.append(visibility);
   form.append(element("p","muted","Private: visible only to you. Public: others can view approved project content and suggest instruction corrections when enabled."));
   const permission=element("label","","Editing mode");
   const permissionSelect=element("select","field");
   for(const [value,label] of [["locked","Owner only"],["approval","Owner approval required"]]){
    const option=element("option","",label);option.value=value;permissionSelect.append(option);
   }
   permissionSelect.value=project.editMode||"approval";permission.append(permissionSelect);form.append(permission);
   form.append(element("p","muted","Only the owner can change published records. Others can propose instruction edits when approval is enabled."));
   const error=element("p","project-manage-message");form.append(error);
   const actions=element("div","row");
   const save=element("button","btn primary","Save settings");save.type="button";
   save.onclick=async()=>{try{await api("PATCH","/api/projects",{id:project.id,visibility:visibilitySelect.value,editMode:permissionSelect.value});manageDialog.close();await refresh()}catch(e){error.textContent=e.message}};
   const archive=element("button","btn project-archive-button","Remove project");archive.type="button";archive.title="Archive the project without deleting its files";
   archive.onclick=async()=>{
    const confirmation=prompt('Remove this project from the site? Its parts, photos, and instructions will be kept so you can restore it later.\n\nType the exact project name to confirm: '+project.name);
    if(confirmation===null)return;
    try{await api("DELETE","/api/projects",{id:project.id,confirmName:confirmation});manageDialog.close();navigate("home");await refresh()}catch(e){error.textContent=e.message}
   };
   const close=element("button","btn","Close");close.type="button";close.onclick=()=>manageDialog.close();
   actions.append(save,archive,close);form.append(actions);
   form.append(element("p","muted","Remove project archives it. You can restore it from Projects → Archived projects; no project files are deleted."));
   manageDialog.append(form);manageDialog.showModal();
  }
  openSettingsDialog=id=>{
   const project=currentProjects.find(p=>p.id===id&&p.isOwner);
   if(project)showManage(project);
  };
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
    // Existing built-in projects can be managed by the site administrator.
    root.querySelectorAll(".project-card:not(.project-personal-card)").forEach(article=>{
     article.querySelector(".project-card-actions")?.remove();
     const link=article.querySelector("[data-project],[data-nav]"),id=link?.dataset.project||link?.dataset.nav;
     const project=projects.find(p=>p.id===id);
     if(!project?.isOwner)return;
     const actions=element("div","project-card-actions"),manage=element("button","btn","Manage");
     manage.onclick=event=>{event.stopPropagation();showManage(project)};
     actions.append(manage);article.append(actions);
    });
    // Existing public cards are hidden when archived or made private.
    const ids=new Set(projects.map(p=>p.id));
    root.querySelectorAll(".project-card:not(.project-personal-card)").forEach(article=>{
     const link=article.querySelector("[data-project],[data-nav]");
     if(link&&["launcher","linear","robot"].includes(link.dataset.project||link.dataset.nav))
      article.hidden=!ids.has(link.dataset.project||link.dataset.nav);
    });
    setupAssemblyTrees();setupComponents();setupPhotos();
    if(typeof refreshAdminUI==="function")refreshAdminUI();
    for(const project of projects)window.BSReview?.attach(project,user);
    document.querySelectorAll("[data-assembly-tree]").forEach(root=>root.dispatchEvent(new Event("projectpermissionschanged")));
   }catch(error){console.error("Project catalog unavailable",error)}
  }
  void refresh();
 };
 return {init,isOwner:id=>currentProjects.some(project=>project.id===id&&project.isOwner),openSettings:id=>openSettingsDialog?.(id)};
})();
