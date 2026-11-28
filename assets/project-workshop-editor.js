import { lookupEvidenceView } from "./workshop-lookup-evidence-view.js";
import {
  node,
  field,
  actions,
  valuesEditor,
} from "./workshop-ui.js?v=save-upload-20261128";
import {
  editable,
  parentPicker,
} from "./project-editors.js?v=project-numbers-20261128";
import { partHistoryPrompt } from "./project-part-history.js";
import { information } from "./project-information.js?v=cad-links-20261128";
import { present } from "./family-model.js";
import { isWebUrl } from "./family-model.js";
const button = (...args) => window.BSUI.button(...args);
export function workshopPartEditor(ctx, { item = null, parentId = null } = {}) {
  const previous = item
      ? ctx.client.state.selections.find((row) => row.id === item.id)
      : null,
    draft = {
      name: item?.name || "",
      purpose: item?.fields.purpose || "",
      parentId,
      requirements: structuredClone(previous?.requirements || {}),
      selection: {
        familyId: previous?.family_id || "",
        productId: previous?.product_id || null,
        expectedFamilyRevision: null,
        expectedProductRevision: null,
      },
    };
  let catalog = { families: [], products: [], fields: [] },
    query = "",
    productQuery = "",
    generation = 0,
    editedName = !!item;
  const choose = node("div"),
    requirements = node("div"),
    preview = node("div"),
    feedback = node("p");
  feedback.setAttribute("role", "status");
  const editor = editable(
    ctx,
    item ? "Change Workshop selection" : "Add Workshop part",
    item ? "Save as revision" : "Add to project",
    () => {
      if (
        !catalog.families.some((row) => row.id === draft.selection.familyId) ||
        (draft.selection.productId &&
          !catalog.products.some((row) => row.id === draft.selection.productId))
      )
        throw Error(
          "Choose an available Workshop family/product, or explicitly choose Generic family.",
        );
      return structuredClone(draft);
    },
    async (data, token) => {
      if (!data.selection.familyId) throw Error("Choose a Workshop family.");
      await ctx.client.write(
        ctx.projectId,
        "/workshop-items",
        "POST",
        data,
        token,
      );
    },
  );
  editor.fields.append(
    node(
      "p",
      item
        ? "Reloading or changing the selected product saves the previous complete part in revision history. Project requirements remain; product specifications and copied documents are refreshed. The Workshop original is unchanged."
        : "This creates a project-owned part with frozen Workshop specifications and copies of its documents/photos. Further edits affect this project only.",
    ),
  );
  const name = field("Part Name (Specific)", draft.name, (value) => {
    draft.name = value;
    editedName = true;
  });
  editor.fields.append(
    ...(!item
      ? [
          field("Find Workshop parts", query, (value) => (query = value), {
            type: "search",
          }),
          button("Find parts", () => void loadChoices()),
        ]
      : []),
    actions(button("Refresh Workshop choices", () => void loadFamily())),
    choose,
    name,
    field(
      "Purpose in this project",
      draft.purpose,
      (value) => (draft.purpose = value),
      { type: "textarea" },
    ),
  );
  if (!item)
    editor.fields.append(
      parentPicker(ctx, draft.parentId, (value) => (draft.parentId = value)),
    );
  editor.fields.append(requirements, preview, feedback);
  function renderValues() {
    const family = catalog.families.find(
        (row) => row.id === draft.selection.familyId,
      ),
      product = catalog.products.find(
        (row) => row.id === draft.selection.productId,
      );
    if (!family) return;
    draft.selection.expectedFamilyRevision = family.revision;
    draft.selection.expectedProductRevision = product?.revision ?? null;
    if (!editedName) {
      draft.name = product?.name || family.name;
      name.querySelector("input").value = draft.name;
    }
    const rows = catalog.fields.filter((row) => !row.hidden),
      values = product?.field_values || {};
    const contracts = rows.filter((row) => {
      const old = previous?.snapshot.fields.find(
        (field) => field.id === row.id,
      );
      return (
        old &&
        (old.unit !== row.unit || old.type !== row.type) &&
        present(draft.requirements[row.id])
      );
    });
    requirements.replaceChildren(
      ...contracts.map((row) =>
        node(
          "p",
          row.label +
            " changed type or unit in Workshop. Clear its old requirement before reloading. No value is converted automatically.",
          "error",
        ),
      ),
      node("h3", "Project requirements"),
      node(
        "p",
        "Requirements stay separate from the selected product. Different values require your engineering review.",
      ),
      valuesEditor(rows, draft.requirements, () => {}, {
        productValues: values,
      }),
    );
    preview.replaceChildren(
      information("Selected Workshop source", [
        ["Family", family.name],
        ["Product", product?.name || "Generic family — no product selected"],
        ["Manufacturer", product?.manufacturer],
        ["Manufacturer part number", product?.mpn],
        ...rows
          .filter((row) => present(values[row.id]))
          .map((row) => [
            row.label,
            String(values[row.id]) + (row.unit ? " " + row.unit : ""),
          ]),
      ]),
    );
  }
  function familyPicker() {
    choose.replaceChildren(
      field(
        "Workshop family",
        draft.selection.familyId,
        (value) => {
          draft.selection.familyId = value;
          draft.selection.productId = null;
          draft.requirements = {};
          void loadFamily();
        },
        {
          options: [
            { value: "", label: "Choose a family" },
            ...catalog.families.map((row) => ({
              value: row.id,
              label: row.name,
            })),
          ],
        },
      ),
    );
    choose.querySelector("select").disabled = !!item;
    if (draft.selection.familyId)
      choose.append(
        field(
          "Find products in this family",
          productQuery,
          (value) => (productQuery = value),
          { type: "search" },
        ),
        button("Find products", () => void loadFamily()),
        field(
          "Workshop product",
          draft.selection.productId || "",
          (value) => {
            draft.selection.productId = value || null;
            renderValues();
          },
          {
            options: [
              { value: "", label: "Generic family — no product selected" },
              ...(draft.selection.productId &&
              !catalog.products.some(
                (row) => row.id === draft.selection.productId,
              )
                ? [
                    {
                      value: draft.selection.productId,
                      label:
                        "Previous product unavailable in these results — choose a product",
                    },
                  ]
                : []),
              ...catalog.products
                .filter((row) => row.family_id === draft.selection.familyId)
                .map((row) => ({
                  value: row.id,
                  label: row.name + (row.mpn ? " · " + row.mpn : ""),
                })),
            ],
          },
        ),
      );
  }
  async function loadChoices() {
    const turn = ++generation;
    editor.saveButton.disabled = true;
    feedback.textContent = "Loading Workshop choices…";
    try {
      const result = await ctx.client.request(
        "/" + ctx.projectId + "/catalog?" + new URLSearchParams({ q: query }),
      );
      if (turn !== generation) return;
      catalog = result;
      draft.selection.familyId = "";
      draft.selection.productId = null;
      choose.replaceChildren();
      requirements.replaceChildren();
      preview.replaceChildren();
      familyPicker();
      feedback.textContent = result.more
        ? "More matches are available. Refine your search."
        : catalog.families.length
          ? "Choose a family and optional product."
          : "No matching Workshop families. Add a family in Workshop first.";
    } catch (error) {
      feedback.textContent = error.message;
    } finally {
      if (turn === generation) editor.saveButton.disabled = false;
    }
  }
  async function loadFamily() {
    if (!draft.selection.familyId) return;
    const turn = ++generation;
    editor.saveButton.disabled = true;
    feedback.textContent = "Loading source specifications…";
    try {
      const result = await ctx.client.request(
        "/" +
          ctx.projectId +
          "/catalog?" +
          new URLSearchParams({
            family: draft.selection.familyId,
            q: productQuery,
          }),
      );
      if (turn !== generation) return;
      catalog = result;
      if (!catalog.families.length)
        throw Error("This Workshop family is archived or unavailable.");
      familyPicker();
      renderValues();
      feedback.textContent =
        draft.selection.productId &&
        !catalog.products.some((row) => row.id === draft.selection.productId)
          ? "The previous product is not available in these results. Refine the product search or explicitly choose a replacement."
          : result.more
            ? "More products exist. Use Find products to narrow the choices."
            : "Review the copied specifications and project requirements before saving.";
    } catch (error) {
      feedback.textContent = error.message;
    } finally {
      if (turn === generation) editor.saveButton.disabled = false;
    }
  }
  if (item) {
    const submit = (event) => {
      event.preventDefault();
      if (!editor.form.reportValidity() || editor.saveButton.disabled) return;
      const data = structuredClone(draft);
      data.occurrenceId = ctx.occurrenceId;
      partHistoryPrompt(ctx, item, editor.saveButton, {
        changes: data,
        path: "/items/" + item.id + "/selection",
        expectedRevision: editor.revision,
        onOwnUpload: (token) => editor.acceptOwnWrites(token),
        onComplete: () => ctx.dialog.close(),
      });
    };
    editor.form.onsubmit = submit;
    editor.saveButton.onclick = () => editor.form.requestSubmit();
    void loadFamily();
  } else void loadChoices();
  return editor;
}
export function workshopSourceView(ctx, item) {
  const selection = ctx.client.state.selections.find(
    (row) => row.id === item.id,
  );
  if (!selection) return null;
  const frozen = selection.snapshot,
    section = window.BSUI.section({
      title: "Workshop source",
      role: "workshop-source",
    });
  section.body.append(
    node(
      "p",
      "These source values and copied files belong to this project. Workshop changes do not update this part automatically.",
    ),
    information("Selected source", [
      ["Family", frozen.family.name],
      ["Family revision", selection.family_revision],
      ["Product", frozen.product?.name || "Generic family"],
      ["Product source revision", selection.product_revision],
    ]),
  );
  const link = node("a", "View in Workshop", "ui-button"),
    url = new URL("workshop.html", location.href);
  url.searchParams.set("family", selection.family_id);
  if (selection.product_id)
    url.searchParams.set("product", selection.product_id);
  url.searchParams.set("returnProject", location.pathname + location.search);
  link.href = url.href;
  section.body.append(link);
  for (const row of frozen.fields) {
    const value = selection.requirements[row.id];
    if (present(value))
      section.body.append(
        information("Project requirement", [
          [row.label, String(value) + (row.unit ? " " + row.unit : "")],
          [
            "Review",
            row.different ? "Different from the selected product value" : null,
          ],
        ]),
      );
  }
  for (const row of frozen.fields)
    if (row.evidence) {
      const group = node("div");
      group.append(
        node("strong", row.label),
        lookupEvidenceView(row.evidence, {
          documentUrl: row.evidence.document?.fileId
            ? "/api/project-engine/projects/" +
              ctx.projectId +
              "/files/" +
              row.evidence.document.fileId
            : undefined,
        }),
      );
      section.body.append(group);
    }
  for (const document of frozen.documents || []) {
    const file = document.file_id
      ? ctx.client.state.files.find((row) => row.id === document.file_id)
      : null;
    if (file) {
      const a = node("a", document.title);
      a.href =
        "/api/project-engine/projects/" + ctx.projectId + "/files/" + file.id;
      section.body.append(a);
      if (
        document.kind === "photo" &&
        /^image\/(png|jpeg|gif|webp|avif)$/.test(file.content_type)
      ) {
        const image = node("img", "", "project-picture");
        image.alt = document.title;
        image.src = a.href + "?inline=1";
        section.body.append(image);
      }
    } else if (isWebUrl(document.url)) {
      const a = node("a", document.title);
      a.href = document.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      section.body.append(a);
    }
  }
  for (const supplier of frozen.product?.supplier_links || [])
    if (isWebUrl(supplier.url)) {
      const a = node("a", supplier.supplier || "Order website");
      a.href = supplier.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      section.body.append(a);
    }
  return section.root;
}
