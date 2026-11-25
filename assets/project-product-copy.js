import {node,button,actions,panel,field,checkbox,requestWorkshop} from "./workshop-ui.js";

export function engineProductSource(item){
 if(!item||item.kind!=="part"||item.is_assembly)throw Error("Choose a project-only off-the-shelf part to copy.");
 return {id:item.id,itemType:"part",partType:"purchased",name:item.name,implementationName:item.fields?.mpn||item.name,manufacturer:item.fields?.manufacturer||"",model:item.fields?.mpn||"",specifications:(item.fields?.specs||[]).map(spec=>({name:spec.label,value:String(spec.value??"")+(spec.unit?" "+spec.unit:"")}))};
}

// Copy physical product identity only. Project purpose, quantity, number,
// schematic annotations, instructions and history never become catalog data.
export function productCopyDraft(part,familyId,id=crypto.randomUUID()) {
 if(part.partType!=="purchased"||part.itemType==="document"||part.generatedFrom||part.familyUse)throw Error("Choose a project-only off-the-shelf part to copy.");
 const specifications=(part.specifications||[]).map(spec=>String(spec.name||"Specification")+": "+String(spec.value??"")+(spec.source==="inferred"?" (inferred)":""));
 const supplier_links=(part.supplierOffers||[]).map(offer=>({supplier:offer.supplierName||offer.vendor||"",part_number:offer.sku||"",url:offer.url||""}));
 if(!supplier_links.length&&part.supplier)supplier_links.push({supplier:part.supplier,part_number:"",url:""});
 return {id,family_id:familyId,name:part.implementationName||part.model||part.name||"",manufacturer:part.manufacturer||"",mpn:part.model||"",supplier_links,field_values:{},notes:specifications.length?"Copied specifications — review and enter applicable family fields:\n"+specifications.join("\n"):""};
}
export function matchingProduct(products,record) {
 const key=value=>String(value||"").trim().toLowerCase();
 if(!key(record.mpn))return null;
 return products.find(product=>!product.archived&&product.family_id===record.family_id&&key(product.mpn)===key(record.mpn)&&(!key(product.manufacturer)||!key(record.manufacturer)||key(product.manufacturer)===key(record.manufacturer)))||null;
}
export async function initProjectProductCopy({params,data,detail,status,onDraft}) {
 const engine=params.get("copyEngineProject"),project=engine||params.get("copyProject"),partId=params.get("copyPart");
 if(!project||!partId)return;
 try {
  const response=await requestWorkshop(engine?"/api/project-engine/projects/"+encodeURIComponent(project)+"/state":"/api/components?project="+encodeURIComponent(project));
  if(engine&&response.selections?.some(selection=>selection.id===partId))throw Error("This part already has a Workshop selection. Open its existing Workshop product instead.");
  const part=engine?engineProductSource(response.items?.find(item=>item.id===partId)):response.components?.find(item=>item.id===partId);
  if(!part)throw Error("The source project part was not found. Return to the project and try again.");
  productCopyDraft(part,"");
  const families=data.families.filter(family=>!family.archived);
  const section=panel("Copy project part to Workshop","projectCopy");
  detail.replaceChildren(section);
  if(!families.length){section.append(node("p","Add a family first, then return to the project and choose Copy to Workshop again.","muted"));return;}
  let familyId="",confirmed=!engine;
  const choice=field("Workshop family","",value=>{familyId=value;message.replaceChildren();},{options:[{value:"",label:"Choose a family"},...families.sort((a,b)=>a.name.localeCompare(b.name)).map(family=>({value:family.id,label:family.name}))]});
  const message=node("div");message.setAttribute("role","status");
  const next=button("Review product copy",()=>{
   if(!confirmed){message.textContent="Confirm that this is an off-the-shelf product before copying it.";return;}
   if(!familyId){message.textContent="Choose a Workshop family.";choice.querySelector("select").focus();return;}
   const draft=productCopyDraft(part,familyId),match=matchingProduct(data.products,draft);
   if(match){const link=node("a","Open existing product","button");const query=new URLSearchParams({product:match.id});if(params.get("return"))query.set("return",params.get("return"));if(params.get("returnProject"))query.set("returnProject",params.get("returnProject"));link.href="workshop.html?"+query;
    message.replaceChildren(node("p","A product with this manufacturer part number already exists in this family. Review it before creating another copy."),actions(link,button("Create another copy",()=>onDraft(familyId,draft),"button--quiet")));return;}
   onDraft(familyId,draft);
  },"button--primary");
  section.append(node("p","Copy physical product identity and specifications into a reviewed draft. Project quantity, purpose, instructions, records and history stay in the project."));if(engine)section.append(checkbox("This is an off-the-shelf product",false,value=>confirmed=value));section.append(choice,actions(next),message);status("Choose a family for the product copy.");
 }catch(error){status("Could not copy project part: "+error.message,true);}
}
