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
import { workshopSchema } from "./workshop-schema.js";
import {
  starterCategories,
  starterFamilies,
  starterFields,
} from "./workshop-seed.js";
import { electronicsTemplateStatements } from "./workshop-electronics-migration.js";

export const migrations = [
  {
    version: 1,
    name: "workshop-baseline",
    statements: workshopSchema,
    // Only a brand-new database receives the starter catalog. The 'seed'
    // marker keeps it from ever being re-inserted after owner edits.
    seed: true,
  },
  {
    version: 2,
    name: "knowledge-tiles",
    // Tile type, relation and target type are validated in knowledge-model.js
    // (not CHECK constraints) so the vocabularies can grow without rebuilding
    // tables. Links are separate rows; incoming and outgoing views read the
    // same row. A target is not a foreign key because targets live in
    // different tables (and later in R2); target_label keeps the last known
    // name so a missing target still reads sensibly.
    statements: [
      `CREATE TABLE IF NOT EXISTS knowledge_tiles (
 id TEXT PRIMARY KEY,
 type TEXT NOT NULL,
 title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 160),
 summary TEXT NOT NULL CHECK(length(trim(summary)) BETWEEN 1 AND 400),
 body TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','verified')),
 sources TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(sources)),
 revision INTEGER NOT NULL DEFAULT 1,
 archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS knowledge_links (
 id TEXT PRIMARY KEY,
 tile_id TEXT NOT NULL REFERENCES knowledge_tiles(id) ON DELETE RESTRICT,
 target_type TEXT NOT NULL,
 target_id TEXT NOT NULL,
 target_project_id TEXT,
 target_label TEXT NOT NULL DEFAULT '',
 relation TEXT NOT NULL DEFAULT 'see_also',
 note TEXT NOT NULL DEFAULT '',
 revision INTEGER NOT NULL DEFAULT 1,
 archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)),
 created_at TEXT NOT NULL)`,
      `CREATE INDEX IF NOT EXISTS knowledge_links_tile ON knowledge_links(tile_id,archived)`,
      `CREATE INDEX IF NOT EXISTS knowledge_links_target ON knowledge_links(target_type,target_id,archived)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS knowledge_links_active_unique
 ON knowledge_links(tile_id,target_type,target_id,COALESCE(target_project_id,''),relation) WHERE archived=0`,
    ],
  },
  {
    version: 3,
    name: "electronics-template-terminology",
    statements: electronicsTemplateStatements,
  },
  {
    version: 4,
    name: "workshop-lookup-provenance",
    statements: [
      "ALTER TABLE workshop_products ADD COLUMN lookup_provenance TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(lookup_provenance))",
    ],
  },
  {
    version: 5,
    name: "lessons-learned",
    statements: [
      `CREATE TABLE IF NOT EXISTS lessons (
   id TEXT PRIMARY KEY,
   happened TEXT NOT NULL DEFAULT '' CHECK(length(happened) <= 2000),
   steps TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(steps) AND json_type(steps)='array'),
   resolution TEXT CHECK(resolution IS NULL OR length(resolution) <= 8000),
   quality TEXT CHECK(quality IS NULL OR quality IN ('yes','meh','no')),
   search_text TEXT NOT NULL DEFAULT '',
   revision INTEGER NOT NULL DEFAULT 1,
   archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)),
   created_at TEXT NOT NULL,
   updated_at TEXT NOT NULL,
   aliases TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(aliases)),
   last_operation_id TEXT,
   last_operation_hash TEXT,
   CHECK(quality IS NULL OR resolution IS NOT NULL))`,
      `CREATE TABLE IF NOT EXISTS lesson_photos (
   id TEXT PRIMARY KEY,
   bit_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE RESTRICT,
   title TEXT NOT NULL,
   r2_key TEXT NOT NULL UNIQUE,
   media_type TEXT NOT NULL CHECK(media_type IN ('image/jpeg','image/png','image/gif','image/webp')),
   size INTEGER NOT NULL CHECK(size > 0),
   sha256 TEXT NOT NULL,
   archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)),
   created_at TEXT NOT NULL)`,
      `CREATE INDEX IF NOT EXISTS lessons_live ON lessons(archived,updated_at)`,
      `CREATE INDEX IF NOT EXISTS lesson_photos_bit ON lesson_photos(bit_id,archived)`,
    ],
  },
];

export const latestSchemaVersion = migrations.at(-1).version;

const seedSpecs = [
  [
    "workshop_categories",
    ["id", "parent_id", "name", "sort_order"],
    starterCategories,
  ],
  ["workshop_families", ["id", "category_id", "name", "kind"], starterFamilies],
  [
    "workshop_fields",
    [
      "id",
      "family_id",
      "label",
      "unit",
      "type",
      "choices",
      "sort_order",
      "hidden",
      "filled_on_use",
    ],
    starterFields,
  ],
];

function seedSql(table, columns) {
  const select = columns
    .map((key) => `json_extract(value,'$.${key}')`)
    .join(",");
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
    row = await db
      .prepare("SELECT value FROM workshop_meta WHERE key='schema'")
      .first();
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
      statements.push(
        db.prepare(seedSql(table, columns)).bind(JSON.stringify(rows)),
      );
    }
    statements.push(
      db.prepare(
        "INSERT OR IGNORE INTO workshop_meta(key,value) VALUES('seed','1')",
      ),
    );
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
