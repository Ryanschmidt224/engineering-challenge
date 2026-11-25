import {treeDropPlan} from "./project-tree-drag.js";
import {projectTree,MAX_SUBTREE} from "./project-tree-model.js";
import {node,checkbox,listCard,actions} from "./workshop-ui.js";
import {editItem,placementEditor} from "./project-editors.js";
import {workshopPartEditor} from "./project-workshop-editor.js";
import {partHistoryPrompt} from "./project-part-history.js";
import {contextMenu} from "./context-menu.js";
const button=(...args)=>window.BSUI.button(...args);
let addHintShown=false;const filterMemory=new Set();
function addWithHint(ctx,run){
 run();let seen=addHintShown;try{seen||=localStorage.getItem("bs-tree-add-hint")==="1";}catch{}
 if(seen)return;addHintShown=true;try{localStorage.setItem("bs-tree-add-hint","1");}catch{}
 const hint=node("div","","ui-inline-tip"),text=node("span","Tip: right-click the project or an assembly in the feature tree to add items there. The Add menu also works with a keyboard or touch.");hint.setAttribute("role","tooltip");hint.append(text,button("Got it",()=>hint.remove(),{variant:"quiet",small:true}));ctx.dialog.querySelector("form")?.prepend(hint);
}
async function archivePlacement(ctx,item,trigger){
 trigger.disabled=true;try{
  const preview=await ctx.client.request("/"+ctx.projectId+"/occurrences/"+ctx.occurrenceId+"/archive-preview");
  const form=partHistoryPrompt(ctx,item,trigger,{archive:true,expectedRevision:preview.revision}),area=node("div");
  area.append(node("p","Archive "+preview.members.length+" placement"+(preview.members.length===1?"":"s")+". Preview limit: "+MAX_SUBTREE+" placements per Archive action. Earlier archived children stay archived when this group is restored. No part revision is created."));
  if(preview.sharedPlacements)area.append(node("p","Other placements of "+preview.sharedPlacements+" shared part"+(preview.sharedPlacements===1?"":"s")+" remain active."));
  const list=node("ul");for(const member of preview.members)list.append(node("li",member.path.map(row=>row.name).join(" / ")+" · "+member.part_number));area.append(list);form.body.prepend(area);
 }catch(error){ctx.notify(error.message);}finally{trigger.disabled=false;}
}
export function renderProjectTree(ctx,{showHidden,onShowHidden,showDocuments=true,onShowDocuments=()=>{},showWorkshop=true,onShowWorkshop=()=>{},selectedOccurrence,collapsed=new Set()}){
 const state=ctx.client.state,tree=projectTree(state.items,state.occurrences),nav=node("nav","","project-tree");nav.setAttribute("aria-label","Feature tree");
 const addActions=parentId=>[{label:"Add custom part",run:()=>addWithHint(ctx,()=>editItem(ctx,null,null,{parentId}))},{label:"Add subassembly",run:()=>addWithHint(ctx,()=>editItem(ctx,null,null,{assembly:true,parentId}))},{label:"Add Workshop part",run:()=>addWithHint(ctx,()=>workshopPartEditor(ctx,{parentId}))},{label:"Add existing part placement",run:()=>addWithHint(ctx,()=>placementEditor(ctx,{parentId}))}];
 nav.append(node("h2","Feature tree","project-tree-heading"));
 const tools=node("div","","project-tree-tools"),add=button("Add",()=>contextMenu(add,null,addActions(null)),{variant:"quiet",small:true}),filters=node("details","","project-tree-filters"),filterTitle=node("summary","Show / hide","ui-button ui-button--quiet ui-button--small");add.setAttribute("aria-label","Add item");add.setAttribute("aria-haspopup","menu");filterTitle.setAttribute("aria-label","Tree display options");filterTitle.setAttribute("role","button");
 filters.open=filterMemory.has(ctx.projectId);filterTitle.setAttribute("aria-expanded",String(filters.open));filters.addEventListener("toggle",()=>{filterTitle.setAttribute("aria-expanded",String(filters.open));if(filters.open)filterMemory.add(ctx.projectId);else filterMemory.delete(ctx.projectId);});filters.append(filterTitle,checkbox("Show hidden parts",showHidden,onShowHidden),checkbox("Show documents",showDocuments,onShowDocuments),checkbox("Show Workshop items",showWorkshop,onShowWorkshop));tools.append(add,filters);nav.append(tools);
 let dragging=null,busy=false;
 const clearDrop=()=>{for(const row of nav.querySelectorAll("[data-drop-position]"))delete row.dataset.dropPosition;};
 function dropTarget(row,id,assembly=false){
  const position=event=>{if(!id)return "inside";const box=row.getBoundingClientRect(),ratio=(event.clientY-box.top)/box.height;return assembly&&ratio>0.25&&ratio<0.75?"inside":ratio<0.5?"before":"after";};
  row.ondragover=event=>{if(busy||!dragging||![...event.dataTransfer.types].includes("application/x-bs-placement"))return;event.preventDefault();event.stopPropagation();clearDrop();try{treeDropPlan(tree,dragging,id,position(event));row.dataset.dropPosition=position(event);event.dataTransfer.dropEffect="move";}catch{event.dataTransfer.dropEffect="none";}};
  row.ondragleave=()=>{delete row.dataset.dropPosition;};
  row.ondrop=async event=>{if(busy||!dragging)return;event.preventDefault();event.stopPropagation();const source=dragging;dragging=null;clearDrop();try{const plan=treeDropPlan(tree,source,id,position(event));if(!plan)return;busy=true;nav.setAttribute("aria-busy","true");await ctx.client.write(ctx.projectId,plan.path,plan.method,plan.data);await ctx.refresh();ctx.notify("Feature tree saved.");}catch(error){ctx.notify(error.message);}finally{busy=false;nav.removeAttribute("aria-busy");}};
 }
 nav.oncontextmenu=event=>{if(event.target.closest("button,input,label,summary"))return;event.preventDefault();contextMenu(add,event,addActions(null));};

 const root=node("p",state.project.name,"project-tree-project-name"),rootMore=button("⋯",()=>contextMenu(rootMore,null,addActions(null)),{variant:"quiet",small:true});rootMore.setAttribute("aria-label","Project tree actions");const rootRow=node("div","","project-tree-row");rootRow.append(root,rootMore);nav.append(rootRow);dropTarget(root,null,true);root.oncontextmenu=event=>{event.preventDefault();event.stopPropagation();contextMenu(rootMore,event,addActions(null));};
 async function move(occurrence,delta){
  const siblings=(tree.children.get(occurrence.parent_id||null)||[]).filter(tree.active),index=siblings.findIndex(row=>row.id===occurrence.id),ids=siblings.map(row=>row.id);[ids[index],ids[index+delta]]=[ids[index+delta],ids[index]];
  try{await ctx.client.write(ctx.projectId,"/occurrences/"+occurrence.id+"/reorder","POST",{ids});await ctx.refresh();}catch(error){ctx.notify(error.message);}
 }
 function children(parentId,host){
  const list=node("ul","","project-tree-children");for(const occurrence of tree.children.get(parentId)||[]){
   if(!tree.active(occurrence)||occurrence.hidden&&!showHidden)continue;const definition=tree.definitions.get(occurrence.item_id);if(!showDocuments&&definition.kind==="document"||!showWorkshop&&state.selections.some(selection=>selection.id===definition.id))continue;
   const item=tree.definitions.get(occurrence.item_id),local={...ctx,itemId:item.id,occurrenceId:occurrence.id},holder=node("li"),row=listCard("",()=>ctx.navigate(ctx.projectId,item.id,"part",occurrence.id)),title=node("strong"),mark=node("span",occurrence.attention?"!":occurrence.build_status==="complete"?"✓":"","ui-status-mark"+(occurrence.attention?" ui-status-mark--attention":occurrence.build_status==="complete"?" ui-status-mark--complete":""));
   mark.setAttribute("aria-label",occurrence.attention?"Needs attention":occurrence.build_status.replaceAll("_"," "));title.append(mark,node("span",item.part_number,"project-tree-number"),document.createTextNode(" "),node("span",(item.short_name||item.name)+(occurrence.quantity>1?" ("+occurrence.quantity+")":""),"project-tree-name"));row.append(title);row.setAttribute("aria-current",String(occurrence.id===selectedOccurrence));row.dataset.occurrenceId=occurrence.id;
   const more=button("⋯",()=>menu(),{variant:"quiet",small:true});more.setAttribute("aria-label","Actions for "+item.name);more.setAttribute("aria-haspopup","menu");
   const siblings=(tree.children.get(parentId)||[]).filter(tree.active),index=siblings.findIndex(row=>row.id===occurrence.id);
   let archiveTooLarge=false;try{tree.subtree(occurrence.id);}catch{archiveTooLarge=true;}
   const menu=event=>contextMenu(more,event,[...(item.is_assembly?addActions(occurrence.id):[]),{label:"Move placement",run:()=>placementEditor(local,{occurrence})},...(index>0?[{label:"Move up",run:()=>move(occurrence,-1)}]:[]),...(index<siblings.length-1?[{label:"Move down",run:()=>move(occurrence,1)}]:[]),{label:archiveTooLarge?"Archive subassembly (over "+MAX_SUBTREE+" placements)":item.is_assembly?"Archive subassembly":"Archive part",run:()=>archiveTooLarge?ctx.notify("Preview Archive is limited to "+MAX_SUBTREE+" placements per action. Archive smaller child groups first; nothing has changed."):archivePlacement(local,item,more)}]);
   row.draggable=true;row.title="Drag to reorder; drop onto an assembly to move inside. Right-click for actions.";
   row.ondragstart=event=>{if(busy){event.preventDefault();return;}dragging=occurrence.id;event.stopPropagation();event.dataTransfer.effectAllowed="move";event.dataTransfer.setData("application/x-bs-placement",occurrence.id);};row.ondragend=()=>{dragging=null;clearDrop();};dropTarget(row,occurrence.id,!!item.is_assembly);
   row.oncontextmenu=event=>{event.preventDefault();event.stopPropagation();menu(event);};row.onkeydown=event=>{if(event.key==="ContextMenu"||event.key==="F10"&&event.shiftKey){event.preventDefault();menu();}};const line=node("div","","project-tree-row"),expander=node("span","","project-tree-expander");line.append(expander,row,more);holder.append(line);if(item.is_assembly){const descendants=children(occurrence.id,holder),toggle=button(collapsed.has(occurrence.id)?"›":"⌄",()=>{descendants.hidden=!descendants.hidden;if(descendants.hidden)collapsed.add(occurrence.id);else collapsed.delete(occurrence.id);toggle.textContent=descendants.hidden?"›":"⌄";toggle.setAttribute("aria-expanded",String(!descendants.hidden));toggle.setAttribute("aria-label",(descendants.hidden?"Expand ":"Collapse ")+item.name);},{variant:"quiet",small:true});descendants.hidden=collapsed.has(occurrence.id);toggle.setAttribute("aria-label",(descendants.hidden?"Expand ":"Collapse ")+item.name);toggle.setAttribute("aria-expanded",String(!descendants.hidden));expander.append(toggle);}list.append(holder);
  }host.append(list);return list;
 }children(null,nav);return nav;
}
