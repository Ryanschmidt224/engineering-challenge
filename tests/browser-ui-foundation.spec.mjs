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
    await expect(panel.locator(".ui-section__body").first()).toBeHidden();
    await expect(header.locator(".ui-section__title")).toHaveCSS("font-size", "16px");
    await header.click();
    await expect(panel.locator(".ui-section__body").first()).toBeVisible();
    await header.click();
  }
  const description = summary.locator('[data-section="summary-description"]');
  await description.locator(".ui-section__header").click();
  await description.locator(".project-short-summary").fill("Shared summary save check");
  await description.getByRole("button", {name: "Save", exact: true}).click();
  await expect(description.locator(".project-summary-message")).toContainText("Saved");
  await page.screenshot({path: testInfo.outputPath("summary.png"), fullPage: true});
});

test("empty section bodies share geometry and tooltip help does not cover the tree while browsing", async ({page}, testInfo) => {
  const response = await page.request.post("/api/workshop", {headers: {origin: "http://127.0.0.1:4173"}, data: {entity: "use", expectedRevision: null, expectedFamilyRevision: 1, record: {id: crypto.randomUUID(), project_id: "launcher", family_id: "f-resistor", product_id: null, tree_node_id: null, purpose: "Test resistor", quantity: 1, unit: "pcs", field_values: {}, notes: ""}}});
  expect(response.ok(), await response.text()).toBe(true);
  const {record} = await response.json();
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
  await expect(history.getByText("Entry type", {exact: true})).toBeVisible();
  await history.getByRole("button", {name: "Cancel", exact: true}).click();
  const tree = page.locator("#launcher [data-assembly-tree]");
  const row = tree.locator(".assembly-node").first();
  await row.hover();
  await expect(page.locator("#bs-global-tooltip")).toBeHidden();
  expect(await row.getAttribute("title")).toBeNull();
  const help = tree.getByRole("button", {name: "Reordering the feature tree", exact: true});
  await help.focus();
  await expect(tree.getByRole("tooltip")).toBeVisible();
  await help.press("Escape");
  await expect(tree.getByRole("tooltip")).toBeHidden();
  await page.screenshot({path: testInfo.outputPath("standard-empty-sections.png"), fullPage: true});
});

test("Account is reachable from the shared Workshop header", async ({page}) => {
  await page.goto("/workshop.html");
  await page.locator(".ui-site-account").click();
  await expect(page.locator(".project-account-dialog")).toBeVisible();
  await expect(page).not.toHaveURL(/account=1/);
});
