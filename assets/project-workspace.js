import {initSiteHeader} from "./site-header.js";
import {createProjectClient} from "./project-client.js";
import {node,field,checkbox} from "./workshop-ui.js";
import {initSplitPanes} from "./split-panes.js";
import {detailsFor,buildFor,editItem,editRecord,projectSettings,confirmAction} from "./project-editors.js";
import {workInstructions as instructionView} from "./project-instructions.js";
import {information,configurationView,fileLink} from "./project-information.js";
import {createHistoryView,latestHistory} from "./project-history-view.js";
import {partRevisions,partHistoryPrompt} from "./project-part-history.js";
import {renderProjectTree} from "./project-tree-view.js";
import {projectTree} from "./project-tree-model.js";
import {renderProjectBOM} from "./project-bom-view.js";
import {workshopPartEditor,workshopSourceView} from "./project-workshop-editor.js";
import {projectCatalog} from "./project-catalog.js";
import {projectSummary} from "./project-summary.js";
import {renderProjectParts} from "./project-parts-view.js";
import {downloadProjectHTML} from "./project-html-export.js";
const button=(...args)=>window.BSUI.button(...args);
export function initProjectWorkspace(root=document){
 initSiteHeader();const client=createProjectClient(),content=root.querySelector("[data-project-content]"),heading=root.querySelector("[data-page-title]"),pageActions=root.querySelector("[data-page-actions]"),notice=root.querySelector("[data-notice]"),dialog=root.querySelector("[data-project-editor]"),historyMemos=new Map(),collapsedTree=new Set();let projectId=null,itemId=null,occurrenceId=null,renderSequence=0,showHidden=false;
 const notify=(text,extra=null)=>{notice.replaceChildren(node("span",text));if(extra)notice.append(extra);};
 const ctx=()=>({client,projectId,itemId,occurrenceId,dialog,notify,refresh,navigate,openHistory,openArchive:()=>openHistory("",null,"archive")});
 async function navigate(id=null,item=null,view="part",occurrence=null){
  const url=new URL(location.href);url.search="";if(id)url.searchParams.set("project",id);if(item)url.searchParams.set("item",item);if(occurrence)url.searchParams.set("occurrence",occurrence);if(view!=="part")url.searchParams.set("view",view);history.pushState(null,"",url);return refresh();
 }
 async function openHistory(scope=undefined,selected=undefined,mode="history"){
  const memo=historyMemos.get(projectId)||{mode:"history",scope:"",type:"all",q:"",entries:[],cursor:null,selected:null,scroll:0};
  if(scope!==undefined&&scope!==memo.scope||mode!==undefined&&mode!==memo.mode){memo.entries=[];memo.cursor=null;memo.scroll=0;memo.pageScroll=0;memo.selected=null;memo.detailOpen=false;}
  if(scope!==undefined)memo.scope=scope;if(mode!==undefined)memo.mode=mode;
  if(selected!==undefined){memo.selected=selected;memo.detailOpen=!!selected;if(selected){memo.type="all";memo.q="";}}
  historyMemos.set(projectId,memo);return navigate(projectId,memo.scope||null,"history");
 }
 async function action(path,data={},message="Saved.",method="POST",after=null){
  try{await client.write(projectId,path,method,data);await refresh();notify(message,after);}catch(error){notify(error.message);}
 }
 function workInstructions(current){
  return instructionView(ctx(),current);
 }
 function engineeringFile(current){
  const state=client.state,link=state.file_links.find(link=>link.item_id===current.id&&link.active),file=state.files.find(file=>file.id===link?.file_id),section=window.BSUI.section({title:"Engineering file",count:file?1:0,countLabel:["file","files"],role:"engineering-file"}),input=node("input");input.type="file";input.setAttribute("aria-label","Engineering file");
  const upload=button(file?"Replace engineering file":"Upload engineering file",async()=>{if(!input.files.length){notify("Choose a file first.");return;}upload.disabled=true;try{await client.upload(projectId,input.files[0],{itemId:current.id,occurrenceId});await refresh();notify("Engineering file saved. Earlier History keeps the earlier file.");}catch(error){notify(error.message);}finally{upload.disabled=false;}});
  window.BSUI.sectionActions(section.body,{primary:upload});section.body.append(input);if(file)section.body.append(fileLink(ctx(),file));return {root:section.root,file};
 }
 async function renderPart(container,id){
  const sequence=renderSequence,state=client.state,item=state.items.find(row=>row.id===id),occ=state.occurrences.find(row=>row.item_id===id&&(occurrenceId?row.id===occurrenceId:row.removed_at===null));if(!item||!occ||occ.removed_at!==null){container.append(node("p","Choose an item from the feature tree, or find removed work in History."));return;}
  const context=ctx(),fileArea=engineeringFile(item),picture=fileArea.file&&["image/jpeg","image/png","image/webp","image/gif","image/avif"].includes(fileArea.file.content_type)?node("img","","project-picture"):node("p","No picture yet","muted");if(picture.tagName==="IMG"){picture.src="/api/project-engine/projects/"+projectId+"/files/"+fileArea.file.id+"?inline=1";picture.alt=item.name;}
  container.append(node("h2",item.name),node("p",item.part_number+" · Revision "+(item.revision_level||1)+" (working draft)","muted"),picture);
  const placementTree=projectTree(state.items,state.occurrences),shared=state.occurrences.filter(row=>row.item_id===item.id&&placementTree.active(row));container.append(node("p",state.project.name+" / "+placementTree.path(occ).map(row=>row.name).join(" / "),"muted"));if(shared.length>1)container.append(node("p","This part has "+shared.length+" active placements. Engineering details are shared; quantity and status belong to this location."));
  const headerControls=node("div","","actions");let buildBusy=false;
  const updateBuild=async patch=>{if(buildBusy)return;buildBusy=true;for(const control of headerControls.querySelectorAll("input,select"))control.disabled=true;const build={...buildFor(occ),...patch};await action("/occurrences/"+occ.id,{build},"Build information saved.","PATCH");buildBusy=false;for(const control of headerControls.querySelectorAll("input,select"))control.disabled=false;};
  const quantity=field("Quantity",occ.quantity,()=>{},{type:"number"});quantity.querySelector("input").onchange=event=>updateBuild({quantity:event.target.value===""?null:Number(event.target.value)});
  headerControls.append(field("Status",occ.build_status,value=>updateBuild({build_status:value}),{options:[{value:"not_started",label:"Not started"},{value:"in_progress",label:"In progress"},{value:"complete",label:"Complete"}]}),quantity,checkbox("Needs attention",!!occ.attention,value=>updateBuild({attention:value})));container.append(headerControls);
  const details=window.BSUI.section({title:"Part details",role:"details"}),duplicate=button("Duplicate part",()=>action("/items/"+item.id+"/duplicate",{},"Independent copy added."));
  window.BSUI.sectionActions(details.body,{primary:button("Edit part details",()=>editItem(context,item,occ)),secondary:[...(!item.is_assembly?[duplicate]:[]),...(state.selections.some(row=>row.id===item.id)?[button("Change Workshop selection",()=>workshopPartEditor(context,{item}))]:[])]});details.body.append(configurationView({snapshot:{item,occurrence:{...occ,root:{name:state.project.name}}}},"Engineering details",{includeBuild:false}),information("Project information",[["Short tree name",item.short_name],["Quantity",occ.quantity+" "+occ.unit],["Status",occ.build_status.replaceAll("_"," ")],["Needs attention",occ.attention?"Yes":"No"],["Attention note",occ.attention_note],["Hidden in tree",occ.hidden?"Yes":"No"]]));container.append(details.root);const source=workshopSourceView(context,item);if(source)container.append(source);if(item.is_assembly){const assembly=window.BSUI.section({title:"Subassembly",role:"subassembly"});assembly.body.append(button("Add custom part",()=>editItem(context,null,null,{parentId:occ.id})),button("Add subassembly",()=>editItem(context,null,null,{assembly:true,parentId:occ.id})),button("Add Workshop part",()=>workshopPartEditor(context,{parentId:occ.id})),button("Open subassembly BOM",()=>navigate(projectId,item.id,"bom",occ.id)),button("Open Archive",()=>openHistory(item.id,null,"archive")));container.append(assembly.root);}container.append(workInstructions(item),fileArea.root);
  const history=window.BSUI.section({title:"History",role:"item-history"});window.BSUI.sectionActions(history.body,{primary:button("Add record",()=>editRecord(context)),secondary:[button("View all history",()=>openHistory(item.id))]});container.append(history.root);container.append(await partRevisions(context,item));try{const count=await latestHistory(context,history.body);if(sequence===renderSequence)history.setCount(count);}catch(error){if(sequence===renderSequence)notify(error.message);}
 }
 function restorePicker(){
  const input=node("input");input.type="file";input.accept=".bsproject,application/x-ndjson";input.setAttribute("aria-label","Project backup");
  let copyName="";const name=field("New project name",copyName,value=>copyName=value,{required:true}),nameInput=name.querySelector("input"),attempts=new WeakMap();
  const restore=button("Restore project backup",async()=>{
   if(!input.files.length){notify("Choose a project backup first.");return;}const title=copyName.trim();if(!title||title.length>180){notify("Enter a new project name of at most 180 characters.");nameInput.focus();return;}
   restore.disabled=true;input.disabled=true;nameInput.disabled=true;
   try{
    const file=input.files[0],first=(await file.slice(0,4*1024*1024).text()).split("\n")[0],manifest=JSON.parse(first).manifest;if(!manifest?.project?.id)throw Error("This file has no project manifest.");
    let attempt=attempts.get(file);if(!attempt||attempt.name!==title){attempt={name:title,projectId:crypto.randomUUID(),operationId:crypto.randomUUID()};attempts.set(file,attempt);}
    const result=await client.request("/"+attempt.projectId+"/import-copy?"+new URLSearchParams({name:title}),{method:"POST",headers:{"x-operation-id":attempt.operationId,"x-project-revision":"new"},body:file});
    await navigate(result.projectId);notify("Recovered copy created with "+result.verifiedFiles+" verified files.");
   }catch(error){notify(error.message);}finally{restore.disabled=false;input.disabled=false;nameInput.disabled=false;}
  });const body=node("div","","project-stack");body.append(name,input,restore);return body;
 }
 async function projectList(){
  heading.textContent="Projects";pageActions.replaceChildren(button("New project",()=>projectSettings(ctx(),{create:true}),{variant:"primary"}));const area=node("div","","project-stack");content.replaceChildren(area);
  const {projects}=await client.request("");area.append(projectCatalog(ctx(),projects));
  const backup=window.BSUI.section({title:"Restore project backup",quiet:true});backup.body.append(node("p","Restore creates a separate project with independent files. Existing projects and saved historical context stay unchanged."),restorePicker());area.append(backup.root);
 }
 async function refresh(){
  const sequence=++renderSequence,url=new URL(location.href);projectId=url.searchParams.get("project");itemId=url.searchParams.get("item");occurrenceId=url.searchParams.get("occurrence");
  try{
   if(!projectId){await projectList();return;}
   const state=await client.load(projectId);if(sequence!==renderSequence)return;heading.textContent=state.project.name;if(itemId&&!occurrenceId)occurrenceId=state.occurrences.find(row=>row.item_id===itemId&&row.removed_at===null)?.id||null;
   const exportLink=node("a","Export project","ui-button");exportLink.href="/api/project-engine/projects/"+projectId+"/export";
   const exportHTML=button("Export readable HTML",async()=>{const id=projectId;exportHTML.disabled=true;try{await downloadProjectHTML(id);notify("Readable HTML exported. Keep a .bsproject export for recovery.");}catch(error){notify(error.message);}finally{exportHTML.disabled=false;}});
   pageActions.replaceChildren(button("All projects",()=>navigate()),...(["history","bom","parts"].includes(url.searchParams.get("view"))?[button("Back to build",()=>navigate(projectId))]:[]),button("Project settings",()=>projectSettings(ctx())),button("Project history",()=>openHistory()),button("Parts Management",()=>navigate(projectId,null,"parts")),button("Open BOM",()=>navigate(projectId,null,"bom")),exportLink,exportHTML);
   if(url.searchParams.get("view")==="history"){
    const memo=historyMemos.get(projectId)||{mode:"history",scope:itemId||"",type:"all",q:"",entries:[],cursor:null,selected:null,scroll:0};historyMemos.set(projectId,memo);content.replaceChildren(createHistoryView(ctx(),memo));return;
   }
   if(url.searchParams.get("view")==="bom"){content.replaceChildren(renderProjectBOM(ctx(),occurrenceId));return;}
   if(url.searchParams.get("view")==="parts"){content.replaceChildren(renderProjectParts(ctx()));return;}
   const panes=node("div","","project-panes"),tree=renderProjectTree(ctx(),{showHidden,onShowHidden:value=>{showHidden=value;void refresh();},selectedOccurrence:occurrenceId,collapsed:collapsedTree}),main=node("div","","project-main project-stack");panes.append(tree,main);content.replaceChildren(panes);
   initSplitPanes(panes,{key:"project-workspace",panes:[{key:"tree",selector:".project-tree",name:"feature tree"}]});
   if(itemId)await renderPart(main,itemId);else{
    main.append(information("Project",[["Name",state.project.name],["Active parts",state.occurrences.filter(row=>row.removed_at===null).length],["Number format",state.project.prefix+"0".repeat(state.project.digits)]]),projectSummary(ctx()),node("p","Choose a part to view its details, work instructions and History."));
    const history=window.BSUI.section({title:"History",role:"project-history"}),archived=state.occurrences.filter(row=>row.removed_at!==null),folder=window.BSUI.section({title:"Archive",role:"archive-folder",count:archived.length+state.steps.filter(row=>row.retired_at).length});folder.body.append(button("Open Archive",()=>openHistory("",null,"archive")));history.body.append(folder.root);main.append(history.root);
   }
  }catch(error){notify(error.status===401?"Sign in through Account on Projects, then return to this preview.":error.message);return false;}
 }
 addEventListener("popstate",()=>void refresh());addEventListener("beforeunload",event=>{if(dialog.open){event.preventDefault();event.returnValue="";}});void refresh();
}
