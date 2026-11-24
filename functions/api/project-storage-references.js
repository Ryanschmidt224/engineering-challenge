// Storage roots shared by observational inventory and deletion admission. The
// nested JSON strings in staged rows must be inspected too, not substring-matched.
export const storageJSONColumns={items:["fields"],occurrences:["removed_path"],steps:["retired_path"],configurations:["snapshot"],records:["fields","step_snapshot"],events:["payload"],selections:["snapshot","requirements"],archive_groups:["members"],snapshot_values:["snapshot"]};
const safe=value=>`CASE WHEN json_valid(${value}) THEN ${value} ELSE 'null' END`;
const hasKey=(value,key)=>`EXISTS(SELECT 1 FROM json_tree(${safe(value)}) root WHERE root.type='text' AND root.atom=${key})`;
export function unreferencedStorageKeySQL(key,{catalogue=false}={}){
 if(!/^[a-z]+\.r2_key$/.test(key))throw Error("Use an internal storage key alias.");
 const clauses=[`NOT EXISTS(SELECT 1 FROM engine_files f WHERE f.r2_key=${key})`,"NOT EXISTS(SELECT 1 FROM engine_restore_rows WHERE NOT json_valid(data))",`NOT EXISTS(SELECT 1 FROM engine_restore_rows s WHERE ${hasKey("s.data",key)})`];
 for(const [table,columns]of Object.entries(storageJSONColumns))for(const column of columns){
  clauses.push(`NOT EXISTS(SELECT 1 FROM engine_${table} t WHERE t.${column} IS NOT NULL AND (NOT json_valid(t.${column}) OR ${hasKey("t."+column,key)}))`);
  const nested=`json_extract(${safe("s.data")},'$.${column}')`;
  clauses.push(`NOT EXISTS(SELECT 1 FROM engine_restore_rows s WHERE s.table_name='${table}' AND ${nested} IS NOT NULL AND (NOT json_valid(${nested}) OR ${hasKey(nested,key)}))`);
 }
 if(catalogue)clauses.push(`NOT EXISTS(SELECT 1 FROM workshop_attachments w WHERE w.r2_key=${key})`);
 return clauses.join(" AND ");
}
const claimed=value=>`EXISTS(SELECT 1 FROM json_tree(${safe(value)}) root JOIN engine_retired_object_attempts d ON d.r2_key=root.atom WHERE root.type='text')`;
export function retiredObjectReferenceTriggers(){
 const statements=[];
 for(const [table,columns]of Object.entries(storageJSONColumns))for(const action of ["INSERT","UPDATE OF "+columns.join(",")])statements.push(`CREATE TRIGGER IF NOT EXISTS engine_${table}_retired_object_${action.startsWith("INSERT")?"insert":"update"} BEFORE ${action} ON engine_${table} WHEN EXISTS(SELECT 1 FROM engine_retired_object_attempts) AND (${columns.map(column=>claimed("NEW."+column)).join(" OR ")}) BEGIN SELECT RAISE(ABORT,'RETIRED_STAGING_OBJECT_REFERENCE'); END`);
 const nested=Object.entries(storageJSONColumns).map(([table,columns])=>`NEW.table_name='${table}' AND (${columns.map(column=>claimed(`json_extract(${safe("NEW.data")},'$.${column}')`)).join(" OR ")})`);
 for(const action of ["INSERT","UPDATE OF data,table_name"])statements.push(`CREATE TRIGGER IF NOT EXISTS engine_restore_retired_object_${action.startsWith("INSERT")?"insert":"update"} BEFORE ${action} ON engine_restore_rows WHEN EXISTS(SELECT 1 FROM engine_retired_object_attempts) AND (${[claimed("NEW.data"),...nested].map(condition=>"("+condition+")").join(" OR ")}) BEGIN SELECT RAISE(ABORT,'RETIRED_STAGING_OBJECT_REFERENCE'); END`);
 return statements;
}
