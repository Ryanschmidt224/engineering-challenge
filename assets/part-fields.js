/* Shared presentation rules for parts. The server validates persisted values. */
(function(){
 "use strict";
 const progressStatuses=Object.freeze([["not_started","Not started"],["in_progress","In progress"],["complete","Complete"]]);
 const purchaseStatuses=Object.freeze([["not_started","Not started"],["already_have","Already own"],["need_to_buy","Need to buy"],["ignore","Ignore"]]);
 const labelFor=(options,value)=>options.find(row=>row[0]===value)?.[1]||options[0][1];
 // Legacy records without a partType are off-the-shelf parts. Documents and
 // Code always use workflow progress, never inventory purchasing status.
 const partTypeFor=part=>["custom","code"].includes(part?.partType)?part.partType:"purchased";
 const itemTypeFor=part=>partTypeFor(part)==="code"?"code":part?.itemType==="document"?"document":"part";
 const isPurchased=part=>itemTypeFor(part)==="part"&&partTypeFor(part)==="purchased";
 const statusesFor=part=>isPurchased(part)?purchaseStatuses:progressStatuses;
 const statusField=part=>isPurchased(part)?"purchaseStatus":"progressStatus";
 const statusValue=part=>part[statusField(part)]||"not_started";
 const sourcingLabels=["Supplier URL","Reference price","Quantity per package"];
 function priceInUsd(value){
  const raw=String(value??"").trim();
  if(!/^\$?\s*(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?(?:\s*USD)?$/i.test(raw))return null;
  const amount=Number(raw.replace(/[$,]|USD/gi,"").trim());
  return Number.isFinite(amount)?amount:null;
 }
 function sourcingFor(part){
  const empty={url:"",price:"",packageSize:"",unitCost:null,source:""};
  if(!isPurchased(part))return empty;
  const specification=name=>(part.specifications||[]).find(spec=>spec.name===name)?.value;
  const workshop=part.workshopSourcing||{};
  const url=[...(part.supplierOffers||[]).map(offer=>offer.url),specification(sourcingLabels[0]),workshop.url].find(value=>{
   try{const parsed=new URL(value);return parsed.protocol==="https:"&&!parsed.username&&!parsed.password}catch{return false}
  })||"";
  const rawPrice=specification(sourcingLabels[1])||workshop.price||"";
  const pack=specification(sourcingLabels[2])||workshop.packageQuantity||"";
  const count=/^(\d+)(?:\s*(?:pcs?\.?|pieces?|units?))?$/i.exec(String(pack).trim());
  const numericCount=count?Number(count[1]):null;
  const packageCount=Number.isSafeInteger(numericCount)&&numericCount>0?numericCount:null;
  const historical=priceInUsd(part.historicalPrice);
  const reference=priceInUsd(rawPrice);
  const dollars=new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:4});
  if(historical!==null){
   const recordedPack=part.historicalPriceBasis==="per_package"&&part.historicalPackageQuantity>0?part.historicalPackageQuantity:null;
   const purchase=recordedPack?priceInUsd(part.historicalPurchasePrice)??historical*recordedPack:historical;
   return {url,unitCost:historical,packageSize:recordedPack||pack,source:"historical",
    price:dollars.format(purchase)+(recordedPack?" per package":" per unit")+" · recorded"+(part.historicalPriceDate?" "+part.historicalPriceDate:"")};
  }
  return {url,price:rawPrice?(reference===null?rawPrice:dollars.format(reference)+(pack?" per package":" per unit"))+" · Workshop reference":"",
   packageSize:pack,unitCost:reference!==null&&(!pack||packageCount)?reference/(packageCount||1):null,source:"workshop"};
 }
 function estimateCost(parts){
  let total=0,priced=0,workshop=0;
  const materials=parts.filter(part=>!part.isTool&&itemTypeFor(part)==="part");
  for(const part of materials){
   const {unitCost,source}=sourcingFor(part),quantity=Number(part.quantity);
   if(unitCost===null||!Number.isFinite(quantity)||quantity<=0)continue;
   total+=unitCost*quantity;
   priced++;
   if(source==="workshop")workshop++;
  }
  return {total,priced,workshop,materials:materials.length};
 }
 const sectionFields=Object.freeze({
  identity:["partNumber","name","itemType","partType","purchaseStatus","description"],
  additional:["quantity","manufacturer","model","category","supplier","asin","historicalPrice"],
  display:["isTool","hideFromFeatureTree"],
  specifications:["specifications"]
 });
 function detailRows(part){
  const qty=part.quantity==null?"Not specified":String(part.quantity)+(part.quantityUnit?" "+part.quantityUnit:"");
  const values={
   partNumber:part.partNumber,
   name:part.name,
   itemType:labelFor([["part","Part"],["document","Document"],["code","Code"]],itemTypeFor(part)),
   partType:partTypeFor(part)==="code"?null:labelFor([["purchased","Off-the-shelf"],["custom","Custom"]],partTypeFor(part)),
   purchaseStatus:labelFor(statusesFor(part),statusValue(part)),
   description:part.description,
   quantity:qty,
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
 window.BSPartFields=Object.freeze({progressStatuses,purchaseStatuses,partTypeFor,itemTypeFor,isPurchased,statusesFor,statusField,statusValue,labelFor,sectionFields,detailRows,sourcingLabels,sourcingFor,estimateCost});
})();
