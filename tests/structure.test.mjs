// Structural smoke tests. Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync('index.html','utf8');
const css=readFileSync('assets/site.css','utf8');
const js=readFileSync('assets/site.js','utf8');
const assemblies=readFileSync('assets/site-assembly.js','utf8');
const worker=readFileSync('worker.js','utf8');
test('single external stylesheet and application entrypoint',()=>{
  assert.match(html,/<link rel="stylesheet" href="\/assets\/site\.css(?:\?[^"]+)?">/);
  assert.match(html,/<script src="\/assets\/site\.js(?:\?[^"]+)?"><\/script>/);
  assert.doesNotMatch(html,/<style>|<script>(?!<\/script>)/);
  assert.ok(css.length>10000);
  assert.ok(js.length>30000);
  assert.ok(assemblies.length>80000);
});
test('assembly tree, workspace, BOM and photo features have one controller',()=>{
  const assemblyScripts=[...html.matchAll(/<script[^>]*src="([^"]*site-assembly\.js[^"]*)"/g)];
  assert.equal(assemblyScripts.length,1,'load exactly one assembly controller');
  assert.ok(html.indexOf('/assets/site-assembly.js')<html.indexOf('/assets/site.js'),'assembly controller must load before app initialization');
  for(const name of ['createUnifiedTile','createPhotoController','setupAssemblyTrees','showAssemblyPage','renderWorkspaceParts']){
    assert.match(assemblies,new RegExp('function\\s+'+name+'\\s*\\('),name+' must belong to assembly controller');
    assert.doesNotMatch(js,new RegExp('function\\s+'+name+'\\s*\\('),name+' cannot be duplicated in site.js');
  }
  assert.match(js,/setupAssemblyTrees\(\);/,'app calls the canonical assembly initializer');
});
test('photo persistence and tree APIs are routed',()=>{
  for(const route of ['/api/tree','/api/photos','/api/photo','/api/components','/api/auth','/api/investigations'])
    assert.ok(worker.includes(route),route);
  assert.match(assemblies,/\/api\/photos/);
  assert.match(assemblies,/\/api\/tree/);
});
test('photo management and descriptions are preserved',()=>{
  assert.match(js,/photoToken/);
  assert.match(assemblies,/bindDescriptionSave/);
  assert.match(js,/upload/);
  assert.match(js,/delete/i);
});

test('failure investigations load at every level and preserve their API route',()=>{
  const investigations=readFileSync('assets/investigations.js','utf8');
  const recipe=readFileSync('assets/recipe-editor.js','utf8');
  const api=readFileSync('functions/api/investigations.js','utf8');
  assert.match(html,/\/assets\/investigations\.js/);
  assert.match(assemblies,/investigations\?\.showAssembly/);
  assert.match(assemblies,/investigations\?\.showPart/);
  assert.match(recipe,/renderInvestigations/);
  assert.match(investigations,/Related failures in child parts/);
  assert.match(api,/etagMatches/);
});
