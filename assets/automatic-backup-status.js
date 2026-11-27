import { node, readValue, actions } from "./workshop-ui.js";

const messages = {
  never: "No nightly run recorded yet",
  running: "Nightly project backup is running",
  ok: "Nightly project backup: OK",
  failed: "Nightly project backup failed",
  stale: "Nightly project backup is overdue",
  interrupted: "Nightly project backup did not finish",
  skipped: "Nightly project backup was skipped",
};
export const backupDateLabel = (value) =>
  value
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Phoenix",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value)) + " (Arizona)"
    : "None recorded";

export function automaticBackupStatus() {
  const root = node("div"),
    content = node("div"),
    refresh = window.BSUI.button("Refresh backup status", () => void read());
  root.dataset.backupStatus = "";
  content.setAttribute("aria-live", "polite");
  root.append(content, actions(refresh));
  let loading = false;
  async function read() {
    if (loading) return;
    loading = true;
    refresh.disabled = true;
    try {
      const response = await fetch("/api/backup-status", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok || !Object.hasOwn(messages, data.health))
        throw Error("Backup status is unavailable. Protection is unconfirmed.");
      const headline = node("p", messages[data.health], "notice"),
        rows = node("dl");
      if (["failed", "stale", "interrupted", "skipped"].includes(data.health))
        headline.classList.add("status--error");
      rows.append(
        readValue("Last attempt", backupDateLabel(data.lastAttempt?.startedAt)),
        readValue(
          "Last successful check",
          backupDateLabel(data.lastSuccess?.finishedAt),
        ),
      );
      const description = {
        never:
          "Status recording starts with this update. Older backup files may already exist; their history is not inferred here.",
        running: "A result has not been confirmed yet. Refresh to check again.",
        failed:
          "The latest run could not finish successfully. Any earlier successful backups remain available. Use Backup all data below to save a complete copy now.",
        stale:
          "No successful scheduled check has been recorded for more than 36 hours. Use Backup all data below while the nightly job is checked.",
        interrupted:
          "The run started more than two hours ago without a recorded result. Its outcome is unconfirmed. Use Backup all data below to save a complete copy now.",
        skipped:
          "Projects storage is not initialized or needs a compatible application version. No successful check is claimed.",
        ok: "Changed projects receive a new backup. Existing backups for unchanged projects are checked for completeness.",
      }[data.health];
      content.replaceChildren(headline, rows, node("p", description, "muted"));
      if (data.lastAttempt?.finishedAt) {
        const c = data.lastAttempt.counts;
        content.append(
          node(
            "p",
            `${c.saved} saved · ${c.unchanged} unchanged · ${c.failed} failed`,
            "muted",
          ),
        );
      }
    } catch {
      content.replaceChildren(
        node(
          "p",
          "Backup status is unavailable. Protection is unconfirmed.",
          "status--error",
        ),
        node(
          "p",
          "Refresh to retry. You can also use Backup all data below.",
          "muted",
        ),
      );
    } finally {
      loading = false;
      refresh.disabled = false;
    }
  }
  content.append(node("p", "Checking nightly backup status…", "muted"));
  void read();
  return root;
}
