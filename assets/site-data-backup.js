import { backupDataLines, siteBackupReader } from "./site-data-backup-model.js";
import {
  saveBackupFile,
  directBackupSaveSupported,
  backupSaveHelp,
} from "./backup-file-save.js";
export function backupAllDataButton() {
  const button = window.BSUI.button("Backup all data", async () => {
    button.disabled = true;
    let saved = false;
    try {
      const parts = Object.fromEntries(
        new Intl.DateTimeFormat("en-US", {
          timeZone: "America/Phoenix",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        })
          .formatToParts(new Date())
          .map((v) => [v.type, v.value]),
      );
      const reader = siteBackupReader(),
        manifest = reader.manifest;
      let backupCreatedAt;
      reader.manifest = async () => {
        const value = await manifest();
        backupCreatedAt = value.createdAt;
        return value;
      };
      saved = await saveBackupFile({
        name:
          "BuildingSchmidtDataBackup-" +
          parts.year +
          "-" +
          parts.month +
          "-" +
          parts.day +
          ".bsbackup",
        chunks: () => backupDataLines(reader),
        metadata: () => ({ source: "manual", backupCreatedAt }),
        onSaving: () => {
          button.textContent = "Backing up…";
        },
      });
    } catch (error) {
      await window.BSDialogs.alert(error.message, {
        title: "Backup could not be saved",
      });
    } finally {
      button.disabled = !directBackupSaveSupported();
      button.textContent = saved ? "Backup saved" : "Backup all data";
    }
  });
  button.disabled = !directBackupSaveSupported();
  if (button.disabled) button.title = backupSaveHelp;
  return button;
}
