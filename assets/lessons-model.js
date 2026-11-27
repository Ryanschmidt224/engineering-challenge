// Lessons Learned: shared rules for the browser page and the Worker API.
//
// An lesson is one story: "What happened?", then ordered steps
// (question / hypothesis / what was tested or learned, plus photos), then an
// optional resolution with a quality rating. [[Name]] in any text links to the
// lesson whose title (first line of "What happened") matches Name.
//
// Pure functions only: no DOM, no fetch, no D1. Tested by
// tests/lessons-learned.test.mjs.
import { validId } from "./family-model.js";

export const limits = Object.freeze({
  happened: 2000,
  question: 300,
  hypothesis: 600,
  result: 8000,
  resolution: 8000,
  steps: 60,
  photosPerStep: 12,
  title: 160,
});

// The order here is the order of the quality filter and the Yes/Meh/No choice.
export const qualities = Object.freeze([
  { value: "yes", label: "Yes" },
  { value: "meh", label: "Meh" },
  { value: "no", label: "No" },
]);
export const qualityValues = qualities.map((q) => q.value);

const linkPattern = /\[\[([^\[\]\n]{1,160})\]\]/g;

const text = (value, max, name) => {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw Error(name + " must be text.");
  // Normalise line endings; keep the writer's own spacing otherwise.
  const clean = value.replace(/\r\n?/g, "\n");
  if (clean.length > max)
    throw Error(name + " is too long (" + max + " characters at most).");
  return clean;
};

/** The title shown in the list and used for [[links]]: first line of "What happened". */
export function titleOf(bit) {
  const first = String(bit?.happened || "")
    .split("\n")[0]
    .trim();
  return first.length > limits.title
    ? first.slice(0, limits.title - 1) + "…"
    : first;
}

/** Comparable form of a title or link name. */
export const nameKey = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

/** Validate and normalise one lesson as sent by the browser. */
export function validateBit(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw Error("Invalid lesson.");
  if (!validId(input.id)) throw Error("Invalid lesson ID.");
  const happened = text(input.happened, limits.happened, "What happened");
  if (!Array.isArray(input.steps)) throw Error("Steps must be a list.");
  if (input.steps.length > limits.steps)
    throw Error("An lesson can have " + limits.steps + " steps at most.");
  const stepIds = new Set();
  const photoIds = new Set();
  const steps = input.steps.map((step, index) => {
    const n = "Step " + (index + 1);
    if (!step || typeof step !== "object" || Array.isArray(step))
      throw Error(n + " is invalid.");
    if (!validId(step.id) || stepIds.has(step.id))
      throw Error(n + " needs its own ID.");
    stepIds.add(step.id);
    const photos = step.photos ?? [];
    if (!Array.isArray(photos) || photos.length > limits.photosPerStep)
      throw Error(n + " can have " + limits.photosPerStep + " photos at most.");
    for (const id of photos) {
      if (!validId(id) || photoIds.has(id))
        throw Error(n + " has an invalid or repeated photo.");
      photoIds.add(id);
    }
    return {
      id: step.id,
      question: text(step.question, limits.question, n + " question"),
      hypothesis: text(step.hypothesis, limits.hypothesis, n + " hypothesis"),
      result: text(step.result, limits.result, n + " result"),
      photos: [...photos],
    };
  });
  let resolution = null;
  if (input.resolution !== null && input.resolution !== undefined) {
    const r = input.resolution;
    if (typeof r !== "object" || Array.isArray(r))
      throw Error("Invalid resolution.");
    const quality = r.quality ?? null;
    if (quality !== null && !qualityValues.includes(quality))
      throw Error("Quality must be Yes, Meh or No.");
    resolution = {
      text: text(r.text, limits.resolution, "Resolution"),
      quality,
    };
  }
  return { id: input.id, happened, steps, resolution };
}

/** True when nothing has been written (used to drop abandoned new bits). */
export function isBlank(bit) {
  return (
    !bit.happened.trim() &&
    bit.steps.every(
      (s) =>
        !s.question.trim() &&
        !s.hypothesis.trim() &&
        !s.result.trim() &&
        !s.photos.length,
    ) &&
    (!bit.resolution ||
      (!bit.resolution.text.trim() && !bit.resolution.quality))
  );
}

/** Every piece of text in a bit, in reading order. */
export function textsOf(bit) {
  return [
    bit.happened,
    ...bit.steps.flatMap((s) => [s.question, s.hypothesis, s.result]),
    bit.resolution ? bit.resolution.text : "",
  ];
}

/** Lower-case text used by search: link brackets removed. Stored in D1 too. */
export function searchTextOf(bit) {
  return textsOf(bit)
    .join("\n")
    .replace(/\[\[|\]\]/g, "")
    .toLowerCase();
}

/** "yes" | "meh" | "no" | "none" — "none" when unrated. */
export const qualityOf = (bit) => bit.resolution?.quality || "none";

/** Link names written in one text, in order, without repeats. */
export function linkNames(value) {
  const seen = new Set();
  const names = [];
  for (const match of String(value || "").matchAll(linkPattern)) {
    const name = match[1].trim();
    if (name && !seen.has(nameKey(name))) {
      seen.add(nameKey(name));
      names.push(name);
    }
  }
  return names;
}

/**
 * Split text into plain and link segments for display. Never returns HTML:
 * the page renders each segment with textContent.
 * resolve(name) -> bit or null.
 */
export function segments(value, resolve) {
  const parts = String(value || "").split(/\[\[([^\[\]\n]{1,160})\]\]/);
  const out = [];
  parts.forEach((part, index) => {
    if (index % 2 === 0) {
      if (part) out.push({ kind: "text", text: part });
    } else {
      const target = resolve(part.trim());
      out.push({ kind: "link", text: part, name: part.trim(), target });
    }
  });
  return out;
}

/** Map of title key -> bit; the oldest bit wins when two share a title. */
export function titleIndex(bits) {
  const index = new Map();
  const ordered = [...bits].sort((a, b) =>
    String(a.created_at || "").localeCompare(String(b.created_at || "")),
  );
  for (const bit of ordered) {
    const key = nameKey(titleOf(bit));
    if (key && !index.has(key)) index.set(key, bit);
  }
  for (const bit of ordered)
    for (const alias of bit.aliases || []) {
      const key = nameKey(alias);
      if (key && !index.has(key)) index.set(key, bit);
    }
  return index;
}

/** Bits (other than `bit`) whose text links to `bit`'s title. */
export function backlinksOf(bit, bits) {
  const index = titleIndex(bits);
  return bits.filter(
    (other) =>
      other.id !== bit.id &&
      textsOf(other).some((t) =>
        linkNames(t).some((n) => index.get(nameKey(n))?.id === bit.id),
      ),
  );
}

/** List filter used by the page: search words (all must match) + quality. */
export function filterBits(bits, { search = "", quality = "" } = {}) {
  const words = nameKey(search).split(" ").filter(Boolean);
  return bits.filter(
    (bit) =>
      (!quality || qualityOf(bit) === quality) &&
      words.every((w) => searchTextOf(bit).includes(w)),
  );
}

/** Step list helpers (return new arrays; never mutate). */
export function insertStep(steps, index, step) {
  const at = Math.max(0, Math.min(index, steps.length));
  return [...steps.slice(0, at), step, ...steps.slice(at)];
}
export function moveStep(steps, index, delta) {
  const to = index + delta;
  if (index < 0 || index >= steps.length || to < 0 || to >= steps.length)
    return steps;
  const copy = [...steps];
  [copy[index], copy[to]] = [copy[to], copy[index]];
  return copy;
}
export const emptyStep = (id) => ({
  id,
  question: "",
  hypothesis: "",
  result: "",
  photos: [],
});
