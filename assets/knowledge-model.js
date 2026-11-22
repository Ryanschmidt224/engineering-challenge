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

// Target types are added batch by batch. Batch 2 links tiles to Workshop families.
export const targetTypes = ["family"];

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
  const relation = record.relation || "see_also";
  if (!relations.some((entry) => entry.value === relation)) throw Error("Choose a listed relation.");
  return {
    id: record.id,
    tile_id: record.tile_id,
    target_type: record.target_type,
    target_id: record.target_id,
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
