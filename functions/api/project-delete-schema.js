// A project-scoped deletion tombstone survives content removal. It contains no
// project name, files or history and prevents old requests reusing the ID.
const scoped=["items","occurrences","steps","configurations","records","events","files","file_links","selections","archive_groups","snapshot_values","media","operations","restore_jobs"];
export const projectDeleteSchema=[
 `CREATE TABLE IF NOT EXISTS engine_project_deletions (
 id TEXT PRIMARY KEY,project_id TEXT NOT NULL UNIQUE,actor_id TEXT NOT NULL,
 expected_revision TEXT NOT NULL,request_hash TEXT NOT NULL CHECK(length(request_hash)=64),
 state TEXT NOT NULL DEFAULT 'deleting' CHECK(state IN('deleting','complete')),
 created_at TEXT NOT NULL,completed_at TEXT,last_swept_at TEXT,
 CHECK((state='deleting' AND completed_at IS NULL) OR (state='complete' AND completed_at IS NOT NULL)))`,
 `CREATE INDEX IF NOT EXISTS engine_project_deletion_sweep ON engine_project_deletions(last_swept_at,created_at)`,
 `CREATE TRIGGER IF NOT EXISTS engine_deletion_tombstone_delete BEFORE DELETE ON engine_project_deletions BEGIN SELECT RAISE(ABORT,'PROJECT_DELETE_FENCE_PERMANENT'); END`,
 `CREATE TRIGGER IF NOT EXISTS engine_deletion_tombstone_identity BEFORE UPDATE OF id,project_id,actor_id,expected_revision,request_hash,created_at ON engine_project_deletions WHEN NEW.id IS NOT OLD.id OR NEW.project_id IS NOT OLD.project_id OR NEW.actor_id IS NOT OLD.actor_id OR NEW.expected_revision IS NOT OLD.expected_revision OR NEW.request_hash IS NOT OLD.request_hash OR NEW.created_at IS NOT OLD.created_at BEGIN SELECT RAISE(ABORT,'PROJECT_DELETE_FENCE_PERMANENT'); END`,
 `CREATE TRIGGER IF NOT EXISTS engine_deletion_tombstone_state BEFORE UPDATE OF state ON engine_project_deletions WHEN OLD.state='complete' AND NEW.state<>'complete' BEGIN SELECT RAISE(ABORT,'PROJECT_DELETE_FENCE_PERMANENT'); END`,
 ...["INSERT","UPDATE"].map(action=>`CREATE TRIGGER IF NOT EXISTS engine_deleted_header_${action.toLowerCase()} BEFORE ${action} ON engine_projects WHEN EXISTS(SELECT 1 FROM engine_project_deletions WHERE project_id=NEW.id) BEGIN SELECT RAISE(ABORT,'PROJECT_DELETING'); END`),
 ...scoped.flatMap(table=>["INSERT","UPDATE"].map(action=>`CREATE TRIGGER IF NOT EXISTS engine_deleted_${table}_${action.toLowerCase()} BEFORE ${action} ON engine_${table} WHEN EXISTS(SELECT 1 FROM engine_project_deletions WHERE project_id=NEW.project_id) BEGIN SELECT RAISE(ABORT,'PROJECT_DELETING'); END`)),
 ...["INSERT","UPDATE"].map(action=>`CREATE TRIGGER IF NOT EXISTS engine_deleted_restore_rows_${action.toLowerCase()} BEFORE ${action} ON engine_restore_rows WHEN EXISTS(SELECT 1 FROM engine_restore_jobs j JOIN engine_project_deletions d ON d.project_id=j.project_id WHERE j.id=NEW.job_id) BEGIN SELECT RAISE(ABORT,'PROJECT_DELETING'); END`)
];
