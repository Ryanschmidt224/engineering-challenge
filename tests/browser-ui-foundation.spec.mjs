import {test, expect} from "@playwright/test";

test.describe.configure({mode: "serial"});
test.beforeEach(async ({request, context}) => {
  const {cookie} = await (await request.post("/__test__/reset")).json();
  const at = cookie.indexOf("=");
  await context.addCookies([{name: cookie.slice(0, at), value: cookie.slice(at + 1), url: "http://127.0.0.1:4173", httpOnly: true, sameSite: "Strict"}]);
});

for (const width of [1440, 390]) test("shared headers, controls and collapsed summary at " + width + "px", async ({page}, testInfo) => {
  await page.setViewportSize({width, height: 1000});
  const headers = [];
  for (const path of ["/index.html#home", "/workshop.html", "/knowledge.html"]) {
    await page.goto(path);
    await expect(page.locator(".ui-site-account")).toBeVisible();
    await expect(page.locator(".ui-site-nav__item")).toHaveText(["Projects", "Knowledge", "The Workshop", "Calculators"]);
    headers.push(await page.locator(".ui-site-header").evaluate(el => {
      const b = el.getBoundingClientRect(), brand = el.querySelector(".ui-site-brand"), nav = el.querySelector(".ui-site-nav__item");
      return {height: b.height, background: getComputedStyle(el).backgroundColor, logo: getComputedStyle(brand).fontSize, text: getComputedStyle(nav).fontSize};
    }));
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    await page.screenshot({path: testInfo.outputPath(path.includes("workshop") ? "workshop.png" : path.includes("knowledge") ? "knowledge.png" : "projects.png")});
  }
  expect(headers[1]).toEqual(headers[0]); expect(headers[2]).toEqual(headers[0]);
  if(width === 390) {
    expect(headers[0].height).toBeLessThanOrEqual(120);
    const rows = await page.locator(".ui-site-nav__item").evaluateAll(els => els.map(el => el.getBoundingClientRect().top));
    expect(new Set(rows).size).toBe(1);
  }
  await page.goto("/index.html#home");
  await expect(page.getByRole("button", {name: "+ New project", exact: true})).toBeVisible();
  const controls = await page.locator(".ui-directory-toolbar .ui-control, .ui-directory-toolbar > .ui-button, .ui-toolbar-menu > summary").evaluateAll(els => els.filter(el => el.getClientRects().length).map(el => ({height: el.getBoundingClientRect().height, font: getComputedStyle(el).fontSize})));
  expect(controls.length).toBeGreaterThanOrEqual(4);
  for (const c of controls) { expect(c.height).toBe(44); expect(c.font).toBe("14px"); }
  await page.goto("/index.html#launcher");
  const summary = page.locator("#launcher .project-summary-page");
  await expect(summary).toBeVisible();
  const panels = summary.locator('[data-section^="summary-"]');
  expect(await panels.count()).toBeGreaterThanOrEqual(6);
  for (const panel of await panels.all()) {
    const header = panel.locator(":scope > .ui-section__header, :scope > .project-milestone-heading > .ui-section__header");
    await expect(header).toBeVisible();
    expect(await header.evaluate(el => el.getBoundingClientRect().height)).toBe(48);
    await expect(panel.locator(".ui-section__body").first()).toBeHidden();
    await expect(header.locator(".ui-section__title")).toHaveCSS("font-size", "16px");
    await header.click();
    await expect(panel.locator(".ui-section__body").first()).toBeVisible();
    await header.click();
  }
  const description = summary.locator('[data-section="summary-description"]');
  await description.locator(".ui-section__header").click();
  await description.locator(".project-short-summary").fill("Shared summary save check");
  await description.getByRole("textbox", {name: "Project summary", exact: true}).fill("The long project summary remains editable and is saved with the short summary.");
  await description.getByRole("button", {name: "Save", exact: true}).click();
  await expect(description.locator(".project-summary-message")).toHaveText("Summary saved.");
  await page.evaluate(() => window.scrollTo({top: 0, left: 0, behavior: "instant"}));
  await page.screenshot({path: testInfo.outputPath("summary.png"), fullPage: true});
});

test("empty section bodies share geometry and tooltip help does not cover the tree while browsing", async ({page}, testInfo) => {
  const response = await page.request.post("/api/workshop", {headers: {origin: "http://127.0.0.1:4173"}, data: {entity: "use", expectedRevision: null, expectedFamilyRevision: 1, record: {id: crypto.randomUUID(), project_id: "launcher", family_id: "f-resistor", product_id: null, tree_node_id: null, purpose: "Test resistor", quantity: 1, unit: "pcs", field_values: {}, notes: ""}}});
  expect(response.ok(), await response.text()).toBe(true);
  const {record} = await response.json();
  const components = await (await page.request.get("/api/components?project=launcher")).json();
  const part = components.components.find(entry => entry.id === record.id);
  const progress = await page.request.patch("/api/components?project=launcher&id=" + record.id, {headers: {origin: "http://127.0.0.1:4173"}, data: {expectedRevision: part.revision, progressStatus: "complete"}});
  expect(progress.ok(), await progress.text()).toBe(true);
  await page.goto("/index.html#launcher/part/" + record.id);
  const workspace = page.locator("#launcher .bom-part-workspace");
  await expect(workspace).toBeVisible();
  const sizes = [];
  for (const role of ["work-instructions", "helpful-tools", "history", "notes"]) {
    const section = workspace.locator('[data-section="' + role + '"]');
    await section.locator(":scope > .ui-section__header").click();
    await expect(section.getByRole("button", {name: "+ Add entry", exact: true})).toBeVisible();
    sizes.push(await section.locator(":scope > .ui-section__body").evaluate(el => el.getBoundingClientRect().height));
  }
  expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
  await expect(workspace.getByText("No notes yet.", {exact: true})).toHaveCount(0);
  // Creation still works when an empty record wrapper has no visible padding.
  const history = workspace.locator('[data-section="history"]');
  await history.getByRole("button", {name: "+ Add entry", exact: true}).click();
  await expect(history.getByRole("combobox", {name: "Entry type", exact: true})).toBeVisible();
  await history.getByRole("button", {name: "Cancel", exact: true}).click();
  const tree = page.locator("#launcher [data-assembly-tree]");
  const complete = tree.locator(".assembly-name").filter({has: page.locator(".ui-status-mark")});
  await expect(complete).toHaveCount(1);
  expect(await complete.evaluate(el => el.firstElementChild.classList.contains("ui-status-mark") && el.firstChild === el.firstElementChild)).toBe(true);
  const row = tree.locator(".assembly-node").first();
  await row.hover();
  await expect(page.locator("#bs-global-tooltip")).toBeHidden();
  expect(await row.getAttribute("title")).toBeNull();
  const help = tree.getByRole("button", {name: "Reordering the feature tree", exact: true});
  await help.focus();
  await expect(tree.getByRole("tooltip")).toBeVisible();
  await help.press("Escape");
  await expect(tree.getByRole("tooltip")).toBeHidden();
  await page.evaluate(() => window.scrollTo({top: 0, left: 0, behavior: "instant"}));
  await page.screenshot({path: testInfo.outputPath("standard-empty-sections.png"), fullPage: true});
});

test("Account is reachable from the shared Workshop header", async ({page}) => {
  await page.goto("/workshop.html");
  await page.locator(".ui-site-account").click();
  await expect(page.locator(".project-account-dialog")).toBeVisible();
  await expect(page).not.toHaveURL(/account=1/);
});


for (const width of [1440, 390]) test("shared section gaps across summary, assembly and part at " + width + "px", async ({page}, testInfo) => {
  await page.setViewportSize({width, height: 1000});
  async function gaps(root, roles) {
    for (const role of roles) await expect(root.locator('[data-section="' + role + '"]')).toBeVisible();
    // Read all rectangles in one layout snapshot; individual async reads can
    // straddle startup scrolling or font/layout updates.
    await expect.poll(() => root.evaluate((el, roles) => {
      const boxes = roles.map(role => el.querySelector('[data-section="' + role + '"]').getBoundingClientRect());
      return boxes.slice(1).map((box, i) => Math.round(box.top - boxes[i].bottom));
    }, roles), {message: roles.join(" → ")}).toEqual(roles.slice(1).map(() => 12));
  }
  await page.goto("/#launcher");
  await gaps(page.locator("#launcher .project-summary-page"), ["summary-photos", "summary-description", "summary-cost"]);
  await page.screenshot({path: testInfo.outputPath("summary-spacing.png"), fullPage: true});
  await page.goto("/#launcher/workspace/__root__");
  await gaps(page.locator("#launcher .assembly-workspace-page:not(.bom-part-workspace)"), ["work-instructions", "helpful-tools", "archived-items", "history", "notes"]);
  await page.screenshot({path: testInfo.outputPath("assembly-spacing.png"), fullPage: true});
  const response = await page.request.post("/api/workshop", {headers: {origin: "http://127.0.0.1:4173"}, data: {entity: "use", expectedRevision: null, expectedFamilyRevision: 1, record: {id: crypto.randomUUID(), project_id: "launcher", family_id: "f-resistor", product_id: null, tree_node_id: null, purpose: "Spacing fixture", quantity: 1, unit: "pcs", field_values: {}, notes: ""}}});
  expect(response.ok(), await response.text()).toBe(true);
  const {record} = await response.json();
  await page.goto("/#launcher/part/" + record.id);
  await gaps(page.locator("#launcher .bom-part-workspace"), ["part-details", "work-instructions", "helpful-tools", "history", "notes"]);
  await page.screenshot({path: testInfo.outputPath("part-spacing.png"), fullPage: true});
  let navigations = 0;
  page.on("request", request => { if(request.isNavigationRequest() && request.frame() === page.mainFrame()) navigations++; });
  await page.locator(".ui-site-brand").click();
  await expect(page).toHaveURL(/\/#home$/);
  await expect(page.locator(".ui-directory-toolbar")).toBeVisible();
  expect(navigations).toBe(0);
});

test("project filter chips use the shared component and retain toggle and remove behavior", async ({page}) => {
  await page.goto("/#home");
  await page.locator(".project-filter-menu > summary").click();
  const chip = page.locator(".ui-toolbar-menu__panel .ui-chip").first();
  await expect(chip).toBeVisible();
  await expect(chip).toHaveAttribute("aria-pressed", "false");
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  const remove = page.locator(".project-selected-descriptors .ui-chip");
  await expect(remove).toHaveCount(1);
  await remove.click();
  await expect(remove).toHaveCount(0);
  await expect(chip).toHaveAttribute("aria-pressed", "false");
});


test("summary disclosures remember browser preferences independently for each project", async ({page}) => {
  await page.goto("/#launcher");
  const summary = page.locator("#launcher .project-summary-page");
  const description = summary.locator('[data-section="summary-description"]');
  const milestone = summary.locator('[data-section="summary-milestones"]');
  await expect(description).not.toHaveAttribute("open");
  await description.locator(".ui-section__header").click();
  await milestone.locator(".ui-section__header").click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("building-schmidt:summary:launcher:summary-description"))).toBe("open");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("building-schmidt:summary:launcher:summary-milestones"))).toBe("open");
  await page.reload();
  await expect(description).toHaveAttribute("open");
  await expect(milestone.locator(".ui-section__header")).toHaveAttribute("aria-expanded", "true");
  await page.goto("/#linear");
  await expect(page.locator('#linear [data-section="summary-description"]')).not.toHaveAttribute("open");
  await page.goto("/#launcher");
  await description.locator(".ui-section__header").click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("building-schmidt:summary:launcher:summary-description"))).toBe("closed");
  await page.reload();
  await expect(description).not.toHaveAttribute("open");
  await expect(milestone.locator(".ui-section__header")).toHaveAttribute("aria-expanded", "true");
});


test("private project controls omit publishing, suggestion and feedback UI", async ({page}) => {
  await page.goto("/#launcher/settings");
  await expect(page.getByRole("button", {name:"Save settings", exact:true})).toBeVisible();
  await expect(page.getByText("Visibility", {exact:true})).toHaveCount(0);
  await expect(page.getByText("Editing permissions", {exact:true})).toHaveCount(0);
  await expect(page.getByText("Allow suggestions", {exact:false})).toHaveCount(0);
  await page.goto("/#launcher/workspace/__root__");
  await expect(page.locator(".assembly-workspace-page:not(.bom-part-workspace)").first()).toBeVisible();
  await expect(page.getByRole("button", {name:"Report: stuck or confused", exact:true})).toHaveCount(0);
  await page.locator(".ui-site-account").click();
  await expect(page.locator(".project-account-dialog")).toBeVisible();
  await expect(page.getByRole("button",{name:"Link administrator access",exact:true})).toHaveCount(0);
});

test("one project template supports built-in and new project routes without duplicate element IDs", async ({page}) => {
  const response=await page.request.post("/api/projects", {headers:{origin:"http://127.0.0.1:4173"},data:{name:"Shared template fixture",tags:["CAD"]}});
  expect(response.ok(),await response.text()).toBe(true);
  const {projects}=await response.json(),created=projects.find(project=>project.name==="Shared template fixture");
  await page.goto("/#home");
  await expect(page.locator(".project-grid > .project-card")).toHaveCount(4);
  for(const id of ["launcher","linear","robot",created.id]) {
    await page.goto("/#"+id+"/workspace/__root__");
    await expect(page).toHaveURL(new RegExp("#"+id+"/workspace/__root__$"));
    await expect(page.locator("#"+id+".project-view .assembly-workspace-page:not(.bom-part-workspace)")).toBeVisible();
    await expect(page.locator('[data-assembly-tree="'+id+'"]')).toHaveCount(1);
  }
  const duplicateIDs=await page.locator("[id]").evaluateAll(nodes=>nodes.map(node=>node.id).filter((id,index,all)=>all.indexOf(id)!==index));
  expect(duplicateIDs).toEqual([]);
});

test("Calculators uses its own route and preserves the existing calculation forms",async({page})=>{
 await page.goto("/#home");
 await page.getByRole("button",{name:"Calculators",exact:true}).click();
 await expect(page).toHaveURL(/#calculators$/);
 await expect(page.locator("#calculators")).toBeVisible();
 await expect(page.getByRole("heading",{name:"Calculators",exact:true})).toBeVisible();
 await expect(page.locator("#resource-calculators .resource-card")).toHaveCount(3);
 await page.getByLabel("Voltage (V)",{exact:true}).fill("12");
 await page.getByLabel("Resistance (Ω)",{exact:true}).fill("6");
 await expect(page.locator(".calculator-output").filter({hasText:"Current"})).toHaveText("Current 2 A · Power 24 W");
 await expect(page.locator(".ui-site-nav__item[aria-current=page]")).toHaveText("Calculators");
});


test("an empty owner catalog does not instantiate hidden built-in projects",async({page})=>{
 await page.route("**/api/projects",route=>route.fulfill({json:{projects:[]}}));
 await page.goto("/#home");
 await expect(page.locator(".project-directory-empty")).toBeVisible();
 await expect(page.locator(".project-grid > .project-card")).toHaveCount(0);
 await expect(page.locator("#launcher,#linear,#robot")).toHaveCount(0);
});

test("project and calculator pages do not request retired Workshop endpoints",async({page})=>{
 const retired=[];
 page.on("request",request=>{if(["/api/commonparts","/api/purchased-parts"].includes(new URL(request.url()).pathname))retired.push(request.url());});
 await page.goto("/index.html#launcher");
 await expect(page.locator("#launcher .project-summary-page")).toBeVisible();
 await page.goto("/index.html#calculators");
 await expect(page.locator("#resource-calculators")).toBeVisible();
 await expect(page.locator("#resource-calculators .resource-card").first()).toBeVisible();
 expect(retired).toEqual([]);
});
