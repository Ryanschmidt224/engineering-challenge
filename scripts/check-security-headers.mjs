import { readFile, writeFile } from "node:fs/promises";
import { staticHeaderRules } from "../functions/security-headers.js";

const path = new URL("../_headers", import.meta.url);
const expected = staticHeaderRules();
if (process.argv.includes("--write")) await writeFile(path, expected);
else if ((await readFile(path, "utf8")) !== expected)
  throw Error(
    "Static security headers differ from the Worker policy. Run node scripts/check-security-headers.mjs --write.",
  );
console.log("Static and Worker security header policies match.");
