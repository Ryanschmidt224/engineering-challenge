/* PDFs exported from SolidWorks (or other CAD) for assembly and part work instructions. */
(function(){
 "use strict";
 const MAX_BYTES=20*1024*1024;
 const text=(tag,className,value)=>{
  const el=document.createElement(tag);
  if(className)el.className=className;
  if(value!==undefined)el.textContent=value;
  return el;
 };
 function mount(panel,admin=()=>false){
  if(!panel)return null;
  panel.classList.add("drawing-library");
  const title=text("h2","","Drawings (PDF)");
  const description=text("p","muted","Attach SolidWorks drawing PDFs, including multi-sheet drawings and revisions. Files stay with this assembly or part.");
  const list=text("div","drawing-list");
  const actions=text("div","drawing-actions");
  const drop=text("div","drawing-drop","Drop PDF drawings here or choose files");
  drop.tabIndex=0;drop.setAttribute("role","button");drop.setAttribute("aria-label","Choose PDF drawings to upload");
  const add=text("button","btn primary drawing-add","+ Add drawings");
  add.type="button";
  const fileInput=document.createElement("input");fileInput.type="file";fileInput.accept=".pdf,application/pdf";fileInput.multiple=true;fileInput.hidden=true;
  const replaceInput=document.createElement("input");replaceInput.type="file";replaceInput.accept=".pdf,application/pdf";replaceInput.hidden=true;
  const status=text("p","drawing-status");status.setAttribute("role","status");
  actions.append(drop,add,fileInput,replaceInput);
  panel.append(title,description,list,actions,status);
  let current=null,requestVersion=0,pendingReplacement=null,busy=false;
  const address=(file=null,download=false)=>{
   if(!current)return "";
   const params=new URLSearchParams({project:current.project,type:current.type,id:current.id});
   if(file)params.set("file",file);
   if(download)params.set("download","1");
   return "/api/drawings?"+params.toString();
  };
  const setAccess=()=>{
   const editor=!!admin();
   actions.classList.toggle("hide",!editor);
  };
  const checkFile=file=>{
   if(!file)return "Choose a PDF drawing.";
   if(!/\.pdf$/i.test(file.name))return "Choose a .pdf drawing export.";
   if(file.size<=0||file.size>MAX_BYTES)return "PDF drawings must be between 1 byte and 20 MB each.";
   return null;
  };
  async function load(project,type,id){
   const version=++requestVersion;
   current={project,type,id};setAccess();
   list.replaceChildren(text("p","muted","Loading drawings…"));status.textContent="";
   try{
    const res=await fetch(address(),{cache:"no-store"});
    const data=await res.json();
    if(!res.ok)throw Error(data.error||"Could not load drawings");
    if(version!==requestVersion)return;
    list.replaceChildren();
    const drawings=data.drawings||[];
    if(!drawings.length)list.append(text("p","muted","No drawings attached yet."));
    for(const drawing of drawings){
     const row=text("div","drawing-item");
     const info=text("div","drawing-info");
     const name=text("strong","drawing-name",drawing.name);
     const date=drawing.uploaded?new Date(drawing.uploaded).toLocaleDateString():"";
     info.append(name,text("span","drawing-meta",(drawing.size/1024/1024).toFixed(2)+" MB"+(date?" · "+date:"")));
     const controls=text("div","drawing-row-actions");
     const open=text("a","btn","View PDF");open.href=address(drawing.id);open.target="_blank";open.rel="noopener noreferrer";
     const download=text("a","btn","Download");download.href=address(drawing.id,true);download.download=drawing.name;
     controls.append(open,download);
     if(admin()){
      const replace=text("button","btn","Replace");replace.type="button";replace.onclick=()=>{pendingReplacement=drawing.id;replaceInput.click()};
      const remove=text("button","btn","Delete");remove.type="button";remove.onclick=async()=>{
       if(!confirm("Delete drawing \""+drawing.name+"\" from this "+(current.type==="part"?"part":"assembly")+"?"))return;
       remove.disabled=true;
       try{
        const response=await fetch(address(drawing.id),{method:"DELETE",credentials:"same-origin"});
        const result=await response.json().catch(()=>({}));
        if(!response.ok)throw Error(result.error||"Delete failed");
        await load(current.project,current.type,current.id);
        status.textContent="Drawing deleted.";
       }catch(e){status.textContent=e.message;remove.disabled=false}
      };
      controls.append(replace,remove);
     }
     row.append(info,controls);list.append(row);
    }
    if(data.truncated)status.textContent="Only the first 100 drawings are shown.";
   }catch(e){
    if(version!==requestVersion)return;
    list.replaceChildren(text("p","drawing-error","Drawings could not be loaded: "+e.message));
   }
  }
  async function upload(files,replacement=null){
   if(!current||!admin()||busy)return;
   const selected=[...files];
   if(!selected.length)return;
   if(replacement&&selected.length!==1){status.textContent="Choose one PDF to replace this drawing.";return}
   for(const file of selected){const error=checkFile(file);if(error){status.textContent=error;return}}
   const location={...current};busy=true;add.disabled=true;status.textContent="Uploading drawings…";
   try{
    let completed=0;
    for(const file of selected){
     if(current.project!==location.project||current.type!==location.type||current.id!==location.id)throw Error("The selected assembly or part changed. Reopen the drawings section.");
     const params=new URLSearchParams({project:location.project,type:location.type,id:location.id});
     if(replacement)params.set("file",replacement);
     const res=await fetch("/api/drawings?"+params.toString(),{
      method:"POST",credentials:"same-origin",
      headers:{"content-type":"application/pdf","x-drawing-name":file.name},
      body:file
     });
     const data=await res.json().catch(()=>({}));
     if(!res.ok)throw Error(file.name+": "+(data.error||"Upload failed (HTTP "+res.status+")"));
     completed++;
    }
    await load(location.project,location.type,location.id);
    status.textContent=(replacement?"Drawing replaced.":completed+" PDF drawing"+(completed===1?"":"s")+" saved.")+" Use View PDF to open a drawing.";
   }catch(e){status.textContent=e.message}
   finally{busy=false;add.disabled=false}
  }
  add.onclick=()=>fileInput.click();
  drop.onclick=()=>{if(admin())fileInput.click()};
  drop.onkeydown=e=>{if((e.key==="Enter"||e.key===" ")&&admin()){e.preventDefault();fileInput.click()}};
  fileInput.onchange=()=>{const files=[...fileInput.files];fileInput.value="";void upload(files)};
  replaceInput.onchange=()=>{
   const file=replaceInput.files?.[0],id=pendingReplacement;
   replaceInput.value="";pendingReplacement=null;
   if(file&&id)void upload([file],id);
  };
  drop.ondragover=e=>{
   if(!admin()||!e.dataTransfer.types.includes("Files"))return;
   e.preventDefault();e.dataTransfer.dropEffect="copy";drop.classList.add("is-dragover");
  };
  drop.ondragleave=e=>{if(!drop.contains(e.relatedTarget))drop.classList.remove("is-dragover")};
  drop.ondrop=e=>{
   if(!admin())return;
   e.preventDefault();drop.classList.remove("is-dragover");
   void upload(e.dataTransfer.files);
  };
  setAccess();
  return {load,setAccess};
 }
 window.BSDrawings={mount};
})();