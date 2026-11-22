import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {TestD1} from "./helpers/d1.mjs";
import {TestR2} from "./helpers/r2.mjs";
import {provisionTestAccount} from "./helpers/accounts.mjs";
import worker from "../worker.js";
import {verifyWorkshopBackup, restoreCatalog} from "../scripts/workshop-backup.mjs";
import {workshopSchema} from "../functions/api/workshop-schema.js";
import {latestSchemaVersion} from "../functions/api/workshop-migrations.js";

const origin = "https://knowledge.example.test";

async function fixture(t) {
  const env = {WORKSHOP_DB: new TestD1(), PHOTOS: new TestR2(), admin_password: "test-only-owner-secret"};
  t.after(() => env.WORKSHOP_DB.close());
  const login = await provisionTestAccount(
    new Request(origin + "/api/accounts", {
      method: "POST",
      headers: {origin},
      body: JSON.stringify({action: "register", email: "owner@example.test", password: "test-only-owner-password"}),
    }),
    env,
    {role: "admin"},
  );
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const call = (path, method = "GET", body, headers = {}) =>
    worker.fetch(
      new Request(origin + path, {
        method,
        headers: {origin, cookie, ...headers},
        ...(body === undefined ? {} : {body: JSON.stringify(body)}),
      }),
      env,
      {},
    );
  return {env, call};
}

const tile = (overrides = {}) => ({
  id: crypto.randomUUID(),
  type: "concept",
  status: "draft",
  title: "Inrush current",
  summary: "The surge of current when a supply is first connected.",
  body: "",
  sources: [],
  ...overrides,
});
const saveTile = (call, record, expectedRevision = null) => call("/api/knowledge", "POST", {entity: "tile", record, expectedRevision});
const link = (tileId, overrides = {}) => ({
  id: crypto.randomUUID(),
  tile_id: tileId,
  target_type: "family",
  target_id: "f-buck-converter",
  relation: "applies_to",
  note: "",
  ...overrides,
});
const saveLink = (call, record) => call("/api/knowledge", "POST", {entity: "link", record, expectedRevision: null});

test("knowledge tables arrive by migration on a fresh database", async (t) => {
  const {env, call} = await fixture(t);
  assert.equal((await call("/api/knowledge")).status, 200);
  const tables = env.WORKSHOP_DB.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((row) => row.name);
  assert.ok(tables.includes("knowledge_tiles") && tables.includes("knowledge_links"));
  assert.equal(env.WORKSHOP_DB.sqlite.prepare("SELECT value FROM workshop_meta WHERE key='schema'").get().value, String(latestSchemaVersion));
});

test("the API is owner-only and rejects cross-origin writes", async (t) => {
  const {env, call} = await fixture(t);
  assert.equal((await call("/api/knowledge")).status, 200);
  assert.equal((await worker.fetch(new Request(origin + "/api/knowledge"), env, {})).status, 401);
  const response = await call("/api/knowledge", "POST", {entity: "tile", record: tile(), expectedRevision: null}, {origin: "https://elsewhere.example.test"});
  assert.equal(response.status, 403);
  assert.equal(env.WORKSHOP_DB.sqlite.prepare("SELECT count(*) n FROM knowledge_tiles").get().n, 0);
});

test("tiles require a title and summary, a listed type and safe source links", async (t) => {
  const {call} = await fixture(t);
  assert.equal((await saveTile(call, tile({summary: "  "}))).status, 400);
  assert.equal((await saveTile(call, tile({title: ""}))).status, 400);
  assert.equal((await saveTile(call, tile({type: "rumor"}))).status, 400);
  assert.equal((await saveTile(call, tile({status: "proven"}))).status, 400);
  assert.equal((await saveTile(call, tile({summary: "x".repeat(401)}))).status, 400);
  assert.equal((await saveTile(call, tile({sources: [{title: "x", url: "javascript:alert(1)"}]}))).status, 400);
  const ok = await saveTile(call, tile({title: "<b>Ringing</b>", sources: [{title: "App note", url: "https://example.test/an.pdf"}]}));
  assert.equal(ok.status, 200);
  const {record} = await ok.json();
  assert.equal(record.status, "draft");
  assert.equal(record.revision, 1);
  assert.equal(record.title, "<b>Ringing</b>", "stored as plain text, never interpreted");
  assert.deepEqual(record.sources, [{title: "App note", url: "https://example.test/an.pdf"}]);
});

test("a stale tab cannot overwrite a newer edit", async (t) => {
  const {call} = await fixture(t);
  const record = tile();
  await saveTile(call, record);
  assert.equal((await saveTile(call, {...record, summary: "First edit wins."}, 1)).status, 200);
  const stale = await saveTile(call, {...record, summary: "Stale edit."}, 1);
  assert.equal(stale.status, 409);
  const {tiles} = await (await call("/api/knowledge")).json();
  assert.equal(tiles[0].summary, "First edit wins.");
  assert.equal(tiles[0].revision, 2);
  assert.equal((await saveTile(call, record)).status, 409, "creating an existing ID is a conflict, not an overwrite");
});

test("links to a family resolve its name and report archived or missing targets", async (t) => {
  const {env, call} = await fixture(t);
  const record = tile();
  await saveTile(call, record);
  assert.equal((await saveLink(call, link(record.id, {note: "Measured 41 V overshoot"}))).status, 200);
  assert.equal((await saveLink(call, link(record.id))).status, 409, "same active link twice");
  assert.equal((await saveLink(call, link(record.id, {target_id: "f-no-such-family"}))).status, 400);
  assert.equal((await saveLink(call, link(record.id, {target_type: "project"}))).status, 400);
  assert.equal((await saveLink(call, link(crypto.randomUUID()))).status, 400, "unknown tile");

  let {links} = await (await call("/api/knowledge")).json();
  assert.equal(links.length, 1);
  assert.equal(links[0].target_name, "Buck converter");
  assert.equal(links[0].target_state, "available");
  assert.equal(links[0].target_label, "Buck converter");

  env.WORKSHOP_DB.sqlite.exec("UPDATE workshop_families SET archived=1 WHERE id='f-buck-converter'");
  ({links} = await (await call("/api/knowledge")).json());
  assert.equal(links[0].target_state, "archived");

  env.WORKSHOP_DB.sqlite.exec("UPDATE knowledge_links SET target_id='f-deleted-family'");
  ({links} = await (await call("/api/knowledge")).json());
  assert.equal(links[0].target_state, "missing");
  assert.equal(links[0].target_name, "Buck converter", "last known label is kept");
});

test("archiving a tile keeps its links; restoring does not bring back removed links", async (t) => {
  const {env, call} = await fixture(t);
  const record = tile();
  await saveTile(call, record);
  const kept = link(record.id);
  const removed = link(record.id, {target_id: "f-dc-power-supply"});
  await saveLink(call, kept);
  await saveLink(call, removed);
  assert.equal((await call("/api/knowledge", "PATCH", {entity: "link", id: removed.id, expectedRevision: 1, archived: true})).status, 200);
  assert.equal((await call("/api/knowledge", "PATCH", {entity: "tile", id: record.id, expectedRevision: 1, archived: true})).status, 200);
  assert.equal((await call("/api/knowledge", "PATCH", {entity: "tile", id: record.id, expectedRevision: 1, archived: false})).status, 409, "stale");
  assert.equal((await call("/api/knowledge", "PATCH", {entity: "tile", id: record.id, expectedRevision: 2, archived: false})).status, 200);
  const rows = env.WORKSHOP_DB.sqlite.prepare("SELECT id,archived FROM knowledge_links").all();
  assert.equal(rows.find((row) => row.id === kept.id).archived, 0);
  assert.equal(rows.find((row) => row.id === removed.id).archived, 1);
  assert.equal(env.WORKSHOP_DB.sqlite.prepare("SELECT archived FROM workshop_families WHERE id='f-buck-converter'").get().archived, 0);
  assert.equal((await saveLink(call, link(record.id, {target_id: "f-dc-power-supply"}))).status, 200, "a removed link can be added again");
});

test("a link's relation and note can change, but not its target", async (t) => {
  const {env, call} = await fixture(t);
  const record = tile();
  await saveTile(call, record);
  const first = link(record.id);
  await saveLink(call, first);
  const updated = await call("/api/knowledge", "POST", {
    entity: "link",
    record: {...first, relation: "explains", note: "Why it rings", target_id: "f-resistor"},
    expectedRevision: 1,
  });
  assert.equal(updated.status, 200);
  const row = env.WORKSHOP_DB.sqlite.prepare("SELECT * FROM knowledge_links").get();
  assert.equal(row.relation, "explains");
  assert.equal(row.note, "Why it rings");
  assert.equal(row.target_id, "f-buck-converter");
});

test("export format 2 includes Knowledge and restores it; format 1 backups still restore", async (t) => {
  const {call} = await fixture(t);
  const record = tile({sources: [{title: "Note", url: "https://example.test"}]});
  await saveTile(call, record);
  await saveLink(call, link(record.id));
  const text = await (await call("/api/workshop/export")).text();
  const lines = text.trim().split("\n");
  assert.equal(JSON.parse(lines[0]).version, 2);
  const result = await verifyWorkshopBackup(lines);
  assert.equal(result.catalog.knowledge_tiles.length, 1);
  assert.equal(result.catalog.knowledge_links.length, 1);
  const restored = new DatabaseSync(":memory:");
  t.after(() => restored.close());
  restoreCatalog(result.catalog, restored, 2);
  assert.equal(restored.prepare("SELECT title FROM knowledge_tiles").get().title, "Inrush current");
  assert.equal(restored.prepare("SELECT count(*) n FROM knowledge_links").get().n, 1);
  assert.equal(restored.prepare("SELECT value FROM workshop_meta WHERE key='schema'").get().value, String(latestSchemaVersion));

  // A format 1 export (before Knowledge) still verifies.
  const header = {...JSON.parse(lines[0]), version: 1};
  const catalog = JSON.parse(lines[1]);
  delete catalog.data.knowledge_tiles;
  delete catalog.data.knowledge_links;
  const v1 = [JSON.stringify(header), JSON.stringify(catalog), ...lines.slice(2)];
  assert.equal((await verifyWorkshopBackup(v1)).catalog.families.length, 60);

  // Knowledge missing from a format 2 file, or a damaged tile, fails verification.
  const missing = [lines[0], JSON.stringify(catalog), ...lines.slice(2)];
  await assert.rejects(() => verifyWorkshopBackup(missing), /Knowledge is missing/);
  const damaged = JSON.parse(lines[1]);
  damaged.data.knowledge_tiles[0].summary = "";
  await assert.rejects(() => verifyWorkshopBackup([lines[0], JSON.stringify(damaged), ...lines.slice(2)]), /Summary is required/);
});

test("the previous Worker version still starts against the migrated database", async (t) => {
  const {env, call} = await fixture(t);
  const record = tile();
  await saveTile(call, record);
  // The released bootstrap (PR #35) re-runs when schema != '1': it must be harmless.
  const db = env.WORKSHOP_DB.sqlite;
  for (const sql of workshopSchema) db.exec(sql);
  db.exec("INSERT OR IGNORE INTO workshop_meta(key,value) VALUES('seed','1'),('schema','1')");
  assert.equal(db.prepare("SELECT value FROM workshop_meta WHERE key='schema'").get().value, String(latestSchemaVersion));
  assert.equal(db.prepare("SELECT count(*) n FROM workshop_families").get().n, 60);
  assert.equal(db.prepare("SELECT count(*) n FROM knowledge_tiles").get().n, 1);
});

test("Knowledge pages render text safely and use the shared components", () => {
  const script = readFileSync("assets/knowledge.js", "utf8");
  const workshop = readFileSync("assets/family-workshop.js", "utf8");
  assert.doesNotMatch(script, /innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
  assert.doesNotMatch(workshop, /innerHTML|insertAdjacentHTML/);
  const page = readFileSync("knowledge.html", "utf8");
  assert.ok(page.includes("assets/components.css") && page.includes("assets/theme.css"));
  assert.ok(!/site-polish|site-controls|site-workspaces/.test(page), "no legacy override stylesheets");
  assert.ok(readFileSync("workshop.html", "utf8").includes('href="knowledge.html"'));
});
