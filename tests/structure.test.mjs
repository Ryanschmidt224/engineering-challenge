// Structural smoke tests. Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync('index.html','utf8');
const css=readFileSync('assets/site.css','utf8');
const js=readFileSync('assets/site.js','utf8');
const assembly=readFileSync('assets/site-assembly.js','utf8');
const components=readFileSync('assets/site-components.js','utf8');
const worker=readFileSync('worker.js','utf8');
test('single external stylesheet and application entrypoint',()=>{
  assert.match(html,/<link rel="stylesheet" href="\/assets\/site\.css">/);
  assert.match(html,/<script src="\/assets\/site\.js"><\/script>/);
  assert.doesNotMatch(html,/<style>|<script>(?!<\/script>)/);
  assert.ok(css.length>10000);
  assert.ok(js.length>10000);
  assert.match(html,/<script src="\/assets\/site-assembly\.js"><\/script>/);
  assert.match(html,/<script src="\/assets\/site-components\.js"><\/script>/);
  assert.ok(html.indexOf('site-assembly.js')<html.indexOf('site.js'));
  assert.ok(html.indexOf('site-components.js')<html.indexOf('site.js'));
});
test('shared tile and assembly controllers remain available',()=>{
  for(const name of ['createUnifiedTile','createPhotoController','setupAssemblyTrees','showAssemblyPage']){
    assert.match(js+'\n'+assembly+'\n'+components,new RegExp('function\\s+'+name+'\\s*\\('));
  }
});
test('photo persistence and tree APIs are routed',()=>{
  for(const route of ['/api/tree','/api/photos','/api/photo','/api/components','/api/auth'])
    assert.ok(worker.includes(route),route);
  assert.match(js,/\/api\/photos/);
  assert.match(assembly,/\/api\/tree/);
});
test('photo management and descriptions are preserved',()=>{
  assert.match(js,/photoToken/);
  assert.match(assembly,/bindDescriptionSave/);
  assert.match(js,/upload/);
  assert.match(js,/delete/i);
});
