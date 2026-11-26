// Real Worker/D1 handlers with disposable fixtures. No production credentials.
import {test, expect} from "@playwright/test";

test.describe.configure({mode: "serial"});
test.beforeEach(async ({request, context}) => {
  const response = await request.post("/__test__/reset?engine=1");
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
  expect(layout).toHaveLength(3);
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
  await expect(page.locator("#workshop-detail").getByRole("heading", {name: "Info Bits (1)", exact: true})).toBeVisible();
  await expectStackedCard(page.locator("#workshop-detail .knowledge-list > a").first());
  await page.screenshot({path: testInfo.outputPath("workshop-cards.png"), fullPage: true});
});

async function createTileFromFamily(page, title) {
  await page.goto("/workshop.html?family=f-buck-converter");
  await expect(page.locator("#workshop-detail").getByRole("heading", {name: "Info Bits (0)", exact: true})).toBeVisible();
  await page.getByRole("link", {name: "New information tile for this family", exact: true}).click();
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
  await expect(workshop.getByRole("heading", {name: "Info Bits (1)", exact: true})).toBeVisible();
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

test('Info Bits links to current project parts and exact records without legacy APIs',async({page,context})=>{
 const project=crypto.randomUUID(),origin='http://127.0.0.1:4173',base='/api/project-engine/projects/'+project;
 let revision=null;
 const post=async(path,value)=>{const response=await context.request.post(path,{headers:{origin},data:{...value,operationId:crypto.randomUUID(),expectedRevision:revision}});expect(response.ok(),await response.text()).toBe(true);const data=await response.json();if(data.revision)revision=data.revision;return data;};
 await post(base,{name:'Linked project'});const item=await post(base+'/items',{details:{name:'Bench module'}});
 await post(base+'/items/'+item.itemId+'/records',{record:{type:'note',title:'Bench evidence',fields:{text:'Verified result'}}});
 const tile=crypto.randomUUID(),saved=await context.request.post('/api/knowledge',{headers:{origin},data:{entity:'tile',expectedRevision:null,record:{id:tile,title:'Linked lesson',summary:'A current project result',body:'',sources:[],type:'lesson',status:'draft'}}});expect(saved.ok(),await saved.text()).toBe(true);
 const retired=[];page.on('request',r=>{if(['/api/projects','/api/investigations','/api/components'].includes(new URL(r.url()).pathname))retired.push(r.url());});
 await page.goto('/knowledge.html?tile='+tile);await page.getByRole('button',{name:'Add link',exact:true}).click();
 await page.getByLabel('Link to',{exact:true}).selectOption('record');await page.getByLabel('Project',{exact:true}).selectOption(project);await page.getByRole('dialog').getByRole('button',{name:'Bench evidence',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Add link',exact:true}).click();
 await expect(page.getByRole('dialog')).not.toBeVisible();const link=page.locator('#knowledge-detail').getByRole('link',{name:'Bench evidence',exact:true});await expect(link).toHaveAttribute('href',new RegExp('project.html\\?project='+project));await link.click();
 await expect(page).toHaveURL(new RegExp('item='+item.itemId));await expect(page.locator('[data-record-id]').filter({hasText:'Verified result'}).first()).toBeVisible();expect(retired).toEqual([]);
});
