import {partHelp} from "./part-help.js";
import {renderHistoryEntryDetails} from "./history-entry-dialog.js";
import {openLegacyHistoryEntryDialog as openHistoryEntryDialog} from "./legacy-history-dialog.js";

const make=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
const revisionUrl=(project,id,extra={})=>"/api/investigations?"+new URLSearchParams({project,revision:id,...extra});

// One section and one in-flight command per part page. A failed/lost response
// retains its operation ID so Retry cannot publish a second historical copy.
export function initPartRevisions({host,project,ui,dialogs,canEdit,beforeCreate,onSaved}){
 const section=ui.section({title:"Revisions",role:"part-revisions",count:0,countLabel:["saved","saved"]});
 section.root.hidden=true;
 const working=make("span");working.className="ui-section__meta";section.aside.append(working);
 const list=make("div"),message=make("p");message.setAttribute("role","status");message.setAttribute("aria-live","polite");
 const openRevisions=new Set();let current=null,lastPartId=null;
 const create=ui.button("Create a Revision",()=>{
  if(!current||!canEdit())return;
  try{beforeCreate();}catch(error){message.textContent=error.message;return;}
  const state=current,part=state.part,source=state.getSource();
  openHistoryEntryDialog({trigger:create,project,title:"Create a Revision",description:partHelp.revisions,submitLabel:"Save revision",ui,photoEditor:window.BSPhotoEditor,onSave:async(entryDetails,operationId)=>{
   beforeCreate();
   const result=await state.save({action:"createPartRevision",partId:part.id,operationId,entryDetails,expectedPartRevision:source.partRevision,expectedWorkspaceRevision:source.workspaceRevision});
   await onSaved(result.component);
   if(current?.part.id===part.id)message.textContent="Revision created. The working part has advanced to revision "+(result.component.revisionLevel||1)+". Use Edit part details when you are ready to make changes.";
  }});
 });
 create.title=partHelp.revisions;
 ui.sectionActions(section.body,{primary:create});section.body.append(list,message);
 const controller={render(state){
  if(state.part&&lastPartId!==state.part.id){message.textContent="";section.root.open=false;lastPartId=state.part.id;}
  current=state.part?state:null;section.root.hidden=!current;
  if(!current)return;
  create.hidden=!canEdit();
  section.setCount(state.records.length);list.replaceChildren();
  working.textContent="Working revision "+(state.part.revisionLevel||1);
  for(const record of [...state.records].reverse()){
   const item=ui.section({title:record.partSnapshot.part.revisionLevel?"Revision "+record.partSnapshot.part.revisionLevel:record.title||"Earlier saved copy",role:"part-revision",open:openRevisions.has(record.id)});
   const date=make("time",record.date||record.createdAt?.slice(0,10)||record.archivedAt?.slice(0,10)||"");date.className="ui-revision-date";date.dateTime=date.textContent;
   const changed=make("span",record.partSnapshot.entryDetails?.whatChanged||record.archiveNote||"");changed.className="ui-revision-change";
   item.header.classList.add("ui-revision-header");item.header.append(date,changed);
   item.root.addEventListener("toggle",()=>{if(item.root.open)openRevisions.add(record.id);else openRevisions.delete(record.id);});
   renderHistoryEntryDetails(record.partSnapshot.entryDetails,item.body,{ui,imageUrlFor:id=>{const index=record.partSnapshot.assets?.findIndex(asset=>asset.original===id);return index>=0?revisionUrl(project,record.id,{asset:String(index),view:"1"}):"/api/recipe-files?id="+encodeURIComponent(id);}});
   renderRevisionSnapshot(record.partSnapshot,item.body,{project,revisionId:record.id,ui});
   if(record.archiveNote)item.body.prepend(make("p","Reason: "+record.archiveNote));
   if(canEdit()){
    const remove=ui.button("Delete revision",async()=>{
     if(!await dialogs.danger('Delete revision "'+record.title+'"? This permanently removes the historical record.',{title:"Delete revision?",confirmLabel:"Delete revision"}))return;
     remove.disabled=true;
     try{await state.save({action:"deleteRecord",id:record.id});await onSaved();}
     catch(error){message.textContent=error.message;remove.disabled=false;}
    },{variant:"danger"});
    item.body.append(remove);
   }
   list.append(item.root);
  }
  // Other part sections can mount later; keep revisions at the page bottom.
  host.append(section.root);
 }};
 host.append(section.root);return controller;
}

export function renderRevisionSnapshot(snapshot,target,{project,revisionId,ui}){
 const panel=ui.informationPanel("Saved part information");
 const part=snapshot.part||{},workspace=snapshot.workspace||{};
 const labels={name:"Part name",partNumber:"Part number",description:"Purpose",manufacturer:"Manufacturer",model:"Manufacturer part number",supplier:"Supplier",asin:"ASIN",historicalPurchasePrice:"Recorded purchase price",quantity:"Quantity",quantityUnit:"Quantity unit",partType:"Part type",progressStatus:"Status"};
 for(const [key,label] of Object.entries(labels))if(part[key]!==undefined&&part[key]!==null&&String(part[key])){
  const value=key==="progressStatus"?({not_started:"Not started",in_progress:"In progress",complete:"Complete"})[part[key]]||part[key]:part[key];panel.body.append(ui.fieldRow(label,value).root);
 }
 for(const spec of part.specifications||[])panel.body.append(ui.fieldRow(spec.name,spec.value+(spec.unit?" "+spec.unit:"")).root);
 if(snapshot.thumbnailKey){const image=make("img");image.className="investigation-image";image.alt="Saved part photograph";image.loading="lazy";const photo=snapshot.assets?.findIndex(file=>file.archive===snapshot.thumbnailKey);image.src=photo>=0?revisionUrl(project,revisionId,{asset:String(photo),view:"1"}):"/api/investigations?"+new URLSearchParams({project,thumbnail:snapshot.thumbnailKey});panel.body.append(image);}
 const steps=workspace.recipe||[];
 if(steps.length){
  panel.body.append(make("h3","Saved Work Instructions"));
  for(const step of steps){
   const block=make("section");block.append(make("h4",step.title||"Step"));
   for(const text of [step.standard,step.detail,...(step.notes||[])])if(text)block.append(make("p",text));
   panel.body.append(block);
  }
 }
 if(snapshot.records?.length){
  panel.body.append(make("h3","Saved tests and records"));
  for(const record of snapshot.records){
   const block=make("section");block.append(make("h4",record.title||record.category||"Record"));
   if(record.description)block.append(make("p",record.description));
   for(const entry of [...(record.entries||[]),...(record.notes||[])])if(entry.text)block.append(ui.fieldRow(entry.descriptor||entry.type.charAt(0).toUpperCase()+entry.type.slice(1),entry.text).root);
   panel.body.append(block);
  }
 }
 for(const experiment of workspace.experiments||[])if(experiment.text)panel.body.append(ui.fieldRow("Saved test note",experiment.text).root);
 const files=make("div");
 for(const [index,asset] of (snapshot.assets||[]).entries()){
  if(!/^(?:part-files|part-pages|drawings|recipe-files|workshop-v2\/files)\//.test(asset.original)&&!asset.original.startsWith(project+"/"))continue;
  const link=make("a",asset.name||asset.original.split("/").pop());link.href=revisionUrl(project,revisionId,{asset:String(index)});link.className="investigation-file";files.append(link);
 }
 if(files.childElementCount){panel.body.append(make("h3","Saved files"),files);}
 if(!snapshot.assets){
  panel.body.append(make("p","This older revision did not preserve separate copies of its attached file bytes. Original attachment links may reflect later changes."));
  // Older saved copies never froze file bytes. Keep their existing attachment
  // access without presenting those links as immutable revision files.
  for(const step of steps)for(const file of step.photos||[]){const link=make("a",step.photoNames?.[file]||"Original instruction attachment (legacy link)");link.href=file.startsWith("recipe-files/")?"/api/recipe-files?id="+encodeURIComponent(file):"/api/photo?id="+encodeURIComponent(file);panel.body.append(link);}
 }
 if(revisionId){const download=make("a","Download revision data"),row=make("p");download.href=revisionUrl(project,revisionId,{download:"1"});row.append(download);panel.body.append(row);}
 target.append(panel.root);
}
