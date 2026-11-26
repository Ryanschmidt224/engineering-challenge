export const present = value => value !== undefined && value !== null && value !== "";
export const validId = value => typeof value === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(value) && !["__proto__","constructor","prototype"].includes(value);
export const isWebUrl = value => {try {const url = new URL(value); return ["https:","http:"].includes(url.protocol) && !url.username && !url.password;} catch {return false;}};
export function validateFamilyFields(fields) {
  if (!Array.isArray(fields) || fields.length > 80) throw Error("Use at most 80 fields in a family.");
  const seen = new Set();
  for (const field of fields) {
    if (!validId(field.id) || seen.has(field.id)) throw Error("Each field needs a unique stable ID."); seen.add(field.id);
    if (typeof field.label !== "string" || !field.label.trim() || field.label.length > 100 || typeof field.unit !== "string" || field.unit.length > 32) throw Error("Enter a field label and a short unit.");
    if (!["number","text","choice","boolean"].includes(field.type)) throw Error("Choose a supported field type.");
    if (!Array.isArray(field.choices) || field.choices.length > 40 || field.choices.some(choice => typeof choice !== "string" || !choice.trim() || choice.length > 100) || new Set(field.choices).size !== field.choices.length) throw Error("Choices must be distinct short labels.");
  }
}
export function validateFamilyValues(fields, values) {
  if (!values || typeof values !== "object" || Array.isArray(values)) throw Error("Invalid field values.");
  for (const [id,value] of Object.entries(values)) {
    const field = fields.find(field => field.id === id);
    if (!field) throw Error("A value does not belong to this family.");
    if (!present(value)) continue;
    if (field.type === "number" && (typeof value !== "number" || !Number.isFinite(value))) throw Error(field.label + " needs a finite number.");
    if (field.type === "boolean" && typeof value !== "boolean") throw Error(field.label + " needs Yes or No.");
    if (["text","choice"].includes(field.type) && (typeof value !== "string" || value.length > 2000)) throw Error(field.label + " needs short text.");
    if (field.type === "choice" && field.choices.length && !field.choices.includes(value)) throw Error("Choose a listed value for " + field.label + ".");
  }
}
// Different values are shown for review, not treated as an engineering fit test.
export function resolveFamilyValues(fields, productValues = {}, useValues = {}) {
  return fields.filter(field => !field.hidden).map(field => ({...field, product: productValues[field.id], required: useValues[field.id],
    value: present(productValues[field.id]) ? productValues[field.id] : useValues[field.id],
    different: present(productValues[field.id]) && present(useValues[field.id]) && productValues[field.id] !== useValues[field.id]}));
}
export function familyUsePart(use, family, product, fields, attachments = []) {
  const values = resolveFamilyValues(fields, product?.field_values || {}, use.field_values);
  const specifications = values.filter(field => present(field.value)).map(field => ({name: field.label,
    value: [typeof field.value === "boolean" ? field.value ? "Yes" : "No" : String(field.value), field.unit,
      field.different ? "(project requirement: " + use.field_values[field.id] + (field.unit ? " " + field.unit : "") + "; review)" : ""].filter(Boolean).join(" "), source: "explicit",...(product?.lookup_provenance?.fields?.[field.id]&&Object.is(product.lookup_provenance.fields[field.id].value,field.product)?{evidence:product.lookup_provenance.fields[field.id]}:{})}));
  return {id: use.id, name: use.purpose || family.name, implementationName: product?.name || family.name, description: use.notes || "",
    familyId: family.id, familyName: family.name, familyUse: true, productId: product?.id || null, implementationResolved: !!product,
    familyValues: use.field_values,
    revision: String(use.revision), quantity: use.quantity, quantityUnit: use.unit, assemblyId: use.tree_node_id || null,
    itemType: "part", partType: "purchased", isTool: family.kind === "tool", manufacturer: product?.manufacturer || "", model: product?.mpn || "",
    specifications,
    workshopSpecifications: values.filter(field => present(field.product)).map(field => ({name: field.label, value: [typeof field.product === "boolean" ? field.product ? "Yes" : "No" : String(field.product), field.unit].filter(Boolean).join(" ")})),
    projectSpecifications: values.filter(field => present(field.required)).map(field => ({name: field.label, value: [typeof field.required === "boolean" ? field.required ? "Yes" : "No" : String(field.required), field.unit].filter(Boolean).join(" "), different: field.different})),
    projectDetails: {}, workshopDocumentation: attachments.map(file => ({label: file.title, url: file.url || "/api/workshop/file?id=" + file.id})),
    workshopSourcing: {url: product?.supplier_links?.find(link=>link.url)?.url || ""},
    photoUrl: attachments.find(file => file.kind === "photo") ? attachments.find(file => file.kind === "photo").url || "/api/workshop/file?id=" + attachments.find(file => file.kind === "photo").id : null,
    purchaseStatus: "not_started", progressStatus: "not_started", needsAttention: false, attentionNote: "", progressUpdates: [], hideFromFeatureTree: false,...(use.project_state||{})};
}
