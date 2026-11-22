// Strict on unknown CSS classes. Only reviewed code-built patterns are exempt.
import {readFileSync} from "node:fs";
import {classProducers,cssClassUses} from "./css-producers.mjs";
const [{classes,files},uses]=await Promise.all([classProducers(),cssClassUses()]);
const allowed=JSON.parse(readFileSync("scripts/css-dynamic-classes.json","utf8"));
for(const item of allowed)if(!/^\^[a-zA-Z][\w-]*/.test(item.pattern)||/\.\*|\.\+/.test(item.pattern)||!item.pattern.endsWith("$")||!item.reason||!files.includes(item.producer))throw Error("Invalid dynamic-class allowance: "+JSON.stringify(item));
const missing=[...uses].filter(([name])=>!classes.has(name)&&!allowed.some(item=>new RegExp(item.pattern).test(name)));
if(missing.length)throw Error("CSS classes have no literal producer or reviewed dynamic pattern:\n"+missing.map(([name,files])=>name+" ("+[...files].join(", ")+")").join("\n"));
console.log("Strict CSS producer check passed: "+uses.size+" classes across "+files.length+" reachable scripts; "+allowed.length+" documented dynamic patterns.");
