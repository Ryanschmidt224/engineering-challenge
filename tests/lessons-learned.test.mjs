import test from "node:test";
import assert from "node:assert/strict";
import { TestD1 } from "./helpers/d1.mjs";
import { TestR2 } from "./helpers/r2.mjs";
import { provisionTestAccount } from "./helpers/accounts.mjs";
import worker from "../worker.js";
import {
  validateBit,
  titleOf,
  isBlank,
  linkNames,
  segments,
  titleIndex,
  backlinksOf,
  filterBits,
  insertStep,
  moveStep,
  emptyStep,
  qualityOf,
  nameKey,
} from "../assets/lessons-model.js";

const origin = "https://info-bits.example.test";
const id = () => crypto.randomUUID();
const step = (overrides = {}) => ({ ...emptyStep(id()), ...overrides });
const bit = (overrides = {}) => ({
  id: id(),
  happened: "Buck converter blew up at power-on",
  steps: [
    step({ question: "Why?", result: "Learned about [[LC overshoot]]." }),
  ],
  resolution: null,
  ...overrides,
});
// Smallest valid PNG header; enough for the signature check.
const png = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 1, 2, 3,
]);

async function fixture(t) {
  const env = {
    WORKSHOP_DB: new TestD1(),
    PHOTOS: new TestR2(),
    admin_password: "test-only-owner-secret",
  };
  t.after(() => env.WORKSHOP_DB.close());
  const login = await provisionTestAccount(
    new Request(origin + "/api/accounts", {
      method: "POST",
      headers: { origin },
      body: JSON.stringify({
        action: "register",
        email: "owner@example.test",
        password: "test-only-owner-password",
      }),
    }),
    env,
    { role: "admin" },
  );
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const call = (path, method = "GET", body, headers = {}) =>
    worker.fetch(
      new Request(origin + path, {
        method,
        headers: { origin, cookie, ...headers },
        ...(body === undefined
          ? {}
          : { body: body instanceof Uint8Array ? body : JSON.stringify(body) }),
      }),
      env,
      {},
    );
  const save = (record, expectedRevision = null) =>
    call("/api/lessons-learned", "POST", { record, expectedRevision });
  const upload = (bitId, photoId, bytes = png, name = "trace.png") =>
    call("/api/lessons-learned/photo?bit=" + bitId, "POST", bytes, {
      "x-file-name": name,
      "x-upload-id": photoId,
    });
  return { env, call, save, upload };
}

// ---------- model ----------

test("model: validation keeps text, rejects bad shapes and limits", () => {
  const ok = validateBit(
    bit({ resolution: { text: "Added a bulk cap.", quality: "meh" } }),
  );
  assert.equal(ok.resolution.quality, "meh");
  assert.throws(
    () => validateBit(bit({ resolution: { text: "", quality: "great" } })),
    /Yes, Meh or No/,
  );
  assert.throws(() => validateBit(bit({ steps: "nope" })), /list/);
  const s = step();
  assert.throws(() => validateBit(bit({ steps: [s, s] })), /own ID/);
  assert.throws(
    () => validateBit(bit({ happened: "x".repeat(2001) })),
    /too long/,
  );
  assert.equal(validateBit(bit({ happened: "a\r\nb" })).happened, "a\nb");
});

test("model: titles, links, segments and backlinks", () => {
  const story = bit();
  const concept = bit({ happened: "LC overshoot\nmore lines", steps: [] });
  assert.equal(titleOf(concept), "LC overshoot");
  assert.deepEqual(linkNames("see [[A]] and [[a]] and [[B]]"), ["A", "B"]);
  const index = titleIndex([story, concept]);
  const parts = segments(
    "Learned about [[lc overshoot]] and [[Switch bounce]].",
    (n) => index.get(nameKey(n)) || null,
  );
  assert.deepEqual(
    parts.map((p) => p.kind),
    ["text", "link", "text", "link", "text"],
  );
  assert.equal(parts[1].target.id, concept.id);
  assert.equal(parts[3].target, null); // no bit yet: the page offers to start one
  assert.deepEqual(
    backlinksOf(concept, [story, concept]).map((b) => b.id),
    [story.id],
  );
  assert.deepEqual(backlinksOf(story, [story, concept]), []);
});

test("model: search words and quality filter", () => {
  const a = bit({
    resolution: { text: "Bulk electrolytic at the input", quality: "yes" },
  });
  const b = bit({ happened: "Switch bounce", steps: [], resolution: null });
  assert.deepEqual(
    filterBits([a, b], { search: "bulk input" }).map((x) => x.id),
    [a.id],
  );
  assert.deepEqual(
    filterBits([a, b], { search: "overshoot" }).map((x) => x.id),
    [a.id],
  ); // [[link]] text is searchable
  assert.deepEqual(
    filterBits([a, b], { quality: "none" }).map((x) => x.id),
    [b.id],
  );
  assert.equal(qualityOf(a), "yes");
});

test("model: insert, move and blank detection", () => {
  const [a, b, c] = [
    step({ question: "a" }),
    step({ question: "b" }),
    step({ question: "c" }),
  ];
  assert.deepEqual(insertStep([a, c], 1, b), [a, b, c]);
  assert.deepEqual(moveStep([a, b, c], 2, -1), [a, c, b]);
  assert.deepEqual(moveStep([a, b, c], 0, -1), [a, b, c]);
  assert.equal(
    isBlank(validateBit(bit({ happened: " ", steps: [step()] }))),
    true,
  );
  assert.equal(
    isBlank(
      validateBit(
        bit({
          happened: "",
          steps: [],
          resolution: { text: "", quality: "no" },
        }),
      ),
    ),
    false,
  );
});

// ---------- API ----------

test("api: owner only, same origin only", async (t) => {
  const { env } = await fixture(t);
  const anonymous = await worker.fetch(
    new Request(origin + "/api/lessons-learned"),
    env,
    {},
  );
  assert.equal(anonymous.status, 401);
});

test("api: create, read, update with revisions, conflict keeps the newer copy", async (t) => {
  const { call, save } = await fixture(t);
  const record = bit({
    resolution: { text: "Bulk cap fixed it.", quality: "yes" },
  });
  let response = await save(record);
  assert.equal(response.status, 201);
  const created = (await response.json()).record;
  assert.equal(created.revision, 1);
  assert.equal(
    (await save(record)).status,
    409,
    "creating the same ID twice is a conflict",
  );

  response = await save({ ...record, happened: "Edited" }, 1);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).record.revision, 2);
  assert.equal(
    (await save({ ...record, happened: "Stale tab" }, 1)).status,
    409,
  );

  const list = await (await call("/api/lessons-learned")).json();
  assert.equal(list.bits.length, 1);
  assert.equal(list.bits[0].happened, "Edited");
  assert.deepEqual(list.bits[0].resolution, {
    text: "Bulk cap fixed it.",
    quality: "yes",
  });
});

test("api: photos upload once, retry safely, and are archived (not erased) when removed", async (t) => {
  const { env, call, save, upload } = await fixture(t);
  const record = bit();
  await save(record);
  const photoId = id();
  assert.equal((await upload(record.id, photoId)).status, 201);
  assert.equal(
    (await upload(record.id, photoId)).status,
    201,
    "a retry with the same ID is accepted",
  );
  assert.equal(
    (
      await upload(
        record.id,
        photoId,
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9]),
      )
    ).status,
    409,
  );
  assert.equal(
    (await upload(record.id, id(), new Uint8Array([1, 2, 3]))).status,
    415,
    "contents must match the name",
  );
  assert.equal((await upload(record.id, id(), png, "notes.pdf")).status, 415);

  const withPhoto = {
    ...record,
    steps: [{ ...record.steps[0], photos: [photoId] }],
  };
  assert.equal((await save(withPhoto, 1)).status, 200);
  const image = await call("/api/lessons-learned/photo?id=" + photoId);
  assert.equal(image.status, 200);
  assert.equal(image.headers.get("content-type"), "image/png");

  assert.equal(
    (
      await save(
        { ...withPhoto, steps: [{ ...withPhoto.steps[0], photos: [id()] }] },
        2,
      )
    ).status,
    400,
    "unknown photo",
  );
  assert.equal(
    (await save(record, 2)).status,
    200,
    "photo removed from the step",
  );
  const snapshot = await (await call("/api/lessons-learned")).json();
  assert.equal(snapshot.photos.length, 0, "removed photo is archived");
  assert.ok(
    await env.PHOTOS.get("lessons/photos/" + photoId),
    "bytes are kept",
  );
  assert.equal(
    (await call("/api/lessons-learned/photo?id=" + photoId)).status,
    200,
    "archived photos stay readable",
  );
});

test("api: a stale save does not archive photos", async (t) => {
  const { call, save, upload } = await fixture(t);
  const record = bit();
  await save(record);
  const photoId = id();
  await upload(record.id, photoId);
  const withPhoto = {
    ...record,
    steps: [{ ...record.steps[0], photos: [photoId] }],
  };
  await save(withPhoto, 1); // revision 2
  assert.equal((await save(record, 1)).status, 409); // stale tab without the photo
  const snapshot = await (await call("/api/lessons-learned")).json();
  assert.equal(
    snapshot.photos.length,
    1,
    "the losing save must not archive anything",
  );
});

test("api: new bits cannot reference photos; photos need a saved, live bit", async (t) => {
  const { call, save, upload } = await fixture(t);
  const record = bit({ steps: [step({ photos: [id()] })] });
  assert.equal((await save(record)).status, 400);
  assert.equal((await upload(id(), id())).status, 404);
  const saved = bit();
  await save(saved);
  assert.equal(
    (
      await call("/api/lessons-learned", "PATCH", {
        id: saved.id,
        archived: true,
        expectedRevision: 1,
      })
    ).status,
    200,
  );
  assert.equal((await upload(saved.id, id())).status, 404, "archived bit");
  const live = await (await call("/api/lessons-learned")).json();
  assert.equal(live.bits.length, 0);
  const archived = await (await call("/api/lessons-learned?archived=1")).json();
  assert.equal(archived.bits.length, 1, "archive keeps the record");
});

test("new Lessons schema is additive, repeat safe and starts without converting retired tiles",async t=>{
 const {env,call}=await fixture(t);
 const {initializeWorkshop}=await import("../functions/api/workshop-db.js");
 await initializeWorkshop(env.WORKSHOP_DB);await initializeWorkshop(env.WORKSHOP_DB);
 assert.equal((await (await call("/api/lessons-learned")).json()).bits.length,0);
 assert.ok(await env.WORKSHOP_DB.prepare("SELECT name FROM sqlite_master WHERE name='knowledge_tiles'").first());
});

test("lost save replies replay once and renaming preserves title links",async t=>{
 const {save,call}=await fixture(t);const record=bit(),operationId=id();
 const command={record,expectedRevision:null,operationId};
 let reply=await call("/api/lessons-learned","POST",command);assert.equal(reply.status,201);
 reply=await call("/api/lessons-learned","POST",command);assert.equal(reply.status,200);assert.equal((await reply.json()).record.revision,1);
 const renamed={...record,happened:"A better title"};reply=await save(renamed,1);assert.equal(reply.status,200);const next=(await reply.json()).record;
 assert.ok(next.aliases.includes(titleOf(record)));assert.equal(titleIndex([next]).get(nameKey(titleOf(record))).id,record.id);
});

test('two simultaneous lesson saves at the same timestamp cannot archive the winning photo',async t=>{
 const {save,upload,call}=await fixture(t),record=bit(),photo=id();await save(record);await upload(record.id,photo);
 const OriginalDate=Date;globalThis.Date=class extends OriginalDate {toISOString(){return '2026-11-27T00:00:00.000Z';}};t.after(()=>{globalThis.Date=OriginalDate;});
 const withPhoto={...record,steps:[{...record.steps[0],photos:[photo]}]};
 const responses=await Promise.all([save(withPhoto,1),save(record,1)]);
 assert.equal(responses[0].status,200);assert.equal(responses[1].status,409);const snapshot=await(await call('/api/lessons-learned')).json();assert.equal(snapshot.photos.length,1);assert.deepEqual(snapshot.bits[0].steps[0].photos,[photo]);
});
