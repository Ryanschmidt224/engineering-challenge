import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

test('CSS retirement CLI checks without writing, preserves mixed active selectors and rejects reintroduced classes', () => {
 const dir=mkdtempSync(join(tmpdir(),'bs-css-retirement-'));
 const script=resolve('scripts/prune-retired-css.mjs');
 try {
  mkdirSync(join(dir,'assets')); mkdirSync(join(dir,'scripts'));
  for(const f of ['index.html','workshop.html','knowledge.html'])writeFileSync(join(dir,f),f==='index.html'?'<script src="/assets/fixture.js"></script>':'');
  writeFileSync(join(dir,'scripts/css-retired.json'),JSON.stringify({classes:['retired-fixture']}));
  const css=join(dir,'assets/fixture.css'),source=join(dir,'assets/fixture.js');
  const original='.retired-fixture, .active-fixture { color: red; }\n.active-fixture:not(.retired-fixture) { padding: 1px; }\n.active-fixture:has(.retired-fixture, .kept) { margin: 0; }\n.active-fixture:not(:not(.retired-fixture)) { display: none; }\n.active-fixture > :not(.retired-fixture) { color: blue; }\n:is(.retired-fixture, .active-fixture):hover::before { color: green; }\ndialog:is(.retired-fixture, .active-fixture):modal { display: block; }\n';
  writeFileSync(css,original+'\n.active-fixture\n:is(\n.retired-fixture,\ninput[type="text" i]\n) > .child { opacity: 0.5; }\n');writeFileSync(source,'');
  const run=(flag)=>spawnSync(process.execPath,[script,flag],{cwd:dir,encoding:'utf8'});
  const before=readFileSync(css,'utf8');const check=run('--check');assert.notEqual(check.status,0);assert.match(check.stderr,/retired selectors remain/);assert.equal(readFileSync(css,'utf8'),before);
  assert.equal(run('--write').status,0);assert.match(readFileSync(css,'utf8'),/\.active-fixture/);assert.doesNotMatch(readFileSync(css,'utf8'),/\.retired-fixture/);
  assert.match(readFileSync(css,'utf8'),/\.active-fixture:has\(\.kept\)/);assert.match(readFileSync(css,'utf8'),/\.active-fixture > \*/);assert.doesNotMatch(readFileSync(css,'utf8'),/display: none/);assert.match(readFileSync(css,'utf8'),/:is\(input\[type="text" i\]\) > \.child/);
  assert.doesNotMatch(readFileSync(css,'utf8'),/:(?:hover|modal|:before)\(\)/);assert.match(readFileSync(css,'utf8'),/:hover::before/);assert.match(readFileSync(css,'utf8'),/:modal/);
  assert.equal(run('--check').status,0);
  writeFileSync(source,'const name = "retired-fixture";');
  const active=run('--check');assert.notEqual(active.status,0);assert.match(active.stderr,/is referenced/);
 } finally {rmSync(dir,{recursive:true,force:true});}
});
