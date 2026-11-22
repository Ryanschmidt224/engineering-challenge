// Shared Knowledge rules for the browser page and the Worker API.
import {isWebUrl, validId} from "./family-model.js";

// A tile type is only a label. Adding or renaming one must not need new
// fields, screens or rules (owner decision, Nov 22).
export const tileTypes = [
  {value: "concept", label: "Concept"},
  {value: "method", label: "Method"},
  {value: "lesson", label: "Lesson"},
];
export const tileStatuses = [
  {value: "draft", label: "Draft"},
  {value: "verified", label: "Verified"},
];

// Relations always read forward, from the tile to its target:
// "<tile> applies to <family>". Incoming views show the same sentence rather
// than inventing a reverse claim.
export const relations = [
  {value: "applies_to", label: "Applies to"},
  {value: "explains", label: "Explains"},
  {value: "measured_with", label: "Measured with"},
  {value: "caused_by", label: "Caused by"},
  {value: "see_also", label: "See also"},
];

// What a tile can link to. "use" is a project part that uses a Workshop
// family (the current project-part model); "record" is a top-level project
// record (test, problem, note) and is identified together with its project.
export const targets = [
  {value: "tile", label: "Knowledge tile"},
  {value: "family", label: "Workshop family"},
  {value: "product", label: "Workshop product"},
  {value: "use", label: "Project part"},
  {value: "project", label: "Project"},
  {value: "record", label: "Project record"},
];
export const targetTypes = targets.map((target) => target.value);
const projectId = /^(?:launcher|linear|robot|p[a-f0-9]{32})$/;

export const limits = {title: 160, summary: 400, body: 20000, sources: 20, sourceTitle: 160, note: 300};

export const labelFor = (list, value) => list.find((entry) => entry.value === value)?.label || value;

function text(value, max, name, required = false) {
  if (value === undefined || value === null) value = "";
  if (typeof value !== "string") throw Error(name + " must be text.");
  const trimmed = value.trim();
  if (required && !trimmed) throw Error(name + " is required.");
  if (trimmed.length > max) throw Error(name + " must be at most " + max + " characters.");
  return trimmed;
}

// Returns a cleaned copy, or throws with a message suitable for the owner.
export function validateTile(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) throw Error("Invalid knowledge tile.");
  if (!validId(record.id)) throw Error("Invalid knowledge tile ID.");
  if (!tileTypes.some((type) => type.value === record.type)) throw Error("Choose Concept, Method or Lesson.");
  if (!tileStatuses.some((status) => status.value === record.status)) throw Error("Choose Draft or Verified.");
  const sources = record.sources ?? [];
  if (!Array.isArray(sources) || sources.length > limits.sources) throw Error("Use at most " + limits.sources + " sources.");
  return {
    id: record.id,
    type: record.type,
    status: record.status,
    title: text(record.title, limits.title, "Title", true),
    summary: text(record.summary, limits.summary, "Summary", true),
    body: text(record.body, limits.body, "Body"),
    sources: sources.map((source) => {
      if (!source || typeof source !== "object" || Array.isArray(source)) throw Error("Invalid source.");
      const url = text(source.url, 1200, "Source link", true);
      if (!isWebUrl(url)) throw Error("Source links must start with http:// or https://.");
      return {title: text(source.title, limits.sourceTitle, "Source title"), url};
    }),
  };
}

export function validateLink(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) throw Error("Invalid link.");
  if (!validId(record.id) || !validId(record.tile_id)) throw Error("Invalid link ID.");
  if (!targetTypes.includes(record.target_type)) throw Error("This kind of link target is not supported yet.");
  if (!validId(record.target_id)) throw Error("Choose what this tile links to.");
  if (record.target_type === "tile" && record.target_id === record.tile_id) throw Error("A tile cannot link to itself.");
  const needsProject = record.target_type === "record";
  if (needsProject && !projectId.test(String(record.target_project_id || ""))) throw Error("Choose the project of this record.");
  const relation = record.relation || "see_also";
  if (!relations.some((entry) => entry.value === relation)) throw Error("Choose a listed relation.");
  return {
    id: record.id,
    tile_id: record.tile_id,
    target_type: record.target_type,
    target_id: record.target_id,
    target_project_id: needsProject ? record.target_project_id : null,
    relation,
    note: text(record.note, limits.note, "Link note"),
  };
}

// Plain text only: split into paragraphs on blank lines. Callers set
// textContent, never innerHTML.
export const paragraphs = (body) =>
  String(body || "")
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);

// Where a link target opens in the app.
export function targetHref(link) {
  const id = encodeURIComponent(link.target_id);
  const project = encodeURIComponent(link.target_project_id || "");
  switch (link.target_type) {
    case "tile":
      return "knowledge.html?tile=" + id;
    case "family":
      return "workshop.html?family=" + id;
    case "product":
      return "workshop.html?product=" + id;
    case "use":
      return project ? "index.html#" + project + "/part/" + id : "workshop.html?use=" + id;
    case "project":
      return "index.html#" + id;
    case "record":
      return "index.html?record=" + id + "#" + project;
    default:
      return "";
  }
}
