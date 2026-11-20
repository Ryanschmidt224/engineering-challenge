/* Shared AI product search for Workshop and project part editors. */
window.BSProductLookup=(()=>{
 const el=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node};
 const costMessage=usage=>{
  if(!Number.isFinite(usage?.estimatedUsd))return "";
  const cost=new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:4}).format(usage.estimatedUsd);
  return "Estimated API cost "+cost+" · "+usage.searches+" web "+(usage.searches===1?"search":"searches");
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
  const hint=field("searchHint","Help AI find the item (optional)",500,"Manufacturer, supplier, product link, or datasheet link");
  const row=el("div","product-ai-actions"),button=el("button","btn primary","Find with AI");
  button.type="button";
  row.append(button,el("span","muted","Either part number or description can be used on its own."));
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
 function mountPart(root,{canSearch=()=>true}={}){
  if(root.bsProductLookup)return root.bsProductLookup;
  const field=name=>root.querySelector(".component-"+name);
  const panel=el("details","component-lookup-panel product-ai-disclosure");
  const summary=el("summary","product-ai-disclosure-heading","Find specs with AI");
  panel.append(summary);
  const old=root.querySelector(".component-lookup-panel");
  const legacy=field("description")?.closest("label");
  const extract=field("extract");
  if(old)old.replaceWith(panel);else if(legacy)legacy.before(panel);else root.prepend(panel);
  if(legacy){legacy.hidden=true;panel.append(legacy)}
  if(extract){extract.hidden=true;panel.append(extract)}
  const lookup=create({identity:true,canSearch,
   getQuery:()=>({
    partNumber:lookup.inputs.partNumber.value.trim(),
    featureTreeDescription:lookup.inputs.featureTreeDescription.value.trim(),
    supplier:field("supplier")?.value.trim()||""
   }),
   onResult:data=>{
   const draft=data.draft||{};
   const values={name:draft.name,"full-name":draft.name,manufacturer:draft.manufacturer,model:draft.partNumber||"",category:draft.category,supplier:draft.supplier};
   for(const [key,value] of Object.entries(values))if(value&&field(key))field(key).value=value;
   const treeDescription=root.querySelector(".part-project-featureTreeName");
   if(treeDescription&&draft.featureTreeDescription)treeDescription.value=draft.featureTreeDescription;
   const description=root.querySelector(".part-description-input");
   if(description&&draft.subtitle)description.value=draft.subtitle;
   const specs=field("specs");
   if(specs){
    specs.replaceChildren();
    const entries=(data.research?.specs||[]).map(spec=>({name:spec.name,value:[spec.value,spec.unit,spec.conditions&&"("+spec.conditions+")"].filter(Boolean).join(" ")}));
    for(const [name,value] of [["Supplier part number",draft.supplierPartNumber],["Supplier URL",draft.supplierUrl],["Documentation URL",draft.documentationUrl],["Specifications",draft.spec],["Notes",draft.notes]])if(value)entries.push({name,value});
    for(const spec of entries.slice(0,35)){
     const row=el("div","row component-spec-row"),name=el("input","field"),value=el("input","field"),source=el("select","field component-spec-source"),remove=el("button","btn","Remove");
     name.placeholder="Specification";name.value=spec.name;value.placeholder="Value";value.value=spec.value;
     const option=el("option","","From product listing");option.value="explicit";source.append(option);
     remove.type="button";remove.onclick=()=>row.remove();row.append(name,value,source,remove);specs.append(row);
    }
   }
   if(data.moveSupplierNumber)lookup.inputs.partNumber.value="";
   root.querySelector(".component-review")?.classList.remove("hide");
   lookup.message.textContent="Suggestions loaded into the part fields. Review them, then Save.";
   if(data.missingSpecs?.length)lookup.results.append(el("p","muted","Could not verify: "+data.missingSpecs.join(", ")+"."));
   for(const url of data.sources||[]){
    try{if(new URL(url).protocol!=="https:")continue}catch{continue}
    const link=el("a","product-ai-source",url);link.href=url;link.target="_blank";link.rel="noopener noreferrer";lookup.results.append(link);
   }
  }});
  panel.append(lookup.element);
  root.bsProductLookup=lookup;
  return lookup;
 }
 return {create,mountPart,costMessage};
})();
