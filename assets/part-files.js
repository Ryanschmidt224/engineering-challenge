/* Private per-part engineering files. File versions are additive, not overwritten. */
(function(){
 "use strict";
 const node=(tag,cls,content)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(content!==undefined)e.textContent=content;return e};
 const extensions=/\.(x_t|x_b|stl|step|stp|iges|igs|sldprt|sldasm|dxf|dwg|zip|pdf|3mf|obj|csv|txt)$/i;
 function mount(target,isAdmin=()=>false){
  if(!target)return null;
  const title=node("h3","","Part files (CAD, Parasolid, STL, STEP)");
  const description=node("p","muted","Keep native engineering files with the part. Uploads are private and stored as separate revisions.");
  const list=node("div","part-file-list"),controls=node("div","part-file-controls");
  const upload=node("button","btn","+ Add part files");upload.type="button";
  const input=node("input");input.type="file";input.multiple=true;input.hidden=true;
  input.accept=".x_t,.x_b,.stl,.step,.stp,.iges,.igs,.sldprt,.sldasm,.dxf,.dwg,.zip,.pdf,.3mf,.obj,.csv,.txt";
  const status=node("p","muted part-file-status");status.setAttribute("role","status");
  const pagesTitle=node("h3","","Saved product webpages");
  const pagesList=node("div","part-saved-pages");
  controls.append(upload,input);target.append(title,description,list,controls,status,pagesTitle,pagesList);
  let location=null,token=0;
  const url=file=>{
   const params=new URLSearchParams({project:location.project,id:location.id});
   if(file)params.set("file",file);return "/api/part-files?"+params.toString();
  };
  async function load(project,id){
   location={project,id};const version=++token;list.replaceChildren(node("p","muted","Loading saved files…"));
   controls.classList.toggle("hide",!isAdmin());status.textContent="";
   if(!isAdmin()){list.replaceChildren(node("p","muted","Sign in as administrator to view private engineering files."));return}
   try{
    const response=await fetch(url(),{cache:"no-store",credentials:"same-origin"});
    const data=await response.json();if(!response.ok)throw Error(data.error||"Could not list files");
    if(version!==token)return;
    list.replaceChildren();
    if(!data.files?.length)list.append(node("p","muted","No part files uploaded."));
    for(const file of data.files||[]){
     const row=node("div","part-file-item");
     row.append(node("span","",file.name),node("span","muted",Math.round(file.size/1024)+" KB"));
     const download=node("a","btn","Download");download.href=url(file.id);download.download=file.name;
     row.append(download);list.append(row);
    }
    pagesList.replaceChildren();
    const pageResponse=await fetch("/api/part-pages?project="+encodeURIComponent(project)+"&id="+encodeURIComponent(id),{cache:"no-store",credentials:"same-origin"});
    const savedPages=await pageResponse.json();if(!pageResponse.ok)throw Error(savedPages.error||"Could not list saved web pages");
    if(version!==token)return;
    if(!savedPages.pages?.length)pagesList.append(node("p","muted","No product pages archived for this part."));
    for(const page of savedPages.pages||[]){
     const row=node("div","part-file-item");
     row.append(node("span","",page.url||"Archived product page"));
     const link=node("a","btn","Download saved HTML");
     link.href="/api/part-pages?"+new URLSearchParams({project,id,file:page.id}).toString();
     link.download="product-page-"+page.id+".html";
     row.append(link);pagesList.append(row);
    }
   }catch(error){if(version===token){list.replaceChildren(node("p","part-file-error",error.message));pagesList.replaceChildren()}}
  }
  upload.onclick=()=>input.click();
  input.onchange=async()=>{
   const files=[...input.files];input.value="";
   if(!location||!files.length||!isAdmin())return;
   const from={...location};upload.disabled=true;status.textContent="Saving files…";
   try{
    for(const file of files){
     if(!extensions.test(file.name)||file.size===0||file.size>20*1024*1024)throw Error("Unsupported format or size above 20 MB: "+file.name);
     if(location.project!==from.project||location.id!==from.id)throw Error("Part changed during upload");
     const result=await fetch(url(),{method:"POST",credentials:"same-origin",headers:{"content-type":"application/octet-stream","x-file-name":encodeURIComponent(file.name)},body:file});
     const data=await result.json();if(!result.ok)throw Error(data.error||"File upload failed");
    }
    await load(from.project,from.id);status.textContent="Engineering files saved.";
   }catch(error){status.textContent=error.message}finally{upload.disabled=false}
  };
  return {load};
 }
 window.BSPartFiles={mount};
})();