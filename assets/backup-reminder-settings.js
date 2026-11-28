import {
  node,
  actions,
  readValue,
  field,
} from "./workshop-ui.js?v=save-upload-20261128";
import {
  readBackupReminder,
  changeBackupReminder,
  watchBackupReminder,
  confirmOutsideCopy,
} from "./backup-reminder-client.js";
import { backupDateLabel } from "./automatic-backup-status.js";
export function backupReminderSettings() {
  const root = node("div"),
    status = node("div"),
    notice = node("p", "", "muted"),
    controls = node("div");
  root.dataset.backupReminderSettings = "";
  status.setAttribute("aria-live", "polite");
  notice.setAttribute("aria-live", "polite");
  let dirty = false;
  const intervalField = field(
    "Remind me every (days)",
    30,
    () => {
      dirty = true;
    },
    { type: "number", required: true },
  );
  const interval = intervalField.querySelector("input");
  interval.min = "7";
  interval.max = "90";
  interval.step = "1";
  const save = window.BSUI.button("Save reminder interval", async () => {
    if (!interval.reportValidity()) return;
    await run(save, async () => {
      const data = await changeBackupReminder({
        action: "interval",
        intervalDays: Number(interval.value),
      });
      dirty = false;
      render(data);
      notice.textContent = "Reminder interval saved.";
    });
  });
  const confirm = window.BSUI.button("I saved a copy outside Cloudflare", () =>
    run(confirm, async () => {
      if (await confirmOutsideCopy())
        notice.textContent = "Copy outside Cloudflare recorded.";
    }),
  );
  const reload = window.BSUI.button("Refresh copy status", () =>
    run(reload, async () => {
      render(await readBackupReminder());
    }),
  );
  async function run(button, action) {
    button.disabled = true;
    notice.textContent = "";
    try {
      await action();
    } catch (error) {
      notice.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  }
  function render(data) {
    if (data === undefined) return;
    if (!data) {
      status.replaceChildren(
        node("p", "Sign in as the owner to record a copy."),
      );
      controls.hidden = true;
      return;
    }
    controls.hidden = false;
    const confirmed = data.lastConfirmed,
      downloaded = data.lastDownloaded;
    const dates = node("dl");
    dates.append(
      readValue(
        "Last confirmed copy outside Cloudflare",
        confirmed
          ? backupDateLabel(confirmed.at) +
              (data.ageDays === 0
                ? " (today)"
                : " (" + data.ageDays + " days ago)")
          : "Never recorded",
      ),
      readValue(
        "Last backup downloaded",
        downloaded ? backupDateLabel(downloaded.at) : "Never recorded",
      ),
    );
    if (downloaded)
      dates.append(
        readValue(
          "Downloaded backup created",
          backupDateLabel(downloaded.backupCreatedAt),
        ),
      );
    if (confirmed?.backupCreatedAt)
      dates.append(
        readValue(
          "Confirmed backup created",
          backupDateLabel(confirmed.backupCreatedAt),
        ),
      );
    if (
      data.snoozedUntil &&
      Date.parse(data.snoozedUntil) > Date.parse(data.observedAt)
    )
      dates.append(
        readValue("Reminder snoozed until", backupDateLabel(data.snoozedUntil)),
      );
    status.replaceChildren(dates);
    if (!dirty) interval.value = data.intervalDays;
  }
  controls.append(intervalField, actions(save, confirm, reload));
  root.append(
    node("h3", "Copy outside Cloudflare"),
    node(
      "p",
      "A completed download records a file saved to your device. Confirm separately that you kept it outside Cloudflare. The site cannot see Dropbox or check your storage location.",
      "muted",
    ),
    status,
    controls,
    notice,
  );
  status.append(node("p", "Checking copy status…", "muted"));
  controls.hidden = true;
  watchBackupReminder(render);
  void readBackupReminder()
    .then(render)
    .catch((error) => {
      status.replaceChildren(node("p", error.message, "status--error"));
      controls.hidden = false;
    });
  return root;
}
