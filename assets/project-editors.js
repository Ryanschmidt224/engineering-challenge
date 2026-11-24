import {projectTree} from "./project-tree-model.js";
import {partHistoryPrompt} from "./project-part-history.js";
import {partHelp} from "./part-help.js";
import {projectHelp} from "./project-help.js";
import {node,field,checkbox,actions} from "./workshop-ui.js";
import {normalizeCustomItem,normalizeOccurrence,diffCustomItems,diffProjectItems,formatRevisionValue,allocatePartNumber} from "./project-item-model.js";
import {recordLabels,recordPrompts,normalizeProjectRecord} from "./project-record-model.js";
export const detailsFor=item=>normalizeCustomItem({name:item.name,short_name:item.short_name,part_number:item.part_number,kind:item.kind,source:item.source,is_tool:!!item.is_tool,is_assembly:!!item.is_assembly,fields:item.fields});
export const buildFor=occ=>normalizeOccurrence({quantity:occ.quantity,unit:occ.unit,build_status:occ.build_status,attention:!!occ.attention,attention_note:occ.attention_note,hidden:!!occ.hidden});
const button=(...args)=>window.BSUI.button(...args);
export function editable(ctx,title,saveLabel,collect,save,{review=null}={}){
 const dialog=ctx.dialog,form=node("form"),fields=node("div"),error=node("p","","error"),reviewArea=node("div"),saveButton=button(saveLabel,()=>form.requestSubmit(),{variant:"primary"});
 error.setAttribute("role","alert");let revision=ctx.client.state?.project.revision??null,busy=false;
 const close=()=>{if(!busy)dialog.close();};
 const cancel=button("Cancel",close),reload=button("Review newer changes",async()=>{
  try{const state=await ctx.client.load(ctx.projectId);reviewArea.replaceChildren(node("h3","Current saved version and your draft"));if(review)reviewArea.append(review(state));else reviewArea.append(node("p","The project now uses a newer saved version. Review your fields before saving."));
   const latest=state.project.revision;reviewArea.append(button("Use newer version after review",()=>{revision=latest;error.textContent="Your draft is retained. Save when your review is complete.";saveButton.textContent="Save reviewed changes";reload.hidden=true;reviewArea.replaceChildren();}));
  }catch(problem){error.textContent=problem.message;}
 });reload.hidden=true;
 form.append(fields,error,reload,reviewArea,actions(saveButton,cancel));
 form.onsubmit=async event=>{event.preventDefault();if(busy)return;error.textContent="";try{const data=collect();busy=true;saveButton.disabled=true;cancel.disabled=true;await save(data,revision);if(await ctx.refresh()===false)throw Error("Saved, but the part could not be reopened. Retry this same save.");dialog.close();}catch(problem){error.textContent=problem.message;reload.hidden=problem.status!==409;}finally{busy=false;saveButton.disabled=false;cancel.disabled=false;}};
 dialog.oncancel=event=>{if(busy)event.preventDefault();};dialog.replaceChildren(node("h2",title),form);dialog.setAttribute("aria-label",title);queueMicrotask(()=>{dialog.showModal();dialog.querySelector("input,textarea,select")?.focus();});
 return {fields,form,saveButton,error,get revision(){return revision;},acceptOwnWrites(token=ctx.client.state.project.revision){revision=token;}};
}
function changeRows(changes){
 const area=node("div");if(!changes.length)area.append(node("p","No changes."));
 for(const change of changes)area.append(window.BSUI.fieldRow(change.label,formatRevisionValue(change.before)+" → "+formatRevisionValue(change.after)).root);return area;
}
function specEditor(specs,change){
 const area=node("div"),list=node("div"),render=()=>{list.replaceChildren();for(const spec of specs){
  const panel=window.BSUI.informationPanel(spec.label||"Specification"),holder=node("div"),valueHolder=node("div");
  let type=Object.hasOwn(spec,"value")?spec.value===null?"null":typeof spec.value:"unset";
  const renderValue=()=>{valueHolder.replaceChildren();if(type==="unset"||type==="null")return;valueHolder.append(field("Value",spec.value,value=>{spec.value=value;change();},{type:type==="number"?"number":"text",options:type==="boolean"?[{value:"true",label:"Yes"},{value:"false",label:"No"}]:null}));if(type==="boolean"){const input=valueHolder.querySelector("select");input.value=String(spec.value);input.onchange=()=>{spec.value=input.value==="true";change();};}};
  holder.append(field("Label",spec.label,value=>{spec.label=value;panel.heading.textContent=value||"Specification";change();}),field("Value type",type,value=>{type=value;if(type==="unset")delete spec.value;else spec.value=type==="null"?null:type==="boolean"?false:type==="number"?0:"";renderValue();change();},{options:[{value:"unset",label:"Not set"},{value:"number",label:"Number"},{value:"string",label:"Text (may be empty)"},{value:"boolean",label:"Yes / No"},{value:"null",label:"Explicit null"}]}),valueHolder,field("Unit",spec.unit||"",value=>{spec.unit=value;change();}),button("Remove specification",()=>{specs.splice(specs.indexOf(spec),1);render();change();},{variant:"quiet"}));renderValue();panel.body.append(holder);list.append(panel.root);
 }};const add=button("Add specification",()=>{specs.push({field_id:crypto.randomUUID(),label:""});render();change();});add.title=projectHelp.specification;add.setAttribute("aria-description",projectHelp.specification);const explanation=node("p",projectHelp.specification,"muted");explanation.hidden=true;const help=button("ⓘ",()=>{explanation.hidden=!explanation.hidden;help.setAttribute("aria-expanded",String(!explanation.hidden));},{variant:"quiet",small:true});help.setAttribute("aria-label","About specifications");help.setAttribute("aria-expanded","false");help.title=projectHelp.specification;area.append(list,actions(add,help),explanation);render();return area;
}
export function editItem(ctx,item=null,occurrence=null,{assembly=false,parentId=null}={}){
 const before=item?detailsFor(item):null,details=before?structuredClone(before):{name:"",short_name:"",part_number:"",kind:"part",source:"custom",is_tool:false,...(assembly?{is_assembly:true}:{}),fields:{specs:[]}},build=occurrence?buildFor(occurrence):normalizeOccurrence({});let assignNumber=true;
 details.fields.specs||=[];
 const collect=()=>({details:normalizeCustomItem(!item&&assignNumber?{...details,part_number:allocatePartNumber(ctx.client.state.project,ctx.client.state.items.map(row=>row.part_number),!!details.is_assembly)}:details),build:normalizeOccurrence(build),...(!item?{assignNumber,parentId}:{occurrenceId:occurrence.id})});
 const editor=editable(ctx,item?"Edit part details":assembly?"Add subassembly":"Add custom part",item?"Save":assembly?"Add subassembly":"Add part",collect,async(data,token)=>{await ctx.client.write(ctx.projectId,item?"/items/"+item.id:"/items",item?"PATCH":"POST",data,token);},{review:state=>{const current=state.items.find(row=>row.id===item?.id);return current?changeRows(diffCustomItems(detailsFor(current),details)):node("p","This item is archived. Cancel and inspect History → Archive.");}});
 if(!item)editor.fields.append(parentPicker(ctx,parentId,value=>parentId=value));
 const update=()=>{};editor.saveButton.title=item?partHelp.save:"Save this new part to the project.";
 editor.fields.append(field("Name",details.name,value=>{details.name=value;update();},{required:true}),field("Short tree name",details.short_name,value=>{details.short_name=value;update();}));
 if(!item)editor.fields.append(checkbox("Create next sequential part number",true,value=>{assignNumber=value;numberRow.hidden=value;}));
 const numberRow=field("Part number",details.part_number,value=>{details.part_number=value;update();});numberRow.hidden=!item;if(item)numberRow.querySelector("input").readOnly=true;editor.fields.append(numberRow);if(!details.is_assembly)editor.fields.append(field("Kind",details.kind,value=>{details.kind=value;update();},{options:[{value:"part",label:"Part"},{value:"document",label:"Document"},{value:"code",label:"Code"}]}),checkbox("Is a tool",details.is_tool,value=>{details.is_tool=value;update();}));
 for(const [key,title]of Object.entries({description:"Description",purpose:"Purpose",acceptance:"Acceptance criteria"}))editor.fields.append(field(title,details.fields[key]||"",value=>{details.fields[key]=value;update();},{type:["description","purpose","acceptance"].includes(key)?"textarea":"text"}));
 const manufacturer=window.BSUI.section({title:"Manufacturer details (optional)",role:"manufacturer-details"});for(const [key,title]of [["manufacturer","Manufacturer"],["mpn","Manufacturer part number"]])manufacturer.body.append(field(title,details.fields[key]||"",value=>{details.fields[key]=value;update();}));editor.fields.append(manufacturer.root);
 editor.fields.append(specEditor(details.fields.specs,update),field("Quantity",build.quantity,value=>{build.quantity=value;update();},{type:"number"}),field("Unit",build.unit,value=>{build.unit=value;update();}),field("Status",build.build_status,value=>{build.build_status=value;update();},{options:[{value:"not_started",label:"Not started"},{value:"in_progress",label:"In progress"},{value:"complete",label:"Complete"}]}),checkbox("Needs attention",build.attention,value=>{build.attention=value;update();}),field("Attention note",build.attention_note,value=>{build.attention_note=value;update();},{type:"textarea"}),checkbox("Hide in feature tree",build.hidden,value=>{build.hidden=value;update();}));
 if(item){
  const revision=button("Save as revision",()=>{try{if(!editor.form.reportValidity())return;const changes=collect();partHistoryPrompt(ctx,item,revision,{changes,expectedRevision:editor.revision,onOwnUpload:token=>editor.acceptOwnWrites(token),onComplete:()=>ctx.dialog.close()});}catch(problem){editor.error.textContent=problem.message;}});revision.title=partHelp.saveAsRevision;editor.saveButton.after(revision);
 }
 update();
}
export function attachmentPicker(ctx,fileIds,onUploaded=()=>{},onBusy=()=>{}){
 const area=node("div"),input=node("input"),list=node("div"),status=node("p","","ui-status");input.type="file";input.multiple=true;input.setAttribute("aria-label","Supporting files");
 const render=()=>{list.replaceChildren();for(const id of fileIds){const file=ctx.client.state.files.find(file=>file.id===id);list.append(actions(node("span",file?.name||"Uploaded attachment"),button("Remove attachment",()=>{fileIds.splice(fileIds.indexOf(id),1);render();},{variant:"quiet"})));}};
 const upload=button("Upload supporting files",async()=>{upload.disabled=true;onBusy(true);try{for(const file of input.files){const result=await ctx.client.upload(ctx.projectId,file);fileIds.push(result.fileId);onUploaded();render();}input.value="";status.textContent="Attachments uploaded. Save to attach them to this entry.";}catch(problem){status.textContent=problem.message;}finally{upload.disabled=false;onBusy(false);}});
 area.append(input,upload,list,status);render();return area;
}
export function editRecord(ctx,{record=null,stepId=null}={}){
 let draft=record?{type:record.type,title:record.title,fields:structuredClone(record.fields),event_date:record.event_date,fileIds:ctx.client.state.file_links.filter(link=>link.record_id===record.id&&link.active).map(link=>link.file_id)}:{type:"test",title:"",fields:{},event_date:null,fileIds:[]};
 const promptArea=node("div"),render=()=>{promptArea.replaceChildren();for(const [key,title]of Object.entries(recordPrompts[draft.type]))promptArea.append(field(title,draft.fields[key]||"",value=>draft.fields[key]=value,{type:"textarea"}));if(draft.type==="problem")promptArea.append(field("Problem status",draft.fields.status||"open",value=>draft.fields.status=value,{options:[{value:"open",label:"Open"},{value:"resolved",label:"Resolved"}]}));};
 const editor=editable(ctx,record?"Edit record":"Add record","Save record",()=>({record:normalizeProjectRecord(draft),occurrenceId:ctx.occurrenceId||undefined,...(stepId?{stepId}:{})}),async(data,token)=>ctx.client.write(ctx.projectId,record?"/records/"+record.id:"/items/"+ctx.itemId+"/records",record?"PATCH":"POST",data,token));
 editor.fields.append(field("Record type",draft.type,value=>{draft.type=value;draft.fields={};render();},{options:Object.entries(recordLabels).map(([value,label])=>({value,label}))}),field("Title (optional)",draft.title,value=>draft.title=value),promptArea,field("Event date (optional)",draft.event_date,value=>draft.event_date=value,{type:"date"}),attachmentPicker(ctx,draft.fileIds,()=>editor.acceptOwnWrites(),busy=>editor.saveButton.disabled=busy));render();
}
export function editStep(ctx,step=null){
 const draft={title:step?.title||"",body:step?.body||""},editor=editable(ctx,step?"Edit step":"Add step","Save step",()=>draft,(data,token)=>ctx.client.write(ctx.projectId,step?"/steps/"+step.id:"/items/"+ctx.itemId+"/steps",step?"PATCH":"POST",data,token));
 editor.fields.append(field("Step title",draft.title,value=>draft.title=value,{required:true}),field("Instructions",draft.body,value=>draft.body=value,{type:"textarea"}));
}
export function projectSettings(ctx,{create=false}={}){
 const newProjectId=create?crypto.randomUUID():null;
 const project=create?{name:"",prefix:"NR",digits:3}:ctx.client.state.project,draft={name:project.name,prefix:project.prefix,digits:project.digits};
 const editor=editable(ctx,create?"New project":"Project settings",create?"Create project":"Save settings",()=>draft,async(data,token)=>{if(create){const projectId=newProjectId;await ctx.client.write(projectId,"","POST",data,null);await ctx.navigate(projectId);}else await ctx.client.write(ctx.projectId,"","PATCH",data,token);});
 editor.fields.append(field("Project name",draft.name,value=>draft.name=value,{required:true}),field("Number prefix",draft.prefix,value=>draft.prefix=value),field("Minimum digits",draft.digits,value=>draft.digits=value,{type:"number"}));
}
export function confirmAction(ctx,title,message,label,save){
 const editor=editable(ctx,title,label,()=>({}),(data,token)=>save(token));editor.fields.append(node("p",message));
}

export function parentPicker(ctx,value,change,excluded=[]){
 const state=ctx.client.state,tree=projectTree(state.items,state.occurrences);
 return field("Parent subassembly",value||"",value=>change(value||null),{options:[{value:"",label:"Project root"},...state.occurrences.filter(row=>tree.active(row)&&tree.definitions.get(row.item_id).is_assembly&&!excluded.includes(row.id)).map(row=>({value:row.id,label:tree.path(row).map(part=>part.name).join(" / ")}))]});
}
export function placementEditor(ctx,{occurrence=null,parentId=null}={}){
 const state=ctx.client.state,tree=projectTree(state.items,state.occurrences),candidates=[...tree.placements.values()].filter(tree.active),draft={sourceOccurrenceId:candidates[0]?.id||"",parentId:occurrence?.parent_id||parentId,build:occurrence?buildFor(occurrence):normalizeOccurrence({})};
 const editor=editable(ctx,occurrence?"Move placement":"Add existing part placement",occurrence?"Save location":"Add placement",()=>draft,async(data,token)=>{const source=tree.placements.get(data.sourceOccurrenceId);if(!occurrence&&!source)throw Error("Choose an existing placement.");await ctx.client.write(ctx.projectId,occurrence?"/occurrences/"+occurrence.id:"/items/"+source.item_id+"/placements",occurrence?"PATCH":"POST",data,token);});
 editor.fields.append(node("p","Engineering details are shared by placements of the same part. Quantity, location and build status belong to each placement. Adding a subassembly also adds its active child placements."));
 if(!occurrence)editor.fields.append(field("Existing part placement",draft.sourceOccurrenceId,value=>draft.sourceOccurrenceId=value,{options:candidates.map(row=>({value:row.id,label:tree.path(row).map(part=>part.name).join(" / ")}))}));
 editor.fields.append(parentPicker(ctx,draft.parentId,value=>draft.parentId=value,occurrence?tree.subtree(occurrence.id,{includeRemoved:true}).map(row=>row.id):[]),field("Quantity",draft.build.quantity,value=>draft.build.quantity=value,{type:"number"}));
}
