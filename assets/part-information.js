import {fieldDisclosure} from "./field-disclosure.js";
import {interfaceHelp} from "./interface-help.js";
// Part-detail presentation only. Writes stay in the controller's revision-checked
// onChange callback; displaying project annotations never modifies Workshop.
const make = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const present = value => value !== null && value !== undefined && String(value).trim() !== "";

export function renderPartInformation(target, {part, project: projectId, fields, ui, dialogs, suppliers, editable, linked, knowledge, onChange}) {
  target.replaceChildren();
  target.classList.add("ui-section-list");
  const reference = ui.informationPanel(linked ? "Workshop information" : "Part information", "reference");
  const project = ui.informationPanel("Project information", "project");
  const append = (panel, title, value) => {
    if (!present(value)) return null;
    const row = ui.fieldRow(title, value);
    panel.body.append(row.root);
    return row;
  };
  const note = (panel, text) => panel.body.append(make("p", "ui-information-note", text));
  if (linked) note(reference, part.familyUse ? "Family and selected product details from Workshop." : "Part details saved with this project. View in Workshop opens the reusable reference.");
  note(project, "These details apply only to this project and do not modify Workshop.");
  const functional = fields.itemTypeFor(part) === "part" && !part.generatedFrom;
  if (functional) {
    const row = append(project, "Container (name)", fields.treeDescriptionFor(part) || part.name);
    row.label.append(dialogs.tooltip("About container names", "The container is the permanent item in your project's feature tree. Its name identifies the role or purpose; the physical part can be replaced without losing its instructions, tests, revisions, or history."));
    append(project, part.familyUse ? "Project notes" : "Purpose", part.description);
  }
  if (part.familyUse) {
    append(reference, "Family", part.familyName);
    append(reference, "Selected product", part.productId ? part.implementationName : "No product selected");
  }
  append(project, "Revision", part.revisionLevel || 1);
  const projectLabels = new Set(["Status", "Quantity", "Part number", "Value", "Hidden from feature tree", "Feature tree description"]);
  const rows = fields.detailRows(part);
  for (const [title, value] of rows) {
    if (functional && ["Feature tree description", "Description"].includes(title)) continue;
    if (part.familyUse && title === "Part name") continue;
    append(projectLabels.has(title) ? project : reference, title, functional && title === "Part name" ? part.implementationName || value : value);
  }
  const specifications = part.familyUse ? part.workshopSpecifications || [] : part.specifications || [];
  for (const spec of specifications) {
    if (fields.isPurchased(part) && [...fields.sourcingLabels, "Supplier part number", "Public Workshop reference"].includes(spec.name)) continue;
    append(reference, spec.name || "Specification", (spec.value || "") + (spec.source === "inferred" ? " (inferred)" : ""));
  }
  for (const spec of part.projectSpecifications || []) append(project, "Required " + spec.name, spec.value + (spec.different ? " (differs from selected product; review)" : ""));
  const annotations = part.projectDetails || {};
  for (const [key, title] of [
    ["notes", "Project notes"], ["changes", "Project changes / modifications"],
    ["referenceDesignators", "Reference designators"], ["footprint", "Footprint"],
    ["schematicValue", "Schematic value"], ["sourceApplication", "Source application"],
    ["sourceFile", "Source schematic file"], ["sourceComponentId", "Source component ID"]
  ]) append(project, title, annotations[key]);
  const sourcing = fields.sourcingFor(part);
  if (sourcing.url) {
    const link = make("a", "", "Open order website");
    link.href = sourcing.url; link.target = "_blank"; link.rel = "noopener noreferrer";
    reference.body.append(ui.fieldRow("Part order website", link).root);
  }
  suppliers?.renderLinks(reference.body, part);
  if (editable && functional && part.partType === "purchased" && !linked && projectId) {
    const copy = ui.button("Copy to Workshop", () => {
      const query = new URLSearchParams({copyProject: projectId, copyPart: part.id, return: "#" + projectId + "/part/" + part.id});
      location.href = "workshop.html?" + query;
    }, {small: true});
    reference.body.append(copy, make("p", "ui-information-note", "Create a reusable product copy. This project part stays unchanged."));
  }
  if (functional && !part.familyUse && part.partType === "purchased") addAlternativeControls(project.body, {part, ui, dialogs, onChange, editable});
  if (part.familyUse) project.body.append(knowledge(part));
  target.append(reference.root, project.root);
}

function addAlternativeControls(target, {part, ui, dialogs, onChange, editable}) {
  const feedback = make("p", "ui-information-feedback");
  feedback.setAttribute("role", "status");
  const run = async (button, action, data) => {
    button.disabled = true; feedback.textContent = "Saving…";
    try { await onChange(action, data); }
    catch (error) { feedback.textContent = error.message; button.disabled = false; }
  };
  const candidates = (part.implementations || []).filter(item => !item.retiredAt && item.partType === "purchased");
  if (part.partType === "purchased" && (editable || candidates.length > 1)) {
    const alternatives = fieldDisclosure(ui, "Alternatives", candidates.length + (candidates.length === 1 ? " part" : " parts"));
    alternatives.disclosure.dataset.section = "part-alternatives";
    const help = dialogs.helpButton("About alternatives", interfaceHelp.partAlternatives);
    help.setAttribute("aria-label", "About alternatives"); alternatives.label.append(help);
    if (candidates.length > 1) {
      const select = make("select", "ui-control"); select.setAttribute("aria-label", "Select Alternative");
      for (const candidate of candidates) {
        const option = make("option", "", candidate.name + (candidate.model ? " · " + candidate.model : ""));
        option.value = candidate.id; select.append(option);
      }
      select.value = part.selectedImplementationId || ""; select.disabled = !editable;
      select.onchange = () => void run(select, "select", {implementation: {id: select.value}});
      alternatives.body.append(ui.fieldRow("Select Alternative", select).root);
    }
    const newForm = make("div", "ui-information-form"); newForm.hidden = true;
    const shortField = title => {
      const input = make("input", "ui-control"); input.maxLength = 180; input.setAttribute("aria-label", title);
      newForm.append(ui.fieldRow(title, input).root); return input;
    };
    const name = shortField("Part name"), model = shortField("Manufacturer part number"), manufacturer = shortField("Manufacturer");
    const commit = ui.button("Add and select alternative", () => {
      if (!name.value.trim()) { feedback.textContent = "Enter a part name."; name.focus(); return; }
      void run(commit, "add", {implementation: {name: name.value, partType: "purchased", model: model.value, manufacturer: manufacturer.value}});
    }, {variant: "primary", small: true});
    const add = ui.button("Add alternative", () => { newForm.hidden = false; add.hidden = true; name.focus(); }, {small: true});
    add.hidden = !editable;
    const back = ui.button("Cancel", () => { newForm.hidden = true; add.hidden = false; }, {small: true});
    ui.sectionActions(newForm, {primary: commit, secondary: [back]});
    alternatives.body.append(add, newForm); target.append(alternatives.root);
  }
  target.append(feedback);
}
