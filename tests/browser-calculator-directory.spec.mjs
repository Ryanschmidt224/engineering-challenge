import {test,expect} from "@playwright/test";
test.describe.configure({mode:"serial"});
test.beforeEach(async({request,context})=>{const {cookie}=await(await request.post("/__test__/reset?engine=1")).json(),at=cookie.indexOf("=");await context.addCookies([{name:cookie.slice(0,at),value:cookie.slice(at+1),url:"http://127.0.0.1:4173",httpOnly:true,sameSite:"Strict"}]);});
for(const path of ["/calculators.html","/knowledge.html#calculators"])for(const width of [1440,390])test("Calculator discovery shares project views and retains calculations at "+width+"px on "+path,async({page},testInfo)=>{
 const loaded=[];page.on("request",request=>loaded.push(new URL(request.url()).pathname));
 await page.setViewportSize({width,height:1000});await page.goto(path);
 const root=page.locator("#resource-calculators"),grid=root.locator(".ui-project-list"),view=root.getByRole("combobox",{name:"Calculator view"}),search=root.getByRole("searchbox",{name:"Search calculators",exact:true});
 await expect(grid.locator(".ui-project-card")).toHaveCount(4);await expect(view.locator("option")).toHaveText(["Details","List","Tiles"]);
 for(const mode of ["list","tiles","details"]){await view.selectOption(mode);await expect(grid).toHaveAttribute("data-view",mode);expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);await page.screenshot({path:testInfo.outputPath("calculators-"+mode+".png"),fullPage:true});}
 await root.getByRole("combobox",{name:"Calculator sort order"}).selectOption("name_desc");await expect(grid.locator(".ui-project-name")).toHaveText(["Wire resistance","Wheel surface speed","Surface speed / SFM","Ohm's law"]);
 await search.fill("watts");await expect(grid.locator(".ui-project-name")).toHaveText(["Ohm's law"]);await search.fill("does-not-exist");await expect(root.getByText("No calculators match your search or filters.",{exact:true})).toBeVisible();await search.fill("");
 await root.locator(".project-filter-menu > summary").click();await root.getByRole("button",{name:"Machining 1",exact:true}).click();await expect(grid.locator(".ui-project-name")).toHaveText(["Surface speed / SFM"]);
 await root.getByRole("searchbox",{name:"Search descriptor tiles"}).fill("no topic");await expect(root.getByRole("button",{name:"Machining 1",exact:true})).toBeVisible();await root.getByRole("button",{name:"Clear selected",exact:true}).click();await root.getByRole("searchbox",{name:"Search descriptor tiles"}).fill("");await root.locator(".project-filter-menu > summary").click();
 await search.fill("spindle");await expect(grid.locator(".ui-project-name")).toHaveText(["Surface speed / SFM"]);await search.fill("ft/min");await expect(grid.locator(".ui-project-name")).toHaveText(["Surface speed / SFM"]);await search.fill("m/s");await expect(grid.locator(".ui-project-name")).toHaveText(["Wheel surface speed"]);await search.fill("Ω");await expect(grid.locator(".ui-project-name")).toHaveText(["Ohm's law"]);await search.fill("mm");await expect(grid.locator(".ui-project-name")).toHaveText(["Wheel surface speed"]);await search.fill("voltage");
 await view.selectOption("tiles");await root.getByRole("button",{name:"Open Ohm's law",exact:true}).focus();await page.keyboard.press("Enter");await expect(root.locator(".calculator-detail")).toBeVisible();await expect(root.locator(".ui-section__header")).toBeFocused();
 await page.getByLabel("Voltage (V)",{exact:true}).fill("24");await page.getByLabel("Resistance (Ω)",{exact:true}).fill("12");await expect(root.locator(".calculator-output")).toHaveText("Current 2 A · Power 48 W");await page.screenshot({path:testInfo.outputPath("calculator-form.png"),fullPage:true});
 await root.getByRole("button",{name:"Back to calculators",exact:true}).click();await expect(search).toHaveValue("voltage");await expect(view).toHaveValue("tiles");await expect(root.getByRole("button",{name:"Open Ohm's law",exact:true})).toBeFocused();await root.getByRole("button",{name:"Open Ohm's law",exact:true}).click();await expect(page.getByLabel("Voltage (V)",{exact:true})).toHaveValue("24");
 await root.getByRole("button",{name:"Back to calculators",exact:true}).click();await search.fill("spindle");await root.getByRole("button",{name:"Open Surface speed / SFM",exact:true}).click();await expect(root.locator(".calculator-output")).toHaveText("Surface speed: 523.5988 ft/min");await page.getByLabel("SFM",{exact:true}).fill("600");await expect(root.locator(".calculator-output")).toHaveText("Required spindle speed: 4,583.6624 RPM");
 await root.getByRole("button",{name:"Back to calculators",exact:true}).click();await search.fill("wheel");await root.getByRole("button",{name:"Open Wheel surface speed",exact:true}).click();await expect(root.locator(".calculator-output")).toHaveText("Surface speed 26.1799 m/s");
 await page.reload();await expect(view).toHaveValue("tiles");if(path!=="/index.html#calculators"){expect(loaded.filter(path=>["/assets/site.js","/assets/site-assembly.js","/assets/resources.js","/assets/site.css","/assets/site-polish.css","/api/workspace","/api/wires","/api/accounts"].includes(path))).toEqual([]);await expect(page.locator(".ui-site-nav__item[aria-current=page]")).toHaveText("Lessons Learned");}await page.getByRole("navigation",{name:"Main navigation"}).getByRole("link",{name:"Projects",exact:true}).click();await expect(page).toHaveURL(/\/project\.html$/);await expect(page.locator("[data-page-title]")).toHaveText("Projects");
});

test("Workshop and Knowledge return to current Projects",async({page})=>{
 for(const path of ["/workshop.html","/knowledge.html","/calculators.html"]){
  await page.goto(path);
  const projects=page.getByRole("navigation",{name:"Main navigation"}).getByRole("link",{name:"Projects",exact:true});
  await expect(projects).toHaveAttribute("href","/project.html");
  await projects.click();
  await expect(page).toHaveURL(/\/project\.html$/);
  await expect(page.locator("[data-page-title]")).toHaveText("Projects");
  await page.goto(path);
  await page.locator(".ui-site-brand").click();
  await expect(page).toHaveURL(/\/project\.html$/);
 }
});

for(const width of [390,1440])test("Lessons Learned contains collapsed calculators without a main navigation tab at "+width,async({page})=>{
 await page.setViewportSize({width,height:1000});await page.goto("/knowledge.html");const nav=page.getByRole("navigation",{name:"Main navigation"});await expect(nav.getByRole("link")).toHaveText(["Projects","Lessons Learned","The Workshop"]);await expect(page.getByRole("heading",{name:"Lessons Learned",exact:true})).toBeVisible();const section=page.locator("#calculators > details");await expect(section).not.toHaveAttribute("open","");await section.locator(":scope > summary").click();await page.getByRole("button",{name:"Open Ohm's law",exact:true}).click();await expect(page.locator(".calculator-output")).toHaveText("Current 2 A · Power 24 W");await expect(page.getByRole("button",{name:"+ Add lesson",exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);
});
