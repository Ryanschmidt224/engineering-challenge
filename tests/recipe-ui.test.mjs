import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("work instructions expose one Add step action rather than separate preview and editor",()=>{
 const recipe=readFileSync("assets/recipe-editor.js","utf8");
 const site=readFileSync("assets/site.js","utf8");
 assert.equal((recipe.match(/\+ Add step/g)||[]).length,1);
 assert.doesNotMatch(recipe,/Edit recipe|View recipe|No recipe steps yet/);
 assert.doesNotMatch(site,/Preview steps|Hide preview/);
 assert.match(recipe,/el\("details","recipe-one-step"\)/);
});
test("optional step fields appear only when populated or explicitly added",()=>{
 const recipe=readFileSync("assets/recipe-editor.js","utf8");
 assert.match(recipe,/if\(present\)/);
 assert.match(recipe,/\+ Add /);
 assert.match(recipe,/step\[property\]/);
 assert.match(recipe,/getData:\(\)=>steps\.map\(normalize\)/);
 assert.doesNotMatch(recipe,/Previous written instructions|Original written instructions/);
});
test("legacy freeform instruction panels are removed, not merely hidden",()=>{
 const site=readFileSync("assets/site.js","utf8");
 const recipe=readFileSync("assets/recipe-editor.js","utf8");
 assert.doesNotMatch(site,/workspace-instructions|part-instructions|workspace-procedures|part-procedures|workspace-notes|part-notes/);
 assert.doesNotMatch(site,/syncLegacyInstructionSections/);
 assert.doesNotMatch(recipe,/recipe-legacy|Previous written instructions/);
 const api=readFileSync("functions/api/workspace.js","utf8");
 assert.doesNotMatch(api,/instructions:data\.instructions|procedures:data\.procedures|notes:data\.notes/);
});

test("step editor has two Save controls, no Duplicate, and note-specific photo placement",()=>{
 const recipe=readFileSync("assets/recipe-editor.js","utf8");
 const api=readFileSync("functions/api/workspace.js","utf8");
 assert.match(recipe,/editing\.has\(step\.id\)\?"Save":"Edit"/);
 assert.match(recipe,/recipe-save-step-bottom/);
 assert.doesNotMatch(recipe,/button\("Duplicate"/);
 assert.match(recipe,/photoAfterNote/);
 assert.match(recipe,/recipe-add-note-photo/);
 assert.match(recipe,/if\(step\.photoAfterNote\[photo\]===noteIndex\)/);
 assert.match(api,/const placements=step\.photoAfterNote\?\?\{\}/);
 assert.match(api,/photoAfterNote\}/);
});
