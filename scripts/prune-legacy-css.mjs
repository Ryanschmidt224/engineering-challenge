// Operator utility for the CSS migration (docs/UI_STANDARDS.md): removes the
// legacy rules that styled a component's frame/header once that component is
// built by the shared UI kit. Content rules scoped by the same class are kept.
// Usage: node scripts/prune-legacy-css.mjs  (then: npm run format:css)
import {readFileSync, writeFileSync} from "node:fs";

// Elements that no longer exist: any selector mentioning them is dead.
const removedElements = [
  "recipe-heading-row", "recipe-disclosure-toggle", "workspace-tool-actions", "part-details-view-heading",
  "part-details-heading-copy", "bs-unstructured-notes-heading", "bs-unstructured-content", "workspace-primary-disclosure",
  "workspace-secondary-disclosure", "workspace-backup-details", "assembly-archived-items", "instruction-history",
];
// Classes still present (on a section root or body) to scope content styles.
// Their own frame/header rules are dropped: the shared section owns those.
const frameOwners = [
  "recipe-instructions", "workspace-resource-disclosure", "workspace-archive-history", "assembly-archived-disclosure",
  "part-details-collapse", "part-details-view", "bs-unstructured-notes",
];
const has = (text, name) => new RegExp("\\." + name + "(?![\\w-])").test(text);

function splitTop(text, separator = ",") {
  const parts = [];
  let depth = 0, current = "";
  for (const ch of text) {
    if ("([".includes(ch)) depth++;
    if (")]".includes(ch)) depth--;
    if (ch === separator && depth === 0) { parts.push(current); current = ""; } else current += ch;
  }
  parts.push(current);
  return parts.map((part) => part.trim()).filter(Boolean);
}
function compounds(selector) {
  return splitTop(selector.replace(/\s*([>+~])\s*/g, " $1 ").replace(/\s+/g, " "), " ").filter((token) => !">+~".includes(token));
}
// The Work instructions article is the only article placed directly in
// .workspace-panels; rules for that frame and its heading are now the kit's.
const deadPatterns = [/\.workspace-panels\s*>\s*article(?:\.recipe-instructions)?(?:\s+h2)?\s*$/];
function dead(selector) {
  if (removedElements.some((name) => has(selector, name))) return true;
  if (deadPatterns.some((pattern) => pattern.test(selector))) return true;
  const parts = compounds(selector);
  const last = parts.at(-1) || "";
  for (const name of frameOwners) {
    if (!has(selector, name)) continue;
    if (has(last, name)) return true; // the frame itself
    const index = parts.findIndex((part) => has(part, name));
    if (parts.slice(index + 1).some((part) => /^summary|\bsummary\b|::?-webkit-details-marker/.test(part))) return true; // its header
    if (name === "recipe-instructions" && parts.slice(index + 1).some((part) => /^\.recipe-editor\b/.test(part))) return true; // its body frame
  }
  return false;
}
// Drop dead arguments inside :is(...) first; drop the selector if none remain.
function pruneSelector(selector) {
  let output = "", i = 0;
  while (i < selector.length) {
    const at = selector.indexOf(":is(", i);
    if (at < 0) { output += selector.slice(i); break; }
    output += selector.slice(i, at);
    let depth = 0, j = at + 3;
    for (; j < selector.length; j++) {
      if (selector[j] === "(") depth++;
      if (selector[j] === ")" && --depth === 0) break;
    }
    const args = splitTop(selector.slice(at + 4, j)).filter((arg) => !dead(arg));
    if (!args.length) return null;
    output += ":is(" + args.join(", ") + ")";
    i = j + 1;
  }
  return dead(output) ? null : output;
}
function prune(css) {
  let removed = 0;
  // Innermost rule blocks only (prettier output: "selector {\n  decl;\n}").
  const result = css.replace(/(?<=^|[;{}])(\s*)((?:\/\*(?:(?!\*\/)[\s\S])*\*\/\s*)*)([^{};@\/\s][^{}]*?)\{([^{}]*)\}/g, (match, lead, comments, selectorText, body) => {
    const selectors = splitTop(selectorText.replace(/\/\*[\s\S]*?\*\//g, ""));
    const kept = selectors.map(pruneSelector).filter(Boolean);
    if (kept.length === selectors.length && kept.every((sel, k) => sel === selectors[k])) return match;
    removed += selectors.length - kept.length;
    if (!kept.length) return lead;
    return lead + comments + kept.join(",\n") + " {" + body + "}";
  });
  // Remove @media blocks left empty.
  return {css: result.replace(/@media[^{]+\{\s*\}/g, ""), removed};
}
let total = 0;
for (const file of process.argv.slice(2).length ? process.argv.slice(2) : ["assets/site-polish.css", "assets/site-controls.css", "assets/site-workspaces.css", "assets/site.css", "assets/unstructured-notes.css", "assets/dialog-system.css", "assets/parts-management.css"]) {
  const {css, removed} = prune(readFileSync(file, "utf8"));
  if (removed) writeFileSync(file, css);
  total += removed;
  console.log(file, "selectors removed:", removed);
}
console.log("total", total);
