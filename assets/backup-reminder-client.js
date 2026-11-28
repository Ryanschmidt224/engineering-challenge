import { backupDateLabel } from "./automatic-backup-status.js";
import { normalizeBackupReminder } from "./backup-reminder-model.js";
const endpoint = "/api/project-engine/backup-reminder";
const changed = "bs:backup-reminder-changed";
let generation = 0;
export async function readBackupReminder() {
  const started = generation,
    response = await fetch(endpoint, {
      credentials: "same-origin",
      cache: "no-store",
    });
  if (response.status === 401) return null;
  const data = await response.json();
  if (!response.ok)
    throw Error(data.error || "Backup reminder could not be loaded.");
  normalizeBackupReminder(data);
  return started === generation ? data : undefined;
}
export async function changeBackupReminder(body) {
  const response = await fetch(endpoint, {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok)
    throw Error(data.error || "Backup reminder could not be saved.");
  normalizeBackupReminder(data);
  generation++;
  window.dispatchEvent(new CustomEvent(changed, { detail: data }));
  return data;
}
export function watchBackupReminder(callback) {
  window.addEventListener(changed, (event) => callback(event.detail));
}
export async function confirmOutsideCopy({ backupCreatedAt = null } = {}) {
  const confirmed = await window.BSDialogs.confirm(
    (backupCreatedAt
      ? "Backup created " + backupDateLabel(backupCreatedAt) + ". "
      : "") +
      "Confirm that you saved a whole-site backup outside Cloudflare, such as on your computer, an external drive or Dropbox. The website cannot check where you stored it.",
    {
      title: "Copy saved outside Cloudflare?",
      confirmLabel: "Confirm copy saved",
    },
  );
  if (!confirmed) return false;
  await changeBackupReminder({
    action: "confirm",
    confirmed: true,
    backupCreatedAt,
  });
  return true;
}
export async function recordCompletedBackup({ backupCreatedAt, source }) {
  // Called only after the destination file's close() resolves successfully.
  // A separate confirmation is needed to clear the off-site reminder.
  try {
    await changeBackupReminder({
      action: "downloaded",
      backupCreatedAt,
      source,
    });
  } catch (error) {
    await window.BSDialogs.alert(
      "Your backup file was saved, but its download date could not be recorded. " +
        error.message +
        " You can use “I saved a copy outside Cloudflare” in Website settings.",
      { title: "Backup saved; date unconfirmed" },
    );
    return;
  }
  try {
    await confirmOutsideCopy({ backupCreatedAt });
  } catch (error) {
    await window.BSDialogs.alert(
      "Your backup file was saved, but the outside-copy confirmation could not be recorded. " +
        error.message,
      { title: "Confirmation not saved" },
    );
  }
}
