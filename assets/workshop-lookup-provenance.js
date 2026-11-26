import { present, isWebUrl } from "./family-model.js";
const object = (value) =>
  value && typeof value === "object" && !Array.isArray(value);
const clip = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
export function requireLookupIdentity(record) {
  if (
    !record.name?.trim() ||
    !record.manufacturer?.trim() ||
    !record.mpn?.trim() ||
    !record.supplier_links?.some((v) => {
      try {
        const u = new URL(v.url);
        return u.protocol === "https:" && !u.username && !u.password;
      } catch {
        return false;
      }
    })
  )
    throw Error(
      "AI-assisted products require Product name, Manufacturer, Manufacturer part number and an HTTPS supplier URL.",
    );
}
export function fieldLookupEvidence(record, fieldId) {
  const e = record?.lookup_provenance?.fields?.[fieldId];
  return e && Object.is(e.value, record.field_values?.[fieldId]) ? e : null;
}
export function normalizeLookupProvenance(record, fields, previous = {}) {
  const incoming = record.lookup_provenance,
    prior = previous.lookup_provenance || {};
  if (incoming !== undefined && !object(incoming))
    throw Error("Invalid AI lookup provenance.");
  const raw = incoming ?? prior,
    required = !!(raw.identityRequired || prior.identityRequired);
  if (!required && !raw.documentUpload && !prior.documentUpload) return {};
  if (required) requireLookupIdentity(record);
  if (!object(raw.fields ?? {}) || Object.keys(raw.fields ?? {}).length > 80)
    throw Error("Invalid AI field evidence.");
  const output = {
    version: 1,
    identityRequired: required,
    appliedAt: clip(raw.appliedAt || prior.appliedAt, 40),
    fields: {},
  };
  if (
    required &&
    (!output.appliedAt || !Number.isFinite(Date.parse(output.appliedAt)))
  )
    throw Error("AI evidence needs its application timestamp.");
  for (const [id, e] of Object.entries(raw.fields || {})) {
    const field = fields.find((f) => f.id === id);
    if (!field || !object(e))
      throw Error("AI evidence must belong to a current template field.");
    // A manual edit removes the old AI attribution instead of attaching it to a new value.
    if (!Object.is(e.value, record.field_values[id]) || !present(e.value))
      continue;
    if (e.unit !== field.unit) continue;
    const sourceUrl = clip(e.sourceUrl, 1200);
    if (sourceUrl && !isWebUrl(sourceUrl))
      throw Error("Invalid AI evidence source URL.");
    let document = null;
    if (e.document) {
      const d = e.document;
      if (!object(d) || !/^[a-f0-9]{64}$/.test(d.sha256) || !clip(d.name, 180))
        throw Error("Invalid AI document evidence.");
      document = {
        name: clip(d.name, 180),
        sha256: d.sha256,
        ...(d.id ? { id: clip(d.id, 100) } : {}),
      };
    }
    if (!sourceUrl && !document)
      throw Error("Each AI field needs a source URL or technical document.");
    output.fields[id] = {
      value: e.value,
      label: clip(e.label, 100) || field.label,
      unit: field.unit,
      conditions: clip(e.conditions, 240),
      sourceUrl,
      document,
    };
  }
  const upload = raw.documentUpload ?? prior.documentUpload;
  if (upload) {
    if (
      !object(upload) ||
      !/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(upload.id) ||
      !clip(upload.name, 180) ||
      !/^[a-f0-9]{64}$/.test(upload.sha256) ||
      !["pending", "saved"].includes(upload.status)
    )
      throw Error("Invalid document upload status.");
    output.documentUpload = {
      id: upload.id,
      name: clip(upload.name, 180),
      sha256: upload.sha256,
      status: upload.status,
    };
  }
  if (JSON.stringify(output).length > 64000)
    throw Error("AI evidence is too large. Apply fewer fields.");
  return output;
}
