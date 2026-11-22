// Curated retirement only. Dry run by default; --write applies the reviewed list.
// Prettier's pinned CSS parser supplies balanced selector trees and exact spans.
import {readFileSync, writeFileSync, readdirSync} from "node:fs";
import * as prettier from "prettier";

const retired = new Set(JSON.parse(readFileSync("scripts/css-retired.json", "utf8")).classes);
function splitSelectors(text) {
  let depth = 0, quote = "", start = 0;
  const pieces = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\\") { i++; continue; }
    if (quote) { if (ch === quote) quote = ""; continue; }
    if (ch === '"' || ch === "'") quote = ch;
    else if ("([".includes(ch)) depth++;
    else if (")]".includes(ch)) depth--;
    else if (ch === "," && depth === 0) { pieces.push(text.slice(start, i).trim()); start = i + 1; }
  }
  pieces.push(text.slice(start).trim());
  return pieces;
}
const sources = ["index.html", "workshop.html", "knowledge.html", ...readdirSync("assets").filter(name => name.endsWith(".js")).map(name => "assets/" + name)];
for (const name of retired) {
  // Stop on any exact reference reintroduced since review. Substring class
  // variants are separate classes and must not trigger accidental deletion.
  const pattern = new RegExp("(?<![\\w-])" + name + "(?![\\w-])");
  for (const file of sources) if (pattern.test(readFileSync(file, "utf8"))) throw Error(name + " is referenced in " + file + "; review before pruning.");
}
let total = 0, bytes = 0;
for (const file of readdirSync("assets").filter(name => name.endsWith(".css"))) {
  const path = "assets/" + file, original = readFileSync(path, "utf8");
  const {ast} = await prettier.__debug.parse(original, {parser: "css"});
  const edits = [];
  function visit(node) {
    if (node.type === "css-rule") {
      // Only a required class directly in a selector can prove it dead. Never
      // remove a rule because a class occurs in :not(), :is() or :has().
      const selectors = node.selector.nodes;
      const kept = selectors.filter(selector => !selector.nodes.some(part => part.type === "selector-class" && retired.has(part.value)));
      if (kept.length !== selectors.length) {
        total += selectors.length - kept.length;
        const start = node.source.start.offset, end = node.source.end.offset;
        if (!kept.length) edits.push({start, end, value: ""});
        else {
          const raw = node.raws.selector;
          const pieces = splitSelectors(raw);
          if (pieces.length !== selectors.length) throw Error("Selector split mismatch in " + path);
          edits.push({start, end: original.indexOf("{", start), value: kept.map(selector => pieces[selectors.indexOf(selector)]).join(",\n") + " "});
        }
      }
      return;
    }
    for (const child of node.nodes || []) visit(child);
  }
  visit(ast);
  let result = original;
  for (const edit of edits.sort((a, b) => b.start - a.start)) result = result.slice(0, edit.start) + edit.value + result.slice(edit.end);
  if (edits.length) result = await prettier.format(result, {parser: "css"});
  bytes += Buffer.byteLength(original) - Buffer.byteLength(result);
  if (process.argv.includes("--write") && edits.length) writeFileSync(path, result);
  if (edits.length) console.log(path + ": " + edits.length + " rule edits");
}
console.log(total + " selectors removed; " + bytes + " bytes saved" + (process.argv.includes("--write") ? "." : " (dry run)."));
