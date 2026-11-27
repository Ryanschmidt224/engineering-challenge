export const SITE_BACKUP_PREFIX = "automatic-backups/site/";
export const SITE_BACKUP_INDEX = SITE_BACKUP_PREFIX + "index.json";
export const SITE_SNAPSHOT_PREFIX = SITE_BACKUP_PREFIX + "snapshots/";
export const SITE_BACKUP_KEEP = 7;
export const SITE_BACKUP_MAX_BYTES = 512 * 1024 * 1024;
export const SITE_BACKUP_PART_BYTES = 8 * 1024 * 1024;
const LEASE_MS = 20 * 60 * 1000;
const ID =
  /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z-[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/;
const iso = (x) =>
  typeof x === "string" &&
  Number.isFinite(Date.parse(x)) &&
  new Date(x).toISOString() === x;
export const snapshotKey = (id) => {
  if (!ID.test(id)) throw Error("Invalid whole-site backup ID.");
  return SITE_SNAPSHOT_PREFIX + id + ".bsbackup";
};
export function validSnapshotKey(key) {
  return (
    typeof key === "string" &&
    key.startsWith(SITE_SNAPSHOT_PREFIX) &&
    ID.test(key.slice(SITE_SNAPSHOT_PREFIX.length, -9)) &&
    key.endsWith(".bsbackup")
  );
}
export function backupError(code) {
  return Object.assign(Error(code), { code });
}
function validate(state) {
  if (
    state?.version !== 1 ||
    !Array.isArray(state.snapshots) ||
    state.snapshots.length > SITE_BACKUP_KEEP
  )
    throw Error("Invalid whole-site backup index.");
  const ids = new Set();
  for (const row of state.snapshots) {
    if (
      !ID.test(row.id) ||
      row.key !== snapshotKey(row.id) ||
      ids.has(row.id) ||
      !iso(row.createdAt) ||
      !Number.isSafeInteger(row.bytes) ||
      row.bytes < 1 ||
      row.bytes > SITE_BACKUP_MAX_BYTES ||
      !/^[a-f\d]{64}$/.test(row.digest) ||
      typeof row.etag !== "string" ||
      !row.etag
    )
      throw Error("Invalid whole-site backup snapshot.");
    ids.add(row.id);
  }
  const run = state.attempt;
  if (
    run !== null &&
    (!run ||
      !ID.test(run.id) ||
      !iso(run.scheduledFor) ||
      !iso(run.startedAt) ||
      !iso(run.expiresAt) ||
      !["running", "success", "failed"].includes(run.state) ||
      (run.state === "running"
        ? run.finishedAt !== null
        : !iso(run.finishedAt)))
  )
    throw Error("Invalid whole-site backup run.");
  if (
    state.pending !== null &&
    (!state.pending ||
      !validSnapshotKey(state.pending.key) ||
      typeof state.pending.uploadId !== "string" ||
      !state.pending.uploadId ||
      state.pending.uploadId.length > 1024)
  )
    throw Error("Invalid pending whole-site upload.");
  return state;
}
export async function loadSiteBackupState(bucket) {
  if (!bucket) throw backupError("STORAGE_UNAVAILABLE");
  const object = await bucket.get(SITE_BACKUP_INDEX);
  if (!object)
    return {
      state: { version: 1, snapshots: [], attempt: null, pending: null },
      etag: null,
    };
  if (object.size > 16000) throw Error("Whole-site backup index is too large.");
  return {
    state: validate(JSON.parse(await object.text())),
    etag: object.etag,
  };
}
async function change(bucket, edit) {
  for (let tries = 0; tries < 5; tries++) {
    const { state, etag } = await loadSiteBackupState(bucket),
      next = edit(state);
    if (!next) return null;
    validate(next);
    const result = await bucket.put(SITE_BACKUP_INDEX, JSON.stringify(next), {
      httpMetadata: { contentType: "application/json" },
      onlyIf: etag ? { etagMatches: etag } : { etagDoesNotMatch: "*" },
    });
    if (result !== null) return next;
  }
  throw backupError("INDEX_CONFLICT");
}
export async function beginSiteBackup(bucket, scheduledFor, date) {
  const run = {
    id:
      scheduledFor.toISOString().slice(0, 19).replaceAll(":", "-") +
      "Z-" +
      crypto.randomUUID(),
    scheduledFor: scheduledFor.toISOString(),
    startedAt: date.toISOString(),
    expiresAt: new Date(+date + LEASE_MS).toISOString(),
    finishedAt: null,
    state: "running",
    error: null,
  };
  const state = await change(bucket, (previous) => {
    if (
      previous.attempt &&
      (previous.attempt.scheduledFor >= run.scheduledFor ||
        (previous.attempt.state === "running" &&
          Date.parse(previous.attempt.expiresAt) > +date))
    )
      return null;
    return { ...previous, attempt: run };
  });
  return state ? run : null;
}
function own(state, run, date) {
  if (
    state.attempt?.id !== run.id ||
    state.attempt.state !== "running" ||
    Date.parse(state.attempt.expiresAt) <= +date
  )
    throw backupError("LEASE_LOST");
}
export async function siteBackupLease(bucket, run, date) {
  const { state } = await loadSiteBackupState(bucket);
  own(state, run, date);
  return state;
}
export async function changeSiteBackup(bucket, run, date, edit) {
  return change(bucket, (state) => {
    own(state, run, date);
    return edit(state);
  });
}
export function siteBackupSummary(state, date = new Date()) {
  const run = state.attempt,
    latest = state.snapshots[0] || null;
  let health = run?.state === "success" ? "ok" : run?.state || "never";
  if (run?.state === "running" && +date >= Date.parse(run.expiresAt))
    health = "interrupted";
  if (
    health === "ok" &&
    +date - Date.parse(run.finishedAt) > 36 * 60 * 60 * 1000
  )
    health = "stale";
  return {
    health,
    lastAttempt: run && {
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      state: run.state,
      error: run.error,
    },
    lastSuccess: latest && { createdAt: latest.createdAt, bytes: latest.bytes },
    snapshots: state.snapshots.map(({ id, createdAt, bytes }) => ({
      id,
      createdAt,
      bytes,
    })),
    retention: SITE_BACKUP_KEEP,
    maxArchiveBytes: SITE_BACKUP_MAX_BYTES,
    storage: "same-r2-bucket",
    observedAt: date.toISOString(),
  };
}
