// Real Worker/D1 handlers with disposable fixtures. No production credentials.
import {test, expect} from "@playwright/test";

test.describe.configure({mode: "serial"});
test.beforeEach(async ({request, context}) => {
  const response = await request.post("/__test__/reset");
  const {cookie} = await response.json();
  const separator = cookie.indexOf("=");
  await context.addCookies([
    {name: cookie.slice(0, separator), value: cookie.slice(separator + 1), url: "http://127.0.0.1:4173", httpOnly: true, sameSite: "Strict"},
  ]);
});

const detail = (page) => page.locator("#knowledge-detail");

async function expectStackedCard(card) {
  await expect(card).toBeVisible();
  const layout = await card.evaluate(element => {
    const children = [...element.children].map(child => child.getBoundingClientRect());
    const box = element.getBoundingClientRect();
    return {display: getComputedStyle(element).display, width: box.width, children: children.map(child => ({x: child.x, y: child.y, width: child.width, bottom: child.bottom}))};
  });
  expect(layout.display).toBe("block");
  for (const child of layout.children) expect(child.width).toBeGreaterThan(layout.width * 0.75);
  for (let i = 1; i < layout.children.length; i++) expect(layout.children[i].y).toBeGreaterThanOrEqual(layout.children[i - 1].bottom);
}

async function expectHeaderLabels(page) {
  const links = page.locator(".ui-site-nav a");
  const layout = await links.evaluateAll(elements => elements.map(element => {
    const box = element.getBoundingClientRect();
    return {whiteSpace: getComputedStyle(element).whiteSpace, left: box.left, right: box.right, viewport: document.documentElement.clientWidth};
  }));
  expect(layout).toHaveLength(4);
  for (const link of layout) {
    expect(link.whiteSpace).toBe("nowrap");
    expect(link.left).toBeGreaterThanOrEqual(0);
    expect(link.right).toBeLessThanOrEqual(link.viewport);
  }
}

for (const width of [1440, 390]) test("selectable Knowledge and Workshop cards stack at " + width + "px", async ({page}, testInfo) => {
  await page.setViewportSize({width, height: 900});
  await createTileFromFamily(page, "A long engineering lesson title that needs the full list width");
  const card = page.locator("#tile-list > button").first();
  await expectStackedCard(card);
  await expectHeaderLabels(page);
  await page.keyboard.press("Tab");
  await card.focus();
  await expect(card).toBeFocused();
  await expect(card).toHaveCSS("outline-style", "solid");
  await card.press("Enter");
  await expect(detail(page).getByRole("heading", {name: "A long engineering lesson title that needs the full list width", exact: true})).toBeVisible();
  await page.screenshot({path: testInfo.outputPath("knowledge-cards.png"), fullPage: true});
  await page.goto("/workshop.html?family=f-buck-converter");
  const family = page.locator("#family-list > button.is-selected");
  await expectStackedCard(family);
  await expectHeaderLabels(page);
  await family.focus();
  await expect(family).toBeFocused();
  await family.press("Enter");
  await expect(page.locator("#workshop-detail").getByRole("heading", {name: "Knowledge (1)", exact: true})).toBeVisible();
  await expectStackedCard(page.locator("#workshop-detail .knowledge-list > a").first());
  await page.screenshot({path: testInfo.outputPath("workshop-cards.png"), fullPage: true});
});

async function createTileFromFamily(page, title) {
  await page.goto("/workshop.html?family=f-buck-converter");
  await expect(page.locator("#workshop-detail").getByRole("heading", {name: "Knowledge (0)", exact: true})).toBeVisible();
  await page.getByRole("link", {name: "New knowledge tile for this family", exact: true}).click();
  await expect(page).toHaveURL(/knowledge\.html\?new=1&link=family:f-buck-converter/);
  await page.getByLabel("Title", {exact: true}).fill(title);
  await page.getByLabel("Summary", {exact: true}).fill("Switching 24 V on through a switch can ring above the converter's rating.");
  await page.getByRole("button", {name: "Save tile", exact: true}).click();
  await expect(page.locator("#knowledge-status")).toHaveText("Saved.");
}

test("a tile started from a family is linked to it and shows on the family page", async ({page}) => {
  await createTileFromFamily(page, "Hot-plug ringing");
  await expect(detail(page).getByRole("heading", {name: "Hot-plug ringing", exact: true})).toBeVisible();
  await expect(detail(page).getByText("Draft", {exact: true})).toBeVisible();
  await expect(detail(page).getByRole("heading", {name: "Links (1)", exact: true})).toBeVisible();
  await detail(page).getByRole("link", {name: "Buck converter", exact: true}).click();

  await expect(page).toHaveURL(/workshop\.html\?family=f-buck-converter/);
  const workshop = page.locator("#workshop-detail");
  await expect(workshop.getByRole("heading", {name: "Knowledge (1)", exact: true})).toBeVisible();
  await workshop.getByRole("link", {name: /Hot-plug ringing/}).click();
  await expect(detail(page).getByRole("heading", {name: "Hot-plug ringing", exact: true})).toBeVisible();
});

test("adding and removing a link from the tile page; archive keeps links", async ({page}) => {
  await createTileFromFamily(page, "Inrush current");
  page.on("dialog", (dialog) => dialog.accept());
  await detail(page).getByRole("button", {name: "Add link", exact: true}).click();
  const dialog = page.locator("#knowledge-dialog");
  await dialog.getByLabel("Search", {exact: true}).fill("DC power");
  await dialog.getByRole("button", {name: "DC power supply", exact: true}).click();
  await dialog.getByRole("button", {name: "Add link", exact: true}).click();
  await expect(detail(page).getByRole("heading", {name: "Links (2)", exact: true})).toBeVisible();

  await detail(page).getByRole("button", {name: "Remove link", exact: true}).last().click();
  await expect(detail(page).getByRole("heading", {name: "Links (1)", exact: true})).toBeVisible();

  await detail(page).getByRole("button", {name: "Archive tile", exact: true}).click();
  await expect(page.locator("#knowledge-status")).toHaveText("Archived.");
  const data = await (await page.request.get("/api/knowledge")).json();
  expect(data.tiles[0].archived).toBe(1);
  expect(data.links.filter((link) => !link.archived)).toHaveLength(1);
});

test("a stale second tab is refused and keeps its draft", async ({page, context}) => {
  await createTileFromFamily(page, "Measuring inrush");
  const id = new URL(page.url()).searchParams.get("tile");
  const second = await context.newPage();
  await second.goto("/knowledge.html?tile=" + id);
  await second.locator("#knowledge-detail").getByRole("button", {name: "Edit tile", exact: true}).click();

  await detail(page).getByRole("button", {name: "Edit tile", exact: true}).click();
  await page.getByLabel("Summary", {exact: true}).fill("Saved first.");
  await page.getByRole("button", {name: "Save tile", exact: true}).click();
  await expect(page.locator("#knowledge-status")).toHaveText("Saved.");

  await second.getByLabel("Summary", {exact: true}).fill("Saved second, from an old copy.");
  await second.getByRole("button", {name: "Save tile", exact: true}).click();
  await expect(second.locator("#knowledge-status")).toContainText("another tab");
  await expect(second.getByLabel("Summary", {exact: true})).toHaveValue("Saved second, from an old copy.");
});

test("Knowledge has no horizontal overflow on a phone", async ({page}) => {
  await createTileFromFamily(page, "A long title that should wrap neatly on a narrow phone screen without overflowing");
  await page.setViewportSize({width: 390, height: 844});
  await page.reload();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

const origin = "http://127.0.0.1:4173";
async function api(page, path, data, method = "POST") {
  const response = await page.request.fetch(path, {method, headers: {origin}, data});
  expect(response.ok(), await response.text()).toBe(true);
  return response.json();
}
async function tileFor(page, title, target_type, target_id) {
  const id = crypto.randomUUID();
  await api(page, "/api/knowledge", {entity: "tile", expectedRevision: null, record: {id, type: "concept", status: "draft", title, summary: title + " summary.", body: "", sources: []}});
  await api(page, "/api/knowledge", {entity: "link", expectedRevision: null, record: {id: crypto.randomUUID(), tile_id: id, target_type, target_id, relation: "applies_to", note: ""}});
  return id;
}

test("products and project parts show knowledge from their family, and tiles link between each other", async ({page}) => {
  await page.goto("/workshop.html");
  const product = {id: crypto.randomUUID(), family_id: "f-buck-converter", name: "Test buck module", manufacturer: "", mpn: "", supplier_links: [], notes: "", field_values: {}};
  await api(page, "/api/workshop", {entity: "product", record: product, expectedRevision: null, expectedFamilyRevision: 1});
  const use = {id: crypto.randomUUID(), project_id: "launcher", tree_node_id: null, family_id: "f-buck-converter", product_id: product.id, purpose: "Logic supply", quantity: 1, unit: "pcs", field_values: {}, notes: ""};
  await api(page, "/api/workshop", {entity: "use", record: use, expectedRevision: null, expectedFamilyRevision: 1});
  await tileFor(page, "Hot-plug ringing", "family", "f-buck-converter");
  await tileFor(page, "Module input limits", "product", product.id);

  await page.goto("/workshop.html?product=" + product.id);
  const workshop = page.locator("#workshop-detail");
  await expect(workshop.getByRole("heading", {name: "Knowledge (2)", exact: true})).toBeVisible();
  await expect(workshop.getByRole("link", {name: /Hot-plug ringing.*via family/})).toBeVisible();

  await page.goto("/index.html#launcher/part/" + use.id);
  const workspace = page.locator("#launcher .bom-part-workspace");
  await workspace.getByText("Part details", {exact: true}).click();
  await expect(workspace.getByText("Knowledge (2)", {exact: true})).toBeVisible();
  // The part page may re-render once its data arrives; follow the link's target
  // rather than racing that re-render with a click.
  const tileLink = workspace.getByRole("link", {name: "Hot-plug ringing", exact: true});
  await expect(tileLink).toHaveAttribute("href", /knowledge\.html\?tile=/);
  await page.goto("/" + (await tileLink.getAttribute("href")));
  await expect(detail(page).getByRole("heading", {name: "Hot-plug ringing", exact: true})).toBeVisible();

  // Link this tile to the other tile; the other tile lists it under "Linked from".
  page.on("dialog", (dialog) => dialog.accept());
  await detail(page).getByRole("button", {name: "Add link", exact: true}).click();
  const dialog = page.locator("#knowledge-dialog");
  await dialog.getByLabel("Link to", {exact: true}).selectOption("tile");
  await dialog.getByRole("button", {name: "Module input limits", exact: true}).click();
  await dialog.getByLabel("Relation", {exact: true}).selectOption("see_also");
  await dialog.getByRole("button", {name: "Add link", exact: true}).click();
  await expect(detail(page).getByRole("heading", {name: "Links (2)", exact: true})).toBeVisible();
  await detail(page).getByRole("link", {name: "Module input limits", exact: true}).click();
  await expect(detail(page).getByRole("heading", {name: "Linked from (1)", exact: true})).toBeVisible();
});

test("a tile can be started from a project part and links to it", async ({page}) => {
  await page.goto("/workshop.html");
  const use = {id: crypto.randomUUID(), project_id: "launcher", tree_node_id: null, family_id: "f-resistor", product_id: null, purpose: "Pull-up", quantity: 1, unit: "pcs", field_values: {}, notes: ""};
  await api(page, "/api/workshop", {entity: "use", record: use, expectedRevision: null, expectedFamilyRevision: 1});
  await page.goto("/knowledge.html?new=1&link=use:" + use.id);
  await page.getByLabel("Title", {exact: true}).fill("Choosing pull-up values");
  await page.getByLabel("Summary", {exact: true}).fill("Why 10 k was used here.");
  await page.getByRole("button", {name: "Save tile", exact: true}).click();
  await expect(page.locator("#knowledge-status")).toHaveText("Saved.");
  await expect(detail(page).getByText(/Applies to project part:/)).toBeVisible();
  await expect(detail(page).getByRole("link", {name: "Pull-up", exact: true})).toHaveAttribute("href", "index.html#launcher/part/" + use.id);
});

for (const width of [1440, 390]) test("Knowledge opens the exact project record, including archived and missing records, at " + width + "px", async ({page}, testInfo) => {
  await page.setViewportSize({width, height: 900});
  const created = await api(page, "/api/investigations?project=launcher", {
    action: "create", expectedRevision: null, scope: "assembly", ownerType: "assembly", ownerId: "__root__",
    category: "failure", title: "MCU power-on failure", entries: [{type: "observation", text: "The MCU failed immediately after switching on 24 V.", date: "2026-11-22", files: []}],
  });
  const id = crypto.randomUUID();
  await api(page, "/api/knowledge", {entity: "tile", expectedRevision: null, record: {id, type: "lesson", status: "draft", title: "Power-on lesson", summary: "An unconfirmed cause needs a measurement.", body: "", sources: []}});
  await api(page, "/api/knowledge", {entity: "link", expectedRevision: null, record: {id: crypto.randomUUID(), tile_id: id, target_type: "record", target_id: created.createdId, target_project_id: "launcher", relation: "see_also", note: ""}});
  await page.goto("/knowledge.html?tile=" + id);
  await detail(page).getByRole("link", {name: "MCU power-on failure", exact: true}).click();
  const reader = page.getByRole("dialog", {name: "MCU power-on failure", exact: true});
  await expect(reader).toBeVisible();
  await expect(reader.getByText("The MCU failed immediately after switching on 24 V.", {exact: true})).toBeVisible();
  await expect(reader.getByRole("button", {name: /Edit|Save|Archive/})).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp("record=" + created.createdId + "#launcher$"));
  await page.reload();
  await expect(reader).toBeVisible();
  await page.screenshot({path: testInfo.outputPath("linked-record.png")});
  expect(await reader.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(0);
  await reader.getByRole("button", {name: "Close", exact: true}).click();
  await expect(page).not.toHaveURL(/record=/);

  const archived = await api(page, "/api/investigations?project=launcher", {action: "archiveRecord", id: created.createdId, expectedRevision: created.revision, note: "Retained as evidence."});
  await page.goto("/knowledge.html?tile=" + id);
  await expect(detail(page).getByText(/\(archived\)/)).toBeVisible();
  await detail(page).getByRole("link", {name: "MCU power-on failure", exact: true}).click();
  await expect(reader.getByText("Failures · Archived", {exact: true})).toBeVisible();
  await expect(reader.getByText("Archive reason: Retained as evidence.", {exact: true})).toBeVisible();
  await reader.getByRole("button", {name: "Close", exact: true}).click();

  await api(page, "/api/investigations?project=launcher", {action: "deleteRecord", id: created.createdId, expectedRevision: archived.revision});
  await page.goto("/knowledge.html?tile=" + id);
  await expect(detail(page).getByText(/no longer exists; last known name/)).toBeVisible();
  await expect(detail(page).locator("a.link-target")).not.toHaveAttribute("href");
  await page.goto("/index.html?record=" + created.createdId + "#launcher");
  await expect(page.getByRole("dialog", {name: "Record unavailable", exact: true})).toContainText("no longer exists");
});
