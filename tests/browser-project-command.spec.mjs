import {test,expect} from "@playwright/test";
test.describe.configure({mode:"serial"});
test.use({hasTouch:true});
for(const width of [1440,390])test("protected preview transaction proof at "+width+"px",async({page,request,context},testInfo)=>{
 const {cookie}=await(await request.post("/__test__/reset?engine=1")).json(),at=cookie.indexOf("=");
 await context.addCookies([{name:cookie.slice(0,at),value:cookie.slice(at+1),url:"http://127.0.0.1:4173",httpOnly:true,sameSite:"Strict"}]);
 await page.setViewportSize({width,height:1000});
 await page.goto("/project-engine-proof.html");
 await expect(page.locator(".ui-site-account")).toBeVisible();
 const run=page.getByRole("button",{name:"Run preview D1 proof"});
 await run.focus();await page.keyboard.press("Enter");
 await expect(page.getByRole("status")).toContainText("Transaction proof passed");
 const before=JSON.parse(await page.locator("[data-proof-result]").textContent());expect(before.checks).toHaveLength(7);
 await page.getByRole("button",{name:"Recheck the same proof"}).tap();
 await expect(page.getByRole("status")).toContainText("Transaction proof passed");
 const after=JSON.parse(await page.locator("[data-proof-result]").textContent());expect(after.projectId).toBe(before.projectId);expect(after.counts).toEqual(before.counts);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(0);
 await page.screenshot({path:testInfo.outputPath("command-proof.png"),fullPage:true});
});
