import {projectTree} from "./project-tree-model.js";
import {node,checkbox,listCard,actions} from "./workshop-ui.js";
import {editItem,placementEditor} from "./project-editors.js";
import {workshopPartEditor} from "./project-workshop-editor.js";
import {partHistoryPrompt} from "./project-part-history.js";
import {contextMenu} from "./context-menu.js";
const button=(...args)=>window.BSUI.button(...args);
async function archivePlacement(ctx,item,trigger){
 trigger.disabled=true;try{
  const preview=await ctx.client.request("/"+ctx.projectId+"/occurrences/"+ctx.occurrenceId+"/archive-preview");
  const form=partHistoryPrompt(ctx,item,trigger,{archive:true,expectedRevision:preview.revision}),area=node("div");
  area.append(node("p","Archive "+preview.members.length+" placement"+(preview.members.length===1?"":"s")+". Earlier archived children stay archived when this group is restored. No part revision is created."));
  if(preview.sharedPlacements)area.append(node("p","Other placements of "+preview.sharedPlacements+" shared part"+(preview.sharedPlacements===1?"":"s")+" remain active."));
  const list=node("ul");for(const member of preview.members)list.append(node("li",member.path.map(row=>row.name).join(" / ")+" · "+member.part_number));area.append(list);form.body.prepend(area);
 }catch(error){ctx.notify(error.message);}finally{trigger.disabled=false;}
}
export function renderProjectTree(ctx,{showHidden,onShowHidden,selectedOccurrence,collapsed=new Set()}){
 const state=ctx.client.state,tree=projectTree(state.items,state.occurrences),nav=node("nav","","project-tree");nav.setAttribute("aria-label","Feature tree");
 const addActions=parentId=>[{label:"Add custom part",run:()=>editItem(ctx,null,null,{parentId})},{label:"Add subassembly",run:()=>editItem(ctx,null,null,{assembly:true,parentId})},{label:"Add Workshop part",run:()=>workshopPartEditor(ctx,{parentId})},{label:"Add existing part placement",run:()=>placementEditor(ctx,{parentId})}];
 nav.append(actions(button("Add custom part",()=>editItem(ctx),{variant:"primary"}),button("Add subassembly",()=>editItem(ctx,null,null,{assembly:true})),button("Add Workshop part",()=>workshopPartEditor(ctx))),checkbox("Show hidden parts",showHidden,onShowHidden));
 const root=listCard(state.project.name,()=>ctx.navigate(ctx.projectId)),rootMore=button("⋯",()=>contextMenu(rootMore,null,addActions(null)),{variant:"quiet",small:true});rootMore.setAttribute("aria-label","Project tree actions");const rootRow=node("div","","project-tree-row");rootRow.append(root,rootMore);nav.append(rootRow);root.oncontextmenu=event=>{event.preventDefault();contextMenu(rootMore,event,addActions(null));};
 async function move(occurrence,delta){
  const siblings=(tree.children.get(occurrence.parent_id||null)||[]).filter(tree.active),index=siblings.findIndex(row=>row.id===occurrence.id),ids=siblings.map(row=>row.id);[ids[index],ids[index+delta]]=[ids[index+delta],ids[index]];
  try{await ctx.client.write(ctx.projectId,"/occurrences/"+occurrence.id+"/reorder","POST",{ids});await ctx.refresh();}catch(error){ctx.notify(error.message);}
 }
 function children(parentId,host){
  const list=node("ul","","project-tree-children");for(const occurrence of tree.children.get(parentId)||[]){
   if(!tree.active(occurrence)||occurrence.hidden&&!showHidden)continue;
   const item=tree.definitions.get(occurrence.item_id),local={...ctx,itemId:item.id,occurrenceId:occurrence.id},holder=node("li"),row=listCard("",()=>ctx.navigate(ctx.projectId,item.id,"part",occurrence.id)),title=node("strong"),mark=node("span",occurrence.attention?"!":occurrence.build_status==="complete"?"✓":"","ui-status-mark"+(occurrence.attention?" ui-status-mark--attention":occurrence.build_status==="complete"?" ui-status-mark--complete":""));
   mark.setAttribute("aria-label",occurrence.attention?"Needs attention":occurrence.build_status.replaceAll("_"," "));title.append(mark,document.createTextNode((item.short_name||item.name)+(occurrence.quantity>1?" ("+occurrence.quantity+")":"")));row.append(title,node("small",item.part_number));row.setAttribute("aria-current",String(occurrence.id===selectedOccurrence));row.dataset.occurrenceId=occurrence.id;
   const more=button("⋯",()=>menu(),{variant:"quiet",small:true});more.setAttribute("aria-label","Actions for "+item.name);more.setAttribute("aria-haspopup","menu");
   const siblings=(tree.children.get(parentId)||[]).filter(tree.active),index=siblings.findIndex(row=>row.id===occurrence.id);
   const menu=event=>contextMenu(more,event,[...(item.is_assembly?addActions(occurrence.id):[]),{label:"Move placement",run:()=>placementEditor(local,{occurrence})},...(index>0?[{label:"Move up",run:()=>move(occurrence,-1)}]:[]),...(index<siblings.length-1?[{label:"Move down",run:()=>move(occurrence,1)}]:[]),{label:item.is_assembly?"Archive subassembly":"Archive part",run:()=>archivePlacement(local,item,more)}]);
   row.oncontextmenu=event=>{event.preventDefault();menu(event);};row.onkeydown=event=>{if(event.key==="ContextMenu"||event.key==="F10"&&event.shiftKey){event.preventDefault();menu();}};const line=node("div","","project-tree-row"),expander=node("span","","project-tree-expander");line.append(expander,row,more);holder.append(line);if(item.is_assembly){const descendants=children(occurrence.id,holder),toggle=button(collapsed.has(occurrence.id)?"›":"⌄",()=>{descendants.hidden=!descendants.hidden;if(descendants.hidden)collapsed.add(occurrence.id);else collapsed.delete(occurrence.id);toggle.textContent=descendants.hidden?"›":"⌄";toggle.setAttribute("aria-expanded",String(!descendants.hidden));toggle.setAttribute("aria-label",(descendants.hidden?"Expand ":"Collapse ")+item.name);},{variant:"quiet",small:true});descendants.hidden=collapsed.has(occurrence.id);toggle.setAttribute("aria-label",(descendants.hidden?"Expand ":"Collapse ")+item.name);toggle.setAttribute("aria-expanded",String(!descendants.hidden));expander.append(toggle);}list.append(holder);
  }host.append(list);return list;
 }children(null,nav);return nav;
}
