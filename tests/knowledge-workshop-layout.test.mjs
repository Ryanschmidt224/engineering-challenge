import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const file=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("Knowledge opens the D1 Knowledge page; Calculators has its own route",()=>{
 const html=file("index.html"),site=file("assets/site.js"),resources=file("assets/resources.js"),knowledge=file("knowledge.html");
 assert.match(file("assets/site-header.js"),/"knowledge", "Info Bits", "knowledge.html"/);
 assert.match(site,/page==="knowledge"\|\|page==="community"\)\{location\.href="knowledge\.html"/);
 assert.doesNotMatch(html,/Knowledge Base|knowledgeTypeFilter|topic-contributions|logForm|proposalForm/);
 assert.equal((html.match(/id="resource-calculators"/g)||[]).length,1);
 assert.doesNotMatch(site,/page==="calculators"\)page="learn"/);
 assert.match(html,/id="calculators" class="view calculators-view"/);
 assert.doesNotMatch(html,/id="learn"/);
 assert.match(resources,/const target=kind==="calculators"\?"calculators":"commonparts"/);
 assert.match(file("assets/calculator-catalog.js"),/id:"wheel-speed"/);
 assert.ok(knowledge.includes("assets/site-header.js"));
 assert.ok(file("knowledge.html").includes("initInformationCalculators"));
});
test("Account sign-in is unified; admin access requires a role",()=>{
 const html=file("index.html"),site=file("assets/site.js"),auth=file("functions/api/auth.js"),accounts=file("functions/api/accounts.js");
 assert.ok(html.includes("assets/site-header.js"));
 assert.match(html,/id="accountMenuButton"/);
 assert.doesNotMatch(html,/id="adminLoginButton"|id="adminDialog"/);
 assert.match(site,/window\.BSProjectManager\?\.openAccount/);
 assert.match(auth,/user\?\.role==="admin"/);
 assert.doesNotMatch(accounts,/action==="claim-admin"/);
 assert.match(accounts,/REGISTRATION_CLOSED/);
});
