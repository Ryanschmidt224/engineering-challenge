const make=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
const modes=[["details","Details"],["list","List"],["tiles","Tiles"]];
export function initProjectDirectory(options) {return initDirectory(options);}
export function initDirectory({grid,toolbar,projects,tags,search,sort,status,empty,photoUrl,noun="projects",viewLabel="Project view",storageKey="bs-project-view",onOpen}) {
 const photos=new Map();let view="details";
 try{const previous=localStorage.getItem(storageKey),saved=previous==="icons"?"tiles":previous;if(modes.some(([mode])=>mode===saved))view=saved;}catch{}
 grid.className="ui-project-list";
 const label=make("label","ui-toolbar-field","View"),select=make("select","ui-control");select.setAttribute("aria-label",viewLabel);
 for(const [value,title]of modes){const option=make("option","",title);option.value=value;select.append(option);}select.value=view;label.append(select);toolbar.insertBefore(label,status);
 const cover=async(id,art)=>{
  if(!photos.has(id))photos.set(id,fetch("/api/photos?project="+encodeURIComponent(id)+"&assembly=project-summary",{credentials:"same-origin",cache:"no-store"}).then(async response=>{
   if(!response.ok)throw Error("Project photo unavailable");const data=await response.json();return (data.photos||[]).find(photo=>photo.assembly==="project-summary"||!photo.assembly)?.id||null;
  }).catch(()=>null));
  const photo=await photos.get(id);if(!photo||!art.isConnected)return;
  const image=make("img","ui-project-cover");image.alt="";image.loading="lazy";
  image.onload=()=>{if(art.isConnected)art.replaceChildren(image);};
  image.onerror=()=>image.remove();art.append(image);image.src=photoUrl(photo);
 };
 function render(){
  const all=projects(),query=search.value.trim().toLowerCase().split(/\s+/).filter(Boolean),active=[...tags()];
  const visible=all.filter(project=>!active.some(tag=>!(project.tags||[]).some(value=>value.toLowerCase()===tag))&&!query.some(term=>![project.name,project.shortSummary,project.description,project.detail,...(project.keywords||[]),...(project.tags||[])].join(" ").toLowerCase().includes(term)));
  const date=project=>Date.parse(project.createdAt||"")||0;
  visible.sort((a,b)=>sort.value==="newest"?date(b)-date(a)||a.name.localeCompare(b.name):sort.value==="oldest"?date(a)-date(b)||a.name.localeCompare(b.name):(sort.value==="name_desc"?-1:1)*a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:"base"}));
  grid.dataset.view=view;grid.replaceChildren();
  for(const project of visible){
   const card=make("article","ui-project-card"),link=make("button","ui-project-open"),art=make("span","ui-project-image"),copy=make("span","ui-project-copy");
   card.dataset.catalogId=project.id;link.type="button";if(onOpen)link.onclick=()=>onOpen(project,link);else link.dataset.project=project.id;link.setAttribute("aria-label","Open "+project.name+(onOpen?"":" project"));art.setAttribute("aria-hidden","true");art.textContent=project.name.trim().charAt(0).toUpperCase();
   copy.append(make("strong","ui-project-name",project.name));
   const summary=project.shortSummary||project.description;if(summary)copy.append(make("span","ui-project-caption",summary));
   const descriptors=make("span","ui-project-tags");for(const tag of (project.tags||[]).slice(0,3))descriptors.append(make("span","ui-chip",tag));if(project.tags?.length>3){const more=make("span","ui-chip","+"+(project.tags.length-3));more.title=project.tags.slice(3).join(", ");descriptors.append(more);}if(descriptors.children.length)copy.append(descriptors);
   const created=make("span","ui-project-created");if(date(project)){const time=make("time","",new Intl.DateTimeFormat(undefined,{dateStyle:"medium"}).format(new Date(project.createdAt)));time.dateTime=project.createdAt;created.append(document.createTextNode("Created "),time);}
   link.append(art,copy,created);card.append(link);grid.append(card);if(photoUrl)void cover(project.id,art);
  }
  status.textContent=visible.length+" of "+all.length+" "+noun;empty.hidden=visible.length>0;empty.textContent=all.length?"No "+noun+" match your search or filters.":"No "+noun+" yet.";
 }
 select.onchange=()=>{view=select.value;try{localStorage.setItem(storageKey,view);}catch{}render();};
 search.oninput=render;sort.onchange=render;
 if(photoUrl)window.addEventListener("projectphotoschanged",event=>{photos.delete(event.detail);render();});
 return {render};
}
