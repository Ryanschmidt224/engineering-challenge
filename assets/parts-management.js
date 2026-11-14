/* Project-wide parts management: editable but intentionally limited to
 * name, part type and status. Numbering remains permanent/read-only.
 */
(function(){
 "use strict";
 const el=(tag,cls,content)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(content!==undefined)n.textContent=content;return n};
 const statusValues=[["not_started","Not started"],["in_progress","In progress"],["complete","Complete"]];
 const typeValues=[["purchased","Purchased"],["custom","Custom"],["code","Code"]];
 const dropdown=(options,current,disabled=false)=>{
  const select=el("select","field");select.disabled=disabled;
  for(const [value,label] of options){const option=el("option","",label);option.value=value;select.append(option)}
  select.value=current;return select;
 };
 function mount(target,{project,canEdit,onChanged,onOpenPart,onBack}){
  target.classList.add("bs-parts-page");
  const header=el("header","bs-parts-header"),heading=el("div"),back=el("button","btn","← Project"),title=el("h1","","Parts Management");
  back.type="button";back.onclick=()=>onBack?.();heading.append(back,title);header.append(heading);
  const controls=el("div","bs-parts-controls"),search=el("input","field"),filter=dropdown([["all","All statuses"],...statusValues],"all"),typeFilter=dropdown([["all","All types"],...typeValues],"all");
  search.type="search";search.placeholder="Search part number or name";search.setAttribute("aria-label","Search parts");
  controls.append(search,typeFilter,filter);
  const guide=el("p","muted","Edit a name or choose a type or status. Changes save individually; part numbers remain locked.");
  const feedback=el("p","bs-parts-feedback");feedback.setAttribute("role","status");feedback.setAttribute("aria-live","polite");
  const scroll=el("div","bs-parts-scroll"),table=el("table","bs-parts-table");
  const thead=el("thead"),headingRow=el("tr");
  const columns=[["number","Part number"],["name","Part name"],["partType","Part type"],["progressStatus","Status"],["open",""]];
  let order="number",direction=1,parts=[],fetchId=0;
  const sortButtons={};
  for(const [key,label] of columns){
   const th=el("th");
   if(key!=="open"){
    const b=el("button","bs-parts-sort",label);b.type="button";b.onclick=()=>{direction=order===key?-direction:1;order=key;render()};th.append(b);sortButtons[key]=b;
   }
   headingRow.append(th);
  }
  thead.append(headingRow);
  const tbody=el("tbody");table.append(thead,tbody);scroll.append(table);target.append(header,controls,guide,scroll,feedback);
  function partLabel(part){return (part.name||"").toLowerCase()}
  function sortKey(part){
   if(order==="number")return String(part.partNumber||"").toLowerCase();
   if(order==="name")return partLabel(part);
   if(order==="partType")return part.partType||"";
   return part.progressStatus||"not_started";
  }
  function render(){
   for(const [key,button] of Object.entries(sortButtons))button.textContent=(columns.find(x=>x[0]===key)?.[1]||key)+(order===key?(direction===1?" ↑":" ↓"):"");
   tbody.replaceChildren();
   const query=search.value.trim().toLowerCase();
   // Search by part number or headline name without overriding the filters.
   const entries=parts.filter(p=>(filter.value==="all"||p.progressStatus===filter.value)&&(typeFilter.value==="all"||p.partType===typeFilter.value)&&((p.name||"").toLowerCase().includes(query)||(p.partNumber||"").toLowerCase().includes(query)));
   entries.sort((a,b)=>{
    if(order==="number"){
     const an=a.partNumber||"",bn=b.partNumber||"";
     const ai=/^\d+$/.test(an)?Number(an):Infinity,bi=/^\d+$/.test(bn)?Number(bn):Infinity;
     if(ai!==bi)return (ai-bi)*direction;
    }
    return sortKey(a).localeCompare(sortKey(b),undefined,{numeric:true,sensitivity:"base"})*direction;
   });
   for(const part of entries){
    const tr=el("tr"),readOnly=!canEdit()||!!part.generatedFrom;
    const number=el("td","bs-parts-number",part.partNumber||"—");tr.append(number);
    const nameCell=el("td"),input=el("input","field",undefined);
    input.value=part.name||"";input.maxLength=180;input.disabled=readOnly;input.setAttribute("aria-label","Name for "+(part.partNumber||part.name));
    const initial=part.name;
    input.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();input.blur()}else if(e.key==="Escape"){input.value=initial;input.blur()}});
    input.addEventListener("blur",()=>{if(input.value.trim()!==part.name)void change(part,"name",input.value.trim(),input);else input.value=part.name});
    nameCell.append(input);tr.append(nameCell);
    const typeCell=el("td"),type=dropdown(typeValues,part.partType||"purchased",readOnly);
    type.setAttribute("aria-label","Part type for "+part.name);
    type.onchange=()=>void change(part,"partType",type.value,type);typeCell.append(type);tr.append(typeCell);
    const stateCell=el("td"),state=dropdown(statusValues,part.progressStatus||"not_started",readOnly);
    state.setAttribute("aria-label","Status for "+part.name);
    state.onchange=()=>void change(part,"progressStatus",state.value,state);stateCell.append(state);tr.append(stateCell);
    const openCell=el("td"),open=el("button","btn","Open");open.type="button";open.onclick=()=>onOpenPart?.(part.id);
    openCell.append(open);tr.append(openCell);tbody.append(tr);
   }
   feedback.textContent=entries.length+" of "+parts.length+" parts shown. Generated consumables are managed through their source part.";
  }
  async function change(part,key,value,control){
   if(!canEdit())return;
   if(key==="name"&&!value){feedback.textContent="Part name cannot be blank.";control.value=part.name;return}
   control.disabled=true;
   const previous=part[key];
   try{
    const res=await fetch("/api/components?project="+encodeURIComponent(project)+"&id="+encodeURIComponent(part.id),{
     method:"PATCH",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({[key]:value})
    });
    const data=await res.json();if(!res.ok)throw Error(data.error||"Update failed");
    Object.assign(part,data.component);onChanged?.(data.component);
    render();feedback.textContent="Saved "+part.name+".";
   }catch(error){
    control.value=previous;feedback.textContent="Not saved: "+error.message;
    if(/another tab|Reload/.test(error.message))void refresh();
   }finally{control.disabled=!canEdit()}
  }
  async function refresh(){
   const id=++fetchId;feedback.textContent="Loading parts…";
   try{
    const res=await fetch("/api/components?project="+encodeURIComponent(project),{credentials:"same-origin",cache:"no-store"}),data=await res.json();
    if(!res.ok)throw Error(data.error||"Unable to load parts");
    if(id!==fetchId)return;
    parts=(data.components||[]).filter(p=>!p.generatedFrom);render();
   }catch(error){if(id===fetchId)feedback.textContent=error.message}
  }
  search.oninput=filter.onchange=typeFilter.onchange=render;
  return {refresh};
 }
 window.BSPartsManager=Object.freeze({mount});
})();
