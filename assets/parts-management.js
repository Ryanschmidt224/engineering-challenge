/* Project-wide parts management: editable but intentionally limited to
 * name, part type and status. Numbering remains permanent/read-only.
 */
(function(){
 "use strict";
 const el=(tag,cls,content)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(content!==undefined)n.textContent=content;return n};
 const fields=window.BSPartFields;
 const statusValues=fields.progressStatuses;
 const purchaseValues=fields.purchaseStatuses;
 const statusFor=fields.statusValue;
 const partTypeFor=fields.partTypeFor;
 const numberFor=p=>p.partNumber||(/^([A-Za-z]{1,8}[- ]?\d{2,8})\s*[-–:]\s*\S/.exec(p.name||"")?.[1]||"");
 const typeValues=[["purchased","Off-the-shelf"],["custom","Custom"],["code","Code"]];
 // Keep separate saved records intact. Group repeated names in the interface,
 // with an explicit way to inspect and edit every original record.
 const groupKey=part=>[part.name,partTypeFor(part),part.manufacturer,part.model].map(value=>String(value||"").trim().toLocaleLowerCase().replace(/\s+/g," ")).join("|");
 const groupParts=parts=>{
  const groups=new Map();
  for(const part of parts){
   const key=groupKey(part);
   if(!groups.has(key))groups.set(key,{key,parts:[]});
   groups.get(key).parts.push(part);
  }
  return [...groups.values()];
 };
 const dropdown=(options,current,disabled=false)=>{
  const select=el("select","field");select.disabled=disabled;
  for(const [value,label] of options){const option=el("option","",label);option.value=value;select.append(option)}
  select.value=current;return select;
 };
 function mount(target,{project,canEdit,onChanged,onOpenPart,onBack}){
  target.classList.add("bs-parts-page");
  const header=el("header","bs-parts-header"),heading=el("div"),back=el("button","btn","← Project"),title=el("h1","","Parts Management");
  back.type="button";back.onclick=()=>onBack?.();heading.append(back,title);header.append(heading);
  const controls=el("div","bs-parts-controls"),search=el("input","field"),filter=dropdown([["all","All statuses"],...statusValues,...purchaseValues.filter(x=>x[0]!=="not_started")],"all"),typeFilter=dropdown([["all","All types"],...typeValues],"all");
  search.type="search";search.placeholder="Search part number or name";search.setAttribute("aria-label","Search parts");
  controls.append(search,typeFilter,filter);
  const guide=el("p","muted","Edit a name, type, status or attention note. Drag column dividers to resize. Numbers marked * appear in the name but are not formally assigned.");
  const lookupForm=el("form","bs-number-lookup"),lookupInput=el("input","field"),lookupButton=el("button","btn","Find number"),lookupResult=el("p","bs-number-result");
  lookupInput.placeholder="Find assigned or reserved number (e.g. NR116)";lookupInput.setAttribute("aria-label","Look up part number");lookupButton.type="submit";lookupResult.setAttribute("role","status");
  lookupForm.append(lookupInput,lookupButton);lookupForm.addEventListener("submit",async e=>{e.preventDefault();const number=lookupInput.value.trim().toUpperCase();if(!number)return;lookupButton.disabled=true;lookupResult.textContent="Checking "+number+"…";try{const res=await fetch("/api/numbering?project="+encodeURIComponent(project)+"&lookup="+encodeURIComponent(number),{credentials:"same-origin",cache:"no-store"}),data=await res.json();if(!res.ok)throw Error(data.error||"Lookup failed");lookupResult.textContent=!data.reserved?number+" is available.":data.active?number+" belongs to active "+data.record.kind+" “"+data.record.name+"”.":number+" was issued previously and is still reserved; the original record may have been deleted. Numbers are not reused.";if(data.active&&data.record.kind==="part"){search.value=data.record.name;render()} }catch(error){lookupResult.textContent=error.message}finally{lookupButton.disabled=false}});
  const feedback=el("p","bs-parts-feedback");feedback.setAttribute("role","status");feedback.setAttribute("aria-live","polite");
  const scroll=el("div","bs-parts-scroll"),table=el("table","bs-parts-table");
  const thead=el("thead"),headingRow=el("tr"),colgroup=el("colgroup");
  // Compact defaults: part number is intentionally narrow, note stays beside its flag.
  const widths=[112,330,150,160,380];
  let nameWidthManuallyResized=false;
  // Size the name column to its visible contents, not to the longest saved string.
  // Longer names remain intact and editable; the input simply scrolls horizontally.
  const fitNameWidth=entries=>{
   if(nameWidthManuallyResized)return;
   const names=entries.map(part=>String(part.name||"").slice(0,40));
   const sample=names.reduce((longest,name)=>name.length>longest.length?name:longest,"Part name");
   const context=document.createElement("canvas").getContext("2d");
   let width;
   if(context){
    const input=tbody.querySelector("td:nth-child(2) input.field");
    context.font=input?getComputedStyle(input).font:"14px sans-serif";
    const zero=context.measureText("0").width||8;
    const maxWidth=zero*40;
    width=Math.max(zero*13,Math.min(maxWidth,Math.max(...names.map(name=>context.measureText(name).width),context.measureText(sample).width)))+38;
   }else width=Math.min(40,Math.max(13,sample.length))*8+38;
   widths[1]=Math.ceil(width);
   layoutColumns();
  };
  widths.forEach(w=>{const col=el("col");col.style.width=w+"px";colgroup.append(col)});
  // Fill the available page width with the final column; retain compact, independently resizable columns to its left.
  const layoutColumns=()=>{
   const prefix=widths.slice(0,-1).reduce((total,w)=>total+w,0);
   const last=Math.max(widths[widths.length-1],scroll.clientWidth-prefix);
   widths.forEach((w,i)=>{colgroup.children[i].style.width=(i===widths.length-1?last:w)+"px"});
   table.style.width=(prefix+last)+"px";
  };
  table.append(colgroup);
  if(typeof ResizeObserver!=="undefined"){const observer=new ResizeObserver(layoutColumns);observer.observe(scroll)}
  else window.addEventListener("resize",layoutColumns);
  const columns=[["number","Part number"],["name","Part name"],["partType","Part type"],["status","Status"],["needsAttention","Needs attention"]];
  let order="number",direction=1,parts=[],fetchId=0;
  const expandedGroups=new Set();
  const sortButtons={};
  for(const [key,label] of columns){
   const th=el("th");
   if(key!=="open"){
    const b=el("button","bs-parts-sort",label);b.type="button";b.onclick=()=>{direction=order===key?-direction:1;order=key;render()};th.append(b);sortButtons[key]=b;
   }
   if(key!=="open"){
    const handle=el("span","bs-parts-resize");handle.textContent="⋮⋮";handle.title="Drag to resize "+label+" column";handle.setAttribute("role","separator");handle.setAttribute("aria-label","Resize "+label);handle.setAttribute("aria-orientation","vertical");handle.tabIndex=0;
    const index=columns.findIndex(c=>c[0]===key);
    const size=w=>{if(index===1)nameWidthManuallyResized=true;widths[index]=Math.max(index===0?102:index===1?140:index===4?240:85,Math.round(w));layoutColumns()};
    handle.addEventListener("pointerdown",e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();const x=e.clientX,w=widths[index];handle.setPointerCapture(e.pointerId);handle.classList.add("is-resizing");const move=ev=>size(w+ev.clientX-x);const stop=()=>{handle.classList.remove("is-resizing");handle.removeEventListener("pointermove",move);handle.removeEventListener("pointerup",stop);handle.removeEventListener("pointercancel",stop)};handle.addEventListener("pointermove",move);handle.addEventListener("pointerup",stop);handle.addEventListener("pointercancel",stop)});
    handle.addEventListener("keydown",e=>{if(e.key==="ArrowLeft"||e.key==="ArrowRight"){e.preventDefault();size(widths[index]+(e.key==="ArrowLeft"?-15:15))}});
    th.append(handle);
   }
   headingRow.append(th);
  }
  thead.append(headingRow);
  const tbody=el("tbody");table.append(thead,tbody);scroll.append(table);target.append(header,controls,guide,lookupForm,lookupResult,scroll,feedback);layoutColumns();
  function partLabel(part){return (part.name||"").toLowerCase()}
  function sortKey(part){
   if(order==="number")return numberFor(part).toLowerCase();
   if(order==="name")return partLabel(part);
   if(order==="partType")return partTypeFor(part);
   if(order==="needsAttention")return part.needsAttention?"1":"0";
   return statusFor(part);
  }
  function render(){
   for(const [key,button] of Object.entries(sortButtons))button.textContent=(columns.find(x=>x[0]===key)?.[1]||key)+(order===key?(direction===1?" ↑":" ↓"):"");
   tbody.replaceChildren();
   const query=search.value.trim().toLowerCase();
   // Search by part number or headline name without overriding the filters.
   const entries=parts.filter(p=>(filter.value==="all"||statusFor(p)===filter.value)&&(typeFilter.value==="all"||partTypeFor(p)===typeFilter.value)&&((p.name||"").toLowerCase().includes(query)||numberFor(p).toLowerCase().includes(query)));
   entries.sort((a,b)=>{
    if(order==="number"){
     const an=numberFor(a),bn=numberFor(b);
     const ai=/\d+$/.test(an)?Number(an.match(/\d+$/)[0]):Infinity,bi=/\d+$/.test(bn)?Number(bn.match(/\d+$/)[0]):Infinity;
     if(ai!==bi)return (ai-bi)*direction;
    }
    return sortKey(a).localeCompare(sortKey(b),undefined,{numeric:true,sensitivity:"base"})*direction;
   });
   fitNameWidth(entries);
   const groups=groupParts(entries);
   for(const group of groups){
    if(group.parts.length>1){
     const example=group.parts[0],expanded=expandedGroups.has(group.key),tr=el("tr","bs-parts-duplicate-group");
     const numberCell=el("td","bs-parts-number","Multiple");
     const nameCell=el("td"),label=el("strong","",example.name),count=el("span","bs-parts-duplicate-count"," · "+group.parts.length+" records");
     nameCell.append(label,count);
     const typeCell=el("td","",typeValues.find(([key])=>key===partTypeFor(example))?.[1]||"Part");
     const stateCell=el("td","muted","Individual statuses");
     const controlsCell=el("td"),toggle=el("button","btn bs-parts-group-toggle",expanded?"Hide entries":"Show "+group.parts.length+" entries");
     toggle.type="button";toggle.setAttribute("aria-expanded",String(expanded));
     toggle.setAttribute("aria-label",(expanded?"Hide":"Show")+" saved records for "+example.name);
     toggle.onclick=()=>{expanded?expandedGroups.delete(group.key):expandedGroups.add(group.key);render()};
     controlsCell.append(toggle);tr.append(numberCell,nameCell,typeCell,stateCell,controlsCell);tbody.append(tr);
     if(!expanded)continue;
    }
    for(const part of group.parts){
    const tr=el("tr",group.parts.length>1?"bs-parts-duplicate-detail":""),readOnly=!canEdit()||!!part.generatedFrom;
    const inferred=!part.partNumber&&!!numberFor(part);const number=el("td","bs-parts-number",part.partNumber||(inferred?numberFor(part)+" *":"Unassigned"));if(inferred)number.title="Number appears in name but is not formally assigned.";tr.append(number);
    const nameCell=el("td"),input=el("input","field",undefined);
    input.value=part.name||"";input.title=part.name||"";input.maxLength=180;input.disabled=readOnly;input.setAttribute("aria-label","Name for "+(part.partNumber||part.name));
    const initial=part.name;
    input.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();input.blur()}else if(e.key==="Escape"){input.value=initial;input.blur()}});
    input.addEventListener("blur",()=>{if(input.value.trim()!==part.name)void change(part,"name",input.value.trim(),input);else input.value=part.name});
    nameCell.append(input);tr.append(nameCell);
    const typeCell=el("td"),type=dropdown(typeValues,partTypeFor(part),readOnly);
    type.setAttribute("aria-label","Part type for "+part.name);
    type.onchange=()=>void change(part,"partType",type.value,type);typeCell.append(type);tr.append(typeCell);
    const stateCell=el("td"),stateKey=fields.statusField(part),state=dropdown(fields.statusesFor(part),statusFor(part),readOnly);
    state.setAttribute("aria-label","Status for "+part.name);
    state.onchange=()=>void change(part,stateKey,state.value,state);
    stateCell.append(state);
    // Progress Status is an ordered list of updates, not a replaceable note.
    if(stateKey==="progressStatus"&&statusFor(part)==="in_progress"){
     const progress=el("div","bs-progress-notes"),label=el("label","bs-progress-notes-label","Progress Status");
     const composer=el("div","bs-progress-composer"),entry=el("input","field bs-progress-input"),add=el("button","btn bs-progress-add","Add");
     entry.placeholder="Material ordered, waiting on paint…";entry.maxLength=500;entry.disabled=readOnly;
     entry.setAttribute("aria-label","Progress Status update for "+part.name);add.type="button";add.disabled=readOnly;
     const save=async()=>{
      if(!entry.value.trim())return;
      add.disabled=true;entry.disabled=true;
      await savePatch(part,{progressUpdate:entry.value.trim()},add);
     };
     add.onclick=()=>void save();
     entry.onkeydown=event=>{if(event.key==="Enter"){event.preventDefault();void save()}};
     composer.append(entry,add);label.append(composer);progress.append(label);
     if(part.progressUpdates?.length){
      const history=el("details","bs-progress-history"),summary=el("summary","",part.progressUpdates.length+" previous update"+(part.progressUpdates.length===1?"":"s")),list=el("ol");
      for(const update of part.progressUpdates){const item=el("li");item.textContent=update.text;item.title=update.createdAt||"";list.append(item)}
      history.append(summary,list);progress.append(history);
     }
     stateCell.append(progress);
    }
    tr.append(stateCell);
    const attentionCell=el("td","bs-parts-attention"),attentionRow=el("div","bs-parts-attention-inline");
    const attentionLine=el("label","bs-attention-line"),attention=el("input");
    attention.type="checkbox";attention.checked=part.needsAttention===true;attention.disabled=readOnly;
    attentionLine.append(attention,document.createTextNode(" Needs attention"));
    const note=el("input","field bs-attention-note");
    note.type="text";note.maxLength=2000;note.placeholder="What needs attention?";
    note.value=part.attentionNote||"";note.disabled=readOnly;note.hidden=!attention.checked;
    note.setAttribute("aria-label","Attention note for "+part.name);
    note.title=note.value;
    const open=el("button","btn bs-parts-open","Open");open.type="button";open.onclick=()=>onOpenPart?.(part.id);
    attentionRow.append(attentionLine,open,note);attentionCell.append(attentionRow);
    attention.onchange=()=>{
     note.hidden=!attention.checked;
     if(attention.checked){note.focus();feedback.textContent="Enter an attention note. It saves when you leave the field or press Enter."}
     else void savePatch(part,{needsAttention:false,attentionNote:note.value},attention);
    };
    const saveNote=()=>{
     const value=note.value.trim();
     if(attention.checked&&!value){feedback.textContent="Enter a note before flagging this part.";return}
     if(value!==(part.attentionNote||"")||attention.checked!==!!part.needsAttention)
      void savePatch(part,{needsAttention:attention.checked,attentionNote:value},note);
    };
    note.addEventListener("blur",saveNote);
    note.addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();note.blur()}});
    tr.append(attentionCell);tbody.append(tr);
    }
   }
   const repeats=groups.filter(g=>g.parts.length>1).length;
   feedback.textContent=entries.length+" of "+parts.length+" part records across "+groups.length+" distinct groups."+
    (repeats?" "+repeats+" group"+(repeats===1?"":"s")+" contain multiple saved records. Expand to review each; no records were deleted.":"")+
    " Generated consumables are managed through their source part.";
  }
  async function change(part,key,value,control){return savePatch(part,{[key]:value},control)}
  async function savePatch(part,changes,control){
   if(!canEdit())return;
   if(Object.hasOwn(changes,"name")&&!changes.name){feedback.textContent="Part name cannot be blank.";control.value=part.name;return}
   control.disabled=true;
   const previous={...part};
   try{
    const res=await fetch("/api/components?project="+encodeURIComponent(project)+"&id="+encodeURIComponent(part.id),{
     method:"PATCH",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify(changes)
    });
    const data=await res.json();if(!res.ok)throw Error(data.error||"Update failed");
    Object.assign(part,data.component);onChanged?.(data.component);
    render();feedback.textContent="Saved "+part.name+".";
   }catch(error){
    if(control.type==="checkbox")control.checked=!!previous.needsAttention;else if(control.value!==undefined)control.value=previous[Object.keys(changes)[0]]??"";
    feedback.textContent="Not saved: "+error.message;
    if(/another tab|Reload/.test(error.message))void refresh();
   }finally{control.disabled=!canEdit()}
  }
  async function refresh(){
   const id=++fetchId;feedback.textContent="Loading parts…";
   try{
    const res=await fetch("/api/components?project="+encodeURIComponent(project),{credentials:"same-origin",cache:"no-store"}),data=await res.json();
    if(!res.ok)throw Error(data.error||"Unable to load parts");
    if(id!==fetchId)return;
    parts=(data.components||[]).filter(p=>!p.generatedFrom);refreshStatusFilter();render();
   }catch(error){if(id===fetchId)feedback.textContent=error.message}
  }
  // Keep the status filter relevant to the selected sourcing type. All types
  // shows the union of purchasing and progress statuses, without duplicates.
  const refreshStatusFilter=()=>{
   const previous=filter.value;
   const matching=parts.filter(part=>typeFilter.value==="all"||partTypeFor(part)===typeFilter.value);
   const available=typeFilter.value==="all"?[...fields.progressStatuses,...fields.purchaseStatuses]:
    matching.length?matching.flatMap(part=>fields.statusesFor(part)):
    typeFilter.value==="purchased"?fields.purchaseStatuses:fields.progressStatuses;
   const options=[...new Map(available.map(([value,label])=>[value,label])).entries()];
   filter.replaceChildren();
   for(const [value,label] of [["all","All statuses"],...options]){
    const option=el("option","",label);option.value=value;filter.append(option);
   }
   filter.value=options.some(([value])=>value===previous)?previous:"all";
  };
  search.oninput=render;
  filter.onchange=render;
  typeFilter.onchange=()=>{refreshStatusFilter();render()};
  refreshStatusFilter();
  return {refresh};
 }
 window.BSPartsManager=Object.freeze({mount,groupParts});
})();
