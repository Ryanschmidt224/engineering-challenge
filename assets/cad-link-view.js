import { node } from "./workshop-ui.js";
import { normalizeCadLinks } from "./cad-link-model.js";
export function cadLinkRows(links) {
  const root = node("div");
  for (const link of normalizeCadLinks(links)) {
    const row = window.BSUI.fieldRow(
      link.kind === "folder" ? "Dropbox folder" : "Dropbox file",
      "",
    ).root;
    const value = row.lastElementChild,
      anchor = node("a", link.name);
    anchor.href = link.url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.title = "Open in Dropbox";
    value.append(anchor);
    root.append(row);
  }
  return root;
}
