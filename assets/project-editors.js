import {identityNameLink} from './project-identity-link.js';
import {projectDeletionSection} from "./project-delete.js";
import {recordLabels,containerHelp} from "./project-presentation.js";
import {projectTree} from "./project-tree-model.js";
import {partHistoryPrompt} from "./project-part-history.js";
import {partHelp} from "./part-help.js";
import {projectHelp} from "./project-help.js";
import {node,field,checkbox,actions} from "./workshop-ui.js";
import {normalizeCustomItem,normalizeOccurrence,diffCustomItems,diffProjectItems,formatRevisionValue,allocatePartNumber} from "./project-item-model.js";
import {recordPrompts,normalizeProjectRecord} from "./project-record-model.js";
import {instructionTree,recordTree} from "./project-instruction-model.js";
import {recordAttachments} from "./project-record-attachments.js";
import {automaticBackupSection} from "./project-backup-settings.js";
import {websiteSettings,ownerChoices} from "./website-settings-client.js";
export const detailsFor=item=>normalizeCustomItem({name:item.name,short_name:item.short_name,part_number:item.part_number,kind:item.kind,source:item.source,is_tool:!!item.is_tool,is_assembly:!!item.is_assembly,fields:item.fields});
export const buildFor=occ=>normalizeOccurrence({quantity:occ.quantity,unit:occ.unit,build_status:occ.build_status,attention:!!occ.attention,attention_note:occ.attention_note,hidden:!!occ.hidden});
const button=(...args)=>window.BSUI.button(...args);
function editorGroup(title,...rows){const group=node("fieldset","","project-editor-group");group.append(node("legend",title),...rows);return group;}
function containerField(details,update){
 const row=field("Generic Part Name",details.short_name,value=>{details.short_name=value;update();},{placeholder:"e.g. Power supply"}),input=row.querySelector("input");input.maxLength=20;
 const explanation=node("p",containerHelp,"project-field-help muted");explanation.hidden=true;explanation.id=input.id+"-help";input.setAttribute("aria-describedby",explanation.id);const help=button("ⓘ",()=>{explanation.hidden=!explanation.hidden;help.setAttribute("aria-expanded",String(!explanation.hidden));},{variant:"quiet",small:true});help.setAttribute("aria-label","About Generic Part Name");help.setAttribute("aria-expanded","false");const caption=row.querySelector("label");caption.textContent="Generic Part Name";caption.append(help);input.setAttribute("aria-label","Generic Part Name");row.append(explanation);row.classList.add("project-container-field");input.title=containerHelp;return row;
}
export function editable(ctx,title,saveLabel,collect,save,{review=null,mount=null,initialRevision=ctx.client.state?.project.revision??null}={}){
 const dialog=ctx.dialog,form=node("form"),fields=node("div"),error=node("p","","error"),reviewArea=node("div"),saveButton=button(saveLabel,()=>form.requestSubmit(),{variant:"primary"});
 error.setAttribute("role","alert");let revision=initialRevision,busy=false,uploading=false;
 const close=()=>{if(!busy&&!uploading)if(mount)void ctx.navigate(ctx.projectId);else dialog.close();};
 const cancel=button("Cancel",close),reload=button("Review newer changes",async()=>{
  try{const state=await ctx.client.load(ctx.projectId);reviewArea.replaceChildren(node("h3","Current saved version and your draft"));if(review)reviewArea.append(review(state));else reviewArea.append(node("p","The project now uses a newer saved version. Review your fields before saving."));
   const latest=state.project.revision;reviewArea.append(button("Use newer version after review",()=>{revision=latest;error.textContent="Your draft is retained. Save when your review is complete.";saveButton.textContent="Save reviewed changes";reload.hidden=true;reviewArea.replaceChildren();}));
  }catch(problem){error.textContent=problem.message;}
 });reload.hidden=true;
 form.append(fields,error,reload,reviewArea,actions(saveButton,cancel));
 form.onsubmit=async event=>{event.preventDefault();if(busy||uploading)return;error.textContent="";try{const data=collect();busy=true;saveButton.disabled=true;cancel.disabled=true;await save(data,revision);if(await ctx.refresh()===false)throw Error("Saved, but the part could not be reopened. Retry this same save.");if(!mount)dialog.close();}catch(problem){error.textContent=problem.message;if(problem.status===401&&ctx.signIn)error.append(button("Log in again",()=>ctx.signIn()));reload.hidden=problem.status!==409;}finally{busy=false;saveButton.disabled=uploading;cancel.disabled=uploading;}};
 if(mount){if(!dialog.open)dialog.replaceChildren();mount.replaceChildren(node("h2",title),form);}else{dialog.oncancel=event=>{if(busy||uploading)event.preventDefault();};dialog.replaceChildren(node("h2",title),form);dialog.setAttribute("aria-label",title);queueMicrotask(()=>{dialog.showModal();dialog.querySelector("input,textarea,select")?.focus();});}
 return {fields,form,saveButton,error,get revision(){return revision;},acceptOwnWrites(token=ctx.client.state.project.revision){revision=token;},uploadBusy(value){uploading=value;saveButton.disabled=busy||uploading;cancel.disabled=busy||uploading;},handleError(problem){error.textContent=problem.message;if(problem.status===401&&ctx.signIn)error.append(button("Log in again",()=>ctx.signIn()));reload.hidden=problem.status!==409;}};
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
 const container=editorGroup("Item identity",containerField(details,update)),part=editorGroup("Part details"),display=editorGroup("Display options");
 if(!item)container.append(checkbox("Auto assign part number",true,value=>{assignNumber=value;numberRow.hidden=value;}));
 const numberRow=field("Part number",details.part_number,value=>{details.part_number=value;update();});numberRow.hidden=!item;if(item)numberRow.querySelector("input").readOnly=true;container.append(numberRow,field("Purpose (optional)",details.fields.purpose||"",value=>{details.fields.purpose=value;update();},{type:"textarea",placeholder:"What does this part or assembly need to accomplish?"}));
 if(!details.is_assembly)container.prepend(field("Item type",details.kind,value=>{details.kind=value;update();},{options:[{value:"part",label:"Part"},{value:"document",label:"Document"},{value:"code",label:"Code"}]}));
 if(!details.is_assembly)part.append(checkbox("Is a tool?",details.is_tool,value=>{details.is_tool=value;update();}));
 const specific=field("Specific Part Name",details.name,value=>{details.name=value;update();},{required:true});part.append(identityNameLink(details,container.querySelector('input[aria-label="Generic Part Name"]'),specific.querySelector("input"),{creating:!item}),specific,field("Description",details.fields.description||"",value=>{details.fields.description=value;update();},{type:"textarea"}));
 for(const [key,title]of [["manufacturer","Manufacturer"],["mpn","Mfg part number"]])part.append(field(title,details.fields[key]||"",value=>{details.fields[key]=value;update();}));part.append(specEditor(details.fields.specs,update),field("Acceptance criteria",details.fields.acceptance||"",value=>{details.fields.acceptance=value;update();},{type:"textarea"}));
 display.append(field("Quantity",build.quantity,value=>{build.quantity=value;update();},{type:"number"}),field("Unit",build.unit,value=>{build.unit=value;update();}),field("Status",build.build_status,value=>{build.build_status=value;update();},{options:[{value:"not_started",label:"Not started"},{value:"in_progress",label:"In progress"},{value:"complete",label:"Complete"}]}),checkbox("Needs attention",build.attention,value=>{build.attention=value;update();}),field("Attention note",build.attention_note,value=>{build.attention_note=value;update();},{type:"textarea"}),checkbox("Hide from feature tree?",build.hidden,value=>{build.hidden=value;update();}));
 editor.fields.append(container,part,display);
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
export function editRecord(ctx,{record=null,stepId=null,parentRecordId=null}={}){
 let draft=record?{type:record.type,title:record.title,fields:structuredClone(record.fields),event_date:record.event_date,fileIds:ctx.client.state.file_links.filter(link=>link.record_id===record.id&&link.active).map(link=>link.file_id)}:{type:"test",title:"",fields:{},event_date:null,fileIds:[]};
 parentRecordId=record?.parent_record_id||parentRecordId;stepId=record?.step_id||stepId;
 const promptArea=node("div"),attachments=node("div"),render=()=>{promptArea.replaceChildren();for(const [key,title]of Object.entries(recordPrompts[draft.type])){const label=key==="resolution"&&draft.fields.did_fix?(draft.fields.did_fix==="no"?"Why?":"How?"):title;promptArea.append(field(label,draft.fields[key]||"",value=>draft.fields[key]=value,{type:"textarea"}));}if(draft.type==="problem")promptArea.append(field("Did you fix it?",draft.fields.did_fix||"",value=>{const previous=draft.fields.did_fix;if(previous&&value&&(value==="no")!==(previous==="no"))draft.fields.resolution="";if(value)draft.fields.did_fix=value;else delete draft.fields.did_fix;render();},{options:[{value:"",label:"Not recorded"},{value:"yes",label:"Yes"},{value:"no",label:"No"},{value:"maybe",label:"Maybe"}]}));attachments.replaceChildren(recordAttachments(ctx,draft,editor));};
 const editor=editable(ctx,record?"Edit entry":"Add entry","Save entry",()=>({record:normalizeProjectRecord(draft),parentRecordId,occurrenceId:ctx.occurrenceId||undefined,...(stepId?{stepId}:{})}),async(data,token)=>ctx.client.write(ctx.projectId,record?"/records/"+record.id:"/items/"+ctx.itemId+"/records",record?"PATCH":"POST",data,token),{review:state=>{const current=state.records.find(row=>row.id===record?.id);return node("p",JSON.stringify({saved:current||"New record",draft},null,2),"project-instruction-text");}});
 editor.fields.append(node("p",projectHelp.changeRecord),field("Entry type",draft.fields.category==="photos"?"photos":draft.type,value=>{draft.type=value==="photos"?"note":value;draft.fields=value==="photos"?{category:"photos"}:{};render();},{options:[...Object.entries(recordLabels).map(([value,label])=>({value,label})),{value:"photos",label:"Photos"}]}),field("Title (optional)",draft.title,value=>draft.title=value),promptArea,attachments);
 if(stepId){const records=ctx.client.state.records.filter(row=>row.step_id===stepId),tree=recordTree(records),excluded=new Set(record?tree.descendants(record.id):[]);editor.fields.append(field("Parent entry",parentRecordId||"",value=>parentRecordId=value||null,{options:[{value:"",label:"Top-level entry"},...records.filter(row=>!excluded.has(row.id)).map(row=>({value:row.id,label:row.title}))]}));}render();
}
export function editStep(ctx,step=null,{parentId=null,isGroup=false}={}){
 const draft={title:step?.title||"",body:step?.body||"",parentId:step?.parent_id||parentId,...(!step?{isGroup}:{})},tree=instructionTree(ctx.client.state.steps.filter(row=>row.item_id===ctx.itemId)),excluded=new Set(step?tree.subtree(step.id).map(row=>row.id):[]),editor=editable(ctx,step?"Edit step":isGroup?"Add instruction group":"Add step","Save step",()=>({...draft}),(data,token)=>ctx.client.write(ctx.projectId,step?"/steps/"+step.id:"/items/"+ctx.itemId+"/steps",step?"PATCH":"POST",data,token),{review:state=>{const current=state.steps.find(row=>row.id===step?.id);return node("p",JSON.stringify({saved:current||"New instruction",draft},null,2),"project-instruction-text");}});
 editor.fields.append(field("Step title",draft.title,value=>draft.title=value,{required:true}),field("Instructions",draft.body,value=>draft.body=value,{type:"textarea"}));
 editor.fields.append(field("Instruction group",draft.parentId||"",value=>draft.parentId=value||null,{options:[{value:"",label:"No group"},...[...tree.byId.values()].filter(row=>row.is_group&&tree.active(row)&&!excluded.has(row.id)).map(row=>({value:row.id,label:row.title}))]}));
 editor.saveButton.title="Overwrite this working instruction without creating a revision.";
 if(step){const revision=button("Save as revision",()=>{if(!editor.form.reportValidity())return;if(draft.title.trim()===step.title&&draft.body.trim()===step.body&&draft.parentId===step.parent_id){editor.error.textContent="No instruction changes to save. Use Create a Revision to capture the unchanged saved scope.";return;}const item=ctx.client.state.items.find(row=>row.id===ctx.itemId);partHistoryPrompt(ctx,item,revision,{scope:step,path:"/steps/"+step.id+"/revisions",changes:{...draft},expectedRevision:editor.revision,onOwnUpload:token=>editor.acceptOwnWrites(token),onComplete:()=>ctx.dialog.close()});});revision.title="Preserve the saved instruction scope in revision history, then save these edits.";editor.saveButton.after(revision);}
}
export function retireInstruction(ctx,step){
 let reason="";const editor=editable(ctx,"Archive step","Archive step",()=>({reason}),(data,token)=>ctx.client.write(ctx.projectId,"/steps/"+step.id+"/retire","POST",data,token));editor.fields.append(node("p",'Archive "'+step.title+'"'+(step.is_group?" and its nested instructions":"")+"? Its records, files and revisions remain available."),field("Archive reason (optional)",reason,value=>reason=value,{type:"textarea"}));
}
const settingsDrafts=new WeakMap();
export function projectSettings(ctx,{create=false,mount=null}={}){
 const newProjectId=create?crypto.randomUUID():null;
 const project=create?{name:"",prefix:"NR",digits:3,owner_name:websiteSettings().defaultOwner}:ctx.client.state.project,draft={name:project.name,prefix:project.prefix,digits:project.digits,owner_name:project.owner_name||"Ryan"};
 let saved=settingsDrafts.get(ctx.client);if(mount&&saved?.projectId===ctx.projectId)Object.assign(draft,saved.draft);else saved={projectId:ctx.projectId,draft,revision:project.revision};if(mount)settingsDrafts.set(ctx.client,{...saved,draft});
 const editor=editable(ctx,create?"New project":"Project settings",create?"Create project":"Save settings",()=>draft,async(data,token)=>{if(create){const projectId=newProjectId;await ctx.client.write(projectId,"","POST",data,null);await ctx.navigate(projectId);}else{await ctx.client.write(ctx.projectId,"","PATCH",data,token);settingsDrafts.delete(ctx.client);}},{mount,initialRevision:mount?saved.revision:ctx.client.state?.project.revision??null});
 if(mount)editor.form.querySelectorAll("button").forEach(control=>{if(control.textContent==="Cancel")control.addEventListener("click",()=>settingsDrafts.delete(ctx.client),{capture:true});});
 const preview=node("p","","muted"),reserved=create?[]:ctx.client.state.items.map(item=>item.part_number),updatePreview=()=>{try{preview.textContent="Next subassembly: "+allocatePartNumber(draft,reserved,true)+" · Next part: "+allocatePartNumber(draft,reserved)+". Existing numbers stay unchanged.";}catch(error){preview.textContent=error.message;}};preview.dataset.numberPreview="";preview.setAttribute("aria-live","polite");
 const name=field("Project name",draft.name,value=>draft.name=value,{required:true}),prefix=field("Number prefix",draft.prefix,value=>{draft.prefix=value;updatePreview();}),digits=field("Minimum digits",draft.digits,value=>{draft.digits=value;updatePreview();},{type:"number"});name.querySelector("input").maxLength=180;prefix.querySelector("input").maxLength=10;digits.querySelector("input").min=1;digits.querySelector("input").max=8;digits.querySelector("input").step=1;editor.fields.append(name,node("p","Project names can contain up to 180 characters.","muted"),prefix,digits,preview);updatePreview();
 prefix.before(field("Project owner",draft.owner_name,value=>draft.owner_name=value,{options:ownerChoices([draft.owner_name]).map(value=>({value,label:value}))}));
 if(!create)editor.fields.append(automaticBackupSection(ctx),projectDeletionSection(ctx,project));
}
export function confirmAction(ctx,title,message,label,save){
 const editor=editable(ctx,title,label,()=>({}),(data,token)=>save(token));editor.fields.append(node("p",message));
}

export function parentPicker(ctx,value,change,excluded=[]){
 const state=ctx.client.state,tree=projectTree(state.items,state.occurrences);
 return field("Parent subassembly",value||"",value=>change(value||null),{options:[{value:"",label:state.project.name},...state.occurrences.filter(row=>tree.active(row)&&tree.definitions.get(row.item_id).is_assembly&&!excluded.includes(row.id)).map(row=>({value:row.id,label:tree.path(row).map(part=>part.name).join(" / ")}))]});
}
export function placementEditor(ctx,{occurrence=null,parentId=null}={}){
 const state=ctx.client.state,tree=projectTree(state.items,state.occurrences),candidates=[...tree.placements.values()].filter(tree.active),draft={sourceOccurrenceId:candidates[0]?.id||"",parentId:occurrence?.parent_id||parentId,build:occurrence?buildFor(occurrence):normalizeOccurrence({})};
 const editor=editable(ctx,occurrence?"Move placement":"Add existing part placement",occurrence?"Save location":"Add placement",()=>draft,async(data,token)=>{const source=tree.placements.get(data.sourceOccurrenceId);if(!occurrence&&!source)throw Error("Choose an existing placement.");await ctx.client.write(ctx.projectId,occurrence?"/occurrences/"+occurrence.id:"/items/"+source.item_id+"/placements",occurrence?"PATCH":"POST",data,token);});
 editor.fields.append(node("p","Engineering details are shared by placements of the same part. Quantity, location and build status belong to each placement. Adding a subassembly also adds its active child placements."));
 if(!occurrence)editor.fields.append(field("Existing part placement",draft.sourceOccurrenceId,value=>draft.sourceOccurrenceId=value,{options:candidates.map(row=>({value:row.id,label:tree.path(row).map(part=>part.name).join(" / ")}))}));
 editor.fields.append(parentPicker(ctx,draft.parentId,value=>draft.parentId=value,occurrence?tree.subtree(occurrence.id,{includeRemoved:true}).map(row=>row.id):[]),field("Quantity",draft.build.quantity,value=>draft.build.quantity=value,{type:"number"}));
}
