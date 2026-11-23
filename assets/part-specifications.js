import {partHelp} from "./part-help.js";

// Move existing inputs/buttons; their values, save handlers and revision checks
// remain owned by the part controller. Shared kit owns every new shell/control.
export function initPartSpecifications({parent,specs,projectOnlyPanel,addSpec,supplier,ui,dialogs}){
 const section=ui.section({title:"Specifications",role:"part-specifications",tooltip:partHelp.specifications});
 section.root.classList.add("part-editor-specs-disclosure");
 section.aside.append(dialogs.tooltip("About specifications",partHelp.specifications));
 if(addSpec){addSpec.textContent="+ Add specification";addSpec.classList.remove("btn");addSpec.classList.add("ui-button");addSpec.title=partHelp.specifications;ui.sectionActions(section.body,{primary:addSpec});}
 if(specs)section.body.append(specs);
 if(projectOnlyPanel&&!projectOnlyPanel.hidden)section.body.append(projectOnlyPanel);
 parent.querySelector(".part-editor-specs-disclosure")?.remove();parent.append(section.root);
 const addSupplier=supplier?.querySelector(".bs-supplier-add");
 if(addSupplier){
  addSupplier.classList.remove("btn");addSupplier.classList.add("ui-button");
  let host=supplier.querySelector("[data-supplier-actions]");if(!host){host=document.createElement("div");host.dataset.supplierActions="";supplier.append(host);}
  ui.sectionActions(host,{primary:addSupplier});
 }
 return section;
}
