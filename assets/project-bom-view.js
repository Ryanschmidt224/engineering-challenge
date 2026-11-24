import {projectBOM} from "./project-tree-model.js";
import {dataTable} from "./data-table.js";
import {node} from "./workshop-ui.js";
export function renderProjectBOM(ctx,scope=null){
 const {items,occurrences}=ctx.client.state,rows=projectBOM(items,occurrences,scope),section=window.BSUI.section({title:scope?"Subassembly BOM":"Project BOM",role:"project-bom",open:true}),table=dataTable("Bill of materials",["Part number","Name","Total quantity","Unit"]);
 section.body.append(node("p","Quantities include every active parent subassembly multiplier and all placements of each part. Tools and documents are excluded. Different units remain separate."));
 for(const row of rows){const link=window.BSUI.button(row.item.name,()=>ctx.navigate(ctx.projectId,row.item.id,"part",row.placements[0]),{variant:"quiet"});link.setAttribute("aria-label","Open "+row.item.name);table.append([row.item.part_number,link,String(row.quantity),row.unit]);}section.body.append(table.root);return section.root;
}
