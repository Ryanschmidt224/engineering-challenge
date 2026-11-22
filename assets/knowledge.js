// Knowledge page: tiles (concept / method / lesson) and their links.
// All text is inserted as text nodes (textContent); markup is never parsed.
import {node, button, actions, panel, field, requestWorkshop} from "./workshop-ui.js";
import {
  tileTypes,
  tileStatuses,
  relations,
  limits,
  labelFor,
  validateTile,
  paragraphs,
} from "./knowledge-model.js";

const $ = (selector) => document.querySelector(selector);
const detail = $("#knowledge-detail");
const dialog = $("#knowledge-dialog");
const params = new URLSearchParams(location.search);

let tiles = [];
let links = [];
let families = null; // loaded the first time a link is added
let selectedTile = "";
let draft = null; // {record, expectedRevision}
let dirty = false;
let busy = false;

const status = (message, error = false) => {
  $("#knowledge-status").textContent = message;
  $("#knowledge-status").classList.toggle("status--error", error);
};
const mark = () => {
  dirty = true;
};
const mayLeave = () => !dirty || window.confirm("Discard the unsaved changes to this tile?");
const tileLinks = (id) => links.filter((link) => link.tile_id === id && !link.archived);

async function run(operation) {
  if (busy) return;
  busy = true;
  detail.inert = true;
  try {
    await operation();
  } catch (error) {
    status(error.message, true);
  } finally {
    busy = false;
    detail.inert = false;
  }
}

async function refresh() {
  const data = await requestWorkshop("/api/knowledge");
  tiles = data.tiles;
  links = data.links;
  renderList();
}

function updateLocation() {
  const url = new URL(location.href);
  for (const key of ["tile", "new", "family"]) url.searchParams.delete(key);
  if (selectedTile) url.searchParams.set("tile", selectedTile);
  history.replaceState(null, "", url);
}

function select(id) {
  if (!mayLeave()) return;
  selectedTile = id;
  draft = null;
  dirty = false;
  updateLocation();
  renderList();
  renderDetail();
}

function fillSelect(element, entries, allLabel) {
  element.replaceChildren(node("option", allLabel));
  element.firstChild.value = "";
  for (const entry of entries) {
    const option = node("option", entry.label);
    option.value = entry.value;
    element.append(option);
  }
}

function renderList() {
  const query = $("#tile-search").value.toLowerCase().trim();
  const type = $("#type-filter").value;
  const state = $("#status-filter").value;
  const showArchived = $("#show-archived").checked;
  const list = $("#tile-list");
  list.replaceChildren();
  for (const tile of tiles) {
    if (tile.archived && !showArchived) continue;
    if (type && tile.type !== type) continue;
    if (state && tile.status !== state) continue;
    if (query && ![tile.title, tile.summary, tile.body].join(" ").toLowerCase().includes(query)) continue;
    const count = tileLinks(tile.id).length;
    const entry = button("", () => select(tile.id), "list-card" + (tile.id === selectedTile ? " is-selected" : ""));
    entry.append(
      node("strong", tile.title + (tile.archived ? " (archived)" : "")),
      node(
        "small",
        [labelFor(tileTypes, tile.type), labelFor(tileStatuses, tile.status), count + (count === 1 ? " link" : " links")].join(" · "),
      ),
      node("small", tile.summary, "tile-summary"),
    );
    list.append(entry);
  }
  if (!list.children.length) {
    list.append(node("p", tiles.length ? "No tiles match. Change the search or filters." : "No tiles yet. Start one with New tile.", "empty"));
  }
}

function renderDetail() {
  detail.replaceChildren();
  if (draft) {
    renderEditor();
    return;
  }
  const tile = tiles.find((entry) => entry.id === selectedTile);
  if (!tile) {
    detail.append(
      panel(
        "Choose or start a tile",
        "A tile is one thing you learned: a concept, a method, or a lesson from what happened. Write it once and link it to the parts it applies to.",
      ),
    );
    return;
  }
  const heading = node("div", "", "detail-heading");
  const meta = node("div", "", "tile-meta");
  meta.append(
    node("span", labelFor(tileTypes, tile.type), "chip"),
    node("span", labelFor(tileStatuses, tile.status), "chip" + (tile.status === "verified" ? " chip--verified" : "")),
  );
  heading.append(
    node("h2", tile.title),
    meta,
    actions(
      button("Edit tile", () => begin(structuredClone(tile), tile.revision)),
      button(tile.archived ? "Restore tile" : "Archive tile", () => void archive("tile", tile), "button--quiet"),
    ),
  );
  if (tile.archived) heading.append(node("p", "Archived. Its links are kept and come back if you restore it.", "notice"));
  detail.append(heading);

  const summary = panel("Summary");
  summary.append(node("p", tile.summary));
  detail.append(summary);

  if (tile.body) {
    const body = panel("Details");
    for (const text of paragraphs(tile.body)) body.append(node("p", text, "notes"));
    detail.append(body);
  }

  if (tile.sources.length) {
    const sources = panel("Sources");
    const list = node("ul", "", "source-list");
    for (const source of tile.sources) {
      const item = node("li");
      const link = node("a", source.title || source.url);
      link.href = source.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      item.append(link);
      list.append(item);
    }
    sources.append(list);
    detail.append(sources);
  }

  const linked = tileLinks(tile.id);
  const linksPanel = panel("Links (" + linked.length + ")");
  const list = node("ul", "", "link-list");
  for (const link of linked) {
    const item = node("li");
    const target = node("a", link.target_name, "link-target");
    target.href = "workshop.html?family=" + encodeURIComponent(link.target_id);
    const line = node("span");
    line.append(document.createTextNode(labelFor(relations, link.relation) + " Workshop family: "), target);
    if (link.target_state !== "available") {
      line.append(
        document.createTextNode(
          link.target_state === "archived" ? " (archived in the Workshop)" : " (no longer in the Workshop; last known name)",
        ),
      );
    }
    item.append(line);
    if (link.note) item.append(node("span", link.note, "link-note"));
    item.append(button("Remove link", () => void archive("link", link), "button--quiet"));
    list.append(item);
  }
  if (!linked.length) list.append(node("li", "Not linked to anything yet.", "empty"));
  linksPanel.append(list, actions(button("Add link to a Workshop family", () => void run(addLinkDialog))));
  detail.append(linksPanel);
}

function begin(record, expectedRevision, linkFamily = "") {
  if (!mayLeave()) return;
  draft = {record, expectedRevision, linkFamily};
  dirty = false;
  renderDetail();
}

// linkFamily: a tile started from a Workshop family page is linked to it on save.
function newTile(linkFamily = "") {
  const record = {id: crypto.randomUUID(), type: "concept", status: "draft", title: "", summary: "", body: "", sources: []};
  begin(record, null, linkFamily);
}

function limit(row, max) {
  row.querySelector(".field").maxLength = max;
  return row;
}

function renderEditor() {
  const record = draft.record;
  const set = (key, value) => {
    record[key] = value;
    mark();
  };
  detail.append(node("h2", draft.expectedRevision === null ? "New tile" : "Edit tile"));
  const form = node("form");
  form.onsubmit = (event) => {
    event.preventDefault();
    void run(() => saveDraft(form));
  };

  const identity = panel("Tile");
  identity.append(
    limit(field("Title", record.title, (value) => set("title", value), {required: true}), limits.title),
    field("Type", record.type, (value) => set("type", value), {options: tileTypes}),
    field("Status", record.status, (value) => set("status", value), {options: tileStatuses}),
    limit(
      field("Summary", record.summary, (value) => set("summary", value), {
        type: "textarea",
        required: true,
        placeholder: "One or two sentences. This is what shows in lists and on linked parts.",
      }),
      limits.summary,
    ),
    limit(field("Details", record.body, (value) => set("body", value), {type: "textarea"}), limits.body),
  );
  identity.append(
    node("p", "Verified means you tested or confirmed it. New tiles start as Draft.", "muted"),
  );
  form.append(identity);

  const sources = panel("Sources");
  record.sources.forEach((source, index) => {
    const row = node("fieldset", "", "source-row");
    row.append(
      node("legend", "Source " + (index + 1)),
      field("Source title", source.title || "", (value) => {
        source.title = value;
        mark();
      }),
      field("Link", source.url || "", (value) => {
        source.url = value;
        mark();
      }, {type: "url", required: true, placeholder: "https://"}),
      button("Remove source", () => {
        record.sources.splice(index, 1);
        mark();
        renderDetail();
      }, "button--quiet"),
    );
    sources.append(row);
  });
  sources.append(
    button("Add source", () => {
      record.sources.push({title: "", url: ""});
      mark();
      renderDetail();
    }),
  );
  form.append(sources);

  const footer = actions(
    button("Save tile", () => form.requestSubmit(), "button--primary"),
    button("Cancel", () => {
      if (!mayLeave()) return;
      dirty = false;
      draft = null;
      renderDetail();
    }),
  );
  footer.classList.add("form-actions");
  form.append(footer);
  detail.append(form);
}

async function saveDraft(form) {
  if (!form.reportValidity()) return;
  validateTile(draft.record);
  status("Saving…");
  const isNew = draft.expectedRevision === null;
  const family = draft.linkFamily;
  const result = await requestWorkshop("/api/knowledge", "POST", {
    entity: "tile",
    record: draft.record,
    expectedRevision: draft.expectedRevision,
  });
  dirty = false;
  draft = null;
  selectedTile = result.record.id;
  let linkError = "";
  if (isNew && family) {
    try {
      await requestWorkshop("/api/knowledge", "POST", {
        entity: "link",
        record: {id: crypto.randomUUID(), tile_id: selectedTile, target_type: "family", target_id: family, relation: "applies_to", note: ""},
        expectedRevision: null,
      });
    } catch (error) {
      linkError = error.message;
    }
  }
  await refresh();
  updateLocation();
  renderDetail();
  status(linkError ? "Saved, but the family link was not added: " + linkError : "Saved.", !!linkError);
}

async function archive(entity, record) {
  const verb = record.archived ? "Restore" : entity === "tile" ? "Archive" : "Remove";
  const question =
    entity === "tile"
      ? verb + " this tile? Its links are kept."
      : "Remove this link? The tile and the Workshop family are not changed.";
  if (!window.confirm(question)) return;
  await run(async () => {
    await requestWorkshop("/api/knowledge", "PATCH", {
      entity,
      id: record.id,
      expectedRevision: record.revision,
      archived: !record.archived,
    });
    await refresh();
    renderDetail();
    status(entity === "tile" ? (record.archived ? "Restored." : "Archived.") : "Link removed.");
  });
}

async function addLinkDialog() {
  if (!families) families = (await requestWorkshop("/api/workshop")).families.filter((family) => !family.archived);
  const choice = {family: "", relation: "applies_to", note: ""};
  const results = node("div", "", "family-results");
  const search = field("Find a Workshop family", "", (value) => paint(value), {placeholder: "e.g. Buck converter"});
  const paint = (query = "") => {
    results.replaceChildren();
    const matches = families
      .filter((family) => family.name.toLowerCase().includes(query.toLowerCase().trim()))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 40);
    for (const family of matches) {
      results.append(
        button(family.name, () => {
          choice.family = family.id;
          paint(query);
        }, "list-card" + (choice.family === family.id ? " is-selected" : "")),
      );
    }
    if (!matches.length) results.append(node("p", "No matching family.", "empty"));
  };
  paint();
  const form = node("form");
  form.append(
    search,
    results,
    field("Relation", choice.relation, (value) => {
      choice.relation = value;
    }, {options: relations}),
    limit(field("Note (optional)", "", (value) => {
      choice.note = value;
    }), limits.note),
  );
  const error = node("p", "", "error");
  form.append(
    error,
    actions(
      button("Add link", () => form.requestSubmit(), "button--primary"),
      button("Cancel", () => dialog.close()),
    ),
  );
  form.onsubmit = (event) => {
    event.preventDefault();
    if (!choice.family) {
      error.textContent = "Choose a family from the list.";
      return;
    }
    void run(async () => {
      try {
        await requestWorkshop("/api/knowledge", "POST", {
          entity: "link",
          record: {
            id: crypto.randomUUID(),
            tile_id: selectedTile,
            target_type: "family",
            target_id: choice.family,
            relation: choice.relation,
            note: choice.note,
          },
          expectedRevision: null,
        });
      } catch (failure) {
        error.textContent = failure.message;
        return;
      }
      dialog.close();
      await refresh();
      renderDetail();
      status("Link added.");
    });
  };
  dialog.replaceChildren(node("h2", "Add link"), form);
  dialog.showModal();
}

fillSelect($("#type-filter"), tileTypes, "All types");
fillSelect($("#status-filter"), tileStatuses, "Draft and verified");
for (const id of ["#tile-search", "#type-filter", "#status-filter", "#show-archived"]) {
  $(id).addEventListener(id === "#tile-search" ? "input" : "change", renderList);
}
$("#new-tile").onclick = () => newTile();
window.addEventListener("beforeunload", (event) => {
  if (dirty) {
    event.preventDefault();
    event.returnValue = "";
  }
});

try {
  await refresh();
  selectedTile = params.get("tile") || "";
  renderList();
  if (params.get("new") === "1") newTile(params.get("family") || "");
  else renderDetail();
} catch (error) {
  detail.replaceChildren(panel("Knowledge unavailable", error.message), button("Try again", () => location.reload()));
  const signIn = node("a", "Open Projects to sign in");
  signIn.href = "index.html#home";
  detail.append(signIn);
  status(error.message, true);
}
