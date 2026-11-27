import { actionBar } from "./photo-editor.js";
import { fieldLookupEvidence } from "./workshop-lookup-provenance.js";
import { lookupEvidenceView } from "./workshop-lookup-evidence-view.js";
import {
  saveLookupDocument,
  prepareLookupDocument,
  identityRequired,
  requireLookupIdentity,
  clearLookupDocuments,
} from "./workshop-lookup-documents.js";
import "./ui-kit.js";
import { dataTable } from "./data-table.js";
import {
  node,
  button,
  listCard,
  actions,
  panel,
  field,
  checkbox,
  readValue,
  valuesEditor,
  help,
  requestWorkshop,
} from "./workshop-ui.js";
import {
  present,
  resolveFamilyValues,
  validateFamilyFields,
  validateFamilyValues,
  isWebUrl,
} from "./family-model.js";
import { initProjectProductCopy } from "./project-product-copy.js";
import {
  renderWorkshopProjectUses,
  projectReturnLink,
} from "./workshop-project-uses.js";
import { workshopProductLookup } from "./workshop-product-lookup.js";

const $ = (selector) => document.querySelector(selector),
  detail = $("#workshop-detail"),
  dialog = $("#workshop-dialog");
const params = new URLSearchParams(location.search);
let data = {
  categories: [],
  families: [],
  fields: [],
  products: [],
  uses: [],
  attachments: [],
};

let selectedCategory = "",
  selectedFamily = "",
  selectedProduct = "",
  draft = null,
  editing = false,
  dirty = false,
  busy = false,
  showUseFields = false;
const status = (message, error = false) => {
  $("#workshop-status").textContent = message;
  $("#workshop-status").classList.toggle("status--error", error);
};
const mark = () => {
  dirty = true;
};
const active = (record) => !record.archived || $("#show-archived").checked;
const family = () => data.families.find((f) => f.id === selectedFamily);
const familyFields = () =>
  data.fields
    .filter((f) => f.family_id === selectedFamily)
    .sort((a, b) => a.sort_order - b.sort_order);
const copy = (value) => structuredClone(value);
const editLabel = (entity) =>
  entity === "family" ? "Edit template" : "Edit " + entity;
async function mayLeave() {
  return (
    !dirty ||
    (await window.BSDialogs.confirm(
      "Discard the unsaved changes to this form?",
      { title: "Discard unsaved changes?", confirmLabel: "Discard changes" },
    ))
  );
}
async function run(operation) {
  if (busy) return;
  busy = true;
  detail.inert = true;
  $("#family-list").inert = true;
  $("#category-tree").inert = true;
  try {
    await operation();
  } catch (error) {
    status(error.message, true);
  } finally {
    busy = false;
    detail.inert = false;
    $("#family-list").inert = false;
    $("#category-tree").inert = false;
  }
}
async function refresh() {
  data = await requestWorkshop();
  renderNavigation();
}
function updateLocation() {
  const url = new URL(location.href);
  url.searchParams.delete("edit");
  for (const [key, value] of [
    ["family", selectedFamily],
    ["product", selectedProduct],
  ])
    value ? url.searchParams.set(key, value) : url.searchParams.delete(key);
  history.replaceState(null, "", url);
}
async function changeSelection({
  category = selectedCategory,
  familyId = "",
  productId = "",
} = {}) {
  if (!(await mayLeave())) return;
  if (draft?.entity === "product") clearLookupDocuments(draft.record.id);
  selectedCategory = category;
  selectedFamily = familyId;
  selectedProduct = productId;
  draft = null;
  editing = false;
  dirty = false;
  showUseFields = false;
  updateLocation();
  renderNavigation();
  renderDetail();
}
function descendantCategories(id) {
  const found = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const category of data.categories)
      if (found.has(category.parent_id) && !found.has(category.id)) {
        found.add(category.id);
        changed = true;
      }
  }
  return found;
}
function renderNavigation() {
  const tree = $("#category-tree");
  tree.replaceChildren(
    button(
      "All families",
      () => changeSelection({ category: "" }),
      "button--quiet",
    ),
  );
  const build = (parent, host) => {
    for (const category of data.categories
      .filter((c) => c.parent_id === parent && active(c))
      .sort(
        (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name),
      )) {
      const children = data.categories.some(
        (c) => c.parent_id === category.id && active(c),
      );
      const entry = button(
        category.name + (category.archived ? " (archived)" : ""),
        () => changeSelection({ category: category.id }),
        "category-button" +
          (selectedCategory === category.id ? " is-selected" : ""),
      );
      entry.oncontextmenu = (event) => {
        event.preventDefault();
        selectedCategory = category.id;
        renderNavigation();
        showCategoryMenu(event.clientX, event.clientY);
      };
      entry.onkeydown = (event) => {
        if (event.key === "F10" && event.shiftKey) {
          event.preventDefault();
          selectedCategory = category.id;
          const box = entry.getBoundingClientRect();
          showCategoryMenu(box.left, box.bottom);
        }
      };
      if (children) {
        const group = node("details", "", "category-node"),
          summary = node("summary");
        summary.append(entry);
        group.append(summary);
        group.open = descendantCategories(category.id).has(selectedCategory);
        const sub = node("div", "", "category-children");
        build(category.id, sub);
        group.append(sub);
        host.append(group);
      } else host.append(entry);
    }
  };
  build(null, tree);
  const query = $("#catalog-search").value.toLowerCase().trim(),
    categories = selectedCategory
      ? descendantCategories(selectedCategory)
      : null;
  const list = $("#family-list");
  list.replaceChildren();
  for (const item of data.families
    .filter((f) => active(f) && (!categories || categories.has(f.category_id)))
    .filter((f) => {
      if (!query) return true;
      const products = data.products.filter(
        (p) => p.family_id === f.id && active(p),
      );
      return [
        f.name,
        f.description,
        ...products.flatMap((p) => [
          p.name,
          p.manufacturer,
          p.mpn,
          ...Object.values(p.field_values),
        ]),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    })
    .sort((a, b) => a.name.localeCompare(b.name))) {
    const count = data.products.filter(
      (p) => p.family_id === item.id && !p.archived,
    ).length;
    const entry = listCard(
      "",
      () => changeSelection({ familyId: item.id }),
      "family-card" + (item.id === selectedFamily ? " is-selected" : ""),
    );
    entry.append(
      node("strong", item.name + (item.archived ? " (archived)" : "")),
      node(
        "small",
        (item.kind === "tool"
          ? "Tool · "
          : item.kind === "material"
            ? "Material · "
            : "") +
          count +
          " " +
          (count === 1 ? "product" : "products"),
      ),
    );
    list.append(entry);
  }
  if (!list.children.length)
    list.append(
      node("p", "No matching families. Add one or change the search.", "empty"),
    );
}
async function begin(entity, record) {
  if (!(await mayLeave())) return;
  if (draft?.entity === "product" && draft.record.id !== record.id)
    clearLookupDocuments(draft.record.id);
  editing = true;
  dirty = false;
  showUseFields = false;
  draft = {
    entity,
    record: copy(record),
    expectedRevision: record.revision ?? null,
    expectedFamilyRevision: family()?.revision,
  };
  renderDetail();
}
async function newFamily() {
  if (!(await mayLeave())) return;
  dirty = false;
  selectedFamily = "";
  selectedProduct = "";
  begin("family", {
    id: crypto.randomUUID(),
    category_id: selectedCategory || null,
    name: "",
    kind: "part",
    description: "",
    notes: "",
    fields: [],
  });
}
function newProduct() {
  begin("product", {
    id: crypto.randomUUID(),
    family_id: selectedFamily,
    name: "",
    manufacturer: "",
    mpn: "",
    supplier_links: [],
    field_values: {},
    notes: "",
  });
}
async function saveDraft(form) {
  if (!form.reportValidity()) return;
  if (draft.entity === "family") validateFamilyFields(draft.record.fields);
  if (draft.entity === "product")
    validateFamilyValues(familyFields(), draft.record.field_values);
  if (draft.entity === "product" && identityRequired(draft.record))
    requireLookupIdentity(draft.record);
  if (draft.entity === "product") await prepareLookupDocument(draft.record);
  const payload = copy(draft);
  status("Saving…");
  let result;
  if (
    draft.documentRetry &&
    draft.savedDocumentStamp === JSON.stringify(draft.record)
  )
    result = { record: copy(draft.record) };
  else result = await requestWorkshop("/api/workshop", "POST", payload);
  if (payload.entity === "product") {
    draft.expectedRevision = result.record.revision;
    draft.record.revision = result.record.revision;
    selectedProduct = result.record.id;
    updateLocation();
    draft.savedDocumentStamp = JSON.stringify(draft.record);
    try {
      if (await saveLookupDocument(result.record.id)) {
        const final = copy(draft.record);
        final.lookup_provenance.documentUpload.status = "saved";
        try {
          result = await requestWorkshop("/api/workshop", "POST", {
            entity: "product",
            record: final,
            expectedRevision: draft.expectedRevision,
            expectedFamilyRevision: draft.expectedFamilyRevision,
          });
        } catch (error) {
          const current = (
              await requestWorkshop("/api/workshop")
            ).products.find((p) => p.id === final.id),
            upload = current?.lookup_provenance?.documentUpload;
          if (
            upload?.status !== "saved" ||
            upload.id !== final.lookup_provenance.documentUpload.id ||
            upload.sha256 !== final.lookup_provenance.documentUpload.sha256
          )
            throw error;
          result = { record: current };
        }
        Object.assign(draft.record, result.record);
        draft.expectedRevision = result.record.revision;
      }
      clearLookupDocuments(result.record.id);
    } catch (error) {
      draft.documentRetry = true;
      renderDetail();
      if (error.status === 409)
        throw Error(
          "The product or template changed while the document was uploading. Reopen the product, then select the uploaded document to confirm completion. Your other edits were not overwritten.",
        );
      throw Error(
        error.message.startsWith("Product saved")
          ? error.message
          : "Product saved and the document upload completed, but its final status could not be saved. Retry document upload to confirm completion. " +
              error.message,
      );
    }
  }
  dirty = false;
  editing = false;
  draft = null;
  await refresh();
  if (payload.entity === "family") {
    selectedFamily = result.record.id;
    selectedProduct = "";
  }
  if (payload.entity === "product") {
    selectedProduct = result.record.id;
  }
  draft = null;
  updateLocation();
  renderNavigation();
  renderDetail();
  status(
    result.record.lookup_provenance?.documentUpload?.status === "pending"
      ? "Product saved; document upload remains unconfirmed. Reselect the document in Edit product to finish."
      : "Saved.",
  );
}
function editor(entity, title, record) {
  const header = node("div", "", "panel-heading");
  header.append(node("h2", title));
  detail.append(header);
  const form = node("form");
  form.onsubmit = (event) => {
    event.preventDefault();
    void run(() => saveDraft(form));
  };
  const set = (key, value) => {
    record[key] = value;
    mark();
  };
  if (entity === "family") renderFamilyEditor(form, record, set);
  if (entity === "product") renderProductEditor(form, record, set);
  const footer = actions(
    button(
      entity === "product" && draft.documentRetry
        ? "Retry document upload"
        : "Save " + entity,
      () => form.requestSubmit(),
      "button--primary",
    ),
    button("Cancel", async () => {
      if (!(await mayLeave())) return;
      if (draft?.entity === "product") clearLookupDocuments(draft.record.id);
      dirty = false;
      editing = false;
      draft = null;
      renderDetail();
    }),
  );
  footer.classList.add("form-actions");
  form.append(footer);
  detail.append(form);
  if (record.revision) renderAttachments(detail, entity, record.id, true);
  else header.append(help("Files & links", "saveBeforeFiles"));
}
function renderFamilyEditor(form, record, set) {
  const identity = panel("Family");
  identity.append(
    field("Family name", record.name, (value) => set("name", value), {
      required: true,
    }),
    field(
      "Category",
      record.category_id || "",
      (value) => set("category_id", value || null),
      {
        options: [
          { value: "", label: "Uncategorized" },
          ...data.categories
            .filter((c) => !c.archived)
            .map((c) => ({ value: c.id, label: categoryPath(c.id) })),
        ],
      },
    ),
    field("Kind", record.kind, (value) => set("kind", value), {
      options: [
        { value: "part", label: "Part" },
        { value: "material", label: "Material" },
        { value: "tool", label: "Tool" },
      ],
    }),
    field(
      "Description",
      record.description,
      (value) => set("description", value),
      { type: "textarea" },
    ),
    field("Notes", record.notes, (value) => set("notes", value), {
      type: "textarea",
    }),
  );
  form.append(identity);
  const definitions = panel("Family fields", "familyFields");
  const repaint = () => {
    renderDetail();
  };
  record.fields.forEach((definition, index) => {
    const row = node("fieldset", "", "field-definition");
    row.dataset.fieldId = definition.id;
    row.append(node("legend", definition.label || "New field"));
    if (definition.hidden) {
      row.append(
        node("p", "Hidden; stored values are retained.", "muted"),
        button("Restore field", () => {
          definition.hidden = 0;
          mark();
          repaint();
        }),
      );
      definitions.append(row);
      return;
    }
    const update = (key, value) => {
      definition[key] = value;
      mark();
    };
    row.append(
      field(
        "Field label",
        definition.label,
        (value) => update("label", value),
        { required: true },
      ),
      field("Unit", definition.unit, (value) => update("unit", value)),
      field(
        "Type",
        definition.type,
        (value) => {
          update("type", value);
          repaint();
        },
        {
          options: [
            { value: "text", label: "Text" },
            { value: "number", label: "Number" },
            { value: "choice", label: "Choice" },
            { value: "boolean", label: "Yes / No" },
          ],
        },
      ),
    );
    if (definition.type === "choice")
      row.append(
        field(
          "Choices, one per line",
          definition.choices.join("\n"),
          (value) =>
            update(
              "choices",
              value
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean),
            ),
          { type: "textarea" },
        ),
      );
    row.append(
      checkbox(
        "Usually filled in for a project",
        definition.filled_on_use,
        (value) => update("filled_on_use", value ? 1 : 0),
      ),
    );
    const move = (offset) => {
      const next = index + offset;
      if (next < 0 || next >= record.fields.length) return;
      [record.fields[index], record.fields[next]] = [
        record.fields[next],
        record.fields[index],
      ];
      mark();
      repaint();
    };
    row.append(
      actions(
        button("Move up", () => move(-1), "button--quiet"),
        button("Move down", () => move(1), "button--quiet"),
        button(
          "Hide field",
          () => {
            definition.hidden = 1;
            mark();
            repaint();
          },
          "button--quiet",
        ),
      ),
    );
    definitions.append(row);
  });
  definitions.append(
    button("Add field", () => {
      record.fields.push({
        id: crypto.randomUUID(),
        label: "New field",
        unit: "",
        type: "text",
        choices: [],
        hidden: 0,
        filled_on_use: 0,
      });
      mark();
      repaint();
    }),
  );
  form.append(definitions);
}
function renderProductEditor(form, record, set) {
  form.classList.add("workshop-product-editor", "ui-editor-fields");
  const identity = panel("Product identity");
  identity.append(
    field("Product name", record.name, (value) => set("name", value), {
      required: true,
    }),
    field("Manufacturer", record.manufacturer, (value) =>
      set("manufacturer", value),
    ),
    field("Manufacturer part number", record.mpn, (value) => set("mpn", value)),
  );
  form.append(
    identity,
    workshopProductLookup({
      record,
      family: family(),
      fields: familyFields(),
      showUseFields,
      onDocumentChange(change) {
        mark();
        if (change?.forgotten) {
          draft.documentRetry = false;
          renderDetail();
          status(
            "Unconfirmed document forgotten in draft. Save product to keep this change.",
          );
        }
      },
      documents: data.attachments.filter(
        (f) =>
          !f.archived &&
          f.product_id === record.id &&
          !f.url &&
          /\.(pdf|txt|csv|png|jpe?g|webp)$/i.test(f.title),
      ),
      onApply() {
        mark();
        renderDetail();
        status(
          "Suggestions applied to your draft. Review the values, then Save product.",
        );
      },
    }),
  );
  const specs = panel("Specifications");
  specs.append(
    checkbox(
      "Show fields usually filled in for a project",
      showUseFields,
      (value) => {
        showUseFields = value;
        renderDetail();
      },
    ),
    valuesEditor(familyFields(), record.field_values, mark, {
      product: true,
      showUseFields,
    }),
  );
  form.append(specs);
  const ordering = panel("Supplier links");
  record.supplier_links.forEach((supplier, index) => {
    const row = node("fieldset", "", "supplier-reference");
    row.append(node("legend", "Supplier " + (index + 1)));
    for (const [key, label] of [
      ["supplier", "Supplier"],
      ["part_number", "Supplier part number"],
      ["url", "Order URL"],
    ])
      row.append(
        field(
          label,
          supplier[key] || "",
          (value) => {
            supplier[key] = value;
            mark();
          },
          { type: key === "url" ? "url" : "text" },
        ),
      );
    row.append(
      button(
        "Remove supplier link",
        () => {
          record.supplier_links.splice(index, 1);
          mark();
          renderDetail();
        },
        "button--quiet",
      ),
    );
    ordering.append(row);
  });
  ordering.append(
    button("Add supplier link", () => {
      record.supplier_links.push({ supplier: "", part_number: "", url: "" });
      mark();
      renderDetail();
    }),
  );
  form.append(ordering);
  const notes = panel("Notes");
  notes.append(
    field("Notes", record.notes, (value) => set("notes", value), {
      type: "textarea",
    }),
  );
  form.append(notes);
}
function categoryPath(id) {
  const parts = [],
    seen = new Set();
  let current = data.categories.find((c) => c.id === id);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    parts.unshift(current.name);
    current = data.categories.find((c) => c.id === current.parent_id);
  }
  return parts.join(" / ");
}
function appendRead(host, label, value, options) {
  const row = readValue(label, value, options);
  if (row) host.append(row);
}
function renderDetail() {
  detail.replaceChildren();
  if (editing && draft) {
    editor(draft.entity, editLabel(draft.entity), draft.record);
    return;
  }
  const selected = family();
  if (!selected) return;
  const product = data.products.find((p) => p.id === selectedProduct);
  const entity = product ? "product" : "family",
    record = product || selected;
  const heading = node("div", "", "detail-heading");
  heading.append(
    node("p", categoryPath(selected.category_id), "eyebrow"),
    node("h2", product ? product.name : selected.name),
  );
  const edit = () => editOwner(entity, record);
  heading.append(
    actions(
      button(editLabel(entity), edit),
      button(
        record.archived ? "Restore " + entity : "Archive " + entity,
        () => void archive(entity, record),
        "button--quiet",
      ),
    ),
  );
  if (entity !== "family")
    heading.append(
      button(
        "Family: " + selected.name,
        () => changeSelection({ familyId: selectedFamily }),
        "button--quiet",
      ),
    );
  if (record.archived)
    heading.append(
      node(
        "p",
        "Archived. Existing project references and file bytes are retained.",
        "notice",
      ),
    );
  detail.append(heading);
  if (entity === "family") renderFamilyRead(selected);
  else renderInstanceRead(entity, record, selected, product);
}
function renderFamilyRead(record) {
  const familyDetails = window.BSUI.section({
    title: "Family and fields",
    role: "family-fields",
    count: familyFields().filter((f) => !f.hidden).length,
    countLabel: ["field", "fields"],
  });
  const intro = panel("About this family");
  appendRead(intro, "Kind", record.kind);
  appendRead(intro, "Description", record.description);
  appendRead(intro, "Notes", record.notes);
  familyDetails.body.append(intro);
  const fields = panel("Fields", "fieldValues");
  const table = dataTable("Family fields", ["Field", "Unit", "Type"]);
  for (const definition of familyFields().filter((f) => !f.hidden))
    table.append([
      definition.label +
        (definition.filled_on_use ? " · usually entered in project" : ""),
      definition.unit,
      definition.type,
    ]);
  fields.append(table.root);
  familyDetails.body.append(fields);
  detail.append(familyDetails.root);
  const related = panel("Products");
  const list = node("div", "", "product-list");
  for (const product of data.products.filter(
    (p) => p.family_id === record.id && active(p),
  ))
    list.append(
      button(
        product.name +
          (product.mpn ? " · " + product.mpn : "") +
          (product.archived ? " (archived)" : ""),
        () => changeSelection({ familyId: record.id, productId: product.id }),
      ),
    );
  if (!list.children.length)
    list.append(node("p", "No products yet.", "empty"));
  related.append(
    list,
    actions(button("Add product", newProduct, "button--primary")),
  );
  detail.append(related);
  detail.append(
    actions(
      button(
        "Duplicate family",
        () => {
          const duplicate = {
            ...copy(record),
            id: crypto.randomUUID(),
            name: record.name + " copy",
            fields: familyFields().map((field) => ({
              ...copy(field),
              id: crypto.randomUUID(),
            })),
          };
          delete duplicate.revision;
          begin("family", duplicate);
        },
        "button--quiet",
      ),
    ),
  );
  renderAttachments(detail, "family", record.id, false);
  renderWorkshopProjectUses(
    detail,
    data,
    record.id,
    null,
    $("#show-archived").checked,
  );
}
function renderInstanceRead(entity, record, selected) {
  const product = record,
    identity = panel("Product identity");
  appendRead(identity, "Manufacturer", record.manufacturer);
  appendRead(identity, "Manufacturer part number", record.mpn);
  detail.append(identity);
  if (product.lookup_provenance?.documentUpload?.status === "pending")
    detail.append(
      node(
        "p",
        "Product saved; document upload is unconfirmed. Edit product to finish or forget the unfinished upload.",
        "notice",
      ),
    );
  const specs = panel("Specifications");
  let count = 0;
  for (const resolved of resolveFamilyValues(
    familyFields(),
    product.field_values || {},
    {},
  )) {
    if (!present(resolved.value)) continue;
    count++;
    const row = readValue(
        resolved.label + (resolved.unit ? " (" + resolved.unit + ")" : ""),
        resolved.value,
      ),
      evidence = fieldLookupEvidence(product, resolved.id);
    if (evidence) row.lastChild.append(lookupEvidenceView(evidence));
    specs.append(row);
  }
  if (count) detail.append(specs);
  if (record.supplier_links.length) {
    const suppliers = panel("Supplier links");
    for (const supplier of record.supplier_links) {
      appendRead(suppliers, "Supplier", supplier.supplier);
      appendRead(suppliers, "Supplier part number", supplier.part_number);
      appendRead(suppliers, "Order URL", supplier.url, { url: true });
    }
    detail.append(suppliers);
  }
  if (record.notes) {
    const notes = panel("Notes");
    notes.append(node("p", record.notes, "notes"));
    detail.append(notes);
  }
  renderAttachments(detail, "product", record.id, false);
  renderWorkshopProjectUses(
    detail,
    data,
    selected.id,
    record.id,
    $("#show-archived").checked,
  );
}

async function archive(entity, record) {
  const confirmed =
    entity === "family" && !record.archived
      ? await window.BSDialogs.confirm(
          "This hides the family and all products within it from the active Workshop. Their data, attached files, and existing project records are kept.\n\nTo bring them back, enable Show archived, select the family, and choose Restore family. Products archived separately will remain archived.\n\nNothing is permanently deleted.",
          {
            title: "Archive “" + record.name + "”?",
            confirmLabel: "Archive family",
          },
        )
      : await window.BSDialogs.confirm(
          record.archived
            ? "Restore this " +
                entity +
                " to the active Workshop? Products archived separately will remain archived."
            : "This hides this product from the active Workshop. Its specifications, attached files, and existing project records are kept.\n\nTo bring it back, enable Show archived, select the product, and choose Restore product.\n\nNothing is permanently deleted.",
          {
            title:
              (record.archived ? "Restore" : "Archive") +
              " “" +
              record.name +
              "”?",
            confirmLabel: (record.archived ? "Restore " : "Archive ") + entity,
          },
        );
  if (!confirmed) return;
  await run(async () => {
    await requestWorkshop("/api/workshop", "PATCH", {
      entity,
      id: record.id,
      expectedRevision: record.revision,
      archived: !record.archived,
    });
    await refresh();
    renderDetail();
    status(
      record.archived
        ? "Restored."
        : "Archived. You can restore it using Show archived.",
    );
  });
}
function showCategoryMenu(x, y) {
  const menu = $("#category-menu");
  menu.replaceChildren();
  for (const [label, action] of [
    ["Add family", newFamily],
    ["Add subcategory", () => categoryDialog(false)],
    ["Rename category", () => categoryDialog(true)],
  ]) {
    const entry = button(
      label,
      () => {
        menu.hidden = true;
        action();
      },
      "button--quiet",
    );
    entry.setAttribute("role", "menuitem");
    menu.append(entry);
  }
  menu.hidden = false;
  menu.style.left = Math.min(x, window.innerWidth - 220) + "px";
  menu.style.top = Math.min(y, window.innerHeight - 180) + "px";
  menu.querySelector("button").focus();
}
function categoryDialog(rename = false) {
  const old = rename
    ? data.categories.find((c) => c.id === selectedCategory)
    : null;
  if (rename && !old) {
    status("Select a category to rename.", true);
    return;
  }
  dialog.replaceChildren(node("h2", rename ? "Edit category" : "Add category"));
  const record = old
    ? copy(old)
    : {
        id: crypto.randomUUID(),
        name: "",
        parent_id: selectedCategory || null,
        sort_order: 0,
      };
  const form = node("form");
  form.append(
    field(
      "Category name",
      record.name,
      (value) => {
        record.name = value;
      },
      { required: true },
    ),
    field(
      "Parent category",
      record.parent_id || "",
      (value) => {
        record.parent_id = value || null;
      },
      {
        options: [
          { value: "", label: "Top level" },
          ...data.categories
            .filter((c) => !c.archived && c.id !== record.id)
            .map((c) => ({ value: c.id, label: categoryPath(c.id) })),
        ],
      },
    ),
  );
  const error = node("p", "", "error");
  error.setAttribute("role", "alert");
  form.append(
    error,
    actions(
      button("Save category", () => form.requestSubmit(), "button--primary"),
      button("Cancel", () => dialog.close()),
    ),
  );
  form.onsubmit = async (event) => {
    event.preventDefault();
    try {
      await requestWorkshop("/api/workshop", "POST", {
        entity: "category",
        record,
        expectedRevision: old?.revision ?? null,
      });
      await refresh();
      dialog.close();
      status("Category saved.");
    } catch (problem) {
      error.textContent = problem.message;
    }
  };
  if (old)
    form.append(
      button(
        old.archived ? "Restore category" : "Archive category",
        () => {
          dialog.close();
          void archive("category", old);
        },
        "button--quiet",
      ),
    );
  dialog.append(form);
  dialog.showModal();
}
function editOwner(entity, record) {
  const next = copy(record);
  if (entity === "family") next.fields = copy(familyFields());
  begin(entity, next);
}
function renderAttachments(host, ownerType, ownerId, canEdit) {
  const files = data.attachments.filter(
    (file) => !file.archived && file[ownerType + "_id"] === ownerId,
  );
  if (!files.length && !canEdit) return;
  const section = panel("Files & links"),
    list = node("ul", "", "attachment-list");
  for (const file of files) {
    const row = node("li"),
      link = node("a", file.title);
    link.href = file.url || "/api/workshop/file?id=" + file.id;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    row.append(link);
    let image;
    if (file.kind === "photo") {
      image = node("img", "", "photo-thumb");
      image.src = link.href;
      image.alt = file.title;
      row.prepend(image);
    }
    if (canEdit) {
      const archiveButton = button(
        "Archive reference",
        () =>
          void run(async () => {
            await requestWorkshop("/api/workshop", "PATCH", {
              entity: "attachment",
              id: file.id,
              expectedRevision: file.revision,
              archived: true,
            });
            await refresh();
            renderDetail();
          }),
        "button--quiet",
      );
      if (image) actionBar(image, { content: archiveButton });
      else row.append(archiveButton);
    } else if (image) {
      const owner = (
        ownerType === "family"
          ? data.families
          : ownerType === "product"
            ? data.products
            : data.uses
      ).find((record) => record.id === ownerId);
      if (owner)
        actionBar(image, {
          content: button(editLabel(ownerType), () =>
            editOwner(ownerType, owner),
          ),
        });
    }
    list.append(row);
  }
  section.append(list);
  if (canEdit) {
    const fileInput = node("input");
    fileInput.type = "file";
    fileInput.multiple = true;
    fileInput.hidden = true;
    fileInput.accept =
      "image/*,.pdf,.dwg,.dxf,.sldprt,.sldasm,.step,.stp,.stl,.iges,.igs,.zip,.csv,.txt";
    fileInput.onchange = () =>
      void run(async () => {
        for (const file of fileInput.files) {
          status("Uploading " + file.name + "…");
          const response = await fetch(
            "/api/workshop/file?owner=" +
              ownerType +
              "&id=" +
              encodeURIComponent(ownerId),
            {
              method: "POST",
              credentials: "same-origin",
              headers: { "x-file-name": encodeURIComponent(file.name) },
              body: file,
            },
          );
          const value = await response.json();
          if (!response.ok) throw Error(value.error || "Upload failed");
        }
        await refresh();
        renderDetail();
        status("Files uploaded.");
      });
    section.append(
      actions(
        button("Upload files", () => fileInput.click()),
        button("Add link", () => attachmentDialog(ownerType, ownerId)),
      ),
      fileInput,
    );
  }
  host.append(section);
}
function attachmentDialog(ownerType, ownerId) {
  dialog.replaceChildren(node("h2", "Add reference link"));
  const record = {
    id: crypto.randomUUID(),
    owner_type: ownerType,
    owner_id: ownerId,
    title: "",
    url: "",
    kind: "document",
  };
  const form = node("form");
  form.append(
    field(
      "Title",
      "",
      (value) => {
        record.title = value;
      },
      { required: true },
    ),
    field(
      "Link",
      "",
      (value) => {
        record.url = value;
      },
      { type: "url", required: true },
    ),
    field(
      "Purpose",
      record.kind,
      (value) => {
        record.kind = value;
      },
      {
        options: [
          "document",
          "datasheet",
          "pinout",
          "photo",
          "cad",
          "manual",
          "other",
        ].map((value) => ({ value, label: value })),
      },
    ),
  );
  const error = node("p", "", "error");
  error.setAttribute("role", "alert");
  form.append(
    error,
    actions(
      button("Save reference", () => form.requestSubmit(), "button--primary"),
      button("Cancel", () => dialog.close()),
    ),
  );
  form.onsubmit = async (event) => {
    event.preventDefault();
    try {
      await requestWorkshop("/api/workshop", "POST", {
        entity: "attachment",
        record,
        expectedRevision: null,
      });
      await refresh();
      dialog.close();
      renderDetail();
    } catch (problem) {
      error.textContent = problem.message;
    }
  };
  dialog.append(form);
  dialog.showModal();
}
$("#add-family").onclick = newFamily;
$("#catalog-search").oninput = renderNavigation;
$("#show-archived").onchange = () => {
  renderNavigation();
  renderDetail();
};
$("#category-actions").onclick = (event) => {
  const box = event.currentTarget.getBoundingClientRect();
  showCategoryMenu(box.left, box.bottom);
};
document.addEventListener("click", (event) => {
  if (!event.target.closest("#category-menu,#category-actions"))
    $("#category-menu").hidden = true;
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") $("#category-menu").hidden = true;
});
$("#export-workshop").onclick = () => {
  location.href = "/api/workshop/export";
};
projectReturnLink(params);
window.addEventListener("beforeunload", (event) => {
  if (dirty) {
    event.preventDefault();
    event.returnValue = "";
  }
});
try {
  await refresh();
  selectedFamily = params.get("family") || "";
  selectedProduct = params.get("product") || "";
  const product = data.products.find(
    (product) => product.id === selectedProduct,
  );
  if (product) selectedFamily = product.family_id;
  renderNavigation();
  renderDetail();
  await initProjectProductCopy({
    params,
    data,
    detail,
    status,
    onDraft(familyId, record) {
      selectedFamily = familyId;
      selectedProduct = "";
      begin("product", record);
      dirty = true;
      status(
        "Review the copied product, then Save product. The project part is unchanged.",
      );
    },
  });
} catch (error) {
  const failure = panel("Workshop unavailable");
  failure.append(node("p", error.message, "error"));
  detail.replaceChildren(
    failure,
    button("Try again", () => location.reload()),
  );
  const signIn = node("a", "Open Projects to sign in");
  signIn.href = "/project.html";
  detail.append(signIn);
  status(error.message, true);
}
