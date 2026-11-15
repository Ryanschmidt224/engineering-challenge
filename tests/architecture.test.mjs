import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const source=path=>readFileSync(resolve(root,path),"utf8");

test("every local script and stylesheet loaded by the website exists",()=>{
 const html=source("index.html");
 const paths=[...html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+\.(?:js|css)(?:\?[^"']*)?)["']/g)]
  .map(match=>match[1].split("?")[0].slice(1));
 assert.ok(paths.length>=10,"Expected site entrypoint assets");
 for(const path of paths)assert.equal(existsSync(resolve(root,path)),true,"Missing site asset: "+path);
});

test("Worker imports resolve to real files and have no duplicate API dispatch paths",()=>{
 const worker=source("worker.js");
 for(const match of worker.matchAll(/from\s+["'](\.\/[^"']+)["']/g)){
  assert.ok(existsSync(resolve(root,match[1])),"Missing Worker import: "+match[1]);
 }
 const paths=[...worker.matchAll(/if\(path===["'](\/api\/[^"']+)["']\)/g)].map(match=>match[1]);
 assert.equal(new Set(paths).size,paths.length,"Duplicate API route dispatch");
});

test("Workshop and Knowledge Base data live outside the main page controllers",()=>{
 const workshop=source("assets/personal-workshop.js");
 const site=source("assets/site.js");
 const html=source("index.html");
 assert.equal(workshop.includes('const styles=\x60'),false,"Workshop styles should not be injected by JavaScript");
 assert.ok(html.includes("/assets/workshop.css"),"Load dedicated Workshop stylesheet");
 assert.ok(html.indexOf("/assets/knowledge-seed.js")<html.indexOf("/assets/site.js"),"Knowledge seed must load before controller");
 assert.ok(site.includes("window.BSKnowledgeSeed"),"Site should consume Knowledge data module");
 assert.ok(existsSync(resolve(root,"functions/api/project-seed.js")),"Project defaults must be a separate module");
});
