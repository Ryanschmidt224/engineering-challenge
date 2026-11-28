import { normalizeOverview } from "./project-overview-model.js?v=cad-links-20261128";
import { node, field } from "./workshop-ui.js";
import { editable, detailsFor } from "./project-editors.js";
import { fileLink } from "./project-information.js?v=cad-links-20261128";
import { normalizeCadLinks } from "./cad-link-model.js";
import { cadLinkRows } from "./cad-link-view.js";
const button = (...args) => window.BSUI.button(...args);
export function projectCadLinks(ctx, item = null, { summary = false } = {}) {
  const links = normalizeCadLinks(
    item
      ? item.fields.cad_links || []
      : normalizeOverview(ctx.client.state.project.overview || {}).cadLinks ||
          [],
  );
  const files = item
    ? ctx.client.state.file_links
        .filter(
          (l) => l.item_id === item.id && l.active && l.role === "engineering",
        )
        .map((l) => ctx.client.state.files.find((f) => f.id === l.file_id))
        .filter(Boolean)
    : [];
  const section = window.BSUI.section({
    title: summary ? "Assembly CAD files" : "CAD files",
    role: item ? "engineering-file" : "summary-cad-files",
    count: links.length,
    countLabel: ["link", "links"],
  });
  section.body.append(
    node(
      "p",
      "CAD stays in Dropbox. Add a link to a file or an assembly folder.",
      "muted",
    ),
  );
  const edit = (link = null, remove = false) => {
    const draft = link
      ? structuredClone(link)
      : { id: crypto.randomUUID(), name: "", kind: "file", url: "" };
    const collect = () => {
      const current = item
        ? ctx.client.state.items.find((row) => row.id === item.id)
        : null;
      if (item && !current) throw Error("This part is no longer available.");
      let next = normalizeCadLinks(
        item
          ? current.fields.cad_links || []
          : normalizeOverview(ctx.client.state.project.overview || {})
              .cadLinks || [],
      );
      if (remove) next = next.filter((row) => row.id !== draft.id);
      else {
        const clean = normalizeCadLinks([draft])[0],
          at = next.findIndex((row) => row.id === clean.id);
        if (at < 0) next.push(clean);
        else next[at] = clean;
      }
      next = normalizeCadLinks(next);
      return item
        ? {
            details: {
              ...detailsFor(current),
              fields: { ...current.fields, cad_links: next },
            },
            occurrenceId: ctx.occurrenceId,
          }
        : { action: "cad-links", cadLinks: next };
    };
    const editor = editable(
      ctx,
      remove
        ? "Remove CAD link?"
        : link
          ? "Edit Dropbox link"
          : "Add Dropbox link",
      remove ? "Remove link" : "Save link",
      collect,
      (data, token) =>
        ctx.client.write(
          ctx.projectId,
          item ? "/items/" + item.id : "/overview",
          "PATCH",
          data,
          token,
        ),
      {
        confirmation: remove,
        review: (state) => {
          const current = item
            ? state.items.find((row) => row.id === item.id)?.fields.cad_links
            : normalizeOverview(state.project.overview || {}).cadLinks;
          const text = node(
            "p",
            "Current saved CAD links: " +
              (current || []).map((l) => l.name + " — " + l.url).join("; "),
          );
          return text;
        },
      },
    );
    if (remove)
      editor.fields.append(
        node(
          "p",
          "Remove “" +
            draft.name +
            "” from this page? The Dropbox file or folder is kept.",
        ),
      );
    else {
      editor.fields.append(
        field("Name", draft.name, (value) => (draft.name = value), {
          required: true,
          placeholder: "e.g. Arm assembly — working files",
        }),
        field("Link to", draft.kind, (value) => (draft.kind = value), {
          options: [
            { value: "file", label: "File" },
            { value: "folder", label: "Folder" },
          ],
        }),
        field(
          "Dropbox link",
          draft.url,
          (value) => (draft.url = value.trim()),
          {
            type: "url",
            required: true,
            placeholder: "Paste the link copied from Dropbox",
          },
        ),
        node(
          "p",
          "In Dropbox, choose Share → Copy link. Dropbox controls access.",
          "muted",
        ),
        node(
          "p",
          "Links open the current Dropbox item. For a fixed CAD revision, link to a separately saved copy.",
          "muted",
        ),
      );
    }
  };
  window.BSUI.sectionActions(section.body, {
    primary: button("+ Add Dropbox link", () => edit()),
  });
  for (const link of links) {
    const rows = cadLinkRows([link]);
    rows.append(
      button("Edit", () => edit(link), { variant: "quiet" }),
      button("Remove link", () => edit(link, true), { variant: "quiet" }),
    );
    section.body.append(rows);
  }
  if (files.length) {
    const previous = node("details");
    previous.append(
      node("summary", "Previously uploaded files (" + files.length + ")"),
      node(
        "p",
        "Existing uploads remain available. Add new CAD through Dropbox.",
        "muted",
      ),
      ...files.map((file) => fileLink(ctx, file)),
    );
    section.body.append(previous);
  }
  section.body.append(
    node(
      "p",
      "Project backups preserve links, not the contents of Dropbox files.",
      "muted",
    ),
  );
  return section.root;
}
