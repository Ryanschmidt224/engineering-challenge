import {information,configurationView,fileLink,savedPartView,buildContextView,recordVersionView} from "./project-information.js";
import {node,field,actions,listCard} from "./workshop-ui.js";
import {formatRevisionValue} from "./project-item-model.js";
import {recordLabels,recordPrompts} from "./project-record-model.js";
import {projectHelp} from "./project-help.js";
import {initSplitPanes} from "./split-panes.js";
import {editRecord,confirmAction} from "./project-editors.js";
import {instructionTree} from "./project-instruction-model.js";
const button=(...args)=>window.BSUI.button(...args);
export const eventLabels={...recordLabels,instruction_revision:"Instruction revision",record_edited:"Record edited",revision:"Revision",archived:"Archived",file_replaced:"File change",removed:"Removed",restored:"Restored",step_retired:"Step retired",step_restored:"Step restored"};

function entryCard(entry,select){
 const row=listCard("",select);row.append(node("strong",entry.display_title||entry.title),node("small",(eventLabels[entry.display_type||entry.type]||entry.type)+" · "+(entry.source_name||"")),node("span",entry.outcome||entry.summary||""),node("small",new Date(entry.created_at).toLocaleString()));row.dataset.eventId=entry.id;return row;
}
export async function showEvent(ctx,id,container){
 const detail=await ctx.client.request("/"+ctx.projectId+"/history/"+id),{event,record,configurations,attachments,recordContext}=detail,body=node("div","","project-stack");
 body.append(node("h2",record?.title||event.title),node("p",(eventLabels[record?.type||event.type]||event.type)+" · "+(event.payload.source?.name||""),"muted"));
 if(record){body.append(node("p",projectHelp.testedConfiguration),...(record.type==="change_note"?[node("p",projectHelp.changeRecord)]:[]),information("Record",Object.entries(recordPrompts[record.type]).map(([key,label])=>[label,record.fields[key]]).concat(record.type==="problem"?[["Status",record.fields.status]]:[]).concat(record.event_date?[["Event date",record.event_date]]:[])));if(record.step_snapshot)body.append(information("Step when recorded",[["Title",record.step_snapshot.title],["Instructions",record.step_snapshot.body]]));
  const occurrence=ctx.client.state.occurrences.find(row=>row.item_id===event.item_id);if(occurrence?.removed_at===null)body.append(button("Edit record",()=>editRecord({...ctx,itemId:event.item_id},{record})));
 }
 if(event.payload.record_edit){const edit=event.payload.record_edit;body.append(recordVersionView(ctx,edit.before,"Before edit",attachments),recordVersionView(ctx,edit.after,"After edit",attachments),information("Edit information",[["Edited by",event.payload.actor_id]]));if(event.payload.step_snapshot)body.append(information("Step when recorded",[["Title",event.payload.step_snapshot.title],["Instructions",event.payload.step_snapshot.body]]));}
 if(event.payload.record_structure){const {before,after}=event.payload.record_structure;body.append(information("Entry location changed",[["Previous parent entry",before.parent_title||"Instruction root"],["New parent entry",after.parent_title||"Instruction root"]]));}
 if(recordContext)body.append(buildContextView(recordContext,recordContext.legacy?"Build context from legacy snapshot":"Build context when recorded"));
 const build=event.payload.build_context;
 if(build?.before&&build?.after){if(JSON.stringify(build.before)===JSON.stringify(build.after))body.append(buildContextView(build.after,"Build context at change"));else body.append(buildContextView(build.before,"Build context before revision"),buildContextView(build.after,"Build context after revision"));}
 if(event.payload.snapshot)body.append(savedPartView(ctx,event));
 if(event.payload.file_id){const file=ctx.client.state.files.find(file=>file.id===event.payload.file_id);if(file)body.append(information("Engineering file",[["File",fileLink(ctx,file)]]));}
 if(event.payload.changes?.length)body.append(information("What changed",event.payload.changes.map(change=>[change.label,formatRevisionValue(change.before)+" → "+formatRevisionValue(change.after)])));
 if(event.payload.reason||event.payload.label)body.append(information("Revision information",[["Reason",event.payload.reason],["Label",event.payload.label]]));
 if(event.payload.path)body.append(information("Original location",[["Project",event.payload.path.root.name],["Item",event.payload.path.item.name],["Step",event.payload.path.step?.title]]));
 for(const config of configurations){const section=window.BSUI.section({title:config.id===event.payload.before&&config.id===event.payload.after?"Design configuration (unchanged)":config.id===event.payload.before?"Before revision":config.id===event.payload.after?"After revision":"Configuration when recorded",open:!!record});section.body.append(configurationView(config,undefined,{includeBuild:!recordContext&&!build}));if(config.snapshot.file){const file=ctx.client.state.files.find(file=>file.id===config.snapshot.file.id);if(file)section.body.append(fileLink(ctx,file));}body.append(section.root);}
 if(attachments.length&&!event.payload.record_edit)body.append(information("Attachments",attachments.map(file=>["File",fileLink(ctx,file)])));
 body.append(node("small","Recorded "+new Date(event.created_at).toLocaleString(),"muted"));container.replaceChildren(body);
}
function currentSnapshot(ctx,item){const occurrence=ctx.client.state.occurrences.find(row=>row.item_id===item.id);return {snapshot:{item,occurrence:{...occurrence,root:{name:ctx.client.state.project.name}}}};}
async function showRemoved(ctx,entry,container){
 const state=ctx.client.state,item=state.items.find(row=>row.id===entry.item_id),step=entry.kind==="step"?entry:null,occurrence=state.occurrences.find(row=>entry.occurrenceId?row.id===entry.occurrenceId:row.item_id===item.id),path=step?.retired_path||occurrence.removed_path;
 const archived=!step?await ctx.client.request("/"+ctx.projectId+"/history?"+new URLSearchParams({scope:item.id,type:"archives",occurrence:occurrence.id,limit:"1"})):null;
 const frozen=archived?.entries[0]?.payload.snapshot;
 const body=node("div","","project-stack");body.append(node("h2",step?step.title:item.name),information("Original location",[["Project",path?.root.name],["Item",path?.item.name],["Step",path?.step?.title]]),...(frozen?[savedPartView(ctx,archived.entries[0])]:[configurationView(currentSnapshot(ctx,item),"Archived item details")]));
 const instructions=instructionTree(state.steps.filter(row=>row.item_id===item.id)),steps=step?instructions.subtree(step.id):[...instructions.byId.values()],scopedRecords=state.records.filter(row=>row.item_id===item.id&&(!step||steps.some(scope=>scope.id===row.step_id)));for(const row of frozen?[]:steps)body.append(information(row.title,[["Instructions",row.body],["Archive reason",row.archive_reason]]));
 for(const record of frozen?[]:scopedRecords)body.append(recordVersionView(ctx,{...record,fileIds:state.file_links.filter(link=>link.record_id===record.id&&link.active).map(link=>link.file_id)},record.title,state.files));
 const fileIds=new Set(state.file_links.filter(link=>link.item_id===item.id||state.records.some(record=>record.item_id===item.id&&link.record_id===record.id)).map(link=>link.file_id));for(const file of frozen?[]:state.files.filter(file=>fileIds.has(file.id)))body.append(fileLink(ctx,file));
 const canRestore=!step||occurrence.removed_at===null&&(!step.parent_id||instructions.active(instructions.byId.get(step.parent_id)));
 if(canRestore)body.append(button(step?"Restore step…":"Restore to build…",async()=>{try{
  if(step){confirmAction(ctx,"Restore step",'Restore "'+step.title+'" to '+item.name+"?","Restore step",token=>ctx.client.write(ctx.projectId,"/steps/"+step.id+"/restore","POST",{},token));return;}
  const preview=await ctx.client.request("/"+ctx.projectId+"/occurrences/"+occurrence.id+"/restore-preview");confirmAction(ctx,"Restore to build","Destination: "+preview.root.name+". "+(preview.conflicts.join(" ")||"The item keeps its ID, part number, records and files."),"Restore to build",token=>ctx.client.write(ctx.projectId,"/occurrences/"+occurrence.id+"/restore","POST",{},token));
 }catch(error){ctx.notify(error.message);}}));else body.append(node("p","Restore the parent item before restoring this step."));container.replaceChildren(body);
}
export function createHistoryView(ctx,memo){
 const root=node("div","","project-stack"),toolbar=node("div","","actions project-toolbar"),panes=node("div","","project-panes project-history-panes"),list=node("div","","project-history-list"),detail=node("div","","project-history-detail");panes.append(list,detail);root.append(toolbar,panes);
 let requestNumber=0;
 const saveScroll=()=>{if(list.childElementCount)memo.scroll=list.scrollTop;};list.addEventListener("scroll",saveScroll);
 const select=async entry=>{memo.selected=entry.id;try{if(memo.mode==="archive")await showRemoved(ctx,entry,detail);else await showEvent(ctx,entry.id,detail);const back=button("Back to history",()=>{saveScroll();delete panes.dataset.detailOpen;detail.replaceChildren();list.scrollTop=memo.scroll;list.querySelector('[data-event-id="'+memo.selected+'"]')?.focus();});detail.prepend(back);panes.dataset.detailOpen="true";detail.querySelector("h2")?.setAttribute("tabindex","-1");detail.querySelector("h2")?.focus({preventScroll:true});}catch(error){ctx.notify(error.message);}};
 async function load(more=false){
  const generation=++requestNumber;saveScroll();try{
   let entries,nextCursor=null;
   if(memo.mode==="archive"){
    const state=ctx.client.state;entries=[...state.occurrences.filter(row=>row.removed_at!==null&&(!row.archive_group_id||state.archive_groups.find(group=>group.id===row.archive_group_id)?.root_occurrence_id===row.id)).map(row=>{const item=state.items.find(item=>item.id===row.item_id);return {...row,id:"occurrence-"+row.id,occurrenceId:row.id,kind:"item",title:item.name,summary:item.is_assembly?"Archived subassembly":"Archived part",created_at:row.removed_at};}),...state.steps.filter(row=>row.retired_at).map(row=>({...row,kind:"step",summary:"Retired step",created_at:row.retired_at}))];
    entries=entries.filter(row=>(!memo.scope||row.item_id===memo.scope||state.occurrences.find(parent=>parent.id===row.parent_id)?.item_id===memo.scope)&&(!memo.q||(row.title+" "+row.summary).toLowerCase().includes(memo.q.toLowerCase()))).sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id));
   }else{entries=[];const target=more?20:Math.max(20,memo.entries.length);let cursor=more?memo.cursor:null;do{const params=new URLSearchParams({type:memo.type,scope:memo.scope,q:memo.q,limit:"20",...(cursor?{cursor}:{})});const result=await ctx.client.request("/"+ctx.projectId+"/history?"+params);if(generation!==requestNumber)return;entries.push(...result.entries);cursor=result.nextCursor;}while(cursor&&entries.length<target);nextCursor=cursor;}
   if(generation!==requestNumber)return;memo.entries=more?[...memo.entries,...entries]:entries;memo.cursor=nextCursor;list.replaceChildren();
   for(const entry of memo.entries){const row=entryCard(entry,()=>select(entry));row.setAttribute("aria-pressed",String(entry.id===memo.selected));list.append(row);}if(!memo.entries.length)list.append(node("p",memo.mode==="archive"?"Archived parts and retired steps will appear here.":"Add a record or save a revision to start this History."));
   if(nextCursor)list.append(button("Load more",()=>load(true)));list.scrollTop=memo.scroll||0;
   if(memo.selected){const selected=memo.entries.find(entry=>entry.id===memo.selected);if(selected)await select(selected);else {delete panes.dataset.detailOpen;detail.replaceChildren();}}
  }catch(error){ctx.notify(error.message);}
 }
 const reset=()=>{memo.cursor=null;memo.scroll=0;memo.selected=null;memo.entries=[];delete panes.dataset.detailOpen;detail.replaceChildren();list.replaceChildren();void load();};
 toolbar.append(field("View",memo.mode,value=>{memo.mode=value;reset();},{options:[{value:"history",label:"History"},{value:"archive",label:"Archive"}]}),field("Scope",memo.scope,value=>{memo.scope=value;reset();},{options:[{value:"",label:"Whole project"},...ctx.client.state.items.map(item=>({value:item.id,label:item.name}))]}),field("Type",memo.type,value=>{memo.type=value;reset();},{options:[{value:"all",label:"All"},{value:"tests",label:"Tests"},{value:"problems",label:"Problems"},{value:"changes",label:"Changes"},{value:"notes",label:"Notes"}]}),field("Search history",memo.q,value=>{memo.q=value;reset();},{type:"search"}));
 queueMicrotask(()=>{initSplitPanes(panes,{key:"project-history",panes:[{key:"history",selector:".project-history-list",name:"History"}]});void load();});return root;
}
export async function latestHistory(ctx,container){
 const result=await ctx.client.request("/"+ctx.projectId+"/history?"+new URLSearchParams({scope:ctx.itemId,type:"activity",limit:"5"}));
 for(const entry of result.entries)container.append(entryCard(entry,()=>ctx.openHistory(ctx.itemId,entry.id)));return result.total;
}
