// Curated retirement only. Dry run by default; --write applies the reviewed list.
// Prettier's pinned CSS parser supplies balanced selector trees and exact spans.
import {readFileSync, writeFileSync, readdirSync, existsSync} from "node:fs";
import * as prettier from "prettier";
import {classProducers} from "./css-producers.mjs";

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
const {classes: produced} = await classProducers();
const dynamic = existsSync("scripts/css-dynamic-classes.json") ? JSON.parse(readFileSync("scripts/css-dynamic-classes.json", "utf8")) : [];
for (const name of retired) if (produced.has(name) || dynamic.some(item => new RegExp(item.pattern).test(name))) throw Error(name + " is referenced by a reachable producer; review before pruning.");

function hasRetired(node) {
  return node.type === "selector-class" && retired.has(node.value) || (node.nodes || []).some(hasRetired);
}
function printNode(node) {
  const namespace = node.namespace === undefined ? "" : (node.namespace === true ? "" : node.namespace) + "|";
  switch(node.type) {
    case "selector-class": return "." + node.value;
    case "selector-id": return "#" + node.value;
    case "selector-tag": case "selector-universal": return namespace + node.value;
    case "selector-attribute": return "[" + namespace + node.attribute + (node.operator || "") + (node.value || "") + (node.raws?.insensitive || (node.insensitive ? " i" : "")) + "]";
    case "selector-pseudo": return node.value + (node.nodes ? "(" + node.nodes.map(selector => selector.nodes.map(printNode).join("")).join(", ") + ")" : "");
    case "selector-combinator": return node.value === " " ? " " : " " + node.value + " ";
    case "selector-string": case "selector-nesting": return node.value;
    case "selector-comment": return node.value.startsWith("/*") ? node.value : "/*" + node.value + "*/";
    default: throw Error("Unsupported selector node: " + node.type);
  }
}
function simplify(selector, raw) {
  let result = "", compound = [], seen = false;
  const flush = () => { if (seen) result += compound.join("") || "*"; compound = []; seen = false; };
  for (const node of selector.nodes) {
    if (node.type === "selector-combinator") { flush(); result += node.value === " " ? " " : " " + node.value + " "; continue; }
    seen = true;
    if (node.type === "selector-class" && retired.has(node.value)) return null;
    if (node.type === "selector-pseudo" && node.nodes && [":is", ":where", ":has", ":not"].includes(node.value)) {
      const kept = node.nodes.map(child => simplify(child, raw)).filter(value => value !== null);
      if (node.value === ":not") {
        if (kept.includes("*")) return null;
        if (!kept.length) continue;
      } else {
        if (!kept.length) return null;
        if (node.value !== ":has" && kept.includes("*")) continue;
      }
      compound.push(node.value + "(" + kept.join(", ") + ")");
    } else compound.push(printNode(node));
  }
  flush();
  return result.trim();
}
let total = 0, bytes = 0;
for (const file of readdirSync("assets").filter(name => name.endsWith(".css"))) {
  const path = "assets/" + file, original = readFileSync(path, "utf8");
  const {ast} = await prettier.__debug.parse(original, {parser: "css"});
  const edits = [];
  function visit(node) {
    if (node.type === "css-rule") {
      // Retired required classes cannot match. Simplify boolean pseudos as
      // well: :not(dead) is true; :is(dead, live) keeps its live branch.
      if (!hasRetired(node.selector)) return;
      const raw = node.raws.selector, pieces = splitSelectors(raw);
      if (pieces.length !== node.selector.nodes.length) throw Error("Selector split mismatch in " + path);
      const kept = node.selector.nodes.map((selector, index) => {
        if (!hasRetired(selector)) return pieces[index];
        total++;
        return simplify(selector, raw);
      }).filter(value => value !== null);
      const start = node.source.start.offset, end = node.source.end.offset;
      if (!kept.length) edits.push({start, end, value: ""});
      else edits.push({start, end: original.indexOf("{", start), value: kept.join(",\n") + " "});
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
console.log(total + " selectors retired or simplified; " + bytes + " bytes saved" + (process.argv.includes("--write") ? "." : " (dry run)."));
if (process.argv.includes("--check") && total) throw Error(total + " retired selectors remain; review and remove them before merging.");
