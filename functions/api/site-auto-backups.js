import { siteBackupLines } from "./site-data-backup.js";
import {
  SITE_SNAPSHOT_PREFIX,
  SITE_BACKUP_KEEP,
  backupError,
  beginSiteBackup,
  changeSiteBackup,
  siteBackupLease,
  snapshotKey,
  validSnapshotKey,
} from "./site-backup-state.js";
import {
  storeSiteBackup,
  verifySiteBackup,
  abortPendingSiteUpload,
} from "./site-backup-storage.js";

// Only objects created in this new, dedicated namespace are rotated. Live files,
// downloaded copies and the existing per-project backups are never deleted here.
async function prune(bucket, run, clock) {
  let cursor;
  const seen = new Set();
  for (let pages = 0; ; pages++) {
    if (pages >= 200) throw backupError("SOURCE_LIMIT");
    const state = await siteBackupLease(bucket, run, clock());
    const protectedKeys = new Set(state.snapshots.map((s) => s.key));
    if (state.pending) protectedKeys.add(state.pending.key);
    let deleted = false;
    const page = await bucket.list({
      prefix: SITE_SNAPSHOT_PREFIX,
      limit: 100,
      ...(cursor ? { cursor } : {}),
    });
    for (const object of page.objects) {
      if (!validSnapshotKey(object.key))
        throw backupError("UNKNOWN_BACKUP_OBJECT");
      if (!protectedKeys.has(object.key)) {
        // Recheck the lease and catalogue immediately before a destructive action.
        const latest = await siteBackupLease(bucket, run, clock());
        if (
          !latest.snapshots.some((s) => s.key === object.key) &&
          latest.pending?.key !== object.key
        ) {
          await bucket.delete(object.key);
          deleted = true;
        }
      }
    }
    if (deleted) {
      cursor = undefined;
      seen.clear();
      continue;
    }
    if (!page.truncated) return;
    if (!page.cursor || seen.has(page.cursor))
      throw backupError("INCOMPLETE_INVENTORY");
    seen.add(page.cursor);
    cursor = page.cursor;
  }
}
export async function automaticSiteBackup(
  env,
  scheduledFor = new Date(),
  clock = () => new Date(),
) {
  if (!env.PHOTOS || !env.WORKSHOP_DB) throw backupError("STORAGE_UNAVAILABLE");
  const bucket = env.PHOTOS,
    run = await beginSiteBackup(bucket, scheduledFor, clock());
  if (!run) return { state: "ignored" };
  const guard = async () => {
    if (+clock() - Date.parse(run.startedAt) > 12 * 60 * 1000)
      throw backupError("TIME_LIMIT");
    return siteBackupLease(bucket, run, clock());
  };
  const key = snapshotKey(run.id);
  try {
    const before = await guard();
    if (before.pending) {
      await abortPendingSiteUpload(bucket, before.pending);
      await changeSiteBackup(bucket, run, clock(), (state) => ({
        ...state,
        pending: null,
      }));
    }
    await prune(bucket, run, clock);
    const proof = await storeSiteBackup(
      bucket,
      key,
      siteBackupLines(env, clock(), { automatic: true }),
      {
        guard,
        remember: (pending) =>
          changeSiteBackup(bucket, run, clock(), (state) => ({
            ...state,
            pending,
          })),
      },
    );
    const etag = await verifySiteBackup(bucket, key, proof, guard);
    const snapshot = {
      id: run.id,
      key,
      createdAt: clock().toISOString(),
      ...proof,
      etag,
    };
    // Publication is atomic only after the full stored byte stream matches the
    // generated, consistency-checked .bsbackup. A lost reply never unpublishes it.
    await changeSiteBackup(bucket, run, clock(), (state) => ({
      ...state,
      snapshots: [snapshot, ...state.snapshots].slice(0, SITE_BACKUP_KEEP),
      pending: null,
    }));
    await prune(bucket, run, clock);
    await changeSiteBackup(bucket, run, clock(), (state) => ({
      ...state,
      attempt: {
        ...state.attempt,
        state: "success",
        finishedAt: clock().toISOString(),
      },
    }));
    return { state: "saved", bytes: proof.bytes, id: run.id };
  } catch (error) {
    console.error("Automatic whole-site backup failed", run.id, error);
    try {
      await changeSiteBackup(bucket, run, clock(), (state) => ({
        ...state,
        attempt: {
          ...state.attempt,
          state: "failed",
          finishedAt: clock().toISOString(),
          error: [
            "SIZE_LIMIT",
            "SOURCE_LIMIT",
            "TIME_LIMIT",
            "VERIFY_FAILED",
            "UNKNOWN_BACKUP_OBJECT",
          ].includes(error.code)
            ? error.code
            : /changed during backup|truncated during backup/.test(
                  error.message,
                )
              ? "SOURCE_CHANGED"
              : "STORAGE_ERROR",
        },
      }));
    } catch (recordError) {
      console.error("Whole-site result unconfirmed", run.id, recordError);
    }
    throw error;
  }
}
