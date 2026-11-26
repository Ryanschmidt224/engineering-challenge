import {overviewSections} from "./project-summary-content.js";
import {costSection} from "./project-summary-cost.js";
import {node} from "./workshop-ui.js";
import {dataTable} from "./data-table.js";
import {projectTree,projectBOM} from "./project-tree-model.js";

export function summaryParts(state){
 const tree=projectTree(state.items,state.occurrences),active=state.occurrences.filter(tree.active),tools=new Map();
 for(const placement of active){const item=tree.definitions.get(placement.item_id);if(item.is_tool&&!tools.has(item.id))tools.set(item.id,{item,placement});}
 return {bom:projectBOM(state.items,state.occurrences),tools:[...tools.values()].sort((a,b)=>a.item.name.localeCompare(b.item.name,undefined,{numeric:true}))};
}
export function projectSummary(ctx){
 const {bom,tools}=summaryParts(ctx.client.state),root=node("div","","project-stack"),materials=window.BSUI.section({title:"Project BOM",role:"summary-bom",count:bom.length,countLabel:["part","parts"]}),table=dataTable("Summary bill of materials",["Part number","Name","Total quantity","Unit"]),equipment=window.BSUI.section({title:"Tools needed",role:"summary-tools",count:tools.length,countLabel:["tool","tools"]});
 window.BSUI.sectionActions(materials.body,{primary:window.BSUI.button("Open BOM",()=>ctx.navigate(ctx.projectId,null,"bom"))});
 for(const row of bom)table.append([row.item.part_number,window.BSUI.button(row.item.name,()=>ctx.navigate(ctx.projectId,row.item.id,"part",row.placements[0]),{variant:"quiet"}),row.quantity,row.unit]);if(bom.length)materials.body.append(table.root);
 for(const {item,placement}of tools)equipment.body.append(window.BSUI.button(item.name+" · "+item.part_number,()=>ctx.navigate(ctx.projectId,item.id,"part",placement.id),{variant:"quiet"}));const sections=overviewSections(ctx);root.append(sections.summary,costSection(ctx,bom),sections.intent,materials.root,equipment.root,sections.notes);return root;
}
