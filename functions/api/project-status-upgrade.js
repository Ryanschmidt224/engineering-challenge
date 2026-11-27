// SQLite cannot alter a CHECK constraint. Rebuild atomically with deferred FKs;
// retain the exact installed columns, indexes and triggers, including fences.
export async function occurrenceStatusUpgrade(db){
 const table=await db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='engine_occurrences'").first();
 const objects=(await db.prepare("SELECT type,name,sql FROM sqlite_master WHERE sql IS NOT NULL AND (type='trigger' OR type='index' AND tbl_name='engine_occurrences') ORDER BY type,name").all()).results;
 const original="'not_started','in_progress','complete'";
 if(!table?.sql.includes(original))throw Error('Unexpected occurrence status schema; refusing to rebuild.');
 return [
  'PRAGMA defer_foreign_keys=ON',
  'CREATE TABLE engine_occurrences_upgrade AS SELECT * FROM engine_occurrences',
  ...objects.filter(row=>row.type==='trigger').map(row=>'DROP TRIGGER "'+row.name.replaceAll('"','""')+'"'),
  'DROP TABLE engine_occurrences',
  table.sql.replace(original,"'not_started','ordered','in_progress','complete'"),
  'INSERT INTO engine_occurrences SELECT * FROM engine_occurrences_upgrade',
  'DROP TABLE engine_occurrences_upgrade',
  ...objects.map(row=>row.sql)
 ];
}
