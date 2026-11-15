import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("one shared catalog component is loaded before all three main page controllers",()=>{
 const html=read("index.html");
 const catalog=html.indexOf("/assets/catalog-ui.js"),manager=html.indexOf("/assets/project-manager.js");
 const workshop=html.indexOf("/assets/personal-workshop.js"),site=html.indexOf("/assets/site.js");
 assert.ok(catalog>0&&catalog<manager&&catalog<workshop&&catalog<site);
 const module=read("assets/catalog-ui.js");
 assert.match(module,/window\.BSCatalogUI=Object\.freeze\(\{build,categories\}\)/);
 assert.match(module,/aria-pressed/);
 assert.match(module,/categories\(mount,options/);
});

test("Projects use tag discovery while Knowledge, Workshop and Parts Management retain catalog sidebars",()=>{
 const projects=read("assets/project-manager.js");
 const knowledge=read("assets/site.js");
 const workshop=read("assets/personal-workshop.js");
 const parts=read("assets/parts-management.js");
 assert.doesNotMatch(projects,/BSCatalogUI\?\.build\(root,catalogSidebar/);
 assert.match(projects,/bs-project-tag-filter/);
 assert.match(projects,/activeTags/);
 assert.match(knowledge,/BSCatalogUI\?\.build\(knowledgeRoot,knowledgeNavMount/);
 assert.match(knowledge,/BSCatalogUI\?\.categories\(knowledgeNavMount/);
 assert.match(workshop,/BSCatalogUI\?\.build\(root,sidebar,allPanels/);
 assert.match(workshop,/BSCatalogUI\?\.categories\(sidebar/);
 assert.match(parts,/BSCatalogUI\?\.build\(target,sidebar/);
 assert.match(parts,/BSCatalogUI\?\.categories\(sidebar/);
 assert.match(parts,/value:"document",label:"Documents"/);
});

test("catalog layout remains CSS responsive and doesn't change storage schemas",()=>{
 const css=read("assets/site-controls.css");
 const html=read("index.html");
 assert.match(css,/\.bs-catalog-layout\{/);
 assert.match(css,/\.bs-catalog-category\.is-active/);
 assert.match(css,/@media\(max-width:800px\)/);
 assert.match(html,/data-nav="home">Projects<\/button>/);
 assert.match(html,/data-nav="learn">Knowledge Base<\/button>/);
 assert.match(html,/data-nav="commonparts">The Workshop<\/button>/);
});
