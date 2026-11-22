import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

test('strict CSS check rejects unknown classes, comments, selector-only references and unloaded scripts; follows imports and explicit dynamic patterns',()=>{
 const root=mkdtempSync(join(tmpdir(),'bs-css-producers-')),script=resolve('scripts/check-css-producers.mjs');
 try{
  mkdirSync(join(root,'assets'));mkdirSync(join(root,'scripts'));
  writeFileSync(join(root,'index.html'),'<div class="html-live"></div><script src="/assets/fixture.js"></script><!-- <div class="comment-only"></div> -->');
  const js=join(root,'assets/fixture.js'),css=join(root,'assets/fixture.css'),allow=join(root,'scripts/css-dynamic-classes.json');
  writeFileSync(js,'const name="live-class"; const state="state-"+"ready";');
  writeFileSync(allow,JSON.stringify([{pattern:'^state-(?:ready|busy)$',producer:'assets/fixture.js',reason:'fixture builds its state prefix'}]));
  writeFileSync(css,'.live-class, .html-live, .state-ready { color: red; }');
  const run=()=>spawnSync(process.execPath,[script],{cwd:root,encoding:'utf8'});
  assert.equal(run().status,0);
  writeFileSync(css,'.unloaded-class { color: red; }');writeFileSync(join(root,'assets/unloaded.js'),'export const name="unloaded-class";');
  assert.notEqual(run().status,0);
  writeFileSync(js,'document.querySelector(".unloaded-class");');assert.notEqual(run().status,0);
  writeFileSync(js,'import "./unloaded.js";');assert.equal(run().status,0);
  writeFileSync(js,'async function start(){const module=await import("./unloaded.js");}');assert.equal(run().status,0);
  writeFileSync(css,'.comment-only { color: red; }');assert.notEqual(run().status,0);
  writeFileSync(allow,JSON.stringify([{pattern:'^.*$',producer:'assets/fixture.js',reason:'blanket escape'}]));assert.match(run().stderr,/Invalid dynamic-class allowance/);
 }finally{rmSync(root,{recursive:true,force:true});}
});
