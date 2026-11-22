import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const file=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("Knowledge Base combines searchable explanations and interactive calculators in one tab",()=>{
 const html=file("index.html"),site=file("assets/site.js"),resources=file("assets/resources.js");
 assert.match(html,/data-nav="learn">Knowledge Base<\/button>/);
 assert.doesNotMatch(html,/data-nav="calculators"/);
 assert.match(html,/id="knowledgeTypeFilter"/);
 assert.match(html,/id="topicFilters"/);
 assert.match(html,/id="knowledgeExplanations"/);
 assert.match(html,/id="knowledgeCalculators"/);
 assert.equal((html.match(/id="resource-calculators"/g)||[]).length,1);
 assert.doesNotMatch(html,/<section id="calculators" class="view">/);
 assert.match(site,/page==="calculators"/);
 assert.match(site,/knowledgeTypeFilter/);
 assert.match(resources,/const target=kind==="calculators"\?"learn":"commonparts"/);
});
test("Account sign-in is unified; admin access requires a role",()=>{
 const html=file("index.html"),site=file("assets/site.js"),auth=file("functions/api/auth.js"),accounts=file("functions/api/accounts.js");
 assert.match(html,/id="accountMenuButton"/);
 assert.doesNotMatch(html,/id="adminLoginButton"|id="adminDialog"/);
 assert.match(site,/window\.BSProjectManager\?\.openAccount/);
 assert.match(auth,/user\?\.role==="admin"/);
 assert.match(accounts,/action==="claim-admin"/);
 assert.match(accounts,/REGISTRATION_CLOSED/);
});
