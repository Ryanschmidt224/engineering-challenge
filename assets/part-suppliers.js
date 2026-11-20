/* Purchasing sources are references, not permanent part identities.
 * No prices, availability, or verified product equivalence are inferred.
 */
(function(){
 "use strict";
 const vendors=Object.freeze([
  ["digikey","DigiKey"],["mouser","Mouser"],["mcmaster","McMaster-Carr"],
  ["newark","Newark"],["arrow","Arrow"],["amazon","Amazon"],["other","Other"]
 ]);
 const hosts={
  digikey:["digikey.com"],mouser:["mouser.com"],mcmaster:["mcmaster.com"],
  newark:["newark.com"],arrow:["arrow.com"],amazon:["amazon.com","amazon.ca","amazon.co.uk"]
 };
 const make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e};
 const safeUrl=(vendor,url)=>{
  try{
   const parsed=new URL(url);
   if(parsed.protocol!=="https:"||parsed.username||parsed.password)return null;
   const host=parsed.hostname.toLowerCase();
   if(vendor==="other")return parsed.href;
   if(!hosts[vendor]?.some(base=>host===base||host.endsWith("."+base)))return null;
   return parsed.href;
  }catch{return null}
 };
 const isAsin=value=>/^[A-Z0-9]{10}$/.test(String(value||"").trim().toUpperCase());
 const linkFor=(offer)=>{
  const vendor=String(offer.vendor||""),sku=String(offer.sku||"").trim();
  const url=String(offer.url||"").trim();
  if(url)return safeUrl(vendor,url);
  if(!sku)return null;
  if(vendor==="amazon")return isAsin(sku)?"https://www.amazon.com/dp/"+sku.toUpperCase():null;
  if(vendor==="mcmaster"&&/^[A-Za-z0-9-]{3,40}$/.test(sku))return "https://www.mcmaster.com/"+encodeURIComponent(sku)+"/";
  return searchUrlFor(vendor,sku); // Unmatched codes open supplier search, not an assumed exact product.
 };
 const searchUrlFor=(vendor,term)=>{
  const q=encodeURIComponent(String(term||"").trim().slice(0,150));
  if(!q)return null;
  if(vendor==="digikey")return "https://www.digikey.com/en/products/result?keywords="+q;
  if(vendor==="mouser")return "https://www.mouser.com/c/?q="+q;
  if(vendor==="newark")return "https://www.newark.com/search?st="+q;
  if(vendor==="amazon")return "https://www.amazon.com/s?k="+q;
  return null;
 };
 const labelFor=vendor=>vendors.find(x=>x[0]===vendor)?.[1]||vendor;
 function createEditor(){
  const panel=make("section","bs-supplier-editor");
  panel.dataset.partSuppliers="";
  const title=make("h3","bs-supplier-heading","Where to buy");
  const hint=make("p","muted bs-supplier-hint","Add an ordering code and, when available, a direct product URL. Amazon ASINs are optional links, not permanent part identities.");
  const rows=make("div","bs-supplier-offers");
  const add=make("button","btn bs-supplier-add","+ Add supplier");add.type="button";
  const note=make("p","bs-supplier-validation");note.setAttribute("role","status");
  panel.append(title,hint,rows,add,note);
  function addRow(offer={}){
   if(rows.children.length>=10){note.textContent="Up to 10 suppliers per part.";return}
   const row=make("div","bs-supplier-offer");
   const vendor=make("select","field bs-offer-vendor");
   for(const [value,label] of vendors){const option=make("option","",label);option.value=value;vendor.append(option)}
   vendor.value=vendors.some(x=>x[0]===offer.vendor)?offer.vendor:"digikey";
   vendor.setAttribute("aria-label","Supplier");
   const supplierName=make("input","field bs-offer-name");supplierName.type="text";supplierName.maxLength=120;
   supplierName.placeholder="Supplier name (e.g. JLCPCB)";supplierName.value=offer.supplierName||"";supplierName.setAttribute("aria-label","Custom supplier name");
   const showName=()=>{supplierName.hidden=vendor.value!=="other"};vendor.onchange=showName;showName();
   const sku=make("input","field bs-offer-sku");sku.type="text";sku.maxLength=100;sku.placeholder="Supplier order code / ASIN";sku.value=offer.sku||"";
   sku.setAttribute("aria-label","Supplier order code or Amazon ASIN");
   const url=make("input","field bs-offer-url");url.type="url";url.maxLength=500;url.placeholder="https://… product URL (optional)";url.value=offer.url||"";
   url.setAttribute("aria-label","Supplier product URL");
   const remove=make("button","btn bs-offer-remove","Remove");remove.type="button";
   remove.onclick=()=>{row.remove();note.textContent=""};
   row.append(vendor,supplierName,sku,url,remove);rows.append(row);
  }
  add.onclick=()=>addRow();
  return {
   element:panel,
   setOffers(offers){rows.replaceChildren();note.textContent="";for(const offer of Array.isArray(offers)?offers:[])addRow(offer)},
   getOffers(){
    note.textContent="";
    const offers=[];
    for(const row of rows.children){
     const vendor=row.querySelector(".bs-offer-vendor").value;
     const sku=row.querySelector(".bs-offer-sku").value.trim();
     const url=row.querySelector(".bs-offer-url").value.trim();
     const supplierName=row.querySelector(".bs-offer-name").value.trim();
     if(!sku&&!url&&!(vendor==="other"&&supplierName))continue;
     if(vendor==="amazon"&&sku&&!isAsin(sku)){note.textContent="Amazon codes must be 10-character ASINs.";throw Error(note.textContent)}
     if(url&&!safeUrl(vendor,url)){
      note.textContent=vendor==="other"?"Use a valid HTTPS ordering URL.":"Use an HTTPS URL on the selected supplier's official website.";
      throw Error(note.textContent)
     }
     offers.push({vendor,sku,url,...(vendor==="other"&&supplierName?{supplierName}:{})});
    }
    return offers;
   }
  };
 }
 function renderLinks(target,part){
  const offers=Array.isArray(part.supplierOffers)?part.supplierOffers:[];
  // Legacy records continue to expose their original Amazon ASIN.
  const existingAmazon=offers.some(o=>o.vendor==="amazon"&&o.sku?.toUpperCase()===String(part.asin||"").toUpperCase());
  const data=[...offers];
  if(isAsin(part.asin)&&!existingAmazon)data.push({vendor:"amazon",sku:String(part.asin).toUpperCase(),url:""});
  const usable=data.map(offer=>({offer,url:linkFor(offer)})).filter(x=>x.url);
  if(!usable.length)return;
  const group=make("div","bs-part-buy-links");
  group.append(make("h3","","Where to buy"));
  group.append(make("p","muted","Confirm the exact specifications, availability, price and seller before ordering."));
  const list=make("div","bs-part-buy-options");
  for(const {offer,url} of usable){
   const exact=!!offer.url||offer.vendor==="amazon"&&isAsin(offer.sku)||offer.vendor==="mcmaster";
   const a=make("a","bs-part-buy-link",(exact?"Open ":"Search ")+(offer.supplierName||labelFor(offer.vendor))+(offer.sku?" · "+offer.sku:""));
   a.href=url;a.target="_blank";a.rel="noopener noreferrer nofollow";
   list.append(a);
  }
  group.append(list);target.append(group);
 }
 window.BSPartSuppliers=Object.freeze({vendors,safeUrl,searchUrlFor,linkFor,createEditor,renderLinks});
})();