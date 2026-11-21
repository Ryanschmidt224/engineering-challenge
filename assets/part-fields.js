/* Shared presentation rules for parts. The server validates persisted values. */
(function(){
 "use strict";
 const progressStatuses=Object.freeze([["not_started","Not started"],["in_progress","In progress"],["complete","Complete"]]);
 const purchaseStatuses=Object.freeze([["not_started","Not started"],["already_have","Already own"],["need_to_buy","Need to buy"],["ignore","Ignore"]]);
 const labelFor=(options,value)=>options.find(row=>row[0]===value)?.[1]||options[0][1];
 // Legacy records without a partType are off-the-shelf parts. Documents and
 // Code always use workflow progress, never inventory purchasing status.
 const partTypeFor=part=>["custom","custom_purchased","code"].includes(part?.partType)?part.partType:"purchased";
 const itemTypeFor=part=>partTypeFor(part)==="code"?"code":part?.itemType==="document"?"document":"part";
 const isPurchased=part=>itemTypeFor(part)==="part"&&["purchased","custom_purchased"].includes(partTypeFor(part));
 const statusesFor=part=>isPurchased(part)?purchaseStatuses:progressStatuses;
 const statusField=part=>isPurchased(part)?"purchaseStatus":"progressStatus";
 const statusValue=part=>part[statusField(part)]||"not_started";
 const valueFor=part=>String(part?.projectDetails?.value||"").trim();
 // Project-owned purpose label: never infer it from Workshop classification or an MPN.
 const treeDescriptionFor=part=>String(part?.projectDetails?.featureTreeName||"").trim();
 const displayValue=part=>{
  const value=valueFor(part);
  return /resistor/i.test(part?.name||"")&&/^\d+(?:\.\d+)?\s*[kKmM]?$/.test(value)?value+"Ω":value;
 };
 const displayName=part=>[part?.name,displayValue(part)].filter(Boolean).join(" - ");
 // The project number belongs to the functional part, not the selected solution.
 // Accept older names already prefixed with the same number without duplicating it.
 const numberedName=part=>{
  const label=displayName(part),number=String(part?.partNumber||"").trim();
  if(!number)return label;
  const remainder=label.slice(number.length);
  const alreadyNumbered=label.slice(0,number.length).toUpperCase()===number.toUpperCase()&&
   /^(?:\s*(?:[-–—·:]\s*|$))/.test(remainder);
  return alreadyNumbered?label:number+" · "+label;
 };
 // Keep part numbers attached to the permanent project requirement, while the
 // physical component remains a separate, independently replaceable selection.
 const numberedFunctionalName=part=>{
  if(!part)return "";
  if(itemTypeFor(part)!=="part"||part.generatedFrom)return numberedName(part);
  const name=treeDescriptionFor(part)||String(part.name||"").trim();
  return numberedName({...part,name,projectDetails:{value:""}});
 };
 const implementationLabelFor=part=>{
  if(!part||itemTypeFor(part)!=="part"||part.generatedFrom)return "";
  if(part.implementationResolved===false)return "No component selected";
  return String(part.implementationName||part.model||part.name||"").trim();
 };
 const sourcingLabels=["Supplier URL","Reference price","Quantity per package"];
 function priceInUsd(value){
  const raw=String(value??"").trim();
  if(!/^\$?\s*(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?(?:\s*USD)?$/i.test(raw))return null;
  const amount=Number(raw.replace(/[$,]|USD/gi,"").trim());
  return Number.isFinite(amount)?amount:null;
 }
 function sourcingFor(part){
  const empty={url:"",price:"",packageSize:"",packageCount:null,unitCost:null,packageCost:null,source:""};
  if(!isPurchased(part))return empty;
  const specification=name=>(part.specifications||[]).find(spec=>spec.name===name)?.value;
  const workshop=part.workshopSourcing||{};
  const url=[...(part.supplierOffers||[]).map(offer=>offer.url),specification(sourcingLabels[0]),workshop.url].find(value=>{
   try{const parsed=new URL(value);return parsed.protocol==="https:"&&!parsed.username&&!parsed.password}catch{return false}
  })||"";
  const rawPrice=workshop.price||specification(sourcingLabels[1])||"";
  const pack=workshop.packageQuantity||specification(sourcingLabels[2])||"";
  const count=/^(\d+)(?:\s*(?:pcs?\.?|pieces?|units?))?$/i.exec(String(pack).trim());
  const numericCount=count?Number(count[1]):null;
  const packageCount=Number.isSafeInteger(numericCount)&&numericCount>0?numericCount:null;
  const historical=priceInUsd(part.historicalPrice);
  const reference=priceInUsd(rawPrice);
  const dollars=new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:4});
  if(historical!==null){
   const recordedPack=part.historicalPriceBasis==="per_package"&&part.historicalPackageQuantity>0?part.historicalPackageQuantity:null;
   const purchase=recordedPack?priceInUsd(part.historicalPurchasePrice)??historical*recordedPack:historical;
   return {url,unitCost:historical,packageCount:recordedPack||packageCount,packageCost:recordedPack?purchase:packageCount?historical*packageCount:null,packageSize:recordedPack||pack,source:"historical",
    price:dollars.format(purchase)+(recordedPack?" per package":" per unit")+" · recorded"+(part.historicalPriceDate?" "+part.historicalPriceDate:"")};
  }
  return {url,price:rawPrice?(reference===null?rawPrice:dollars.format(reference)+(pack?" per package":" per unit"))+" · Workshop reference":"",
   packageSize:pack,packageCount,packageCost:pack?reference:null,unitCost:reference!==null&&(!pack||packageCount)?reference/(packageCount||1):null,source:"workshop"};
 }
 function estimateCost(parts){
  let total=0,priced=0,workshop=0,priceAvailable=0,packageTotal=0,packagePriced=0,missingQuantity=0,missingPrice=0;
  const packages=new Map();
  const materials=parts.filter(part=>!part.isTool&&itemTypeFor(part)==="part");
  for(const part of materials){
   const {unitCost,source,packageCount,packageCost,url}=sourcingFor(part),quantity=Number(part.quantity);
   if(unitCost!==null)priceAvailable++;
   if(!Number.isFinite(quantity)||quantity<=0){missingQuantity++;continue}
   if(unitCost===null){missingPrice++;continue}
   total+=unitCost*quantity;
   priced++;
   if(source==="workshop")workshop++;
   if(packageCount&&packageCost!==null){
    const identity=part.projectDetails?.workshopReferenceId||part.sharedPartRef||url||
     (part.model?[part.manufacturer,part.model,part.supplier].join("|"):part.id||String(packagePriced));
    const key=JSON.stringify([identity,valueFor(part),packageCount,packageCost,part.quantityUnit||"pcs"]);
    const group=packages.get(key)||{quantity:0,packageCount,packageCost};
    group.quantity+=quantity;packages.set(key,group);packagePriced++;
   }
  }
  for(const group of packages.values())packageTotal+=Math.ceil(group.quantity/group.packageCount)*group.packageCost;
  return {total,priced,workshop,priceAvailable,materials:materials.length,packageTotal,packagePriced,missingQuantity,missingPrice};
 }
 const sectionFields=Object.freeze({
  identity:["partNumber","name","itemType","partType","purchaseStatus","description"],
  additional:["quantity","manufacturer","model","category","supplier","asin","historicalPrice"],
  display:["isTool","hideFromFeatureTree"],
  specifications:["specifications"]
 });
 function documentationLinks(part){
  const links=new Map();
  const candidates=[
   ...(Array.isArray(part.workshopDocumentation)?part.workshopDocumentation:[]),
   ...(part.specifications||[]).filter(spec=>/documentation|datasheet|manual/i.test(spec.name||"")).map(spec=>({label:spec.name,url:spec.value}))
  ];
  for(const entry of candidates){
   const urls=String(entry.url||"").match(/https:\/\/[^\s<>"]+/gi)||[];
   for(const raw of urls){
    try{
     const url=new URL(raw);
     if(url.protocol!=="https:"||url.username||url.password)continue;
     if(!links.has(url.href))links.set(url.href,{label:entry.label||"Documentation",url:url.href});
    }catch{}
   }
  }
  return [...links.values()];
 }
 function supplierLines(part){
  if(part.partType==="custom")return [];
  const suppliers=new Map();
  const add=(name,code="",amazon=false)=>{
   name=String(name||"").trim();code=String(code||"").trim();
   if(!name&&!code)return;
   const text=[name||"Supplier",code?(amazon?"ASIN ":"")+code:""].filter(Boolean).join(" · ");
   suppliers.set(text.toLowerCase(),text);
  };
  const code=part.workshopSourcing?.supplierPartNumber||(part.specifications||[]).find(spec=>spec.name==="Supplier part number")?.value||"";
  const offers=part.supplierOffers||[];
  const labels={digikey:"DigiKey",mouser:"Mouser",newark:"Newark",arrow:"Arrow",amazon:"Amazon",mcmaster:"McMaster-Carr",other:"Other"};
  const matching=offers.filter(offer=>(offer.supplierName||labels[offer.vendor]||offer.vendor).toLowerCase()===String(part.supplier||"").toLowerCase());
  if(part.supplier&&(!matching.length||code))add(part.supplier,/amazon/i.test(part.supplier)?part.asin||code:code,/amazon/i.test(part.supplier));
  for(const offer of offers)add(offer.supplierName||labels[offer.vendor]||offer.vendor,offer.sku||(offer.vendor==="amazon"?part.asin:""),offer.vendor==="amazon");
  if(!part.supplier&&!offers.length&&code)add("",code);
  if(part.asin&&!offers.some(offer=>offer.vendor==="amazon"&&offer.sku===part.asin)&&!/amazon/i.test(part.supplier||""))add("Amazon",part.asin,true);
  return [...suppliers.values()];
 }
 function detailRows(part){
  const qty=part.quantity==null?"Not specified":String(part.quantity)+(part.quantityUnit?" "+part.quantityUnit:"");
  const sourcing=sourcingFor(part);
  const values={
   value:displayValue(part),featureTreeDescription:treeDescriptionFor(part),packageSize:sourcing.packageSize,cost:sourcing.price,
   partNumber:part.partNumber,
   name:part.name,
   itemType:labelFor([["part","Part"],["document","Document"],["code","Code"]],itemTypeFor(part)),
   partType:partTypeFor(part)==="code"?null:labelFor([["purchased","Off-the-shelf"],["custom","Custom — made in-house"],["custom_purchased","Custom — purchased"]],partTypeFor(part)),
   purchaseStatus:labelFor(statusesFor(part),statusValue(part)),
   description:part.description,
   quantity:qty,
   manufacturer:part.partType==="custom"?null:part.manufacturer,
   model:part.partType==="custom"?null:part.model,
   category:part.category,
   supplier:part.partType==="custom"?null:part.supplier||(part.supplierOffers||[]).find(offer=>offer.supplierName)?.supplierName,
   asin:part.partType==="custom"?null:part.asin,
   isTool:part.isTool?"Yes":null,
   hideFromFeatureTree:part.hideFromFeatureTree?"Yes":null
  };
  const labels={value:"Value",featureTreeDescription:"Feature tree description",packageSize:"Package size",cost:"Cost",partNumber:"Part number",name:"Part name",itemType:"Item type",partType:"Part type",purchaseStatus:"Status",description:"Description",quantity:"Quantity",historicalPrice:"Historical part price",manufacturer:"Manufacturer",model:"Mfg part number",category:"Category",supplier:"Supplier",asin:"ASIN",isTool:"Tool",hideFromFeatureTree:"Hidden from feature tree"};
  const ordered=["name","value","featureTreeDescription","purchaseStatus","quantity","supplier","partNumber","asin","packageSize","cost"];
  const remaining=[...sectionFields.identity,...sectionFields.additional,...sectionFields.display].filter(key=>!ordered.includes(key));
  return [...ordered,...remaining].flatMap(key=>key==="supplier"?supplierLines(part).map(value=>["Supplier",value]):key==="asin"?[]:[[labels[key],values[key]]]).filter(([,value])=>value!==null&&value!==undefined&&String(value).trim()!=="");
 }
 window.BSPartFields=Object.freeze({progressStatuses,purchaseStatuses,partTypeFor,itemTypeFor,isPurchased,statusesFor,statusField,statusValue,labelFor,sectionFields,detailRows,documentationLinks,valueFor,displayValue,displayName,numberedName,numberedFunctionalName,implementationLabelFor,treeDescriptionFor,sourcingLabels,sourcingFor,estimateCost});
})();
