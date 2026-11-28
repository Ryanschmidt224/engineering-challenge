// Permanent reservations deliberately have no FK to deletable project content.
// The INSERT trigger allocates inside the same D1 transaction as creation or
// a hidden restore header. Rollback/replay cannot consume a second number.
export const projectNumberSchema = [
  `CREATE TABLE engine_project_numbers (
  project_id TEXT PRIMARY KEY NOT NULL,
  project_number INTEGER NOT NULL UNIQUE CHECK(typeof(project_number)='integer' AND project_number BETWEEN 1001 AND 9007199254740991))`,
  `INSERT INTO engine_project_numbers(project_id,project_number)
  SELECT id,1000+ROW_NUMBER() OVER(ORDER BY created_at,id) FROM engine_projects`,
  `CREATE TRIGGER engine_project_number_assign AFTER INSERT ON engine_projects
  WHEN NOT EXISTS(SELECT 1 FROM engine_project_numbers WHERE project_id=NEW.id)
  BEGIN INSERT INTO engine_project_numbers(project_id,project_number)
  SELECT NEW.id,COALESCE(MAX(project_number),1000)+1 FROM engine_project_numbers; END`,
  `CREATE TRIGGER engine_project_number_immutable_update BEFORE UPDATE ON engine_project_numbers
  BEGIN SELECT RAISE(ABORT,'PROJECT_NUMBER_PERMANENT'); END`,
  `CREATE TRIGGER engine_project_number_immutable_delete BEFORE DELETE ON engine_project_numbers
  BEGIN SELECT RAISE(ABORT,'PROJECT_NUMBER_PERMANENT'); END`,
];
