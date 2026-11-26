import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
test("current pages share one owner account and calculators remain independent",()=>{
 const header=readFileSync("assets/site-header.js","utf8"),auth=readFileSync("functions/api/auth.js","utf8"),accounts=readFileSync("functions/api/accounts.js","utf8");
 assert.match(header,/initProjectSignin/);assert.doesNotMatch(header,/index.html|api\/projects|application-mode/);
 assert.match(auth,/user\?\.role==="admin"/);assert.match(accounts,/REGISTRATION_CLOSED/);
 assert.match(readFileSync("knowledge.html","utf8"),/initInformationCalculators/);
 assert.doesNotMatch(readFileSync("assets/calculators.js","utf8"),/site-assembly|resources.js/);
});
