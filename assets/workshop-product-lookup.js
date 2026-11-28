import {
  lookupDocument,
  documentPayload,
  lookupDocumentField,
} from "./workshop-lookup-documents.js";
import { requireLookupIdentity } from "./workshop-lookup-provenance.js";
import {
  node,
  button,
  actions,
  panel,
  field,
  checkbox,
} from "./workshop-ui.js?v=save-upload-20261128";
import { present, isWebUrl, validateFamilyValues } from "./family-model.js";
import { dataTable } from "./data-table.js";
export function workshopProductLookup({
  record,
  family,
  fields,
  onApply,
  onDocumentChange = () => {},
  documents = [],
}) {
  const root = panel("Find product specs with AI"),
    message = node("p", "", "muted"),
    results = node("div");
  root.classList.add("workshop-lookup");
  root
    .querySelector(".panel-heading")
    .append(
      window.BSDialogs.helpButton(
        "About AI product lookup",
        "AI searches this product’s existing attachments automatically, along with its name, manufacturer and part number. Add a document below to include another source. Enter a search hint to guide the search. PDF, text, CSV and images are supported, up to 5 MB each (10 documents and 20 MB total). Review suggestions before applying them.",
      ),
    );
  message.setAttribute("role", "status");
  let hint = "",
    searching = false;
  const visible = fields.filter((f) => !f.hidden);
  const search = button("Find with AI", async () => {
    if (searching || !hint.trim()) return;
    if (!record.mpn.trim() && !record.name.trim()) {
      message.textContent =
        "Enter a product name or manufacturer part number first.";
      return;
    }
    const stamp = JSON.stringify(record),
      submittedHint = hint,
      documentTag = lookupDocument(record.id)?.tag;
    searching = true;
    search.disabled = true;
    results.replaceChildren();
    message.textContent = "Looking up product details…";
    try {
      const response = await fetch("/api/workshop-lookup", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          partNumber: record.mpn,
          manufacturer: record.manufacturer,
          partName: record.name || family.name,
          searchHint: hint,
          familyId: family.id,
          expectedFamilyRevision: family.revision,
          templateFieldIds: visible.map((f) => f.id),
          productId: record.id,
          document: await documentPayload(record.id),
        }),
      });
      const data = await response.json();
      if (!root.isConnected) return;
      const cost = Number.isFinite(data.lookupUsage?.estimatedUsd)
        ? " Estimated API cost: $" +
          data.lookupUsage.estimatedUsd.toFixed(4) +
          "."
        : "";
      if (!response.ok)
        throw Error((data.error || "Product lookup failed. Try again.") + cost);
      if (
        JSON.stringify(record) !== stamp ||
        hint !== submittedHint ||
        lookupDocument(record.id)?.tag !== documentTag
      ) {
        message.textContent =
          "Product details changed during lookup. Search again using the current details." +
          cost;
        return;
      }
      if (
        data.contract !== "workshop-template-v1" ||
        data.template?.id !== family.id ||
        data.template.revision !== family.revision ||
        !Array.isArray(data.fields) ||
        data.fields.some((row) => !visible.some((f) => f.id === row.fieldId))
      )
        throw Error(
          "The lookup did not return the current template contract. Refresh the template and try again.",
        );
      message.textContent =
        "Review the exact product, values, sources and test conditions. Nothing has been saved." +
        cost;
      review(data, stamp, documentTag);
    } catch (error) {
      if (root.isConnected) message.textContent = error.message;
    } finally {
      searching = false;
      search.disabled = !hint.trim();
    }
  });
  root.append(
    node(
      "p",
      "Uses product details and existing attachments automatically.",
      "muted",
    ),
    field(
      "Search hint",
      "",
      (value) => {
        hint = value;
        search.disabled = searching || !hint.trim();
      },
      {
        placeholder: "Product page or datasheet URL",
      },
    ),
    lookupDocumentField(record.id, onDocumentChange, documents, record),
    actions(search),
    node(
      "p",
      "Review suggestions before applying them to this draft.",
      "muted",
    ),
    message,
    results,
  );
  search.disabled = true;
  root.querySelector(".field-row input").setAttribute("aria-required", "true");
  function review(data, stamp, documentTag) {
    const proposed = data.identity,
      identity = [];
    if (!proposed) {
      message.textContent = "The lookup did not return product identity.";
      return;
    }
    let supplierSelected = !record.supplier_links.some((v) => isWebUrl(v.url));
    if (proposed.supplierUrl && isWebUrl(proposed.supplierUrl))
      results.append(
        checkbox(
          "Supplier URL: " + proposed.supplierUrl,
          supplierSelected,
          (v) => (supplierSelected = v),
        ),
      );
    for (const [key, source, label] of [
      ["name", "name", "Product name"],
      ["manufacturer", "manufacturer", "Manufacturer"],
      ["mpn", "partNumber", "Manufacturer part number"],
    ]) {
      const value = proposed[source];
      if (typeof value !== "string" || !value || value === record[key])
        continue;
      const choice = { key, value, selected: !present(record[key]) };
      identity.push(choice);
      results.append(
        checkbox(
          label +
            ": " +
            value +
            (present(record[key]) ? " (replaces “" + record[key] + "”)" : ""),
          choice.selected,
          (value) => (choice.selected = value),
        ),
      );
    }
    if (data.caution) results.append(node("p", data.caution, "notice"));
    const table = dataTable("AI specification suggestions", [
        "Suggested specification",
        "Use in field",
        "Current value",
      ]),
      mappings = [];
    for (const spec of data.fields) {
      const f = visible.find((f) => f.id === spec.fieldId);
      const mapping = {
        spec,
        id:
          !present(record.field_values[f.id]) &&
          data.fields.filter((s) => s.fieldId === f.id).length === 1
            ? f.id
            : "",
      };
      mappings.push(mapping);
      const suggestion = node("div");
      suggestion.append(
        node("strong", f.label),
        node("p", String(spec.value) + (f.unit ? " " + f.unit : "")),
      );
      if (spec.conditions)
        suggestion.append(node("small", "Conditions: " + spec.conditions));
      if (spec.sourceUrl) {
        const link = node("a", "Source");
        link.href = spec.sourceUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        suggestion.append(link);
      }
      if (spec.document)
        suggestion.append(node("small", "Document: " + spec.document.name));
      const picker = field(
        "Destination for " + f.label,
        mapping.id,
        (value) => (mapping.id = value),
        {
          options: [
            { value: "", label: "Do not apply" },
            {
              value: f.id,
              label: f.label + (f.unit ? " (" + f.unit + ")" : ""),
            },
          ],
        },
      );
      table.append([
        suggestion,
        Object.assign(picker.querySelector("select"), {
          ariaLabel: "Destination for " + f.label,
        }),
        node(
          "span",
          present(record.field_values[f.id])
            ? String(record.field_values[f.id])
            : "Empty",
        ),
      ]);
    }
    if (mappings.length) results.append(table.root);
    else
      results.append(
        node(
          "p",
          "No sourced values matching this template were found. Unsupported values are left empty.",
        ),
      );
    const apply = button(
      "Apply selected suggestions",
      () => {
        if (
          JSON.stringify(record) !== stamp ||
          lookupDocument(record.id)?.tag !== documentTag
        ) {
          message.textContent =
            "Product details changed since lookup, or the source document changed. Search again before applying suggestions.";
          return;
        }
        const next = structuredClone(record),
          destinations = new Set(),
          provenance = structuredClone(
            record.lookup_provenance || { version: 1, fields: {} },
          );
        provenance.identityRequired = true;
        provenance.appliedAt = new Date().toISOString();
        provenance.fields ||= {};
        for (const mapping of mappings) {
          if (!mapping.id) continue;
          if (destinations.has(mapping.id)) {
            message.textContent =
              "Choose only one suggestion for each destination field.";
            return;
          }
          destinations.add(mapping.id);
          const spec = mapping.spec;
          next.field_values[mapping.id] = spec.value;
          const document = spec.document
            ? {
                ...spec.document,
                id:
                  spec.document.id ||
                  lookupDocument(record.id)?.savedId ||
                  lookupDocument(record.id)?.uploadId,
              }
            : null;
          provenance.fields[mapping.id] = {
            value: spec.value,
            label: spec.label,
            unit: spec.unit,
            conditions: spec.conditions || "",
            sourceUrl: spec.sourceUrl || "",
            document,
          };
        }
        for (const choice of identity)
          if (choice.selected) next[choice.key] = choice.value;
        if (
          supplierSelected &&
          proposed.supplierUrl &&
          isWebUrl(proposed.supplierUrl) &&
          !next.supplier_links.some((v) => v.url === proposed.supplierUrl)
        )
          next.supplier_links.push({
            supplier: proposed.supplier || "",
            part_number: proposed.supplierPartNumber || "",
            url: proposed.supplierUrl,
          });
        try {
          requireLookupIdentity(next);
          validateFamilyValues(fields, next.field_values);
        } catch (error) {
          message.textContent = error.message;
          return;
        }
        next.lookup_provenance = provenance;
        Object.assign(record, next);
        onApply();
      },
      "button--primary",
    );
    results.append(
      node(
        "p",
        "Only the identified template field can receive each value. Units are not converted. Choosing a filled field replaces its value; sources and conditions are saved separately with that exact value.",
        "muted",
      ),
      actions(
        apply,
        button("Discard suggestions", () => {
          results.replaceChildren();
          message.textContent =
            "Suggestions discarded. Your draft is unchanged.";
        }),
      ),
    );
  }
  return root;
}
