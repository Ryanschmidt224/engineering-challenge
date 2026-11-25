import {summaryAssembly} from "./project-root-view.js";
import {containerName} from "./project-presentation.js";
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
import {partPicture,projectPicture} from "./project-media.js";
import {workshopPartEditor,workshopSourceView} from "./project-workshop-editor.js";
import {projectCatalog} from "./project-catalog.js";
import {projectSummary} from "./project-summary.js";
import {renderProjectParts} from "./project-parts-view.js";
import {downloadProjectHTML} from "./project-html-export.js";
import {initProjectSignin} from "./project-signin.js";
const button=(...args)=>window.BSUI.button(...args);
export function initProjectWorkspace(root=document){
 const environment=root.querySelector("[data-project-environment]");if(environment)environment.textContent=["buildingschmidt.com","www.buildingschmidt.com"].includes(location.hostname)?"Private notebook":"Private preview";
 initSiteHeader();let needsSignin=false,signIn;const client=createProjectClient({fetcher:async(...args)=>{const response=await fetch(...args);if(response.status===401){needsSignin=true;notify("Your session has expired. Your draft is retained.");}return response;}}),content=root.querySelector("[data-project-content]"),heading=root.querySelector("[data-page-title]"),pageActions=root.querySelector("[data-page-actions]"),notice=root.querySelector("[data-notice]"),dialog=root.querySelector("[data-project-editor]"),historyMemos=new Map(),collapsedTree=new Set();let projectId=null,itemId=null,occurrenceId=null,renderSequence=0,showHidden=false,showDocuments=true,showWorkshop=true;
 const notify=(text,extra=null)=>{notice.replaceChildren(...(text?[node("span",text)]:[]));if(extra)notice.append(extra);if(needsSignin)notice.append(button("Log in again",()=>signIn()));};
 signIn=initProjectSignin({onSignIn:()=>{needsSignin=false;if(dialog.open)notify("Signed in. Your draft is retained. Save again when ready.");else void refresh();},onSignOut:()=>{needsSignin=true;dialog.close();void navigate();}});
 const ctx=()=>({client,projectId,itemId,occurrenceId,dialog,notify,refresh,navigate,signIn:()=>signIn(),openHistory,openArchive:()=>openHistory("",null,"archive")});
 async function navigate(id=null,item=null,view="part",occurrence=null){
  const url=new URL(location.href);url.search="";if(id)url.searchParams.set("project",id);if(item)url.searchParams.set("item",item);if(occurrence)url.searchParams.set("occurrence",occurrence);if(view!=="part")url.searchParams.set("view",view);history.pushState(null,"",url);return refresh({preview:!item&&view==="part"});
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
 function workInstructions(current,context=ctx()){
  return instructionView(context,current);
 }
 function engineeringFile(current,context=ctx()){
  const state=client.state,link=state.file_links.find(link=>link.item_id===current.id&&link.active),file=state.files.find(file=>file.id===link?.file_id),section=window.BSUI.section({title:"CAD files",count:file?1:0,countLabel:["file","files"],role:"engineering-file"}),input=node("input");input.type="file";input.setAttribute("aria-label","CAD file");
  const upload=button(file?"Replace CAD file":"Upload CAD file",async()=>{if(!input.files.length){notify("Choose a file first.");return;}upload.disabled=true;try{await client.upload(projectId,input.files[0],{itemId:current.id,occurrenceId:context.occurrenceId});await refresh();notify("CAD file saved. Earlier History keeps the earlier file.");}catch(error){notify(error.message);}finally{upload.disabled=false;}});
  window.BSUI.sectionActions(section.body,{primary:upload});section.body.append(input);if(file)section.body.append(fileLink(context,file));return {root:section.root,file};
 }
 async function renderPart(container,id,{placement=null,summary=false}={}){
  const sequence=renderSequence,state=client.state,item=state.items.find(row=>row.id===id),occ=state.occurrences.find(row=>row.item_id===id&&((placement||occurrenceId)?row.id===(placement||occurrenceId):row.removed_at===null));if(!item||!occ||occ.removed_at!==null){container.append(node("p","Choose an item from the feature tree, or find removed work in History."));return;}
  const context={...ctx(),itemId:item.id,occurrenceId:occ.id},fileArea=engineeringFile(item,context);
  if(!summary){const picture=partPicture(context,item,fileArea.file);
  const overview=node("section","","project-part-overview"),identity=node("div","","project-part-identity");
  identity.append(node("h2",containerName(item)),node("p",item.part_number+" · Revision "+(item.revision_level||1)+" (working draft)","muted"));
  if(item.short_name&&item.short_name!==item.name)identity.append(node("p",item.name,"project-part-subtitle"));
  overview.append(picture,identity);container.append(overview);
  const placementTree=projectTree(state.items,state.occurrences),shared=state.occurrences.filter(row=>row.item_id===item.id&&placementTree.active(row));identity.append(node("p",state.project.name+" / "+placementTree.path(occ).map(row=>row.name).join(" / "),"muted"));if(shared.length>1)identity.append(node("p","This part has "+shared.length+" active placements. Engineering details are shared; quantity and status belong to this location."));
  const headerControls=node("div","","project-build-controls");let buildBusy=false;
  const updateBuild=async patch=>{if(buildBusy)return;buildBusy=true;for(const control of headerControls.querySelectorAll("input,select"))control.disabled=true;const build={...buildFor(occ),...patch};await action("/occurrences/"+occ.id,{build},"Build information saved.","PATCH");buildBusy=false;for(const control of headerControls.querySelectorAll("input,select"))control.disabled=false;};
  const quantity=field("Quantity",occ.quantity,()=>{},{type:"number"});quantity.querySelector("input").onchange=event=>updateBuild({quantity:event.target.value===""?null:Number(event.target.value)});
  headerControls.append(field("Status",occ.build_status,value=>updateBuild({build_status:value}),{options:[{value:"not_started",label:"Not started"},{value:"in_progress",label:"In progress"},{value:"complete",label:"Complete"}]}),quantity,checkbox("Needs attention",!!occ.attention,value=>updateBuild({attention:value})));identity.append(headerControls);}
  const details=window.BSUI.section({title:summary?"Assembly details · "+item.part_number:"Part details",role:"details"}),duplicate=button("Duplicate part",()=>action("/items/"+item.id+"/duplicate",{},"Independent copy added."));
  const selected=state.selections.some(row=>row.id===item.id),copy=node("a","Copy to Workshop","ui-button");copy.href="workshop.html?"+new URLSearchParams({copyEngineProject:projectId,copyPart:item.id,returnProject:location.pathname+location.search});
  window.BSUI.sectionActions(details.body,{primary:button("Edit part details",()=>editItem(context,item,occ)),secondary:[...(!item.is_assembly?[duplicate]:[]),...(selected?[button("Change Workshop selection",()=>workshopPartEditor(context,{item}))]:item.kind==="part"&&!item.is_assembly?[copy]:[])]});details.body.append(information("Item identity",[["Item type",item.is_assembly?"Subassembly":item.kind],["Generic Part Name",containerName(item)],["Part number",item.part_number],["Purpose (optional)",item.fields.purpose]]),configurationView({snapshot:{item,occurrence:{...occ,root:{name:state.project.name}}}},"Part details",{includeBuild:false,includeContainer:false}),information("Display options",[["Quantity",occ.quantity+" "+occ.unit],["Status",occ.build_status.replaceAll("_"," ")],["Needs attention",occ.attention?"Yes":"No"],["Attention note",occ.attention_note],["Hide from feature tree?",occ.hidden?"Yes":"No"]]));container.append(details.root);const source=workshopSourceView(context,item);if(source)container.append(source);if(item.is_assembly&&!summary){const assembly=window.BSUI.section({title:"Subassembly",role:"subassembly"});assembly.body.append(button("Add custom part",()=>editItem(context,null,null,{parentId:occ.id})),button("Add subassembly",()=>editItem(context,null,null,{assembly:true,parentId:occ.id})),button("Add Workshop part",()=>workshopPartEditor(context,{parentId:occ.id})),button("Open subassembly BOM",()=>navigate(projectId,item.id,"bom",occ.id)),button("Open Archive",()=>openHistory(item.id,null,"archive")));container.append(assembly.root);}container.append(workInstructions(item,context),fileArea.root);
  const history=window.BSUI.section({title:summary?"Assembly history":"History",role:"item-history"});window.BSUI.sectionActions(history.body,{primary:button("Add entry",()=>editRecord(context)),secondary:[button("View all history",()=>openHistory(item.id))]});container.append(history.root);container.append(await partRevisions(context,item,{title:summary?"Assembly revisions":"Revisions",lazy:summary}));const loadHistory=async()=>{try{const count=await latestHistory(context,history.body);if(sequence===renderSequence)history.setCount(count);return true;}catch(error){if(sequence===renderSequence)notify(error.message);return false;}};if(summary){let loaded=false,busy=false;history.root.addEventListener("toggle",async()=>{if(!history.root.open||loaded||busy)return;busy=true;loaded=await loadHistory();busy=false;});}else await loadHistory();
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
  const legacy=node("a","Legacy projects","ui-button ui-button--quiet");legacy.href="/index.html?legacy=1#home";legacy.title="Open the previous project pages in read-only mode.";
  heading.textContent="Projects";pageActions.replaceChildren(button("New project",()=>projectSettings(ctx(),{create:true}),{variant:"primary"}),legacy);const area=node("div","","project-stack");content.replaceChildren(area);
  const sequence=renderSequence;area.append(node("p","Loading projects…","muted"));const {projects}=await client.request("");if(sequence!==renderSequence)return;area.replaceChildren(projectCatalog(ctx(),projects));
  const backup=window.BSUI.section({title:"Restore project backup",quiet:true});backup.body.append(node("p","Restore creates a separate project with independent files. Existing projects and saved historical context stay unchanged."),restorePicker());area.append(backup.root);
 }
 async function showWorkspace(state,sequence,url){
  if(itemId&&!occurrenceId)occurrenceId=state.occurrences.find(row=>row.item_id===itemId&&row.removed_at===null)?.id||null;
  heading.textContent=state.project.name;
   const exportLink=node("a","Export project","ui-button");exportLink.href="/api/project-engine/projects/"+projectId+"/export";
   const exportHTML=button("Export readable HTML",async()=>{const id=projectId;exportHTML.disabled=true;try{await downloadProjectHTML(id);notify("Readable HTML exported. Keep a .bsproject export for recovery.");}catch(error){notify(error.message);}finally{exportHTML.disabled=false;}});
   const view=url.searchParams.get("view")||"part",pages=node("nav","","project-navigation ui-navigation-list");pages.setAttribute("aria-label","Project pages");
   const summary=button("Project summary",()=>navigate(projectId)),parts=button("Parts Management",()=>navigate(projectId,null,"parts")),bom=button("Open BOM",()=>navigate(projectId,null,"bom")),historyButton=button("Project history",()=>openHistory());
   for(const [control,selected]of [[summary,!itemId&&view==="part"],[parts,view==="parts"],[bom,view==="bom"],[historyButton,view==="history"]])if(selected)control.setAttribute("aria-current","page");
   pages.append(summary,parts,bom,historyButton,button("Project settings",()=>projectSettings(ctx())),exportLink,exportHTML);
   pageActions.replaceChildren(button("All projects",()=>navigate()),...(["history","bom","parts"].includes(view)?[button("Back to build",()=>navigate(projectId))]:[]));
   const panes=node("div","","project-panes"),sidebar=node("aside","","project-sidebar"),tree=renderProjectTree(ctx(),{showHidden,onShowHidden:value=>{showHidden=value;void refresh();},showDocuments,onShowDocuments:value=>{showDocuments=value;void refresh();},showWorkshop,onShowWorkshop:value=>{showWorkshop=value;void refresh();},selectedOccurrence:occurrenceId,summarySelected:!itemId&&view==="part",collapsed:collapsedTree}),main=node("div","","project-main project-stack");sidebar.append(tree,pages);panes.append(sidebar,main);content.replaceChildren(panes);
   initSplitPanes(panes,{key:"project-workspace",panes:[{key:"tree",selector:".project-sidebar",name:"feature tree"}]});
   if(view==="history"){
    const memo=historyMemos.get(projectId)||{mode:"history",scope:itemId||"",type:"all",q:"",entries:[],cursor:null,selected:null,scroll:0};historyMemos.set(projectId,memo);main.append(createHistoryView(ctx(),memo));return;
   }
   if(view==="bom"){main.append(renderProjectBOM(ctx(),occurrenceId));return;}
   if(view==="parts"){main.append(renderProjectParts(ctx()));return;}
   if(itemId)await renderPart(main,itemId);else{
    const rootAssembly=summaryAssembly(projectTree(state.items,state.occurrences)),overview=node("section","","project-part-overview project-summary-overview"),identity=node("div","","project-part-identity");identity.append(node("h2","Project summary"));
    for(const [label,value]of [["Name",state.project.name],["Active parts",state.occurrences.filter(row=>row.removed_at===null).length],["Number format",state.project.prefix+"0".repeat(state.project.digits)]])identity.append(window.BSUI.fieldRow(label,String(value)).root);
    if(rootAssembly)identity.append(window.BSUI.fieldRow("Top assembly",rootAssembly.item.part_number+" · "+rootAssembly.item.name).root);
    overview.append(projectPicture(ctx(),{assembly:rootAssembly?.item}),identity);
    main.append(overview);if(rootAssembly)await renderPart(main,rootAssembly.item.id,{placement:rootAssembly.occurrence.id,summary:true});main.append(projectSummary(ctx()));
    const history=window.BSUI.section({title:"History",role:"project-history"}),archived=state.occurrences.filter(row=>row.removed_at!==null),folder=window.BSUI.section({title:"Archive",role:"archive-folder",count:archived.length+state.steps.filter(row=>row.retired_at).length});folder.body.append(button("Open Archive",()=>openHistory("",null,"archive")));history.body.append(folder.root);main.append(history.root);
   }
 }
 async function refresh({preview=false}={}){
  const sequence=++renderSequence,url=new URL(location.href);projectId=url.searchParams.get("project");itemId=url.searchParams.get("item");occurrenceId=url.searchParams.get("occurrence");
  let shownRevision=null;
  try{
   if(!projectId){await projectList();return;}
   if(preview&&client.state?.project.id===projectId){shownRevision=client.state.project.revision;await showWorkspace(client.state,sequence,url);notify("Refreshing project…");}
   const state=await client.load(projectId);if(sequence!==renderSequence)return;
   if(notice.textContent==="Refreshing project…")notify("");
   if(shownRevision===state.project.revision)return;
   await showWorkspace(state,sequence,url);

  }catch(error){if(sequence!==renderSequence)return false;notify(error.status===401?"Sign in with your owner account to open Projects.":error.message);content.replaceChildren(node("p",error.status===401?"Sign in through Account on this page.":"Projects could not be loaded."),button(error.status===401?"Sign in":"Try again",error.status===401?()=>signIn():()=>refresh()));return false;}
 }
 addEventListener("popstate",()=>void refresh());addEventListener("beforeunload",event=>{if(dialog.open){event.preventDefault();event.returnValue="";}});void refresh();
}
