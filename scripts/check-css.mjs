import {readFileSync,readdirSync} from "node:fs";
import {createHash} from "node:crypto";

const baseline=JSON.parse(readFileSync("scripts/css-baseline.json","utf8"));
for(const [path,expected] of Object.entries(baseline.frozen)){
 const hash=createHash("sha256").update(readFileSync(path)).digest("hex");
 if(hash!==expected)throw Error(path+" is frozen. Migrate a component in a reviewed CSS batch before updating this baseline.");
}
for(const file of readdirSync("assets").filter(file=>file.endsWith(".css"))){
 const path="assets/"+file,css=readFileSync(path,"utf8").replace(/\/\*[\s\S]*?\*\//g,"");
 const counts={important:(css.match(/!important\b/gi)||[]).length,projectIds:(css.match(/#(?:launcher|linear|robot)\b/g)||[]).length};
 const limit=baseline.limits[path]||{important:0,projectIds:0};
 for(const key of Object.keys(counts))if(counts[key]>limit[key])throw Error(path+" increases "+key+" beyond the reviewed baseline");
}
console.log("CSS guardrails passed (frozen overrides, no specificity escalation).");
