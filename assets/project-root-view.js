// A single unit assembly can share the project's summary presentation.
// This is a view only: identities, BOM quantities, history and parents stay unchanged.
export function summaryAssembly(tree){
 const roots=(tree.children.get(null)||[]).filter(tree.active);if(roots.length!==1)return null;
 const occurrence=roots[0],item=tree.definitions.get(occurrence.item_id);
 return item.is_assembly&&!item.is_tool&&!occurrence.hidden&&occurrence.quantity===1?{item,occurrence}:null;
}
export function showAssemblyRow(projectId){try{return localStorage.getItem("bs-show-top-assembly:"+projectId)==="1";}catch{return false;}}
export function setShowAssemblyRow(projectId,show){try{if(show)localStorage.setItem("bs-show-top-assembly:"+projectId,"1");else localStorage.removeItem("bs-show-top-assembly:"+projectId);}catch{}}
