/* Shared presentation rules for parts. The server validates persisted values. */
(function(){
 "use strict";
 const progressStatuses=Object.freeze([["not_started","Not started"],["in_progress","In progress"],["complete","Complete"]]);
 const purchaseStatuses=Object.freeze([["not_started","Not started"],["already_have","Already own"],["need_to_buy","Need to buy"],["ignore","Ignore"]]);
 const labelFor=(options,value)=>options.find(row=>row[0]===value)?.[1]||options[0][1];
 const isPurchased=part=>part.partType==="purchased";
 const statusesFor=part=>isPurchased(part)?purchaseStatuses:progressStatuses;
 const statusField=part=>isPurchased(part)?"purchaseStatus":"progressStatus";
 const statusValue=part=>part[statusField(part)]||"not_started";
 const sectionFields=Object.freeze({
  identity:["partNumber","name","itemType","partType","purchaseStatus","description"],
  additional:["quantity","manufacturer","model","category","supplier","asin","historicalPrice"],
  display:["isTool","hideFromFeatureTree"],
  specifications:["specifications"]
 });
 function detailRows(part){
  const qty=part.quantity==null?"Not specified":String(part.quantity)+(part.quantityUnit?" "+part.quantityUnit:"");
  const price=part.partType!=="custom"&&part.historicalPrice!=null&&Number.isFinite(Number(part.historicalPrice))?
   part.historicalPriceBasis==="per_package"?"$"+Number(part.historicalPurchasePrice??0).toFixed(2)+" per package of "+part.historicalPackageQuantity+" ($"+Number(part.historicalPrice).toFixed(4)+" per part)"+(part.historicalPriceDate?" · "+part.historicalPriceDate:""):
   "$"+Number(part.historicalPrice).toFixed(2)+" per part"+(part.historicalPriceDate?" · "+part.historicalPriceDate:""):"";
  const values={
   partNumber:part.partNumber,
   name:part.name,
   itemType:part.itemType==="document"?"Document":"Part",
   partType:labelFor([["purchased","Purchased"],["custom","Custom"],["code","Code"]],part.partType),
   purchaseStatus:isPurchased(part)?labelFor(purchaseStatuses,statusValue(part)):null,
   description:part.description,
   quantity:qty,
   historicalPrice:price,
   manufacturer:part.partType==="custom"?null:part.manufacturer,
   model:part.partType==="custom"?null:part.model,
   category:part.category,
   supplier:part.partType==="custom"?null:part.supplier,
   asin:part.partType==="custom"?null:part.asin,
   isTool:part.isTool?"Yes":null,
   hideFromFeatureTree:part.hideFromFeatureTree?"Yes":null
  };
  const labels={partNumber:"Part number",name:"Part name",itemType:"Item type",partType:"Part type",purchaseStatus:"Status",description:"Description",quantity:"Quantity",historicalPrice:"Historical part price",manufacturer:"Manufacturer",model:"Model",category:"Category",supplier:"Supplier",asin:"ASIN",isTool:"Tool",hideFromFeatureTree:"Hidden from feature tree"};
  return [...sectionFields.identity,...sectionFields.additional,...sectionFields.display].map(key=>[labels[key],values[key]]).filter(([,value])=>value!==null&&value!==undefined&&String(value).trim()!=="");
 }
 window.BSPartFields=Object.freeze({progressStatuses,purchaseStatuses,isPurchased,statusesFor,statusField,statusValue,labelFor,sectionFields,detailRows});
})();
