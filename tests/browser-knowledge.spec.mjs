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

async function createTileFromFamily(page, title) {
  await page.goto("/workshop.html?family=f-buck-converter");
  await expect(page.locator("#workshop-detail").getByRole("heading", {name: "Knowledge (0)", exact: true})).toBeVisible();
  await page.getByRole("link", {name: "New knowledge tile for this family", exact: true}).click();
  await expect(page).toHaveURL(/knowledge\.html\?new=1&family=f-buck-converter/);
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
  await detail(page).getByRole("button", {name: "Add link to a Workshop family", exact: true}).click();
  const dialog = page.locator("#knowledge-dialog");
  await dialog.getByLabel("Find a Workshop family", {exact: true}).fill("DC power");
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
