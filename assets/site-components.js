/* Part editor and component API controller.
 * Loaded before site.js; initialized by the site.js entry point.
 * See docs/CODEBASE_GUIDE.md.
 */
function setupComponents(){
 document.querySelectorAll("[data-components]").forEach(root=>{
 const project=root.dataset.components,list=root.querySelector(".component-list"),status=root.querySelector(".component-status"),review=root.querySelector(".component-review"),specs=root.querySelector(".component-specs");

 // The old markup nested the part list inside a collapsible <details>.
 // Keep the saved parts in a permanent visible region, independent of the editor.
 if(["launcher","linear","robot"].includes(project)){
  root.prepend(list);
  list.classList.add("bom-visible-parts");
 }
 const field=name=>root.querySelector(".component-"+name);
 const say=message=>{status.textContent=message;status.hidden=false;status.style.display="block";status.setAttribute("aria-live","polite");};
 function specRow(name="",value="",source="explicit"){
  const row=document.createElement("div");row.className="row component-spec-row";
  const a=document.createElement("input"),b=document.createElement("input"),c=document.createElement("select"),del=document.createElement("button");
  a.className=b.className="field";a.placeholder="Specification";b.placeholder="Value";a.value=name;b.value=value;
  for(const opt of ["explicit","inferred"]){const el=document.createElement("option");el.value=opt;el.textContent=opt==="explicit"?"Stated in listing":"Inferred";c.append(el)}c.value=source;
  del.className="btn";del.type="button";del.textContent="Remove";del.onclick=()=>row.remove();row.append(a,b,c,del);specs.append(row)
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
     for(const [fieldName,value] of [["Historical price",c.historicalPrice!==null&&c.historicalPrice!==undefined?"$"+Number(c.historicalPrice).toFixed(2)+" USD per unit"+(c.historicalPriceDate?" (recorded "+c.historicalPriceDate+")":""):null],["Manufacturer",c.manufacturer],["Model",c.model],["Supplier",c.supplier],["ASIN",c.asin],["Category",c.category]]){
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
     if(adminAuthenticated){
      const del=document.createElement("button");del.type="button";del.className="btn";del.textContent="Delete part";
      del.onclick=async()=>{
       if(!confirm("Delete "+c.name+" from "+group.name+"?"))return;
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
  for(const name of ["name","manufacturer","model","category","supplier","asin"]){const control=field(name);if(control)control.value=""}
  field("description").value="";if(field("quantity"))field("quantity").value="";if(field("historical-price"))field("historical-price").value="";if(field("historical-price-date"))field("historical-price-date").value="";
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
  say(message);feedback.textContent=message;
  const workspaceStatus=root.closest(".assembly-workspace-page")?.querySelector(".workspace-status");
  if(workspaceStatus)workspaceStatus.textContent=message;
 };
 if(importPanel){
  const manual=document.createElement("button");manual.type="button";manual.className="btn component-manual";manual.textContent="Enter manually";
  manual.onclick=()=>{review.classList.remove("hide");extractStatus("Enter the part details below, then save.")};
  feedback.after(manual);
  const summary=importPanel.querySelector("summary");if(summary)summary.textContent="Add part to BOM";
 }
 extract.hidden=false;extract.type="button";
 extract.onclick=async event=>{
  event.preventDefault();
  extractStatus("Extract clicked — checking input…");
  const value=description.value.trim();
  if(!value){extractStatus("Paste a product description or public HTTPS product URL first.");return}
  if(!adminAuthenticated){extractStatus("Sign in using Admin login, then try extracting.");return}
  extract.disabled=true;
  extractStatus("Requesting product specifications…");
  try{
   const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
   let response;
   try{response=await fetch("/api/components/extract",{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({description:value}),signal:controller.signal})}finally{clearTimeout(timeout)}
   const raw=await response.text();let data;
   try{data=JSON.parse(raw)}catch{throw Error("The server returned non-JSON data (HTTP "+response.status+"): "+raw.slice(0,120))}
   if(!response.ok)throw Error((data.error||"Extraction request failed")+" (HTTP "+response.status+")");
   const component=data.component;
   if(!component||typeof component!=="object")throw Error("The service returned no product information.");
   for(const name of ["name","manufacturer","model","category","supplier","asin"]){const el=field(name);if(el)el.value=component[name]||""}
   specs.replaceChildren();for(const spec of component.specifications||[])specRow(spec.name,spec.value,spec.source);
   review.classList.remove("hide");extractStatus("Specifications extracted. Review them, then select Save component.");
  }catch(e){review.classList.remove("hide");extractStatus("Extraction failed: "+(e.name==="AbortError"?"The service did not respond within 20 seconds":e.message)+". You can enter this part manually.")}
  finally{extract.disabled=false}
 };
 field("add-spec").onclick=()=>specRow();
 field("save").onclick=async()=>{
  const priceInput=field("historical-price")?.value.trim()||"";
  const dateInput=field("historical-price-date")?.value||"";
  const rawQuantity=field("quantity")?.value.trim()??"";
  const quantity=rawQuantity===""?null:Number(rawQuantity);
  if(quantity!==null&&(!Number.isFinite(quantity)||quantity<=0||quantity>10000000)){say("Quantity must be a positive number or left blank.");return}
  const c={assemblyId:assemblySelections[project]??null,quantity,quantityUnit:field("quantity-unit")?.value??"pcs",
   historicalPrice:priceInput===""?null:Number(priceInput),historicalPriceDate:priceInput===""?null:(dateInput||new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10))};for(const name of ["name","manufacturer","model","category","supplier","asin"])c[name]=field(name).value.trim();
  c.specifications=[...specs.querySelectorAll(".component-spec-row")].map(row=>({name:row.children[0].value.trim(),value:row.children[1].value.trim(),source:row.children[2].value})).filter(s=>s.name&&s.value);
  if(!c.name){say("Component name is required.");return}
  field("save").disabled=true;try{const res=await fetch("/api/components?project="+project,{method:"POST",headers:{"content-type":"application/json"},credentials:"same-origin",body:JSON.stringify(c)}),data=await res.json();if(!res.ok)throw Error(data.error||"Save failed");review.classList.add("hide");field("description").value="";if(field("quantity"))field("quantity").value="";say("Part added to BOM.");feedback.textContent="";clearPartEditor();if(importPanel)importPanel.open=false;review.classList.add("hide");await refresh()}catch(e){say(e.message)}finally{field("save").disabled=false}
 };
 root.addEventListener("assemblychange",()=>{clearPartEditor();review.classList.add("hide");feedback.textContent="";if(importPanel)importPanel.open=false;refresh()});
 root.addEventListener("bom:refresh",()=>{refresh()});
 refresh();
 })
}
