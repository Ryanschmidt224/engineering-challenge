// Knowledge page: tiles (concept / method / lesson) and their links.
// All text is inserted as text nodes (textContent); markup is never parsed.
import {
  node,
  button,
  listCard,
  actions,
  panel,
  field,
  requestWorkshop,
  help,
} from "./workshop-ui.js";
import {
  tileTypes,
  tileStatuses,
  relations,
  targets,
  limits,
  labelFor,
  validateTile,
  paragraphs,
  targetHref,
} from "./knowledge-model.js";

const $ = (selector) => document.querySelector(selector);
const detail = $("#knowledge-detail");
const dialog = $("#knowledge-dialog");
const params = new URLSearchParams(location.search);

let tiles = [];
let links = [];
let catalog = null; // Workshop and project lists, loaded the first time a link is added
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
const mayLeave = () =>
  !dirty || window.confirm("Discard the unsaved changes to this tile?");
const tileLinks = (id) =>
  links.filter((link) => link.tile_id === id && !link.archived);

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
  for (const key of ["tile", "new", "family", "link"])
    url.searchParams.delete(key);
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
    if (
      query &&
      ![tile.title, tile.summary, tile.body]
        .join(" ")
        .toLowerCase()
        .includes(query)
    )
      continue;
    const count = tileLinks(tile.id).length;
    const entry = listCard(
      "",
      () => select(tile.id),
      tile.id === selectedTile ? "is-selected" : "",
    );
    entry.append(
      node("strong", tile.title + (tile.archived ? " (archived)" : "")),
      node(
        "small",
        [
          labelFor(tileTypes, tile.type),
          labelFor(tileStatuses, tile.status),
          count + (count === 1 ? " link" : " links"),
        ].join(" · "),
      ),
      node("small", tile.summary, "tile-summary"),
    );
    list.append(entry);
  }
  if (!list.children.length) {
    list.append(
      node(
        "p",
        tiles.length
          ? "No tiles match. Change the search or filters."
          : "No tiles yet. Start one with New tile.",
        "empty",
      ),
    );
  }
}

function renderDetail() {
  detail.replaceChildren();
  if (draft) {
    renderEditor();
    return;
  }
  const tile = tiles.find((entry) => entry.id === selectedTile);
  if (!tile) return;
  const heading = node("div", "", "detail-heading");
  const meta = node("div", "", "tile-meta");
  meta.append(
    node("span", labelFor(tileTypes, tile.type), "chip"),
    node(
      "span",
      labelFor(tileStatuses, tile.status),
      "chip" + (tile.status === "verified" ? " chip--verified" : ""),
    ),
  );
  heading.append(
    node("h2", tile.title),
    meta,
    actions(
      button("Edit tile", () => begin(structuredClone(tile), tile.revision)),
      button(
        tile.archived ? "Restore tile" : "Archive tile",
        () => void archive("tile", tile),
        "button--quiet",
      ),
    ),
  );
  if (tile.archived)
    heading.append(
      node(
        "p",
        "Archived. Its links are kept and come back if you restore it.",
        "notice",
      ),
    );
  detail.append(heading);

  const summary = panel("Summary");
  summary.append(node("p", tile.summary));
  detail.append(summary);

  if (tile.body) {
    const body = panel("Details");
    for (const text of paragraphs(tile.body))
      body.append(node("p", text, "notes"));
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
    item.append(linkSentence(labelFor(relations, link.relation), link));
    if (link.note) item.append(node("span", link.note, "link-note"));
    item.append(
      button("Remove link", () => void archive("link", link), "button--quiet"),
    );
    list.append(item);
  }
  if (!linked.length)
    list.append(node("li", "Not linked to anything yet.", "empty"));
  linksPanel.append(
    list,
    actions(button("Add link", () => void run(addLinkDialog))),
  );
  detail.append(linksPanel);

  // Other tiles that link here. Shown as their own sentence, so a "Caused by"
  // link is never read backwards as a claim this tile makes.
  const incoming = links.filter(
    (link) =>
      !link.archived &&
      link.target_type === "tile" &&
      link.target_id === tile.id,
  );
  if (incoming.length) {
    const linkedFrom = panel("Linked from (" + incoming.length + ")");
    const fromList = node("ul", "", "link-list");
    for (const link of incoming) {
      const source = tiles.find((entry) => entry.id === link.tile_id);
      if (!source) continue;
      const item = node("li");
      const anchor = node("a", source.title, "link-target");
      anchor.href = "knowledge.html?tile=" + encodeURIComponent(source.id);
      item.append(
        anchor,
        document.createTextNode(
          " — " +
            labelFor(relations, link.relation).toLowerCase() +
            " this tile" +
            (source.archived ? " (archived tile)" : ""),
        ),
      );
      if (link.note) item.append(node("span", link.note, "link-note"));
      fromList.append(item);
    }
    linkedFrom.append(fromList);
    detail.append(linkedFrom);
  }
}

// "Applies to Workshop family: Buck converter (archived in the Workshop)"
function linkSentence(relation, link) {
  const line = node("span");
  const target = node("a", link.target_name || "Unnamed", "link-target");
  const href = targetHref(link);
  if (href && link.target_state !== "missing") target.href = href;
  line.append(
    document.createTextNode(
      relation + " " + labelFor(targets, link.target_type).toLowerCase() + ": ",
    ),
    target,
  );
  if (link.target_project_name && link.target_type !== "project")
    line.append(document.createTextNode(" in " + link.target_project_name));
  if (link.target_state === "archived")
    line.append(document.createTextNode(" (archived)"));
  if (link.target_state === "missing")
    line.append(
      document.createTextNode(" (no longer exists; last known name)"),
    );
  return line;
}

function begin(record, expectedRevision, linkTarget = null) {
  if (!mayLeave()) return;
  draft = { record, expectedRevision, linkTarget };
  dirty = false;
  renderDetail();
}

// linkTarget: a tile started from a Workshop family/product or a project part
// is linked to it on save ("Applies to").
function newTile(linkTarget = null) {
  const record = {
    id: crypto.randomUUID(),
    type: "concept",
    status: "draft",
    title: "",
    summary: "",
    body: "",
    sources: [],
  };
  begin(record, null, linkTarget);
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
  detail.append(
    node("h2", draft.expectedRevision === null ? "New tile" : "Edit tile"),
  );
  const form = node("form");
  form.onsubmit = (event) => {
    event.preventDefault();
    void run(() => saveDraft(form));
  };

  const identity = panel("Tile");
  identity.append(
    limit(
      field("Title", record.title, (value) => set("title", value), {
        required: true,
      }),
      limits.title,
    ),
    field("Type", record.type, (value) => set("type", value), {
      options: tileTypes,
    }),
    field("Status", record.status, (value) => set("status", value), {
      options: tileStatuses,
    }),
    limit(
      field("Summary", record.summary, (value) => set("summary", value), {
        type: "textarea",
        required: true,
        placeholder:
          "One or two sentences. This is what shows in lists and on linked parts.",
      }),
      limits.summary,
    ),
    limit(
      field("Details", record.body, (value) => set("body", value), {
        type: "textarea",
      }),
      limits.body,
    ),
  );
  identity
    .querySelector(".panel-heading")
    .append(help("Tile status", "knowledgeStatus"));
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
      field(
        "Link",
        source.url || "",
        (value) => {
          source.url = value;
          mark();
        },
        { type: "url", required: true, placeholder: "https://" },
      ),
      button(
        "Remove source",
        () => {
          record.sources.splice(index, 1);
          mark();
          renderDetail();
        },
        "button--quiet",
      ),
    );
    sources.append(row);
  });
  sources.append(
    button("Add source", () => {
      record.sources.push({ title: "", url: "" });
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
  const linkTarget = draft.linkTarget;
  const result = await requestWorkshop("/api/knowledge", "POST", {
    entity: "tile",
    record: draft.record,
    expectedRevision: draft.expectedRevision,
  });
  dirty = false;
  draft = null;
  selectedTile = result.record.id;
  let linkError = "";
  if (isNew && linkTarget) {
    try {
      await requestWorkshop("/api/knowledge", "POST", {
        entity: "link",
        record: {
          id: crypto.randomUUID(),
          tile_id: selectedTile,
          ...linkTarget,
          relation: "applies_to",
          note: "",
        },
        expectedRevision: null,
      });
    } catch (error) {
      linkError = error.message;
    }
  }
  await refresh();
  updateLocation();
  renderDetail();
  status(
    linkError ? "Saved, but the link was not added: " + linkError : "Saved.",
    !!linkError,
  );
}

async function archive(entity, record) {
  const verb = record.archived
    ? "Restore"
    : entity === "tile"
      ? "Archive"
      : "Remove";
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
    status(
      entity === "tile"
        ? record.archived
          ? "Restored."
          : "Archived."
        : "Link removed.",
    );
  });
}

// Everything a tile can link to, loaded once when the first link is added.
async function loadCatalog() {
  if (catalog) return catalog;
  const [workshop, projectList] = await Promise.all([
    requestWorkshop("/api/workshop"),
    requestWorkshop("/api/project-engine/projects"),
  ]);
  const projects = (projectList.projects || []).filter(
    (project) => !project.archived,
  );
  const projectName = (id) =>
    projects.find((project) => project.id === id)?.name || id;
  const familyName = (id) =>
    workshop.families.find((family) => family.id === id)?.name || "";
  catalog = {
    projects,
    family: workshop.families
      .filter((family) => !family.archived)
      .map((family) => ({ id: family.id, label: family.name })),
    product: workshop.products
      .filter((product) => !product.archived)
      .map((product) => ({
        id: product.id,
        label: product.name + " · " + familyName(product.family_id),
      })),
    project: projects.map((project) => ({
      id: project.id,
      label: project.name,
    })),
  };
  return catalog;
}

async function choicesFor(type, project) {
  if (type === "tile") {
    return tiles
      .filter((tile) => !tile.archived && tile.id !== selectedTile)
      .map((tile) => ({ id: tile.id, label: tile.title }));
  }
  if (["record", "use"].includes(type)) {
    if (!project) return [];
    const state = await requestWorkshop(
      "/api/project-engine/projects/" + encodeURIComponent(project) + "/state",
    );
    const active = new Set(
      state.occurrences
        .filter((row) => !row.removed_at)
        .map((row) => row.item_id),
    );
    return (type === "record" ? state.records : state.items)
      .filter((row) => active.has(row.item_id || row.id))
      .map((row) => ({
        id: row.id,
        label:
          type === "record"
            ? row.title || "Untitled record"
            : [row.part_number, row.name].filter(Boolean).join(" · "),
      }));
  }
  return (await loadCatalog())[type] || [];
}

async function addLinkDialog() {
  const data = await loadCatalog();
  const choice = {
    type: "family",
    project: "",
    target: "",
    relation: "applies_to",
    note: "",
    options: [],
    query: "",
  };
  const results = node("div", "", "family-results");
  const projectRow = field(
    "Project",
    "",
    (value) => {
      choice.project = value;
      void reload();
    },
    {
      options: [
        { value: "", label: "Choose a project" },
        ...data.projects.map((project) => ({
          value: project.id,
          label: project.name,
        })),
      ],
    },
  );
  const paint = () => {
    results.replaceChildren();
    const query = choice.query.toLowerCase().trim();
    const matches = choice.options
      .filter((option) => option.label.toLowerCase().includes(query))
      .sort((a, b) => a.label.localeCompare(b.label))
      .slice(0, 40);
    for (const option of matches) {
      results.append(
        listCard(
          option.label,
          () => {
            choice.target = option.id;
            paint();
          },
          choice.target === option.id ? "is-selected" : "",
        ),
      );
    }
    if (!matches.length) {
      const message =
        choice.type === "record" && !choice.project
          ? "Choose a project first."
          : "Nothing matches.";
      results.append(node("p", message, "empty"));
    }
  };
  const reload = async () => {
    choice.target = "";
    projectRow.hidden = !["record", "use"].includes(choice.type);
    try {
      choice.options = await choicesFor(choice.type, choice.project);
    } catch (failure) {
      choice.options = [];
      error.textContent = failure.message;
    }
    paint();
  };
  const form = node("form");
  const error = node("p", "", "error");
  form.append(
    field(
      "Link to",
      choice.type,
      (value) => {
        choice.type = value;
        void reload();
      },
      { options: targets },
    ),
    projectRow,
    field(
      "Search",
      "",
      (value) => {
        choice.query = value;
        paint();
      },
      { placeholder: "Type to filter" },
    ),
    results,
    field(
      "Relation",
      choice.relation,
      (value) => {
        choice.relation = value;
      },
      { options: relations },
    ),
    limit(
      field("Note (optional)", "", (value) => {
        choice.note = value;
      }),
      limits.note,
    ),
    error,
    actions(
      button("Add link", () => form.requestSubmit(), "button--primary"),
      button("Cancel", () => dialog.close()),
    ),
  );
  form.onsubmit = (event) => {
    event.preventDefault();
    if (!choice.target) {
      error.textContent = "Choose something from the list.";
      return;
    }
    void run(async () => {
      try {
        await requestWorkshop("/api/knowledge", "POST", {
          entity: "link",
          record: {
            id: crypto.randomUUID(),
            tile_id: selectedTile,
            target_type: choice.type,
            target_id: choice.target,
            target_project_id: ["record", "use"].includes(choice.type)
              ? choice.project
              : null,
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
  await reload();
}

// knowledge.html?new=1&link=use:<id> (family=<id> still works).
function startingLink() {
  const [type, id] = (params.get("link") || "").split(":");
  if (["family", "product", "use", "project"].includes(type) && id)
    return { target_type: type, target_id: id };
  if (params.get("family"))
    return { target_type: "family", target_id: params.get("family") };
  return null;
}

fillSelect($("#type-filter"), tileTypes, "All types");
fillSelect($("#status-filter"), tileStatuses, "Draft and verified");
for (const id of [
  "#tile-search",
  "#type-filter",
  "#status-filter",
  "#show-archived",
]) {
  $(id).addEventListener(
    id === "#tile-search" ? "input" : "change",
    renderList,
  );
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
  if (params.get("new") === "1") newTile(startingLink());
  else renderDetail();
} catch (error) {
  const failure = panel("Info Bits unavailable");
  failure.append(node("p", error.message, "error"));
  detail.replaceChildren(
    failure,
    button("Try again", () => location.reload()),
  );
  const signIn = node("a", "Open Projects to sign in");
  signIn.href = "/project.html";
  detail.append(signIn);
  status(error.message, true);
}
