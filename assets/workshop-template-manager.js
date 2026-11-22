/* Workshop master-template editor on the catalog page.
 * Templates are independent category-scoped layouts, not part records.
 * Item values and inventory are never written through this editor.
 */
(function(){
 "use strict";
 const sectionSpecs=[
  ["identity","Product identity",[
   ["partNumber","Manufacturer part number"],["featureTreeDescription","Default container name"],
   ["manufacturer","Manufacturer"],["name","Item name"],["subtitle","Short description"],["model","Mfg part number"]
  ]],
  ["ordering","Ordering",[
   ["supplier","Supplier"],["supplierPartNumber","Supplier part number"],
   ["supplierUrl","Supplier / ordering URL"],["asin","Amazon ASIN"],
   ["price","Reference price"],["packageQuantity","Quantity / package"]
  ]],
  ["characteristics","Part characteristics",[["typeName","Product type"],["spec","Specifications"]]],
  ["notes","Extra notes",[
   ["use","Typical use"],["caution","Important considerations"],
   ["orderNotes","How to order"],["documentationUrl","Documentation URL"],["notes","Additional notes"]
  ]]
 ];
 const el=(tag,cls,text)=>{
  const node=document.createElement(tag);
  if(cls)node.className=cls;
  if(text!==undefined)node.textContent=text;
  return node;
 };
 const button=(label,callback,cls="btn")=>{
  const node=el("button",cls,label);
  node.type="button";node.addEventListener("click",callback);return node;
 };
 const field=(value="",placeholder="")=>{
  const node=el("input","field");node.type="text";node.value=value;node.placeholder=placeholder;return node;
 };
 const request=async(method="GET",body=null)=>{
  const response=await fetch("/api/workshop-templates",{
   method,credentials:"same-origin",cache:"no-store",
   ...(body?{headers:{"content-type":"application/json"},body:JSON.stringify(body)}:{})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error||"Unable to manage templates");
  return data;
 };
 function mount({catalog,categories,getSelectedCategory,isEditable}){
  const bar=catalog.querySelector(".workshop-catalog-controls");
  if(!bar||catalog.querySelector(".workshop-template-launch"))return;
  const launch=button("Template builder",()=>setOpen(!open),"btn workshop-template-launch");
  launch.title="Create, find, and edit reusable Workshop layouts for each category.";
  const sort=bar.querySelector(".workshop-sort-label");
  bar.insertBefore(launch,sort);
  const panel=el("section","workshop-template-manager");
  panel.hidden=true;
  const header=el("div","workshop-template-manager-heading");
  const headings=el("div");
  headings.append(el("h3",null,"Template builder"),
   el("p","Create and edit reusable field layouts by Workshop category. Product values stay with individual parts.","muted"));
  header.append(headings,button("Close",()=>setOpen(false),"btn"));
  panel.append(header);
  const top=el("div","workshop-template-manager-controls");
  const categoryLabel=el("label");categoryLabel.append(el("span",null,"Category"));
  const category=el("select","field");
  for(const [id,name] of categories){
   if(id==="all"||id==="mine")continue;
   const option=el("option",null,name);option.value=id;category.append(option);
  }
  categoryLabel.append(category);
  const searchLabel=el("label");searchLabel.append(el("span",null,"Find template"));
  const search=field("","Search by template name");
  search.type="search";searchLabel.append(search);
  const selectedLabel=el("label");selectedLabel.append(el("span",null,"Saved layouts"));
  const select=el("select","field");selectedLabel.append(select);
  const nameLabel=el("label");nameLabel.append(el("span",null,"Template name"));
  const name=field("","e.g., MOSFET, relay, pushbutton");name.maxLength=90;
  nameLabel.append(name);
  top.append(categoryLabel,searchLabel,selectedLabel,nameLabel);panel.append(top);
  const message=el("p","workshop-template-manager-status");
  message.setAttribute("role","status");
  const tables=el("div","workshop-template-manager-tables");
  panel.append(tables);
  const builderHost=el("div","workshop-template-manager-builder");
  panel.append(builderHost);
  const actions=el("div","workshop-template-manager-actions");
  const newButton=button("New template",()=>beginNew(),"btn");
  const saveButton=button("Save template",()=>void save(),"btn primary");
  const deleteButton=button("Delete template",()=>void remove(),"btn");
  actions.append(newButton,saveButton,deleteButton);
  panel.append(actions,message);
  const count=catalog.querySelector(".workshop-catalog-count");
  if(count)count.before(panel);else catalog.append(panel);
  const generic=el("section","workshop-template-manager-generic");
  generic.append(el("h4",null,"Configured in project"),
   el("p","Add field definitions a user fills in later. This template never stores project-specific values.","muted"));
  const genericRows=el("div","workshop-template-manager-generic-rows");
  const addGeneric=entry=>{
   const row=el("div","workshop-template-manager-pair");
   const label=field(entry?.label||"","Field name");
   label.maxLength=100;
   const unit=field(entry?.unit||"","Unit (optional)");
   unit.maxLength=32;
   row.append(label,unit,button("Remove",()=>row.remove(),"btn"));
   genericRows.append(row);
  };
  generic.append(genericRows,button("+ Add project field",()=>{if(genericRows.children.length<40)addGeneric()},"btn"));
  tables.after(generic);
  let templates=[],selectedId="",open=false,dirty=false,builder=null;
  const tableRows=new Map();
  const readTables=()=>({sections:Object.fromEntries(sectionSpecs.map(([key])=>{
   const ui=tableRows.get(key);
   return [key,{
    title:ui.title.value.trim(),
    labels:Object.fromEntries([...ui.labels].map(([name,input])=>[name,input.value.trim()]).filter(([,value])=>value)),
    hiddenFields:[...ui.hidden].filter(([,input])=>input.checked).map(([name])=>name),
    rows:[...ui.rows.children].map(row=>({
     id:row.dataset.id,label:row.querySelector(".workshop-template-row-label").value.trim(),value:""
    })).filter(row=>row.label)
   }];
  }))});
  const addCustomRow=(host,entry={})=>{
   if(host.children.length>=30)return null;
   const row=el("div","workshop-template-manager-pair");
   row.dataset.id=entry.id||"row-"+crypto.randomUUID();
   const label=field(entry.label||"","Additional field name");
   label.maxLength=100;label.classList.add("workshop-template-row-label");
   const fixed=el("span","muted","Value filled in on part");
   row.append(label,fixed,button("Remove",()=>{row.remove();dirty=true},"btn"));
   host.append(row);
   return label;
  };
  const buildTables=layout=>{
   tables.replaceChildren();tableRows.clear();
   for(const [key,defaultTitle,fields] of sectionSpecs){
    const meta=layout?.sections?.[key]||{};
    const section=el("section","workshop-template-manager-section");
    const title=field(meta.title||defaultTitle,"Section title");title.maxLength=100;
    const heading=el("label","workshop-template-manager-section-title");
    heading.append(el("span",null,"Section title"),title);
    section.append(heading);
    const subheading=el("p","muted","Rename fields or hide fields not used by this template.");
    section.append(subheading);
    const labels=new Map(),hidden=new Map();
    for(const [fieldKey,defaultLabel] of fields){
     const row=el("div","workshop-template-manager-standard-row");
     const input=field(meta.labels?.[fieldKey]||defaultLabel,"Field name");
     input.maxLength=100;labels.set(fieldKey,input);
     const flag=el("input");flag.type="checkbox";
     flag.checked=(meta.hiddenFields||[]).includes(fieldKey);
     flag.disabled=fieldKey==="name";
     hidden.set(fieldKey,flag);
     const hide=el("label","workshop-template-manager-hide");
     hide.append(flag,el("span",null,"Hide"));
     row.append(input,hide);section.append(row);
    }
    const rows=el("div","workshop-template-manager-custom-rows");
    for(const record of meta.rows||[])addCustomRow(rows,record);
    section.append(rows,button("+ Add row",()=>{const input=addCustomRow(rows);input?.focus();dirty=true},"btn"));
    tableRows.set(key,{title,labels,hidden,rows});tables.append(section);
   }
  };
  const snapshot=()=>({
   name:name.value.trim(),
   category:category.value,
   tableLayout:readTables(),
   genericFields:[...genericRows.children].map(row=>({
    label:row.querySelector("input:first-child").value.trim(),
    unit:row.querySelector("input:nth-child(2)").value.trim()
   })).filter(row=>row.label),
   productSections:builder?.getSections()||[]
  });
  const refreshChoices=()=>{
   const previous=selectedId;
   select.replaceChildren();
   const blank=el("option",null,"New layout / select a saved template");blank.value="";select.append(blank);
   const term=search.value.trim().toLowerCase();
   for(const record of templates.filter(entry=>entry.category===category.value&&entry.name.toLowerCase().includes(term))){
    const option=el("option",null,record.name);option.value=record.id;select.append(option);
   }
   select.value=[...select.options].some(option=>option.value===previous)?previous:"";
   deleteButton.disabled=!selectedId;
  };
  const openTemplate=template=>{
   selectedId=template?.id||"";
   name.value=template?.name||"";
   buildTables(template?.tableLayout);
   genericRows.replaceChildren();
   for(const entry of template?.genericFields||[])addGeneric(entry);
   if(!builder){
    builder=window.BSWorkshopProductBuilder?.create({item:{productSections:[]},readOnly:false});
    if(builder)builderHost.append(builder.element);
   }
   builder?.setSections(template?.productSections||[]);
   deleteButton.disabled=!selectedId;
   message.textContent=selectedId?"Editing '"+template.name+"'. Saving updates this master only.":"New blank template — choose fields and save.";
   dirty=false;
  };
  const beginNew=()=>{selectedId="";search.value="";refreshChoices();openTemplate(null);};
  const load=async()=>{
   try{
    const data=await request();
    templates=data.templates||[];
    refreshChoices();
   }catch(error){message.textContent=error.message}
  };
  const save=async()=>{
   if(!isEditable()){message.textContent="Sign in to edit master templates.";return}
   const payload=snapshot();
   if(!payload.name){message.textContent="Enter a template name.";name.focus();return}
   if(!payload.category){message.textContent="Select a category.";return}
   saveButton.disabled=true;message.textContent="Saving master template…";
   try{
    const response=await request(selectedId?"PUT":"POST",{
     ...payload,...(selectedId?{id:selectedId}:{})
    });
    const saved=response.template;
    templates=templates.filter(entry=>entry.id!==saved.id).concat(saved);
    selectedId=saved.id;search.value="";refreshChoices();
    message.textContent="Saved '"+saved.name+"'. Existing Workshop parts are unchanged.";
    dirty=false;
   }catch(error){message.textContent=error.message}
   finally{saveButton.disabled=false}
  };
  const remove=async()=>{
   const current=templates.find(entry=>entry.id===selectedId);
   if(!current||!isEditable())return;
   if(!window.confirm("Delete master template '"+current.name+"'? Existing Workshop parts keep their layouts."))return;
   deleteButton.disabled=true;
   try{
    await request("DELETE",{id:current.id});
    templates=templates.filter(entry=>entry.id!==current.id);
    beginNew();message.textContent="Master template deleted. Workshop parts are unchanged.";
   }catch(error){message.textContent=error.message}
   finally{deleteButton.disabled=!selectedId}
  };
  const setOpen=next=>{
   open=!!next;panel.hidden=!open;
   launch.setAttribute("aria-expanded",String(open));
   if(!open)return;
   const active=getSelectedCategory();
   if(active&&[...category.options].some(option=>option.value===active))category.value=active;
   refreshChoices();if(!tableRows.size)openTemplate(null);
   void load();
   panel.scrollIntoView({block:"nearest"});
  };
  select.addEventListener("change",()=>{
   const entry=templates.find(record=>record.id===select.value);
   openTemplate(entry||null);
  });
  category.addEventListener("change",()=>{beginNew();refreshChoices()});
  search.addEventListener("input",refreshChoices);
  panel.addEventListener("input",()=>{dirty=true});
  panel.addEventListener("change",()=>{dirty=true});
  launch.hidden=!isEditable();
  return {setEditable:enabled=>{launch.hidden=!enabled;if(!enabled)setOpen(false)},
   close:()=>setOpen(false)};
 }
 window.BSWorkshopTemplateManager={mount};
})();
