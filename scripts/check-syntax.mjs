import {readdirSync} from "node:fs";
import {spawnSync} from "node:child_process";

// Check every application and test source; a new module needs no script edit.
const files = ["worker.js", "playwright.config.mjs"];
for (const directory of ["assets", "functions", "scripts", "tests"]) {
  for (const path of readdirSync(directory, {recursive: true})) {
    if (/\.(?:js|mjs)$/.test(path)) files.push(directory + "/" + path);
  }
}
for (const file of files.sort()) {
  const result = spawnSync(process.execPath, ["--check", file], {stdio: "inherit"});
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log("Syntax checked " + files.length + " JavaScript files.");
