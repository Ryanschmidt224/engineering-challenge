import test from "node:test";
import assert from "node:assert/strict";
import {TestD1} from "./helpers/d1.mjs";
import {workshopSchema} from "../functions/api/workshop-schema.js";
import {starterCategories, starterFamilies, starterFields} from "../functions/api/workshop-seed.js";
import {
  migrations,
  latestSchemaVersion,
  migrateWorkshop,
  readSchemaVersion,
  allSchemaStatements,
} from "../functions/api/workshop-migrations.js";
import {initializeWorkshop, workshopSnapshot} from "../functions/api/workshop-db.js";

const meta = (db) =>
  Object.fromEntries(db.sqlite.prepare("SELECT key,value FROM workshop_meta").all().map((row) => [row.key, row.value]));
const count = (db, table) => db.sqlite.prepare("SELECT count(*) AS n FROM " + table).get().n;

// Reproduces exactly what the pre-migration bootstrap (released in PR #35) did,
// so production's existing database shape is tested, not assumed.
function legacyBootstrap(db) {
  for (const sql of workshopSchema) db.sqlite.exec(sql);
  const seed = (table, columns, rows) =>
    db.sqlite
      .prepare(
        `INSERT OR IGNORE INTO ${table} (${columns.join(",")}) SELECT ${columns
          .map((key) => `json_extract(value,'$.${key}')`)
          .join(",")} FROM json_each(?)`,
      )
      .run(JSON.stringify(rows));
  seed("workshop_categories", ["id", "parent_id", "name", "sort_order"], starterCategories);
  seed("workshop_families", ["id", "category_id", "name", "kind"], starterFamilies);
  seed(
    "workshop_fields",
    ["id", "family_id", "label", "unit", "type", "choices", "sort_order", "hidden", "filled_on_use"],
    starterFields,
  );
  db.sqlite.exec("INSERT OR IGNORE INTO workshop_meta(key,value) VALUES('seed','1'),('schema','1')");
}

test("migration versions are unique, ascending and start at 1", () => {
  assert.equal(migrations[0].version, 1);
  migrations.forEach((migration, index) => {
    if (index) assert.equal(migration.version, migrations[index - 1].version + 1);
    assert.ok(migration.name && Array.isArray(migration.statements) && migration.statements.length);
  });
  assert.equal(latestSchemaVersion, migrations.at(-1).version);
});

test("a fresh database migrates to the latest version and is seeded once", async (t) => {
  const db = new TestD1();
  t.after(() => db.close());
  assert.equal(await readSchemaVersion(db), 0);
  assert.equal(await migrateWorkshop(db), latestSchemaVersion);
  assert.equal(meta(db).schema, String(latestSchemaVersion));
  assert.equal(meta(db).seed, "1");
  assert.equal(count(db, "workshop_categories"), 33);
  assert.equal(count(db, "workshop_families"), 60);
  assert.equal(count(db, "workshop_fields"), 432);
});

test("schema=1 adoption preserves custom templates and records while updating default Electronics definitions", async (t) => {
  const db = new TestD1();
  t.after(() => db.close());
  legacyBootstrap(db);
  db.sqlite.exec("UPDATE workshop_families SET name='Owner edited',revision=4,archived=1 WHERE id='f-resistor'");
  db.sqlite.exec("DELETE FROM workshop_fields WHERE id=(SELECT id FROM workshop_fields WHERE family_id='f-led' LIMIT 1)");
  const tables = ["workshop_categories", "workshop_families", "workshop_fields", "workshop_products", "workshop_uses", "workshop_attachments"];
  const before = Object.fromEntries(tables.map((table) => [table, db.sqlite.prepare("SELECT * FROM " + table + " ORDER BY id").all()]));

  assert.equal(await migrateWorkshop(db), latestSchemaVersion);

  for (const table of tables.filter(table=>!["workshop_families","workshop_fields"].includes(table))) {
    assert.deepEqual(db.sqlite.prepare("SELECT * FROM " + table + " ORDER BY id").all(), before[table], table + " unchanged");
  }
  assert.deepEqual(db.sqlite.prepare("SELECT * FROM workshop_families WHERE id='f-resistor'").get(),before.workshop_families.find(row=>row.id==='f-resistor'));
  assert.deepEqual(db.sqlite.prepare("SELECT * FROM workshop_fields WHERE family_id='f-resistor' ORDER BY id").all(),before.workshop_fields.filter(row=>row.family_id==='f-resistor'));
  const missing=starterFields.find(row=>row.family_id==='f-led'&&!before.workshop_fields.some(field=>field.id===row.id));
  assert.equal(db.sqlite.prepare("SELECT * FROM workshop_fields WHERE id=?").get(missing.id),undefined);
  assert.equal(meta(db).seed, "1");
  assert.equal(meta(db).schema, String(latestSchemaVersion));
});

test("repeating the migration is safe and does not reseed deleted or edited starter rows", async (t) => {
  const db = new TestD1();
  t.after(() => db.close());
  await migrateWorkshop(db);
  db.sqlite.exec("DELETE FROM workshop_fields WHERE family_id='f-resistor'");
  db.sqlite.exec("UPDATE workshop_families SET name='Kept' WHERE id='f-resistor'");
  await migrateWorkshop(db);
  await initializeWorkshop(new TestD1(db.sqlite));
  assert.equal(db.sqlite.prepare("SELECT count(*) n FROM workshop_fields WHERE family_id='f-resistor'").get().n, 0);
  assert.equal(db.sqlite.prepare("SELECT name FROM workshop_families WHERE id='f-resistor'").get().name, "Kept");
});

test("a later migration applies once, in a transaction, and a failure leaves the version unchanged", async (t) => {
  const db = new TestD1();
  t.after(() => db.close());
  await migrateWorkshop(db);
  const next = latestSchemaVersion + 1;
  const good = [...migrations, {version: next, name: "probe", statements: ["CREATE TABLE IF NOT EXISTS probe_table (id TEXT PRIMARY KEY)"]}];
  const bad = [
    ...migrations,
    {
      version: next,
      name: "broken",
      statements: ["CREATE TABLE IF NOT EXISTS half_done (id TEXT)", "THIS IS NOT SQL"],
    },
  ];

  await assert.rejects(migrateWorkshop(db, bad));
  assert.equal(await readSchemaVersion(db), latestSchemaVersion);
  assert.equal(db.sqlite.prepare("SELECT name FROM sqlite_master WHERE name='half_done'").get(), undefined, "rolled back");

  assert.equal(await migrateWorkshop(db, good), next);
  assert.equal(await migrateWorkshop(db, good), next);
  assert.ok(db.sqlite.prepare("SELECT name FROM sqlite_master WHERE name='probe_table'").get());
});

test("a database newer than this code (after a rollback) is left untouched", async (t) => {
  const db = new TestD1();
  t.after(() => db.close());
  await migrateWorkshop(db);
  db.sqlite.exec("UPDATE workshop_meta SET value='99' WHERE key='schema'");
  assert.equal(await migrateWorkshop(db), 99);
  assert.equal(meta(db).schema, "99");
  assert.equal((await workshopSnapshot(db)).families.length, 60);
});

test("the version never moves backwards when an older migration list runs", async (t) => {
  const db = new TestD1();
  t.after(() => db.close());
  const next = latestSchemaVersion + 1;
  await migrateWorkshop(db, [...migrations, {version: next, name: "probe", statements: ["CREATE TABLE IF NOT EXISTS probe_table (id TEXT)"]}]);
  await migrateWorkshop(db);
  assert.equal(await readSchemaVersion(db), next);
});

test("the backup restore and the runtime share one schema authority", () => {
  assert.deepEqual(allSchemaStatements(), migrations.flatMap((migration) => migration.statements));
  assert.ok(allSchemaStatements().length >= workshopSchema.length);
});
