import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {handleAccounts} from "../functions/api/accounts.js";
import {onRequest as projects} from "../functions/api/projects.js";
import {handleRecipeFiles} from "../functions/api/recipe-files.js";
import {handleProposals} from "../functions/api/proposals.js";
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

async function projectFixture() {
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
 return {env, origin, request, create, cookie};
}

test("owner can save KiCad and code steps and recover only the selected project offline", async () => {
 const {env, origin, request, create, cookie} = await projectFixture();
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

test("manual and scheduled exports freeze only linked Workshop items, shared files, and current prices", async t => {
 const {env, request, create} = await projectFixture();
 const id = await create("Dependencies");
 const {user} = await (await handleAccounts(request("/api/accounts"), env)).json();
 const putJson = (path, value) => env.PHOTOS.put(path, JSON.stringify(value));
 const shared = "workshop:test-mcu", personal = crypto.randomUUID(), secret = crypto.randomUUID();
 const photo = crypto.randomUUID(), otherPhoto = crypto.randomUUID();
 const pdf = "https://ww1.microchip.com/documents/controller.pdf";
 const online = "https://example.test/reference";
 const redirect = "https://www.microchip.com/datasheet";
 const miss = "https://www.microchip.com/dead.pdf";
 const parts = ["P1","P2"].map(key => ({
  id:key, name:"Project chip", projectDetails:{workshopReferenceId:shared},
  workshopSourcing:{price:"1.00",packageQuantity:"2"}, specifications:[{name:"Manual",value:online}]
 }));
 parts.push({id:"P3",name:"Discontinued",projectDetails:{workshopReferenceId:"workshop:gone"},workshopSourcing:{price:"4.00"}});
 await putJson("components/"+id+".json", parts);
 await putJson("workshop-reference-overrides/v1.json", {
  [shared]:{created:true,name:"Controller",price:"9.00",packageQuantity:"10",supplier:"DigiKey",
   supplierPartNumber:"ABC-ND",partNumber:"M123",documentationUrl:pdf,subtitle:"8-bit MCU",
   specifications:[{name:"Alternate manual",value:redirect},{name:"Old datasheet",value:miss}],
   photos:[{id:photo,caption:"Pin diagram"},{id:otherPhoto,caption:"Package"}]},
  "workshop:irrelevant":{created:true,name:"Unrelated public record"}
 });
 const bytes = Buffer.from("%PDF-1.7\nfixture datasheet");
 await env.PHOTOS.put("workshop-reference-photos/"+photo, "pin diagram bytes", {httpMetadata:{contentType:"image/png"}});
 await env.PHOTOS.put("workshop-reference-photos/"+otherPhoto, "case bytes", {httpMetadata:{contentType:"image/jpeg"}});
 await env.PHOTOS.put("user-workshop/"+user.id+"/photos/"+photo, "fixture personal image", {httpMetadata:{contentType:"image/jpeg"}});
 await putJson("user-workshop/"+user.id+"/inventory.json", [
  {id:personal,name:"Fixture caliper",notes:"Private stock note",photoId:photo,specRecords:[{label:"Manual",value:pdf}]},
  {id:secret,name:"Unrelated inventory"}
 ]);
 await putJson("user-workshop/u"+"1".repeat(32)+"/inventory.json", [{id:personal,name:"Other account"}]);
 await putJson("workspaces/"+id+"/__root__.json",{resources:{tools:["my:"+personal],parts:[shared]}});
 const fetched = [];
 t.mock.method(globalThis,"fetch",async (url, options) => {
  fetched.push(url);
  assert.equal(options.credentials,"omit");
  if (url === pdf) return new Response(bytes);
  if (url === miss) return new Response(null,{status:404});
  assert.equal(url,redirect);
  return new Response(null,{status:302,headers:{location:"https://example.test/redirected"}});
 });
 const path = "/api/project/archive?project="+id;
 const manual = await handleProjectArchive(request(path), env);
 assert.equal(manual.status,200);
 const archive = await manual.json();
 await inspectArchive(archive,id);
 const offline = await globalThis.BSLocalProject.open(archive);
 const index = "workshop-dependencies/"+id+"/index.json";
 const manifest = offline.getJson(index);
 assert.equal(manifest.items.length,3);
 const chip = manifest.items.find(item=>item.reference===shared);
 assert.deepEqual([...chip.usedBy].sort(),["P1","P2","workspaces/"+id+"/__root__.json"].sort());
 assert.equal(chip.sourcing.price,"9.00");
 assert.equal(chip.sourcing.packageQuantity,"10");
 assert.equal(chip.manufacturerPartNumber,"M123");
 assert.equal(chip.description,"8-bit MCU");
 assert.equal(chip.sourcing.supplierPartNumber,"ABC-ND");
 const datasheet = chip.documents.find(d=>d.url===pdf);
 assert.deepEqual(Buffer.from(offline.get(datasheet.offlineFile)),bytes);
 assert.ok(chip.documents.find(d=>d.url===online).offlineStatus);
 assert.ok(chip.documents.find(d=>d.url===miss).offlineStatus);
 assert.ok(chip.documents.find(d=>d.url===redirect).offlineStatus);
 assert.deepEqual(chip.photos.map(x=>Buffer.from(offline.get(x.offlineFile)).toString()),["pin diagram bytes","case bytes"]);
 const tool = manifest.items.find(item=>item.reference==="my:"+personal);
 assert.equal(tool.documents[0].offlineFile,datasheet.offlineFile);
 assert.equal(Buffer.from(offline.get(tool.photos[0].offlineFile)).toString(),"fixture personal image");
 assert.equal(manifest.items.find(item=>item.reference==="workshop:gone").sourcing.price,"4.00");
 const win = {};
 runInNewContext(readFileSync("assets/project-readable-backup.js","utf8"),{window:win,URL,TextDecoder,Uint8Array,atob});
 const html = win.BSReadableBackup.build(archive,"Offline");
 assert.match(html,/download="controller.pdf"/);
 assert.ok(html.includes(bytes.toString("base64")));
 assert.ok(html.includes('href="'+online+'"'));
 assert.doesNotMatch(html,/Unrelated inventory|Other account|Unrelated public record|Private stock note/);
 assert.deepEqual(fetched.sort(),[pdf,redirect,miss].sort());
 const saved = (await backupAllProjects(env)).find(result=>result.project===id);
 assert.equal(saved.status,"saved");
 const scheduled = await globalThis.BSLocalProject.open(JSON.parse(await (await env.PHOTOS.get(saved.key)).text()));
 assert.deepEqual(scheduled.getJson(index),manifest);
 assert.deepEqual(scheduled.get(datasheet.offlineFile),offline.get(datasheet.offlineFile));
});

test("part and assembly revisions survive 56 edits, approval, stale retries, offline export, and restore",async()=>{
 const {env,request,create} = await projectFixture();
 const project = await create("History");
 const part = crypto.randomUUID();
 await env.PHOTOS.put("components/"+project+".json",JSON.stringify([{id:part,name:"Fixture"}]));
 const get = async path => {
  const response = await handleWorkspace(request(path),env);
  assert.equal(response.status,200);
  return response.json();
 };
 for(const [scope,target] of [["assembly","__root__"],["part",part]]){
  const path = "/api/workspace?project="+project+"&"+scope+"="+target;
  const write = (title,revision) => handleWorkspace(request(path,"PUT",{expectedRevision:revision,recipe:[{id:"s",title,standard:"Original"}]}),env);
  let revision=null;
  for(let i=0;i<56;i++){
   const saved=await write("Edit "+i,revision);
   assert.equal(saved.status,200);
   revision=(await saved.json()).revision;
  }
  // Saving unchanged content must not drop a revision or generate another one.
  assert.equal((await (await write("Edit 55",revision)).json()).revision,revision);
  assert.equal((await write("Stale edit",null)).status,409);
  const proposalPath="/api/proposals?project="+project;
  const proposed=await handleProposals(request(proposalPath,"POST",{
   scope,targetId:target,stepId:"s",field:"standard",suggestedText:"Approved"
  }),env);
  assert.equal(proposed.status,201);
  const {proposal}=await proposed.json();
  assert.equal((await handleProposals(request(proposalPath,"PATCH",{id:proposal.id,action:"approve"}),env)).status,200);
  const {workspace}=await get(path);
  assert.equal(workspace.recipe[0].standard,"Approved");
  assert.ok(workspace.history.length<=20);
  let cursor=workspace.olderHistory;
  const newestFirst=workspace.history.toReversed(),pages=[];
  while(cursor){
   assert.ok(!pages.includes(cursor));
   pages.push(cursor);
   const page=await get(path+"&historyPage="+cursor);
   newestFirst.push(...page.history.toReversed());
   cursor=page.olderHistory;
  }
  assert.ok(pages.length>=4);
  assert.deepEqual(newestFirst.map(s=>s.recipe[0].title),Array.from({length:56},(_,i)=>"Edit "+(55-i)));
  const archive=await (await handleProjectArchive(request("/api/project/archive?project="+project),env)).json();
  const offline=await globalThis.BSLocalProject.open(archive);
  const key=(scope==="part"?"part-workspaces":"workspaces")+"/"+project+"/"+target+".json";
  let record=offline.getJson(key);
  const titles=[];
  while(record){
   titles.push(...record.history.toReversed().map(entry=>entry.recipe[0].title));
   record=record.olderHistory?offline.getJson("workspace-history/"+project+"/"+key.split("/")[0]+"/"+target+".json/"+record.olderHistory+".json"):null;
  }
  assert.deepEqual(titles,newestFirst.map(s=>s.recipe[0].title));
  const restored=await handleWorkspace(request(path,"PUT",{expectedRevision:workspace.revision,...newestFirst.at(-1)}),env);
  assert.equal(restored.status,200);
  const after=(await get(path)).workspace;
  assert.equal(after.recipe[0].title,"Edit 0");
  assert.equal(after.history.at(-1).recipe[0].standard,"Approved");
  assert.equal((await handleWorkspace(request(path+"&historyPage=invalid"),env)).status,400);
 }
});
