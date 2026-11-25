// Explicit engineering backup contract. Operational receipts/staging are not
// exported. Missing fields from older backups use the applied schema defaults.
export const backupColumns={
 items:"id project_id name short_name part_number kind source is_tool fields created_at revision_level is_assembly",
 occurrences:"id project_id item_id parent_id archive_group_id quantity unit build_status attention attention_note hidden sort_order removed_at removed_path",
 steps:"id project_id item_id title body sort_order retired_at retired_path created_at parent_id is_group revision_level archive_reason",
 configurations:"id project_id item_id fingerprint snapshot created_at",
 records:"id project_id item_id step_id configuration_id type title fields event_date step_snapshot created_at updated_at sort_order parent_record_id",
 events:"id project_id item_id type title summary payload created_at",
 files:"id project_id name content_type r2_key state size sha256 created_at",
 file_links:"id project_id file_id item_id record_id event_id configuration_id role active",
 selections:"id project_id family_id product_id family_revision product_revision snapshot requirements",
 archive_groups:"id project_id root_occurrence_id members created_at",
 snapshot_values:"id project_id kind fingerprint snapshot created_at"
};
const defaults={
 items:{short_name:"",is_tool:0,revision_level:1,is_assembly:0},
 occurrences:{parent_id:null,archive_group_id:null,quantity:1,unit:"pcs",build_status:"not_started",attention:0,attention_note:"",hidden:0,sort_order:0,removed_at:null,removed_path:null},
 steps:{body:"",sort_order:0,retired_at:null,retired_path:null,parent_id:null,is_group:0,revision_level:1,archive_reason:""},
 records:{step_id:null,event_date:null,step_snapshot:null,sort_order:0,parent_record_id:null},events:{summary:""},files:{size:null,sha256:null},
 file_links:{item_id:null,record_id:null,event_id:null,configuration_id:null,active:1},selections:{product_id:null,product_revision:null}
};
export function restoredRow(table,row,projectId,storageKey){
 const result={...defaults[table],...row,project_id:projectId};if(table==="files")result.r2_key=storageKey(result);return result;
}
export function validateBackupRow(table,row,projectId){
 const allowed=backupColumns[table]?.split(" ");
 if(!allowed||!row||typeof row!=="object"||Array.isArray(row)||typeof row.id!=="string"||!/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(row.id)||row.project_id!==projectId||Object.keys(row).some(key=>!allowed.includes(key))||Object.values(row).some(value=>value!==null&&!["string","number"].includes(typeof value)))throw Error("Invalid "+table+" backup row.");
}
export function backupOutline(project){
 const tables=Object.fromEntries(Object.keys(backupColumns).map(name=>[name,[]])),seen=new Map(Object.keys(tables).map(name=>[name,new Set()]));let count=0;
 return {manifest:{format:"building-schmidt-project",version:1,project,tables},get count(){return count;},
  collect(table,row){
   validateBackupRow(table,row,project.id);if(seen.get(table).has(row.id))throw Error("Duplicate "+table+" backup row.");seen.get(table).add(row.id);if(++count>100000)throw Error("This preview recovery supports at most 100,000 metadata rows.");
   const identity={id:row.id,project_id:row.project_id};
   if(table==="items")tables.items.push({...identity,part_number:row.part_number,kind:row.kind,...Object.fromEntries(["is_assembly","is_tool","revision_level"].filter(key=>Object.hasOwn(row,key)).map(key=>[key,row[key]]))});
   if(table==="occurrences")tables.occurrences.push(row);
   if(table==="steps")tables.steps.push({...identity,item_id:row.item_id,parent_id:row.parent_id??null,is_group:row.is_group??0,revision_level:row.revision_level??1,sort_order:row.sort_order??0});
   if(table==="records")tables.records.push({...identity,item_id:row.item_id,step_id:row.step_id??null,parent_record_id:row.parent_record_id??null,sort_order:row.sort_order??0,created_at:row.created_at});
   if(table==="files")tables.files.push({...identity,state:row.state,size:row.size,sha256:row.sha256});
   if(table==="selections")tables.selections.push(identity);
   if(table==="snapshot_values")tables.snapshot_values.push({...identity,kind:row.kind});
   if(table==="archive_groups"){const members=JSON.parse(row.members);if(!Array.isArray(members))throw Error("Invalid archive group members.");tables.archive_groups.push({...identity,root_occurrence_id:row.root_occurrence_id,members:JSON.stringify(members.map(member=>({id:member.id})))});}
  }
 };
}
