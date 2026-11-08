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
 assert.match(recipe,/Previous written instructions/);
});
test("saved legacy instructions are retained, empty companion sections are hidden",()=>{
 const site=readFileSync("assets/site.js","utf8");
 assert.match(site,/syncLegacyInstructionSections/);
 assert.match(site,/section\.classList\.toggle\("hide",!input\.value\.trim\(\)\)/);
 const recipe=readFileSync("assets/recipe-editor.js","utf8");
 assert.match(recipe,/legacy\.classList\.toggle\("hide",!hasLegacy\)/);
});
