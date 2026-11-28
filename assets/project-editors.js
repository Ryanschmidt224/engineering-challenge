import { projectNumber } from "./project-identity.js";
import { projectNameConfirmation } from "./project-name-confirmation.js";
import { workshopPartEditor } from "./project-workshop-editor.js";
import {
  customFields,
  purchaseFields,
  fieldHelp,
  sourceChoices,
  statusChoices,
} from "./project-item-fields.js";
import { identityNameLink } from "./project-identity-link.js";
import { projectDeletionSection } from "./project-delete.js?v=project-numbers-20261128";
import { recordLabels } from "./project-presentation.js";
import { projectTree } from "./project-tree-model.js";
import { partHistoryPrompt } from "./project-part-history.js";
import { partHelp } from "./part-help.js";
import { projectHelp } from "./project-help.js";
import {
  node,
  field,
  checkbox,
  actions,
} from "./workshop-ui.js?v=save-upload-20261128";
import {
  normalizeCustomItem,
  normalizeOccurrence,
  diffCustomItems,
  formatRevisionValue,
  allocatePartNumber,
} from "./project-item-model.js?v=cad-links-20261128";
import {
  recordPrompts,
  normalizeProjectRecord,
} from "./project-record-model.js";
import { instructionTree, recordTree } from "./project-instruction-model.js";
import { recordAttachments } from "./project-record-attachments.js";
import { automaticBackupSection } from "./project-backup-settings.js";
import {
  websiteSettings,
  ownerChoices,
} from "./website-settings-client.js?v=offsite-backup-20261128";
export const detailsFor = (item) =>
  normalizeCustomItem({
    name: item.name,
    short_name: item.short_name,
    part_number: item.part_number,
    kind: item.kind,
    source: item.source,
    is_tool: !!item.is_tool,
    is_assembly: !!item.is_assembly,
    fields: item.fields,
  });
export const buildFor = (occ) =>
  normalizeOccurrence({
    quantity: occ.quantity,
    unit: occ.unit,
    build_status: occ.build_status,
    attention: !!occ.attention,
    attention_note: occ.attention_note,
    hidden: !!occ.hidden,
  });
const button = (...args) => window.BSUI.button(...args);
function editorGroup(title, ...rows) {
  const group = node("fieldset", "", "ui-editor-group");
  group.append(node("legend", title), ...rows);
  return group;
}
function containerField(details, update) {
  const row = field(
    "Part Name (Generic)",
    details.short_name,
    (value) => {
      details.short_name = value;
      update();
    },
    { placeholder: "e.g. Power supply" },
  );
  row.querySelector("input").maxLength = 20;
  fieldHelp(
    row,
    "Part Name (Generic)",
    "Use a category-style name, such as Power supply or Motor mounting plate. Use up to 20 characters. The specific name identifies a particular model or version.",
  );
  return row;
}
export function editable(
  ctx,
  title,
  saveLabel,
  collect,
  save,
  {
    confirmation = false,
    beforeSave = null,
    review = null,
    mount = null,
    initialRevision = ctx.client.state?.project.revision ?? null,
  } = {},
) {
  const dialog = ctx.dialog,
    form = node("form"),
    fields = node("div"),
    error = node("p", "", "error"),
    reviewArea = node("div"),
    saveButton = button(saveLabel, () => form.requestSubmit(), {
      variant: "primary",
    });
  error.setAttribute("role", "alert");
  let revision = initialRevision,
    busy = false,
    uploading = false;
  const close = () => {
    if (!busy && !uploading)
      if (mount) void ctx.navigate(ctx.projectId);
      else dialog.close();
  };
  const cancel = button("Cancel", close),
    reload = button("Review newer changes", async () => {
      try {
        const state = await ctx.client.load(ctx.projectId);
        reviewArea.replaceChildren(
          node("h3", "Current saved version and your draft"),
        );
        if (review) reviewArea.append(review(state));
        else
          reviewArea.append(
            node(
              "p",
              "The project now uses a newer saved version. Review your fields before saving.",
            ),
          );
        const latest = state.project.revision;
        reviewArea.append(
          button("Use newer version after review", () => {
            revision = latest;
            error.textContent =
              "Your draft is retained. Save when your review is complete.";
            saveButton.textContent = "Save reviewed changes";
            reload.hidden = true;
            reviewArea.replaceChildren();
          }),
        );
      } catch (problem) {
        error.textContent = problem.message;
      }
    });
  reload.hidden = true;
  const scroll = node("div", "", "project-editor-scroll"),
    footer = actions(saveButton, cancel);
  footer.classList.add("project-editor-actions");
  scroll.append(fields, error, reload, reviewArea);
  form.append(scroll, footer);
  form.classList.add("project-editor-form", "ui-editor-fields");
  form.onsubmit = async (event) => {
    event.preventDefault();
    if (busy || uploading) return;
    error.textContent = "";
    try {
      const data = collect();
      busy = true;
      saveButton.disabled = true;
      saveButton.textContent = "Saving…";
      form.setAttribute("aria-busy", "true");
      cancel.disabled = true;
      if (beforeSave && !(await beforeSave(data))) return;
      await save(data, revision);
      if ((await ctx.refresh()) === false)
        throw Error(
          "Saved, but the part could not be reopened. Retry this same save.",
        );
      ctx.client.acknowledge?.(ctx.projectId);
      if (!mount) dialog.close();
    } catch (problem) {
      error.textContent = problem.message;
      if (problem.status === 401 && ctx.signIn)
        error.append(button("Log in again", () => ctx.signIn()));
      reload.hidden = problem.status !== 409;
    } finally {
      busy = false;
      form.removeAttribute("aria-busy");
      saveButton.textContent = saveLabel;
      saveButton.disabled = uploading;
      cancel.disabled = uploading;
    }
  };
  if (mount) {
    if (!dialog.open) dialog.replaceChildren();
    mount.replaceChildren(node("h2", title), form);
  } else {
    dialog.classList.remove("bs-confirmation");
    dialog.removeAttribute("aria-labelledby");
    dialog.classList.add("project-editor-dialog");
    dialog.oncancel = (event) => {
      if (busy || uploading) event.preventDefault();
    };
    dialog.replaceChildren(node("h2", title), form);
    if (confirmation) {
      footer.replaceChildren(cancel, saveButton);
      window.BSConfirmation.frame(dialog, {
        title,
        content: scroll,
        actions: footer,
        form,
      });
    }
    dialog.setAttribute("aria-label", title);
    queueMicrotask(() => {
      dialog.showModal();
      if (confirmation) cancel.focus();
      else dialog.querySelector("input,textarea,select")?.focus();
    });
  }
  return {
    fields,
    form,
    saveButton,
    error,
    get revision() {
      return revision;
    },
    acceptOwnWrites(token = ctx.client.state.project.revision) {
      revision = token;
    },
    uploadBusy(value) {
      uploading = value;
      saveButton.disabled = busy || uploading;
      cancel.disabled = busy || uploading;
    },
    handleError(problem) {
      error.textContent = problem.message;
      if (problem.status === 401 && ctx.signIn)
        error.append(button("Log in again", () => ctx.signIn()));
      reload.hidden = problem.status !== 409;
    },
  };
}
function changeRows(changes) {
  const area = node("div");
  if (!changes.length) area.append(node("p", "No changes."));
  for (const change of changes)
    area.append(
      window.BSUI.fieldRow(
        change.label,
        formatRevisionValue(change.before) +
          " → " +
          formatRevisionValue(change.after),
      ).root,
    );
  return area;
}
export function editItem(
  ctx,
  item = null,
  occurrence = null,
  { assembly = false, parentId = null } = {},
) {
  const before = item ? detailsFor(item) : null,
    details = before
      ? structuredClone(before)
      : {
          name: "",
          short_name: "",
          part_number: "",
          kind: "part",
          source: "custom",
          is_tool: false,
          ...(assembly ? { is_assembly: true } : {}),
          fields: { specs: [] },
        },
    build = occurrence ? buildFor(occurrence) : normalizeOccurrence({});
  let assignNumber = true;
  details.fields.specs ||= [];
  if (!item && !assembly) details.fields.supply = "made";
  const collect = () => ({
    details: normalizeCustomItem(
      !item && assignNumber
        ? {
            ...details,
            part_number: allocatePartNumber(
              ctx.client.state.project,
              ctx.client.state.items.map((row) => row.part_number),
              !!details.is_assembly,
            ),
          }
        : details,
    ),
    build: normalizeOccurrence(build),
    ...(!item ? { assignNumber, parentId } : { occurrenceId: occurrence.id }),
  });
  const editor = editable(
    ctx,
    item ? "Edit part details" : assembly ? "Add subassembly" : "New part",
    item ? "Save" : assembly ? "Add subassembly" : "Add part",
    collect,
    async (data, token) => {
      await ctx.client.write(
        ctx.projectId,
        item ? "/items/" + item.id : "/items",
        item ? "PATCH" : "POST",
        data,
        token,
      );
    },
    {
      review: (state) => {
        const current = state.items.find((row) => row.id === item?.id);
        return current
          ? changeRows(diffCustomItems(detailsFor(current), details))
          : node(
              "p",
              "This item is archived. Cancel and inspect History → Archive.",
            );
      },
    },
  );

  const update = () => {};
  editor.saveButton.title = item
    ? partHelp.save
    : "Save this new part to the project.";
  const container = editorGroup("Part identity"),
    part = editorGroup("Part details"),
    display = editorGroup("Display options");
  if (!item)
    container.append(
      parentPicker(ctx, parentId, (value) => (parentId = value)),
    );
  const source = field(
    "Part source",
    details.fields.supply || "made",
    (value) => {
      details.fields.supply = value;
      updateSource();
    },
    { options: sourceChoices },
  );
  const purchase = editorGroup("Purchasing", purchaseFields(details.fields));
  if (!item)
    purchase.append(
      button("Choose from Workshop", () =>
        workshopPartEditor(ctx, { parentId }),
      ),
    );
  const updateSource = () => {
    const physical = details.kind === "part" && !details.is_assembly;
    source.hidden = !physical;
    purchase.hidden =
      !physical || (details.fields.supply || "made") !== "purchased";
    for (const input of purchase.querySelectorAll("input"))
      input.disabled = purchase.hidden;
  };
  if (!details.is_assembly)
    container.append(
      field(
        "Item type",
        details.is_tool ? "tool" : details.kind,
        (value) => {
          details.kind = value === "tool" ? "part" : value;
          details.is_tool = value === "tool";
          updateSource();
        },
        {
          options: [
            { value: "part", label: "Part" },
            { value: "tool", label: "Tool" },
            { value: "document", label: "Document" },
            { value: "code", label: "Code" },
          ],
        },
      ),
      source,
    );
  const generic = containerField(details, update);
  container.append(
    generic,
    field(
      "Purpose (optional)",
      details.fields.purpose || "",
      (value) => {
        details.fields.purpose = value;
      },
      {
        type: "textarea",
        placeholder: "What does this item need to accomplish?",
      },
    ),
  );
  const numberRow = field(
    "Part number",
    details.part_number,
    (value) => (details.part_number = value),
  );
  numberRow.hidden = !item;
  if (item) numberRow.querySelector("input").readOnly = true;
  if (!item) {
    const auto = checkbox("Auto assign part number", true, (value) => {
      assignNumber = value;
      numberRow.hidden = value;
    });
    fieldHelp(
      auto,
      "Auto assign part number",
      "Assigns the next available project part number. Uncheck to enter your own unused number.",
    );
    container.append(auto);
  }
  container.append(numberRow);
  const specific = field(
      "Part Name (Specific)",
      details.name,
      (value) => (details.name = value),
      { required: true },
    ),
    description = field(
      "Description",
      details.fields.description || "",
      (value) => (details.fields.description = value),
      { type: "textarea" },
    );
  part.append(
    identityNameLink(
      details,
      generic.querySelector("input"),
      specific.querySelector("input"),
      { creating: !item, rows: [specific, description] },
    ),
    specific,
    description,
  );
  for (const [key, title] of [
    ["manufacturer", "Manufacturer"],
    ["mpn", "Mfg part number"],
  ])
    part.append(
      field(
        title,
        details.fields[key] || "",
        (value) => (details.fields[key] = value),
      ),
    );
  part.append(customFields(details.fields.specs));
  const attentionNote = field(
    "Attention note",
    build.attention_note,
    (value) => (build.attention_note = value),
    { type: "textarea" },
  );
  attentionNote.hidden = !build.attention;
  const hidden = checkbox(
    "Hide from feature tree?",
    build.hidden,
    (value) => (build.hidden = value),
  );
  fieldHelp(
    hidden,
    "Hide from feature tree",
    "Hides this item from the normal feature tree without deleting it. Show hidden items to find it again.",
  );
  display.append(
    field("Quantity", build.quantity, (value) => (build.quantity = value), {
      type: "number",
    }),
    field("Unit", build.unit, (value) => (build.unit = value)),
    field(
      "Status",
      build.build_status,
      (value) => (build.build_status = value),
      { options: statusChoices },
    ),
    checkbox("Needs attention", build.attention, (value) => {
      build.attention = value;
      attentionNote.hidden = !value;
    }),
    attentionNote,
    hidden,
  );
  updateSource();
  editor.fields.append(container, part, purchase, display);
  if (item) {
    const revision = button("Save as revision", () => {
      try {
        if (!editor.form.reportValidity()) return;
        const changes = collect();
        partHistoryPrompt(ctx, item, revision, {
          changes,
          expectedRevision: editor.revision,
          onOwnUpload: (token) => editor.acceptOwnWrites(token),
          onComplete: () => ctx.dialog.close(),
        });
      } catch (problem) {
        editor.error.textContent = problem.message;
      }
    });
    revision.title = partHelp.saveAsRevision;
    editor.saveButton.after(revision);
  }
  update();
}
export function editRecord(
  ctx,
  { record = null, stepId = null, parentRecordId = null } = {},
) {
  let draft = record
    ? {
        type: record.type,
        title: record.title,
        fields: structuredClone(record.fields),
        event_date: record.event_date,
        fileIds: ctx.client.state.file_links
          .filter((link) => link.record_id === record.id && link.active)
          .map((link) => link.file_id),
      }
    : { type: "test", title: "", fields: {}, event_date: null, fileIds: [] };
  parentRecordId = record?.parent_record_id || parentRecordId;
  stepId = record?.step_id || stepId;
  const promptArea = node("div"),
    attachments = node("div"),
    render = () => {
      promptArea.replaceChildren();
      for (const [key, title] of Object.entries(recordPrompts[draft.type])) {
        const label =
          key === "resolution" && draft.fields.did_fix
            ? draft.fields.did_fix === "no"
              ? "Why?"
              : "How?"
            : title;
        promptArea.append(
          field(
            label,
            draft.fields[key] || "",
            (value) => (draft.fields[key] = value),
            { type: "textarea" },
          ),
        );
      }
      if (draft.type === "problem")
        promptArea.append(
          field(
            "Did you fix it?",
            draft.fields.did_fix || "",
            (value) => {
              const previous = draft.fields.did_fix;
              if (previous && value && (value === "no") !== (previous === "no"))
                draft.fields.resolution = "";
              if (value) draft.fields.did_fix = value;
              else delete draft.fields.did_fix;
              render();
            },
            {
              options: [
                { value: "", label: "Not recorded" },
                { value: "yes", label: "Yes" },
                { value: "no", label: "No" },
                { value: "maybe", label: "Maybe" },
              ],
            },
          ),
        );
      attachments.replaceChildren(recordAttachments(ctx, draft, editor));
    };
  const editor = editable(
    ctx,
    record ? "Edit entry" : "Add entry",
    "Save entry",
    () => ({
      record: normalizeProjectRecord(draft),
      parentRecordId,
      occurrenceId: ctx.occurrenceId || undefined,
      ...(stepId ? { stepId } : {}),
    }),
    async (data, token) =>
      ctx.client.write(
        ctx.projectId,
        record ? "/records/" + record.id : "/items/" + ctx.itemId + "/records",
        record ? "PATCH" : "POST",
        data,
        token,
      ),
    {
      review: (state) => {
        const current = state.records.find((row) => row.id === record?.id);
        return node(
          "p",
          JSON.stringify({ saved: current || "New record", draft }, null, 2),
          "project-instruction-text",
        );
      },
    },
  );
  editor.fields.append(
    node("p", projectHelp.changeRecord),
    field(
      "Entry type",
      draft.fields.category === "photos" ? "photos" : draft.type,
      (value) => {
        draft.type = value === "photos" ? "note" : value;
        draft.fields = value === "photos" ? { category: "photos" } : {};
        render();
      },
      {
        options: [
          ...Object.entries(recordLabels).map(([value, label]) => ({
            value,
            label,
          })),
          { value: "photos", label: "Photos" },
        ],
      },
    ),
    field("Title (optional)", draft.title, (value) => (draft.title = value)),
    promptArea,
    attachments,
  );
  if (stepId) {
    const records = ctx.client.state.records.filter(
        (row) => row.step_id === stepId,
      ),
      tree = recordTree(records),
      excluded = new Set(record ? tree.descendants(record.id) : []);
    editor.fields.append(
      field(
        "Parent entry",
        parentRecordId || "",
        (value) => (parentRecordId = value || null),
        {
          options: [
            { value: "", label: "Top-level entry" },
            ...records
              .filter((row) => !excluded.has(row.id))
              .map((row) => ({ value: row.id, label: row.title })),
          ],
        },
      ),
    );
  }
  render();
}
export function editStep(
  ctx,
  step = null,
  { parentId = null, isGroup = false } = {},
) {
  const draft = {
      title: step?.title || "",
      body: step?.body || "",
      parentId: step?.parent_id || parentId,
      ...(!step ? { isGroup } : {}),
    },
    tree = instructionTree(
      ctx.client.state.steps.filter((row) => row.item_id === ctx.itemId),
    ),
    excluded = new Set(step ? tree.subtree(step.id).map((row) => row.id) : []),
    editor = editable(
      ctx,
      step ? "Edit step" : isGroup ? "Add instruction group" : "Add step",
      "Save step",
      () => ({ ...draft }),
      (data, token) =>
        ctx.client.write(
          ctx.projectId,
          step ? "/steps/" + step.id : "/items/" + ctx.itemId + "/steps",
          step ? "PATCH" : "POST",
          data,
          token,
        ),
      {
        review: (state) => {
          const current = state.steps.find((row) => row.id === step?.id);
          return node(
            "p",
            JSON.stringify(
              { saved: current || "New instruction", draft },
              null,
              2,
            ),
            "project-instruction-text",
          );
        },
      },
    );
  editor.fields.append(
    field("Step title", draft.title, (value) => (draft.title = value), {
      required: true,
    }),
    field("Instructions", draft.body, (value) => (draft.body = value), {
      type: "textarea",
    }),
  );
  editor.fields.append(
    field(
      "Instruction group",
      draft.parentId || "",
      (value) => (draft.parentId = value || null),
      {
        options: [
          { value: "", label: "No group" },
          ...[...tree.byId.values()]
            .filter(
              (row) =>
                row.is_group && tree.active(row) && !excluded.has(row.id),
            )
            .map((row) => ({ value: row.id, label: row.title })),
        ],
      },
    ),
  );
  editor.saveButton.title =
    "Overwrite this working instruction without creating a revision.";
  if (step) {
    const revision = button("Save as revision", () => {
      if (!editor.form.reportValidity()) return;
      if (
        draft.title.trim() === step.title &&
        draft.body.trim() === step.body &&
        draft.parentId === step.parent_id
      ) {
        editor.error.textContent =
          "No instruction changes to save. Use Create a Revision to capture the unchanged saved scope.";
        return;
      }
      const item = ctx.client.state.items.find((row) => row.id === ctx.itemId);
      partHistoryPrompt(ctx, item, revision, {
        scope: step,
        path: "/steps/" + step.id + "/revisions",
        changes: { ...draft },
        expectedRevision: editor.revision,
        onOwnUpload: (token) => editor.acceptOwnWrites(token),
        onComplete: () => ctx.dialog.close(),
      });
    });
    revision.title =
      "Preserve the saved instruction scope in revision history, then save these edits.";
    editor.saveButton.after(revision);
  }
}
export function retireInstruction(ctx, step) {
  let reason = "";
  const editor = editable(
    ctx,
    "Archive step",
    "Archive step",
    () => ({ reason }),
    (data, token) =>
      ctx.client.write(
        ctx.projectId,
        "/steps/" + step.id + "/retire",
        "POST",
        data,
        token,
      ),
    { confirmation: true },
  );
  editor.fields.append(
    node(
      "p",
      'Archive "' +
        step.title +
        '"' +
        (step.is_group ? " and its nested instructions" : "") +
        "? Its records, files and revisions remain available.",
    ),
    field("Archive reason (optional)", reason, (value) => (reason = value), {
      type: "textarea",
    }),
  );
}
const settingsDrafts = new WeakMap();
export function projectSettings(ctx, { create = false, mount = null } = {}) {
  const newProjectId = create ? crypto.randomUUID() : null;
  const project = create
      ? {
          name: "",
          prefix: "NR",
          digits: 3,
          owner_name: websiteSettings().defaultOwner,
        }
      : ctx.client.state.project,
    draft = {
      name: project.name,
      prefix: project.prefix,
      digits: project.digits,
      owner_name: project.owner_name || "Ryan",
    };
  let saved = settingsDrafts.get(ctx.client);
  if (mount && saved?.projectId === ctx.projectId)
    Object.assign(draft, saved.draft);
  else saved = { projectId: ctx.projectId, draft, revision: project.revision };
  if (mount) settingsDrafts.set(ctx.client, { ...saved, draft });
  const editor = editable(
    ctx,
    create ? "New project" : "Project settings",
    create ? "Create project" : "Save settings",
    () => draft,
    async (data, token) => {
      if (create) {
        const projectId = newProjectId;
        await ctx.client.write(projectId, "", "POST", data, null);
        await ctx.navigate(projectId);
      } else {
        await ctx.client.write(ctx.projectId, "", "PATCH", data, token);
        settingsDrafts.delete(ctx.client);
      }
    },
    {
      mount,
      beforeSave: projectNameConfirmation(
        ctx,
        newProjectId || ctx.projectId,
        () => name.querySelector("input"),
        create ? null : project.name,
      ),
      initialRevision: mount
        ? saved.revision
        : (ctx.client.state?.project.revision ?? null),
    },
  );
  if (mount)
    editor.form.querySelectorAll("button").forEach((control) => {
      if (control.textContent === "Cancel")
        control.addEventListener(
          "click",
          () => settingsDrafts.delete(ctx.client),
          { capture: true },
        );
    });
  const preview = node("p", "", "muted"),
    reserved = create
      ? []
      : ctx.client.state.items.map((item) => item.part_number),
    updatePreview = () => {
      try {
        preview.textContent =
          "Next subassembly: " +
          allocatePartNumber(draft, reserved, true) +
          " · Next part: " +
          allocatePartNumber(draft, reserved) +
          ". Existing numbers stay unchanged.";
      } catch (error) {
        preview.textContent = error.message;
      }
    };
  preview.dataset.numberPreview = "";
  preview.setAttribute("aria-live", "polite");
  editor.fields.append(
    node(
      "p",
      create
        ? "Project number is assigned automatically when saved."
        : "Project number: " + projectNumber(project),
      "muted",
    ),
  );
  const name = field(
      "Project name",
      draft.name,
      (value) => (draft.name = value),
      { required: true },
    ),
    prefix = field("Number prefix", draft.prefix, (value) => {
      draft.prefix = value;
      updatePreview();
    }),
    digits = field(
      "Minimum digits",
      draft.digits,
      (value) => {
        draft.digits = value;
        updatePreview();
      },
      { type: "number" },
    );
  name.querySelector("input").maxLength = 180;
  prefix.querySelector("input").maxLength = 10;
  digits.querySelector("input").min = 1;
  digits.querySelector("input").max = 8;
  digits.querySelector("input").step = 1;
  editor.fields.append(
    name,
    node("p", "Project names can contain up to 180 characters.", "muted"),
    prefix,
    digits,
    preview,
  );
  updatePreview();
  prefix.before(
    field(
      "Project owner",
      draft.owner_name,
      (value) => (draft.owner_name = value),
      {
        options: ownerChoices([draft.owner_name]).map((value) => ({
          value,
          label: value,
        })),
      },
    ),
  );
  if (!create)
    editor.fields.append(
      automaticBackupSection(ctx),
      projectDeletionSection(ctx, project),
    );
}
export function confirmAction(ctx, title, message, label, save) {
  const editor = editable(
    ctx,
    title,
    label,
    () => ({}),
    (data, token) => save(token),
    { confirmation: true },
  );
  editor.fields.append(node("p", message));
}

export function parentPicker(ctx, value, change, excluded = []) {
  const state = ctx.client.state,
    tree = projectTree(state.items, state.occurrences);
  return field(
    "Parent subassembly",
    value || "",
    (value) => change(value || null),
    {
      options: [
        { value: "", label: state.project.name },
        ...state.occurrences
          .filter(
            (row) =>
              tree.active(row) &&
              tree.definitions.get(row.item_id).is_assembly &&
              !excluded.includes(row.id),
          )
          .map((row) => ({
            value: row.id,
            label: tree
              .path(row)
              .map((part) => part.name)
              .join(" / "),
          })),
      ],
    },
  );
}
export function placementEditor(
  ctx,
  { occurrence = null, parentId = null } = {},
) {
  const state = ctx.client.state,
    tree = projectTree(state.items, state.occurrences),
    candidates = [...tree.placements.values()].filter(tree.active),
    draft = {
      sourceOccurrenceId: candidates[0]?.id || "",
      parentId: occurrence?.parent_id || parentId,
      build: occurrence ? buildFor(occurrence) : normalizeOccurrence({}),
    };
  const editor = editable(
    ctx,
    occurrence ? "Move placement" : "Add existing part placement",
    occurrence ? "Save location" : "Add placement",
    () => draft,
    async (data, token) => {
      const source = tree.placements.get(data.sourceOccurrenceId);
      if (!occurrence && !source) throw Error("Choose an existing placement.");
      await ctx.client.write(
        ctx.projectId,
        occurrence
          ? "/occurrences/" + occurrence.id
          : "/items/" + source.item_id + "/placements",
        occurrence ? "PATCH" : "POST",
        data,
        token,
      );
    },
  );
  editor.fields.append(
    node(
      "p",
      "Engineering details are shared by placements of the same part. Quantity, location and build status belong to each placement. Adding a subassembly also adds its active child placements.",
    ),
  );
  if (!occurrence)
    editor.fields.append(
      field(
        "Existing part placement",
        draft.sourceOccurrenceId,
        (value) => (draft.sourceOccurrenceId = value),
        {
          options: candidates.map((row) => ({
            value: row.id,
            label: tree
              .path(row)
              .map((part) => part.name)
              .join(" / "),
          })),
        },
      ),
    );
  editor.fields.append(
    parentPicker(
      ctx,
      draft.parentId,
      (value) => (draft.parentId = value),
      occurrence
        ? tree
            .subtree(occurrence.id, { includeRemoved: true })
            .map((row) => row.id)
        : [],
    ),
    field(
      "Quantity",
      draft.build.quantity,
      (value) => (draft.build.quantity = value),
      { type: "number" },
    ),
  );
}
