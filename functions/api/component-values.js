// Historical price is entered per part or per package (never a live quote).
// Keep historicalPrice as the derived unit cost for existing BOM calculations.
export const historicalPrice=input=>{
 const raw=Object.prototype.hasOwnProperty.call(input??{},"historicalPurchasePrice")?input.historicalPurchasePrice:input?.historicalPrice;
 const basis=input?.historicalPriceBasis==="per_package"?"per_package":"per_part";
 const countRaw=input?.historicalPackageQuantity;
 if(raw===undefined||raw===null||raw==="")return {price:null,date:null,basis,packageQuantity:null,purchasePrice:null};
 const count=basis==="per_package"?Number(countRaw):1;
 if(basis==="per_package"&&(!Number.isSafeInteger(count)||count<1||count>1000000))return null;
 const purchasePrice=Number(raw);
 const date=input?.historicalPriceDate;
 if(!Number.isFinite(purchasePrice)||purchasePrice<0||purchasePrice>10000000||Math.abs(Math.round(purchasePrice*100)-purchasePrice*100)>1e-6)return null;
 if(typeof date!=="string"||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)return null;
 return {price:purchasePrice/count,date,basis,packageQuantity:basis==="per_package"?count:null,purchasePrice};
};
// BOM quantities may be unspecified or measured in non-piece units.
export const quantityData=(input,previous)=>{
 const raw=input.quantity;
 let quantity;
 if(raw===null||raw===undefined||raw==="")quantity=null;
 else{
  quantity=Number(raw);
  if(!Number.isFinite(quantity)||quantity<=0||quantity>10000000||!Number.isFinite(Number(raw)))return null;
 }
 const unit=input.quantityUnit===undefined?(previous?.quantityUnit??"pcs"):String(input.quantityUnit??"").trim();
 if(unit.length>32||(!/^[a-zA-Z0-9 °µ²³/_-]*$/.test(unit)))return null;
 return {quantity,quantityUnit:unit};
};
