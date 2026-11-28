export const DAY_MS = 86400000;
export const defaultBackupReminder = () => ({
  intervalDays: 30,
  lastDownloaded: null,
  lastConfirmed: null,
  snoozedUntil: null,
});
const date = (value) => {
  if (
    typeof value !== "string" ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  )
    throw Error("Invalid backup reminder date.");
  return value;
};
export function normalizeBackupReminder(value = defaultBackupReminder()) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Invalid backup reminder settings.");
  if (
    !Number.isInteger(value.intervalDays) ||
    value.intervalDays < 7 ||
    value.intervalDays > 90
  )
    throw Error("Choose a reminder interval from 7 to 90 days.");
  const copy = (entry, downloaded) => {
    if (entry === null) return null;
    if (!entry || typeof entry !== "object" || Array.isArray(entry))
      throw Error("Invalid backup copy record.");
    const result = {
      at: date(entry.at),
      backupCreatedAt:
        entry.backupCreatedAt === null ? null : date(entry.backupCreatedAt),
    };
    if (downloaded) {
      if (
        !["manual", "nightly"].includes(entry.source) ||
        !result.backupCreatedAt
      )
        throw Error("Invalid backup download record.");
      result.source = entry.source;
    }
    return result;
  };
  return {
    intervalDays: value.intervalDays,
    lastDownloaded: copy(value.lastDownloaded, true),
    lastConfirmed: copy(value.lastConfirmed, false),
    snoozedUntil: value.snoozedUntil === null ? null : date(value.snoozedUntil),
  };
}
export function backupReminderSummary(value, now = new Date()) {
  const reminder = normalizeBackupReminder(value);
  const elapsed = reminder.lastConfirmed
    ? Math.max(0, +now - Date.parse(reminder.lastConfirmed.at))
    : null;
  return {
    ...reminder,
    ageDays: elapsed === null ? null : Math.floor(elapsed / DAY_MS),
    due:
      (elapsed === null || elapsed > reminder.intervalDays * DAY_MS) &&
      (!reminder.snoozedUntil || +now >= Date.parse(reminder.snoozedUntil)),
    observedAt: now.toISOString(),
  };
}
