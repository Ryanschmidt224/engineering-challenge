import test from "node:test";
import assert from "node:assert/strict";
import {TestD1} from "./helpers/d1.mjs";
import {TestR2} from "./helpers/r2.mjs";
import {provisionTestAccount} from "./helpers/accounts.mjs";
import worker from "../worker.js";
import {targetHref} from "../assets/knowledge-model.js";
import {resolveTargets, key} from "../functions/api/knowledge-targets.js";

const origin = "https://knowledge.example.test";

test("D1 test bindings enforce the platform's 100-parameter limit", (t) => {
  const db = new TestD1();
  t.after(() => db.close());
  assert.throws(() => db.prepare("SELECT 1").bind(...Array(101).fill(1)), /parameter limit/);
});

test("target resolution handles large catalogs, duplicates, missing and archived IDs within D1 limits", async (t) => {
  const {env} = await fixture(t);
  const db = env.WORKSHOP_DB;
  for (let i = 0; i < 350; i++) {
    await db.prepare("INSERT INTO workshop_families(id,name,archived) VALUES(?,?,?)").bind("boundary-" + i, "Family " + i, i === 349 ? 1 : 0).run();
  }
  for (const count of [0, 1, 100, 101, 350]) {
    const wanted = Array.from({length: count}, (_, i) => ({target_type: "family", target_id: "boundary-" + i}));
    const found = await resolveTargets(env, db, wanted);
    assert.equal(found.size, count);
    for (const target of wanted) assert.equal(found.get(key(target)).state, target.target_id === "boundary-349" ? "archived" : "available");
  }
  const wanted = [{target_type: "family", target_id: "boundary-0"}, {target_type: "family", target_id: "missing-id"}];
  const found = await resolveTargets(env, db, [...wanted, ...wanted]);
  assert.equal(found.size, 2);
  assert.equal(found.get(key(wanted[1])).state, "missing");
});

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
  const call = (path, method = "GET", body) =>
    worker.fetch(
      new Request(origin + path, {method, headers: {origin, cookie}, ...(body === undefined ? {} : {body: JSON.stringify(body)})}),
      env,
      {},
    );
  const ok = async (response) => {
    const body = await response.json();
    assert.ok(response.ok, JSON.stringify(body));
    return body;
  };
  await ok(await call("/api/knowledge"));

  // A product in the buck converter family and a project part that uses it.
  const product = {
    id: crypto.randomUUID(),
    family_id: "f-buck-converter",
    name: "LM2596 module",
    manufacturer: "",
    mpn: "",
    supplier_links: [],
    notes: "",
    field_values: {},
  };
  await ok(await call("/api/workshop", "POST", {entity: "product", record: product, expectedRevision: null, expectedFamilyRevision: 1}));
  const use = {
    id: crypto.randomUUID(),
    project_id: "launcher",
    tree_node_id: null,
    family_id: "f-buck-converter",
    product_id: product.id,
    purpose: "Logic supply",
    quantity: 1,
    unit: "pcs",
    field_values: {},
    notes: "",
  };
  await ok(await call("/api/workshop", "POST", {entity: "use", record: use, expectedRevision: null, expectedFamilyRevision: 1}));
  const recordId = crypto.randomUUID();
  await env.PHOTOS.put(
    "investigations/launcher.json",
    JSON.stringify({records: [{id: recordId, title: "MCU died at power-on", lifecycle: "active", entries: []}], revision: "1"}),
  );
  const tile = async (title, overrides = {}) => {
    const record = {id: crypto.randomUUID(), type: "concept", status: "draft", title, summary: title + " summary.", body: "", sources: [], ...overrides};
    await ok(await call("/api/knowledge", "POST", {entity: "tile", record, expectedRevision: null}));
    return record.id;
  };
  const link = (tileId, target_type, target_id, extra = {}) =>
    call("/api/knowledge", "POST", {
      entity: "link",
      record: {id: crypto.randomUUID(), tile_id: tileId, target_type, target_id, relation: "applies_to", note: "", ...extra},
      expectedRevision: null,
    });
  return {env, call, ok, product, use, recordId, tile, link};
}

test("tiles link to tiles, products, project parts, projects and project records", async (t) => {
  const {call, ok, product, use, recordId, tile, link} = await fixture(t);
  const lesson = await tile("ATtiny85 died at power-on", {type: "lesson"});
  const concept = await tile("Inrush current");

  assert.equal((await link(lesson, "tile", concept, {relation: "see_also"})).status, 200);
  assert.equal((await link(lesson, "tile", lesson)).status, 400, "no self links");
  assert.equal((await link(lesson, "product", product.id)).status, 200);
  // The client cannot claim a different project for a part: it comes from the part.
  assert.equal((await link(lesson, "use", use.id, {target_project_id: "robot"})).status, 200);
  assert.equal((await link(lesson, "project", "launcher")).status, 200);
  assert.equal((await link(lesson, "record", recordId)).status, 400, "a record needs its project");
  assert.equal((await link(lesson, "record", recordId, {target_project_id: "launcher"})).status, 200);
  assert.equal((await link(lesson, "record", crypto.randomUUID(), {target_project_id: "launcher"})).status, 400, "unknown record");
  assert.equal((await link(lesson, "project", "pdeadbeefdeadbeefdeadbeefdeadbeef")).status, 400, "unknown project");

  const {links} = await ok(await call("/api/knowledge"));
  const byType = Object.fromEntries(links.map((entry) => [entry.target_type, entry]));
  assert.equal(byType.tile.target_name, "Inrush current");
  assert.equal(byType.product.target_name, "LM2596 module");
  assert.equal(byType.use.target_name, "Logic supply");
  assert.equal(byType.use.target_project_id, "launcher");
  assert.equal(byType.project.target_name, "Foam-dart launcher");
  assert.equal(byType.record.target_name, "MCU died at power-on");
  assert.equal(byType.record.target_project_name, "Foam-dart launcher");
  assert.ok(links.every((entry) => entry.target_state === "available"));

  assert.equal(targetHref(byType.use), "index.html#launcher/part/" + use.id);
  assert.equal(targetHref(byType.record), "index.html#launcher");
  assert.equal(targetHref(byType.tile), "knowledge.html?tile=" + concept);
});

test("a project part sees its own, its product's and its family's tiles once each, never project-wide ones", async (t) => {
  const {call, ok, product, use, tile, link} = await fixture(t);
  const familyTile = await tile("Hot-plug ringing");
  const productTile = await tile("LM2596 input limits");
  const partTile = await tile("Logic supply notes");
  const projectTile = await tile("Launcher power budget");
  const archivedTile = await tile("Old idea");
  await link(familyTile, "family", "f-buck-converter");
  await link(familyTile, "product", product.id, {relation: "explains"});
  await link(productTile, "product", product.id);
  await link(partTile, "use", use.id);
  await link(projectTile, "project", "launcher");
  await link(archivedTile, "family", "f-buck-converter");
  await ok(await call("/api/knowledge", "PATCH", {entity: "tile", id: archivedTile, expectedRevision: 1, archived: true}));

  const part = await ok(await call("/api/knowledge?related=use&id=" + use.id));
  assert.deepEqual(part.tiles.map((entry) => entry.title).sort(), ["Hot-plug ringing", "LM2596 input limits", "Logic supply notes"]);
  const ringing = part.tiles.find((entry) => entry.title === "Hot-plug ringing");
  assert.deepEqual(ringing.via.map((via) => via.target_type).sort(), ["family", "product"], "one card, both reasons");

  const productView = await ok(await call("/api/knowledge?related=product&id=" + product.id));
  assert.deepEqual(productView.tiles.map((entry) => entry.title).sort(), ["Hot-plug ringing", "LM2596 input limits"]);
  const familyView = await ok(await call("/api/knowledge?related=family&id=f-buck-converter"));
  assert.deepEqual(familyView.tiles.map((entry) => entry.title), ["Hot-plug ringing"]);
  const projectView = await ok(await call("/api/knowledge?related=project&id=launcher"));
  assert.deepEqual(projectView.tiles.map((entry) => entry.title), ["Launcher power budget"]);
  assert.equal((await call("/api/knowledge?related=everything&id=x")).status, 400);
});

test("incoming tile links are listed; only explicit links count (no chains)", async (t) => {
  const {call, ok, tile, link} = await fixture(t);
  const a = await tile("A");
  const b = await tile("B");
  const c = await tile("C");
  await link(a, "tile", b, {relation: "see_also"});
  await link(b, "tile", c, {relation: "see_also"});
  const intoC = await ok(await call("/api/knowledge?related=tile&id=" + c));
  assert.deepEqual(intoC.tiles.map((entry) => entry.title), ["B"], "A reaches C only through B, so it is not listed");
});

test("deleted records and archived parts are shown as unavailable, not dropped", async (t) => {
  const {env, call, ok, use, recordId, tile, link} = await fixture(t);
  const lesson = await tile("Lesson");
  await link(lesson, "record", recordId, {target_project_id: "launcher"});
  await link(lesson, "use", use.id);
  await env.PHOTOS.put("investigations/launcher.json", JSON.stringify({records: [], revision: "2"}));
  await ok(await call("/api/workshop", "PATCH", {entity: "use", id: use.id, expectedRevision: 1, archived: true}));
  const {links} = await ok(await call("/api/knowledge"));
  const record = links.find((entry) => entry.target_type === "record");
  const part = links.find((entry) => entry.target_type === "use");
  assert.equal(record.target_state, "missing");
  assert.equal(record.target_name, "MCU died at power-on", "last known label");
  assert.equal(part.target_state, "archived");
});
