import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const recipe=readFileSync("assets/recipe-editor.js","utf8");
const investigations=readFileSync("assets/investigations.js","utf8");
const site=readFileSync("assets/site.js","utf8");
const workspace=readFileSync("functions/api/workspace.js","utf8");

test("Work Instructions create named containers, not duplicate entry editors",()=>{
 assert.equal((recipe.match(/"btn recipe-add-step bs-section-add-entry"/g)||[]).length,1);
 assert.match(recipe,/button\("\+ Add entry"/);
 assert.match(recipe,/addActions\.append\(add\)/);
 assert.match(recipe,/panel\.prepend\(addActions\)/);
 assert.match(recipe,/const disclosure=button/);
 assert.match(recipe,/panel\.hidden=!instructionsOpen/);
 assert.match(recipe,/disclosure\.append\(heading,count\)/);
 assert.match(recipe,/options\.renderInvestigations\(step,area/);
 assert.match(recipe,/recipe-step-browser/);
 assert.match(recipe,/recipe-step-nav-row/);
 assert.doesNotMatch(recipe,/button\("\+ Add Work Instruction"/);
 assert.doesNotMatch(site,/Preview steps|Hide preview/);
});

test("a Work Instruction stores only stable title, archive and entry ordering metadata",()=>{
 assert.match(recipe,/const normalize=x=>\(\{/);
 assert.match(recipe,/tileOrder:Array\.isArray\(x\.tileOrder\)/);
 assert.match(recipe,/getData:\(\)=>savedSteps\(\)\.map\(normalize\)/);
 assert.match(workspace,/Work Instructions store only an ordered list of named containers/);
 assert.match(workspace,/new Set\(tileOrder\)\.size!==tileOrder\.length/);
 assert.doesNotMatch(recipe,/photoAfterNote|photoNoteIds|step\.standard|step\.detail/);
});

test("normal view shows Edit; Save, Cancel, Archive and Delete require edit mode",()=>{
 assert.match(recipe,/const inEdit=isDraft\|\|editing\.has\(step\.id\)/);
 assert.match(recipe,/if\(inEdit\)\{/);
 assert.match(recipe,/button\("Save",async/);
 assert.match(recipe,/button\("Cancel"/);
 assert.match(recipe,/button\("Archive",\(\)=>archiveContainer\(step\)/);
 assert.match(recipe,/button\("Delete",\(\)=>deleteContainer\(step\)/);
 assert.match(recipe,/button\("Edit"/);
 assert.match(recipe,/window\.BSDialogs\.danger/);
 assert.doesNotMatch(recipe,/button\("Duplicate"/);
});

test("top heading double chevron expands or collapses all typed entries",()=>{
 assert.match(recipe,/recipe-expand-all/);
 assert.match(recipe,/querySelectorAll\("\.investigation-active-content \.investigation-card"\)/);
 assert.match(recipe,/const expand=!entryCards\.every\(card=>card\.open\)/);
 assert.match(recipe,/for\(const card of entryCards\)card\.open=expand/);
 assert.match(recipe,/header\.prepend\(expandAll\)/);
});

test("unsaved work and uploads guard navigation and are never silently discarded",()=>{
 assert.match(recipe,/window\.addEventListener\("beforeunload"/);
 assert.match(recipe,/if\(pendingUploads\)throw Error/);
 assert.match(recipe,/async function savePending\(\)/);
 assert.match(recipe,/if\(!editing\.has\(expanded\)\)scheduleSave\(\)/);
 assert.match(recipe,/hasPendingUploads:\(\)=>pendingUploads>0/);
 assert.match(recipe,/window\.addEventListener|document\.addEventListener\("click"/);
});

test("legacy freeform instruction panels are removed rather than merely hidden",()=>{
 assert.doesNotMatch(site,/workspace-instructions|part-instructions|workspace-procedures|part-procedures|workspace-notes|part-notes/);
 assert.doesNotMatch(site,/syncLegacyInstructionSections/);
 assert.doesNotMatch(recipe,/recipe-legacy|Previous written instructions/);
 assert.doesNotMatch(workspace,/instructions:data\.instructions|procedures:data\.procedures|notes:data\.notes/);
});

test("typed entries are created by the investigations controller",()=>{
 assert.match(investigations,/investigation-active-content/);
 assert.match(investigations,/Tests\/Measurements/);
 assert.match(investigations,/note:\{label:"Notes"/);
 assert.match(investigations,/photos:\{label:"Photos"/);
});
