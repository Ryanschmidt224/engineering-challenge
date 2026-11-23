import {test,expect} from "@playwright/test";
const origin="http://127.0.0.1:4173",headers={origin};
const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/qLkAAAAASUVORK5CYII=","base64");
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
 expect(await section.evaluate(node=>node.parentElement.lastElementChild===node)).toBe(true);await expect(section).toContainText("the working part advances to the next revision number");await expect(section.locator('input[type="date"],textarea,input')).toHaveCount(0);
 let release;const held=new Promise(resolve=>release=resolve);let calls=0;
 await page.route("**/api/investigations?**",async route=>{if(route.request().method()==="POST"&&route.request().postDataJSON().action==="createPartRevision"){calls++;await held;}await route.continue();});
 const create=section.getByRole("button",{name:"Create a Revision",exact:true});await create.click();const prompt=page.getByRole("dialog",{name:"Create a Revision",exact:true});
 await prompt.getByLabel("What changed",{exact:true}).fill("Thicker mounting tab");await prompt.getByLabel("Why did you change it",{exact:true}).fill("Reduce flex");await prompt.getByLabel("Notes",{exact:true}).fill("Check the hole spacing");
 await prompt.getByRole("button",{name:"Add photos",exact:true}).click();await prompt.locator('input[type="file"]').setInputFiles({name:"bracket.png",mimeType:"image/png",buffer:png});await prompt.getByRole("textbox",{name:"Photo name for bracket.png",exact:true}).fill("Bracket change");
 await create.evaluate(button=>{button.click();button.click();});await expect(page.getByRole("dialog",{name:"Create a Revision",exact:true})).toHaveCount(1);await page.screenshot({path:testInfo.outputPath("revision-prompt.png"),fullPage:true});
 await prompt.getByRole("button",{name:"Save revision",exact:true}).click();await expect(prompt.getByRole("button",{name:"Saving…",exact:true})).toBeDisabled();await prompt.getByRole("button",{name:"Saving…",exact:true}).evaluate(button=>{button.click();button.click();});release();
 await expect(prompt).not.toBeVisible();await expect(section.getByRole("status")).toContainText("Revision created");expect(calls).toBe(1);await expect(page.getByRole("dialog",{name:"Part editor",exact:true})).not.toBeVisible();
 const saved=await(await page.request.get("/api/investigations?project=launcher")).json();expect(saved.records.filter(record=>record.partSnapshot)).toHaveLength(1);expect(saved.records.find(record=>record.title==="Original load test").lifecycle).toBe("active");
 await page.reload();await section.locator(":scope > summary").click();await expect(section.locator('[data-section="part-revision"]')).toHaveCount(1);await section.locator('[data-section="part-revision"] > summary').click();await expect(section).toContainText("3 mm");await expect(section).toContainText("Held 2 kg");await expect(section).toContainText("Thicker mounting tab");await expect(section).toContainText("Reduce flex");await expect(section.getByRole("img",{name:"Bracket change",exact:true})).toBeVisible();await expect(section.locator("time")).toHaveCount(1);
 const summary=section.locator('[data-section="part-revision"] > summary');expect((await summary.boundingBox()).height).toBeLessThanOrEqual(100);expect((await summary.locator("h2").boundingBox()).height).toBeLessThanOrEqual(50);
 // Ordinary edits after the snapshot do not alter the historical part.
 const details=part.locator('[data-section="part-details"]');await details.locator(":scope > summary").click();await details.getByRole("button",{name:"Edit part details",exact:true}).click();const editor=page.getByRole("dialog",{name:"Part editor",exact:true});await editor.getByLabel("Purpose (optional)",{exact:true}).fill("Modified after revision");await editor.getByRole("button",{name:"Save",exact:true}).click();await expect(editor).not.toBeVisible();
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
 await section.getByRole("button",{name:"Create a Revision",exact:true}).click();const prompt=page.getByRole("dialog",{name:"Create a Revision",exact:true});await prompt.getByLabel("Notes",{exact:true}).fill("Retain this draft");await prompt.getByRole("button",{name:"Save revision",exact:true}).click();await expect(prompt.getByRole("status")).toHaveText("Response lost after saving");await expect(prompt.getByLabel("Notes",{exact:true})).toHaveValue("Retain this draft");await prompt.getByRole("button",{name:"Save revision",exact:true}).click();await expect(section.getByRole("status")).toContainText("Revision created");expect((await(await page.request.get("/api/investigations?project=launcher")).json()).records.filter(record=>record.partSnapshot)).toHaveLength(1);
});
test("an unfinished Work Instruction must be saved or cancelled before creating a revision",async({page})=>{
 const {part,section}=await fixture(page),instructions=part.locator('[data-section="work-instructions"]');await instructions.locator(":scope > .ui-section__header").click();await instructions.locator(".recipe-step-nav-actions").getByRole("button",{name:"Edit",exact:true}).click();
 await section.getByRole("button",{name:"Create a Revision",exact:true}).click();await expect(section.getByRole("status")).toContainText("Save or cancel");expect((await(await page.request.get("/api/investigations?project=launcher")).json()).records.filter(record=>record.partSnapshot)).toHaveLength(0);
 await instructions.locator(".recipe-step-nav-actions").getByRole("button",{name:"Cancel",exact:true}).click();await section.getByRole("button",{name:"Create a Revision",exact:true}).click();await page.getByRole("dialog",{name:"Create a Revision",exact:true}).getByRole("button",{name:"Save revision",exact:true}).click();await expect(section.getByRole("status")).toContainText("Revision created");
});

test("cancelling the revision explanation writes no record and clears draft protection",async({page})=>{
 const {section}=await fixture(page);await section.getByRole("button",{name:"Create a Revision",exact:true}).click();const prompt=page.getByRole("dialog",{name:"Create a Revision",exact:true});await prompt.getByLabel("What changed",{exact:true}).fill("Cancelled change");
 const warned=()=>page.evaluate(()=>{const event=new Event("beforeunload",{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;});expect(await warned()).toBe(true);await prompt.getByRole("button",{name:"Cancel",exact:true}).click();expect(await warned()).toBe(false);expect((await(await page.request.get("/api/investigations?project=launcher")).json()).records.filter(record=>record.partSnapshot)).toHaveLength(0);
});

for(const width of [1440,390])test("part editor offers Save and Save as revision with an indexed history table at "+width+"px",async({page},testInfo)=>{
 await page.setViewportSize({width,height:1000});const {component,part,section}=await fixture(page);
 const details=part.locator('[data-section="part-details"]');await details.locator(":scope > summary").click();await details.getByRole("button",{name:"Edit part details",exact:true}).click();
 const editor=page.getByRole("dialog",{name:"Part editor",exact:true}),save=editor.getByRole("button",{name:"Save",exact:true}),saveRevision=editor.getByRole("button",{name:"Save as revision",exact:true});
 await expect(save).toHaveAttribute("title",/without creating a revision history copy/);await expect(saveRevision).toHaveAttribute("title",/previous saved version/);
 await editor.getByLabel("Purpose (optional)",{exact:true}).fill("New mounting position");await saveRevision.click();let prompt=page.getByRole("dialog",{name:"Save as revision",exact:true});await prompt.getByLabel("What changed",{exact:true}).fill("Cancelled explanation");await prompt.getByRole("button",{name:"Cancel",exact:true}).click();
 await expect(editor).toBeVisible();await expect(editor.getByLabel("Purpose (optional)",{exact:true})).toHaveValue("New mounting position");expect((await(await page.request.get("/api/investigations?project=launcher")).json()).records.filter(record=>record.partSnapshot)).toHaveLength(0);
 await saveRevision.scrollIntoViewIfNeeded();await page.screenshot({path:testInfo.outputPath("part-editor-save-choices.png"),fullPage:true});
 let lost=false;
 await page.route("**/api/components?**",async route=>{
  if(route.request().method()!=="PUT"||!route.request().postDataJSON().saveAsRevision||lost)return route.continue();
  lost=true;const response=await route.fetch();expect(response.ok(),await response.text()).toBe(true);await route.fulfill({status:503,json:{error:"Saved response was lost"}});
 });
 await saveRevision.click();prompt=page.getByRole("dialog",{name:"Save as revision",exact:true});await prompt.getByLabel("What changed",{exact:true}).fill("Moved the mounting holes");await prompt.getByLabel("Why did you change it",{exact:true}).fill("Clear the motor");
 await saveRevision.evaluate(button=>{button.click();button.click();});await expect(page.getByRole("dialog",{name:"Save as revision",exact:true})).toHaveCount(1);
 await prompt.getByRole("button",{name:"Save as revision",exact:true}).click();await expect(prompt.getByRole("status")).toHaveText("Saved response was lost");await expect(prompt.getByLabel("What changed",{exact:true})).toHaveValue("Moved the mounting holes");await prompt.getByRole("button",{name:"Save as revision",exact:true}).click();await expect(prompt).not.toBeVisible();await expect(editor).not.toBeVisible();
 const current=async()=>(await(await page.request.get("/api/components?project=launcher")).json()).components.find(part=>part.id===component.id);
 expect((await current()).revisionLevel).toBe(2);expect((await current()).description).toBe("New mounting position");
 let records=(await(await page.request.get("/api/investigations?project=launcher")).json()).records.filter(record=>record.partSnapshot);expect(records).toHaveLength(1);expect(records[0].partSnapshot.part.revisionLevel).toBe(1);expect(records[0].partSnapshot.part.description).toBe("Support the motor");
 if(await section.getAttribute("open")===null)await section.locator(":scope > summary").click();const table=section.getByRole("table",{name:"Part revision table",exact:true});await expect(table.getByRole("row").filter({hasText:"Working part"})).toContainText("Current");await expect(table.getByRole("row").filter({hasText:"View 1"})).toContainText("Moved the mounting holes");await table.getByRole("button",{name:"View revision 1",exact:true}).click();await expect(section).toContainText("Support the motor");
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);await section.screenshot({path:testInfo.outputPath("revision-table.png")});
 if(await details.getAttribute("open")===null)await details.locator(":scope > summary").click();await details.getByRole("button",{name:"Edit part details",exact:true}).click();await editor.getByLabel("Purpose (optional)",{exact:true}).fill("Standard overwrite");await save.click();await expect(editor).not.toBeVisible();expect((await current()).revisionLevel).toBe(2);expect((await current()).description).toBe("Standard overwrite");records=(await(await page.request.get("/api/investigations?project=launcher")).json()).records.filter(record=>record.partSnapshot);expect(records).toHaveLength(1);
});

test("deleting a saved copy refreshes the working token and the next revision keeps advancing",async({page})=>{
 const {section}=await fixture(page),create=section.getByRole("button",{name:"Create a Revision",exact:true});
 await create.click();await page.getByRole("dialog",{name:"Create a Revision",exact:true}).getByRole("button",{name:"Save revision",exact:true}).click();await expect(section.getByRole("status")).toContainText("Revision created");
 await section.getByRole("button",{name:"View revision 1",exact:true}).click();await section.getByRole("button",{name:"Delete revision",exact:true}).click();const confirm=page.getByRole("dialog",{name:"Delete revision?",exact:true});await confirm.getByRole("button",{name:"Delete revision",exact:true}).click();await expect(confirm).not.toBeVisible();await expect(section.locator('[data-section="part-revision"]')).toHaveCount(0);
 await create.click();await page.getByRole("dialog",{name:"Create a Revision",exact:true}).getByRole("button",{name:"Save revision",exact:true}).click();await expect(section.getByRole("status")).toContainText("revision 3");await expect(section.getByRole("button",{name:"View revision 2",exact:true})).toBeVisible();
});
