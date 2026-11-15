/* DigiKey FastAdd handoff. This does not purchase parts or estimate price.
 * Exact DigiKey order codes and explicit quantities only. */
(function(){
 "use strict";
 const e=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
 const linesFor=parts=>{
  const lines=new Map(),skipped=[];
  for(const part of parts||[]){
   if(part.generatedFrom||part.itemType==="document"||part.isTool||part.assumedOnHand||part.purchaseStatus==="already_have"||part.purchaseStatus==="ignore")continue;
   const offer=(part.supplierOffers||[]).find(offer=>offer.vendor==="digikey"&&offer.sku?.trim());
   if(!offer){skipped.push(part.name||"Unnamed part");continue}
   const qty=part.quantity;
   if(!Number.isSafeInteger(qty)||qty<1||qty>1000000||part.quantityUnit&&part.quantityUnit!=="pcs"){
    skipped.push((part.name||"Unnamed part")+" (specify a whole-piece quantity)");continue
   }
   const sku=offer.sku.trim();
   if(!/^[A-Za-z0-9-]{1,100}$/.test(sku)){skipped.push(part.name+" (invalid DigiKey code)");continue}
   const key=sku.toUpperCase(),old=lines.get(key);
   if(old){
    if(old.qty+qty>1000000){skipped.push(part.name+" (quantity exceeds limit)");continue}
    old.qty+=qty;old.names.push(part.name);
   }else lines.set(key,{sku,qty,names:[part.name]});
  }
  return {lines:[...lines.values()],skipped};
 };
 function render(target,parts){
  target.replaceChildren();
  const {lines,skipped}=linesFor(parts);
  const panel=e("details","bs-bom-purchasing");
  const heading=e("summary","","Purchase parts");panel.append(heading);
  const description=e("p","muted","Send selected DigiKey parts to a cart for review. This does not place an order, check availability or verify prices.");
  panel.append(description);
  if(!lines.length){
   panel.append(e("p","muted","No parts in this assembly have both a DigiKey order code and a valid piece quantity."));
  }else{
   const form=e("form","bs-digikey-cart-form");
   form.method="POST";form.action="https://www.digikey.com/classic/ordering/fastadd.aspx";form.target="_blank";
   const list=e("div","bs-digikey-cart-lines");
   const checked=[];
   for(const line of lines){
    const label=e("label","bs-digikey-cart-row");
    const input=e("input");input.type="checkbox";input.checked=true;
    const name=e("span","",line.names.join(", ")+" · "+line.sku);
    const quantity=e("strong","",String(line.qty)+" pcs");
    label.append(input,name,quantity);list.append(label);checked.push({input,line});
   }
   const submit=e("button","btn primary","Add selected to DigiKey cart");
   submit.type="submit";
   form.append(list,submit);
   const hint=e("p","muted bs-digikey-cart-hint");
   form.append(hint);
   const update=()=>{
    const active=checked.filter(x=>x.input.checked);
    submit.disabled=!active.length;
    hint.textContent=active.length+" distinct supplier code"+(active.length===1?"":"s")+" selected";
   };
   for(const item of checked)item.input.onchange=update;
   form.onsubmit=event=>{
    const active=checked.filter(x=>x.input.checked);
    if(!active.length||active.length>400){event.preventDefault();hint.textContent="Select between 1 and 400 items.";return}
    form.querySelectorAll('input[type="hidden"]').forEach(node=>node.remove());
    active.forEach(({line},index)=>{
     const position=index+1;
     for(const [name,value] of [["part"+position,line.sku],["qty"+position,String(line.qty)]]){
      const field=e("input");field.type="hidden";field.name=name;field.value=value;form.append(field);
     }
    });
    // The browser submits directly to DigiKey from a user click; no cross-origin fetch.
   };
   update();panel.append(form);
  }
  if(skipped.length){
   const exclusions=e("details","bs-digikey-exclusions");
   exclusions.append(e("summary","",skipped.length+" parts not included — missing code, owned, or invalid quantity"));
   const ul=e("ul");for(const name of skipped)ul.append(e("li","",name));
   exclusions.append(ul);panel.append(exclusions);
  }
  target.append(panel);
 }
 window.BSBomPurchasing=Object.freeze({linesFor,render});
})();