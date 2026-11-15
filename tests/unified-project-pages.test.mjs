import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {CORE_PROJECTS,VALID_PROJECT_ID,projectGroup} from "../functions/api/projects.js";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("A single Projects page and common workspace controller are used for every project",()=>{
 const manager=read("assets/project-manager.js");
 const bootstrap=read("assets/site.js");
 const html=read("index.html");
 assert.match(bootstrap,/window\.BSProjectTemplate=document\.getElementById\("linear"\)\?\.cloneNode\(true\)/);
 assert.match(manager,/const template=window\.BSProjectTemplate/);
 assert.match(manager,/const ensureProjectPage=project=>/);
 assert.match(manager,/ensureProjectPage\(project\)/);
 assert.match(manager,/setupAssemblyTrees\(\);setupComponents\(\);setupPhotos\(\)/);
 assert.match(html,/<section id="home" class="view active">/);
 assert.doesNotMatch(html,/data-nav="appetizer"|<section id="appetizer"|<section id="(?:buck|motorlab|coiltest)" class="view">/);
 assert.doesNotMatch(manager,/miniGrid|newMiniButton|groupGrid/);
});

test("One visible New project action and category/sort controls",()=>{
 const manager=read("assets/project-manager.js");
 assert.match(manager,/const newButton=element\("button","btn primary","\+ New project"\)/);
 assert.match(manager,/newButton\.hidden=false/);
 assert.match(manager,/newButton\.onclick=openCreate/);
 assert.match(manager,/if\(!user\)\{showAccount\(\)/);
 assert.match(manager,/window\.BSCatalogUI\?\.categories\(catalogSidebar/);
 assert.match(manager,/window\.BSCatalogUI\?\.build\(root,catalogSidebar/);
 assert.match(manager,/const sortSelect=element\("select","field project-sort-filter"\)/);
 for(const value of ["name_asc","name_desc","newest","oldest"])
  assert.ok(manager.includes('"'+value+'"'),"Missing sort "+value);
 assert.match(manager,/category:form\.elements\.category\.value\.trim\(\)/);
 assert.match(manager,/category:groupInput\.value\.trim\(\)/);
});

test("Old mini examples are retired; new category metadata is independent of project type",()=>{
 assert.deepEqual(CORE_PROJECTS.map(p=>p.id),["launcher","linear","robot"]);
 for(const old of ["buck","motorlab","coiltest"])assert.equal(VALID_PROJECT_ID.test(old),false);
 assert.equal(VALID_PROJECT_ID.test("p"+"a".repeat(32)),true);
 assert.equal(projectGroup({group:"Mini Projects"}),"Uncategorized");
 assert.equal(projectGroup({category:"Robotics"}),"Robotics");
});
