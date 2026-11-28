import {
  node,
  button,
  actions,
  panel,
  field,
  checkbox,
  requestWorkshop,
} from "./workshop-ui.js?v=save-upload-20261128";

// Only current project identity/specifications enter a reviewed catalog draft.
// Project numbers, purpose, quantities, instructions and history stay separate.
export function productCopyDraft(item, familyId, id = crypto.randomUUID()) {
  if (!item || item.kind !== "part" || item.is_assembly)
    throw Error("Choose a project-only off-the-shelf part to copy.");
  const fields = item.fields || {},
    specifications = (fields.specs || []).map(
      (spec) =>
        String(spec.label || "Specification") +
        ": " +
        String(spec.value ?? "") +
        (spec.unit ? " " + spec.unit : ""),
    );
  return {
    id,
    family_id: familyId,
    name: fields.mpn || item.name,
    manufacturer: fields.manufacturer || "",
    mpn: fields.mpn || "",
    supplier_links: [],
    field_values: {},
    notes: specifications.length
      ? "Copied specifications — review and enter applicable family fields:\n" +
        specifications.join("\n")
      : "",
  };
}
export function matchingProduct(products, record) {
  const key = (value) =>
    String(value || "")
      .trim()
      .toLowerCase();
  if (!key(record.mpn)) return null;
  return (
    products.find(
      (product) =>
        !product.archived &&
        product.family_id === record.family_id &&
        key(product.mpn) === key(record.mpn) &&
        (!key(product.manufacturer) ||
          !key(record.manufacturer) ||
          key(product.manufacturer) === key(record.manufacturer)),
    ) || null
  );
}
export async function initProjectProductCopy({
  params,
  data,
  detail,
  status,
  onDraft,
}) {
  const project = params.get("copyEngineProject"),
    partId = params.get("copyPart");
  if (!project || !partId) return;
  try {
    const response = await requestWorkshop(
      "/api/project-engine/projects/" + encodeURIComponent(project) + "/state",
    );
    if (response.selections?.some((selection) => selection.id === partId))
      throw Error(
        "This part already has a Workshop selection. Open its existing Workshop product instead.",
      );
    const part = response.items?.find((item) => item.id === partId);
    if (!part)
      throw Error(
        "The source project part was not found. Return to the project and try again.",
      );
    productCopyDraft(part, "");
    const families = data.families.filter((family) => !family.archived);
    const section = panel("Copy project part to Workshop", "projectCopy");
    detail.replaceChildren(section);
    if (!families.length) {
      section.append(
        node(
          "p",
          "Add a family first, then return to the project and choose Copy to Workshop again.",
          "muted",
        ),
      );
      return;
    }
    let familyId = "",
      confirmed = false;
    const choice = field(
      "Workshop family",
      "",
      (value) => {
        familyId = value;
        message.replaceChildren();
      },
      {
        options: [
          { value: "", label: "Choose a family" },
          ...families
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((family) => ({ value: family.id, label: family.name })),
        ],
      },
    );
    const message = node("div");
    message.setAttribute("role", "status");
    const next = button(
      "Review product copy",
      () => {
        if (!confirmed) {
          message.textContent =
            "Confirm that this is an off-the-shelf product before copying it.";
          return;
        }
        if (!familyId) {
          message.textContent = "Choose a Workshop family.";
          choice.querySelector("select").focus();
          return;
        }
        const draft = productCopyDraft(part, familyId),
          match = matchingProduct(data.products, draft);
        if (match) {
          const link = node("a", "Open existing product", "button");
          const query = new URLSearchParams({ product: match.id });
          if (params.get("return")) query.set("return", params.get("return"));
          if (params.get("returnProject"))
            query.set("returnProject", params.get("returnProject"));
          link.href = "workshop.html?" + query;
          message.replaceChildren(
            node(
              "p",
              "A product with this manufacturer part number already exists in this family. Review it before creating another copy.",
            ),
            actions(
              link,
              button(
                "Create another copy",
                () => onDraft(familyId, draft),
                "button--quiet",
              ),
            ),
          );
          return;
        }
        onDraft(familyId, draft);
      },
      "button--primary",
    );
    section.append(
      node(
        "p",
        "Copy physical product identity and specifications into a reviewed draft. Project quantity, purpose, instructions, records and history stay in the project.",
      ),
    );
    section.append(
      checkbox(
        "This is an off-the-shelf product",
        false,
        (value) => (confirmed = value),
      ),
    );
    section.append(choice, actions(next), message);
    status("Choose a family for the product copy.");
  } catch (error) {
    status("Could not copy project part: " + error.message, true);
  }
}
