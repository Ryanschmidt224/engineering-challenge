import { recordLabels, cadFileLabel } from "./project-presentation.js";
import {
  information,
  configurationView,
  fileLink,
  savedPartView,
  buildContextView,
  recordVersionView,
} from "./project-information.js";
import { node, field, actions, listCard } from "./workshop-ui.js";
import { formatRevisionValue } from "./project-item-model.js";
import { recordPrompts } from "./project-record-model.js";
import { projectHelp } from "./project-help.js";
import { initSplitPanes } from "./split-panes.js";
import { editRecord, confirmAction } from "./project-editors.js";
import { instructionTree } from "./project-instruction-model.js";
import { savedComparison } from "./project-history-comparison.js";
const button = (...args) => window.BSUI.button(...args);
export const eventLabels = {
  ...recordLabels,
  instruction_revision: "Instruction revision",
  record_edited: "Record edited",
  revision: "Revision",
  archived: "Archived",
  file_replaced: "File change",
  removed: "Removed",
  restored: "Restored",
  step_retired: "Step archived",
  step_restored: "Step restored",
};

function entryCard(entry, select) {
  const row = listCard("", select);
  row.append(
    node(
      "strong",
      entry.type === "file_replaced"
        ? cadFileLabel(entry.display_title || entry.title)
        : entry.display_title || entry.title,
    ),
    node(
      "small",
      (eventLabels[entry.display_type || entry.type] || entry.type) +
        " · " +
        (entry.source_name || ""),
    ),
    node(
      "span",
      entry.type === "file_replaced"
        ? cadFileLabel(entry.outcome || entry.summary || "")
        : entry.outcome || entry.summary || "",
    ),
    node("small", new Date(entry.created_at).toLocaleString()),
  );
  row.dataset.eventId = entry.id;
  return row;
}
export async function showEvent(ctx, id, container) {
  const detail = await ctx.client.request(
      "/" + ctx.projectId + "/history/" + id,
    ),
    { event, record, configurations, attachments, recordContext } = detail,
    body = node("div", "", "project-stack");
  body.append(
    node(
      "h2",
      record?.title ||
        (event.type === "file_replaced"
          ? cadFileLabel(event.title)
          : event.title),
    ),
    node(
      "p",
      (eventLabels[record?.type || event.type] || event.type) +
        " · " +
        (event.payload.source?.name || ""),
      "muted",
    ),
  );
  if (record) {
    body.append(
      node("p", projectHelp.testedConfiguration),
      ...(record.type === "change_note"
        ? [node("p", projectHelp.changeRecord)]
        : []),
      recordVersionView(
        ctx,
        {
          ...record,
          fileIds: [...new Set(attachments.map((file) => file.id))],
        },
        "Record",
        attachments,
      ),
    );
    if (record.step_snapshot)
      body.append(
        information("Step when recorded", [
          ["Title", record.step_snapshot.title],
          ["Instructions", record.step_snapshot.body],
        ]),
      );
    const occurrence = ctx.client.state.occurrences.find(
      (row) => row.item_id === event.item_id,
    );
    if (occurrence?.removed_at === null)
      body.append(
        button("Edit entry", () =>
          editRecord({ ...ctx, itemId: event.item_id }, { record }),
        ),
      );
  }
  if (event.payload.record_edit) {
    const edit = event.payload.record_edit;
    body.append(
      recordVersionView(ctx, edit.before, "Before edit", attachments),
      recordVersionView(ctx, edit.after, "After edit", attachments),
      information("Edit information", [["Edited by", event.payload.actor_id]]),
    );
    if (event.payload.step_snapshot)
      body.append(
        information("Step when recorded", [
          ["Title", event.payload.step_snapshot.title],
          ["Instructions", event.payload.step_snapshot.body],
        ]),
      );
  }
  if (event.payload.record_structure) {
    const { before, after } = event.payload.record_structure;
    body.append(
      information("Entry location changed", [
        ["Previous parent entry", before.parent_title || "Top-level entry"],
        ["New parent entry", after.parent_title || "Top-level entry"],
      ]),
    );
  }
  if (recordContext)
    body.append(
      buildContextView(
        recordContext,
        recordContext.legacy
          ? "Build context from legacy snapshot"
          : "Build context when recorded",
      ),
    );
  const build = event.payload.build_context;
  if (build?.before && build?.after) {
    if (JSON.stringify(build.before) === JSON.stringify(build.after))
      body.append(buildContextView(build.after, "Build context at change"));
    else
      body.append(
        buildContextView(build.before, "Build context before revision"),
        buildContextView(build.after, "Build context after revision"),
      );
  }
  if (event.payload.snapshot) {
    const comparison = savedComparison(ctx, event);
    if (comparison) body.append(comparison);
    body.append(savedPartView(ctx, event));
  }
  if (event.payload.file_id) {
    const file = ctx.client.state.files.find(
      (file) => file.id === event.payload.file_id,
    );
    if (file)
      body.append(information("CAD files", [["File", fileLink(ctx, file)]]));
  }
  if (event.payload.changes?.length)
    body.append(
      information(
        "What changed",
        event.payload.changes.map((change) => [
          change.label,
          formatRevisionValue(change.before) +
            " → " +
            formatRevisionValue(change.after),
        ]),
      ),
    );
  if (event.payload.reason || event.payload.label)
    body.append(
      information("Revision information", [
        ["Reason", event.payload.reason],
        ["Label", event.payload.label],
      ]),
    );
  if (event.payload.path)
    body.append(
      information("Original location", [
        ["Project", event.payload.path.root.name],
        ["Item", event.payload.path.item.name],
        ["Step", event.payload.path.step?.title],
      ]),
    );
  for (const config of configurations) {
    const section = window.BSUI.section({
      title:
        config.id === event.payload.before && config.id === event.payload.after
          ? "Design configuration (unchanged)"
          : config.id === event.payload.before
            ? "Before revision"
            : config.id === event.payload.after
              ? "After revision"
              : "Configuration when recorded",
      open: !!record,
    });
    section.body.append(
      configurationView(config, undefined, {
        includeBuild: !recordContext && !build,
      }),
    );
    if (config.snapshot.file) {
      const file = ctx.client.state.files.find(
        (file) => file.id === config.snapshot.file.id,
      );
      if (file) section.body.append(fileLink(ctx, file));
    }
    body.append(section.root);
  }
  if (attachments.length && !event.payload.record_edit && !record)
    body.append(
      information(
        "Attachments",
        attachments.map((file) => ["File", fileLink(ctx, file)]),
      ),
    );
  body.append(
    node(
      "small",
      "Recorded " + new Date(event.created_at).toLocaleString(),
      "muted",
    ),
  );
  container.replaceChildren(body);
  return detail;
}
function currentSnapshot(ctx, item) {
  const occurrence = ctx.client.state.occurrences.find(
    (row) => row.item_id === item.id,
  );
  return {
    snapshot: {
      item,
      occurrence: {
        ...occurrence,
        root: { name: ctx.client.state.project.name },
      },
    },
  };
}
async function showRemoved(ctx, entry, container) {
  const state = ctx.client.state,
    item = state.items.find((row) => row.id === entry.item_id),
    step = entry.kind === "step" ? entry : null,
    occurrence = state.occurrences.find((row) =>
      entry.occurrenceId
        ? row.id === entry.occurrenceId
        : row.item_id === item.id,
    ),
    path = step?.retired_path || occurrence.removed_path;
  const archived = !step
    ? await ctx.client.request(
        "/" +
          ctx.projectId +
          "/history?" +
          new URLSearchParams({
            scope: item.id,
            type: "archives",
            occurrence: occurrence.id,
            limit: "1",
          }),
      )
    : null;
  const frozen = archived?.entries[0]?.payload.snapshot;
  const body = node("div", "", "project-stack");
  body.append(
    node("h2", step ? step.title : item.name),
    information("Original location", [
      ["Project", path?.root.name],
      ["Item", path?.item.name],
      ["Step", path?.step?.title],
    ]),
    ...(frozen
      ? [savedPartView(ctx, archived.entries[0])]
      : [
          configurationView(
            currentSnapshot(ctx, item),
            "Archived item details",
          ),
        ]),
  );
  const instructions = instructionTree(
      state.steps.filter((row) => row.item_id === item.id),
    ),
    steps = step
      ? instructions.subtree(step.id)
      : [...instructions.byId.values()],
    scopedRecords = state.records.filter(
      (row) =>
        row.item_id === item.id &&
        (!step || steps.some((scope) => scope.id === row.step_id)),
    );
  for (const row of frozen ? [] : steps)
    body.append(
      information(row.title, [
        ["Instructions", row.body],
        ["Archive reason", row.archive_reason],
      ]),
    );
  for (const record of frozen ? [] : scopedRecords)
    body.append(
      recordVersionView(
        ctx,
        {
          ...record,
          fileIds: state.file_links
            .filter((link) => link.record_id === record.id && link.active)
            .map((link) => link.file_id),
        },
        record.title,
        state.files,
      ),
    );
  const fileIds = new Set(
    state.file_links
      .filter(
        (link) =>
          link.item_id === item.id ||
          state.records.some(
            (record) =>
              record.item_id === item.id && link.record_id === record.id,
          ),
      )
      .map((link) => link.file_id),
  );
  for (const file of frozen
    ? []
    : state.files.filter((file) => fileIds.has(file.id)))
    body.append(fileLink(ctx, file));
  const canRestore =
    !step ||
    (occurrence.removed_at === null &&
      (!step.parent_id ||
        instructions.active(instructions.byId.get(step.parent_id))));
  if (canRestore)
    body.append(
      button(step ? "Restore step…" : "Restore to build…", async () => {
        try {
          if (step) {
            confirmAction(
              ctx,
              "Restore step",
              'Restore "' + step.title + '" to ' + item.name + "?",
              "Restore step",
              (token) =>
                ctx.client.write(
                  ctx.projectId,
                  "/steps/" + step.id + "/restore",
                  "POST",
                  {},
                  token,
                ),
            );
            return;
          }
          const preview = await ctx.client.request(
            "/" +
              ctx.projectId +
              "/occurrences/" +
              occurrence.id +
              "/restore-preview",
          );
          confirmAction(
            ctx,
            "Restore to build",
            "Destination: " +
              preview.root.name +
              ". " +
              (preview.conflicts.join(" ") ||
                "The item keeps its ID, part number, records and files."),
            "Restore to build",
            (token) =>
              ctx.client.write(
                ctx.projectId,
                "/occurrences/" + occurrence.id + "/restore",
                "POST",
                {},
                token,
              ),
          );
        } catch (error) {
          ctx.notify(error.message);
        }
      }),
    );
  else
    body.append(
      node("p", "Restore the parent item before restoring this step."),
    );
  container.replaceChildren(body);
}
export function createHistoryView(ctx, memo) {
  memo.archiveType ||= "all";
  memo.detailOpen ??= !!memo.selected;
  const root = node("div", "", "project-stack"),
    toolbar = node("div", "", "actions project-toolbar"),
    status = node("p", "", "ui-status"),
    retry = button("Retry history", () => load(retryMore)),
    panes = node("div", "", "project-panes project-history-panes"),
    list = node("div", "", "project-history-list"),
    detail = node("div", "", "project-history-detail");
  status.setAttribute("role", "status");
  status.dataset.historyStatus = "";
  retry.hidden = true;
  list.setAttribute("role", "region");
  list.setAttribute("aria-label", "History entries");
  detail.setAttribute("role", "region");
  detail.setAttribute("aria-label", "History entry");
  panes.append(list, detail);
  root.append(toolbar, status, retry, panes);
  let requestNumber = 0,
    selectionNumber = 0,
    retryMore = false;
  const visible = () => list.offsetParent !== null;
  const saveScroll = () => {
    if (visible() && list.childElementCount) memo.scroll = list.scrollTop;
  };
  list.addEventListener("scroll", saveScroll);
  const markSelection = () => {
    for (const row of list.querySelectorAll("[data-event-id]"))
      row.setAttribute(
        "aria-pressed",
        String(row.dataset.eventId === memo.selected),
      );
  };
  const restoreScroll = () =>
    requestAnimationFrame(() => {
      if (root.isConnected && !memo.detailOpen) {
        list.scrollTop = memo.scroll || 0;
        window.scrollTo(0, memo.pageScroll || 0);
      }
    });
  const back = () => {
    ++selectionNumber;
    memo.detailOpen = false;
    delete panes.dataset.detailOpen;
    detail.replaceChildren();
    list.scrollTop = memo.scroll || 0;
    list
      .querySelector('[data-event-id="' + memo.selected + '"]')
      ?.focus({ preventScroll: true });
    restoreScroll();
  };
  const select = async (entry, { focus = true, capture = true } = {}) => {
    const id = typeof entry === "string" ? entry : entry.id,
      ticket = ++selectionNumber;
    if (capture && visible()) {
      saveScroll();
      memo.pageScroll = window.scrollY;
    }
    memo.selected = id;
    memo.detailOpen = true;
    markSelection();
    panes.dataset.detailOpen = "true";
    detail.replaceChildren(node("p", "Loading entry…"));
    try {
      const pending = node("div"),
        loaded =
          memo.mode === "archive"
            ? (await showRemoved(ctx, entry, pending), null)
            : await showEvent(ctx, id, pending);
      if (
        ticket !== selectionNumber ||
        memo.selected !== id ||
        !root.isConnected
      )
        return;
      const controls = actions(button("Back to history", back)),
        item = loaded?.event.item_id || entry.item_id;
      if (item)
        controls.append(
          button("Open part", () => ctx.navigate(ctx.projectId, item), {
            variant: "quiet",
          }),
        );
      detail.replaceChildren(controls, ...pending.childNodes);
      detail.dataset.eventId = id;
      const heading = detail.querySelector("h2");
      heading?.setAttribute("tabindex", "-1");
      if (focus) heading?.focus({ preventScroll: true });
    } catch (error) {
      if (ticket !== selectionNumber || !root.isConnected) return;
      const message = node("p", error.message);
      message.setAttribute("role", "alert");
      detail.replaceChildren(
        button("Back to history", back),
        message,
        button("Retry entry", () => select(entry)),
      );
    }
  };
  const more = button("Load more", () => load(true));
  function archivedEntries() {
    const state = ctx.client.state;
    let entries = [
      ...state.occurrences
        .filter(
          (row) =>
            row.removed_at !== null &&
            (!row.archive_group_id ||
              state.archive_groups.find(
                (group) => group.id === row.archive_group_id,
              )?.root_occurrence_id === row.id),
        )
        .map((row) => {
          const item = state.items.find((item) => item.id === row.item_id);
          return {
            ...row,
            id: "occurrence-" + row.id,
            occurrenceId: row.id,
            kind: "item",
            title: item.name,
            summary: item.is_assembly
              ? "Archived subassembly"
              : "Archived part",
            created_at: row.removed_at,
          };
        }),
      ...state.steps
        .filter((row) => row.retired_at)
        .map((row) => ({
          ...row,
          kind: "step",
          summary: "Retired step",
          created_at: row.retired_at,
        })),
    ];
    return entries
      .filter(
        (row) =>
          (!memo.scope ||
            row.item_id === memo.scope ||
            state.occurrences.find((parent) => parent.id === row.parent_id)
              ?.item_id === memo.scope) &&
          (!memo.q ||
            (row.title + " " + row.summary + " " + (row.archive_reason || ""))
              .toLowerCase()
              .includes(memo.q.toLowerCase())) &&
          (memo.archiveType === "all" ||
            row.kind ===
              (memo.archiveType === "instructions" ? "step" : "item")),
      )
      .sort(
        (a, b) =>
          b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
      );
  }
  async function load(append = false) {
    const generation = ++requestNumber;
    saveScroll();
    retry.hidden = true;
    more.disabled = true;
    status.textContent = "Loading history…";
    try {
      let entries = [],
        nextCursor = null,
        total = 0;
      if (memo.mode === "archive") {
        const all = archivedEntries(),
          target = append
            ? memo.entries.length + 20
            : Math.max(20, memo.entries.length);
        entries = all.slice(0, target);
        total = all.length;
        nextCursor = entries.length < total ? String(entries.length) : null;
      } else {
        const target = append ? 20 : Math.max(20, memo.entries.length);
        let cursor = append ? memo.cursor : null;
        do {
          const params = new URLSearchParams({
              type: memo.type,
              scope: memo.scope,
              q: memo.q,
              limit: "20",
              ...(cursor ? { cursor } : {}),
            }),
            page = await ctx.client.request(
              "/" + ctx.projectId + "/history?" + params,
            );
          if (generation !== requestNumber || !root.isConnected) return;
          entries.push(...page.entries);
          total = page.total;
          cursor = page.nextCursor;
        } while (cursor && entries.length < target);
        nextCursor = cursor;
        if (append) entries = [...memo.entries, ...entries];
      }
      if (generation !== requestNumber || !root.isConnected) return;
      memo.entries = entries;
      memo.cursor = nextCursor;
      list.replaceChildren();
      for (const entry of entries)
        list.append(entryCard(entry, () => select(entry)));
      markSelection();
      if (nextCursor) list.append(more);
      list.scrollTop = memo.scroll || 0;
      status.textContent = entries.length
        ? entries.length + " of " + total + " entries"
        : memo.q || memo.scope || memo.type !== "all"
          ? "No entries match these filters."
          : memo.mode === "archive"
            ? "Archived parts and retired instructions will appear here."
            : "Add a record or save a revision to start this History.";
      if (!entries.length) list.append(node("p", status.textContent));
      if (
        memo.selected &&
        memo.detailOpen &&
        (!append || !detail.childElementCount)
      ) {
        const selected = entries.find((entry) => entry.id === memo.selected);
        if (selected || memo.mode !== "archive")
          await select(selected || memo.selected, {
            focus: false,
            capture: false,
          });
        else {
          memo.detailOpen = false;
          delete panes.dataset.detailOpen;
          detail.replaceChildren();
        }
      } else if (!memo.detailOpen) restoreScroll();
    } catch (error) {
      if (generation !== requestNumber || !root.isConnected) return;
      status.textContent = error.message;
      retryMore = append;
      retry.hidden = false;
    } finally {
      if (generation === requestNumber) more.disabled = false;
    }
  }
  const reset = () => {
    ++selectionNumber;
    memo.cursor = null;
    memo.scroll = 0;
    memo.pageScroll = 0;
    memo.selected = null;
    memo.detailOpen = false;
    memo.entries = [];
    delete panes.dataset.detailOpen;
    detail.replaceChildren();
    list.replaceChildren();
    void load();
  };
  function renderToolbar() {
    toolbar.replaceChildren(
      field(
        "View",
        memo.mode,
        (value) => {
          memo.mode = value;
          renderToolbar();
          reset();
        },
        {
          options: [
            { value: "history", label: "History" },
            { value: "archive", label: "Archive" },
          ],
        },
      ),
      field(
        "Scope",
        memo.scope,
        (value) => {
          memo.scope = value;
          reset();
        },
        {
          options: [
            { value: "", label: "Whole project" },
            ...ctx.client.state.items.map((item) => ({
              value: item.id,
              label: item.name + " · " + item.part_number,
            })),
          ],
        },
      ),
      field(
        "Type",
        memo.mode === "archive" ? memo.archiveType : memo.type,
        (value) => {
          if (memo.mode === "archive") memo.archiveType = value;
          else memo.type = value;
          reset();
        },
        {
          options:
            memo.mode === "archive"
              ? [
                  { value: "all", label: "All archived items" },
                  { value: "parts", label: "Parts and subassemblies" },
                  { value: "instructions", label: "Instructions and groups" },
                ]
              : [
                  { value: "all", label: "All" },
                  { value: "tests", label: "Tests / Measurements" },
                  { value: "problems", label: "Failures" },
                  { value: "changes", label: "Change notes and file changes" },
                  { value: "notes", label: "Notes and photos" },
                  { value: "revisions", label: "Part revisions" },
                  {
                    value: "instruction_revisions",
                    label: "Instruction revisions",
                  },
                ],
        },
      ),
      field(
        "Search history",
        memo.q,
        (value) => {
          memo.q = value;
          reset();
        },
        { type: "search" },
      ),
      button(
        "Clear Filters",
        () => {
          memo.scope = "";
          memo.type = "all";
          memo.archiveType = "all";
          memo.q = "";
          renderToolbar();
          reset();
        },
        { variant: "quiet" },
      ),
    );
  }
  renderToolbar();
  queueMicrotask(() => {
    initSplitPanes(panes, {
      key: "project-history",
      panes: [
        { key: "history", selector: ".project-history-list", name: "History" },
      ],
    });
    void load();
  });
  return root;
}
export async function latestHistory(ctx, container) {
  const result = await ctx.client.request(
    "/" +
      ctx.projectId +
      "/history?" +
      new URLSearchParams({ scope: ctx.itemId, type: "activity", limit: "5" }),
  );
  for (const entry of result.entries)
    container.append(
      entryCard(entry, () => ctx.openHistory(ctx.itemId, entry.id)),
    );
  return result.total;
}
