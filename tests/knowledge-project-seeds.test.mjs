import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {CORE_PROJECTS} from "../functions/api/project-seed.js";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const window={};
runInNewContext(readFileSync(resolve(root,"assets/knowledge-seed.js"),"utf8"),{window});

test("Project seeds retain stable unique IDs",()=>{
 assert.ok(CORE_PROJECTS.length>0);
 assert.equal(new Set(CORE_PROJECTS.map(p=>p.id)).size,CORE_PROJECTS.length);
 for(const p of CORE_PROJECTS){
  assert.match(p.id,/^[a-z][a-z0-9-]*$/);
  assert.ok(p.name);
  assert.equal(p.builtIn,true);
 }
});
test("Knowledge Base seed topics have unique IDs and valid related-topic links",()=>{
 const {tiles,topicDisciplines,topicProjects}=window.BSKnowledgeSeed;
 assert.ok(tiles.length>0);
 const ids=new Set(tiles.map(t=>t.id));
 assert.equal(ids.size,tiles.length);
 for(const tile of tiles){
  assert.ok(tile.title&&tile.short&&tile.deep,"Incomplete topic: "+tile.id);
  for(const linked of tile.related||[])assert.ok(ids.has(linked),"Broken related topic: "+linked);
  assert.ok(Array.isArray(topicDisciplines[tile.id]),"No discipline for "+tile.id);
  assert.ok(Array.isArray(topicProjects[tile.id]),"No project index for "+tile.id);
 }
});
