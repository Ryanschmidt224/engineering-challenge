import {node} from "./workshop-ui.js";
import {formatRevisionValue} from "./project-item-model.js";
import {recordPrompts} from "./project-record-model.js";
import {projectHelp} from "./project-help.js";
import {renderHistoryEntryDetails} from "./history-entry-dialog.js";
export function information(title,values){const panel=window.BSUI.informationPanel(title);for(const [label,value]of values)if(value!==undefined&&value!==null&&value!=="")panel.body.append(window.BSUI.fieldRow(label,value).root);return panel.root;}
export function configurationView(configuration,title="Saved configuration",{includeBuild=true}={}){
 const snapshot=configuration?.snapshot;if(!snapshot?.item)return node("p","The transaction proof has no full item snapshot.");
 const item=snapshot.item,fields=item.fields||{},body=node("div","","project-stack");const panel=information(title,[["Revision",item.revision_level],["Name",item.name],["Part number",item.part_number],["Description",fields.description],["Purpose",fields.purpose],["Acceptance criteria",fields.acceptance],["Manufacturer",fields.manufacturer],["Manufacturer part number",fields.mpn]]);body.append(panel);
 if(fields.specs?.length)for(const row of fields.specs)panel.querySelector(".ui-information-panel__body").append(window.BSUI.fieldRow(row.label,formatRevisionValue({present:Object.hasOwn(row,"value"),value:row.value,label:row.label,unit:row.unit})).root);
 if(includeBuild&&snapshot.occurrence)body.append(information("Build information",[["Quantity",snapshot.occurrence.quantity+" "+snapshot.occurrence.unit],["Status",snapshot.occurrence.build_status.replaceAll("_"," ")],["Original project",snapshot.occurrence.root.name]]));
 if(snapshot.selection)body.append(information("Frozen Workshop selection",[["Family",snapshot.selection.snapshot.family.name],["Product",snapshot.selection.snapshot.product?.name||"Generic family"],["Family revision",snapshot.selection.family_revision],["Product source revision",snapshot.selection.product_revision]]));
 for(const child of snapshot.composition||[]){if(!child.snapshot)continue;const section=window.BSUI.section({title:child.snapshot.item.name+" · "+child.snapshot.item.part_number,role:"saved-composition"});section.body.append(configurationView(child,"Frozen child configuration"));body.append(section.root);}return body;
}
export function fileLink(ctx,file){const link=node("a",file.name);link.href="/api/project-engine/projects/"+ctx.projectId+"/files/"+file.id;link.download=file.name;return link;}

function savedRecordView(record,configurations=[]){
 const body=node("div","","project-stack");body.append(information(record.title,Object.entries(recordPrompts[record.type]||{}).map(([key,label])=>[label,record.fields[key]])));
 const configuration=configurations.find(row=>row.id===record.configuration_id);if(configuration){const tested=window.BSUI.section({title:"Configuration when recorded",role:"recorded-configuration"});tested.body.append(node("p",projectHelp.testedConfiguration),configurationView(configuration,"Recorded part configuration"));if(record.step_snapshot)tested.body.append(information("Step when recorded",[["Title",record.step_snapshot.title],["Instructions",record.step_snapshot.body]]));body.append(tested.root);}return body;
}

export function savedPartView(ctx,event){
 const snapshot=event.payload.snapshot,body=node("div","","project-stack");
 renderHistoryEntryDetails(event.payload.entryDetails,body,{ui:window.BSUI,archive:event.type==="archived",imageUrlFor:id=>"/api/project-engine/projects/"+ctx.projectId+"/files/"+id+"?inline=1"});
 body.append(configurationView({snapshot},"Saved part information"));
 for(const step of snapshot.steps||[])body.append(information(step.title,[["Instructions",step.body],["State",step.retired_at?"Retired":null]]));
 for(const record of snapshot.records||[])body.append(savedRecordView(record,snapshot.configurations));
 for(const child of snapshot.parts||[]){const section=window.BSUI.section({title:child.item.name+" · "+child.item.part_number,role:"saved-subassembly-part"});section.body.append(configurationView({snapshot:child},"Saved component"));for(const step of child.steps||[])section.body.append(information(step.title,[["Instructions",step.body]]));for(const record of child.records||[])section.body.append(savedRecordView(record,child.configurations));for(const file of child.files||[])section.body.append(fileLink(ctx,file));body.append(section.root);}
 for(const file of snapshot.files||[])body.append(fileLink(ctx,file));return body;
}
