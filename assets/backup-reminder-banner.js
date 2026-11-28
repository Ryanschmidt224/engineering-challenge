import {
  readBackupReminder,
  changeBackupReminder,
  watchBackupReminder,
} from "./backup-reminder-client.js";
export function initBackupReminder(header) {
  const banner = document.createElement("aside");
  banner.className = "ui-backup-reminder";
  banner.setAttribute("aria-label", "Backup copy reminder");
  banner.hidden = true;
  const text = document.createElement("span"),
    link = document.createElement("a"),
    snooze = document.createElement("button"),
    feedback = document.createElement("span");
  link.textContent = "Download now";
  link.href = "/website-settings.html#data-backup";
  link.className = "ui-button";
  snooze.textContent = "Remind me in 3 days";
  snooze.type = "button";
  snooze.className = "ui-button";
  feedback.setAttribute("aria-live", "polite");
  banner.append(text, link, snooze, feedback);
  header.after(banner);
  const render = (data) => {
    if (data === undefined) return;
    banner.hidden = !data?.due;
    if (!data) return;
    text.textContent =
      data.ageDays === null
        ? "No backup copy outside Cloudflare has been recorded."
        : "Your last confirmed backup copy outside Cloudflare was " +
          data.ageDays +
          " days ago.";
    feedback.textContent = "";
  };
  let pending = false;
  const refresh = async () => {
    if (pending || document.visibilityState === "hidden") return;
    pending = true;
    try {
      render(await readBackupReminder());
    } catch {
      /* A reminder failure must never block the notebook. */
    } finally {
      pending = false;
    }
  };
  snooze.onclick = async () => {
    snooze.disabled = true;
    try {
      await changeBackupReminder({ action: "snooze" });
    } catch (error) {
      feedback.textContent = error.message;
    } finally {
      snooze.disabled = false;
    }
  };
  watchBackupReminder(render);
  window.addEventListener("focus", refresh);
  window.addEventListener("pageshow", refresh);
  window.addEventListener("bs:owner-session-changed", () => {
    banner.hidden = true;
    void refresh();
  });
  document.addEventListener("visibilitychange", refresh);
  // Long-open pages must notice both a due date and an expired server snooze.
  setInterval(refresh, 60000);
  void refresh();
}
