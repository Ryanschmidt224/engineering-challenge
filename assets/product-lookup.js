/* Shared AI product search for Workshop and project part editors. */
window.BSProductLookup=(()=>{
 const el=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node};
 const costMessage=usage=>{
  if(!Number.isFinite(usage?.estimatedUsd))return "";
  const cost=new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:4}).format(usage.estimatedUsd);
  return "Estimated API cost "+cost+" · "+usage.searches+" web "+(usage.searches===1?"search":"searches");
 };
 // Reusable button/input/tooltip control for AI search and other site actions.
 const actionInput=({label,placeholder,maxLength,description})=>{
   const row=el("div","bs-action-input-row");
   const button=el("button","btn primary",label);button.type="button";
   const input=el("input","field bs-action-input");input.type="text";
   input.maxLength=maxLength;input.placeholder=placeholder;
   input.setAttribute("aria-label","Optional information for "+label);
   const help=el("span","bs-action-input-help");
   const helpButton=el("button","bs-action-input-help-button","?");
   helpButton.type="button";helpButton.setAttribute("aria-label",description);
   helpButton.title=description;helpButton.setAttribute("aria-expanded","false");
   const tip=el("span","bs-action-input-tooltip",description);
   tip.setAttribute("role","tooltip");
   const toggle=()=>{const open=help.classList.toggle("is-open");helpButton.setAttribute("aria-expanded",String(open))};
   helpButton.onclick=toggle;
   helpButton.addEventListener("blur",()=>{help.classList.remove("is-open");helpButton.setAttribute("aria-expanded","false")});
   help.append(helpButton,tip);row.append(button,input,help);
   return {row,button,input,helpButton};
  };
 function create({identity=false,getQuery,onStart,onResult,canSearch=()=>true}={}){
  const element=el("section","product-ai-search");
  const inputs={};
  const field=(key,label,max,placeholder)=>{
   const wrapper=el("label","product-ai-field"),input=el("input","field");
   input.type="text";input.maxLength=max;input.placeholder=placeholder||"";
   wrapper.append(el("span","",label),input);element.append(wrapper);inputs[key]=input;return input;
  };
  if(identity){
   field("partNumber","Manufacturer part number",160);
   field("featureTreeDescription","Feature tree description",20);
  }
  const control=actionInput({
   label:"Find with AI",
   placeholder:"Manufacturer, supplier, product link, or datasheet link (optional)",
   maxLength:500,
   description:"Optional: provide a manufacturer, supplier, product link, or datasheet link to help AI find the item. Either a manufacturer part number or a feature tree description can be used on its own."
  });
  const {row,button}=control;
  const hint=control.input;inputs.searchHint=hint;
  const message=el("p","product-ai-status");message.setAttribute("role","status");
  const cost=el("p","product-ai-cost muted");cost.hidden=true;
  const results=el("div","product-ai-results");
  element.append(row,message,cost,results);
  let generation=0;
  const query=()=>{
   const values=getQuery?.()||Object.fromEntries(Object.entries(inputs).map(([key,input])=>[key,input.value.trim()]));
   return {...values,searchHint:hint.value.trim()};
  };
  const reset=()=>{
   generation++;button.disabled=false;button.textContent="Find with AI";message.textContent="";
   cost.hidden=true;results.replaceChildren();
  };
  const setIdentity=values=>{
   reset();
   for(const [key,input] of Object.entries(inputs))input.value=values?.[key]||"";
  };
  for(const input of Object.values(inputs))input.addEventListener("keydown",event=>{
   if(event.key==="Enter"&&!event.isComposing){event.preventDefault();button.click()}
  });
  button.onclick=async()=>{
   if(!canSearch()){message.textContent="Sign in to an account with permission to edit this item.";return}
   const submitted=query();
   if(!submitted.partNumber&&!submitted.supplierPartNumber&&!submitted.featureTreeDescription){
    message.textContent="Enter a part number or feature tree description.";
    inputs.partNumber?.focus();return;
   }
   const stamp=++generation;
   button.disabled=true;button.textContent="Searching…";results.replaceChildren();cost.hidden=true;
   message.textContent="Looking up "+[submitted.partNumber,submitted.supplierPartNumber,submitted.featureTreeDescription].filter(Boolean).join(" · ")+"…";
   onStart?.();
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);
   try{
    const response=await fetch("/api/workshop-lookup",{method:"POST",credentials:"same-origin",cache:"no-store",
     headers:{"content-type":"application/json"},body:JSON.stringify(submitted),signal:controller.signal});
    const data=await response.json().catch(()=>({}));
    if(stamp!==generation)return;
    cost.textContent=costMessage(data.lookupUsage);cost.hidden=!cost.textContent;
    if(!response.ok){
     if(/^https:\/\//i.test(data.supplierPage||"")){
      const link=el("a","","Open supplier listing");link.href=data.supplierPage;link.target="_blank";link.rel="noopener noreferrer";results.append(link);
     }
     throw Error(data.error||"Lookup returned HTTP "+response.status);
    }
    if(JSON.stringify(query())!==JSON.stringify(submitted)){message.textContent="Search fields changed. Run the lookup again.";return}
    message.textContent="AI suggestions ready for review.";
    await onResult?.(data);
   }catch(error){
    if(stamp===generation)message.textContent=error.name==="AbortError"?"Lookup timed out. Try again.":error.message||"Lookup failed.";
   }finally{
    clearTimeout(timer);
    if(stamp===generation){button.disabled=false;button.textContent="Find with AI"}
   }
  };
  return {element,inputs,hint,button,message,cost,results,setIdentity,reset};
 }
 function mountPart(root,{canSearch=()=>true,getPartName=()=>""}={}){
  if(root.bsProductLookup)return root.bsProductLookup;
  const field=name=>root.querySelector(".component-"+name);
  const panel=el("section","component-lookup-panel product-ai-inline");
  const button=el("button","btn product-ai-find","Find part specs with AI");button.type="button";
  button.title="Search using the Part name, Manufacturer, and Mfg part number above.";
  const message=el("p","product-ai-status");message.setAttribute("role","status");
  const cost=el("p","product-ai-cost muted");cost.hidden=true;
  const results=el("div","product-ai-results");
  panel.append(button,message,cost,results);
  const old=root.querySelector(".component-lookup-panel");
  const legacy=field("description")?.closest("label"),extract=field("extract");
  if(old)old.replaceWith(panel);else if(legacy)legacy.before(panel);else root.prepend(panel);
  if(legacy){legacy.hidden=true;panel.append(legacy)}
  if(extract){extract.hidden=true;panel.append(extract)}
  let generation=0,controller=null;
  const identity=()=>({partName:String(getPartName()||"").trim(),
   manufacturer:field("manufacturer")?.value.trim()||"",
   partNumber:field("model")?.value.trim()||""});
  const reset=()=>{
   ++generation;controller?.abort();controller=null;
   button.disabled=false;button.textContent="Find part specs with AI";
   message.textContent="";cost.hidden=true;results.replaceChildren();
  };
  const addSource=url=>{
   try{if(new URL(url).protocol!=="https:")return}catch{return}
   const link=el("a","product-ai-source",url);link.href=url;
   link.target="_blank";link.rel="noopener noreferrer";results.append(link);
  };
  button.onclick=async()=>{
   if(!canSearch()){message.textContent="Sign in to edit this part before searching.";return}
   const query=identity();
   if(!query.partName&&!query.partNumber){
    message.textContent="Enter a Part name or Mfg part number first.";return
   }
   const stamp=++generation;
   controller?.abort();controller=new AbortController();
   const activeController=controller;
   button.disabled=true;button.textContent="Searching…";
   results.replaceChildren();cost.hidden=true;
   message.textContent="Searching for "+[query.partName,query.manufacturer,query.partNumber].filter(Boolean).join(" · ")+"…";
   const timer=setTimeout(()=>activeController.abort(),60000);
   try{
    const response=await fetch("/api/workshop-lookup",{method:"POST",
     credentials:"same-origin",cache:"no-store",headers:{"content-type":"application/json"},
     body:JSON.stringify(query),signal:activeController.signal});
    const data=await response.json().catch(()=>({}));
    if(stamp!==generation)return;
    cost.textContent=costMessage(data.lookupUsage);cost.hidden=!cost.textContent;
    if(!response.ok)throw Error(data.error||"AI lookup failed");
    if(JSON.stringify(identity())!==JSON.stringify(query)){
     message.textContent="Part identity changed. Search again before applying specifications.";return
    }
    const draft=data.draft||{};
    const rows=(data.research?.specs||[]).map(item=>({
     name:String(item.name||"").trim(),
     value:[item.value,item.unit,item.conditions&&"("+item.conditions+")"].filter(Boolean).join(" ").trim()
    })).filter(item=>item.name&&item.value);
    for(const [name,value] of [["Documentation URL",draft.documentationUrl],["Specifications",draft.spec]]){
     if(value&&!rows.some(row=>row.name.toLowerCase()===name.toLowerCase()))rows.push({name,value});
    }
    const heading=el("h3","product-ai-review-title","Review suggested specifications");
    const match=el("p","muted product-ai-review-match",
     "Found: "+[draft.name,draft.manufacturer,draft.partNumber].filter(Boolean).join(" · "));
    results.append(heading,match);
    const mismatch=Boolean(query.partNumber&&draft.partNumber&&
     query.partNumber.toLowerCase()!==draft.partNumber.toLowerCase()||
     query.manufacturer&&draft.manufacturer&&
     query.manufacturer.toLowerCase()!==draft.manufacturer.toLowerCase());
    message.textContent=mismatch
     ?"The returned part identity differs from your search. Verify sources before applying."
     :"Review the specifications below. Nothing has been changed yet.";
    const items=el("div","product-ai-review-list"),selected=[];
    for(const spec of rows.slice(0,35)){
     const label=el("label","product-ai-review-option");
     const check=el("input");check.type="checkbox";check.checked=!mismatch;
     const detail=el("span");detail.append(el("strong","",spec.name),document.createTextNode(" — "+spec.value));
     label.append(check,detail);items.append(label);selected.push({check,spec});
    }
    results.append(items);
    if(rows.length){
     const apply=el("button","btn primary product-ai-apply","Apply selected specs");
     apply.type="button";apply.onclick=()=>{
      if(JSON.stringify(identity())!==JSON.stringify(query)){
       message.textContent="Part identity changed. Search again before applying.";return
      }
      const specs=field("specs");
      if(!specs){message.textContent="Specification fields unavailable.";return}
      const existing=new Set([...specs.querySelectorAll(".component-spec-row")]
       .map(row=>String(row.children[0]?.value||"").trim().toLowerCase()).filter(Boolean));
      let added=0;
      for(const {check,spec} of selected){
       if(!check.checked||existing.has(spec.name.toLowerCase()))continue;
       const row=el("div","row component-spec-row");
       const key=el("input","field"),value=el("input","field");
       const source=el("select","field component-spec-source"),remove=el("button","btn","Remove");
       key.value=spec.name;key.placeholder="Specification";
       value.value=spec.value;value.placeholder="Value";
       const explicit=el("option","","From product listing");explicit.value="explicit";source.append(explicit);
       const inferred=el("option","","Estimated / inferred");inferred.value="inferred";source.append(inferred);
       remove.type="button";remove.onclick=()=>row.remove();
       row.append(key,value,source,remove);specs.append(row);
       existing.add(spec.name.toLowerCase());added++;
      }
      if(added)specs.closest(".part-editor-specs-disclosure")?.setAttribute("open","");
      message.textContent=added+" specification"+(added===1?"":"s")+" added to the editor. Review and Save the part.";
     };
     results.append(apply);
    }else results.append(el("p","muted","No verifiable specifications returned."));
    if(data.missingSpecs?.length)results.append(el("p","muted","Could not verify: "+data.missingSpecs.join(", ")));
    for(const url of data.sources||[])addSource(url);
   }catch(error){
    if(stamp===generation)message.textContent=error.name==="AbortError"?"Lookup timed out. Try again.":error.message||"Lookup failed.";
   }finally{
    clearTimeout(timer);
    if(stamp===generation){button.disabled=false;button.textContent="Find part specs with AI"}
   }
  };
  root.bsProductLookup={element:panel,button,message,cost,results,setIdentity:reset,reset};
  return root.bsProductLookup;
 }
 return {create,mountPart,costMessage,actionInput};
})();
