import { backupReminderSettings } from "./backup-reminder-settings.js";
import { projectRestorePicker } from "./project-restore-controls.js";
import { createProjectClient } from "./project-client.js?v=save-upload-20261128";
import { automaticSiteBackupStatus } from "./automatic-site-backups.js?v=offsite-backup-20261128";
import { automaticBackupStatus } from "./automatic-backup-status.js";
import { backupAllDataButton } from "./site-data-backup.js?v=offsite-backup-20261128";
import { node, field, actions } from "./workshop-ui.js?v=save-upload-20261128";
import { initSiteHeader } from "./site-header.js?v=offsite-backup-20261128";
import { settingsSaved } from "./website-settings-client.js?v=offsite-backup-20261128";
import { normalizeWebsiteSettings } from "./website-settings-model.js?v=offsite-backup-20261128";
initSiteHeader();
const root = document.querySelector("[data-website-settings]"),
  notice = document.querySelector("[data-notice]"),
  button = (...args) => window.BSUI.button(...args);
const choicesKey = ({ tags, owners, defaultOwner }) =>
  JSON.stringify({ tags, owners, defaultOwner });
let baselineChoices;
let draft,
  revision,
  dirty = false;
const backup = window.BSUI.section({
  title: "Data backup",
  role: "website-backup",
  open: true,
});
backup.root.id = "data-backup";
const backupButton = backupAllDataButton();
const projectChecks = window.BSUI.section({
  title: "Project backup checks",
  role: "project-backup-checks",
});
projectChecks.body.append(
  node(
    "p",
    "Separate per-project backups cover Projects only. They supplement the whole-site copies above.",
    "muted",
  ),
  automaticBackupStatus(),
);
backup.body.append(
  node(
    "p",
    "Nightly backups run daily at 2:17 am Arizona time and cover Projects, Workshop, Lessons Learned, account data and stored files. The seven latest verified copies are kept in the same Cloudflare account. Backup copies are excluded to prevent recursive growth.",
    "muted",
  ),
  backupReminderSettings(),
  automaticSiteBackupStatus(),
  projectChecks.root,
  node(
    "p",
    "Backup all data downloads Projects, Workshop, Lessons Learned, account data and stored files to your device. Keep a checked copy outside Cloudflare. A Workshop export covers Workshop only.",
    "muted",
  ),
  backupButton,
);
if (backupButton.disabled)
  backup.body.append(node("p", backupButton.title, "muted"));
root.after(backup.root);
function locateBackup() {
  if (location.hash === "#data-backup") {
    backup.root.open = true;
    requestAnimationFrame(() => backup.root.scrollIntoView());
  }
}
window.addEventListener("hashchange", locateBackup);
const report = (message) => {
  notice.textContent = message;
};
const restore = window.BSUI.section({
  title: "Restore project backup",
  role: "website-project-restore",
});
restore.body.append(
  node(
    "p",
    "Restore a .bsproject backup as a separate project with independent files. Existing projects stay unchanged.",
    "muted",
  ),
  projectRestorePicker({
    client: createProjectClient(),
    notify: report,
    onRestored: (result) => {
      report(
        "Recovered copy created with " +
          result.verifiedFiles +
          " verified files. ",
      );
      const link = node("a", "Open restored project", "ui-button");
      link.href =
        "project.html?project=" + encodeURIComponent(result.projectId);
      notice.append(link);
    },
  }),
);
backup.root.after(restore.root);

async function read() {
  const response = await fetch("/api/project-engine/settings", {
      credentials: "same-origin",
      cache: "no-store",
    }),
    data = await response.json();
  if (!response.ok) throw Error(data.error || "Settings could not be loaded.");
  draft = normalizeWebsiteSettings(data);
  revision = data.revision;
  baselineChoices = choicesKey(data);
  dirty = false;
  render();
}
function render() {
  root.replaceChildren();
  const form = node("form"),
    owners = window.BSUI.section({
      title: "Project owners",
      role: "website-owners",
      open: true,
    }),
    tags = window.BSUI.section({
      title: "Tags",
      role: "website-tags",
      open: true,
    });
  const defaultField = field(
    "Default project owner",
    draft.defaultOwner,
    (value) => {
      draft.defaultOwner = value;
      dirty = true;
    },
    { options: draft.owners.map((value) => ({ value, label: value })) },
  );
  const updateDefault = () => {
    const select = defaultField.querySelector("select");
    select.replaceChildren();
    for (const value of draft.owners) {
      const option = node("option", value);
      option.value = value;
      select.append(option);
    }
    select.value = draft.defaultOwner;
  };
  const list = (key, section, label, max) => {
    const rows = node("div", "", "ui-settings-list");
    section.body.append(rows);
    const draw = () => {
      rows.replaceChildren();
      draft[key].forEach((value, index) => {
        const row = node("div", "", "ui-settings-row"),
          input = node("input", "", "ui-control");
        input.value = value;
        input.maxLength = max;
        input.required = true;
        input.setAttribute("aria-label", label + " " + (index + 1));
        input.oninput = () => {
          if (key === "owners" && draft.defaultOwner === draft[key][index])
            draft.defaultOwner = input.value;
          draft[key][index] = input.value;
          dirty = true;
          if (key === "owners") updateDefault();
        };
        row.append(
          input,
          button(
            "Remove",
            () => {
              if (key === "owners" && draft.owners.length === 1) {
                report("Keep at least one project owner.");
                return;
              }
              const removed = draft[key].splice(index, 1)[0];
              if (key === "owners" && draft.defaultOwner === removed)
                draft.defaultOwner = draft.owners[0];
              dirty = true;
              draw();
              if (key === "owners") updateDefault();
            },
            { variant: "quiet", small: true },
          ),
        );
        rows.append(row);
      });
    };
    draw();
    section.body.append(
      button("Add " + label.toLowerCase(), () => {
        draft[key].push("");
        dirty = true;
        draw();
        rows.lastElementChild.querySelector("input").focus();
      }),
    );
  };
  list("owners", owners, "Owner", 80);
  owners.body.append(
    defaultField,
    node(
      "p",
      "Names label projects; they do not grant access. New projects start with the default owner.",
      "muted",
    ),
  );
  list("tags", tags, "Tag", 60);
  const save = button("Save settings", () => form.requestSubmit(), {
      variant: "primary",
    }),
    reload = button("Reload settings", async () => {
      if (
        !dirty ||
        (await window.BSDialogs.confirm(
          "Discard unsaved settings and reload?",
          { title: "Reload settings?", confirmLabel: "Reload settings" },
        ))
      )
        void read().catch((error) => report(error.message));
    });
  form.append(
    node(
      "p",
      "Manage the choices available across the website. Removing or renaming a choice does not change existing projects.",
      "muted",
    ),
    owners.root,
    tags.root,
    actions(save, reload),
  );
  form.onsubmit = async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    save.disabled = true;
    try {
      // Reminder actions share the settings row. Refresh only the revision if
      // the saved owner/tag choices are unchanged; a real edit still conflicts.
      const latestResponse = await fetch("/api/project-engine/settings", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const latest = await latestResponse.json();
      if (!latestResponse.ok)
        throw Error(latest.error || "Settings could not be loaded.");
      if (
        latest.revision !== revision &&
        choicesKey(latest) === baselineChoices
      )
        revision = latest.revision;
      const value = normalizeWebsiteSettings(draft),
        response = await fetch("/api/project-engine/settings", {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ expectedRevision: revision, value }),
        }),
        data = await response.json();
      if (!response.ok)
        throw Error(data.error || "Settings could not be saved.");
      settingsSaved(data);
      draft = normalizeWebsiteSettings(data);
      revision = data.revision;
      baselineChoices = choicesKey(data);
      dirty = false;
      render();
      report("Website settings saved.");
    } catch (error) {
      report(error.message);
    } finally {
      save.disabled = false;
    }
  };
  root.append(form);
  locateBackup();
}
addEventListener("beforeunload", (event) => {
  if (dirty) {
    event.preventDefault();
    event.returnValue = "";
  }
});
void read().catch((error) => {
  report(error.message);
  root.replaceChildren(
    button(
      "Try again",
      () => void read().catch((error) => report(error.message)),
    ),
  );
});
