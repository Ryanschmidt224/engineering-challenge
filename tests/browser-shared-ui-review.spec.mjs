import {test,expect} from "@playwright/test";
test.describe.configure({mode:"serial"});
test.beforeEach(async({request,context})=>{const {cookie}=await(await request.post("/__test__/reset")).json(),at=cookie.indexOf("=");await context.addCookies([{name:cookie.slice(0,at),value:cookie.slice(at+1),url:"http://127.0.0.1:4173",httpOnly:true,sameSite:"Strict"}]);});
for(const width of [1440,2560,390])test("Shared page gutters, title-only headers and blank detail panels at "+width+"px",async({page},testInfo)=>{
 await page.setViewportSize({width,height:1100});const lefts=[];
 for(const [path,title,column,heading]of [["/index.html#home","Projects","#home .ui-project-list","#home .project-directory-heading"],["/workshop.html","The Workshop",".category-panel",".workshop-heading"],["/knowledge.html","Bits of information",".tile-panel",".knowledge-heading"]]){
  await page.goto(path);await expect(page.getByRole("heading",{name:title,exact:true})).toBeVisible();await expect(page.locator(column)).toBeVisible();
  const edge=await page.locator(column).evaluate(el=>el.getBoundingClientRect().left),brand=await page.locator(".ui-site-brand").evaluate(el=>el.getBoundingClientRect().left),titleEdge=await page.getByRole("heading",{name:title,exact:true}).evaluate(el=>el.getBoundingClientRect().left);
  expect(Math.abs(edge-brand)).toBeLessThanOrEqual(1);expect(Math.abs(titleEdge-brand)).toBeLessThanOrEqual(1);lefts.push(brand);
  await expect(page.locator(heading).locator("p,.eyebrow")).toHaveCount(0);
  if(path.includes("workshop"))await expect(page.locator("#workshop-detail")).toBeEmpty();
  if(path.includes("knowledge"))await expect(page.locator("#knowledge-detail")).toBeEmpty();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);await page.screenshot({path:testInfo.outputPath(title.toLowerCase().replaceAll(" ","-")+".png"),fullPage:true});
 }
 expect(Math.max(...lefts)-Math.min(...lefts)).toBeLessThanOrEqual(1);
});
for(const width of [1440,390])test("Panel help is keyboard accessible, actions are small and failures stay visible at "+width+"px",async({page},testInfo)=>{
 page.on("dialog",dialog=>dialog.accept());
 await page.setViewportSize({width,height:1100});await page.goto("/workshop.html");await expect(page.locator("#workshop-detail")).toBeEmpty();await page.getByRole("button",{name:"Add family",exact:true}).click();
 const help=page.getByRole("button",{name:"About Family fields",exact:true}),tip=page.getByRole("tooltip").filter({hasText:"Define a field once."});await expect(tip).toBeHidden();await help.focus();await expect(tip).toBeVisible();await help.press("Escape");await expect(tip).toBeHidden();
 const add=page.getByRole("button",{name:"Add field",exact:true});expect(await add.evaluate(el=>el.getBoundingClientRect().height)).toBe(32);expect(await page.getByRole("button",{name:"Add family",exact:true}).evaluate(el=>el.getBoundingClientRect().height)).toBe(44);await page.screenshot({path:testInfo.outputPath("workshop-editor.png"),fullPage:true});
 await page.goto("/knowledge.html");await expect(page.locator("#knowledge-detail")).toBeEmpty();await page.getByRole("button",{name:"New tile",exact:true}).click();const statusHelp=page.getByRole("button",{name:"About Tile status",exact:true}),statusTip=page.getByRole("tooltip").filter({hasText:"Verified means"});await expect(statusTip).toBeHidden();await statusHelp.focus();await expect(statusTip).toBeVisible();await statusHelp.press("Escape");await expect(statusTip).toBeHidden();await page.screenshot({path:testInfo.outputPath("knowledge-editor.png"),fullPage:true});
 await page.route("**/api/knowledge",route=>route.fulfill({status:503,json:{error:"Synthetic knowledge service failure"}}));await page.goto("/knowledge.html");await expect(page.locator("#knowledge-detail").getByText("Synthetic knowledge service failure",{exact:true})).toBeVisible();await expect(page.getByRole("button",{name:"Try again",exact:true})).toBeVisible();
 await page.route("**/api/workshop",route=>route.fulfill({status:503,json:{error:"Synthetic Workshop service failure"}}));await page.goto("/workshop.html");await expect(page.locator("#workshop-detail").getByText("Synthetic Workshop service failure",{exact:true})).toBeVisible();
});

for(const width of [390,1440,2560])test("shared label columns are bounded across Workshop and information forms at "+width,async({page})=>{
 await page.setViewportSize({width,height:1100});for(const [path,action]of [["/workshop.html","Add family"],["/knowledge.html","New tile"]]){await page.goto(path);await page.getByRole("button",{name:action,exact:true}).click();const form=page.locator(".detail-panel form").first();await expect(form).toBeVisible();const rows=await form.locator(".field-row,.ui-field-row").all();expect(rows.length).toBeGreaterThan(0);for(const row of rows){const columns=await row.evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(" ").map(parseFloat));if(columns.length===2){expect(columns[0]).toBeLessThanOrEqual(144);expect(await row.evaluate(el=>parseFloat(getComputedStyle(el).columnGap))).toBeLessThanOrEqual(12);}}expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);}
});
