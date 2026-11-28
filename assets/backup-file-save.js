import { recordCompletedBackup } from "./backup-reminder-client.js";
export const directBackupSaveSupported = () =>
  typeof window.showSaveFilePicker === "function";
export const backupSaveHelp =
  "This browser does not support saving a whole-site backup directly. Use desktop Chrome or Edge.";
export async function saveBackupFile({
  name,
  chunks,
  metadata,
  onSaving = () => {},
}) {
  let writable,
    saved = false;
  try {
    // Open synchronously from the click, before any network request.
    if (!directBackupSaveSupported()) throw Error(backupSaveHelp);
    const file = await window.showSaveFilePicker({
      suggestedName: name,
      types: [
        {
          description: "BuildingSchmidt data backup",
          accept: { "application/octet-stream": [".bsbackup"] },
        },
      ],
    });
    writable = await file.createWritable();
    onSaving();
    for await (const bytes of chunks()) await writable.write(bytes);
    await writable.close();
    writable = null;
    saved = true;
  } catch (error) {
    if (writable) await writable.abort().catch(() => {});
    if (error.name !== "AbortError") throw error;
  }
  if (saved) await recordCompletedBackup(metadata());
  return saved;
}
export async function* verifiedNightlyBytes(snapshot) {
  const response = await fetch(
    "/api/automatic-site-backups?id=" + encodeURIComponent(snapshot.id),
    { credentials: "same-origin", cache: "no-store" },
  );
  if (!response.ok)
    throw Error(
      "This backup could not be read. Refresh the list or use Backup all data.",
    );
  if (!response.body) throw Error("No backup data received.");
  const reader = response.body.getReader();
  let received = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > snapshot.bytes)
        throw Error("The backup size changed. Refresh the list and try again.");
      yield value;
    }
    if (received !== snapshot.bytes)
      throw Error("The backup download was incomplete. Please retry.");
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
