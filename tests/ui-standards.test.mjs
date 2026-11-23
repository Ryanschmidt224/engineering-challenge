// Guards the shared UI kit described in docs/UI_STANDARDS.md.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const index = read("index.html");

test("index.html loads the UI kit stylesheet last and its script before consumers", () => {
  const sheets = [...index.matchAll(/<link rel="stylesheet" href="\/assets\/([a-z-]+)\.css/g)].map((m) => m[1]);
  assert.equal(sheets.at(-1), "ui-kit");
  const scripts = [...index.matchAll(/<script src="\/assets\/([a-z-]+)\.js/g)].map((m) => m[1]);
  for (const consumer of ["site-assembly", "recipe-editor", "unstructured-notes"]) {
    assert.ok(scripts.indexOf("ui-kit") >= 0 && scripts.indexOf("ui-kit") < scripts.indexOf(consumer), consumer);
  }
});

test("module pages share base, components and the kit", () => {
  for (const page of ["workshop.html", "knowledge.html"]) {
    const html = read(page);
    const order = ["theme", "base", "components", "ui-kit"].map((name) => html.indexOf("assets/" + name + ".css"));
    assert.ok(order.every((at, i) => at > 0 && (i === 0 || at > order[i - 1])), page);
  }
});

test("shared kit files stay free of !important", () => {
  for (const file of ["assets/ui-kit.css", "assets/base.css", "assets/components.css"]) {
    assert.doesNotMatch(read(file).replace(/\/\*[\s\S]*?\*\//g, ""), /!important/, file);
  }
});

test("part and assembly sections are built by the kit, not by hand", () => {
  const assembly = read("assets/site-assembly.js");
  for (const role of ["helpful-tools", "history", "backups", "recent-changes", "part-details"]) {
    assert.match(assembly, new RegExp('role:"' + role + '"'), role);
  }
  assert.match(read("assets/tree-archive.js"), /ui\.section\(\{title:"Archive",role:"archive-folder"/);
  assert.match(read("assets/unstructured-notes.js"), /BSUI\.section\(/);
  assert.match(read("assets/recipe-editor.js"), /BSUI\?\.sectionShell\(/);
  const retired = ["workspace-primary-disclosure", "workspace-secondary-disclosure", "workspace-backup-details", "recipe-heading-row", "recipe-disclosure-toggle", "bs-unstructured-notes-heading", "part-details-view-heading", "workspace-tool-actions"];
  for (const file of ["assets/site-assembly.js", "assets/recipe-editor.js", "assets/unstructured-notes.js"]) {
    const source = read(file);
    for (const name of retired) assert.ok(!source.includes(name), file + " still builds " + name);
  }
});

test("projects toolbar uses the shared controls", () => {
  const manager = read("assets/project-manager.js");
  assert.match(manager, /"ui-button ui-button--primary project-directory-new"/);
  assert.match(manager, /"ui-control project-search"/);
  assert.doesNotMatch(manager.split("\n").slice(15, 40).join("\n"), /"btn( primary)?"|"field /);
});
