// A group owns instructions/groups; records belong to one instruction scope.
// Stable IDs, sibling order and ancestor state are shared by UI and recovery.
export function instructionTree(steps){
 const uuid=value=>typeof value==="string"&&/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(value);
 const byId=new Map(steps.map(row=>[row.id,row]));
 if(byId.size!==steps.length)throw Error("Duplicate instruction identity.");
 const children=id=>steps.filter(row=>(row.parent_id||null)===id).sort((a,b)=>a.sort_order-b.sort_order||a.id.localeCompare(b.id));
 for(const row of steps){
  if(row.parent_id!==undefined&&row.parent_id!==null&&!uuid(row.parent_id)||row.sort_order!==undefined&&!Number.isSafeInteger(row.sort_order))throw Error("Invalid instruction parent or order.");
  if(row.is_group!==undefined&&![0,1,false,true].includes(row.is_group)||row.revision_level!==undefined&&(!Number.isInteger(row.revision_level)||row.revision_level<1))throw Error("Invalid instruction revision or group.");
  const seen=new Set([row.id]);let current=row;
  while(current.parent_id){const parent=byId.get(current.parent_id);if(!parent||parent.item_id!==row.item_id||parent.project_id!==row.project_id||!parent.is_group)throw Error("Choose an instruction group on the same part.");if(seen.has(parent.id)||seen.size>=32)throw Error("Instruction groups cannot contain a cycle or exceed 32 levels.");seen.add(parent.id);current=parent;}
 }
 const active=row=>{for(let current=row;current;current=byId.get(current.parent_id))if(current.retired_at)return false;return true;};
 const subtree=id=>{const root=byId.get(id);if(!root)throw Error("Instruction not found.");const result=[];const visit=row=>{result.push(row);for(const child of children(row.id))visit(child);};visit(root);return result;};
 return {byId,children,active,subtree};
}
export function recordTree(records){
 const byId=new Map(records.map(row=>[row.id,row]));if(byId.size!==records.length)throw Error("Duplicate record identity.");
 for(const row of records){if(row.parent_record_id!==undefined&&row.parent_record_id!==null&&(typeof row.parent_record_id!=="string"||!/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(row.parent_record_id))||row.sort_order!==undefined&&!Number.isSafeInteger(row.sort_order))throw Error("Invalid parent record or order.");const seen=new Set([row.id]);let current=row;while(current.parent_record_id){const parent=byId.get(current.parent_record_id);if(!parent||parent.item_id!==row.item_id||parent.project_id!==row.project_id||(parent.step_id||null)!==(row.step_id||null))throw Error("Choose a parent record on this instruction.");if(seen.has(parent.id)||seen.size>=32)throw Error("Nested records cannot contain a cycle or exceed 32 levels.");seen.add(parent.id);current=parent;}}
 const children=id=>records.filter(row=>(row.parent_record_id||null)===id).sort((a,b)=>a.sort_order-b.sort_order||a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));
 const descendants=id=>{const result=[];const visit=id=>{result.push(id);for(const child of children(id))visit(child.id);};visit(id);return result;};
 return {byId,children,descendants};
}
