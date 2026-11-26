import {node,panel,button} from "./workshop-ui.js";
export function renderWorkshopProjectUses(host,data,familyId,productId,showArchived=false){
 const current=(data.project_uses||[]).filter(row=>row.family_id===familyId&&(!productId||row.product_id===productId)&&(!row.archived||showArchived));
 if(!current.length)return;
 const section=panel("Project uses");
 for(const use of current){const link=node("a",use.name+" · "+use.project_name+" · "+use.quantity+" "+use.unit+(use.archived?" (archived)":""),"button button--quiet");link.href="project.html?"+new URLSearchParams({project:use.project_id,item:use.item_id,occurrence:use.occurrence_id});section.append(link);}
 if((data.project_uses||[]).length>1000)section.append(node("p","Only the first 1,000 project placements are listed."));host.append(section);
}

export function projectReturnLink(params){
 const value=params.get("returnProject");if(!value)return;try{const url=new URL(value,location.href);if(url.origin!==location.origin||url.pathname!=="/project.html")return;const link=document.querySelector("#return-project");link.hidden=false;link.href=url.pathname+url.search;}catch{}
}
