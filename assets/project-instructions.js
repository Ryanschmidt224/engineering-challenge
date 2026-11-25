import {node} from "./workshop-ui.js";
import {instructionTree,recordTree} from "./project-instruction-model.js";
import {editStep,editRecord,retireInstruction} from "./project-editors.js";
import {partHistoryPrompt} from "./project-part-history.js";
import {recordVersionView,savedPartView} from "./project-information.js";
import {initSplitPanes} from "./split-panes.js";

const button=(...args)=>window.BSUI.button(...args);
function ordering(header,id,ids,index,save,type){
 const move=delta=>{const next=[...ids],to=index+delta;if(to<0||to>=next.length)return;[next[index],next[to]]=[next[to],next[index]];return save(next);};
 header.draggable=true;header.addEventListener("dragstart",event=>{event.stopPropagation();event.dataTransfer.setData(type,id);});
 header.addEventListener("dragover",event=>{if([...event.dataTransfer.types].includes(type)){event.preventDefault();event.stopPropagation();}});
 header.addEventListener("drop",event=>{const source=event.dataTransfer.getData(type);if(!ids.includes(source)||source===id)return;event.preventDefault();event.stopPropagation();const next=ids.filter(value=>value!==source);next.splice(next.indexOf(id),0,source);save(next);});
 header.addEventListener("keydown",event=>{if(event.altKey&&["ArrowUp","ArrowDown"].includes(event.key)){event.preventDefault();event.stopPropagation();move(event.key==="ArrowUp"?-1:1);}});
 header.title="Drag to reorder among siblings, or focus this header and press Alt + Up/Down.";
 return [...(index?[button("Move up",()=>move(-1),{variant:"quiet"})]:[]),...(index<ids.length-1?[button("Move down",()=>move(1),{variant:"quiet"})]:[])];
}
function revisions(ctx,item,step){
 const section=window.BSUI.section({title:"Instruction revisions",role:"instruction-revisions",countLabel:["saved","saved"]}),list=node("div"),status=node("p"),more=button("Load earlier instruction revisions",()=>load());status.setAttribute("role","status");more.hidden=true;
 const create=button("Create a Revision",()=>partHistoryPrompt(ctx,item,create,{scope:step,path:"/steps/"+step.id+"/revisions"}));section.body.append(node("p","Working revision "+step.revision_level,"muted"),create,list,status,more);
 let cursor=null,loaded=false,busy=false;const seen=new Set();
 async function load(){if(busy)return;busy=true;more.disabled=true;try{const query=new URLSearchParams({instruction:step.id,type:"instruction_revisions",limit:"20",...(cursor?{cursor}:{})}),page=await ctx.client.request("/"+ctx.projectId+"/history?"+query);cursor=page.nextCursor;section.setCount(page.total);for(const event of page.entries){if(seen.has(event.id))continue;seen.add(event.id);const entry=window.BSUI.section({title:"Revision "+event.payload.level,role:"instruction-revision"}),date=node("time",event.created_at.slice(0,10),"ui-revision-date");date.dateTime=event.created_at;entry.count.remove();entry.aside.remove();entry.header.classList.add("ui-revision-header");entry.header.append(date,node("span",event.payload.entryDetails?.whatChanged||"","ui-revision-change"));let opened=false,reading=false;entry.root.addEventListener("toggle",async()=>{if(!entry.root.open||opened||reading)return;reading=true;try{const detail=await ctx.client.request("/"+ctx.projectId+"/history/"+event.id);entry.body.replaceChildren(savedPartView(ctx,detail.event));opened=true;}catch(error){entry.body.replaceChildren(node("p",error.message));}finally{reading=false;}});list.append(entry.root);}more.hidden=!cursor;loaded=true;status.textContent=page.total?"":"No saved instruction revisions.";}catch(error){status.textContent=error.message;}finally{busy=false;more.disabled=false;}}
 section.root.addEventListener("toggle",()=>{if(section.root.open&&!loaded)load();});return section.root;
}
export function workInstructions(ctx,item){
 const state=ctx.client.state,tree=instructionTree(state.steps.filter(row=>row.item_id===item.id)),active=[...tree.byId.values()].filter(tree.active),section=window.BSUI.section({title:"Work instructions",count:active.length,countLabel:["scope","scopes"],role:"work-instructions"});
 const action=async(path,data)=>{try{await ctx.client.write(ctx.projectId,path,"POST",data);await ctx.refresh();ctx.notify("Saved.");}catch(error){ctx.notify(error.message);}};
 window.BSUI.sectionActions(section.body,{primary:button("Add step",()=>editStep(ctx)),secondary:[button("Add instruction group",()=>editStep(ctx,null,{isGroup:true}))]});
 function render(parentId,holder,only=null){
  const siblings=tree.children(parentId).filter(tree.active),ids=siblings.map(row=>row.id);
  for(const [index,step]of siblings.entries()){
   if(only&&step.id!==only)continue;
   const block=window.BSUI.section({title:step.title,role:step.is_group?"instruction-group":"step"}),save=ids=>action("/items/"+item.id+"/steps/reorder",{ids,parentId}),order=ordering(block.header,step.id,ids,index,save,"application/x-bs-instruction");
   const records=state.records.filter(row=>row.step_id===step.id).sort((a,b)=>a.sort_order-b.sort_order||a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));block.setCount(records.length);block.body.append(node("p",step.body,"project-instruction-text"));
   window.BSUI.sectionActions(block.body,{primary:button("Add entry",()=>editRecord(ctx,{stepId:step.id})),secondary:[button("Edit step",()=>editStep(ctx,step)),...(step.is_group?[button("Add child instruction",()=>editStep(ctx,null,{parentId:step.id})),button("Add child group",()=>editStep(ctx,null,{parentId:step.id,isGroup:true}))]:[]),...order,button("Archive step",()=>retireInstruction(ctx,step),{variant:"quiet"})]});
   const entries=recordTree(records);
   function renderRecords(parentRecordId,holder){const siblings=entries.children(parentRecordId);for(const [recordIndex,record]of siblings.entries()){
    const entry=window.BSUI.section({title:record.title,role:"instruction-record"}),fileIds=state.file_links.filter(link=>link.record_id===record.id&&link.active).map(link=>link.file_id),event=state.record_events.find(event=>event.record_id===record.id);
    entry.body.append(recordVersionView(ctx,{...record,fileIds},"Record",state.files));const order=ordering(entry.header,record.id,siblings.map(row=>row.id),recordIndex,ids=>action("/steps/"+step.id+"/reorder-records",{ids,parentRecordId}),"application/x-bs-record");window.BSUI.sectionActions(entry.body,{primary:button("Edit entry",()=>editRecord(ctx,{record})),secondary:[button("Add nested entry",()=>editRecord(ctx,{stepId:step.id,parentRecordId:record.id})),...(event?[button("View tested configuration and history",()=>ctx.openHistory(item.id,event.id),{variant:"quiet"})]:[]),...order]});renderRecords(record.id,entry.body);holder.append(entry.root);
   }}renderRecords(null,block.body);
   render(step.id,block.body);block.body.append(revisions(ctx,item,step));holder.append(block.root);
  }
 }
 const panes=node("div","","project-panes project-instruction-panes"),list=node("nav","","project-instruction-list project-stack ui-navigation-list"),detail=node("div","","project-main project-stack");list.setAttribute("aria-label","Instruction list");panes.append(list,detail);section.body.append(panes);let selected=null;
 const choose=value=>{selected=value;for(const button of list.querySelectorAll("button"))button.setAttribute("aria-current",String(button.dataset.instruction===(selected||"")));detail.replaceChildren();render(null,detail,selected);};
 const addChoice=(title,id)=>{const entry=button(title,()=>choose(id),{variant:"quiet"});entry.dataset.instruction=id||"";entry.setAttribute("aria-label",id?"Show instruction "+title:title);list.append(entry);};addChoice("All instructions",null);for(const step of tree.children(null).filter(tree.active))addChoice(step.title,step.id);choose(null);initSplitPanes(panes,{key:"project-instructions",panes:[{key:"instructions",selector:".project-instruction-list",name:"instruction list"}]});
 const retired=[...tree.byId.values()].filter(row=>row.retired_at&&(!row.parent_id||tree.active(tree.byId.get(row.parent_id))));
 if(retired.length){const archive=window.BSUI.section({title:"Archived instructions",role:"instruction-archive",count:retired.length});for(const step of retired)archive.body.append(node("p",step.title),node("p",step.archive_reason||"","project-instruction-text"),button("Restore "+step.title,()=>action("/steps/"+step.id+"/restore",{})),revisions(ctx,item,step));section.body.append(archive.root);}
 return section.root;
}
