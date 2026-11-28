import { projectStatusChoices } from "./project-item-model.js?v=cad-links-20261128";
import { node, field, checkbox } from "./workshop-ui.js?v=save-upload-20261128";
import { dataTable } from "./data-table.js";
import { projectTree } from "./project-tree-model.js";
import { projectNumberKey } from "./project-item-model.js?v=cad-links-20261128";
import { editItem } from "./project-editors.js?v=save-upload-20261128";
const categories = [
  ["all", "All items"],
  ["assembly", "Subassemblies"],
  ["part", "Parts"],
  ["tool", "Tools"],
  ["document", "Documents"],
  ["code", "Code"],
];
const category = (item) =>
  item.is_tool ? "tool" : item.is_assembly ? "assembly" : item.kind;
const preference = "bs-engine-parts-view";
export function renderProjectParts(ctx) {
  const state = ctx.client.state,
    tree = projectTree(state.items, state.occurrences),
    root = node("div", "", "project-stack"),
    controls = node("div", "", "project-parts-controls"),
    panes = node("div", "", "project-parts-panes"),
    browse = node("nav", "", "project-parts-browse ui-navigation-list"),
    area = node("div", "", "project-main"),
    count = node("p", "", "muted"),
    reserved = window.BSUI.section({
      title: "Reserved part numbers",
      role: "reserved-numbers",
    });
  let query = "",
    kind = "all",
    status = "all",
    long = false,
    view = "compact",
    sort = "number";
  try {
    if (localStorage.getItem(preference) === "full") view = "full";
  } catch {}
  browse.setAttribute("aria-label", "Browse parts");
  root.dataset.partsManagement = "";
  root.append(
    node("h2", "Parts Management"),
    node(
      "p",
      "Each row is a placement. Quantity and status apply to that location.",
      "muted",
    ),
  );
  controls.append(
    field(
      "Search parts",
      "",
      (value) => {
        query = value;
        render();
      },
      { type: "search" },
    ),
    field(
      "Status",
      "all",
      (value) => {
        status = value;
        render();
      },
      {
        options: [
          { value: "all", label: "All statuses" },
          ...projectStatusChoices,
        ],
      },
    ),
    field(
      "Parts view",
      view,
      (value) => {
        view = value;
        try {
          localStorage.setItem(preference, view);
        } catch {}
        render();
      },
      {
        options: [
          { value: "compact", label: "Compact" },
          { value: "full", label: "Full columns" },
        ],
      },
    ),
    field(
      "Sort parts",
      "number",
      (value) => {
        sort = value;
        render();
      },
      {
        options: [
          { value: "number", label: "Part number" },
          { value: "name", label: "Name A–Z" },
        ],
      },
    ),
  );
  root.append(controls, count, panes, reserved.root);
  panes.append(browse, area);
  count.setAttribute("aria-live", "polite");
  const kindField = field(
    "Item type",
    kind,
    (value) => {
      kind = value;
      render();
    },
    { options: categories.map(([value, label]) => ({ value, label })) },
  );
  const advanced = node("details", "", "project-parts-filters");
  advanced.append(
    node("summary", "More options"),
    checkbox("Names over 20 characters", false, (value) => {
      long = value;
      render();
    }),
    kindField,
  );
  controls.append(advanced);
  let numberQuery = "";
  const result = node("p");
  reserved.body.append(
    node(
      "p",
      "Archived items keep their numbers. Search treats different zero padding as the same number.",
    ),
    field(
      "Find reserved number",
      "",
      (value) => {
        numberQuery = value;
        showReserved();
      },
      { type: "search" },
    ),
    result,
  );
  function showReserved() {
    const match = state.items.filter(
      (item) =>
        projectNumberKey(item.part_number) ===
        projectNumberKey(numberQuery.trim()),
    );
    result.textContent = !numberQuery.trim()
      ? "Enter a complete part number."
      : match.length
        ? match
            .map(
              (item) =>
                item.part_number +
                " · " +
                item.name +
                " · " +
                (state.occurrences.some(
                  (row) => row.item_id === item.id && tree.active(row),
                )
                  ? "Active"
                  : "Archived; number reserved"),
            )
            .join("\n")
        : "This number is not reserved.";
  }
  function render() {
    browse.replaceChildren();
    for (const [value, label] of categories) {
      const button = window.BSUI.button(
        label,
        () => {
          kind = value;
          kindField.querySelector("select").value = value;
          render();
        },
        { variant: "quiet" },
      );
      button.setAttribute("aria-pressed", String(value === kind));
      browse.append(button);
    }
    browse.hidden = view === "full";
    kindField.hidden = view !== "full";
    panes.dataset.partsView = view;
    const rows = state.occurrences
      .filter((row) => tree.active(row))
      .map((placement) => ({
        placement,
        item: tree.definitions.get(placement.item_id),
      }))
      .filter(
        ({ item, placement }) =>
          (kind === "all" || category(item) === kind) &&
          (status === "all" || placement.build_status === status) &&
          (!long || item.name.length > 20) &&
          query
            .toLowerCase()
            .trim()
            .split(/\s+/)
            .every((term) =>
              [
                item.part_number,
                item.name,
                item.fields?.manufacturer,
                item.fields?.mpn,
                item.fields?.description,
                ...(item.fields?.specs || []).flatMap((spec) => [
                  spec.label,
                  spec.value,
                ]),
              ]
                .join(" ")
                .toLowerCase()
                .includes(term),
            ),
      );
    rows.sort(
      (a, b) =>
        (sort === "name"
          ? a.item.name.localeCompare(b.item.name, undefined, {
              numeric: true,
              sensitivity: "base",
            })
          : a.item.part_number.localeCompare(b.item.part_number, undefined, {
              numeric: true,
              sensitivity: "base",
            })) ||
        tree
          .path(a.placement)
          .map((x) => x.name)
          .join("/")
          .localeCompare(
            tree
              .path(b.placement)
              .map((x) => x.name)
              .join("/"),
          ),
    );
    const columns = [
        "Part number",
        "Name",
        "Specifications",
        "Quantity",
        "Status",
        ...(view === "full"
          ? [
              "Location",
              "Type",
              "Manufacturer",
              "Manufacturer part number",
              "Needs attention",
              "Hidden in tree",
            ]
          : []),
        "Actions",
      ],
      table = dataTable("Parts Management", columns);
    for (const { item, placement } of rows) {
      const specs = (item.fields?.specs || [])
          .map(
            (spec) =>
              spec.label +
              ": " +
              (spec.value ?? "Not set") +
              (spec.unit ? " " + spec.unit : ""),
          )
          .join("; "),
        open = window.BSUI.button(
          item.name,
          () => ctx.navigate(ctx.projectId, item.id, "part", placement.id),
          { variant: "quiet" },
        );
      let specifications = specs;
      if (view === "compact" && item.fields?.specs?.length) {
        specifications = node("details", "", "ui-table-details");
        const values = item.fields.specs.map(
          (spec) =>
            spec.label +
            ": " +
            (spec.value ?? "Not set") +
            (spec.unit ? " " + spec.unit : ""),
        );
        specifications.append(
          node(
            "summary",
            values[0] +
              (values.length > 1 ? " · +" + (values.length - 1) + " more" : ""),
          ),
          ...values.map((value) => node("p", value)),
        );
      }
      table.append([
        item.part_number,
        open,
        specifications,
        placement.quantity + " " + placement.unit,
        placement.build_status.replaceAll("_", " "),
        ...(view === "full"
          ? [
              tree
                .path(placement)
                .map((x) => x.name)
                .join(" / "),
              categories.find(([key]) => key === category(item))?.[1],
              item.fields?.manufacturer,
              item.fields?.mpn,
              placement.attention ? placement.attention_note || "Yes" : "No",
              placement.hidden ? "Yes" : "No",
            ]
          : []),
        window.BSUI.button(
          "Edit",
          () =>
            editItem(
              { ...ctx, itemId: item.id, occurrenceId: placement.id },
              item,
              placement,
            ),
          { small: true },
        ),
      ]);
    }
    area.replaceChildren(table.root);
    if (!rows.length)
      area.append(node("p", "No active placements match these choices."));
    count.textContent = rows.length + " placements";
    resizeColumns(table.root, view);
  }
  showReserved();
  render();
  return root;
}
function resizeColumns(root, view) {
  const table = root.querySelector("table"),
    cols = document.createElement("colgroup");
  table.prepend(cols);
  let saved = {};
  try {
    const value = JSON.parse(
      localStorage.getItem("bs-engine-parts-widths-" + view) || "{}",
    );
    if (value && typeof value === "object" && !Array.isArray(value))
      saved = value;
  } catch {}
  const defaults =
      view === "full"
        ? [140, 240, 250, 120, 160, 300, 160, 180, 220, 200, 140, 100]
        : [140, 240, 250, 120, 160, 100],
    widths = defaults.map((value, index) =>
      Number.isFinite(saved[index])
        ? Math.min(600, Math.max(100, saved[index]))
        : value,
    ),
    fit = () => {
      table.style.width = widths.reduce((sum, width) => sum + width, 0) + "px";
    };
  fit();
  for (const [index, header] of [...table.querySelectorAll("th")].entries()) {
    const col = document.createElement("col");
    cols.append(col);
    col.style.width = widths[index] + "px";
    const handle = window.BSUI.button("", () => {}, {
      variant: "quiet",
      small: true,
    });
    handle.classList.add("project-column-resizer");
    handle.setAttribute(
      "aria-label",
      "Resize " + header.textContent + " column",
    );
    handle.title = "Drag or use left and right arrows to resize";
    header.append(handle);
    const set = (width) => {
      const value = Math.min(600, Math.max(100, width));
      col.style.width = value + "px";
      widths[index] = value;
      fit();
      saved[index] = value;
      try {
        localStorage.setItem(
          "bs-engine-parts-widths-" + view,
          JSON.stringify(saved),
        );
      } catch {}
    };
    handle.onkeydown = (event) => {
      if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
        event.preventDefault();
        set(
          header.getBoundingClientRect().width +
            (event.key === "ArrowLeft" ? -20 : 20),
        );
      }
    };
    handle.onpointerdown = (event) => {
      const start = event.clientX,
        width = header.getBoundingClientRect().width;
      handle.setPointerCapture(event.pointerId);
      handle.onpointermove = (move) => set(width + move.clientX - start);
      handle.onpointerup = handle.onpointercancel = () => {
        handle.onpointermove = null;
      };
    };
  }
}
