import {test,expect} from "@playwright/test";
const origin="http://127.0.0.1:4173",headers={origin};
test.beforeEach(async({request,context})=>{const {cookie}=await(await request.post("/__test__/reset")).json(),at=cookie.indexOf("=");await context.addCookies([{name:cookie.slice(0,at),value:cookie.slice(at+1),url:origin,httpOnly:true,sameSite:"Strict"}]);});
async function fixture(page){
 const response=await page.request.post("/api/components?project=launcher",{headers,data:{name:"Printed bracket",partType:"custom",description:"Support the motor",specifications:[{name:"Thickness",value:"3 mm",source:"explicit"}]}});expect(response.ok(),await response.text()).toBe(true);const {component}=await response.json();
 const workspace=await page.request.put("/api/workspace?project=launcher&part="+component.id,{headers,data:{recipe:[{id:"load-test",title:"Test the bracket",tileOrder:[]}],expectedRevision:null}});expect(workspace.ok()).toBe(true);
 const record=await page.request.post("/api/investigations?project=launcher",{headers,data:{action:"create",scope:"step",ownerType:"part",ownerId:component.id,stepId:"load-test",category:"test",title:"Original load test",entries:[{type:"result",text:"Held 2 kg",date:"2026-11-23",files:[]}],expectedRevision:null}});expect(record.ok(),await record.text()).toBe(true);
 await page.goto("/index.html#launcher/part/"+component.id);
 const part=page.locator('#launcher .bom-part-workspace'),section=part.locator('[data-section="part-revisions"]');await expect(section).toBeVisible();await section.locator(":scope > summary").click();await expect(section.getByRole("button",{name:"Create a Revision",exact:true})).toBeVisible();return {component,part,section};
}
for(const width of [1440,390])test("revision creation preserves the working part, freezes evidence and opens no duplicate forms at "+width+"px",async({page},testInfo)=>{
 await page.setViewportSize({width,height:1000});const {component,part,section}=await fixture(page);
 await expect(part.getByText("Archives and Revision History",{exact:true})).toHaveCount(0);await expect(part.getByRole("button",{name:"Replace part / save revision",exact:true})).toHaveCount(0);
 expect(await section.evaluate(node=>node.parentElement.lastElementChild===node)).toBe(true);await expect(section).toContainText("The working part stays unchanged");await expect(section.locator('input[type="date"],textarea,input')).toHaveCount(0);
 let release;const held=new Promise(resolve=>release=resolve);let calls=0;
 await page.route("**/api/investigations?**",async route=>{if(route.request().method()==="POST"&&route.request().postDataJSON().action==="createPartRevision"){calls++;await held;}await route.continue();});
 const create=section.getByRole("button",{name:"Create a Revision",exact:true});await create.click();await expect(section.getByRole("button",{name:"Creating revision…",exact:true})).toBeDisabled();
 // Rapid additional clicks dispatch no handler while the native control is disabled.
 await section.getByRole("button",{name:"Creating revision…",exact:true}).evaluate(button=>{button.click();button.click();});release();
 await expect(section.getByRole("status")).toContainText("Revision created");expect(calls).toBe(1);await expect(part.locator(".investigation-replace")).toHaveCount(0);await expect(page.getByRole("dialog",{name:"Part editor",exact:true})).not.toBeVisible();
 const saved=await(await page.request.get("/api/investigations?project=launcher")).json();expect(saved.records.filter(record=>record.partSnapshot)).toHaveLength(1);expect(saved.records.find(record=>record.title==="Original load test").lifecycle).toBe("active");
 await page.reload();await section.locator(":scope > summary").click();await expect(section.locator('[data-section="part-revision"]')).toHaveCount(1);await section.locator('[data-section="part-revision"] > summary').click();await expect(section).toContainText("3 mm");await expect(section).toContainText("Held 2 kg");await expect(section.locator("time")).toHaveCount(1);
 const summary=section.locator('[data-section="part-revision"] > summary');expect((await summary.boundingBox()).height).toBeLessThanOrEqual(100);expect((await summary.locator("h2").boundingBox()).height).toBeLessThanOrEqual(50);
 // Ordinary edits after the snapshot do not alter the historical part.
 const details=part.locator('[data-section="part-details"]');await details.locator(":scope > summary").click();await details.getByRole("button",{name:"Edit part details",exact:true}).click();const editor=page.getByRole("dialog",{name:"Part editor",exact:true});await editor.getByLabel("Purpose (optional)",{exact:true}).fill("Modified after revision");await editor.getByRole("button",{name:"Save changes",exact:true}).click();await expect(editor).not.toBeVisible();
 const current=(await(await page.request.get("/api/components?project=launcher")).json()).components.find(part=>part.id===component.id);expect(current.description).toBe("Modified after revision");const historical=(await(await page.request.get("/api/investigations?project=launcher")).json()).records.find(record=>record.partSnapshot);expect(historical.partSnapshot.part.description).toBe("Support the motor");
 if(await section.getAttribute("open")===null)await section.locator(":scope > summary").click();if(await section.locator('[data-section="part-revision"]').getAttribute("open")===null)await section.locator('[data-section="part-revision"] > summary').click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);const box=await create.boundingBox();expect(box.height).toBe(44);await section.scrollIntoViewIfNeeded();await page.screenshot({path:testInfo.outputPath("part-revisions.png"),fullPage:true});
});
test("failed saves remain retryable and a lost success response creates only one revision",async({page})=>{
 const {section}=await fixture(page);let failed=false;
 await page.route("**/api/investigations?**",async route=>{
  if(route.request().method()!=="POST"||route.request().postDataJSON().action!=="createPartRevision"||failed)return route.continue();
  failed=true;const response=await route.fetch();expect(response.ok()).toBe(true);await route.fulfill({status:503,json:{error:"Response lost after saving"}});
 });
 await section.getByRole("button",{name:"Create a Revision",exact:true}).click();await expect(section.getByRole("status")).toHaveText("Response lost after saving");await section.getByRole("button",{name:"Create a Revision",exact:true}).click();await expect(section.getByRole("status")).toContainText("Revision created");expect((await(await page.request.get("/api/investigations?project=launcher")).json()).records.filter(record=>record.partSnapshot)).toHaveLength(1);
});
test("an unfinished Work Instruction must be saved or cancelled before creating a revision",async({page})=>{
 const {part,section}=await fixture(page),instructions=part.locator('[data-section="work-instructions"]');await instructions.locator(":scope > .ui-section__header").click();await instructions.locator(".recipe-step-nav-actions").getByRole("button",{name:"Edit",exact:true}).click();
 await section.getByRole("button",{name:"Create a Revision",exact:true}).click();await expect(section.getByRole("status")).toContainText("Save or cancel");expect((await(await page.request.get("/api/investigations?project=launcher")).json()).records.filter(record=>record.partSnapshot)).toHaveLength(0);
 await instructions.locator(".recipe-step-nav-actions").getByRole("button",{name:"Cancel",exact:true}).click();await section.getByRole("button",{name:"Create a Revision",exact:true}).click();await expect(section.getByRole("status")).toContainText("Revision created");
});
