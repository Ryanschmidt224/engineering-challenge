// Structural smoke tests. Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync('index.html','utf8');
const css=readFileSync('assets/site.css','utf8');
const js=readFileSync('assets/site.js','utf8');
const worker=readFileSync('worker.js','utf8');
test('single external stylesheet and application entrypoint',()=>{
  assert.match(html,/<link rel="stylesheet" href="\/assets\/site\.css">/);
  assert.match(html,/<script src="\/assets\/site\.js"><\/script>/);
  assert.doesNotMatch(html,/<style>|<script>(?!<\/script>)/);
  assert.ok(css.length>10000);
  assert.ok(js.length>30000);
});
test('shared tile and assembly controllers remain available',()=>{
  for(const name of ['createUnifiedTile','createPhotoController','setupAssemblyTrees','showAssemblyPage']){
    assert.match(js,new RegExp('function\\s+'+name+'\\s*\\('));
  }
});
test('photo persistence and tree APIs are routed',()=>{
  for(const route of ['/api/tree','/api/photos','/api/photo','/api/components','/api/auth','/api/investigations'])
    assert.ok(worker.includes(route),route);
  assert.match(js,/\/api\/photos/);
  assert.match(js,/\/api\/tree/);
});
test('photo management and descriptions are preserved',()=>{
  assert.match(js,/photoToken/);
  assert.match(js,/bindDescriptionSave/);
  assert.match(js,/upload/);
  assert.match(js,/delete/i);
});

test('failure investigations load at every level and preserve their API route',()=>{
  const investigations=readFileSync('assets/investigations.js','utf8');
  const recipe=readFileSync('assets/recipe-editor.js','utf8');
  const api=readFileSync('functions/api/investigations.js','utf8');
  assert.match(html,/\/assets\/investigations\.js/);
  assert.match(js,/investigations\?\.showAssembly/);
  assert.match(js,/investigations\?\.showPart/);
  assert.match(recipe,/renderInvestigations/);
  assert.match(investigations,/Related failures in child parts/);
  assert.match(api,/etagMatches/);
});
