// Separate from Workshop's migration ledger. Only the enabled, authenticated
// preview handler calls this; importing the module performs no database work.
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
]}];
const pending=new WeakMap();
export async function initializeProjectEngine(db){
 if(!db)throw Error("Preview D1 binding is not configured.");
 if(pending.has(db))return pending.get(db);
 const work=(async()=>{
  await db.prepare("CREATE TABLE IF NOT EXISTS project_engine_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)").run();
  const applied=(await db.prepare("SELECT version FROM project_engine_migrations").all()).results;
  for(const migration of migrations){
   if(applied.some(row=>row.version===migration.version))continue;
   await db.batch([...migration.statements.map(sql=>db.prepare(sql)),db.prepare("INSERT OR IGNORE INTO project_engine_migrations(version,applied_at) VALUES(?,?)").bind(migration.version,new Date().toISOString())]);
  }
 })();
 pending.set(db,work);
 try{await work;}catch(error){pending.delete(db);throw error;}
}
