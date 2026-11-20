import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {handleAccounts} from "../functions/api/accounts.js";
import {onRequest as projects} from "../functions/api/projects.js";
import {handleRecipeFiles} from "../functions/api/recipe-files.js";
import {handleWorkspace} from "../functions/api/workspace.js";
import {handleProjectArchive, inspectArchive} from "../functions/api/project-archive.js";
import {backupAllProjects} from "../functions/api/automatic-backups.js";
import "../assets/local-project.js";

function makeBucket() {
 const entries = new Map();
 return {
  async put(key, value, options = {}) {
   const old = entries.get(key);
   if (options.onlyIf?.etagMatches && old?.etag !== options.onlyIf.etagMatches) return null;
   if (options.onlyIf?.etagDoesNotMatch === "*" && old) return null;
   const bytes = Buffer.from(value);
   const entry = {
    etag: crypto.randomUUID(), size: bytes.length, httpMetadata: options.httpMetadata,
    customMetadata: options.customMetadata, text: async () => bytes.toString(),
    arrayBuffer: async () => Uint8Array.from(bytes).buffer, body: bytes
   };
   entries.set(key, entry);
   return entry;
  },
  async get(key) { return entries.get(key) || null; },
  async head(key) { return entries.get(key) || null; },
  async list({prefix}) {
   return {objects: [...entries.keys()].filter(k => k.startsWith(prefix)).map(key => ({key})), truncated: false};
  }
 };
}

test("owner can save KiCad and code steps and recover only the selected project offline", async () => {
 const env = {PHOTOS: makeBucket(), admin_password: "fixture-only"};
 const origin = "https://example.test";
 let cookie = "";
 const request = (path, method = "GET", json) => new Request(origin + path, {
  method, headers: {origin, cookie, "content-type": "application/json"},
  body: json === undefined ? undefined : JSON.stringify(json)
 });
 const registered = await handleAccounts(request("/api/accounts", "POST", {
  action: "register", email: "fixture@example.test", password: "test-project-owner"
 }), env);
 assert.equal(registered.status, 201);
 cookie = registered.headers.get("set-cookie").split(";")[0];
 async function create(name) {
  const response = await projects({env, request: request("/api/projects", "POST", {name})});
  assert.equal(response.status, 200);
  return (await response.json()).projects.find(p => p.name === name).id;
 }
 const project = await create("Board test");
 const other = await create("Separate fixture");
 await projects({env, request: request("/api/projects", "PATCH", {id: project, summary: "Verify the board files"})});
 const path = "/api/workspace?project=" + project + "&assembly=__root__";
 const files = [];
 const payloads = new Map();
 for (const name of ["board.kicad_pcb", "board.kicad_pro", "board.kicad_sch", "blink.ino", "config.json", "manual.pdf"]) {
  const body = "Fixture bytes for " + name;
  const uploaded = await handleRecipeFiles(new Request(origin + "/api/recipe-files?project=" + project, {
   method: "POST", headers: {origin, cookie, "x-file-name": name}, body
  }), env);
  assert.equal(uploaded.status, 201, name);
  const {id} = await uploaded.json();
  files.push(id);
  payloads.set(id, body);
 }
 const step = {id: "layout", title: "Check layout", standard: "", photos: files};
 const save = recipe => handleWorkspace(request(path, "PUT", {recipe}), env);
 assert.equal((await save([step])).status, 200);
 assert.deepEqual((await (await handleWorkspace(request(path), env)).json()).workspace.recipe[0].photos, files);
 for (const bad of [files[0].replace(project, other), files[0].replace("kicad_pcb", "exe"), "recipe-files/" + project + "/" + crypto.randomUUID() + ".pdf"]) {
  assert.equal((await save([{...step, photos: [bad]}])).status, 400);
 }

 const records = [
  ["project-settings/" + project + ".json", '{"title":"Bench project"}'],
  ["change-proposals/" + project + ".json", "[]"],
  ["assembly-status/" + project + "/module.json", '{"needsAttention":true}'],
  ["photo-annotations/" + project + "/cover.jpg.json", '{"marks":[]}'],
  ["photo-renders/component-thumbnails/" + project + "/part-a/version-b.webp", "edited part"],
  ["photo-renders/recipe-files/" + project + "/diagram.png.webp", "edited step"]
 ];
 for (const [key, bytes] of records) {
  await env.PHOTOS.put(key, bytes);
  await env.PHOTOS.put(key.replace(project, other), "foreign fixture");
 }
 const response = await handleProjectArchive(request("/api/project/archive?project=" + project), env);
 assert.equal(response.status, 200);
 const archive = await response.json();
 await inspectArchive(archive, project);
 const reopened = await globalThis.BSLocalProject.open(archive);
 assert.equal(reopened.getJson("project-profile/" + project + ".json").summary, "Verify the board files");
 assert.ok(!reopened.keys().some(key => key.includes(other) || key === "project-catalog/v1.json"));
 for (const [key, bytes] of [...records, ...payloads]) assert.equal(Buffer.from(reopened.get(key)).toString(), bytes);

 const window = {crypto};
 const context = {window, TextDecoder, Uint8Array, atob, BSArchiveLayout: globalThis.BSArchiveLayout};
 for (const path of ["assets/archive-check.js", "assets/project-readable-backup.js"])
  runInNewContext(readFileSync(path, "utf8"), context);
 const verified = await window.BSArchiveCheck.inspect(new Blob([JSON.stringify(archive)]), project);
 assert.equal(verified.objectCount, archive.objectCount);
 const html = window.BSReadableBackup.build(archive, "Offline copy");
 assert.match(html, /Verify the board files/);
 assert.match(html, /download="board.kicad_pcb"/);
 assert.match(html, /download="config.json"/);
 assert.ok(!html.includes("Separate fixture"));

 const results = await backupAllProjects(env);
 const snapshot = results.find(result => result.project === project);
 assert.equal(snapshot.status, "saved");
 const automatic = await globalThis.BSLocalProject.open(JSON.parse(await (await env.PHOTOS.get(snapshot.key)).text()));
 assert.deepEqual(automatic.keys().sort(), reopened.keys().sort());
});
