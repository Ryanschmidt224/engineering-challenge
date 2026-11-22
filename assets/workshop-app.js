import {newItem, hasValue, safeUrl, validateItem, validateValues, validateStock, fieldTypes,
  templateFromItem, applyTemplate, duplicateLabels, unitPrice, moveField, projectPartFromWorkshop} from "./workshop-base-model.js";
import {workshopRequest, saveWorkshopRecord, uploadWorkshopFile} from "./workshop-client.js";

export async function mountWorkshop({preview = false} = {}) {
const $ = selector => document.querySelector(selector);
const h = (tag, cls = "", text) => {const node = document.createElement(tag); node.className = cls; if (text !== undefined) node.textContent = text; return node;};
const button = (text, action, cls = "button") => {const node = h("button", cls, text); node.type = "button"; node.onclick = action; return node;};
const notice = text => {$("#preview-status").textContent = text;};
const guard = action => {try {action();} catch (error) {notice(error.message);}};
const examples = preview ? (await import("./workshop-base-fixtures.js")).exampleItems() : [];
const drafts = new Map(examples.map(({key, item}) => [key, {item, projectValues: {}, stock: null}]));
let selected = preview ? "resistor" : "", mode = "edit", templateDraft = null, keptTemplate = null, changed = false;
let layouts = [], layoutRecord = null, templateDirty = false, busy = false;
const current = () => drafts.get(selected);
const markChanged = () => {changed = true; if (mode === "template") templateDirty = true; else if (current()) current().dirty = true;};
const description = field => field.label + (field.unit ? " (" + field.unit + ")" : "");
const displayValue = value => typeof value === "boolean" ? value ? "Yes" : "No" : String(value);
const link = (text, url) => {const a = h("a", "", text); if (safeUrl(url) || /^\/api\/workshop-files\?id=[a-f0-9-]{36}$/i.test(url)) {a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer";} return a;};
function control(label, value, update, {type = "text", options, placeholder = "", required = false} = {}) {
  const wrapper = h("div", "form-row"), caption = h("label", "field-label", label);
  const input = h(options ? "select" : type === "textarea" ? "textarea" : "input", "input");
  input.id = "workshop-input-" + crypto.randomUUID(); caption.htmlFor = input.id;
  if (options) for (const [value, label] of options) {const option = h("option", "", label); option.value = value; input.append(option);}
  else if (type !== "textarea") input.type = type;
  if (type === "number") input.step = "any";
  input.value = value ?? ""; input.required = required; input.placeholder = placeholder;
  input.addEventListener(options ? "change" : "input", () => {
    update(type === "number" ? input.value === "" ? undefined : Number(input.value) : input.value); markChanged();
  });
  wrapper.append(caption, input); return wrapper;
}
function section(title, help = "", collapsible = false, open = false) {
  const node = h(collapsible ? "details" : "section", "section"), heading = h("h2", "section-title", title);
  if (collapsible) {const summary = h("summary"); summary.append(heading); node.append(summary); node.open = open;}
  else node.append(heading);
  if (help) node.append(h("p", "section-help", help));
  return node;
}
function readRow(label, value, url = false) {
  if (!hasValue(value)) return null;
  const row = h("div", "read-row"); row.append(h("dt", "", label));
  const content = h("dd"); content.append(url ? link(value, value) : document.createTextNode(displayValue(value))); row.append(content); return row;
}
function readRows(host, entries) {const dl = h("dl", "read-list"); for (const entry of entries) {const row = readRow(...entry); if (row) dl.append(row);} if (dl.children.length) host.append(dl);}
function renderNavigation() {
  const nav = $("#examples"); nav.replaceChildren();
  for (const example of examples) {
    const b = button("", () => {selected = example.key; mode = "edit"; templateDraft = null; render();});
    b.setAttribute("aria-current", selected === example.key ? "page" : "false");
    b.append(h("small", "", example.caption), h("span", "", example.item.identity.name)); nav.append(b);
  }
  for (const [key, draft] of drafts) {
    if (examples.some(example => example.key === key)) continue;
    const b = button(draft.item.identity.name || "Untitled draft", () => {selected = key; mode = "edit"; render();});
    b.setAttribute("aria-current", selected === key ? "page" : "false"); nav.append(b);
  }
}
function valueRow(field, values, readOnly = false) {
  const entry = values[field.id] || {}, wrapper = h("div", "specification"); wrapper.dataset.fieldId = field.id;
  if (readOnly) {
    readRows(wrapper, [[description(field), entry.value, field.type === "url"], ["Conditions", entry.conditions], ["Source", entry.source, true]]);
    return wrapper;
  }
  const set = value => {values[field.id] = {...values[field.id], value};};
  const options = field.type === "choice" ? [["", "Not set"], ...field.options.map(value => [value, value])]
    : field.type === "checkbox" ? [["", "Not set"], ["true", "Yes"], ["false", "No"]] : undefined;
  wrapper.append(control(description(field), field.type === "checkbox" && hasValue(entry.value) ? String(entry.value) : entry.value,
    value => set(field.type === "checkbox" ? value === "" ? undefined : value === "true" : value),
    {type: ["number", "url"].includes(field.type) ? field.type : "text", options}));
  const metadata = h("details", "specification-metadata"); metadata.append(h("summary", "", "Conditions & source"));
  for (const [key, label, type] of [["conditions", "Conditions", "text"], ["source", "Source link", "url"]])
    metadata.append(control(label, entry[key], value => {values[field.id] = {...values[field.id], [key]: value};}, {type}));
  wrapper.append(metadata); return wrapper;
}
function fieldDesigner(source) {
  const area = section("Specification fields", "A field is either saved on the Workshop item or filled in for a project. Templates contain no values.");
  const warning = h("p", "warning"); warning.setAttribute("role", "status");
  const updateWarning = () => {
    const duplicates = duplicateLabels(source.fields); warning.hidden = !duplicates.length;
    warning.textContent = duplicates.length ? "Repeated names: " + duplicates.join(", ") + ". These remain separate fields; consider clearer names." : "";
  };
  updateWarning(); area.append(warning);
  source.fields.forEach((field, index) => {
    const row = h("fieldset", "definition"); row.dataset.fieldId = field.id;
    row.append(h("legend", "", field.label || "New specification"));
    row.append(control("Field name", field.label, value => {field.label = value; updateWarning();}));
    row.append(control("Type", field.type, value => {field.type = value; if (value === "choice") field.options ??= ["Option 1", "Option 2"]; render();}, {options: fieldTypes.map(type => [type, {text: "Text", number: "Number", checkbox: "Yes / No", choice: "Choice", url: "Link"}[type]])}));
    row.append(control("Unit", field.unit, value => {field.unit = value;}, {placeholder: "Optional, e.g. V or mm"}));
    row.append(control("Value belongs to", field.destination, value => {field.destination = value;}, {options: [["workshop", "Workshop item"], ["project", "Project use"]]}));
    if (field.type === "choice") row.append(control("Choices, one per line", field.options.join("\n"), value => {field.options = value.split("\n").map(value => value.trim());}, {type: "textarea"}));
    const actions = h("div", "inline-actions");
    for (const [label, offset] of [["Move up", -1], ["Move down", 1]]) {
      const move = button(label, () => {source.fields = moveField(source, field.id, offset).fields; markChanged(); render();}, "text-button");
      move.disabled = index + offset < 0 || index + offset >= source.fields.length; actions.append(move);
    }
    actions.append(button("Remove field", () => {source.fields = source.fields.filter(entry => entry.id !== field.id); markChanged(); render();}, "text-button"));
    row.append(actions); area.append(row);
  });
  area.append(button("Add specification field", () => {source.fields.push({id: crypto.randomUUID(), label: "New specification", type: "text", destination: "workshop"}); markChanged(); render();}));
  return area;
}
function templateSource() {return {identity: {category: templateDraft.category}, fields: templateDraft.fields, values: {}};}
function renderTemplate(host) {
  const info = section("Template details", "The standard Identity, Ordering, Files and Notes sections stay consistent. Configure only the technical fields here.");
  info.append(control("Template name", templateDraft.name, value => {templateDraft.name = value;}, {required: true}));
  info.append(control("Category", templateDraft.category, value => {templateDraft.category = value;}));
  host.append(info);
  // The same definitions drive this designer, the item form and the read view.
  host.append(fieldDesigner(templateDraft));
  const footer = h("div", "form-actions");
  footer.append(button("Keep template in this tab", () => guard(() => {
    keptTemplate = templateFromItem(templateSource(), templateDraft.name);
    notice("Template kept in this tab. Item values, prices, files and stock were not copied.");
  }), "button primary"));
  footer.append(button("Preview changes to item", () => guard(() => {
    keptTemplate = templateFromItem(templateSource(), templateDraft.name); previewTemplate();
  })));
  host.append(footer);
}
function previewTemplate() {
  const item = current().item, dialog = $("#template-preview"); dialog.replaceChildren();
  dialog.append(h("h2", "", "Preview template changes")); dialog.firstElementChild.id = "template-preview-title";
  const old = new Set(item.fields.map(field => field.id)), next = new Set(keptTemplate.fields.map(field => field.id));
  const added = keptTemplate.fields.filter(field => !old.has(field.id)), unmatched = item.fields.filter(field => !next.has(field.id));
  dialog.append(h("p", "", "Apply “" + keptTemplate.name + "” to this draft?"));
  dialog.append(h("p", "", "Add: " + (added.map(field => field.label).join(", ") || "no new fields") + "."));
  dialog.append(h("p", "", "Move to Additional saved details: " + (unmatched.map(field => field.label).join(", ") || "none") + "."));
  const updated = keptTemplate.fields.filter((field, index) => {
    const previous = item.fields.find(entry => entry.id === field.id);
    return previous && (JSON.stringify(previous) !== JSON.stringify(field) || item.fields[index]?.id !== field.id);
  });
  dialog.append(h("p", "", "Updated or reordered: " + (updated.map(field => field.label).join(", ") || "none") + "."));
  dialog.append(h("p", "muted", "Populated values are preserved. Type, unit or destination changes to populated fields are rejected. Category and identity stay unchanged."));
  const errorMessage = h("p", "warning"); errorMessage.hidden = true; errorMessage.setAttribute("role", "alert"); dialog.append(errorMessage);
  const actions = h("div", "form-actions");
  actions.append(button("Apply layout", () => {
    try {
      current().item = applyTemplate(item, keptTemplate, current().projectValues); changed = true;
      mode = "edit"; dialog.close(); render(); notice("Layout applied to this draft. Saved details were preserved.");
    } catch (error) {errorMessage.textContent = error.message; errorMessage.hidden = false;}
  }, "button primary"), button("Cancel", () => dialog.close()));
  dialog.append(actions); dialog.showModal();
}
function renderIdentity(host, item, readOnly) {
  const identity = section("Identity", readOnly ? "" : "Only the item name is required. The project container keeps its own name and purpose.");
  const fields = [["name", "Item name"], ["description", "Description"], ["category", "Category"], ["manufacturer", "Manufacturer"], ["mpn", "Manufacturer part number"]];
  if (readOnly) readRows(identity, [...fields.map(([key, label]) => [label, item.identity[key]]), ["Model designation", item.identity.model], ["Used as a tool", item.identity.isTool || undefined]]);
  else {
    for (const [key, label] of fields) identity.append(control(label, item.identity[key], value => {item.identity[key] = value;}, {required: key === "name", placeholder: key === "name" ? "e.g. ¼ W resistor" : "Optional"}));
    const advanced = h("details", "identity-more"); advanced.append(h("summary", "", "Model & tool options")); advanced.open = !!(item.identity.model || item.identity.isTool);
    advanced.append(control("Model designation", item.identity.model, value => {item.identity.model = value;}, {placeholder: "Only if different from the part number"}));
    const tool = h("label", "checkbox-row"), check = h("input"); check.type = "checkbox"; check.checked = !!item.identity.isTool;
    check.onchange = () => {item.identity.isTool = check.checked; markChanged();};
    tool.append(check, document.createTextNode("Used as a tool")); advanced.append(tool, h("p", "section-help", "Tools appear in the tools list rather than as consumed BOM parts.")); identity.append(advanced);
  }
  host.append(identity);
}
function renderSpecifications(host, item, readOnly) {
  const active = item.fields.filter(field => !field.hidden && field.destination === "workshop" && (!readOnly || hasValue(item.values[field.id]?.value)));
  if (active.length || !readOnly) {
    const specs = section("Specifications", readOnly ? "" : "Fixed properties of this Workshop item. Project-specific values are entered separately.");
    for (const field of active) specs.append(valueRow(field, item.values, readOnly));
    if (!readOnly) specs.append(button("Configure specification fields", openTemplate, "text-button"));
    host.append(specs);
  }
  const project = item.fields.filter(field => !field.hidden && field.destination === "project");
  if (project.length) {
    const future = section("Filled in for a project", "Field definitions only. These values will belong to the project part.");
    future.append(h("p", "project-fields", project.map(description).join(" · ")));
    future.append(button("Try project use", () => {mode = "project"; render();}, "text-button")); host.append(future);
  }
  const hidden = item.fields.filter(field => field.hidden && hasValue((field.destination === "workshop" ? item.values : current().projectValues)[field.id]?.value));
  if (hidden.length) {
    const extra = section("Additional saved details", "These populated fields are outside the current layout. Their values are still retained.", true, true);
    for (const field of hidden) {
      extra.append(valueRow(field, field.destination === "workshop" ? item.values : current().projectValues, readOnly));
      if (!readOnly) extra.append(button("Restore " + field.label, () => {field.hidden = false; markChanged(); render();}, "text-button"));
    }
    host.append(extra);
  }
}
function renderOffers(host, item, readOnly) {
  if (readOnly && !item.offers.some(offer => offer.supplier || offer.url || hasValue(offer.packPrice))) return;
  const offers = section("Ordering", "Optional supplier references. Unit price is calculated from the package price and quantity.", !readOnly, item.offers.length > 0);
  item.offers.forEach((offer, index) => {
    const row = h("fieldset", "repeat-row"); row.append(h("legend", "", "Supplier reference " + (index + 1)));
    const calculated = h("p", "calculated"), refresh = () => {const price = unitPrice(offer); calculated.textContent = price === null ? "Add a package price and quantity to see unit price." : "Unit price: " + offer.currency + " " + Number(price.toFixed(6)) + " per item";};
    const fields = [["supplier", "Supplier", "text"], ["partNumber", "Supplier part number", "text"], ["url", "Order link", "url"], ["packQuantity", "Quantity per package", "number"], ["packPrice", "Package price", "number"], ["currency", "Currency", "text"], ["recordedOn", "Price recorded on", "date"]];
    if (readOnly) readRows(row, fields.map(([key, label, type]) => [label, offer[key], type === "url"]));
    else for (const [key, label, type] of fields) row.append(control(label, offer[key], value => {offer[key] = key === "currency" ? value.toUpperCase() : value; refresh();}, {type}));
    refresh(); row.append(calculated);
    if (!readOnly) row.append(button("Remove supplier reference", () => {item.offers.splice(index, 1); markChanged(); render();}, "text-button"));
    offers.append(row);
  });
  if (!readOnly) offers.append(button("Add supplier reference", () => {item.offers.push({id: crypto.randomUUID(), currency: "USD"}); markChanged(); render();}, "text-button"));
  host.append(offers);
}
function renderAttachments(host, item, readOnly) {
  if (readOnly && !item.attachments.length) return;
  const files = section("Files & links", "Keep datasheets, drawings, manuals and photos together. This preview accepts links; uploads come with the storage batch.", !readOnly, item.attachments.length > 0);
  item.attachments.forEach((attachment, index) => {
    const row = h("fieldset", "repeat-row"); row.append(h("legend", "", "Reference " + (index + 1)));
    if (readOnly) row.append(link(attachment.label || attachment.url, attachment.url), h("small", "", attachment.purpose));
    else {
      row.append(control("Label", attachment.label, value => {attachment.label = value;}), control("Link", attachment.url, value => {attachment.url = value;}, {type: "url"}));
      row.append(control("Purpose", attachment.purpose, value => {attachment.purpose = value;}, {options: [["document", "Document"], ["datasheet", "Datasheet"], ["drawing", "Drawing / CAD"], ["manual", "Manual"], ["photo", "Photo"], ["other", "Other"]]}));
      row.append(button("Remove reference", () => {item.attachments.splice(index, 1); markChanged(); render();}, "text-button"));
    }
    files.append(row);
  });
  if (!readOnly) files.append(button("Add link", () => {item.attachments.push({id: crypto.randomUUID(), label: "", url: "", purpose: "document"}); markChanged(); render();}, "text-button"));
  host.append(files);
}
function renderStock(host, readOnly) {
  const record = current(); if (readOnly && !record.stock) return;
  const stock = section("Stock", "Optional inventory for this item. Kept separately from its definition and templates.", !readOnly, !!record.stock);
  if (record.stock) {
    if (readOnly) readRows(stock, [["Quantity", record.stock.quantity], ["Unit", record.stock.unit], ["State", record.stock.state]]);
    else {
      stock.append(control("Stock quantity", record.stock.quantity, value => {record.stock.quantity = value;}, {type: "number"}));
      stock.append(control("Stock unit", record.stock.unit, value => {record.stock.unit = value;}));
      stock.append(control("Stock state", record.stock.state, value => {record.stock.state = value;}, {options: [["", "Not set"], ["In stock", "In stock"], ["Reusable", "In use, reusable"], ["Committed", "Committed"]]}));
      stock.append(button("Remove stock entry", () => {record.stock = null; markChanged(); render();}, "text-button"));
    }
  } else stock.append(button("Track stock", () => {record.stock = {unit: "pcs", state: ""}; markChanged(); render();}, "text-button"));
  host.append(stock);
}
function openTemplate() {
  templateDraft = templateFromItem(current().item, "Untitled template"); mode = "template"; render();
}
function render() {
  renderNavigation();
  const host = $("#workshop-main"), item = current().item, readOnly = mode === "read";
  host.replaceChildren();
  const header = h("div", "page-heading"), title = h("div");
  title.append(h("p", "eyebrow", mode === "template" ? "Workshop / Template builder" : mode === "project" ? "Workshop / Project use preview" : "Workshop / Base form"), h("h1", "", mode === "template" ? "Template builder" : item.identity.name || "New Workshop item"));
  const actions = h("div", "heading-actions");
  actions.append(button(mode === "edit" ? "Read view" : "Edit item", () => guard(() => {
    if (mode === "edit") {if (!$("#item-form").reportValidity()) return; validateItem(item); validateStock(current().stock); mode = "read";} else mode = "edit";
    render();
  })));
  if (mode !== "template") actions.append(button("Template builder", () => guard(openTemplate)));
  if (keptTemplate && mode !== "template") actions.append(button("Use kept template", previewTemplate));
  header.append(title, actions); host.append(header);
  if (mode === "template") {renderTemplate(host); return;}
  if (mode === "project") {
    const project = section("Project-specific values", "Try how the item will be configured in a project. These values do not change the Workshop item or its template.");
    const fields = item.fields.filter(field => field.destination === "project");
    if (!fields.length) project.append(h("p", "muted", "This item has no project input fields."));
    for (const field of fields) project.append(valueRow(field, current().projectValues));
    project.append(button("Check project values", () => guard(() => {validateValues(item.fields, current().projectValues, "project"); notice("Project values checked. The Workshop item is unchanged.");}), "button primary"));
    host.append(project); return;
  }
  const form = h("form"); form.id = "item-form"; form.onsubmit = event => event.preventDefault();
  renderIdentity(form, item, readOnly); renderSpecifications(form, item, readOnly);
  renderOffers(form, item, readOnly); renderAttachments(form, item, readOnly);
  if (!readOnly || item.notes) {
    const notes = section("Notes", "", !readOnly, !!item.notes);
    if (readOnly) notes.append(h("p", "notes-text", item.notes));
    else notes.append(control("Notes", item.notes, value => {item.notes = value;}, {type: "textarea"}));
    form.append(notes);
  }
  renderStock(form, readOnly);
  if (!readOnly) form.append(button("Keep draft in this tab", () => guard(() => {
    if (!form.reportValidity()) return; validateItem(item);
    validateStock(current().stock);
    notice("Draft checked and kept in this tab. Nothing was uploaded.");
  }), "button primary save-draft"));
  host.append(form);
}
$("#new-item").onclick = () => {
  const category = current().item.identity.category || ""; selected = "new-" + crypto.randomUUID();
  drafts.set(selected, {item: newItem(category), projectValues: {}, stock: null}); mode = "edit"; render();
  $("#item-form input").focus(); notice("New item. Category inherited from the selected example; change it if needed.");
};
window.addEventListener("beforeunload", event => {if (changed) {event.preventDefault(); event.returnValue = "";}});
if (preview) render(); else await loadSavedRecords();
}
