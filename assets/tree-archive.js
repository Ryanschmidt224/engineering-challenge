import {openHistoryEntryDialog,renderHistoryEntryDetails} from "./history-entry-dialog.js";
import {dialogForm} from "./dialog-form.js";
import {partHelp} from "./part-help.js";
import {renderRevisionSnapshot} from "./part-revisions.js";

export function initTreeArchive({project,root,host,canEdit,isPartNode,getSelected,getRevision,afterArchive,load,status,ui,dialogs}){
  // Intentional, parent-scoped history. The API snapshots a complete subtree
  // before removing active tree/BOM references. Revisions remain a separate tool.
  const archivedSection=ui.section({title:"Archive",role:"archive-folder",count:0,countLabel:["item","items"],tooltip:"View items removed from this assembly and restore archived items when available."});
  const archivePanel=archivedSection.root;
  const archiveList=document.createElement("div");
  archiveList.className="assembly-archived-list";
  archivedSection.body.classList.add("assembly-archived-disclosure");
  archivedSection.body.append(archiveList);
  host.append(archivePanel);
  let archiveRequestSerial=0;
  const archiveURL="/api/assembly-archive?project="+encodeURIComponent(project);
  const archiveFetch=async(url,init)=>{
   const response=await fetch(url,{credentials:"same-origin",cache:"no-store",...init});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(data.error||"Archive request failed");
   return data;
  };
  const archiveLocationLabel=item=>{
   const path=Array.isArray(item.originPath)?item.originPath:[];
   const text=path.length?path.map(segment=>(segment.partNumber?segment.partNumber+" · ":"")+segment.name).join(" / ")
    :"Original location not recorded";
   if(item.originPathSource==="legacy-current-parent")
    return {text,note:"Parent path reconstructed from its current location; original names may have changed."};
   if(item.originPathSource==="legacy-missing-parent")
    return {text,note:"Original parent was not recorded by the older archive format."};
   if(item.originPathSource==="legacy-root")
    return {text,note:"This archive predates original-location snapshots."};
   return {text,note:""};
  };
  const appendArchiveLocation=(target,item)=>{
   const origin=archiveLocationLabel(item);
   const line=document.createElement("div");line.className="assembly-archive-origin";
   const label=document.createElement("strong");label.textContent="Original location: ";
   const path=document.createElement("span");path.textContent=origin.text;
   line.append(label,path);
   if(origin.note){const caveat=document.createElement("small");caveat.textContent=origin.note;line.append(caveat)}
   target.append(line);
  };
  async function refreshAssemblyArchives(parentId){
   archivePanel.hidden=!canEdit();
   if(archivePanel.hidden)return;
   const serial=++archiveRequestSerial;
   archiveList.textContent="Loading archived items…";
   try{
    const result=await archiveFetch(archiveURL+"&parent="+encodeURIComponent(parentId));
    if(serial!==archiveRequestSerial)return;
    archivedSection.setCount(result.items.length);
    const history=host.closest('[data-section="history"]');
    if(history){history.dataset.archiveCount=result.items.length;const count=Number(history.dataset.recordCount||0)+result.items.length;history.querySelector('.workspace-archive-count').textContent="("+count+(count===1?" record)":" records)");}
    archiveList.replaceChildren();
    for(const item of result.items){
     const row=document.createElement("div");row.className="assembly-archived-row";
     const info=document.createElement("div");info.className="assembly-archive-row-info";
     const name=document.createElement("strong");
     name.textContent=(item.partNumber?item.partNumber+" · ":"")+item.name+" · "+(item.kind==="part"?"Part":"Subassembly")+(item.restoredAt?" · Restored":"");
     if(item.state==="deleting")name.textContent+=" · Delete incomplete";
     info.append(name);
     appendArchiveLocation(info,item);
     const meta=document.createElement("small");meta.className="assembly-archive-meta";
     meta.textContent="Archived "+new Date(item.archivedAt).toLocaleDateString();
     info.append(meta);
     const view=document.createElement("button");view.type="button";view.className="btn";view.textContent=item.kind==="part"?"View archived part":"View archived subassembly";
     view.onclick=()=>void viewAssemblyArchive(item.id);
     const controls=document.createElement("div");controls.className="assembly-archive-row-actions";
     controls.append(view);
     row.append(info,controls);archiveList.append(row);
    }
   }catch(error){if(serial===archiveRequestSerial)archiveList.textContent=error.message}
  }
  async function viewAssemblyArchive(id){
   try{
    const {archive}=await archiveFetch(archiveURL+"&id="+encodeURIComponent(id));
    const modal=dialogForm({title:archive.name+" — Archived",ui,cancelLabel:"Close",submitLabel:"Restore to build",onSubmit:canEdit()&&!archive.restoredAt&&archive.state!=="deleting"?async()=>{
     await archiveFetch(archiveURL,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"restore",id,expectedRevision:getRevision()})});await load();await refreshAssemblyArchives(getSelected()??"__root__");
    }:null});
    const dialog=modal.body;modal.dialog.classList.add("assembly-archive-dialog");
    const summary=document.createElement("p");
    summary.textContent="Archived "+new Date(archive.archivedAt).toLocaleString()+
      " · "+archive.nodes.length+" tree item(s) · "+(archive.displayParts||archive.parts).length+" part definition(s) · "+
      archive.investigations.length+" history record(s) · "+archive.assets.length+" saved files";
    renderHistoryEntryDetails(archive.entryDetails,dialog,{ui,archive:true,imageUrlFor:key=>archiveURL+"&id="+encodeURIComponent(id)+"&asset="+(archive.assets||[]).findIndex(asset=>asset.original===key)});
    appendArchiveLocation(dialog,archive);
    dialog.append(summary);
    if(archive.reason&&!archive.entryDetails?.whyChanged){const p=document.createElement("p");p.textContent="Reason: "+archive.reason;dialog.append(p)}
    const list=document.createElement("ul");
    for(const node of archive.nodes){
     const li=document.createElement("li");li.textContent=(node.partNumber?node.partNumber+" · ":"")+node.name+
      (node.kind==="part"?" (part)":" (subassembly)");list.append(li);
    }
    dialog.append(list);
    // An assembly can contain children that were archived before the assembly
    // itself. Keep that earlier history discoverable within the parent archive.
    if(archive.kind!=="part"){
     const children=await archiveFetch(archiveURL+"&parent="+encodeURIComponent(archive.nodeId)).catch(()=>({items:[]}));
     if(children.items.length){
      const nested=ui.section({title:"Previously archived children",count:children.items.length}),section=nested.body;
      for(const child of children.items){
       const row=document.createElement("div");row.className="assembly-archived-row";
       const info=document.createElement("div");info.className="assembly-archive-row-info";
       const label=document.createElement("strong");label.textContent=child.name;info.append(label);
       appendArchiveLocation(info,child);
       const open=document.createElement("button");open.type="button";open.className="btn";open.textContent="View";
       open.onclick=()=>void viewAssemblyArchive(child.id);
       row.append(info,open);section.append(row);
      }
      dialog.append(nested.root);
     }
    }
    const media=(archive.assets||[]).map((asset,index)=>({...asset,index})).filter(asset=>
     !asset.original.startsWith("photo-annotations/")&&!asset.original.startsWith("photo-renders/"));
    const images=media.filter(asset=>/\.(jpg|jpeg|png|webp|gif|heic|heif)$/i.test(asset.name||asset.original)||
     asset.original.startsWith("component-thumbnails/"));
    const documents=media.filter(asset=>!images.includes(asset)&&/^(part-files|part-pages|drawings|recipe-files|workshop-v2\/files)\//.test(asset.original));
    if(images.length){
     const photos=ui.section({title:"Saved photos",count:images.length,open:images.length<=12});
     const gallery=document.createElement("div");gallery.className="assembly-archive-gallery";
     for(const asset of images){
      const figure=document.createElement("figure");figure.className="assembly-archive-image";
      const image=document.createElement("img");image.loading="lazy";
      image.src=archiveURL+"&id="+encodeURIComponent(id)+"&asset="+asset.index;
      image.alt=asset.original.split("/").pop()||"Archived photo";figure.append(image);
      const caption=document.createElement("figcaption");caption.textContent=asset.original.split("/").pop();
      figure.append(caption);gallery.append(figure);
     }
     photos.body.append(gallery);dialog.append(photos.root);
    }
    if(documents.length){
     const docs=ui.section({title:"Saved documents",count:documents.length});
     const files=document.createElement("ul");
     for(const asset of documents){
      const li=document.createElement("li"),link=document.createElement("a");
      link.href=archiveURL+"&id="+encodeURIComponent(id)+"&asset="+asset.index;
      link.textContent=asset.name||asset.original.split("/").pop()||asset.original;
      link.download="";li.append(link);files.append(li);
     }
     docs.body.append(files);dialog.append(docs.root);
    }
    for(const node of archive.nodes){
     const saved=ui.section({title:node.name,role:"archived-item-details"});let loaded=false;
     saved.root.addEventListener("toggle",async()=>{
      if(!saved.root.open||loaded)return;loaded=true;saved.body.textContent="Loading saved details…";
      try{
       const owner=node.kind==="part"?node.partId:node.id,key=(node.kind==="part"?"part-workspaces/":"workspaces/")+project+"/"+owner+".json";
       const index=archive.assets.findIndex(asset=>asset.original===key);
       const response=index<0?null:await fetch(archiveURL+"&id="+encodeURIComponent(id)+"&asset="+index,{credentials:"same-origin",cache:"no-store"});
       if(response&&!response.ok)throw Error("Saved instructions are unavailable");
       const workspace=response?await response.json():{},part=node.kind==="part"?(archive.displayParts||archive.parts).find(part=>part.id===owner)||{name:node.name}:{name:node.name};
       saved.body.replaceChildren();renderRevisionSnapshot({part,workspace,records:archive.investigations.filter(record=>record.ownerId===owner&&!record.partSnapshot),assets:[]},saved.body,{project,ui});
      }catch(error){loaded=false;saved.body.textContent=error.message;}
     });dialog.append(saved.root);
    }
    if(canEdit())dialog.append(ui.button("Add to Project Milestones",()=>window.BSProjectMilestones?.offer(project,{kind:"archive",id:archive.id,title:archive.name,prefill:"Archived "+archive.name})));
    modal.open();
   }catch(error){status.textContent=error.message}
  }
  const archiveTreeItem=node=>{
   if(!node||!canEdit())return;
   const parent=node.parentId??null,expectedRevision=getRevision();
   openHistoryEntryDialog({trigger:root,project,title:isPartNode(node)?"Archive part":"Archive subassembly",description:partHelp.archive,submitLabel:isPartNode(node)?"Archive part":"Archive subassembly",archive:true,ui,photoEditor:window.BSPhotoEditor,onSave:async(entryDetails,operationId)=>{
    const result=await archiveFetch(archiveURL,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"archive",nodeId:node.id,expectedRevision,entryDetails,reason:entryDetails.whyChanged,operationId})});
    await afterArchive(result,parent,node);await refreshAssemblyArchives(parent??"__root__");
    archivedSection.root.open=true;host.closest('[data-section="history"]').open=true;
   }});
  };
  return {refresh:refreshAssemblyArchives,archive:archiveTreeItem};
}
