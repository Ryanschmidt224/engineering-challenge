import { isAdmin } from "./auth.js";
import { backupEngineProjects } from "./project-auto-backups.js";
import { projectEngineSchemaReady } from "./project-engine-migrations.js";

// One bounded status object, separate from append-only project archives.
// Conditional writes keep overlapping cron invocations from losing newer results.
export const BACKUP_STATUS_KEY = "automatic-backups/status/projects.json";
const MAX_STATUS_BYTES = 8192;
const HOUR = 60 * 60 * 1000;
const states = new Set(["running", "success", "failed", "skipped"]);
const iso = (value) =>
  typeof value === "string" &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value;
function validRun(run) {
  return (
    run &&
    typeof run.id === "string" &&
    /^[a-f\d-]{36}$/.test(run.id) &&
    states.has(run.state) &&
    iso(run.scheduledFor) &&
    iso(run.startedAt) &&
    (run.state === "running" ? run.finishedAt === null : iso(run.finishedAt)) &&
    ["saved", "unchanged", "failed", "deleted"].every(
      (key) => Number.isSafeInteger(run.counts?.[key]) && run.counts[key] >= 0,
    )
  );
}
async function load(bucket) {
  if (!bucket) throw Error("Backup status storage is unavailable.");
  const object = await bucket.get(BACKUP_STATUS_KEY);
  if (!object)
    return {
      record: { version: 1, lastAttempt: null, lastSuccess: null },
      etag: null,
    };
  if (object.size > MAX_STATUS_BYTES)
    throw Error("Invalid backup status size.");
  const record = JSON.parse(await object.text());
  if (
    record.version !== 1 ||
    !validRun(record.lastAttempt) ||
    (record.lastSuccess !== null &&
      (!validRun(record.lastSuccess) || record.lastSuccess.state !== "success"))
  )
    throw Error("Invalid backup status record.");
  if (
    (record.lastAttempt.state === "success" &&
      record.lastSuccess?.id !== record.lastAttempt.id) ||
    (record.lastSuccess &&
      record.lastSuccess.scheduledFor > record.lastAttempt.scheduledFor)
  )
    throw Error("Inconsistent backup success record.");
  return { record, etag: object.etag };
}
async function update(bucket, change) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { record, etag } = await load(bucket),
      next = change(record);
    if (!next) return false;
    const written = await bucket.put(BACKUP_STATUS_KEY, JSON.stringify(next), {
      httpMetadata: { contentType: "application/json" },
      onlyIf: etag ? { etagMatches: etag } : { etagDoesNotMatch: "*" },
    });
    if (written !== null) return true;
  }
  throw Error(
    "Backup status changed repeatedly; the result could not be recorded.",
  );
}
export async function readAutomaticBackupStatus(env, date = new Date()) {
  const { record } = await load(env.PHOTOS),
    run = record.lastAttempt;
  let health = "never";
  if (run) {
    health = run.state === "success" ? "ok" : run.state;
    if (run.state === "running" && date - new Date(run.startedAt) > 2 * HOUR)
      health = "interrupted";
    if (
      run.state === "success" &&
      date - new Date(run.scheduledFor) > 36 * HOUR
    )
      health = "stale";
  }
  return {
    ...record,
    health,
    observedAt: date.toISOString(),
    coverage: "projects",
    schedule: "17 9 * * *",
    storage: "same-r2-bucket",
  };
}
export async function handleAutomaticBackupStatus(request, env) {
  const headers = {
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff",
  };
  if (!(await isAdmin(request, env)))
    return Response.json(
      { error: "Owner sign-in required" },
      { status: 401, headers },
    );
  if (request.method !== "GET")
    return Response.json(
      { error: "Use a GET request." },
      { status: 405, headers: { ...headers, allow: "GET" } },
    );
  try {
    return Response.json(await readAutomaticBackupStatus(env), { headers });
  } catch (error) {
    console.error("Automatic backup status unavailable", error);
    return Response.json(
      {
        error: "Backup status could not be read. Protection is unconfirmed.",
        code: "BACKUP_STATUS_UNAVAILABLE",
      },
      { status: 503, headers },
    );
  }
}
export async function runScheduledProjectBackups(
  env,
  scheduledFor,
  clock = () => new Date(),
) {
  const run = {
    id: crypto.randomUUID(),
    scheduledFor: scheduledFor.toISOString(),
    startedAt: clock().toISOString(),
    finishedAt: null,
    state: "running",
    counts: { saved: 0, unchanged: 0, failed: 0, deleted: 0 },
  };
  let admitted = true;
  try {
    admitted = await update(env.PHOTOS, (record) => {
      if (
        record.lastAttempt &&
        record.lastAttempt.scheduledFor >= run.scheduledFor
      )
        return null;
      return { ...record, lastAttempt: run };
    });
  } catch (error) {
    // Monitoring must not prevent the original backup job from protecting data.
    // The final conditional write retries recording the outcome; if it also
    // fails, the cron fails and the UI keeps an unconfirmed/overdue result.
    console.error("Nightly backup start status could not be recorded", error);
  }
  if (!admitted)
    return {
      state: "ignored",
      reason: "A matching or newer run is already recorded.",
    };
  let failure = null;
  try {
    if (!env.WORKSHOP_DB)
      throw Error("Project database binding is unavailable.");
    if (!(await projectEngineSchemaReady(env.WORKSHOP_DB)))
      run.state = "skipped";
    else {
      const projects = await backupEngineProjects(env, scheduledFor);
      for (const result of projects) run.counts[result.status]++;
      run.state = run.counts.failed ? "failed" : "success";
      if (!(await projectEngineSchemaReady(env.WORKSHOP_DB)))
        run.state = "skipped";
    }
  } catch (error) {
    failure = error;
    run.state = "failed";
  }
  run.finishedAt = clock().toISOString();
  await update(env.PHOTOS, (record) => {
    const next = { ...record };
    if (
      !record.lastAttempt ||
      record.lastAttempt.id === run.id ||
      record.lastAttempt.scheduledFor < run.scheduledFor
    )
      next.lastAttempt = run;
    if (
      run.state === "success" &&
      (!record.lastSuccess ||
        record.lastSuccess.scheduledFor < run.scheduledFor)
    )
      next.lastSuccess = run;
    if (
      next.lastAttempt === record.lastAttempt &&
      next.lastSuccess === record.lastSuccess
    )
      return null;
    return next;
  });
  if (run.state === "failed")
    throw Error("Nightly project backups failed.", { cause: failure });
  return { state: run.state, counts: run.counts };
}
