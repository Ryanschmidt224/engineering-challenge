export const present = (value) =>
  value !== undefined && value !== null && value !== "";
export const validId = (value) =>
  typeof value === "string" &&
  /^[a-zA-Z0-9_-]{1,100}$/.test(value) &&
  !["__proto__", "constructor", "prototype"].includes(value);
export const isWebUrl = (value) => {
  try {
    const url = new URL(value);
    return (
      ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
};
export function validateFamilyFields(fields) {
  if (!Array.isArray(fields) || fields.length > 80)
    throw Error("Use at most 80 fields in a family.");
  const seen = new Set();
  for (const field of fields) {
    if (!validId(field.id) || seen.has(field.id))
      throw Error("Each field needs a unique stable ID.");
    seen.add(field.id);
    if (
      typeof field.label !== "string" ||
      !field.label.trim() ||
      field.label.length > 100 ||
      typeof field.unit !== "string" ||
      field.unit.length > 32
    )
      throw Error("Enter a field label and a short unit.");
    if (!["number", "text", "choice", "boolean"].includes(field.type))
      throw Error("Choose a supported field type.");
    if (
      !Array.isArray(field.choices) ||
      field.choices.length > 40 ||
      field.choices.some(
        (choice) =>
          typeof choice !== "string" || !choice.trim() || choice.length > 100,
      ) ||
      new Set(field.choices).size !== field.choices.length
    )
      throw Error("Choices must be distinct short labels.");
  }
}
export function validateFamilyValues(fields, values) {
  if (!values || typeof values !== "object" || Array.isArray(values))
    throw Error("Invalid field values.");
  for (const [id, value] of Object.entries(values)) {
    const field = fields.find((field) => field.id === id);
    if (!field) throw Error("A value does not belong to this family.");
    if (!present(value)) continue;
    if (
      field.type === "number" &&
      (typeof value !== "number" || !Number.isFinite(value))
    )
      throw Error(field.label + " needs a finite number.");
    if (field.type === "boolean" && typeof value !== "boolean")
      throw Error(field.label + " needs Yes or No.");
    if (
      ["text", "choice"].includes(field.type) &&
      (typeof value !== "string" || value.length > 2000)
    )
      throw Error(field.label + " needs short text.");
    if (
      field.type === "choice" &&
      field.choices.length &&
      !field.choices.includes(value)
    )
      throw Error("Choose a listed value for " + field.label + ".");
  }
}
// Different values are shown for review, not treated as an engineering fit test.
export function resolveFamilyValues(
  fields,
  productValues = {},
  useValues = {},
) {
  return fields
    .filter((field) => !field.hidden)
    .map((field) => ({
      ...field,
      product: productValues[field.id],
      required: useValues[field.id],
      value: present(productValues[field.id])
        ? productValues[field.id]
        : useValues[field.id],
      different:
        present(productValues[field.id]) &&
        present(useValues[field.id]) &&
        productValues[field.id] !== useValues[field.id],
    }));
}
