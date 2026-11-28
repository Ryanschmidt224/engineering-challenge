import { recordLabels } from "./project-presentation.js";
import { node } from "./workshop-ui.js?v=save-upload-20261128";
import { diffCustomItems, formatRevisionValue } from "./project-item-model.js";
import { recordPrompts } from "./project-record-model.js";
import { instructionTree } from "./project-instruction-model.js";
import { detailsFor } from "./project-editors.js?v=save-upload-20261128";

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const side = (value) =>
  value === undefined ? { present: false } : { present: true, value };
function displayValue(value, other) {
  let result = formatRevisionValue(value);
  if (value.label) result = value.label + ": " + result;
  if (
    value.present &&
    other.present &&
    typeof value.value !== typeof other.value &&
    formatRevisionValue(value) === formatRevisionValue(other)
  )
    result +=
      " (" +
      ({ string: "text", number: "number", boolean: "yes/no" }[
        typeof value.value
      ] || "value") +
      ")";
  return result;
}
function row(changes, label, before, after) {
  if (!same(before, after))
    changes.push({ label, before: side(before), after: side(after) });
}
function filesFor(record, links, files) {
  const ids = links
      .filter((link) => link.record_id === record.id && link.active)
      .map((link) => link.file_id)
      .sort(),
    names = Object.entries(record.fields.attachments || {}).flatMap(
      ([prompt, rows]) => rows.map((entry) => ({ ...entry, prompt })),
    );
  return ids.map((id) => {
    const fallback =
        files.find((file) => file.id === id)?.name || "Saved attachment",
      named = names
        .filter((entry) => entry.id === id)
        .map(
          (entry) =>
            (recordPrompts[record.type]?.[entry.prompt] || "Supporting files") +
            ": " +
            (entry.name || fallback),
        )
        .sort();
    return { id, name: named.join(" / ") || fallback };
  });
}
function stepChanges(saved, current, changes) {
  const oldSteps = new Map(saved.map((step) => [step.id, step])),
    newSteps = new Map(current.map((step) => [step.id, step]));
  for (const id of new Set([...oldSteps.keys(), ...newSteps.keys()])) {
    const before = oldSteps.get(id),
      after = newSteps.get(id),
      label = (after?.title || before.title) + " — ";
    row(
      changes,
      label + "in this scope",
      before ? "Included" : undefined,
      after ? "Included" : undefined,
    );
    if (!before || !after) continue;
    for (const [key, title] of [
      ["title", "Title"],
      ["body", "Instructions"],
      ["revision_level", "Revision"],
      ["sort_order", "Order"],
    ])
      row(
        changes,
        label + title,
        key === "sort_order" ? before[key] + 1 : before[key],
        key === "sort_order" ? after[key] + 1 : after[key],
      );
    // Compare stable parent identities; names are display values, never identity.
    if (before.parent_id !== after.parent_id)
      row(
        changes,
        label + "Parent group",
        oldSteps.get(before.parent_id)?.title ||
          (before.parent_id ? "Saved parent outside this scope" : "No group"),
        newSteps.get(after.parent_id)?.title ||
          (after.parent_id ? "New parent outside this scope" : "No group"),
      );
    row(
      changes,
      label + "State",
      before.retired_at ? "Archived" : "Active",
      after.retired_at ? "Archived" : "Active",
    );
  }
}
function recordChanges(saved, current, snapshot, state, changes) {
  const beforeMap = new Map(saved.map((record) => [record.id, record])),
    afterMap = new Map(current.map((record) => [record.id, record]));
  for (const id of new Set([...beforeMap.keys(), ...afterMap.keys()])) {
    const before = beforeMap.get(id),
      after = afterMap.get(id),
      label = (after?.title || before.title) + " — ";
    row(
      changes,
      label + "in this scope",
      before ? "Included" : undefined,
      after ? "Included" : undefined,
    );
    if (!before || !after) continue;
    row(changes, label + "Title", before.title, after.title);
    row(
      changes,
      label + "Type",
      before.fields.category === "photos"
        ? "Photos"
        : recordLabels[before.type],
      after.fields.category === "photos" ? "Photos" : recordLabels[after.type],
    );
    const prompts = {
      ...recordPrompts[before.type],
      ...recordPrompts[after.type],
      status: "Status",
      did_fix: "Did you fix it?",
    };
    for (const [key, title] of Object.entries(prompts))
      row(changes, label + title, before.fields[key], after.fields[key]);
    if (before.parent_record_id !== after.parent_record_id)
      row(
        changes,
        label + "Parent entry",
        beforeMap.get(before.parent_record_id)?.title || "Top-level entry",
        afterMap.get(after.parent_record_id)?.title || "Top-level entry",
      );
    if (before.step_id !== after.step_id)
      row(
        changes,
        label + "Instruction",
        snapshot.steps.find((step) => step.id === before.step_id)?.title,
        state.steps.find((step) => step.id === after.step_id)?.title,
      );
    row(
      changes,
      label + "Order",
      before.sort_order === undefined ? undefined : before.sort_order + 1,
      after.sort_order === undefined ? undefined : after.sort_order + 1,
    );
    if (snapshot.file_links && snapshot.files) {
      const oldFiles = filesFor(before, snapshot.file_links, snapshot.files),
        newFiles = filesFor(after, state.file_links, state.files);
      if (!same(oldFiles, newFiles))
        changes.push({
          label: label + "Attachments (file or name changed)",
          before: side(oldFiles.map((file) => file.name).join(" · ") || "None"),
          after: side(newFiles.map((file) => file.name).join(" · ") || "None"),
        });
    }
  }
}
export function comparisonRows(snapshot, state) {
  const current = state.items.find((item) => item.id === snapshot.item?.id);
  if (!current) return null;
  const changes = [];
  if (!snapshot.scope)
    return diffCustomItems(detailsFor(snapshot.item), detailsFor(current));
  const steps = state.steps.filter((step) => step.item_id === current.id),
    root = steps.find((step) => step.id === snapshot.scope.id),
    working = root ? instructionTree(steps).subtree(root.id) : [],
    ids = new Set(working.map((step) => step.id));
  stepChanges(snapshot.steps || [], working, changes);
  recordChanges(
    snapshot.records || [],
    state.records.filter((record) => ids.has(record.step_id)),
    snapshot,
    state,
    changes,
  );
  return changes;
}
export function savedComparison(ctx, event) {
  const snapshot = event.payload.snapshot;
  if (!snapshot?.item) return null;
  const title = snapshot.scope
      ? "Compare saved instruction scope with working scope"
      : "Compare saved part details with working part details",
    section = window.BSUI.section({
      title,
      role: "history-comparison",
      countLabel: ["difference", "differences"],
    });
  let rendered = false;
  section.root.addEventListener("toggle", () => {
    if (!section.root.open || rendered) return;
    rendered = true;
    try {
      const rows = comparisonRows(snapshot, ctx.client.state);
      if (rows === null) {
        section.body.append(
          node(
            "p",
            "The working part is unavailable. The saved copy remains readable below.",
          ),
        );
        return;
      }
      section.body.append(
        node(
          "p",
          snapshot.scope
            ? "Includes instruction text, membership/order and record fields/attachments in this scope."
            : "Compares part detail fields. Saved instructions, records and files remain available in the copy below.",
          "muted",
        ),
      );
      if (!rows.length)
        section.body.append(
          node("p", "No differences in the compared fields."),
        );
      for (const change of rows) {
        const panel = window.BSUI.informationPanel(change.label);
        panel.body.append(
          window.BSUI.fieldRow(
            "Saved",
            displayValue(change.before, change.after),
          ).root,
          window.BSUI.fieldRow(
            "Working",
            displayValue(change.after, change.before),
          ).root,
        );
        section.body.append(panel.root);
      }
      section.setCount(rows.length);
    } catch (error) {
      section.body.append(
        node("p", "Comparison unavailable: " + error.message),
      );
    }
  });
  return section.root;
}
