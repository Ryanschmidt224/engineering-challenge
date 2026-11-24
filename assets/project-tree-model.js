// Shared deterministic tree rules. Items own engineering definitions; occurrences
// own placement, quantity and build state. A placement has exactly one parent.
export const MAX_PROJECT_PLACEMENTS=1000,MAX_SUBTREE=100,MAX_TREE_DEPTH=20;
export function projectTree(items,occurrences){
 const definitions=new Map(items.map(row=>[row.id,row])),placements=new Map(occurrences.map(row=>[row.id,row]));
 if(placements.size!==occurrences.length||occurrences.length>MAX_PROJECT_PLACEMENTS)throw Error("This preview supports at most 1,000 distinct placements.");
 const children=new Map();for(const row of occurrences){
  if(!definitions.has(row.item_id))throw Error("A placement has no part definition.");
  if(row.parent_id&&(!placements.has(row.parent_id)||!definitions.get(placements.get(row.parent_id).item_id)?.is_assembly))throw Error("Choose a subassembly in this project.");
  const path=new Set([row.id]),assemblyIds=new Set(definitions.get(row.item_id).is_assembly?[row.item_id]:[]);let parent=placements.get(row.parent_id);while(parent){if(path.has(parent.id)||assemblyIds.has(parent.item_id))throw Error("An assembly cannot contain itself.");path.add(parent.id);assemblyIds.add(parent.item_id);if(path.size>MAX_TREE_DEPTH)throw Error("Use at most 20 assembly levels.");parent=placements.get(parent.parent_id);}
  const parentId=row.parent_id||null;if(!children.has(parentId))children.set(parentId,[]);children.get(parentId).push(row);
 }
 for(const rows of children.values())rows.sort((a,b)=>a.sort_order-b.sort_order||a.id.localeCompare(b.id));
 const active=row=>{let current=row;while(current){if(current.removed_at!==null&&current.removed_at!==undefined)return false;current=placements.get(current.parent_id);}return true;};
 const subtree=(rootId,{includeRemoved=false}={})=>{const result=[];function visit(row){if(!includeRemoved&&!active(row))return;result.push(row);if(result.length>MAX_SUBTREE)throw Error("This preview supports at most 100 placements in one assembly operation.");for(const child of children.get(row.id)||[])visit(child);}const root=placements.get(rootId);if(!root)throw Error("Placement not found.");visit(root);return result;};
 const path=row=>{const result=[];let current=row;while(current){const item=definitions.get(current.item_id);result.unshift({id:current.id,item_id:item.id,name:item.name,part_number:item.part_number});current=placements.get(current.parent_id);}return result;};
 const total=row=>{let quantity=1,current=row;while(current){quantity*=current.quantity;if(!Number.isFinite(quantity))throw Error("Nested quantity total is too large.");current=placements.get(current.parent_id);}return quantity;};
 return {definitions,placements,children,active,subtree,path,total};
}
export function projectBOM(items,occurrences,scope=null){
 const tree=projectTree(items,occurrences),rows=scope?tree.subtree(scope):occurrences.filter(tree.active),grouped=new Map();
 for(const occurrence of rows){const item=tree.definitions.get(occurrence.item_id);if(item.is_tool||item.kind!=="part")continue;const key=item.id+"\0"+occurrence.unit,entry=grouped.get(key)||{item,unit:occurrence.unit,quantity:0,placements:[]};entry.quantity+=tree.total(occurrence);if(!Number.isFinite(entry.quantity))throw Error("BOM quantity is too large.");entry.placements.push(occurrence.id);grouped.set(key,entry);}
 return [...grouped.values()].sort((a,b)=>a.item.part_number.localeCompare(b.item.part_number,undefined,{numeric:true}));
}
