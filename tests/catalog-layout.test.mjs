import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("Projects use the shared catalog; Workshop and Knowledge own their separate pages",()=>{
 const html=read("index.html");
 const catalog=html.indexOf("/assets/catalog-ui.js"),manager=html.indexOf("/assets/project-manager.js");
 const site=html.indexOf("/assets/site.js");
 assert.ok(catalog>0&&catalog<manager&&catalog<site);
 const module=read("assets/catalog-ui.js");
 assert.match(module,/window\.BSCatalogUI=Object\.freeze\(\{build,categories\}\)/);
 assert.match(module,/aria-pressed/);
 assert.match(module,/categories\(mount,options/);
});

test("Projects use tag discovery while Workshop and Parts Management retain catalog sidebars",()=>{
 const projects=read("assets/project-manager.js");
 const workshop=read("workshop.html");
 const parts=read("assets/parts-management.js");
 assert.doesNotMatch(projects,/BSCatalogUI\?\.build\(root,catalogSidebar/);
 assert.match(projects,/bs-project-tag-filter/);
 assert.match(projects,/activeTags/);
 assert.match(workshop,/aria-label="Workshop categories"/);
 assert.match(workshop,/aria-label="Families"/);
 assert.match(parts,/BSCatalogUI\?\.build\(target,sidebar/);
 assert.match(parts,/BSCatalogUI\?\.categories\(sidebar/);
 assert.match(parts,/value:"document",label:"Documents"/);
});

test("catalog layout remains CSS responsive and doesn't change storage schemas",()=>{
 const css=read("assets/site-controls.css");
 const html=read("index.html");
 assert.match(css,/\.bs-catalog-layout\s*\{/);
 assert.match(css,/\.bs-catalog-category\.is-active/);
 assert.match(css,/@media\s*\(max-width:\s*800px\)/);
 assert.match(html,/data-site-header="projects"/);
 const header=read("assets/site-header.js");
 for(const name of ["Projects","Knowledge","The Workshop"])assert.ok(header.includes(name));
});
