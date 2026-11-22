import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {CORE_PROJECTS} from "../functions/api/project-seed.js";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");

test("Project seeds retain stable unique IDs",()=>{
 assert.ok(CORE_PROJECTS.length>0);
 assert.equal(new Set(CORE_PROJECTS.map(p=>p.id)).size,CORE_PROJECTS.length);
 for(const p of CORE_PROJECTS){
  assert.match(p.id,/^[a-z][a-z0-9-]*$/);
  assert.ok(p.name);
  assert.equal(p.builtIn,true);
 }
});
