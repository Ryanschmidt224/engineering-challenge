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
import {initializeWorkshop} from "../functions/api/workshop-db.js";
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
async function seedHistorical(env,record) {
 await initializeWorkshop(env.WORKSHOP_DB);
 await env.WORKSHOP_DB.prepare("INSERT INTO knowledge_tiles(id,type,title,summary,body,status,sources,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)")
 .bind(record.id,record.type,record.title,record.summary,record.body,record.status,JSON.stringify(record.sources),"2026-11-26","2026-11-26").run();
 await env.WORKSHOP_DB.prepare("INSERT INTO knowledge_links(id,tile_id,target_type,target_id,target_label,relation,note,created_at) VALUES(?,?,?,?,?,?,?,?)")
 .bind(crypto.randomUUID(),record.id,"family","f-buck-converter","Buck converter","applies_to","", "2026-11-26").run();
}
test("retired tile API denies writes without changing historical records",async t=>{
 const {env,call}=await fixture(t);await seedHistorical(env,tile());
 const before=env.WORKSHOP_DB.sqlite.prepare("SELECT * FROM knowledge_tiles").all();
 for(const method of ["GET","POST","PATCH"]){
  const response=await call("/api/knowledge",method,method==="GET"?undefined:{entity:"tile",record:tile(),expectedRevision:null});
  assert.equal(response.status,410);assert.equal((await response.json()).code,"LEGACY_RETIRED");
 }
 assert.equal((await worker.fetch(new Request(origin+"/api/knowledge"),env,{})).status,401);
 assert.equal((await call("/api/knowledge","POST",{}, {origin:"https://other.test"})).status,403);
 assert.deepEqual(env.WORKSHOP_DB.sqlite.prepare("SELECT * FROM knowledge_tiles").all(),before);
});

test("export format 2 includes Knowledge and restores it; format 1 backups still restore", async (t) => {
  const {env, call} = await fixture(t);
  const record = tile({sources: [{title: "Note", url: "https://example.test"}]});
  await seedHistorical(env, record);
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
  await seedHistorical(env, record);
  // The released bootstrap (PR #35) re-runs when schema != '1': it must be harmless.
  const db = env.WORKSHOP_DB.sqlite;
  for (const sql of workshopSchema) db.exec(sql);
  db.exec("INSERT OR IGNORE INTO workshop_meta(key,value) VALUES('seed','1'),('schema','1')");
  assert.equal(db.prepare("SELECT value FROM workshop_meta WHERE key='schema'").get().value, String(latestSchemaVersion));
  assert.equal(db.prepare("SELECT count(*) n FROM workshop_families").get().n, 60);
  assert.equal(db.prepare("SELECT count(*) n FROM knowledge_tiles").get().n, 1);
});

test("Knowledge pages render text safely and use the shared components", () => {
  const script = readFileSync("assets/lessons-learned.js", "utf8");
  const workshop = readFileSync("assets/family-workshop.js", "utf8");
  assert.doesNotMatch(script, /innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
  assert.doesNotMatch(workshop, /innerHTML|insertAdjacentHTML/);
  const page = readFileSync("knowledge.html", "utf8");
  assert.ok(page.includes("assets/components.css") && page.includes("assets/theme.css"));
  assert.ok(!/site-polish|site-controls|site-workspaces/.test(page), "no legacy override stylesheets");
  assert.match(readFileSync("workshop.html", "utf8"), /assets\/workshop-page\.js/);
  assert.match(readFileSync("assets/workshop-page.js", "utf8"), /site-header\.js/);
  assert.ok(readFileSync("assets/site-header.js", "utf8").includes('"knowledge.html"'));
});
