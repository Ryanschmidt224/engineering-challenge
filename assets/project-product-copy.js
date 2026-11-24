import {node,button,actions,panel,field,requestWorkshop} from "./workshop-ui.js";

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
 const project=params.get("copyProject"),partId=params.get("copyPart");
 if(!project||!partId)return;
 try {
  const response=await requestWorkshop("/api/components?project="+encodeURIComponent(project));
  const part=response.components?.find(item=>item.id===partId);
  if(!part)throw Error("The source project part was not found. Return to the project and try again.");
  productCopyDraft(part,"");
  const families=data.families.filter(family=>!family.archived);
  const section=panel("Copy project part to Workshop","projectCopy");
  detail.replaceChildren(section);
  if(!families.length){section.append(node("p","Add a family first, then return to the project and choose Copy to Workshop again.","muted"));return;}
  let familyId="";
  const choice=field("Workshop family","",value=>{familyId=value;message.replaceChildren();},{options:[{value:"",label:"Choose a family"},...families.sort((a,b)=>a.name.localeCompare(b.name)).map(family=>({value:family.id,label:family.name}))]});
  const message=node("div");message.setAttribute("role","status");
  const next=button("Review product copy",()=>{
   if(!familyId){message.textContent="Choose a Workshop family.";choice.querySelector("select").focus();return;}
   const draft=productCopyDraft(part,familyId),match=matchingProduct(data.products,draft);
   if(match){const link=node("a","Open existing product","button");const query=new URLSearchParams({product:match.id});if(params.get("return"))query.set("return",params.get("return"));link.href="workshop.html?"+query;
    message.replaceChildren(node("p","A product with this manufacturer part number already exists in this family. Review it before creating another copy."),actions(link,button("Create another copy",()=>onDraft(familyId,draft),"button--quiet")));return;}
   onDraft(familyId,draft);
  },"button--primary");
  section.append(choice,actions(next),message);status("Choose a family for the product copy.");
 }catch(error){status("Could not copy project part: "+error.message,true);}
}
