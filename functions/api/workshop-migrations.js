// Numbered D1 migrations: the single schema authority for production, tests and
// backup restore.
//
// Rules for adding a migration:
// - Append a new entry with the next version number. Never edit, reorder or
//   remove a released migration.
// - Make changes additive (new tables, new columns, new indexes) so the previous
//   Worker version can still run against the upgraded database. A destructive
//   change needs its own reviewed recovery plan.
// - Prefer statements that are safe to repeat (CREATE ... IF NOT EXISTS). A
//   non-repeatable statement (ALTER TABLE ... ADD COLUMN) is still safe: each
//   migration runs in one D1 batch (a transaction), so if two requests race,
//   the loser rolls back and simply re-reads the version.
//
// The current version is stored in workshop_meta under key 'schema'. Version 1
// is the original one-time bootstrap, so databases created before migrations
// existed (schema = '1') are adopted without changing any row.
import {workshopSchema} from "./workshop-schema.js";
import {starterCategories, starterFamilies, starterFields} from "./workshop-seed.js";

export const migrations = [
  {
    version: 1,
    name: "workshop-baseline",
    statements: workshopSchema,
    // Only a brand-new database receives the starter catalog. The 'seed'
    // marker keeps it from ever being re-inserted after owner edits.
    seed: true,
  },
];

export const latestSchemaVersion = migrations.at(-1).version;

const seedSpecs = [
  ["workshop_categories", ["id", "parent_id", "name", "sort_order"], starterCategories],
  ["workshop_families", ["id", "category_id", "name", "kind"], starterFamilies],
  [
    "workshop_fields",
    ["id", "family_id", "label", "unit", "type", "choices", "sort_order", "hidden", "filled_on_use"],
    starterFields,
  ],
];

function seedSql(table, columns) {
  const select = columns.map((key) => `json_extract(value,'$.${key}')`).join(",");
  return `INSERT OR IGNORE INTO ${table} (${columns.join(",")}) SELECT ${select} FROM json_each(?)
 WHERE NOT EXISTS(SELECT 1 FROM workshop_meta WHERE key='seed')`;
}

const setVersionSql = `INSERT INTO workshop_meta(key,value) VALUES('schema',?)
 ON CONFLICT(key) DO UPDATE SET value=excluded.value
 WHERE CAST(workshop_meta.value AS INTEGER) < CAST(excluded.value AS INTEGER)`;

// Every statement of every migration, in order, without seed data.
// Used to build an empty schema (for example when restoring a backup).
export function allSchemaStatements(list = migrations) {
  return list.flatMap((migration) => migration.statements);
}

export async function readSchemaVersion(db) {
  let row;
  try {
    row = await db.prepare("SELECT value FROM workshop_meta WHERE key='schema'").first();
  } catch {
    return 0; // No workshop_meta table yet: a brand-new database.
  }
  if (!row) return 0;
  const version = Number(row.value);
  if (!Number.isInteger(version) || version < 0) {
    throw Error("The Workshop database has an unreadable schema version.");
  }
  return version;
}

function migrationStatements(db, migration) {
  const statements = migration.statements.map((sql) => db.prepare(sql));
  if (migration.seed) {
    for (const [table, columns, rows] of seedSpecs) {
      statements.push(db.prepare(seedSql(table, columns)).bind(JSON.stringify(rows)));
    }
    statements.push(db.prepare("INSERT OR IGNORE INTO workshop_meta(key,value) VALUES('seed','1')"));
  }
  statements.push(db.prepare(setVersionSql).bind(String(migration.version)));
  return statements;
}

// Bring the database up to the newest version this code knows about.
// A database that is already newer (after a code rollback) is left untouched.
export async function migrateWorkshop(db, list = migrations) {
  let current = await readSchemaVersion(db);
  for (const migration of list) {
    if (migration.version <= current) continue;
    try {
      await db.batch(migrationStatements(db, migration));
    } catch (error) {
      // Another request may have applied this migration first.
      const now = await readSchemaVersion(db);
      if (now < migration.version) throw error;
    }
    current = await readSchemaVersion(db);
  }
  return current;
}
