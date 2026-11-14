import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {CORE_PROJECTS,VALID_PROJECT_ID} from "../functions/api/projects.js";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("Projects and Mini Projects use one workspace template and controller",()=>{
 const manager=read("assets/project-manager.js");
 const bootstrap=read("assets/site.js");
 const html=read("index.html");
 assert.match(bootstrap,/window\.BSProjectTemplate=document\.getElementById\("linear"\)\?\.cloneNode\(true\)/);
 assert.match(manager,/const template=window\.BSProjectTemplate/);
 assert.match(manager,/const ensureProjectPage=project=>/);
 assert.match(manager,/ensureProjectPage\(project\)/);
 assert.match(manager,/group==="Mini Projects"/);
 assert.match(manager,/setupAssemblyTrees\(\);setupComponents\(\);setupPhotos\(\)/);
 assert.match(html,/<section id="appetizer" class="view">/);
 assert.doesNotMatch(html,/<section id="(?:buck|motorlab|coiltest)" class="view">/);
});

test("Creation controls are always visible, with one common create workflow",()=>{
 const manager=read("assets/project-manager.js");
 assert.match(manager,/const makeCreateButton=\(kind\)=>/);
 assert.match(manager,/newButton\.hidden=false;newMiniButton\.hidden=false/);
 assert.match(manager,/newButton\.onclick=\(\)=>openCreate\("project"\)/);
 assert.match(manager,/newMiniButton\.onclick=\(\)=>openCreate\("mini"\)/);
 assert.match(manager,/if\(!user\)\{showAccount\(\)/);
});

test("Disposable legacy mini projects are not migrated into the shared catalog",()=>{
 const ids=CORE_PROJECTS.map(p=>p.id);
 assert.deepEqual(ids,["launcher","linear","robot"]);
 for(const old of ["buck","motorlab","coiltest"])
  assert.equal(VALID_PROJECT_ID.test(old),false);
 assert.equal(VALID_PROJECT_ID.test("p"+"a".repeat(32)),true);
});
