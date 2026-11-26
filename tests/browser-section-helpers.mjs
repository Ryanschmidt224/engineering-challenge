// Open nested disclosures before interacting with their controls.
export async function openDetails(section){
 await section.evaluate(node=>{const parents=[];for(let el=node;el;el=el.parentElement)if(el.tagName==="DETAILS")parents.unshift(el);for(const el of parents)el.open=true;});
}
