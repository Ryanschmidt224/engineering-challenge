import {test,expect} from "@playwright/test";
test.describe.configure({mode:"serial"});
const origin="http://127.0.0.1:4173";
test.beforeEach(async({request,context})=>{const {cookie}=await(await request.post("/__test__/reset")).json(),at=cookie.indexOf("=");await context.addCookies([{name:cookie.slice(0,at),value:cookie.slice(at+1),url:origin,httpOnly:true,sameSite:"Strict"}]);});
async function open(page){
 const response=await page.request.post("/api/components?project=launcher",{headers:{origin},data:{name:"Save warning fixture",partType:"custom",specifications:[]}});expect(response.ok(),await response.text()).toBeTruthy();const {component}=await response.json();
 await page.goto("/index.html#launcher/part/"+component.id);const section=page.locator('#launcher .bom-part-workspace [data-section="work-instructions"]');await expect(section).toBeVisible();await section.locator(":scope > .ui-section__header").click();await expect(section.locator(".recipe-editor")).not.toHaveAttribute("aria-busy","true");
 return {section,partId:component.id};
}
const warns=page=>page.evaluate(()=>{const event=new Event("beforeunload",{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;});
for(const width of [1440,390])test("new instruction draft names the required save and cannot disappear behind navigation at "+width+"px",async({page},testInfo)=>{
 await page.setViewportSize({width,height:1000});const {section,partId}=await open(page);expect(await warns(page)).toBe(false);
 await section.locator(".ui-section__actions").first().getByRole("button",{name:"+ Add entry",exact:true}).click();await section.getByPlaceholder("Work Instruction name",{exact:true}).fill("Print locking plate");
 await section.locator(":scope > .ui-section__header").click();await page.locator("#launcher").getByRole("button",{name:/Project summary$/}).click();
 await expect(page).toHaveURL(new RegExp("/part/"+partId+"$"));await expect(section.getByPlaceholder("Work Instruction name",{exact:true})).toBeVisible();await expect(section.locator(".recipe-feedback")).toContainText("Save or cancel Work Instruction “Print locking plate” before leaving");expect(await warns(page)).toBe(true);
 await page.screenshot({path:testInfo.outputPath("named-save-warning.png"),fullPage:true});await section.locator(".recipe-step-nav-actions").getByRole("button",{name:"Cancel",exact:true}).click();expect(await warns(page)).toBe(false);
 await page.locator("#launcher").getByRole("button",{name:/Project summary$/}).click();await expect(page).toHaveURL(/#launcher$/);
});
test("failed instruction saves stay protected; successful saves and cancellation clear the warning",async({page})=>{
 const {section}=await open(page);await section.locator(".ui-section__actions").first().getByRole("button",{name:"+ Add entry",exact:true}).click();await section.getByPlaceholder("Work Instruction name",{exact:true}).fill("Print bracket");
 await page.route("**/api/workspace?**",route=>route.request().method()==="PUT"?route.fulfill({status:503,json:{error:"Temporary workspace failure"}}):route.continue());await section.locator(".recipe-step-nav-actions").getByRole("button",{name:"Save",exact:true}).click();await expect(section.locator(".recipe-feedback")).toContainText("Temporary workspace failure");expect(await warns(page)).toBe(true);await expect(section.getByPlaceholder("Work Instruction name",{exact:true})).toHaveValue("Print bracket");
 await page.unroute("**/api/workspace?**");await section.locator(".recipe-step-nav-actions").getByRole("button",{name:"Save",exact:true}).click();await expect(section.locator(".recipe-feedback")).toContainText("Work Instruction saved.");expect(await warns(page)).toBe(false);
 await section.locator(".recipe-step-nav-actions").getByRole("button",{name:"Edit",exact:true}).click();await section.getByPlaceholder("Work Instruction name",{exact:true}).fill("Unsaved rename");expect(await warns(page)).toBe(true);await section.locator(".recipe-step-nav-actions").getByRole("button",{name:"Cancel",exact:true}).click();expect(await warns(page)).toBe(false);await expect(section.locator(".recipe-entries-heading")).toHaveText("Print bracket");
});
