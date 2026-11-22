import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {spawnSync} from "node:child_process";
test("JS budgets reject legacy growth and oversized modules; allow shrink and deletion",()=>{
 const root=mkdtempSync(tmpdir()+"/bs-js-budgets-");
 try{
  for(const folder of ["scripts","assets","functions"])mkdirSync(root+"/"+folder);
  writeFileSync(root+"/scripts/js-baseline.json",JSON.stringify({legacy:{"assets/old.js":10},dataModules:{},maximumModuleBytes:20}));
  const run=()=>spawnSync(process.execPath,["scripts/check-js.mjs",root],{encoding:"utf8"});
  writeFileSync(root+"/assets/old.js","x".repeat(10));assert.equal(run().status,0);
  writeFileSync(root+"/assets/old.js","x".repeat(11));assert.notEqual(run().status,0);
  writeFileSync(root+"/assets/old.js","x");assert.equal(run().status,0);
  rmSync(root+"/assets/old.js");assert.equal(run().status,0);
  writeFileSync(root+"/functions/new.js","x".repeat(21));assert.notEqual(run().status,0);
 }finally{rmSync(root,{recursive:true,force:true});}
});
