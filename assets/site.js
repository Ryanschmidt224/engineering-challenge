// Knowledge tiles live on knowledge.html; Calculators has its own route.
function navigate(page){if(page==="commonparts"||page==="tools"){location.href="workshop.html";return;}if(page==="knowledge"||page==="community"){location.href="knowledge.html";return;}const route=page.match(/^([a-z0-9]+)\/(?:(?:assembly|workspace|part|bom)\/([^/]+)|parts|settings)$/);if(route)page=route[1];if(page==="challenge"||page==="workshop")page="launcher";if(page==="tools")page="commonparts";if(!document.getElementById(page)&&/^(?:launcher|linear|robot|p[a-f0-9]{32})$/.test(page))return;if(!document.getElementById(page))page="home";document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===page));document.querySelectorAll("nav button").forEach(b=>b.classList.toggle("active",b.dataset.nav===page));if(!route||location.hash.slice(1)!==route[0])location.hash=page;window.scrollTo({top:0,behavior:"instant"})}
document.addEventListener("click",e=>{const nav=e.target.closest("[data-nav]");if(nav){e.preventDefault();navigate(nav.dataset.nav)}const project=e.target.closest("[data-project]");if(project)navigate(project.dataset.project)});
window.addEventListener("hashchange",()=>{
 const hash=location.hash.slice(1)||"home";navigate(hash);
 const route=hash.match(/^([a-z0-9]+)\/(?:assembly|workspace|part|bom)\/([^/]+)$/);
 if(route){
  const root=document.querySelector('[data-assembly-tree="'+route[1]+'"]');
  root?.dispatchEvent(new CustomEvent(hash.includes("/part/")?"openpart":"openassembly",{detail:decodeURIComponent(route[2])}));
 }else{
  const manager=hash.match(/^([a-z0-9]+)\/(?:parts|settings)$/);
  if(manager)document.querySelector('[data-assembly-tree="'+manager[1]+'"]')?.dispatchEvent(new Event("openprojectpage"));
 }
});
let adminAuthenticated=false;
const photoToken=()=>adminAuthenticated?"session":"";
 const isOwnProject=element=>window.BSProjectManager?.isOwner?.(element.closest(".view")?.id)===true;
const accountMenuButton=document.getElementById("accountMenuButton");
function refreshAdminUI(){
 window.BSResources?.setAdmin?.(adminAuthenticated);
 document.querySelectorAll(".photo-admin,.component-section").forEach(el=>{
  el.querySelectorAll(".photo-upload,.component-save").forEach(control=>control.hidden=!(adminAuthenticated||isOwnProject(el)));
  // Keep the retired lookup action hidden after authentication refreshes.
  el.querySelectorAll(".component-extract").forEach(control=>control.hidden=!!el.bsProductLookup);
 });
}
async function checkAdmin(){
 try{
  const response=await fetch("/api/accounts",{cache:"no-store",credentials:"same-origin"});
  const data=await response.json();
  adminAuthenticated=response.ok&&data.user?.role==="admin";
  if(accountMenuButton)accountMenuButton.textContent=data.user?"Account":"Sign in";
 }catch{adminAuthenticated=false;if(accountMenuButton)accountMenuButton.textContent="Sign in"}
 refreshAdminUI();
}
accountMenuButton.onclick=()=>window.BSProjectManager?.openAccount?.();
checkAdmin();
function setupPhotos(){document.querySelectorAll("[data-photos]:not([data-photos-ready])").forEach(root=>{root.dataset.photosReady="true";const project=root.dataset.photos,canEditPhoto=()=>adminAuthenticated||window.BSProjectManager?.isOwner?.(project),grid=root.querySelector(".photo-grid"),status=root.querySelector(".photo-status"),fileInput=root.querySelector('input[type="file"]'),caption=root.querySelector(".photo-caption");const zone=root.querySelector(".photo-dropzone"),preview=root.querySelector(".photo-preview"),previewImg=preview.querySelector("img"),filename=root.querySelector(".photo-filename");let selectedFile=null,previewUrl=null;
function selectFile(file){if(!file)return;if(!file.type.startsWith("image/")&&!/\\.(heic|heif)$/i.test(file.name)){say("Choose an image file.");return}if(file.size>10*1024*1024){say("Choose a photo under 10 MB.");return}selectedFile=file;filename.textContent=file.name;preview.classList.remove("hide");if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=URL.createObjectURL(file);previewImg.src=previewUrl;previewImg.onerror=()=>{previewImg.style.display="none"};previewImg.onload=()=>{previewImg.style.display=""};say("Photo selected.");uploadSelected()}
zone.addEventListener("click",e=>{if(e.target!==fileInput)fileInput.click()});zone.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();fileInput.click()}});fileInput.addEventListener("change",()=>selectFile(fileInput.files?.[0]));
let dragDepth=0;zone.addEventListener("dragenter",e=>{e.preventDefault();dragDepth++;zone.classList.add("dragover")});zone.addEventListener("dragover",e=>{e.preventDefault();e.dataTransfer.dropEffect="copy"});zone.addEventListener("dragleave",e=>{e.preventDefault();if(--dragDepth<=0){dragDepth=0;zone.classList.remove("dragover")}});zone.addEventListener("drop",e=>{e.preventDefault();dragDepth=0;zone.classList.remove("dragover");selectFile([...e.dataTransfer.files].find(f=>f.type.startsWith("image/")||/\\.(heic|heif)$/i.test(f.name)))});root.querySelector(".photo-clear").addEventListener("click",()=>{selectedFile=null;fileInput.value="";preview.classList.add("hide");if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=null;say("Selection cleared.")});
const uploadStatus=root.querySelector(".photo-upload-status");const say=s=>{uploadStatus.textContent=s};
const uploader=window.BSPhotoEditor.uploadPanel({
 title:"Add photos",multiple:false,accept:"image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,image/*",
 hint:"JPG, PNG, WebP, GIF or HEIC. Maximum 10 MB.",
 onFiles:files=>selectFile(files[0])
});
const trigger=document.createElement("button");trigger.type="button";trigger.className="btn";trigger.textContent="+ Add photo";
trigger.onclick=()=>uploader.open();
zone.hidden=true;zone.style.display="none";zone.after(trigger,uploader.panel);
async function render(){try{const res=await fetch("/api/photos?project="+encodeURIComponent(project));const data=await res.json();if(!res.ok){status.textContent=data.error||"Photos unavailable.";grid.replaceChildren();return}grid.replaceChildren();for(const p of data.photos){const card=document.createElement("div");card.className="photo-card";const link=document.createElement("a");link.href=p.url;link.target="_blank";link.rel="noopener noreferrer";const img=document.createElement("img");img.src=p.url;img.alt=p.caption||p.name;img.loading="lazy";link.append(img);card.append(link);if(p.caption){const label=document.createElement("p");label.textContent=p.caption;card.append(label)}if(canEditPhoto()){const del=document.createElement("button");del.className="btn photo-delete";del.textContent="Delete";del.addEventListener("click",async()=>{if(!await window.BSDialogs.danger("Delete this photo from the website?",{title:"Delete photo?"}))return;const res=await fetch("/api/photos?id="+encodeURIComponent(p.id),{method:"DELETE",credentials:"same-origin"});const data=await res.json();if(!res.ok){say(data.error||"Delete failed");return}await render()});card.append(del)}grid.append(card)}if(root.closest(".assembly-main-tile")){let active=0;const cards=[...grid.children];const update=()=>cards.forEach((c,i)=>c.hidden=i!==active);update();if(cards.length>1){for(const [dir,mark] of [[-1,"‹"],[1,"›"]]){const arrow=document.createElement("button");arrow.type="button";arrow.className="assembly-main-arrow "+(dir<0?"previous":"next");arrow.textContent=mark;arrow.setAttribute("aria-label",dir<0?"Previous photo":"Next photo");arrow.onclick=()=>{active=(active+dir+cards.length)%cards.length;update()};grid.append(arrow)}}}status.textContent=data.photos.length?data.photos.length+" photo"+(data.photos.length===1?"":"s"):(data.truncated?"More photos available.":"No photos yet.")}catch(e){status.textContent="Photos unavailable. Check the Cloudflare R2 setup."}}
async function uploadSelected(){const file=selectedFile;if(!file){say("Choose a photo first.");return}if(!canEditPhoto()){say("Sign in to your account.");return}if(file.size>10*1024*1024){say("Choose a photo under 10 MB.");return}zone.setAttribute("aria-busy","true");say("Uploading…");try{const res=await fetch("/api/photos",{method:"POST",headers:{"authorization":"Bearer "+photoToken(),"content-type":file.type||"application/octet-stream","x-photo-project":project,"x-photo-caption":encodeURIComponent(caption.value).slice(0,600),"x-photo-name":encodeURIComponent(file.name).slice(0,300)},body:file});const data=await res.json();if(!res.ok){if(res.status===401){adminAuthenticated=false;refreshAdminUI()}say(res.status===401?"Session expired. Log in again using Admin login.":data.error||"Upload failed.");return}fileInput.value="";selectedFile=null;preview.classList.add("hide");if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=null;caption.value="";await render();say("Photo uploaded.")}catch(e){say("Upload failed. Check your connection and Cloudflare setup.")}finally{zone.removeAttribute("aria-busy")}}
render()})}
setupPhotos();


// Canonical assembly, BOM, part and photo controller is in assets/site-assembly.js.
setupAssemblyTrees();

function setupComponents(){
 document.querySelectorAll("[data-components]:not([data-components-ready])").forEach(root=>{root.dataset.componentsReady="true";
 const project=root.dataset.components,canEditComponent=()=>adminAuthenticated||window.BSProjectManager?.isOwner?.(project),list=root.querySelector(".component-list"),status=root.querySelector(".component-status"),review=root.querySelector(".component-review"),specs=root.querySelector(".component-specs");

 // The old markup nested the part list inside a collapsible <details>.
 // Keep the saved parts in a permanent visible region, independent of the editor.
 if(root.closest("[data-assembly-tree]")||["launcher","linear","robot"].includes(project)){
  root.prepend(list);
  list.classList.add("bom-visible-parts");
 }
 const field=name=>root.querySelector(".component-"+name);
 const priceBasis=field("historical-price-basis"),packageCount=field("historical-package-quantity"),priceField=field("historical-price");
 const recordedDate=field("historical-price-date");
 const todayLocal=()=>new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
 priceField?.addEventListener("input",()=>{if(priceField.value&&!recordedDate?.value&&recordedDate)recordedDate.value=todayLocal()});
 const updatePriceControls=()=>{
  const packaged=priceBasis?.value==="per_package";
  const packageLabel=root.querySelector(".historical-package-count");
  if(packageLabel)packageLabel.hidden=!packaged;
  if(packageCount)packageCount.required=packaged&&!!priceField?.value;
  const hint=root.querySelector(".historical-unit-hint");
  const amount=Number(priceField?.value),count=Number(packageCount?.value);
  if(hint)hint.textContent=packaged&&priceField?.value&&Number.isSafeInteger(count)&&count>0?
   "Equivalent to $"+(amount/count).toFixed(4)+" per part.":"";
 };
 priceBasis?.addEventListener("change",updatePriceControls);
 priceField?.addEventListener("input",updatePriceControls);
 packageCount?.addEventListener("input",updatePriceControls);
 updatePriceControls();
 const say=message=>{status.textContent=message;status.hidden=false;status.style.display="block";status.setAttribute("aria-live","polite");};
 function specRow(name="",value="",source="explicit"){
  const row=document.createElement("div");row.className="row component-spec-row";
  const a=document.createElement("input"),b=document.createElement("input"),c=document.createElement("select"),del=document.createElement("button");
  a.className=b.className="field";a.placeholder="Specification";b.placeholder="Value";a.value=name;b.value=value;
  c.className="field component-spec-source";c.setAttribute("aria-label","Specification source");
  for(const opt of ["explicit","inferred"]){const el=document.createElement("option");el.value=opt;el.textContent=opt==="explicit"?"✓ From product listing":"◇ Estimated / inferred";c.append(el)}c.value=source;
  del.className="btn component-spec-remove";del.type="button";del.textContent="×";del.title="Remove specification";del.setAttribute("aria-label","Remove specification");del.onclick=()=>row.remove();row.append(a,b,c,del);specs.append(row)
 }
 let refreshVersion=0;
 async function refresh(){
  const version=++refreshVersion,selected=assemblySelections[project]??null;
  try{
   const response=await fetch("/api/components?project="+encodeURIComponent(project),{cache:"no-store"});
   const payload=await response.json();
   if(!response.ok)throw Error(payload.error||"HTTP "+response.status);
   if(version!==refreshVersion||selected!==(assemblySelections[project]??null))return;
   const all=Array.isArray(payload.components)?payload.components:[];
   const tree=assemblyTreeSnapshots[project];
   // Traverse the selected assembly and its children, not unrelated branches.
   const orderedIds=[selected];
   const seen=new Set(orderedIds);
   if(tree){
    const walk=parent=>{
     for(const node of tree.nodes.filter(n=>n.parentId===parent)){
      if(seen.has(node.id))continue;
      seen.add(node.id);orderedIds.push(node.id);walk(node.id);
     }
    };
    walk(selected);
   }
   const partGroups=orderedIds.map(id=>({
    id,
    name:id===null?(tree?.title||"Main project"):(tree?.nodes.find(n=>n.id===id)?.name||"Assembly"),
    parts:all.filter(part=>(part.assemblyId??null)===id)
   })).filter(group=>group.parts.length);
   list.replaceChildren();
   if(!partGroups.length){
    const empty=document.createElement("p");empty.className="bom-empty";
    empty.textContent="No parts saved in this assembly"+(tree?" or its subassemblies":"")+". Use + New part to add one.";
    list.append(empty);return;
   }
   const total=partGroups.reduce((sum,g)=>sum+g.parts.length,0);
   const count=document.createElement("p");count.className="bom-count";
   count.textContent=total+" part"+(total===1?"":"s")+" in this assembly"+(tree?" and its subassemblies":"");
   list.append(count);
   for(const group of partGroups){
    const section=document.createElement("section");section.className="bom-origin-group";
    if(tree){
     const heading=document.createElement("h3");heading.className="bom-origin-title";
     heading.textContent=group.name+(group.id===selected?" · This assembly":" · Subassembly");
     section.append(heading);
    }
    const stack=document.createElement("div");stack.className="bom-part-stack";
    for(const c of group.parts){
     const item=document.createElement("details");item.className="bom-part";item.dataset.partId=c.id;
     const summary=document.createElement("summary");summary.className="bom-part-summary";
     summary.title="Click to expand or collapse part details";
     summary.setAttribute("aria-label","Show or hide details for "+c.name);
     const label=document.createElement("span");label.className="bom-part-name";label.textContent=c.name;
     const meta=document.createElement("span");meta.className="bom-part-meta";meta.textContent=(c.quantity===null||c.quantity===undefined?"Qty not specified":"Qty "+c.quantity+(c.quantityUnit?" "+c.quantityUnit:""))+(c.model?" · "+c.model:"");
     const hint=document.createElement("span");hint.className="bom-part-toggle-label";hint.textContent="Details";
     summary.append(label,meta,hint);item.append(summary);
     const body=document.createElement("div");body.className="bom-part-body";
     for(const [fieldName,value] of [["Historical price",c.historicalPrice!==null&&c.historicalPrice!==undefined?"$"+Number(c.historicalPrice).toFixed(2)+" USD per unit"+(c.historicalPriceDate?" (recorded "+c.historicalPriceDate+")":""):null],["Manufacturer",c.manufacturer],["Mfg part number",c.model],["Supplier",c.supplier],["ASIN",c.asin],["Category",c.category]]){
      if(!value)continue;
      const line=document.createElement("p"),strong=document.createElement("strong");
      strong.textContent=fieldName+": ";line.append(strong,document.createTextNode(value));body.append(line);
     }
     if(c.specifications?.length){
      const title=document.createElement("strong");title.textContent="Specifications";body.append(title);
      const ul=document.createElement("ul");
      for(const spec of c.specifications){const li=document.createElement("li");li.textContent=spec.name+": "+spec.value+(spec.source==="inferred"?" (inferred)":"");ul.append(li)}
      body.append(ul);
     }
     if(canEditComponent()){
      const del=document.createElement("button");del.type="button";del.className="btn";del.textContent="Delete part";
      del.onclick=async()=>{
       if(!await window.BSDialogs.danger("Delete "+c.name+" from "+group.name+"?",{title:"Delete part?"}))return;
       del.disabled=true;
       try{
        const res=await fetch("/api/components?project="+encodeURIComponent(project)+"&id="+encodeURIComponent(c.id),{method:"DELETE",credentials:"same-origin"});
        const data=await res.json().catch(()=>({}));
        if(!res.ok)throw Error(data.error||"Delete failed");
        say("Part deleted.");await refresh();
       }catch(error){say(error.message);del.disabled=false}
      };
      body.append(del);
     }
     item.append(body);stack.append(item);
    }
    section.append(stack);list.append(section);
   }
  }catch(error){
   if(version!==refreshVersion)return;
   list.replaceChildren();
   const failure=document.createElement("p");failure.className="bom-error";
   failure.textContent="Unable to load BOM: "+error.message;
   list.append(failure);
  }
 }
 const importPanel=root.querySelector(".component-admin");
 // A fresh part is a fresh draft. Only Save component writes a new BOM record.
 function clearPartEditor(){
  for(const name of ["name","full-name","manufacturer","model","category","supplier","asin"]){const control=field(name);if(control)control.value=""}
  field("description").value="";if(field("quantity"))field("quantity").value="";if(field("historical-price"))field("historical-price").value="";if(field("historical-price-date"))field("historical-price-date").value="";if(priceBasis)priceBasis.value="per_part";if(packageCount)packageCount.value="";updatePriceControls();
  specs.replaceChildren();review.classList.remove("hide");
 }
 root.addEventListener("bom:new-part",()=>{
  clearPartEditor();
  feedback.textContent="";
  say("New part — enter the fields or extract specifications, then click Save part to add it to this BOM.");
  if(importPanel)importPanel.open=true;
 });

 const extract=field("extract"),description=field("description"),addSpec=field("add-spec"),save=field("save");
 if(!extract||!description||!addSpec||!save){say("Component editor is incomplete. Please refresh this page.");return}
 save.textContent="Save part";
 // Put status immediately beside the action and mirror errors above the workspace.
 if(importPanel){
  const cancel=document.createElement("button");cancel.type="button";cancel.className="btn component-cancel";cancel.textContent="Cancel / Collapse";
  cancel.onclick=()=>{importPanel.open=false;review.classList.add("hide");say("");feedback.textContent="";};
  importPanel.append(cancel);
 }
 const feedback=document.createElement("p");feedback.className="component-extraction-feedback";feedback.setAttribute("role","status");feedback.setAttribute("aria-live","assertive");
 extract.after(feedback);
 const extractStatus=message=>{
  // One status location. The old component status and feedback previously
  // repeated the same message in two separate panels.
  feedback.textContent=message;
  status.textContent="";status.hidden=true;status.style.display="none";
 };
 if(importPanel){
  const summary=importPanel.querySelector("summary");if(summary)summary.textContent="Part details";
 }
 // Product lookup is optional; the editable fields are always immediately available.
 review.classList.remove("hide");
 window.BSProductLookup.mountPart(root,{canSearch:canEditComponent});
 field("add-spec").onclick=()=>specRow();
 field("save").onclick=async()=>{
  const priceInput=field("historical-price")?.value.trim()||"";
  const dateInput=field("historical-price-date")?.value||"";
  if(priceInput&&priceBasis?.value==="per_package"&&(!Number.isSafeInteger(Number(packageCount?.value))||Number(packageCount?.value)<1)){
   say("Enter how many parts are in a package.");return;
  }
  const rawQuantity=field("quantity")?.value.trim()??"";
  const quantity=rawQuantity===""?null:Number(rawQuantity);
  if(quantity!==null&&(!Number.isFinite(quantity)||quantity<=0||quantity>10000000)){say("Quantity must be a positive number or left blank.");return}
  const c={assemblyId:assemblySelections[project]??null,quantity,quantityUnit:field("quantity-unit")?.value??"pcs",
   historicalPurchasePrice:priceInput===""?null:Number(priceInput),historicalPriceBasis:priceBasis?.value??"per_part",
   historicalPackageQuantity:priceBasis?.value==="per_package"?(packageCount?.value||null):null,
   historicalPriceDate:priceInput===""?null:(dateInput||new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10))};for(const name of ["name","manufacturer","model","category","supplier","asin"])c[name]=field(name).value.trim();c.fullName=field("full-name")?.value.trim()||c.name;
  c.specifications=[...specs.querySelectorAll(".component-spec-row")].map(row=>({name:row.children[0].value.trim(),value:row.children[1].value.trim(),source:row.children[2].value})).filter(s=>s.name&&s.value);
  if(!c.name){say("Component name is required.");return}
  field("save").disabled=true;try{const res=await fetch("/api/components?project="+project,{method:"POST",headers:{"content-type":"application/json"},credentials:"same-origin",body:JSON.stringify(c)}),data=await res.json();if(!res.ok)throw Error(data.error||"Save failed");review.classList.add("hide");field("description").value="";if(field("quantity"))field("quantity").value="";say("Part added to BOM.");feedback.textContent="";clearPartEditor();if(importPanel)importPanel.open=false;review.classList.add("hide");await refresh()}catch(e){say(e.message)}finally{field("save").disabled=false}
 };
 root.addEventListener("assemblychange",()=>{clearPartEditor();review.classList.add("hide");feedback.textContent="";if(importPanel)importPanel.open=false;refresh()});
 root.addEventListener("bom:refresh",()=>{refresh()});
 refresh();
 })
}
setupComponents();

// First edit replaces existing text instead of appending to a saved value.
// Subsequent clicks allow normal caret placement and partial corrections.
const overwriteSelector=".workspace-main-bom-editor input.field, .workspace-main-bom-editor textarea.field";
const overwriteFocus=new WeakMap();
document.addEventListener("focusin",event=>{
 const field=event.target;
 if(!field.matches?.(overwriteSelector)||field.readOnly||field.disabled)return;
 overwriteFocus.set(field,true);
 if(field.type!=="number"&&field.type!=="date"&&typeof field.select==="function")field.select();
});
document.addEventListener("click",event=>{
 const field=event.target;
 if(!field.matches?.(overwriteSelector)||!overwriteFocus.get(field))return;
 if(field.type==="number"||field.type==="date")return;
 if(typeof field.select==="function")field.select();
 overwriteFocus.set(field,false);
});
document.addEventListener("keydown",event=>{
 const field=event.target;
 if(!field.matches?.(overwriteSelector)||field.type!=="number"||!overwriteFocus.get(field))return;
 if(event.ctrlKey||event.metaKey||event.altKey)return;
 if(/^[0-9.+-]$/.test(event.key)){
  field.value="";
  overwriteFocus.set(field,false);
 }
});
document.addEventListener("focusout",event=>{
 if(event.target.matches?.(overwriteSelector))overwriteFocus.delete(event.target);
});


window.BSResources?.init();
navigate(location.hash.slice(1)||"home");
window.BSProjectManager?.init({setupAssemblyTrees,setupComponents,setupPhotos,navigate});
