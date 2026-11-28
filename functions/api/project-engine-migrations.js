import {projectNumberSchema} from "./project-number-schema.js";
import {occurrenceStatusUpgrade} from './project-status-upgrade.js';
import {projectDeleteSchema} from "./project-delete-schema.js";
// Separate from Workshop's migration ledger. Only the enabled, authenticated
// preview handler calls this; importing the module performs no database work.
import {retiredObjectReferenceTriggers} from "./project-storage-references.js";
const migrations=[{version:1,statements:[
 `CREATE TABLE IF NOT EXISTS engine_projects (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL,
  revision TEXT NOT NULL, prefix TEXT NOT NULL DEFAULT 'NR', digits INTEGER NOT NULL DEFAULT 4,
  created_at TEXT NOT NULL, CHECK(digits BETWEEN 1 AND 8))`,
 `CREATE TABLE IF NOT EXISTS engine_operations (
  project_id TEXT NOT NULL, actor_id TEXT NOT NULL, operation_id TEXT NOT NULL,
  request_hash TEXT NOT NULL, attempt_id TEXT NOT NULL UNIQUE,
  result TEXT NOT NULL CHECK(json_valid(result)), created_at TEXT NOT NULL,
  PRIMARY KEY(project_id,actor_id,operation_id))`,
 // Receipts deliberately have no project FK: the admission row precedes a new
 // project header in the same transaction. No command may edit or delete one.
 `CREATE TABLE IF NOT EXISTS engine_items (
  id TEXT NOT NULL, project_id TEXT NOT NULL, name TEXT NOT NULL, short_name TEXT NOT NULL DEFAULT '',
  part_number TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('part','document','code')),
  source TEXT NOT NULL CHECK(source='custom'), is_tool INTEGER NOT NULL DEFAULT 0 CHECK(is_tool IN (0,1)),
  fields TEXT NOT NULL CHECK(json_valid(fields)), created_at TEXT NOT NULL,
  PRIMARY KEY(project_id,id), UNIQUE(project_id,part_number),
  FOREIGN KEY(project_id) REFERENCES engine_projects(id))`,
 `CREATE TABLE IF NOT EXISTS engine_occurrences (
  id TEXT NOT NULL, project_id TEXT NOT NULL, item_id TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1 CHECK(quantity>=0), unit TEXT NOT NULL DEFAULT 'pcs',
  build_status TEXT NOT NULL DEFAULT 'not_started' CHECK(build_status IN ('not_started','in_progress','complete')),
  attention INTEGER NOT NULL DEFAULT 0 CHECK(attention IN (0,1)), attention_note TEXT NOT NULL DEFAULT '',
  hidden INTEGER NOT NULL DEFAULT 0 CHECK(hidden IN (0,1)), sort_order INTEGER NOT NULL DEFAULT 0,
  removed_at TEXT, removed_path TEXT,
  PRIMARY KEY(project_id,id), FOREIGN KEY(project_id,item_id) REFERENCES engine_items(project_id,id))`,
 `CREATE TABLE IF NOT EXISTS engine_configurations (
  id TEXT NOT NULL, project_id TEXT NOT NULL, item_id TEXT NOT NULL,
  fingerprint TEXT NOT NULL, snapshot TEXT NOT NULL CHECK(json_valid(snapshot)), created_at TEXT NOT NULL,
  PRIMARY KEY(project_id,id), UNIQUE(project_id,item_id,fingerprint),
  FOREIGN KEY(project_id,item_id) REFERENCES engine_items(project_id,id))`,
 `CREATE TABLE IF NOT EXISTS engine_events (
  id TEXT NOT NULL, project_id TEXT NOT NULL, item_id TEXT NOT NULL, type TEXT NOT NULL,
  title TEXT NOT NULL, summary TEXT NOT NULL DEFAULT '', payload TEXT NOT NULL CHECK(json_valid(payload)),
  created_at TEXT NOT NULL, PRIMARY KEY(project_id,id),
  FOREIGN KEY(project_id,item_id) REFERENCES engine_items(project_id,id))`,
 `CREATE INDEX IF NOT EXISTS engine_events_order ON engine_events(project_id,created_at DESC,id DESC)`,
 `CREATE INDEX IF NOT EXISTS engine_occurrences_item ON engine_occurrences(project_id,item_id)`
 ]},{version:2,statements:[
 `CREATE UNIQUE INDEX IF NOT EXISTS engine_item_number_unique ON engine_items(project_id,part_number COLLATE NOCASE)`,
 `CREATE TABLE IF NOT EXISTS engine_steps (
  id TEXT NOT NULL, project_id TEXT NOT NULL, item_id TEXT NOT NULL, title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0, retired_at TEXT, retired_path TEXT,
  created_at TEXT NOT NULL, PRIMARY KEY(project_id,id),
  FOREIGN KEY(project_id,item_id) REFERENCES engine_items(project_id,id))`,
 `CREATE UNIQUE INDEX IF NOT EXISTS engine_steps_identity ON engine_steps(project_id,id,item_id)`,
 `CREATE UNIQUE INDEX IF NOT EXISTS engine_configuration_identity ON engine_configurations(project_id,id,item_id)`,
 `CREATE TABLE IF NOT EXISTS engine_records (
  id TEXT NOT NULL, project_id TEXT NOT NULL, item_id TEXT NOT NULL, step_id TEXT,
  configuration_id TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('test','problem','note','change_note')),
  title TEXT NOT NULL, fields TEXT NOT NULL CHECK(json_valid(fields)), event_date TEXT,
  step_snapshot TEXT CHECK(step_snapshot IS NULL OR json_valid(step_snapshot)), created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  PRIMARY KEY(project_id,id), FOREIGN KEY(project_id,item_id) REFERENCES engine_items(project_id,id),
  FOREIGN KEY(project_id,step_id,item_id) REFERENCES engine_steps(project_id,id,item_id),
  FOREIGN KEY(project_id,configuration_id,item_id) REFERENCES engine_configurations(project_id,id,item_id))`,
 `CREATE TABLE IF NOT EXISTS engine_files (
  id TEXT NOT NULL, project_id TEXT NOT NULL, name TEXT NOT NULL, content_type TEXT NOT NULL,
  r2_key TEXT NOT NULL UNIQUE, state TEXT NOT NULL CHECK(state IN ('prepared','ready')),
  size INTEGER, sha256 TEXT, created_at TEXT NOT NULL,
  PRIMARY KEY(project_id,id), FOREIGN KEY(project_id) REFERENCES engine_projects(id),
  CHECK(state='prepared' OR size IS NOT NULL AND size>=0 AND length(sha256)=64))`,
 `CREATE TABLE IF NOT EXISTS engine_file_links (
  id TEXT NOT NULL, project_id TEXT NOT NULL, file_id TEXT NOT NULL,
  item_id TEXT, record_id TEXT, event_id TEXT, configuration_id TEXT,
  role TEXT NOT NULL CHECK(role IN ('engineering','support')), active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  PRIMARY KEY(project_id,id),
  FOREIGN KEY(project_id,file_id) REFERENCES engine_files(project_id,id),
  FOREIGN KEY(project_id,item_id) REFERENCES engine_items(project_id,id),
  FOREIGN KEY(project_id,record_id) REFERENCES engine_records(project_id,id),
  FOREIGN KEY(project_id,event_id) REFERENCES engine_events(project_id,id),
  FOREIGN KEY(project_id,configuration_id) REFERENCES engine_configurations(project_id,id),
  CHECK((item_id IS NOT NULL)+(record_id IS NOT NULL)+(event_id IS NOT NULL)+(configuration_id IS NOT NULL)=1),
  CHECK(item_id IS NULL OR role='engineering'))`,
 `CREATE UNIQUE INDEX IF NOT EXISTS engine_current_file ON engine_file_links(project_id,item_id) WHERE item_id IS NOT NULL AND active=1`,
 `CREATE INDEX IF NOT EXISTS engine_steps_owner ON engine_steps(project_id,item_id,retired_at,sort_order,id)`,
 `CREATE INDEX IF NOT EXISTS engine_records_owner ON engine_records(project_id,item_id,created_at DESC,id DESC)`,
 `CREATE INDEX IF NOT EXISTS engine_links_file ON engine_file_links(project_id,file_id)`,
 `CREATE INDEX IF NOT EXISTS engine_links_record ON engine_file_links(project_id,record_id,active)`
]},{version:3,statements:[
 `ALTER TABLE engine_items ADD COLUMN revision_level INTEGER NOT NULL DEFAULT 1 CHECK(revision_level>=1)`
 ]},{version:4,statements:[
 `ALTER TABLE engine_items ADD COLUMN is_assembly INTEGER NOT NULL DEFAULT 0 CHECK(is_assembly IN(0,1))`,
 `ALTER TABLE engine_occurrences ADD COLUMN parent_id TEXT`,
 `ALTER TABLE engine_occurrences ADD COLUMN archive_group_id TEXT`,
 `CREATE INDEX IF NOT EXISTS engine_occurrences_parent ON engine_occurrences(project_id,parent_id,removed_at,sort_order,id)`,
 `CREATE TABLE IF NOT EXISTS engine_selections (
 id TEXT NOT NULL,project_id TEXT NOT NULL,family_id TEXT NOT NULL,product_id TEXT,
 family_revision INTEGER NOT NULL,product_revision INTEGER,
 snapshot TEXT NOT NULL CHECK(json_valid(snapshot)),requirements TEXT NOT NULL CHECK(json_valid(requirements)),
 PRIMARY KEY(project_id,id),FOREIGN KEY(project_id,id) REFERENCES engine_items(project_id,id))`,
 `CREATE INDEX IF NOT EXISTS engine_selections_source ON engine_selections(family_id,product_id,project_id)`,
 `CREATE TABLE IF NOT EXISTS engine_archive_groups (
 id TEXT NOT NULL,project_id TEXT NOT NULL,root_occurrence_id TEXT NOT NULL,members TEXT NOT NULL CHECK(json_valid(members)),created_at TEXT NOT NULL,
 PRIMARY KEY(project_id,id),FOREIGN KEY(project_id,root_occurrence_id) REFERENCES engine_occurrences(project_id,id))`,
 ...["INSERT","UPDATE OF parent_id,item_id,project_id"].map(action=>`CREATE TRIGGER IF NOT EXISTS engine_parent_${action.startsWith("INSERT")?"insert":"update"} BEFORE ${action} ON engine_occurrences WHEN NEW.parent_id IS NOT NULL BEGIN
 SELECT RAISE(ABORT,'INVALID_ASSEMBLY_PARENT') WHERE NOT EXISTS(SELECT 1 FROM engine_occurrences p JOIN engine_items i ON i.project_id=p.project_id AND i.id=p.item_id WHERE p.project_id=NEW.project_id AND p.id=NEW.parent_id AND i.is_assembly=1);
 SELECT RAISE(ABORT,'ASSEMBLY_CYCLE') WHERE NEW.parent_id=NEW.id OR EXISTS(WITH RECURSIVE parents(id,parent_id) AS(SELECT id,parent_id FROM engine_occurrences WHERE project_id=NEW.project_id AND id=NEW.parent_id UNION SELECT p.id,p.parent_id FROM engine_occurrences p JOIN parents a ON p.id=a.parent_id WHERE p.project_id=NEW.project_id) SELECT 1 FROM parents WHERE id=NEW.id); END`),
 `CREATE TRIGGER IF NOT EXISTS engine_assembly_contract BEFORE UPDATE OF is_assembly ON engine_items WHEN NEW.is_assembly=0 AND OLD.is_assembly=1 BEGIN SELECT RAISE(ABORT,'ASSEMBLY_HAS_CHILDREN') WHERE EXISTS(SELECT 1 FROM engine_occurrences c JOIN engine_occurrences p ON p.project_id=c.project_id AND p.id=c.parent_id WHERE p.project_id=OLD.project_id AND p.item_id=OLD.id); END`
]},{version:5,statements:[
 `CREATE TABLE IF NOT EXISTS engine_snapshot_values (
 id TEXT NOT NULL,project_id TEXT NOT NULL,kind TEXT NOT NULL,
 fingerprint TEXT NOT NULL,snapshot TEXT NOT NULL CHECK(json_valid(snapshot)),created_at TEXT NOT NULL,
 PRIMARY KEY(project_id,id),UNIQUE(project_id,kind,fingerprint),
 FOREIGN KEY(project_id) REFERENCES engine_projects(id))`
]},{version:6,statements:[
 `ALTER TABLE engine_projects ADD COLUMN restore_job_id TEXT`,
 `CREATE TABLE IF NOT EXISTS engine_restore_jobs (
 id TEXT PRIMARY KEY,project_id TEXT NOT NULL,actor_id TEXT NOT NULL,operation_id TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN('staging','ready','complete')),row_count INTEGER NOT NULL,
 fingerprint TEXT,created_at TEXT NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS engine_restore_rows (
 job_id TEXT NOT NULL,table_name TEXT NOT NULL,row_id TEXT NOT NULL,position INTEGER NOT NULL,
 data TEXT NOT NULL CHECK(json_valid(data)),PRIMARY KEY(job_id,table_name,row_id),
 FOREIGN KEY(job_id) REFERENCES engine_restore_jobs(id) ON DELETE CASCADE)`,
 `CREATE INDEX IF NOT EXISTS engine_restore_rows_order ON engine_restore_rows(job_id,table_name,position,row_id)`,
 ...["INSERT","UPDATE"].map(action=>`CREATE TRIGGER IF NOT EXISTS engine_restore_rows_${action.toLowerCase()} BEFORE ${action} ON engine_restore_rows BEGIN SELECT RAISE(ABORT,'RESTORE_STAGE_SEALED') WHERE NOT EXISTS(SELECT 1 FROM engine_restore_jobs WHERE id=NEW.job_id AND state='staging'); END`)
]},{version:7,statements:[
 `ALTER TABLE engine_restore_jobs ADD COLUMN last_activity_at TEXT`,
 `ALTER TABLE engine_restore_jobs ADD COLUMN cleanup_token TEXT`,
 `ALTER TABLE engine_restore_jobs ADD COLUMN cleanup_claimed_at TEXT`,
 // Existing previews receive a fresh grace period; age alone is not progress.
 `UPDATE engine_restore_jobs SET last_activity_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE last_activity_at IS NULL`,
 `CREATE INDEX IF NOT EXISTS engine_restore_operation_activity ON engine_restore_jobs(project_id,actor_id,operation_id,cleanup_token,last_activity_at)`,
 `CREATE TRIGGER IF NOT EXISTS engine_restore_job_activity AFTER INSERT ON engine_restore_jobs WHEN NEW.last_activity_at IS NULL BEGIN UPDATE engine_restore_jobs SET last_activity_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=NEW.id; END`,
 `CREATE TRIGGER IF NOT EXISTS engine_restore_job_completed_claim BEFORE UPDATE OF cleanup_token ON engine_restore_jobs WHEN NEW.cleanup_token IS NOT NULL AND OLD.state='complete' BEGIN SELECT RAISE(ABORT,'RESTORE_ALREADY_PUBLISHED'); END`,
 `CREATE TRIGGER IF NOT EXISTS engine_restore_job_retired_insert BEFORE INSERT ON engine_restore_jobs WHEN EXISTS(SELECT 1 FROM engine_restore_jobs j WHERE j.project_id=NEW.project_id AND j.actor_id=NEW.actor_id AND j.operation_id=NEW.operation_id AND j.cleanup_token IS NOT NULL) BEGIN SELECT RAISE(ABORT,'RESTORE_OPERATION_RETIRED'); END`,
 `CREATE TRIGGER IF NOT EXISTS engine_restore_receipt_retired_insert BEFORE INSERT ON engine_operations WHEN EXISTS(SELECT 1 FROM engine_restore_jobs j WHERE j.project_id=NEW.project_id AND j.actor_id=NEW.actor_id AND j.operation_id=NEW.operation_id AND j.cleanup_token IS NOT NULL) BEGIN SELECT RAISE(ABORT,'RESTORE_OPERATION_RETIRED'); END`,
 ...["UPDATE","DELETE"].map(action=>`CREATE TRIGGER IF NOT EXISTS engine_restore_job_retired_${action.toLowerCase()} BEFORE ${action} ON engine_restore_jobs WHEN EXISTS(SELECT 1 FROM engine_restore_jobs j WHERE j.project_id=OLD.project_id AND j.actor_id=OLD.actor_id AND j.operation_id=OLD.operation_id AND j.cleanup_token IS NOT NULL) BEGIN SELECT RAISE(ABORT,'RESTORE_OPERATION_RETIRED'); END`),
 ...["INSERT","UPDATE"].map(action=>`CREATE TRIGGER IF NOT EXISTS engine_restore_rows_retired_${action.toLowerCase()} BEFORE ${action} ON engine_restore_rows WHEN EXISTS(SELECT 1 FROM engine_restore_jobs j JOIN engine_restore_jobs closed ON closed.project_id=j.project_id AND closed.actor_id=j.actor_id AND closed.operation_id=j.operation_id WHERE j.id=NEW.job_id AND closed.cleanup_token IS NOT NULL) BEGIN SELECT RAISE(ABORT,'RESTORE_OPERATION_RETIRED'); END`),
 ...["INSERT","UPDATE"].map(action=>`CREATE TRIGGER IF NOT EXISTS engine_restore_header_retired_${action.toLowerCase()} BEFORE ${action} ON engine_projects WHEN EXISTS(SELECT 1 FROM engine_restore_jobs j JOIN engine_restore_jobs closed ON closed.project_id=j.project_id AND closed.actor_id=j.actor_id AND closed.operation_id=j.operation_id WHERE j.id=${action==="INSERT"?"NEW":"OLD"}.restore_job_id AND closed.cleanup_token IS NOT NULL) BEGIN SELECT RAISE(ABORT,'RESTORE_OPERATION_RETIRED'); END`),
 ...["items","occurrences","steps","configurations","records","events","files","file_links","selections","archive_groups","snapshot_values"].flatMap(table=>["INSERT","UPDATE"].map(action=>`CREATE TRIGGER IF NOT EXISTS engine_${table}_restore_retired_${action.toLowerCase()} BEFORE ${action} ON engine_${table} WHEN EXISTS(SELECT 1 FROM engine_projects p JOIN engine_restore_jobs j ON p.restore_job_id=j.id JOIN engine_restore_jobs closed ON closed.project_id=j.project_id AND closed.actor_id=j.actor_id AND closed.operation_id=j.operation_id WHERE p.id=NEW.project_id AND closed.cleanup_token IS NOT NULL) BEGIN SELECT RAISE(ABORT,'RESTORE_OPERATION_RETIRED'); END`))
]},{version:8,statements:[
 // Durable key fences survive removal of a retired copy's private metadata.
 // No object deletion or public maintenance action is introduced here.
 `CREATE TABLE IF NOT EXISTS engine_retired_file_keys (
 r2_key TEXT PRIMARY KEY,job_id TEXT NOT NULL,project_id TEXT NOT NULL,actor_id TEXT NOT NULL,
 operation_id TEXT NOT NULL,cleanup_token TEXT NOT NULL,created_at TEXT NOT NULL,
 FOREIGN KEY(job_id) REFERENCES engine_restore_jobs(id))`,
 ...["UPDATE","DELETE"].map(action=>`CREATE TRIGGER IF NOT EXISTS engine_retired_keys_${action.toLowerCase()} BEFORE ${action} ON engine_retired_file_keys BEGIN SELECT RAISE(ABORT,'RETIRED_KEY_IS_PERMANENT'); END`),
 ...["INSERT","UPDATE"].map(action=>`CREATE TRIGGER IF NOT EXISTS engine_files_key_fence_${action.toLowerCase()} BEFORE ${action} ON engine_files WHEN EXISTS(SELECT 1 FROM engine_retired_file_keys WHERE r2_key=NEW.r2_key) BEGIN SELECT RAISE(ABORT,'ENGINE_STORAGE_KEY_RETIRED'); END`),
 ...["INSERT","UPDATE"].map(action=>`CREATE TRIGGER IF NOT EXISTS engine_restore_key_fence_${action.toLowerCase()} BEFORE ${action} ON engine_restore_rows WHEN NEW.table_name='files' AND EXISTS(SELECT 1 FROM engine_retired_file_keys WHERE r2_key=json_extract(NEW.data,'$.r2_key')) BEGIN SELECT RAISE(ABORT,'ENGINE_STORAGE_KEY_RETIRED'); END`)
]},{version:9,statements:[
 // Append-only deletion intents for never-published recovery storage keys.
 // Each observed ETag is separately journaled; no terminal "deleted" marker
 // can hide bytes left later by an already in-flight old writer.
 `CREATE TABLE IF NOT EXISTS engine_retired_object_attempts (
 r2_key TEXT NOT NULL,etag TEXT NOT NULL,attempt_id TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL,
 PRIMARY KEY(r2_key,etag),FOREIGN KEY(r2_key) REFERENCES engine_retired_file_keys(r2_key))`,
 ...["UPDATE","DELETE"].map(action=>`CREATE TRIGGER IF NOT EXISTS engine_retired_object_attempt_${action.toLowerCase()} BEFORE ${action} ON engine_retired_object_attempts BEGIN SELECT RAISE(ABORT,'RETIRED_OBJECT_INTENT_IS_PERMANENT'); END`),
 // Atomic intent admission checks all roots first. After it wins, neither a
 // current nor old SQL writer may introduce a root in the check/delete gap.
 ...retiredObjectReferenceTriggers()
]},{version:10,statements:[
 // Product model only: cleanup migrations 1–9 remain unchanged.
 `ALTER TABLE engine_steps ADD COLUMN parent_id TEXT`,
 `ALTER TABLE engine_steps ADD COLUMN is_group INTEGER NOT NULL DEFAULT 0 CHECK(is_group IN (0,1))`,
 `ALTER TABLE engine_steps ADD COLUMN revision_level INTEGER NOT NULL DEFAULT 1 CHECK(revision_level>=1)`,
 `ALTER TABLE engine_steps ADD COLUMN archive_reason TEXT NOT NULL DEFAULT ''`,
 `ALTER TABLE engine_records ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0`,
 `ALTER TABLE engine_records ADD COLUMN parent_record_id TEXT`,
 `CREATE INDEX IF NOT EXISTS engine_step_siblings ON engine_steps(project_id,item_id,parent_id,sort_order,id)`
]},{version:11,statements:[
 // Product model only: project/part photo galleries and one part picture.
 // Later file roles are reserved now so the CHECK never needs a table rebuild.
 // Removing media clears active; file bytes and rows are retained.
 `CREATE TABLE IF NOT EXISTS engine_media (
  id TEXT NOT NULL, project_id TEXT NOT NULL, item_id TEXT, file_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('photo','picture','drawing','part_file','webpage','code')),
  caption TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), created_at TEXT NOT NULL, removed_at TEXT,
  PRIMARY KEY(project_id,id),
  FOREIGN KEY(project_id) REFERENCES engine_projects(id),
  FOREIGN KEY(project_id,file_id) REFERENCES engine_files(project_id,id),
  CHECK(role!='picture' OR item_id IS NOT NULL))`,
 `CREATE UNIQUE INDEX IF NOT EXISTS engine_current_picture ON engine_media(project_id,item_id) WHERE role='picture' AND active=1`,
 `CREATE INDEX IF NOT EXISTS engine_media_owner ON engine_media(project_id,item_id,role,active,sort_order,id)`,
 // Same retired-restore guard every other engineering table received in v7.
 ...["INSERT","UPDATE"].map(action=>`CREATE TRIGGER IF NOT EXISTS engine_media_restore_retired_${action.toLowerCase()} BEFORE ${action} ON engine_media WHEN EXISTS(SELECT 1 FROM engine_projects p JOIN engine_restore_jobs j ON p.restore_job_id=j.id JOIN engine_restore_jobs closed ON closed.project_id=j.project_id AND closed.actor_id=j.actor_id AND closed.operation_id=j.operation_id WHERE p.id=NEW.project_id AND closed.cleanup_token IS NOT NULL) BEGIN SELECT RAISE(ABORT,'RESTORE_OPERATION_RETIRED'); END`)
]},{version:12,statements:[
 `ALTER TABLE engine_projects ADD COLUMN owner_name TEXT NOT NULL DEFAULT 'Ryan' CHECK(owner_name IN('Ryan','Wes','Wyatt'))`
]},{version:13,statements:[`ALTER TABLE engine_projects ADD COLUMN overview TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(overview))` ]},{version:14,statements:[...projectDeleteSchema]},{version:15,statements:[
 `ALTER TABLE engine_projects RENAME COLUMN owner_name TO legacy_owner_name`,
 `ALTER TABLE engine_projects ADD COLUMN owner_name TEXT NOT NULL DEFAULT 'Ryan' CHECK(typeof(owner_name)='text' AND length(trim(owner_name)) BETWEEN 1 AND 80)`,
 `UPDATE engine_projects SET owner_name=legacy_owner_name WHERE NOT EXISTS(SELECT 1 FROM engine_project_deletions d WHERE d.project_id=engine_projects.id) AND NOT EXISTS(SELECT 1 FROM engine_restore_jobs j JOIN engine_restore_jobs closed ON closed.project_id=j.project_id AND closed.actor_id=j.actor_id AND closed.operation_id=j.operation_id WHERE j.id=engine_projects.restore_job_id AND closed.cleanup_token IS NOT NULL)`,
 `CREATE TABLE website_settings(id TEXT PRIMARY KEY CHECK(id='global'),revision TEXT NOT NULL,value TEXT NOT NULL CHECK(json_valid(value)))`,
 `INSERT INTO website_settings(id,revision,value) SELECT 'global',lower(hex(randomblob(16))),json_object('tags',json((SELECT json_group_array(tag) FROM(SELECT min(trim(tag)) tag FROM(SELECT value tag FROM json_each('["Electronics","PCB Design","3D Printing","Mechanical","Software"]') UNION SELECT trim(value) tag FROM engine_projects,json_each(engine_projects.overview,'$.tags') WHERE type='text' AND length(trim(value)) BETWEEN 1 AND 60 AND value NOT GLOB '*['||char(1)||'-'||char(31)||char(127)||']*') GROUP BY lower(trim(tag)) ORDER BY lower(trim(tag)) LIMIT 100))),'owners',json((SELECT json_group_array(name) FROM(SELECT 'Ryan' name UNION SELECT 'Wes' UNION SELECT 'Wyatt' UNION SELECT owner_name FROM engine_projects))),'defaultOwner','Ryan')`
]},{version:16,statements:null},{version:17,statements:projectNumberSchema}];
export const PROJECT_ENGINE_SCHEMA_VERSION=migrations.at(-1).version;
// Read-only consumers never bootstrap/upgrade engineering storage. Do not cache
// false: the normal owner engine entry may initialize it later in this isolate.
export async function projectEngineSchemaReady(db){
 if(!db||!await db.prepare("SELECT 1 AS ready FROM sqlite_master WHERE type='table' AND name='project_engine_migrations'").first())return false;
 const current=await db.prepare("SELECT COUNT(*) AS count,MAX(version) AS version FROM project_engine_migrations").first();return current?.count===migrations.length&&current.version===PROJECT_ENGINE_SCHEMA_VERSION;
}
// Database I/O stays within its request. The atomic migration ledger resolves
// concurrent setup; never share a pending promise between Worker requests.
export async function initializeProjectEngine(db){
 if(!db)throw Error("Preview D1 binding is not configured.");
  if(await projectEngineSchemaReady(db))return;
  await db.prepare("CREATE TABLE IF NOT EXISTS project_engine_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)").run();
  const applied=(await db.prepare("SELECT version FROM project_engine_migrations").all()).results;
  if(applied.some(row=>row.version>PROJECT_ENGINE_SCHEMA_VERSION))throw Error("The project database requires a newer engine version. This engine cannot open it safely.");
  for(const migration of migrations){
   if(applied.some(row=>row.version===migration.version))continue;
   try{const statements=migration.statements??await occurrenceStatusUpgrade(db);await db.batch([...statements.map(sql=>db.prepare(sql)),db.prepare("INSERT OR IGNORE INTO project_engine_migrations(version,applied_at) VALUES(?,?)").bind(migration.version,new Date().toISOString())]);}
   catch(error){
    // Another isolate can finish an atomic migration after our ledger read.
    // Its committed ledger admits that result; a real failed migration retries.
    const completed=await db.prepare("SELECT version FROM project_engine_migrations WHERE version=?").bind(migration.version).first();
    if(!completed){
     // Workers can serialize an Error as only its stack. Log explicit scalar
     // details here; migration SQL contains schema definitions, never user rows.
     console.error("Project engine migration failed",JSON.stringify({version:migration.version,message:String(error.message||error),cause:error.cause?String(error.cause.message||error.cause):null}));
     throw error;
    }
   }
  }
}
