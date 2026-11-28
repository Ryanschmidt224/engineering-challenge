import { projectBOM } from "./project-tree-model.js";
import { dataTable } from "./data-table.js";
import { node, field } from "./workshop-ui.js?v=save-upload-20261128";
export function renderProjectBOM(ctx, scope = null) {
  const { items, occurrences } = ctx.client.state,
    rows = projectBOM(items, occurrences, scope),
    section = window.BSUI.section({
      title: scope ? "Subassembly BOM" : "Project BOM",
      role: "project-bom",
      open: true,
    }),
    table = dataTable("Bill of materials", [
      "Part number",
      "Name",
      "Total quantity",
      "Unit",
    ]);
  section.body.append(
    node(
      "p",
      "Quantities include every active parent subassembly multiplier and all placements of each part. Tools and documents are excluded. Different units remain separate.",
    ),
  );
  const render = (grouped) => {
    table.body.replaceChildren();
    for (const group of grouped
      ? [
          ["Subassemblies", rows.filter((row) => row.item.is_assembly)],
          ["Parts", rows.filter((row) => !row.item.is_assembly)],
        ]
      : [["", rows]]) {
      if (!group[1].length) continue;
      if (group[0]) {
        const row = table.body.insertRow(),
          header = document.createElement("th");
        header.colSpan = 4;
        header.scope = "rowgroup";
        header.textContent = group[0];
        row.append(header);
      }
      for (const row of group[1]) {
        const link = window.BSUI.button(
          row.item.name,
          () =>
            ctx.navigate(ctx.projectId, row.item.id, "part", row.placements[0]),
          { variant: "quiet" },
        );
        link.setAttribute("aria-label", "Open " + row.item.name);
        table.append([
          row.item.part_number,
          link,
          String(row.quantity),
          row.unit,
        ]);
      }
    }
  };
  section.body.append(
    field("BOM grouping", "none", (value) => render(value === "type"), {
      options: [
        { value: "none", label: "Part number" },
        { value: "type", label: "Subassemblies and parts" },
      ],
    }),
    table.root,
  );
  render(false);
  return section.root;
}
