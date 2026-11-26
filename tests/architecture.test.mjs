import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const source=path=>readFileSync(resolve(root,path),"utf8");

test("current entry pages reference existing local scripts and stylesheets",()=>{
 for(const page of ["project.html","project-signin.html","website-settings.html","workshop.html","knowledge.html","calculators.html"]){
  const html=source(page),paths=[...html.matchAll(/(?:src|href)=["']((?:\/)?assets\/[^"']+\.(?:js|css)(?:\?[^"']*)?)["']/g)].map(m=>m[1].split("?")[0].replace(/^\//,""));
  assert.ok(paths.length>3);for(const path of paths)assert.ok(existsSync(resolve(root,path)),page+": "+path);
 }
});

test("Worker imports resolve to real files and have no duplicate API dispatch paths",()=>{
 const worker=source("worker.js");
 for(const match of worker.matchAll(/from\s+["'](\.\/[^"']+)["']/g)){
  assert.ok(existsSync(resolve(root,match[1])),"Missing Worker import: "+match[1]);
 }
 const dispatch=worker.slice(0,worker.indexOf("}catch(error){"));
 const paths=[...dispatch.matchAll(/if\(path===["'](\/api\/[^"']+)["']\)/g)].map(match=>match[1]);
 assert.equal(new Set(paths).size,paths.length,"Duplicate API route dispatch");
});

test("retired browser application is absent from the deployed source",()=>{
 for(const path of ["assets/site.js","assets/site-assembly.js","assets/resources.js","assets/site-polish.css","functions/api/projects.js"])assert.equal(existsSync(resolve(root,path)),false,path);
 assert.doesNotMatch(source("index.html"),/<script/);assert.match(source("index.html"),/project.html/);
});

test('every shipped JavaScript module belongs to a current browser entry or the Worker',async()=>{
 const {build}=await import('esbuild'),{readdirSync}=await import('node:fs'),entries=['worker.js'];
 for(const page of ['project.html','project-signin.html','website-settings.html','workshop.html','knowledge.html','calculators.html','project-engine-proof.html']){
  const html=source(page);
  for(const match of html.matchAll(/<script[^>]*src="([^"]+)"/g))entries.push(match[1].replace(/^\//,'').split('?')[0]);
  for(const match of html.matchAll(/(?:from\s*|import\s*)["'](\.?\/?assets\/[^"']+)["']/g))entries.push(match[1].replace(/^\.\//,'').replace(/^\//,'').split('?')[0]);
 }
 const result=await build({entryPoints:[...new Set(entries)],bundle:true,write:false,outdir:'unused-build-output',metafile:true,format:'esm',platform:'browser',logLevel:'silent'}),used=new Set(Object.keys(result.metafile.inputs));
 const files=['assets','functions/api'].flatMap(dir=>readdirSync(resolve(root,dir)).filter(name=>name.endsWith('.js')).map(name=>dir+'/'+name));
 assert.deepEqual(files.filter(file=>!used.has(file)),[],'Unreferenced application module: wire it to its owner or remove it.');
});
