import test from "node:test";
import assert from "node:assert/strict";
import {newItem, hasValue, validateItem, validateStock, validateFields, validateValue, validateValues,
  unitPrice, templateFromItem, applyTemplate, editField, moveField, duplicateLabels} from "../assets/workshop-base-model.js";
import {exampleItems} from "../assets/workshop-base-fixtures.js";

test("Workshop base accepts name-only records and all five representative categories", () => {
  const item = newItem("Power"); item.identity.name = "Prototype";
  assert.equal(validateItem(item), item);
  for (const example of exampleItems()) assert.equal(validateItem(example.item), example.item);
  assert.throws(() => validateItem(newItem()), /item name/);
});
test("typed values preserve zero, false and unknown as distinct states", () => {
  assert.equal(hasValue(0), true); assert.equal(hasValue(false), true); assert.equal(hasValue(""), false);
  const item = newItem(); item.identity.name = "Test";
  item.fields = [{id: "current", label: "Current", type: "number", unit: "A", destination: "workshop"},
    {id: "isolated", label: "Isolated", type: "checkbox", destination: "workshop"}];
  item.values = {current: {value: 0}, isolated: {value: false}};
  assert.equal(validateItem(item), item);
  for (const value of ["0", Infinity, NaN]) assert.throws(() => validateValue(item.fields[0], value));
  assert.throws(() => validateValue(item.fields[1], "false"));
});
test("project resistance never enters the reusable resistor record or its template", () => {
  const item = exampleItems().find(example => example.key === "resistor").item;
  const before = structuredClone(item), project = {resistance: {value: 10000}, designator: {value: "R1"}};
  validateValues(item.fields, project, "project");
  assert.deepEqual(item, before);
  assert.throws(() => validateValues(item.fields, project, "workshop"), /destination/);
  assert.throws(() => validateValues(item.fields, {power: {value: 0.5}}, "project"), /destination/);
  const template = templateFromItem(item, "Resistor");
  assert.equal(JSON.stringify(template).includes("10000"), false);
  assert.equal(Object.hasOwn(template, "values"), false);
});
test("template snapshots explicitly exclude all item values, commercial data, attachments and stock", () => {
  const item = exampleItems()[0].item;
  item.fields[0].value = "accidentally embedded product value";
  item.offers = [{supplier: "Vendor", packPrice: 50, packQuantity: 5, currency: "USD"}];
  item.attachments = [{url: "https://example.test/datasheet.pdf"}]; item.stock = {quantity: 99};
  const template = templateFromItem(item, "Transistor");
  assert.deepEqual(Object.keys(template).sort(), ["category", "fields", "name", "schemaVersion"]);
  assert.equal(template.fields.some(field => Object.hasOwn(field, "value")), false);
  template.fields[0].label = "Changed label";
  assert.equal(item.fields[0].label, "Package");
});
test("field rename and reorder retain identity, values and metadata", () => {
  const item = exampleItems()[0].item;
  item.values.voltage.conditions = "Example condition";
  const renamed = editField(item, {...item.fields[1], label: "Rated drain voltage"});
  const moved = moveField(renamed, "voltage", -1);
  assert.equal(moved.fields[0].id, "voltage"); assert.equal(moved.values.voltage.value, 60);
  assert.equal(moved.values.voltage.conditions, "Example condition");
  assert.equal(item.fields[1].label, "Drain-source voltage");
});
test("new layouts preserve unmatched populated fields including zero and false", () => {
  const item = newItem(); item.identity.name = "Example"; item.identity.category = "Power";
  item.fields = [{id: "zero", label: "Offset", type: "number", destination: "workshop"},
    {id: "false", label: "Isolated", type: "checkbox", destination: "workshop"}];
  item.values = {zero: {value: 0}, false: {value: false}};
  const applied = applyTemplate(item, {fields: [], category: "Other"});
  assert.equal(applied.fields.every(field => field.hidden), true);
  assert.deepEqual(applied.values, item.values); assert.equal(applied.identity.category, "Power");
  assert.equal(validateItem(applied), applied);
  const restored = applyTemplate(applied, templateFromItem(item, "Restore"));
  assert.equal(restored.fields.some(field => field.hidden), false); assert.deepEqual(restored.values, item.values);
});
test("populated fields reject type, unit and destination changes without converting values", () => {
  const item = exampleItems()[0].item, before = structuredClone(item), field = item.fields[1];
  for (const change of [{type: "text"}, {unit: "mV"}, {destination: "project"}]) {
    const next = {...field, ...change};
    assert.throws(() => editField(item, next), /No value was converted/);
    assert.throws(() => applyTemplate(item, {fields: [next]}), /No value was converted/);
  }
  assert.deepEqual(item, before);
  const resistor = exampleItems().find(example => example.key === "resistor").item;
  assert.throws(() => applyTemplate(resistor, {fields: [{...resistor.fields[1], unit: "kΩ"}]}, {resistance: {value: 0}}));
});
test("choice changes cannot discard a selected option and labels never merge fields", () => {
  const tool = exampleItems().at(-1).item;
  assert.throws(() => editField(tool, {...tool.fields[1], options: ["Conical"]}), /Choose one/);
  const fields = [{id: "one", label: "Voltage", type: "number", destination: "workshop"}, {id: "two", label: "voltage", type: "number", destination: "workshop"}];
  assert.equal(validateFields(fields), fields); assert.deepEqual(duplicateLabels(fields), ["voltage"]);
  assert.throws(() => validateFields([fields[0], fields[0]]), /unique/);
  assert.throws(() => validateFields([{...fields[0], id: "__proto__"}]), /unique/);
});
test("ordering derives unit price and accepts unknown or zero prices without inventing quantity", () => {
  assert.equal(unitPrice({packPrice: 12, packQuantity: 5}), 2.4);
  assert.equal(unitPrice({packPrice: 0, packQuantity: 5}), 0);
  assert.equal(unitPrice({packPrice: 12}), null); assert.equal(unitPrice({packQuantity: 5}), null);
  const item = newItem(); item.identity.name = "Part";
  item.offers = [{packPrice: 0, packQuantity: 5, currency: "USD"}]; validateItem(item);
  item.offers[0].packQuantity = 0; assert.throws(() => validateItem(item), /greater than zero/);
  assert.equal(validateStock({quantity: 0}).quantity, 0);
  assert.throws(() => validateStock({quantity: -1}));
});
test("documents, order links and specification sources reject executable URLs", () => {
  const item = exampleItems()[0].item;
  item.attachments = [{url: "https://example.test/a.pdf"}, {url: "https://example.test/b.pdf"}]; validateItem(item);
  item.attachments.push({url: "javascript:alert(1)"}); assert.throws(() => validateItem(item), /http or https/);
  item.attachments.pop(); item.values.voltage.source = "data:text/html,unsafe";
  assert.throws(() => validateItem(item), /Specification sources/);
});
