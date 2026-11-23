import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {CORE_PROJECTS,VALID_PROJECT_ID,projectGroup} from "../functions/api/projects.js";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("A single Projects page and common workspace controller are used for every project",()=>{
 const manager=read("assets/project-manager.js");
 const bootstrap=read("assets/site.js");
 const html=read("index.html");
 assert.doesNotMatch(bootstrap,/BSProjectTemplate/);
 assert.ok(manager.includes('document.getElementById("project-workspace-template")?.content.firstElementChild'));
 assert.equal((html.match(/id="project-workspace-template"/g)||[]).length,1);
 assert.doesNotMatch(html,/<section id="(?:launcher|linear|robot)"/);
 assert.match(manager,/const ensureProjectPage=project=>/);
 assert.match(manager,/ensureProjectPage\(project\)/);
 assert.match(manager,/setupAssemblyTrees\(\);setupComponents\(\);setupPhotos\(\)/);
 assert.match(html,/<section id="home" class="view active">/);
 assert.doesNotMatch(html,/data-nav="appetizer"|<section id="appetizer"|<section id="(?:buck|motorlab|coiltest)" class="view">/);
 assert.doesNotMatch(manager,/miniGrid|newMiniButton|groupGrid/);
});

test("One visible New project action with tag filters and sorting",()=>{
 const manager=read("assets/project-manager.js");
 assert.match(manager,/const newButton=element\("button","ui-button ui-button--primary project-directory-new","\+ New project"\)/);
 assert.match(manager,/newButton\.hidden=false/);
 assert.match(manager,/newButton\.onclick=openCreate/);
 assert.match(manager,/if\(!user\)\{showAccount\(\)/);
 assert.match(manager,/bs-project-tag-filter/);
 assert.doesNotMatch(manager,/categoryNavigation/);
 assert.match(manager,/const sortSelect=element\("select","ui-control project-sort-filter"\)/);
 for(const value of ["name_asc","name_desc","newest","oldest"])
  assert.ok(manager.includes('"'+value+'"'),"Missing sort "+value);
 assert.match(manager,/tags:createTagPicker\.getTags\(\)/);
 assert.match(manager,/tags:settingsTags\.getTags\(\)/);
});

test("Old mini examples are retired; new category metadata is independent of project type",()=>{
 assert.deepEqual(CORE_PROJECTS.map(p=>p.id),["launcher","linear","robot"]);
 for(const old of ["buck","motorlab","coiltest"])assert.equal(VALID_PROJECT_ID.test(old),false);
 assert.equal(VALID_PROJECT_ID.test("p"+"a".repeat(32)),true);
 assert.equal(projectGroup({group:"Mini Projects"}),"Uncategorized");
 assert.equal(projectGroup({category:"Robotics"}),"Robotics");
});

test("Project discovery supports inclusive multi-select tags without forcing one exclusive category",()=>{
 const manager=read("assets/project-manager.js"),api=read("functions/api/projects.js");
 assert.match(manager,/const activeTags=new Set\(\)/);
 assert.match(read("assets/project-directory.js"),/active\.some\(tag=>/);
 assert.match(manager,/chip\.setAttribute\("aria-pressed"/);
 assert.match(manager,/makeTagPicker\(projectTags\(project\)\)/);
 assert.match(manager,/tags:createTagPicker\.getTags\(\)/);
 assert.match(manager,/tags:settingsTags\.getTags\(\)/);
 assert.match(api,/const normalizeTags=value=>/);
 assert.match(api,/tags:tags\|\|\[\]/);
});

test("Projects use a compact toolbar and optional descriptor filters",()=>{
 const manager=read("assets/project-manager.js");
 const css=read("assets/project-directory.css");
 const directory=read("assets/project-directory.js");
 assert.match(manager,/filters\.append\(newButton,searchLabel,filterMenu,sortLabel/);
 assert.match(manager,/project-selected-descriptors/);
 assert.match(manager,/bs-project-descriptor-search/);
 assert.match(manager,/tagSearch\.oninput=renderTagFilters/);
 assert.match(manager,/activeTags=new Set\(\)/);
 assert.match(manager,/chip\.setAttribute\("aria-pressed"/);
 assert.match(directory,/query\.some\(term=>/);
 assert.match(manager,/projectTags\(project\)/);
 assert.match(css,/\.ui-project-list\s*\{[^}]*display:\s*grid;\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
 assert.doesNotMatch(manager,/categoryNavigation/);
});
