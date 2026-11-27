import { isWebUrl } from "./family-model.js";
// Shared presentation for current Workshop values and frozen project sources.
export function lookupEvidenceView(
  evidence,
  { documentUrl, compact = false } = {},
) {
  const details = document.createElement("details"),
    summary = document.createElement("summary");
  summary.textContent = compact ? "AI source" : "AI source and conditions";
  if (compact) {
    details.className = "workshop-source";
    summary.title = "AI source and test conditions";
  }
  details.append(summary);
  const add = (text) => {
    const p = document.createElement("p");
    p.textContent = text;
    details.append(p);
  };
  add(
    "Source value: " +
      String(evidence.value) +
      (evidence.unit ? " " + evidence.unit : ""),
  );
  if (evidence.conditions) add("Conditions: " + evidence.conditions);
  if (isWebUrl(evidence.sourceUrl)) {
    const p = document.createElement("p"),
      a = document.createElement("a");
    a.href = evidence.sourceUrl;
    a.textContent = "Source";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    p.append(a);
    details.append(p);
  }
  if (evidence.document) {
    add("Technical document: " + evidence.document.name);
    add("SHA-256: " + evidence.document.sha256);
    if (documentUrl) {
      const a = document.createElement("a");
      a.href = documentUrl;
      a.textContent = "Open copied source document";
      details.append(a);
    }
  }
  add("AI-assisted value; verify against the source.");
  return details;
}
