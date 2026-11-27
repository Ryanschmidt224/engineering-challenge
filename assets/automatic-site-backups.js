import { node, readValue, actions } from "./workshop-ui.js";
import { backupDateLabel } from "./automatic-backup-status.js";
const messages = {
  never: "No whole-site backup recorded yet",
  running: "Whole-site backup is running",
  ok: "Nightly whole-site backup: OK",
  failed: "Whole-site backup did not finish successfully",
  interrupted: "Whole-site backup outcome is unconfirmed",
  stale: "Whole-site backup is overdue",
};
const errors = {
  SIZE_LIMIT: "The archive exceeds the 512 MiB safety limit.",
  SOURCE_LIMIT: "The site exceeds this backup job’s source limits.",
  TIME_LIMIT: "The backup reached its time limit.",
  VERIFY_FAILED: "The stored copy did not pass byte verification.",
  SOURCE_CHANGED: "Data changed while the backup was being made.",
  UNKNOWN_BACKUP_OBJECT: "An unexpected object was found in backup storage.",
};
const sizeLabel = (bytes) => (bytes / (1024 * 1024)).toFixed(1) + " MiB";
export function automaticSiteBackupStatus() {
  const root = node("div"),
    content = node("div"),
    refresh = window.BSUI.button(
      "Refresh whole-site backup status",
      () => void read(),
    );
  root.dataset.siteBackups = "";
  content.setAttribute("aria-live", "polite");
  root.append(content, actions(refresh));
  let loading = false;
  async function read() {
    if (loading) return;
    loading = true;
    refresh.disabled = true;
    try {
      const response = await fetch("/api/automatic-site-backups", {
          credentials: "same-origin",
          cache: "no-store",
        }),
        data = await response.json();
      if (
        !response.ok ||
        !Object.hasOwn(messages, data.health) ||
        !Array.isArray(data.snapshots)
      )
        throw Error("Unavailable");
      const headline = node("p", messages[data.health], "notice"),
        dates = node("dl");
      if (["failed", "interrupted", "stale"].includes(data.health))
        headline.classList.add("status--error");
      dates.append(
        readValue("Last attempt", backupDateLabel(data.lastAttempt?.startedAt)),
        readValue(
          "Last verified copy",
          backupDateLabel(data.lastSuccess?.createdAt),
        ),
      );
      const description = {
        never:
          "The first copy will appear after a successful nightly run. You can use Backup all data now.",
        running:
          "The new copy is not confirmed yet. Earlier verified copies remain available below.",
        ok: "The saved archive passed a full read-back check. Download a copy below and keep it outside Cloudflare.",
        failed:
          (errors[data.lastAttempt?.error] ||
            "The backup or its retention cleanup could not finish.") +
          " Earlier verified copies remain available below.",
        interrupted:
          "No completion was recorded before the run expired. Earlier copies remain available.",
        stale:
          "No successful nightly backup has been recorded for more than 36 hours. Save a manual copy while the job is checked.",
      }[data.health];
      content.replaceChildren(headline, dates, node("p", description, "muted"));
      if (data.snapshots.length) {
        content.append(node("h3", "Verified copies"));
        const list = node("dl");
        for (const snapshot of data.snapshots) {
          const row = readValue(
              backupDateLabel(snapshot.createdAt),
              sizeLabel(snapshot.bytes),
            ),
            link = node("a", "Download");
          link.href =
            "/api/automatic-site-backups?id=" + encodeURIComponent(snapshot.id);
          link.setAttribute(
            "aria-label",
            "Download whole-site backup from " +
              backupDateLabel(snapshot.createdAt),
          );
          row.lastChild.append(document.createTextNode(" · "), link);
          list.append(row);
        }
        content.append(list);
      }
    } catch {
      content.replaceChildren(
        node(
          "p",
          "Whole-site backup status is unavailable. Protection is unconfirmed.",
          "status--error",
        ),
        node(
          "p",
          "Refresh to retry, or use Backup all data to save a new manual copy.",
          "muted",
        ),
      );
    } finally {
      loading = false;
      refresh.disabled = false;
    }
  }
  content.append(node("p", "Checking whole-site backups…", "muted"));
  void read();
  return root;
}
