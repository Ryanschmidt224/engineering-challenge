import {
  normalizeBackupReminder,
  backupReminderSummary,
  DAY_MS,
} from "../../assets/backup-reminder-model.js";
import { readWebsiteSettings } from "./website-settings.js";

// This is an owner-only subroute of project-engine, sharing its origin guard.
// Mutate only reminder fields, with CAS against the same settings revision so
// another device's snooze or a normal settings save cannot be overwritten.
export async function backupReminderResponse(db, request, now = new Date()) {
  const method = request.method;
  if (method === "GET")
    return backupReminderSummary(
      (await readWebsiteSettings(db)).backupReminder,
      now,
    );
  const raw = await request.text();
  if (raw.length > 2048)
    throw Object.assign(Error("Reminder request too large."), { status: 413 });
  const body = JSON.parse(raw);
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw Error("Invalid reminder action.");
  if (!["confirm", "downloaded", "snooze", "interval"].includes(body.action))
    throw Error("Invalid reminder action.");
  if (body.action === "confirm" && body.confirmed !== true)
    throw Error("Confirm that you saved a copy outside Cloudflare.");
  let download;
  if (body.action === "downloaded") {
    download = normalizeBackupReminder({
      intervalDays: 30,
      lastDownloaded: {
        at: now.toISOString(),
        backupCreatedAt: body.backupCreatedAt,
        source: body.source,
      },
      lastConfirmed: null,
      snoozedUntil: null,
    }).lastDownloaded;
    if (Date.parse(download.backupCreatedAt) > +now + 300000)
      throw Error("Invalid backup creation date.");
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    const current = await readWebsiteSettings(db),
      next = { ...current.backupReminder };
    if (body.action === "interval") next.intervalDays = body.intervalDays;
    if (body.action === "snooze")
      next.snoozedUntil = new Date(+now + 3 * DAY_MS).toISOString();
    if (body.action === "downloaded") next.lastDownloaded = download;
    if (body.action === "confirm") {
      // A download does not establish an off-site copy. Only the explicit
      // confirmation records one; a manual copy may have no known archive date.
      next.lastConfirmed = {
        at: now.toISOString(),
        backupCreatedAt: body.backupCreatedAt ?? null,
      };
      next.snoozedUntil = null;
    }
    const backupReminder = normalizeBackupReminder(next);
    if (
      backupReminder.lastConfirmed?.backupCreatedAt &&
      Date.parse(backupReminder.lastConfirmed.backupCreatedAt) > +now + 300000
    )
      throw Error("Invalid backup creation date.");
    const { revision: previousRevision, ...settings } = current;
    settings.backupReminder = backupReminder;
    const revision = crypto.randomUUID();
    const result = await db
      .prepare(
        "UPDATE website_settings SET value=?,revision=? WHERE id='global' AND revision=?",
      )
      .bind(JSON.stringify(settings), revision, previousRevision)
      .run();
    if (result.meta.changes === 1)
      return backupReminderSummary(backupReminder, now);
  }
  throw Object.assign(
    Error("Backup reminder changed on another device. Please retry."),
    { status: 409 },
  );
}
