import {readFileSync,readdirSync,statSync} from "node:fs";
const root=process.argv[2]||".",baseline=JSON.parse(readFileSync(root+"/scripts/js-baseline.json","utf8"));
const failures=[];
for(const directory of ["assets","functions"])for(const entry of readdirSync(root+"/"+directory,{recursive:true})){
 const path=directory+"/"+entry;if(!/\.js$/.test(path))continue;
 const bytes=statSync(root+"/"+path).size,limit=baseline.legacy[path]??baseline.maximumModuleBytes;
 if(baseline.dataModules[path])continue;
 if(bytes>limit)failures.push(path+": "+bytes+" bytes exceeds "+limit+(path in baseline.legacy?" (legacy file may only shrink)":" (split the module by responsibility)"));
}
if(failures.length)throw Error(failures.join("\n"));
console.log("JavaScript budgets passed: legacy files cannot grow; application modules <=40,000 bytes.");
