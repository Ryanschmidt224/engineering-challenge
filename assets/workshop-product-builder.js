/* Workshop Product Builder: ordered, user-authored sections and fields.
   Values are owned by either this Workshop item or the importing project.
   No links to related products cause inheritance or synchronization. */
(function(){
"use strict";
const TYPES=[["text","Text"],["number","Number + unit"],["select","Dropdown"],["checkbox","Checkbox"],["photo","Photo URL"],["link","Link"]];
const ID=()=>("f"+crypto.randomUUID().replace(/-/g,"")).slice(0,32);
const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e};
const option=(select,value,label)=>{const o=el("option",null,label);o.value=value;select.append(o)};
const input=(value="",placeholder="Optional")=>{const i=el("input","field");i.type="text";i.value=value;i.placeholder=placeholder;return i};
const btn=(label,fn,cls="btn")=>{const b=el("button",cls,label);b.type="button";b.onclick=fn;return b};
const safeURL=value=>{
 try{const url=new URL(value,location.origin);return ["https:","http:"].includes(url.protocol)?url.href:""}catch{return ""}
};
function create({item={},readOnly=true}={}){
 const root=el("section","workshop-product-builder");
 const heading=el("div","workshop-builder-heading");
 heading.append(el("h3",null,"Product Builder"),
  el("p","Create sections and fields for this item. Drag sections or fields to reorder them. Workshop values are shared; project values are filled in by each builder.","muted"));
 root.append(heading);
 const list=el("div","workshop-builder-sections");root.append(list);
 const footer=el("div","workshop-builder-actions");root.append(footer);
 let editing=!readOnly;
 let sections=(Array.isArray(item.productSections)?item.productSections:[]).map(section=>({
  id:section.id||ID(),title:section.title||"Section",
  fields:(section.fields||[]).map(f=>({id:f.id||ID(),label:f.label||"",type:f.type||"text",
   scope:f.scope||"workshop",unit:f.unit||"",value:f.value||"",options:[...(f.options||[])]}))
 }));
 const swap=(id,targetId,kind)=>{
  if(id===targetId)return;
  if(kind==="section"){
   const from=sections.findIndex(s=>s.id===id),to=sections.findIndex(s=>s.id===targetId);
   if(from<0||to<0)return;
   const [moved]=sections.splice(from,1);sections.splice(to,0,moved);
  }else{
   const fromSection=sections.find(s=>s.fields.some(f=>f.id===id));
   const toSection=sections.find(s=>s.fields.some(f=>f.id===targetId));
   if(!fromSection||!toSection)return;
   const from=fromSection.fields.findIndex(f=>f.id===id);
   const [moved]=fromSection.fields.splice(from,1);
   const to=toSection.fields.findIndex(f=>f.id===targetId);
   toSection.fields.splice(Math.max(0,to),0,moved);
  }
  render();
 };
 const move=(sectionId,id,direction)=>{
  const collection=id?sections.find(s=>s.id===sectionId)?.fields:sections;
  if(!collection)return;
  const index=collection.findIndex(entry=>entry.id===(id||sectionId));
  const to=index+direction;if(index<0||to<0||to>=collection.length)return;
  [collection[index],collection[to]]=[collection[to],collection[index]];render();
 };
 const fieldRow=(section,field)=>{
  const row=el("div","workshop-builder-field");
  row.dataset.builderField=field.id;
  row.addEventListener("dragover",event=>{
   if(!editing||!Array.from(event.dataTransfer.types).includes("text/workshop-field"))return;
   event.preventDefault();event.stopPropagation();
  });
  row.addEventListener("drop",event=>{
   const from=event.dataTransfer.getData("text/workshop-field");
   if(from){event.preventDefault();event.stopPropagation();swap(from,field.id,"field")}
  });
  const title=el("div","workshop-builder-field-heading");
  if(editing){
   const grip=el("span","workshop-builder-grip","⠿");grip.title="Drag to reorder";
   grip.draggable=true;
   grip.addEventListener("dragstart",event=>{
    event.stopPropagation();
    event.dataTransfer.setData("text/workshop-field",field.id);
    event.dataTransfer.effectAllowed="move";
   });
   const name=input(field.label,"Field title");name.maxLength=100;
   name.setAttribute("aria-label","Field title");
   name.oninput=()=>{field.label=name.value};
   title.append(grip,name);
  }else title.append(el("strong",null,field.label));
  row.append(title);
  const valueWrap=el("div","workshop-builder-field-value");
  if(editing){
   const meta=el("div","workshop-builder-field-meta");
   const type=el("select","field");type.setAttribute("aria-label","Field type");
   for(const [value,label] of TYPES)option(type,value,label);
   type.value=field.type;type.onchange=()=>{field.type=type.value;render()};
   const scope=el("select","field");scope.setAttribute("aria-label","Who fills in this field");
   option(scope,"workshop","Workshop value");option(scope,"project","Project user value");
   scope.value=field.scope;scope.onchange=()=>{field.scope=scope.value;if(field.scope==="project")field.value="";render()};
   meta.append(type,scope);valueWrap.append(meta);
   if(field.type==="number"){
    const unit=input(field.unit,"Unit (optional)");unit.maxLength=32;
    unit.setAttribute("aria-label","Unit");
    unit.oninput=()=>{field.unit=unit.value};
    valueWrap.append(unit);
   }
   if(field.type==="select"){
    const opts=input(field.options.join(", "),"Choices, separated by commas");
    opts.setAttribute("aria-label","Dropdown choices");
    opts.onchange=()=>{field.options=opts.value.split(",").map(x=>x.trim()).filter(Boolean).slice(0,30)};
    valueWrap.append(opts);
   }
  }
  if(field.scope==="project"){
   const note=el("span","workshop-builder-project-hint","Filled in when added to a project");
   valueWrap.append(note);
  }else{
   const choices=field.options||[];
   let control;
   if(field.type==="checkbox"){
    control=el("input");control.type="checkbox";control.checked=field.value==="true";
    control.onchange=()=>{field.value=String(control.checked)};
   }else if(field.type==="select"){
    control=el("select","field");option(control,"","Select...");
    choices.forEach(choice=>option(control,choice,choice));
    control.value=field.value;control.onchange=()=>{field.value=control.value};
   }else{
    control=input(field.value,field.type==="link"||field.type==="photo"?"HTTPS URL":"Optional");
    if(field.type==="number")control.inputMode="decimal";
    if(field.type==="link"||field.type==="photo")control.type="url";
    control.oninput=()=>{field.value=control.value};
   }
   control.disabled=!editing;control.readOnly=!editing;
   control.setAttribute("aria-label",field.label||"Workshop value");
   valueWrap.append(control);
   if(!editing&&field.type==="link"&&safeURL(field.value)){
    const a=el("a",null,"Open link");a.href=safeURL(field.value);a.target="_blank";a.rel="noopener noreferrer";valueWrap.append(a);
   }
   if(!editing&&field.type==="photo"&&safeURL(field.value)){
    const img=el("img","workshop-builder-photo");img.src=safeURL(field.value);img.alt=field.label;img.loading="lazy";valueWrap.append(img);
   }
  }
  row.append(valueWrap);
  if(editing){
   const actions=el("div","workshop-builder-field-actions");
   actions.append(btn("↑",()=>move(section.id,field.id,-1),"btn"),btn("↓",()=>move(section.id,field.id,1),"btn"),
    btn("Remove",()=>{section.fields=section.fields.filter(x=>x.id!==field.id);render()},"btn"));
   row.append(actions);
  }
  return row;
 };
 const render=()=>{
  list.replaceChildren();
  for(const section of sections){
   const card=el("section","workshop-builder-section");

   card.addEventListener("dragover",event=>{
    if(!editing||!Array.from(event.dataTransfer.types).includes("text/workshop-section"))return;
    event.preventDefault();
   });
   card.addEventListener("drop",event=>{
    const from=event.dataTransfer.getData("text/workshop-section");
    if(from){event.preventDefault();swap(from,section.id,"section")}
   });
   const head=el("div","workshop-builder-section-heading");
   if(editing){
    const grip=el("span","workshop-builder-grip","⠿");grip.title="Drag section";
    grip.draggable=true;
    grip.addEventListener("dragstart",event=>{
     event.stopPropagation();
     event.dataTransfer.setData("text/workshop-section",section.id);
     event.dataTransfer.effectAllowed="move";
    });
    const title=input(section.title,"Section title");title.maxLength=100;
    title.setAttribute("aria-label","Section title");
    title.oninput=()=>{section.title=title.value};
    head.append(grip,title);
    const actions=el("div","workshop-builder-section-actions");
    actions.append(btn("↑",()=>move(section.id,null,-1)),btn("↓",()=>move(section.id,null,1)),
     btn("Delete section",()=>{if(section.fields.length&&!confirm("Delete this section and its fields?"))return;sections=sections.filter(x=>x.id!==section.id);render()}));
    head.append(actions);
   }else head.append(el("h4",null,section.title));
   card.append(head);
   const rows=el("div","workshop-builder-field-list");
   section.fields.forEach(field=>rows.append(fieldRow(section,field)));
   if(!section.fields.length)rows.append(el("p","No fields in this section yet.","muted"));
   card.append(rows);
   if(editing)card.append(btn("+ Add field",()=>{
    if(sections.reduce((n,s)=>n+s.fields.length,0)>=120)return;
    section.fields.push({id:ID(),label:"",type:"text",scope:"workshop",unit:"",value:"",options:[]});
    render();card.querySelector(".workshop-builder-field:last-child input")?.focus();
   },"btn"));
   list.append(card);
  }
  if(!sections.length)list.append(el("p","No custom sections yet. Add one to organize this product's information.","muted"));
  footer.replaceChildren();
  if(editing)footer.append(btn("+ Add section",()=>{
   if(sections.length>=16)return;
   sections.push({id:ID(),title:"New section",fields:[]});render();
  },"btn primary"));
 };
 render();
 return {
  element:root,
  getSections:()=>sections.map(s=>({
   id:s.id,title:s.title.trim()||"Untitled section",
   fields:s.fields.filter(f=>f.label.trim()).map(f=>({
    id:f.id,label:f.label.trim(),type:f.type,scope:f.scope,unit:f.unit.trim(),
    value:f.scope==="workshop"?String(f.value||""):"",options:[...f.options]
   }))
  })),
  setSections:incoming=>{
   // Layout-only import: keep IDs stable for future editing, never copy source
   // product values. Workshop-specific values can be entered after applying.
   sections=(Array.isArray(incoming)?incoming:[]).map(section=>({
    id:section.id||ID(),title:section.title||"Section",
    fields:(section.fields||[]).map(field=>({
     id:field.id||ID(),label:field.label||"",type:field.type||"text",
     scope:field.scope||"workshop",unit:field.unit||"",value:"",
     options:[...(field.options||[])]
    }))
   }));
   render();
  },
  setEditing:value=>{editing=!!value;render()}
 };
}
window.BSWorkshopProductBuilder={create};
})();
