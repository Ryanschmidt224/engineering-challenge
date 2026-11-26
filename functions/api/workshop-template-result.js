import { lookupValue } from "../../assets/workshop-lookup-model.js";
const text = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const url = (v) => {
  if (typeof v !== "string" || v.length > 1200) return "";
  try {
    const u = new URL(v);
    return u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !["localhost"].includes(u.hostname) &&
      !u.hostname.endsWith(".local") &&
      !/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname) &&
      !u.hostname.includes(":")
      ? u.href
      : "";
  } catch {
    return "";
  }
};
// Template results have an explicit field-ID contract. Legacy research is never
// adapted by label or remapped into a different template field.
export async function templateLookupResult(
  data,
  template,
  { partNumber, manufacturer, document },
  lookupUsage,
) {
  const identity = {
    name: text(data.name, 180),
    manufacturer: text(data.manufacturer, 160),
    partNumber: text(data.partNumber, 160),
    supplier: text(data.supplier, 120),
    supplierPartNumber: text(data.supplierPartNumber, 160),
    supplierUrl: url(data.supplierUrl),
  };
  if (
    !identity.name ||
    !identity.manufacturer ||
    !identity.partNumber ||
    !identity.supplierUrl
  )
    throw Error(
      "The lookup could not verify all product identity fields and an HTTPS supplier URL. Refine the identity or add a datasheet, then try again.",
    );
  if (
    partNumber &&
    identity.partNumber.toUpperCase() !== partNumber.toUpperCase()
  )
    throw Error("The exact manufacturer part number could not be confirmed.");
  if (
    manufacturer &&
    identity.manufacturer.toLowerCase().replace(/[^a-z0-9]/g, "") !==
      manufacturer.toLowerCase().replace(/[^a-z0-9]/g, "")
  )
    throw Error("The requested manufacturer could not be confirmed.");
  let documentSource = null;
  if (document) {
    const bytes = Uint8Array.from(atob(document.data), (c) => c.charCodeAt(0)),
      digest = await crypto.subtle.digest("SHA-256", bytes);
    documentSource = {
      name: document.name,
      sha256: Array.from(new Uint8Array(digest), (v) =>
        v.toString(16).padStart(2, "0"),
      ).join(""),
    };
  }
  const values = [];
  for (const row of (Array.isArray(data.specs) ? data.specs : []).slice(
    0,
    80,
  )) {
    const field = template.fields.find((f) => f.id === row?.fieldId);
    if (!field) continue;
    const spec = {
      name: field.label,
      value:
        typeof row.value === "number" || typeof row.value === "boolean"
          ? String(row.value)
          : text(row.value, 2000),
      unit: text(row.unit, 32),
      conditions: text(row.conditions, 240),
      sourceUrl: url(row.sourceUrl),
    };
    const value = lookupValue(field, spec);
    if (
      value === undefined ||
      (!spec.sourceUrl && !(row.sourceType === "document" && documentSource))
    )
      continue;
    values.push({
      fieldId: field.id,
      label: field.label,
      unit: field.unit,
      value,
      conditions: spec.conditions,
      sourceUrl: spec.sourceUrl,
      document: row.sourceType === "document" ? documentSource : null,
    });
  }
  return {
    contract: "workshop-template-v1",
    template: {
      id: template.family.id,
      revision: template.family.revision,
      fieldIds: template.fields.map((f) => f.id),
    },
    identity,
    fields: values,
    caution: text(data.caution, 3000),
    sources: (Array.isArray(data.sources) ? data.sources : [])
      .map(url)
      .filter(Boolean)
      .slice(0, 6),
    lookupUsage,
    needsReview: true,
  };
}
