import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../worker.js";
import { BACKUP_STATUS_KEY, runScheduledProjectBackups, readAutomaticBackupStatus, handleAutomaticBackupStatus } from "../functions/api/automatic-backup-status.js";
import { ENGINE_BACKUP_PREFIX } from "../functions/api/project-auto-backups.js";
import { fixture } from "./helpers/project-workspace.mjs";
import { TestD1 } from "./helpers/d1.mjs";
import { TestR2 } from "./helpers/r2.mjs";
import { provisionTestAccount } from "./helpers/accounts.mjs";
const at = day => new Date(`2026-11-${day}T09:17:00.000Z`);
const clock = day => () => at(day);
const archives = env => [...env.PHOTOS.objects.keys()].filter(key => key.startsWith(ENGINE_BACKUP_PREFIX));

test("scheduled Worker records durable success, skips duplicate events, and checks unchanged copies", async t => {
  const f = await fixture(); t.after(() => f.db.close());
  const tasks = [];
  await worker.scheduled({ scheduledTime: at(26).getTime() }, f.env, { waitUntil: p => tasks.push(p) });
  await Promise.all(tasks);
  let status = await readAutomaticBackupStatus(f.env, at(26));
  assert.equal(status.health, "ok"); assert.equal(status.lastAttempt.counts.saved, 1);
  assert.equal(status.lastSuccess.id, status.lastAttempt.id); assert.equal(archives(f.env).length, 1);
  const originalId = status.lastAttempt.id;
  assert.equal((await runScheduledProjectBackups(f.env, at(26), clock(26))).state, "ignored");
  assert.equal((await readAutomaticBackupStatus(f.env)).lastAttempt.id, originalId);
  await runScheduledProjectBackups(f.env, at(27), clock(27));
  status = await readAutomaticBackupStatus(f.env, at(27));
  assert.deepEqual(status.lastAttempt.counts, { saved: 0, unchanged: 1, failed: 0, deleted: 0 });
  assert.equal(status.lastSuccess.scheduledFor, at(27).toISOString());
  assert.equal(archives(f.env).length, 1);
  assert.equal((await readAutomaticBackupStatus(f.env, new Date("2026-11-29T00:00:00Z"))).health, "stale");
  // A delayed event still protects current data when it actually completes.
  await runScheduledProjectBackups(f.env, at(28), clock(30));
  assert.equal((await readAutomaticBackupStatus(f.env, at(30))).health, "ok");
});

test("a damaged unchanged archive cannot turn a failed nightly job green", async t => {
  const f = await fixture(); t.after(() => f.db.close());
  await runScheduledProjectBackups(f.env, at(26), clock(26));
  const object = f.env.PHOTOS.objects.get(archives(f.env)[0]);
  const text = new TextDecoder().decode(object.bytes).replace('{"type":"complete"}', '{"type":"incomplete"}');
  object.bytes = new TextEncoder().encode(text);
  await assert.rejects(runScheduledProjectBackups(f.env, at(27), clock(27)), /Nightly project backups failed/);
  const status = await readAutomaticBackupStatus(f.env, at(27));
  assert.equal(status.health, "failed"); assert.equal(status.lastAttempt.counts.failed, 1);
  assert.equal(status.lastSuccess.scheduledFor, at(26).toISOString());
});

test("database failure preserves the earlier success and does not expose internal error text", async t => {
  const f = await fixture(); t.after(() => f.db.close());
  await runScheduledProjectBackups(f.env, at(26), clock(26));
  await assert.rejects(runScheduledProjectBackups({ ...f.env, WORKSHOP_DB: { prepare() { throw Error("private SQL diagnostic"); } } }, at(27), clock(27)), /Nightly project backups failed/);
  const status = await readAutomaticBackupStatus(f.env, at(27));
  assert.equal(status.health, "failed"); assert.equal(status.lastSuccess.scheduledFor, at(26).toISOString());
  assert.doesNotMatch(JSON.stringify(status), /private SQL diagnostic/);
});

test("an older slow invocation cannot replace a newer attempt or successful result", async t => {
  const f = await fixture(); t.after(() => f.db.close());
  const list = f.env.PHOTOS.list.bind(f.env.PHOTOS);
  let signal, resume, held = false;
  const paused = new Promise(resolve => signal = resolve), gate = new Promise(resolve => resume = resolve);
  f.env.PHOTOS.list = async options => {
    if (!held && options.prefix?.startsWith(ENGINE_BACKUP_PREFIX)) { held = true; signal(); await gate; }
    return list(options);
  };
  const old = runScheduledProjectBackups(f.env, at(26), clock(26));
  await paused;
  try { await runScheduledProjectBackups(f.env, at(27), clock(27)); } finally { resume(); }
  await old;
  const status = await readAutomaticBackupStatus(f.env, at(27));
  assert.equal(status.lastAttempt.scheduledFor, at(27).toISOString());
  assert.equal(status.lastSuccess.scheduledFor, at(27).toISOString());
  assert.equal(status.health, "ok");
});

test("newer status wins an R2 compare-and-swap race; persistent conflicts fail closed", async t => {
  const f = await fixture(); t.after(() => f.db.close());
  const put = f.env.PHOTOS.put.bind(f.env.PHOTOS); let conflicts = 0;
  f.env.PHOTOS.put = async (key, value, options) => {
    if (key === BACKUP_STATUS_KEY && !conflicts++) return null;
    return put(key, value, options);
  };
  await runScheduledProjectBackups(f.env, at(26), clock(26));
  assert.equal((await readAutomaticBackupStatus(f.env, at(26))).health, "ok");
  f.env.PHOTOS.put = async key => { assert.equal(key, BACKUP_STATUS_KEY); return null; };
  await assert.rejects(runScheduledProjectBackups(f.env, at(27), clock(27)), /could not be recorded/);
  assert.equal((await readAutomaticBackupStatus(f.env, at(27))).lastAttempt.scheduledFor, at(26).toISOString());
});

test("an interrupted run becomes unconfirmed, and uninitialized databases are never migrated or shown green", async t => {
  const env = { PHOTOS: new TestR2(), WORKSHOP_DB: new TestD1() }; t.after(() => env.WORKSHOP_DB.close());
  assert.equal((await readAutomaticBackupStatus(env, at(26))).health, "never");
  await runScheduledProjectBackups(env, at(26), clock(26));
  let status = await readAutomaticBackupStatus(env, at(26));
  assert.equal(status.health, "skipped"); assert.equal(status.lastSuccess, null);
  assert.equal((await env.WORKSHOP_DB.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table'").first()).n, 0);
  status.lastAttempt.state = "running"; status.lastAttempt.finishedAt = null;
  await env.PHOTOS.put(BACKUP_STATUS_KEY, JSON.stringify({ version: 1, lastAttempt: status.lastAttempt, lastSuccess: null }));
  assert.equal((await readAutomaticBackupStatus(env, new Date("2026-11-26T10:17:00Z"))).health, "running");
  assert.equal((await readAutomaticBackupStatus(env, new Date("2026-11-26T12:17:00Z"))).health, "interrupted");
});

test("backup status is owner-only and read-only, with storage faults reported as unavailable", async () => {
  const origin = "https://backup-status.example.test", env = { PHOTOS: new TestR2(), admin_password: "synthetic-status-secret" };
  const request = (method = "GET", cookie) => new Request(origin + "/api/backup-status", { method, headers: { origin, ...(cookie ? { cookie } : {}) } });
  assert.equal((await handleAutomaticBackupStatus(request(), env)).status, 401);
  const account = await provisionTestAccount(new Request(origin + "/api/accounts", { method: "POST", headers: { origin }, body: JSON.stringify({ action: "register", email: "owner@status.test", password: "synthetic-status-password" }) }), env, { role: "admin" });
  const cookie = account.headers.get("set-cookie").split(";")[0];
  let response = await handleAutomaticBackupStatus(request("GET", cookie), env);
  assert.equal(response.status, 200); assert.match(response.headers.get("cache-control"), /private, no-store/);
  assert.equal((await response.json()).health, "never");
  assert.equal((await handleAutomaticBackupStatus(request("POST", cookie), env)).status, 405);
  await env.PHOTOS.put(BACKUP_STATUS_KEY, "{bad status data");
  response = await handleAutomaticBackupStatus(request("GET", cookie), env);
  assert.equal(response.status, 503); assert.equal((await response.json()).code, "BACKUP_STATUS_UNAVAILABLE");
});


test("losing the completion-status write leaves an unconfirmed run rather than a false success", async t => {
  const f = await fixture(); t.after(() => f.db.close());
  await runScheduledProjectBackups(f.env, at(26), clock(26));
  const put = f.env.PHOTOS.put.bind(f.env.PHOTOS);
  f.env.PHOTOS.put = async (key, value, options) => {
    if (key === BACKUP_STATUS_KEY && JSON.parse(value).lastAttempt.state !== "running") throw Error("Status commit unavailable");
    return put(key, value, options);
  };
  await assert.rejects(runScheduledProjectBackups(f.env, at(27), clock(27)), /Status commit unavailable/);
  const status = await readAutomaticBackupStatus(f.env, new Date("2026-11-27T12:17:00Z"));
  assert.equal(status.health, "interrupted");
  assert.equal(status.lastSuccess.scheduledFor, at(26).toISOString());
  assert.equal(archives(f.env).length, 1);
});


test("broken monitoring storage never prevents an otherwise valid project backup", async t => {
  const f = await fixture(); t.after(() => f.db.close());
  const put = f.env.PHOTOS.put.bind(f.env.PHOTOS);
  f.env.PHOTOS.put = async (key, value, options) => {
    if (key === BACKUP_STATUS_KEY) throw Error("Monitoring write unavailable");
    return put(key, value, options);
  };
  await assert.rejects(runScheduledProjectBackups(f.env, at(27), clock(27)), /Monitoring write unavailable/);
  assert.equal(archives(f.env).length, 1);
  assert.equal((await readAutomaticBackupStatus(f.env, at(27))).health, "never");
});
