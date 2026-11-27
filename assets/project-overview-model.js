// Project-level content, independent of part definitions and numbered revisions.
const text = (v, max, label) => {
  if (typeof v !== "string" || v.length > max || v.includes("\0"))
    throw Error(label + " must be text of at most " + max + " characters.");
  return v.trim();
};
export const emptyOverview = () => ({
  version: 1,
  shortSummary: "",
  description: "",
  tags: [],
  prices: {},
  intent: null,
  intentVersions: [],
  milestones: [],
  notes: [],
});
export function normalizeOverview(raw = {}) {
  if (typeof raw === "string") raw = JSON.parse(raw);
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw Error("Invalid project overview.");
  const out = { ...emptyOverview(), ...raw };
  if (out.version !== 1) throw Error("Unsupported project overview.");
  out.shortSummary = text(out.shortSummary, 40, "Short summary");
  out.description = text(out.description, 12000, "Summary");
  if (!Array.isArray(out.tags) || out.tags.length > 20)
    throw Error("Use at most 20 tags.");
  out.tags = [
    ...new Set(out.tags.map((v) => text(v, 60, "Tag")).filter(Boolean)),
  ];
  if (
    !out.prices ||
    typeof out.prices !== "object" ||
    Array.isArray(out.prices) ||
    Object.keys(out.prices).length > 1000
  )
    throw Error("Invalid project prices.");
  out.prices = Object.fromEntries(
    Object.entries(out.prices).map(([id, p]) => {
      if (
        !/^[-a-f0-9]{36}$/i.test(id) ||
        !p ||
        !Number.isFinite(p.price) ||
        p.price < 0 ||
        p.price > 1e9 ||
        !Number.isFinite(p.packageQuantity) ||
        p.packageQuantity <= 0 ||
        p.packageQuantity > 1e9 ||
        !["per_part", "per_package"].includes(p.basis) ||
        !/^USD$/.test(p.currency)
      )
        throw Error(
          "Use a nonnegative USD price and positive package quantity.",
        );
      return [
        id,
        {
          price: p.price,
          packageQuantity: p.packageQuantity,
          basis: p.basis,
          currency: p.currency,
        },
      ];
    }),
  );
  const record = (v, kind) => {
    if (
      !v ||
      typeof v !== "object" ||
      Array.isArray(v) ||
      !/^\d{4}-\d\d-\d\dT/.test(v.createdAt) ||
      !Number.isFinite(Date.parse(v.createdAt)) ||
      !/^[-a-f0-9]{36}$/i.test(v.id)
    )
      throw Error("Invalid overview record.");
    const r = { id: v.id, createdAt: v.createdAt };
    for (const k of kind === "intent"
      ? ["goal", "success", "plan"]
      : kind === "milestone"
        ? ["title", "significance", "result"]
        : ["title", "body"])
      r[k] = text(v[k] ?? "", k === "title" ? 180 : 12000, k);
    if (kind === "intent") {
      if (!r.goal && !r.success && !r.plan)
        throw Error("Enter an original goal, success criterion or plan.");
      r.preExistingMilestones = Number(v.preExistingMilestones) || 0;
      r.reason = text(v.reason ?? "", 5000, "Reason for editing intent");
    }
    if (kind === "milestone" && (!r.title || !r.significance))
      throw Error("Enter the milestone and why it matters.");
    if (kind === "note") {
      if (!r.title && !r.body) throw Error("Enter a note.");
      r.fileIds = v.fileIds || [];
      if (
        !Array.isArray(r.fileIds) ||
        r.fileIds.length > 12 ||
        r.fileIds.some((id) => !/^[-a-f0-9]{36}$/i.test(id))
      )
        throw Error("Invalid note attachments.");
    }
    return r;
  };
  out.intent = out.intent ? record(out.intent, "intent") : null;
  if (!Array.isArray(out.intentVersions) || out.intentVersions.length > 250)
    throw Error("Use at most 250 intent versions.");
  out.intentVersions = out.intentVersions.map((v) => record(v, "intent"));
  if (
    new Set(out.intentVersions.map((v) => v.id)).size !==
      out.intentVersions.length ||
    out.intentVersions.some((v, i) => i > 0 && !v.reason)
  )
    throw Error("Each intent change requires a reason and a distinct version.");
  if (
    out.intentVersions.length &&
    JSON.stringify(out.intentVersions.at(-1)) !== JSON.stringify(out.intent)
  )
    throw Error("Current intent must match its latest version.");
  for (const [key, kind, max] of [
    ["milestones", "milestone", 250],
    ["notes", "note", 250],
  ]) {
    if (!Array.isArray(out[key]) || out[key].length > max)
      throw Error("Use at most " + max + " " + key + ".");
    out[key] = out[key].map((v) => record(v, kind));
    if (new Set(out[key].map((v) => v.id)).size !== out[key].length)
      throw Error("Duplicate overview record.");
  }
  const result = Object.fromEntries(
    Object.keys(emptyOverview()).map((k) => [k, out[k]]),
  );
  if (new TextEncoder().encode(JSON.stringify(result)).length > 200000)
    throw Error("Project overview exceeds 200 KB.");
  return result;
}
