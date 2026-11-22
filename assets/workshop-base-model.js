// New Workshop contract. This module deliberately has no legacy readers or storage calls.
export const fieldTypes = ["text", "number", "checkbox", "choice", "url"];
export const destinations = ["workshop", "project"];
export const hasValue = value => value !== undefined && value !== null && value !== "";
export const copy = value => structuredClone(value);
const fail = message => { throw new Error(message); };
const nonempty = value => typeof value === "string" && value.trim().length > 0;
const safeId = value => typeof value === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(value) && !["__proto__", "prototype", "constructor"].includes(value);
export const safeUrl = value => {
  try { return ["https:", "http:"].includes(new URL(value).protocol); } catch { return false; }
};
export function newItem(category = "") {
  return {schemaVersion: 1, id: crypto.randomUUID(), identity: {name: "", category},
    fields: [], values: {}, offers: [], attachments: [], notes: ""};
}
export function validateFields(fields) {
  if (!Array.isArray(fields) || fields.length > 80) fail("Use at most 80 specification fields.");
  const ids = new Set();
  for (const field of fields) {
    if (!safeId(field.id) || ids.has(field.id)) fail("Every field needs a unique, stable ID.");
    ids.add(field.id);
    if (!nonempty(field.label)) fail("Give each specification a name.");
    if (!fieldTypes.includes(field.type) || !destinations.includes(field.destination)) fail("Choose a supported type and destination.");
    if (field.type === "choice" && (!Array.isArray(field.options) || !field.options.length ||
        field.options.some(value => !nonempty(value)) || new Set(field.options).size !== field.options.length))
      fail("Choice fields need distinct, nonempty options.");
  }
  return fields;
}
export function validateValue(field, value) {
  if (!hasValue(value)) return;
  if (field.type === "number" && (typeof value !== "number" || !Number.isFinite(value))) fail(field.label + " needs a finite number.");
  if (field.type === "checkbox" && typeof value !== "boolean") fail(field.label + " needs Yes or No.");
  if (["text", "url", "choice"].includes(field.type) && typeof value !== "string") fail(field.label + " needs text.");
  if (field.type === "url" && !safeUrl(value)) fail(field.label + " needs an http or https link.");
  if (field.type === "choice" && !field.options.includes(value)) fail("Choose one of the options for " + field.label + ".");
}
export function validateValues(fields, values, destination) {
  for (const [id, entry] of Object.entries(values)) {
    const field = fields.find(field => field.id === id);
    if (!field || field.destination !== destination) fail("A value belongs to the wrong item or project destination.");
    validateValue(field, entry.value);
    if (entry.source && !safeUrl(entry.source)) fail("Specification sources need an http or https link.");
  }
}
export function validateItem(item) {
  if (item.schemaVersion !== 1 || !nonempty(item.identity?.name)) fail("Enter an item name. Everything else is optional.");
  validateFields(item.fields);
  validateValues(item.fields, item.values, "workshop");
  for (const offer of item.offers) {
    if (offer.url && !safeUrl(offer.url)) fail("Ordering links need http or https.");
    if (hasValue(offer.packQuantity) && (!Number.isFinite(offer.packQuantity) || offer.packQuantity <= 0)) fail("Package quantity must be greater than zero.");
    if (hasValue(offer.packPrice) && (!Number.isFinite(offer.packPrice) || offer.packPrice < 0)) fail("Package price must be zero or greater.");
    if (hasValue(offer.packPrice) && !/^[A-Z]{3}$/.test(offer.currency || "")) fail("Choose a three-letter currency code for the package price.");
  }
  for (const attachment of item.attachments) {
    if (!safeUrl(attachment.url)) fail("Files and links need an http or https link.");
  }
  return item;
}
export function unitPrice(offer) {
  return Number.isFinite(offer.packPrice) && offer.packPrice >= 0 && Number.isFinite(offer.packQuantity) && offer.packQuantity > 0
    ? offer.packPrice / offer.packQuantity : null;
}
export function validateStock(stock) {
  if (stock && hasValue(stock.quantity) && (!Number.isFinite(stock.quantity) || stock.quantity < 0)) fail("Stock quantity must be zero or greater.");
  return stock;
}
export function duplicateLabels(fields) {
  const labels = new Set(), duplicates = new Set();
  for (const field of fields.filter(field => !field.hidden)) {
    const label = field.label.trim().toLowerCase();
    if (labels.has(label)) duplicates.add(field.label);
    labels.add(label);
  }
  return [...duplicates];
}
function definition(field) {
  return {id: field.id, label: field.label, type: field.type, destination: field.destination,
    ...(field.unit ? {unit: field.unit} : {}), ...(field.type === "choice" ? {options: [...field.options]} : {}),
    ...(field.hidden ? {hidden: true} : {})};
}
export function templateFromItem(item, name) {
  if (!nonempty(name)) fail("Give the template a name.");
  validateFields(item.fields);
  return {schemaVersion: 1, name: name.trim(), category: item.identity.category || "",
    fields: item.fields.filter(field => !field.hidden).map(definition)};
}
function ensureCompatible(previous, next, entry) {
  if (!hasValue(entry?.value)) return;
  if (previous.type !== next.type || previous.destination !== next.destination || (previous.unit || "") !== (next.unit || ""))
    fail("Keep the type, unit and destination of populated field '" + previous.label + "', or add a new field. No value was converted.");
  validateValue(next, entry.value);
}
export function editField(item, next, projectValues = {}) {
  const result = copy(item), previous = result.fields.find(field => field.id === next.id);
  if (!previous) fail("Field not found.");
  validateFields([next]);
  ensureCompatible(previous, next, (previous.destination === "workshop" ? item.values : projectValues)[next.id]);
  result.fields[result.fields.indexOf(previous)] = definition(next);
  return result;
}
export function applyTemplate(item, template, projectValues = {}) {
  validateFields(template.fields);
  const result = copy(item), previous = new Map(item.fields.map(field => [field.id, field]));
  result.fields = template.fields.map(field => {
    const old = previous.get(field.id);
    if (old) ensureCompatible(old, field, (old.destination === "workshop" ? item.values : projectValues)[field.id]);
    return definition(field);
  });
  const active = new Set(result.fields.map(field => field.id));
  // Unmatched values retain their definitions and appear under Additional saved details.
  result.fields.push(...item.fields.filter(field => !active.has(field.id)).map(field => ({...definition(field), hidden: true})));
  return result;
}
export function moveField(item, id, offset) {
  const result = copy(item), index = result.fields.findIndex(field => field.id === id), target = index + offset;
  if (index < 0 || target < 0 || target >= result.fields.length) return result;
  [result.fields[index], result.fields[target]] = [result.fields[target], result.fields[index]];
  return result;
}
