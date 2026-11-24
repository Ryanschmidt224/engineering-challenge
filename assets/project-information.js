import {legacyRecordContext} from "./project-record-context.js";
import {node} from "./workshop-ui.js";
import {formatRevisionValue} from "./project-item-model.js";
import {recordPrompts,recordLabels} from "./project-record-model.js";
import {projectHelp} from "./project-help.js";
import {renderHistoryEntryDetails} from "./history-entry-dialog.js";
export function information(title,values){const panel=window.BSUI.informationPanel(title);for(const [label,value]of values)if(value!==undefined&&value!==null&&value!=="")panel.body.append(window.BSUI.fieldRow(label,value).root);return panel.root;}
export function configurationView(configuration,title="Saved configuration",{includeBuild=true}={}){
 const snapshot=configuration?.snapshot;if(!snapshot?.item)return node("p","The transaction proof has no full item snapshot.");
 const item=snapshot.item,fields=item.fields||{},body=node("div","","project-stack");const panel=information(title,[["Revision",item.revision_level],["Name",item.name],["Part number",item.part_number],["Description",fields.description],["Purpose",fields.purpose],["Acceptance criteria",fields.acceptance],["Manufacturer",fields.manufacturer],["Manufacturer part number",fields.mpn]]);body.append(panel);
 if(fields.specs?.length)for(const row of fields.specs)panel.querySelector(".ui-information-panel__body").append(window.BSUI.fieldRow(row.label,formatRevisionValue({present:Object.hasOwn(row,"value"),value:row.value,label:row.label,unit:row.unit})).root);
 if(includeBuild&&snapshot.occurrence)body.append(information(snapshot.format===1?"Legacy build information":"Build information",[["Quantity",snapshot.occurrence.quantity+" "+snapshot.occurrence.unit],["Status",snapshot.occurrence.build_status?.replaceAll("_"," ")],["Original project",snapshot.occurrence.root?.name]]));
 if(snapshot.selection)body.append(information("Frozen Workshop selection",[["Family",snapshot.selection.snapshot.family.name],["Product",snapshot.selection.snapshot.product?.name||"Generic family"],["Family revision",snapshot.selection.family_revision],["Product source revision",snapshot.selection.product_revision]]));
 for(const child of snapshot.composition||[]){const design=child.design||child.snapshot;if(!design?.item)continue;const section=window.BSUI.section({title:design.item.name+" · "+design.item.part_number,role:"saved-composition"});if(child.quantity!==undefined)section.body.append(information("Component use",[["Quantity",child.quantity+" "+child.unit]]));section.body.append(configurationView({snapshot:design},"Frozen child configuration"));body.append(section.root);}return body;
}
export function fileLink(ctx,file){const link=node("a",file.name);link.href="/api/project-engine/projects/"+ctx.projectId+"/files/"+file.id;link.download=file.name;return link;}

export function buildContextView(context,title="Build context when recorded"){
 const build=context.occurrence||{},body=node("div","","project-stack");
 body.append(information(title,[["Part revision",context.part?.revision_level],["Quantity",build.quantity===undefined?undefined:[build.quantity,build.unit].filter(value=>value!==undefined).join(" ")],["Status",build.build_status?.replaceAll("_"," ")],["Needs attention",typeof build.attention==="boolean"?(build.attention?"Yes":"No"):undefined],["Attention note",build.attention_note],["Hidden in tree",typeof build.hidden==="boolean"?(build.hidden?"Yes":"No"):undefined],["Project when recorded",context.project?.name]]));
 for(const child of context.composition||[])body.append(information(child.item?.name||"Saved component",[["Part number",child.item?.part_number],["Part revision",child.item?.revision_level],["Quantity",child.quantity+" "+child.unit],["Status",child.build_status?.replaceAll("_"," ")],["Needs attention",child.attention?"Yes":"No"],["Hidden in tree",child.hidden?"Yes":"No"]]));
 return body;
}

export function recordVersionView(ctx,value,title,files){
 const ids=value.fileIds,links=node("div","","project-stack");for(const id of ids||[]){const file=files.find(file=>file.id===id);links.append(file?fileLink(ctx,file):node("span","Unavailable attachment "+id));}
 return information(title,[["Record type",recordLabels[value.type]||value.type],["Title",value.title],...Object.entries(recordPrompts[value.type]||{}).map(([key,label])=>[label,value.fields[key]]),...(value.type==="problem"?[["Status",value.fields.status]]:[]),["Event date",value.event_date||"Not set"],["Attachments",ids?(ids.length?links:"None"):undefined]]);
}

function appendSavedRecords(ctx,body,snapshot){
 for(const record of snapshot.records||[]){
  const fileIds=snapshot.file_links?snapshot.file_links.filter(link=>link.record_id===record.id&&link.active).map(link=>link.file_id):undefined;
  body.append(recordVersionView(ctx,{...record,fileIds},record.title,snapshot.files||[]));
  if(record.step_snapshot)body.append(information("Step when recorded",[["Title",record.step_snapshot.title],["Instructions",record.step_snapshot.body]]));
  const captured=snapshot.record_events?.find(entry=>entry.payload.record_id===record.id),config=snapshot.configurations?.find(row=>row.id===record.configuration_id);
  const context=captured?.payload.record_context||legacyRecordContext(config?.snapshot);
  if(context)body.append(buildContextView(context,context.legacy?"Build context from legacy snapshot":"Build context when recorded"));
  if(config){const tested=window.BSUI.section({title:"Configuration when recorded"});tested.body.append(node("p",projectHelp.testedConfiguration),configurationView(config,undefined,{includeBuild:!context}));body.append(tested.root);}
  for(const edit of snapshot.record_events?.filter(entry=>entry.payload.edited_record_id===record.id)||[]){
   const saved=window.BSUI.section({title:edit.title}),versions=edit.payload.record_edit;
   if(versions)saved.body.append(recordVersionView(ctx,versions.before,"Before edit",snapshot.files||[]),recordVersionView(ctx,versions.after,"After edit",snapshot.files||[]),information("Edit information",[["Edited by",edit.payload.actor_id],["Recorded",new Date(edit.created_at).toLocaleString()]]));
   body.append(saved.root);
  }
 }
}

export function savedPartView(ctx,event){
 const snapshot=event.payload.snapshot,body=node("div","","project-stack");
 renderHistoryEntryDetails(event.payload.entryDetails,body,{ui:window.BSUI,archive:event.type==="archived",imageUrlFor:id=>"/api/project-engine/projects/"+ctx.projectId+"/files/"+id+"?inline=1"});
 body.append(configurationView({snapshot},"Saved part information"));
 for(const step of snapshot.steps||[])body.append(information(step.title,[["Instructions",step.body],["State",step.retired_at?"Retired":null]]));
 appendSavedRecords(ctx,body,snapshot);
 for(const child of snapshot.parts||[]){const section=window.BSUI.section({title:child.item.name+" · "+child.item.part_number,role:"saved-subassembly-part"});section.body.append(configurationView({snapshot:child},"Saved component"));for(const step of child.steps||[])section.body.append(information(step.title,[["Instructions",step.body],["State",step.retired_at?"Retired":null]]));appendSavedRecords(ctx,section.body,child);for(const file of child.files||[])section.body.append(fileLink(ctx,file));body.append(section.root);}
 for(const file of snapshot.files||[])body.append(fileLink(ctx,file));return body;
}
