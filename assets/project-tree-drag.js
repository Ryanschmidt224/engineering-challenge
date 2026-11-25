import {projectTree} from "./project-tree-model.js";
// Plan a single existing guarded command; a drop never performs a partial move.
export function treeDropPlan(tree,sourceId,targetId,position="inside"){
 const source=tree.placements.get(sourceId),target=targetId?tree.placements.get(targetId):null;
 if(!source||!tree.active(source)||targetId&&(!target||!tree.active(target)))throw Error("Choose an active item in this project.");
 if(sourceId===targetId)return null;
 if(position==="inside"){
  if(target&&!tree.definitions.get(target.item_id).is_assembly)throw Error("Drop inside a subassembly or onto the project.");
  const parentId=target?.id||null;if((source.parent_id||null)===parentId)return null;
  const siblings=(tree.children.get(parentId)||[]).filter(tree.active),sortOrder=Math.max(-1,...siblings.map(row=>row.sort_order))+1;
  projectTree([...tree.definitions.values()],[...tree.placements.values()].map(row=>row.id===sourceId?{...row,parent_id:parentId,sort_order:sortOrder}:row));
  return {path:"/occurrences/"+sourceId,method:"PATCH",data:{parentId,sortOrder}};
 }
 if(!target||(source.parent_id||null)!==(target.parent_id||null))throw Error("To change assemblies, drop onto the middle of an assembly or onto the project.");
 const ids=(tree.children.get(source.parent_id||null)||[]).filter(tree.active).map(row=>row.id),next=ids.filter(id=>id!==sourceId),index=next.indexOf(targetId)+(position==="after"?1:0);next.splice(index,0,sourceId);
 return ids.every((id,index)=>next[index]===id)?null:{path:"/occurrences/"+sourceId+"/reorder",method:"POST",data:{ids:next}};
}
