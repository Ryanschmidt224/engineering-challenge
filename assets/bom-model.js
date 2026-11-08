/* Pure BOM selectors and formatting for the assembly workspace.
 * This module knows nothing about HTML, browser state, or Cloudflare.
 * It does not modify the stored part records or assembly nodes.
 */
(function(root,factory){
 const api=factory();
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 if(root)root.BSBomModel=api;
})(typeof globalThis!=="undefined"?globalThis:null,function(){
 "use strict";
 const isPartNode=node=>node?.kind==="part"&&!!node.partId;

 /** Return this assembly and its nested subassemblies, excluding part-tree links.
  * Null represents the project root. A visited set prevents malformed tree cycles.
  */
 function assemblyIds(nodes,assemblyId=null){
  const included=new Set([assemblyId]);
  const visit=parent=>{
   for(const node of nodes){
    if(node.parentId!==parent||isPartNode(node)||included.has(node.id))continue;
    included.add(node.id);
    visit(node.id);
   }
  };
  visit(assemblyId);
  return included;
 }

 /** Split the visible BOM into purchased parts and presumed on-hand shop materials.
  * Linked part-tree entries remain ordinary BOM items and are not duplicated.
  */
 function selectWorkspaceParts(parts,nodes,assemblyId=null){
  const included=assemblyIds(nodes,assemblyId);
  const visible=parts.filter(part=>included.has(part.assemblyId??null));
  const shopItems=visible.filter(part=>!!part.assumedOnHand);
  const shopIds=new Set(shopItems.map(part=>part.id));
  return {
   included,shopItems,shopIds,
   listItems:visible.filter(part=>!part.assumedOnHand)
  };
 }

 function quantityText(part){
  return part.quantity===null||part.quantity===undefined
   ?"Not specified"
   :String(part.quantity)+(part.quantityUnit?" "+part.quantityUnit:"");
 }

 function assemblyText(part,currentId,nodes){
  if((part.assemblyId??null)===currentId)return currentId===null?"Project":"This assembly";
  return nodes.find(node=>node.id===part.assemblyId)?.name||"Project";
 }

 return Object.freeze({isPartNode,assemblyIds,selectWorkspaceParts,quantityText,assemblyText});
});
