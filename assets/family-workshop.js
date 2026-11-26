import "./photo-editor.js";
import {dataTable} from "./data-table.js";
import {node,button,listCard,actions,panel,field,checkbox,readValue,valuesEditor,help,requestWorkshop} from "./workshop-ui.js";
import {present,resolveFamilyValues,validateFamilyFields,validateFamilyValues,isWebUrl} from "./family-model.js";
import {tileTypes,tileStatuses,relations,labelFor} from "./knowledge-model.js";
import {initProjectProductCopy} from "./project-product-copy.js";
import {renderWorkshopProjectUses,projectReturnLink} from "./workshop-project-uses.js";

const $=selector=>document.querySelector(selector),detail=$("#workshop-detail"),dialog=$("#workshop-dialog");
const params=new URLSearchParams(location.search);
let data={categories:[],families:[],fields:[],products:[],uses:[],attachments:[]},projects=[];

let selectedCategory="",selectedFamily="",selectedProduct="",selectedUse="",draft=null,editing=false,dirty=false,busy=false,showUseFields=false;
const status=(message,error=false)=>{$("#workshop-status").textContent=message;$("#workshop-status").classList.toggle("status--error",error);};
const mark=()=>{dirty=true;};
const active=record=>!record.archived||$("#show-archived").checked;
const family=()=>data.families.find(f=>f.id===selectedFamily);
const familyFields=()=>data.fields.filter(f=>f.family_id===selectedFamily).sort((a,b)=>a.sort_order-b.sort_order);
const copy=value=>structuredClone(value);
function mayLeave(){return !dirty||window.confirm("Discard the unsaved changes to this form?");}
async function run(operation){
 if(busy)return;busy=true;detail.inert=true;$("#family-list").inert=true;$("#category-tree").inert=true;
 try{await operation();}catch(error){status(error.message,true);}finally{busy=false;detail.inert=false;$("#family-list").inert=false;$("#category-tree").inert=false;}
}
async function refresh(){data=await requestWorkshop();renderNavigation();}
// Knowledge that applies here: for a family its own tiles; for a product also
// its family's; for a project use also its product's and family's. The server
// applies that one rule. Optional context: a failure never blocks the Workshop.
const knowledgeNoun={family:"family",product:"product",use:"project part"};
const knowledgeVia={use:"this part",product:"product",family:"family"};
function renderKnowledge(type,id){
 const section=panel("Info Bits");detail.append(section);
 const create=node("a","New information tile for this "+knowledgeNoun[type],"button");create.href="knowledge.html?new=1&link="+type+":"+encodeURIComponent(id);
 void requestWorkshop("/api/knowledge?related="+type+"&id="+encodeURIComponent(id)).then(result=>{
  if(!section.isConnected)return;
  section.querySelector("h3").textContent="Info Bits ("+result.tiles.length+")";
  const list=node("div","","knowledge-list");
  for(const tile of result.tiles){
   const entry=node("a","","list-card");entry.href="knowledge.html?tile="+encodeURIComponent(tile.id);
   const reasons=[...new Set(tile.via.map(via=>type==="family"?labelFor(relations,via.relation)+" this family":"via "+knowledgeVia[via.target_type]))];
   entry.append(node("strong",tile.title),node("small",[labelFor(tileTypes,tile.type),labelFor(tileStatuses,tile.status),...reasons].join(" · ")),node("small",tile.summary));
   list.append(entry);
  }
  if(!result.tiles.length)list.append(node("p","No information linked yet. Lessons, methods and concepts about this "+knowledgeNoun[type]+" appear here.","empty"));
  section.append(list,actions(create));
 }).catch(error=>{if(section.isConnected)section.append(node("p","Info Bits could not load: "+error.message,"error"),actions(create));});
}
function updateLocation(){
 const url=new URL(location.href);url.searchParams.delete("edit");
 for(const [key,value] of [["family",selectedFamily],["product",selectedProduct],["use",selectedUse]])value?url.searchParams.set(key,value):url.searchParams.delete(key);
 history.replaceState(null,"",url);
}
function changeSelection({category=selectedCategory,familyId="",productId="",useId=""}={}){
 if(!mayLeave())return;
 selectedCategory=category;selectedFamily=familyId;selectedProduct=productId;selectedUse=useId;draft=null;editing=false;dirty=false;showUseFields=false;
 updateLocation();
 renderNavigation();renderDetail();
}
function descendantCategories(id){const found=new Set([id]);let changed=true;while(changed){changed=false;for(const category of data.categories)if(found.has(category.parent_id)&&!found.has(category.id)){found.add(category.id);changed=true;}}return found;}
function renderNavigation(){
 const tree=$("#category-tree");tree.replaceChildren(button("All families",()=>changeSelection({category:""}),"button--quiet"));
 const build=(parent,host)=>{
  for(const category of data.categories.filter(c=>c.parent_id===parent&&active(c)).sort((a,b)=>a.sort_order-b.sort_order||a.name.localeCompare(b.name))){
   const children=data.categories.some(c=>c.parent_id===category.id&&active(c));
   const entry=button(category.name+(category.archived?" (archived)":""),()=>changeSelection({category:category.id}),"category-button"+(selectedCategory===category.id?" is-selected":""));
   entry.oncontextmenu=event=>{event.preventDefault();selectedCategory=category.id;renderNavigation();showCategoryMenu(event.clientX,event.clientY);};
   entry.onkeydown=event=>{if(event.key==="F10"&&event.shiftKey){event.preventDefault();selectedCategory=category.id;const box=entry.getBoundingClientRect();showCategoryMenu(box.left,box.bottom);}};
   if(children){const group=node("details","","category-node"),summary=node("summary");summary.append(entry);group.append(summary);group.open=descendantCategories(category.id).has(selectedCategory);const sub=node("div","","category-children");build(category.id,sub);group.append(sub);host.append(group);}
   else host.append(entry);
  }
 };
 build(null,tree);
 const query=$("#catalog-search").value.toLowerCase().trim(),categories=selectedCategory?descendantCategories(selectedCategory):null;
 const list=$("#family-list");list.replaceChildren();
 for(const item of data.families.filter(f=>active(f)&&(!categories||categories.has(f.category_id))).filter(f=>{
  if(!query)return true;
  const products=data.products.filter(p=>p.family_id===f.id&&active(p));
  return [f.name,f.description,...products.flatMap(p=>[p.name,p.manufacturer,p.mpn,...Object.values(p.field_values)])].join(" ").toLowerCase().includes(query);
 }).sort((a,b)=>a.name.localeCompare(b.name))){
  const count=data.products.filter(p=>p.family_id===item.id&&!p.archived).length;
  const entry=listCard("",()=>changeSelection({familyId:item.id}),"family-card"+(item.id===selectedFamily?" is-selected":""));
  entry.append(node("strong",item.name+(item.archived?" (archived)":"")),node("small",(item.kind==="tool"?"Tool · ":item.kind==="material"?"Material · ":"")+count+" "+(count===1?"product":"products")));list.append(entry);
 }
 if(!list.children.length)list.append(node("p","No matching families. Add one or change the search.","empty"));
}
function begin(entity,record){
 if(!mayLeave())return;
 editing=true;dirty=false;showUseFields=false;
 draft={entity,record:copy(record),expectedRevision:record.revision??null,expectedFamilyRevision:family()?.revision};
 renderDetail();
}
function newFamily(){
 if(!mayLeave())return;
 dirty=false;
 selectedFamily="";selectedProduct="";selectedUse="";
 begin("family",{id:crypto.randomUUID(),category_id:selectedCategory||null,name:"",kind:"part",description:"",notes:"",fields:[]});
}
function newProduct(){begin("product",{id:crypto.randomUUID(),family_id:selectedFamily,name:"",manufacturer:"",mpn:"",supplier_links:[],field_values:{},notes:""});}
async function newUse(productId=selectedProduct){
 if(!mayLeave())return;
 if(!projects.length){const response=await requestWorkshop("/api/projects");projects=response.projects||[];}
 if(!projects.length){status("Create a project before adding a use.",true);return;}
 dirty=false;
 begin("use",{id:crypto.randomUUID(),family_id:selectedFamily,project_id:params.get("project")||projects[0].id,tree_node_id:params.get("assembly")||null,product_id:productId||null,purpose:"",quantity:null,unit:"pcs",field_values:{},notes:""});
}
async function saveDraft(form){
 if(!form.reportValidity())return;
 if(draft.entity==="family")validateFamilyFields(draft.record.fields);
 if(["product","use"].includes(draft.entity))validateFamilyValues(familyFields(),draft.record.field_values);
 const payload=copy(draft);status("Saving…");
 const result=await requestWorkshop("/api/workshop","POST",payload);
 dirty=false;editing=false;draft=null;
 await refresh();
 if(payload.entity==="family"){selectedFamily=result.record.id;selectedProduct="";selectedUse="";}
 if(payload.entity==="product"){selectedProduct=result.record.id;selectedUse="";}
 if(payload.entity==="use"){selectedUse=result.record.id;selectedProduct=result.record.product_id||"";}
 draft=null;updateLocation();renderNavigation();renderDetail();status("Saved.");
}
function editor(entity,title,record){
 const header=node("div","","panel-heading");header.append(node("h2",title));detail.append(header);
 const form=node("form");form.onsubmit=event=>{event.preventDefault();void run(()=>saveDraft(form));};
 const set=(key,value)=>{record[key]=value;mark();};
 if(entity==="family")renderFamilyEditor(form,record,set);
 if(entity==="product")renderProductEditor(form,record,set);
 if(entity==="use")renderUseEditor(form,record,set);
 const footer=actions(button("Save "+entity,()=>form.requestSubmit(),"button--primary"),button("Cancel",()=>{if(!mayLeave())return;dirty=false;editing=false;draft=null;renderDetail();}));footer.classList.add("form-actions");
 form.append(footer);detail.append(form);
 if(record.revision)renderAttachments(detail,entity,record.id,true);
 else header.append(help("Files & links","saveBeforeFiles"));
}
function renderFamilyEditor(form,record,set){
 const identity=panel("Family");
 identity.append(field("Family name",record.name,value=>set("name",value),{required:true}),field("Category",record.category_id||"",value=>set("category_id",value||null),{options:[{value:"",label:"Uncategorized"},...data.categories.filter(c=>!c.archived).map(c=>({value:c.id,label:categoryPath(c.id)}))]}),
  field("Kind",record.kind,value=>set("kind",value),{options:[{value:"part",label:"Part"},{value:"material",label:"Material"},{value:"tool",label:"Tool"}]}),field("Description",record.description,value=>set("description",value),{type:"textarea"}),field("Notes",record.notes,value=>set("notes",value),{type:"textarea"}));form.append(identity);
 const definitions=panel("Family fields","familyFields");
 const repaint=()=>{renderDetail();};
 record.fields.forEach((definition,index)=>{
  const row=node("fieldset","","field-definition");row.dataset.fieldId=definition.id;row.append(node("legend",definition.label||"New field"));
  if(definition.hidden){row.append(node("p","Hidden; stored values are retained.","muted"),button("Restore field",()=>{definition.hidden=0;mark();repaint();}));definitions.append(row);return;}
  const update=(key,value)=>{definition[key]=value;mark();};
  row.append(field("Field label",definition.label,value=>update("label",value),{required:true}),field("Unit",definition.unit,value=>update("unit",value)),field("Type",definition.type,value=>{update("type",value);repaint();},{options:[{value:"text",label:"Text"},{value:"number",label:"Number"},{value:"choice",label:"Choice"},{value:"boolean",label:"Yes / No"}]}));
  if(definition.type==="choice")row.append(field("Choices, one per line",definition.choices.join("\n"),value=>update("choices",value.split("\n").map(s=>s.trim()).filter(Boolean)),{type:"textarea"}));
  row.append(checkbox("Usually filled in for a project",definition.filled_on_use,value=>update("filled_on_use",value?1:0)));
  const move=offset=>{const next=index+offset;if(next<0||next>=record.fields.length)return;[record.fields[index],record.fields[next]]=[record.fields[next],record.fields[index]];mark();repaint();};
  row.append(actions(button("Move up",()=>move(-1),"button--quiet"),button("Move down",()=>move(1),"button--quiet"),button("Hide field",()=>{definition.hidden=1;mark();repaint();},"button--quiet")));definitions.append(row);
 });
 definitions.append(button("Add field",()=>{record.fields.push({id:crypto.randomUUID(),label:"New field",unit:"",type:"text",choices:[],hidden:0,filled_on_use:0});mark();repaint();}));form.append(definitions);
}
function renderProductEditor(form,record,set){
 const identity=panel("Product identity");
 identity.append(field("Product name",record.name,value=>set("name",value),{required:true}),field("Manufacturer",record.manufacturer,value=>set("manufacturer",value)),field("Manufacturer part number",record.mpn,value=>set("mpn",value)));
 form.append(identity);
 const specs=panel("Specifications");
 specs.append(checkbox("Show fields usually filled in for a project",showUseFields,value=>{showUseFields=value;renderDetail();}),valuesEditor(familyFields(),record.field_values,mark,{product:true,showUseFields}));form.append(specs);
 const ordering=panel("Supplier links");
 record.supplier_links.forEach((supplier,index)=>{
  const row=node("fieldset","","supplier-reference");row.append(node("legend","Supplier "+(index+1)));
  for(const [key,label] of [["supplier","Supplier"],["part_number","Supplier part number"],["url","Order URL"]])row.append(field(label,supplier[key]||"",value=>{supplier[key]=value;mark();},{type:key==="url"?"url":"text"}));
  row.append(button("Remove supplier link",()=>{record.supplier_links.splice(index,1);mark();renderDetail();},"button--quiet"));ordering.append(row);
 });
 ordering.append(button("Add supplier link",()=>{record.supplier_links.push({supplier:"",part_number:"",url:""});mark();renderDetail();}));form.append(ordering);
 const notes=panel("Notes");notes.append(field("Notes",record.notes,value=>set("notes",value),{type:"textarea"}));form.append(notes);
}
function renderUseEditor(form,record,set){
 const identity=panel("Project use","projectUse");
 identity.append(field("Project",record.project_id,value=>{set("project_id",value);record.tree_node_id=null;void loadAssemblyOptions();},{options:projects.map(p=>({value:p.id,label:p.name}))}),field("Purpose / project name",record.purpose,value=>set("purpose",value),{placeholder:family()?.name||"What is this part used for?"}),field("Quantity",record.quantity,value=>set("quantity",value),{type:"number"}),field("Unit",record.unit,value=>set("unit",value)));
 const assemblyHost=node("div");identity.append(assemblyHost);
 const loadAssemblyOptions=async()=>{
  const project=record.project_id;assemblyHost.replaceChildren(node("p","Loading assemblies…","muted"));
  try{const tree=await requestWorkshop("/api/tree?project="+encodeURIComponent(project));if(project!==record.project_id||!assemblyHost.isConnected)return;
   assemblyHost.replaceChildren(field("Assembly",record.tree_node_id||"",value=>set("tree_node_id",value||null),{options:[{value:"",label:"Project root"},...(tree.nodes||[]).filter(n=>n.kind!=="part").map(n=>({value:n.id,label:n.name}))]}));
  }catch(error){assemblyHost.replaceChildren(node("p",error.message,"error"));}
 };
 identity.append(field("Selected product",record.product_id||"",value=>{set("product_id",value||null);renderDetail();},{options:[{value:"",label:"No product selected — generic"},...data.products.filter(p=>p.family_id===selectedFamily&&(!p.archived||p.id===record.product_id)).map(p=>({value:p.id,label:p.name+(p.archived?" (archived)":"")}))]}));form.append(identity);
 const product=data.products.find(p=>p.id===record.product_id),requirements=panel("Project requirements","projectRequirements");
 requirements.append(valuesEditor(familyFields(),record.field_values,mark,{productValues:product?.field_values||{}}));form.append(requirements);
 const notes=panel("Use notes");notes.append(field("Notes",record.notes,value=>set("notes",value),{type:"textarea"}));form.append(notes);
 queueMicrotask(()=>void loadAssemblyOptions());
}
function categoryPath(id){const parts=[],seen=new Set();let current=data.categories.find(c=>c.id===id);while(current&&!seen.has(current.id)){seen.add(current.id);parts.unshift(current.name);current=data.categories.find(c=>c.id===current.parent_id);}return parts.join(" / ");}
function appendRead(host,label,value,options){const row=readValue(label,value,options);if(row)host.append(row);}
function renderDetail(){
 detail.replaceChildren();
 if(editing&&draft){editor(draft.entity,"Edit "+draft.entity,draft.record);return;}
 const selected=family();
 if(!selected)return;
 const product=data.products.find(p=>p.id===selectedProduct),use=data.uses.find(u=>u.id===selectedUse);
 const entity=use?"use":product?"product":"family",record=use||product||selected;
 const heading=node("div","","detail-heading");heading.append(node("p",categoryPath(selected.category_id),"eyebrow"),node("h2",use?use.purpose||selected.name:product?product.name:selected.name));
 const edit=()=>editOwner(entity,record);
 heading.append(actions(button("Edit "+entity,edit),button(record.archived?"Restore "+entity:"Archive "+entity,()=>void archive(entity,record),"button--quiet")));
 if(entity!=="family")heading.append(button("Family: "+selected.name,()=>changeSelection({familyId:selectedFamily}),"button--quiet"));
 if(record.archived)heading.append(node("p","Archived. Existing project references and file bytes are retained.","notice"));
 detail.append(heading);
 if(entity==="family")renderFamilyRead(selected);
 else renderInstanceRead(entity,record,selected,product);
}
function renderFamilyRead(record){
 const intro=panel("About this family");appendRead(intro,"Kind",record.kind);appendRead(intro,"Description",record.description);appendRead(intro,"Notes",record.notes);detail.append(intro);
 const fields=panel("Fields","fieldValues");
 const table=dataTable("Family fields",["Field","Unit","Type"]);
 for(const definition of familyFields().filter(f=>!f.hidden))table.append([definition.label+(definition.filled_on_use?" · usually entered in project":""),definition.unit,definition.type]);
 fields.append(table.root);detail.append(fields);
 renderKnowledge("family",record.id);
 const related=panel("Products");const list=node("div","","product-list");
 for(const product of data.products.filter(p=>p.family_id===record.id&&active(p)))list.append(button(product.name+(product.mpn?" · "+product.mpn:"")+(product.archived?" (archived)":""),()=>changeSelection({familyId:record.id,productId:product.id})));
 if(!list.children.length)list.append(node("p","No products yet.","empty"));
 related.append(list,actions(button("Add product",newProduct,"button--primary"),button("Use in a project",()=>void run(()=>newUse("")))));detail.append(related);
 detail.append(actions(button("Duplicate family",()=>{
  const duplicate={...copy(record),id:crypto.randomUUID(),name:record.name+" copy",fields:familyFields().map(field=>({...copy(field),id:crypto.randomUUID()}))};delete duplicate.revision;begin("family",duplicate);
 },"button--quiet")));
 renderAttachments(detail,"family",record.id,false);
 renderWorkshopProjectUses(detail,data,record.id,null,use=>changeSelection({familyId:record.id,useId:use.id,productId:use.product_id||""}),$("#show-archived").checked);
}
function renderInstanceRead(entity,record,selected,selectedProductRecord){
 const product=entity==="product"?record:data.products.find(p=>p.id===record.product_id);
 const identity=panel(entity==="use"?"Project use":"Product identity");
 if(entity==="use"){
  appendRead(identity,"Project",projects.find(p=>p.id===record.project_id)?.name||record.project_id);appendRead(identity,"Quantity",record.quantity);appendRead(identity,"Unit",record.unit);appendRead(identity,"Selected product",product?.name||"No product selected — generic");
  const open=node("a","Open project part","button");open.href="index.html#"+record.project_id+"/part/"+record.id;identity.append(open);
 }else{appendRead(identity,"Manufacturer",record.manufacturer);appendRead(identity,"Manufacturer part number",record.mpn);identity.append(button("Use in a project",()=>void run(()=>newUse(record.id)),"button--primary"));}
 detail.append(identity);
 const specs=panel(entity==="use"?"Product specifications & project requirements":"Specifications");
 let count=0;
 for(const resolved of resolveFamilyValues(familyFields(),product?.field_values||{},entity==="use"?record.field_values:{})){
  if(!present(resolved.value))continue;count++;
  const label=resolved.label+(resolved.unit?" ("+resolved.unit+")":""),row=readValue(label,resolved.value);
  if(resolved.different)row.lastChild.append(node("small","Project requirement: "+record.field_values[resolved.id]+(resolved.unit?" "+resolved.unit:"")+". Different values — review.","specification-note"));
  specs.append(row);
 }
 if(count)detail.append(specs);
 if(entity==="product"&&record.supplier_links.length){const suppliers=panel("Supplier links");for(const supplier of record.supplier_links){appendRead(suppliers,"Supplier",supplier.supplier);appendRead(suppliers,"Supplier part number",supplier.part_number);appendRead(suppliers,"Order URL",supplier.url,{url:true});}detail.append(suppliers);}
 if(record.notes){const notes=panel("Notes");notes.append(node("p",record.notes,"notes"));detail.append(notes);}
 if(entity==="use"){renderAttachments(detail,"family",selected.id,false);if(product)renderAttachments(detail,"product",product.id,false);}
 renderAttachments(detail,entity,record.id,false);
 renderKnowledge(entity,record.id);
 if(entity==="product")renderWorkshopProjectUses(detail,data,selected.id,record.id,use=>changeSelection({familyId:selected.id,useId:use.id,productId:record.id}),$("#show-archived").checked);
}
async function archive(entity,record){
 if(!window.confirm((record.archived?"Restore":"Archive")+" this "+entity+"? Existing project records and stored files are kept."))return;
 await run(async()=>{await requestWorkshop("/api/workshop","PATCH",{entity,id:record.id,expectedRevision:record.revision,archived:!record.archived});await refresh();renderDetail();status(record.archived?"Restored.":"Archived. You can restore it using Show archived.");});
}
function showCategoryMenu(x,y){
 const menu=$("#category-menu");menu.replaceChildren();
 for(const [label,action] of [["Add family",newFamily],["Add subcategory",()=>categoryDialog(false)],["Rename category",()=>categoryDialog(true)]]){const entry=button(label,()=>{menu.hidden=true;action();},"button--quiet");entry.setAttribute("role","menuitem");menu.append(entry);}
 menu.hidden=false;menu.style.left=Math.min(x,window.innerWidth-220)+"px";menu.style.top=Math.min(y,window.innerHeight-180)+"px";menu.querySelector("button").focus();
}
function categoryDialog(rename=false){
 const old=rename?data.categories.find(c=>c.id===selectedCategory):null;
 if(rename&&!old){status("Select a category to rename.",true);return;}
 dialog.replaceChildren(node("h2",rename?"Edit category":"Add category"));
 const record=old?copy(old):{id:crypto.randomUUID(),name:"",parent_id:selectedCategory||null,sort_order:0};
 const form=node("form");form.append(field("Category name",record.name,value=>{record.name=value;},{required:true}),field("Parent category",record.parent_id||"",value=>{record.parent_id=value||null;},{options:[{value:"",label:"Top level"},...data.categories.filter(c=>!c.archived&&c.id!==record.id).map(c=>({value:c.id,label:categoryPath(c.id)}))]}));
 const error=node("p","","error");error.setAttribute("role","alert");form.append(error,actions(button("Save category",()=>form.requestSubmit(),"button--primary"),button("Cancel",()=>dialog.close())));
 form.onsubmit=async event=>{event.preventDefault();try{await requestWorkshop("/api/workshop","POST",{entity:"category",record,expectedRevision:old?.revision??null});await refresh();dialog.close();status("Category saved.");}catch(problem){error.textContent=problem.message;}};
 if(old)form.append(button(old.archived?"Restore category":"Archive category",()=>{dialog.close();void archive("category",old);},"button--quiet"));
 dialog.append(form);dialog.showModal();
}
function editOwner(entity,record){
 const next=copy(record);if(entity==="family")next.fields=copy(familyFields());
 if(entity==="use"&&!projects.length){void run(async()=>{projects=(await requestWorkshop("/api/projects")).projects||[];begin(entity,next);});}else begin(entity,next);
}
function renderAttachments(host,ownerType,ownerId,canEdit){
 const files=data.attachments.filter(file=>!file.archived&&file[ownerType+"_id"]===ownerId);
 if(!files.length&&!canEdit)return;
 const section=panel("Files & links"),list=node("ul","","attachment-list");
 for(const file of files){const row=node("li"),link=node("a",file.title);link.href=file.url||"/api/workshop/file?id="+file.id;link.target="_blank";link.rel="noopener noreferrer";row.append(link);
  let image;if(file.kind==="photo"){image=node("img","","photo-thumb");image.src=link.href;image.alt=file.title;row.prepend(image);}
  if(canEdit){const archiveButton=button("Archive reference",()=>void run(async()=>{await requestWorkshop("/api/workshop","PATCH",{entity:"attachment",id:file.id,expectedRevision:file.revision,archived:true});await refresh();renderDetail();}),"button--quiet");if(image)window.BSPhotoEditor.actionBar(image,{content:archiveButton});else row.append(archiveButton);}else if(image){const owner=(ownerType==="family"?data.families:ownerType==="product"?data.products:data.uses).find(record=>record.id===ownerId);if(owner)window.BSPhotoEditor.actionBar(image,{content:button("Edit "+ownerType,()=>editOwner(ownerType,owner))});}list.append(row);
 }
 section.append(list);
 if(canEdit){
  const fileInput=node("input");fileInput.type="file";fileInput.multiple=true;fileInput.hidden=true;fileInput.accept="image/*,.pdf,.dwg,.dxf,.sldprt,.sldasm,.step,.stp,.stl,.iges,.igs,.zip,.csv,.txt";
  fileInput.onchange=()=>void run(async()=>{for(const file of fileInput.files){status("Uploading "+file.name+"…");const response=await fetch("/api/workshop/file?owner="+ownerType+"&id="+encodeURIComponent(ownerId),{method:"POST",credentials:"same-origin",headers:{"x-file-name":encodeURIComponent(file.name)},body:file});const value=await response.json();if(!response.ok)throw Error(value.error||"Upload failed");}await refresh();renderDetail();status("Files uploaded.");});
  section.append(actions(button("Upload files",()=>fileInput.click()),button("Add link",()=>attachmentDialog(ownerType,ownerId))),fileInput);
 }
 host.append(section);
}
function attachmentDialog(ownerType,ownerId){
 dialog.replaceChildren(node("h2","Add reference link"));const record={id:crypto.randomUUID(),owner_type:ownerType,owner_id:ownerId,title:"",url:"",kind:"document"};
 const form=node("form");form.append(field("Title","",value=>{record.title=value;},{required:true}),field("Link","",value=>{record.url=value;},{type:"url",required:true}),field("Purpose",record.kind,value=>{record.kind=value;},{options:["document","datasheet","pinout","photo","cad","manual","other"].map(value=>({value,label:value}))}));
 const error=node("p","","error");error.setAttribute("role","alert");form.append(error,actions(button("Save reference",()=>form.requestSubmit(),"button--primary"),button("Cancel",()=>dialog.close())));
 form.onsubmit=async event=>{event.preventDefault();try{await requestWorkshop("/api/workshop","POST",{entity:"attachment",record,expectedRevision:null});await refresh();dialog.close();renderDetail();}catch(problem){error.textContent=problem.message;}};
 dialog.append(form);dialog.showModal();
}
$("#add-family").onclick=newFamily;
$("#catalog-search").oninput=renderNavigation;
$("#show-archived").onchange=()=>{renderNavigation();renderDetail();};
$("#category-actions").onclick=event=>{const box=event.currentTarget.getBoundingClientRect();showCategoryMenu(box.left,box.bottom);};
document.addEventListener("click",event=>{if(!event.target.closest("#category-menu,#category-actions"))$("#category-menu").hidden=true;});
document.addEventListener("keydown",event=>{if(event.key==="Escape")$("#category-menu").hidden=true;});
$("#export-workshop").onclick=()=>{location.href="/api/workshop/export";};
projectReturnLink(params);
const returnHash=params.get("return")||"";
if(/^#[a-z0-9]+(?:\/(?:part|workspace|assembly|bom|parts)(?:\/[a-zA-Z0-9_-]+)?)?$/.test(returnHash)){const link=$("#return-project");link.hidden=false;link.href="index.html"+returnHash;}
window.addEventListener("beforeunload",event=>{if(dirty){event.preventDefault();event.returnValue="";}});
try{
 await refresh();selectedFamily=params.get("family")||"";selectedProduct=params.get("product")||"";selectedUse=params.get("use")||"";
 const use=data.uses.find(use=>use.id===selectedUse),product=data.products.find(product=>product.id===selectedProduct);
 if(use){selectedFamily=use.family_id;selectedProduct=use.product_id||"";}else if(product)selectedFamily=product.family_id;
 renderNavigation();renderDetail();
 if(params.get("edit")==="1"&&use){projects=(await requestWorkshop("/api/projects")).projects||[];begin("use",use);updateLocation();}
 await initProjectProductCopy({params,data,detail,status,onDraft(familyId,record){selectedFamily=familyId;selectedProduct="";selectedUse="";begin("product",record);dirty=true;status("Review the copied product, then Save product. The project part is unchanged.");}});
}catch(error){const failure=panel("Workshop unavailable");failure.append(node("p",error.message,"error"));detail.replaceChildren(failure,button("Try again",()=>location.reload()));const signIn=node("a","Open Projects to sign in");signIn.href="index.html#home";detail.append(signIn);status(error.message,true);}
