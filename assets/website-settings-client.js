import { defaultWebsiteSettings } from "./website-settings-model.js";

// Deduplicate only requests that are still running. A settled request must not
// become a page-lifetime cache of the owner/tag choices.
let settings = defaultWebsiteSettings();
let pending = null;
let generation = 0;
const changeKey = "buildingschmidt:website-settings-changed";
export const websiteSettings = () => settings;

export function loadWebsiteSettings() {
  if (pending) return pending;
  const started = generation;
  const request = fetch("/api/project-engine/settings", {
    credentials: "same-origin",
    cache: "no-store",
  }).then(async (response) => {
    const data = await response.json();
    if (!response.ok)
      throw Object.assign(
        Error(data.error || "Website settings could not be loaded."),
        { status: response.status },
      );
    // A GET started before a successful local save cannot overwrite that save.
    if (started === generation) settings = data;
    return settings;
  });
  pending = request;
  request
    .finally(() => {
      if (pending === request) pending = null;
    })
    .catch(() => {});
  return request;
}

export function settingsSaved(value) {
  generation++;
  settings = value;
  pending = null;
  // Storage carries only an invalidation marker, never the settings or secrets.
  // If unavailable, focus/visibility refresh and navigation still work.
  try {
    localStorage.setItem(changeKey, String(value.revision));
  } catch {}
}

export function ownerChoices(current = []) {
  return [...new Set([...settings.owners, ...current.filter(Boolean)])];
}

function refresh() {
  // Refresh the shared choices without rerendering or discarding editor drafts.
  void loadWebsiteSettings().catch(() => {});
}
if (typeof window !== "undefined") {
  window.addEventListener("focus", refresh);
  window.addEventListener("storage", (event) => {
    if (event.key === changeKey) {
      generation++;
      pending = null;
      refresh();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refresh();
  });
}
