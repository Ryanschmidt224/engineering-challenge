import { test } from "node:test";
import assert from "node:assert/strict";
import { TestD1 } from "./helpers/d1.mjs";
import { TestR2 } from "./helpers/r2.mjs";
import { automaticSiteBackup } from "../functions/api/site-auto-backups.js";
import {
  loadSiteBackupState,
  siteBackupSummary,
  SITE_BACKUP_INDEX,
  SITE_BACKUP_PREFIX,
  SITE_BACKUP_PART_BYTES,
  snapshotKey,
} from "../functions/api/site-backup-state.js";
import {
  siteBackupLines,
  backupPart,
} from "../functions/api/site-data-backup.js";
import { storeSiteBackup } from "../functions/api/site-backup-storage.js";
import { handleAutomaticSiteBackups } from "../functions/api/automatic-site-backups.js";
import { provisionTestAccount } from "./helpers/accounts.mjs";
const day = (n) => new Date(Date.UTC(2026, 10, n, 9, 17));
async function fixture(t) {
  const env = { PHOTOS: new TestR2(), WORKSHOP_DB: new TestD1() };
  t.after(() => env.WORKSHOP_DB.close());
  await env.WORKSHOP_DB.prepare(
    "CREATE TABLE entries(id TEXT PRIMARY KEY,value TEXT)",
  ).run();
  for (const id of ["workshop", "lesson"])
    await env.WORKSHOP_DB.prepare("INSERT INTO entries VALUES(?,?)")
      .bind(id, "original " + id)
      .run();
  await env.PHOTOS.put("legacy/keep.txt", "legacy bytes");
  await env.PHOTOS.put("workshop-v2/files/document", "original document");
  await env.PHOTOS.put(
    "automatic-backups/engine/old/copy",
    "existing project backup",
  );
  return env;
}
const run = (env, n) => automaticSiteBackup(env, day(n), () => day(n));
const state = async (env) => (await loadSiteBackupState(env.PHOTOS)).state;
const snapshots = (env) =>
  [...env.PHOTOS.objects.keys()].filter((k) =>
    k.startsWith(SITE_BACKUP_PREFIX + "snapshots/"),
  );
async function entries(env, index = 0) {
  const s = (await state(env)).snapshots[index],
    text = await (await env.PHOTOS.get(s.key)).text();
  return text
    .trimEnd()
    .split("\n")
    .map((line) => JSON.parse(line));
}

test("whole-site snapshots advance on Workshop-only and lesson-only edits without Projects tables", async (t) => {
  const env = await fixture(t);
  await run(env, 1);
  await env.WORKSHOP_DB.prepare("UPDATE entries SET value=? WHERE id=?")
    .bind("changed Workshop", "workshop")
    .run();
  await run(env, 2);
  assert.ok(
    (await entries(env)).some(
      (e) =>
        e.type === "row" &&
        e.value.id === "workshop" &&
        e.value.value === "changed Workshop",
    ),
  );
  await env.WORKSHOP_DB.prepare("UPDATE entries SET value=? WHERE id=?")
    .bind("changed lesson", "lesson")
    .run();
  await env.PHOTOS.put("lesson-photos/new", "lesson image");
  await run(env, 3);
  const saved = await entries(env);
  assert.ok(
    saved.some(
      (e) =>
        e.type === "row" &&
        e.value.id === "lesson" &&
        e.value.value === "changed lesson",
    ),
  );
  assert.ok(
    saved.some((e) => e.type === "object" && e.key === "lesson-photos/new"),
  );
  assert.ok(
    !saved.some(
      (e) => e.type === "object" && e.key.startsWith("automatic-backups/"),
    ),
  );
  assert.deepEqual(saved[0].excludedPrefixes, ["automatic-backups/"]);
  assert.equal(saved.at(-1).type, "complete");
  assert.equal(
    (
      await env.WORKSHOP_DB.prepare(
        "SELECT COUNT(*) AS n FROM sqlite_master WHERE name LIKE 'engine_%'",
      ).first()
    ).n,
    0,
  );
  const manual = [];
  for await (const bytes of siteBackupLines(env))
    manual.push(new TextDecoder().decode(bytes));
  const text = manual.join("");
  assert.ok(text.includes("existing project backup") === false);
  const objects = text
    .split("\n")
    .filter(Boolean)
    .map((x) => JSON.parse(x))
    .filter((e) => e.type === "object");
  assert.ok(objects.some((e) => e.key === "automatic-backups/engine/old/copy"));
  assert.ok(!objects.some((e) => e.key.startsWith(SITE_BACKUP_PREFIX)));
  const response = await backupPart(
    new Request("https://backup.test/api/site-data-backup?part=objects", {
      method: "POST",
      headers: { origin: "https://backup.test" },
      body: "{}",
    }),
    env,
    "objects",
  );
  assert.ok(
    !(await response.json()).objects.some((o) =>
      o.key.startsWith(SITE_BACKUP_PREFIX),
    ),
  );
});

test("ten nightly runs retain only seven complete copies, never touching source or project backups", async (t) => {
  const env = await fixture(t);
  for (let n = 1; n <= 10; n++) await run(env, n);
  const s = await state(env);
  assert.equal(s.snapshots.length, 7);
  assert.equal(snapshots(env).length, 7);
  assert.equal(env.PHOTOS.uploads.size, 0);
  assert.equal(
    await (await env.PHOTOS.get("legacy/keep.txt")).text(),
    "legacy bytes",
  );
  assert.equal(
    await (await env.PHOTOS.get("automatic-backups/engine/old/copy")).text(),
    "existing project backup",
  );
  const before = JSON.stringify(s);
  assert.equal((await run(env, 10)).state, "ignored");
  assert.equal((await run(env, 9)).state, "ignored");
  assert.equal(JSON.stringify(await state(env)), before);
  assert.equal(siteBackupSummary(s, day(12)).health, "stale");
});

test("a corrupt stored byte stream is never published, and the next run cleans the candidate", async (t) => {
  const env = await fixture(t);
  await run(env, 1);
  const first = (await state(env)).snapshots[0].id;
  const put = env.PHOTOS.put.bind(env.PHOTOS);
  let damage = true;
  env.PHOTOS.put = async (key, value, options) => {
    const r = await put(key, value, options);
    if (damage && key.startsWith(SITE_BACKUP_PREFIX + "snapshots/")) {
      damage = false;
      env.PHOTOS.objects.get(key).bytes[20] ^= 1;
    }
    return r;
  };
  await assert.rejects(run(env, 2), { code: "VERIFY_FAILED" });
  let s = await state(env);
  assert.equal(s.attempt.state, "failed");
  assert.equal(s.snapshots[0].id, first);
  await run(env, 3);
  s = await state(env);
  assert.equal(s.attempt.state, "success");
  assert.equal(s.snapshots.length, 2);
  assert.equal(snapshots(env).length, 2);
  assert.equal(env.PHOTOS.uploads.size, 0);
});

test("source changes abort incomplete uploads and preserve previous verified copies", async (t) => {
  const env = await fixture(t);
  await run(env, 1);
  await env.PHOTOS.put("big.bin", new Uint8Array(9 * 1024 * 1024).fill(43));
  const get = env.PHOTOS.get.bind(env.PHOTOS);
  let changed = false;
  env.PHOTOS.get = async (key, options) => {
    const object = await get(key, options);
    if (key === "big.bin" && !changed) {
      changed = true;
      await env.WORKSHOP_DB.prepare(
        "UPDATE entries SET value='edited while saving' WHERE id='lesson'",
      ).run();
    }
    return object;
  };
  await assert.rejects(run(env, 2), /Database changed/);
  assert.equal((await state(env)).snapshots.length, 1);
  assert.equal(env.PHOTOS.uploads.size, 0);
  await run(env, 3);
  assert.equal((await state(env)).snapshots.length, 2);
  assert.equal((await state(env)).pending, null);
});

test("expired writers cannot publish over a newer run, and active duplicates do not start", async (t) => {
  const env = await fixture(t);
  let signal,
    resume,
    held = false;
  const paused = new Promise((r) => (signal = r)),
    gate = new Promise((r) => (resume = r)),
    get = env.PHOTOS.get.bind(env.PHOTOS);
  env.PHOTOS.get = async (key, options) => {
    if (key === "legacy/keep.txt" && !held) {
      held = true;
      signal();
      await gate;
    }
    return get(key, options);
  };
  const old = run(env, 1);
  await paused;
  assert.equal(
    (
      await automaticSiteBackup(
        env,
        new Date(+day(1) + 1),
        () => new Date(+day(1) + 1),
      )
    ).state,
    "ignored",
  );
  assert.equal((await run(env, 2)).state, "saved");
  resume();
  await assert.rejects(old, { code: "LEASE_LOST" });
  const s = await state(env);
  assert.equal(s.attempt.scheduledFor, day(2).toISOString());
  assert.equal(s.snapshots.length, 1);
});

test("a tracked interrupted multipart upload is aborted after restart before another snapshot is made", async (t) => {
  const env = await fixture(t);
  await run(env, 1);
  let s = await state(env);
  const staleId =
      day(2).toISOString().slice(0, 19).replaceAll(":", "-") +
      "Z-" +
      crypto.randomUUID(),
    key = snapshotKey(staleId),
    upload = await env.PHOTOS.createMultipartUpload(key);
  await upload.uploadPart(1, new Uint8Array(SITE_BACKUP_PART_BYTES));
  s.attempt = {
    id: staleId,
    scheduledFor: day(2).toISOString(),
    startedAt: day(2).toISOString(),
    expiresAt: new Date(+day(2) + 20 * 60000).toISOString(),
    finishedAt: null,
    state: "running",
    error: null,
  };
  s.pending = { key, uploadId: upload.uploadId };
  await env.PHOTOS.put(SITE_BACKUP_INDEX, JSON.stringify(s));
  assert.equal(
    siteBackupSummary(s, new Date(+day(2) + 21 * 60000)).health,
    "interrupted",
  );
  await run(env, 3);
  assert.equal(env.PHOTOS.uploads.size, 0);
  assert.equal((await state(env)).pending, null);
  assert.equal(snapshots(env).length, 2);
});

test("an uncertain publication reply never causes the verified copy to be deleted", async (t) => {
  const env = await fixture(t),
    put = env.PHOTOS.put.bind(env.PHOTOS);
  let lost = false;
  env.PHOTOS.put = async (key, value, options) => {
    const r = await put(key, value, options);
    if (
      key === SITE_BACKUP_INDEX &&
      !lost &&
      JSON.parse(value).snapshots.length
    ) {
      lost = true;
      throw Error("Lost publication reply");
    }
    return r;
  };
  await assert.rejects(run(env, 1), /Lost publication reply/);
  const s = await state(env);
  assert.equal(s.snapshots.length, 1);
  assert.ok(await env.PHOTOS.head(s.snapshots[0].key));
  await run(env, 2);
  assert.equal((await state(env)).snapshots.length, 2);
});

test("the byte limit aborts multipart storage without ever completing an oversized object", async () => {
  let completed = false,
    aborted = false,
    parts = 0;
  const bucket = {
    async createMultipartUpload() {
      return {
        uploadId: "fixture",
        async uploadPart(number) {
          parts++;
          return { partNumber: number, etag: "part" };
        },
        async complete() {
          completed = true;
        },
        async abort() {
          aborted = true;
        },
      };
    },
  };
  async function* source() {
    const block = new Uint8Array(SITE_BACKUP_PART_BYTES);
    for (let i = 0; i < 65; i++) yield block;
  }
  await assert.rejects(
    storeSiteBackup(bucket, "candidate", source(), {
      guard: async () => {},
      remember: async () => {},
    }),
    { code: "SIZE_LIMIT" },
  );
  assert.equal(parts, 64);
  assert.equal(completed, false);
  assert.equal(aborted, true);
});

test("catalogue and downloads require the owner, reject arbitrary keys, and confirm stored metadata", async (t) => {
  const env = await fixture(t);
  env.admin_password = "synthetic-site-backup-secret";
  const origin = "https://site-backup.example.test";
  const account = await provisionTestAccount(
      new Request(origin + "/api/accounts", {
        method: "POST",
        headers: { origin },
        body: JSON.stringify({
          action: "register",
          email: "owner@site-backup.test",
          password: "synthetic-site-backup-password",
        }),
      }),
      env,
      { role: "admin" },
    ),
    cookie = account.headers.get("set-cookie").split(";")[0];
  await run(env, 1);
  const id = (await state(env)).snapshots[0].id;
  const request = (path = "", method = "GET", owner = true) =>
    new Request(origin + "/api/automatic-site-backups" + path, {
      method,
      headers: { origin, ...(owner ? { cookie } : {}) },
    });
  assert.equal(
    (await handleAutomaticSiteBackups(request("", "GET", false), env)).status,
    401,
  );
  assert.equal(
    (await handleAutomaticSiteBackups(request("", "POST"), env)).status,
    405,
  );
  assert.equal(
    (await handleAutomaticSiteBackups(request("?id=../../users"), env)).status,
    400,
  );
  let response = await handleAutomaticSiteBackups(request("?id=" + id), env);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /private, no-store/);
  assert.equal(
    JSON.parse((await response.text()).split("\n")[0]).format,
    "building-schmidt-site-data",
  );
  await env.PHOTOS.put((await state(env)).snapshots[0].key, "changed backup");
  response = await handleAutomaticSiteBackups(request("?id=" + id), env);
  assert.equal(response.status, 409);
});

test("whole-site storage failure still allows the existing per-project backup job", async (t) => {
  const { fixture: projectFixture } = await import(
      "./helpers/project-workspace.mjs"
    ),
    { runNightlyBackups } = await import(
      "../functions/api/scheduled-backups.js"
    );
  const f = await projectFixture();
  t.after(() => f.db.close());
  const put = f.env.PHOTOS.put.bind(f.env.PHOTOS);
  f.env.PHOTOS.put = async (key, value, options) => {
    if (key === SITE_BACKUP_INDEX) throw Error("Whole-site index unavailable");
    return put(key, value, options);
  };
  await assert.rejects(runNightlyBackups(f.env, day(1)), AggregateError);
  assert.equal(
    [...f.env.PHOTOS.objects.keys()].filter((k) =>
      k.startsWith("automatic-backups/engine/"),
    ).length,
    1,
  );
});

test("retention cleanup handles short inventory pages without skipping protected or orphaned objects", async (t) => {
  const env = await fixture(t);
  await run(env, 1);
  await run(env, 2);
  const orphan = snapshotKey(
    day(3).toISOString().slice(0, 19).replaceAll(":", "-") +
      "Z-" +
      crypto.randomUUID(),
  );
  await env.PHOTOS.put(orphan, "unpublished candidate");
  const list = env.PHOTOS.list.bind(env.PHOTOS);
  env.PHOTOS.list = (options) =>
    list({
      ...options,
      ...(options.prefix?.startsWith(SITE_BACKUP_PREFIX) ? { limit: 1 } : {}),
    });
  await run(env, 4);
  assert.equal((await state(env)).snapshots.length, 3);
  assert.equal(snapshots(env).length, 3);
  assert.equal(await env.PHOTOS.head(orphan), null);
});
