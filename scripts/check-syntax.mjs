// Discover JavaScript sources so newly added scripts cannot bypass CI parsing.
import {readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
async function discover(directory){
 const entries=await readdir(join(root,directory),{withFileTypes:true});
 return (await Promise.all(entries.map(entry=>entry.isDirectory()?discover(join(directory,entry.name)):
  /\.(?:js|mjs)$/.test(entry.name)?[join(directory,entry.name)]:[]))).flat();
}
const files=['worker.js',...(await Promise.all(['assets','functions','scripts','tests'].map(discover))).flat()];
for(const file of files){
 const result=spawnSync(process.execPath,['--check',file],{cwd:root,encoding:'utf8'});
 if(result.status!==0){process.stderr.write(result.stderr||String(result.error));process.exit(result.status||1);}
}
console.log(`Syntax checked ${files.length} JavaScript files.`);
