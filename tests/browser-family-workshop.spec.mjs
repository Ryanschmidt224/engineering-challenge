// Real Worker/D1/R2 handlers with disposable fixtures. No production credentials.
import {test,expect} from "@playwright/test";
import {createReadStream,readFileSync} from "node:fs";
import {createInterface} from "node:readline";
import {verifyWorkshopBackup} from "../scripts/workshop-backup.mjs";

test.describe.configure({mode:"serial"});
test.beforeEach(async({request,context})=>{
 const response=await request.post("/__test__/reset");const {cookie}=await response.json();const separator=cookie.indexOf("=");
 await context.addCookies([{name:cookie.slice(0,separator),value:cookie.slice(separator+1),url:"http://127.0.0.1:4173",httpOnly:true,sameSite:"Strict"}]);
});
const detail=page=>page.locator("#workshop-detail");
async function save(page,entity){await page.getByRole("button",{name:"Save "+entity,exact:true}).click();await expect(page.locator("#workshop-status")).toHaveText("Saved.");await expect(detail(page).getByRole("button",{name:entity==="family"?"Edit template":"Edit "+entity,exact:true})).toBeVisible();}
async function snapshot(page){const response=await page.request.get("/api/workshop");expect(response.ok()).toBe(true);return response.json();}
async function post(page,entity,record,expectedRevision=null){const response=await page.request.post("/api/workshop",{headers:{origin:"http://127.0.0.1:4173"},data:{entity,record,expectedRevision,expectedFamilyRevision:(await snapshot(page)).families.find(f=>f.id===record.family_id)?.revision}});expect(response.ok(),await response.text()).toBe(true);return (await response.json()).record;}
const productRecord=()=>({id:crypto.randomUUID(),family_id:"f-resistor",name:"Example 10k resistor",manufacturer:"Example",mpn:"EX-10K",field_values:{"f-resistor-resistance":10000},supplier_links:[],notes:""});

test("family and name-only product work without templates, stock or a manufacturer number",async({page},testInfo)=>{
 await page.goto("/workshop.html");await expect(page.locator("#family-list .family-card")).toHaveCount(60);
 await page.getByRole("button",{name:"Add family",exact:true}).click();await page.getByLabel("Family name",{exact:true}).fill("Bench fixture");await save(page,"family");
 await page.getByRole("button",{name:"Add product",exact:true}).click();await page.getByLabel("Product name",{exact:true}).fill("Fixture prototype");await save(page,"product");
 await expect(detail(page)).not.toContainText(/Inventory|In stock|Master template|Product Builder/);
 const data=await snapshot(page);expect(data.products).toHaveLength(1);expect(data.products[0].mpn).toBe("");expect(data.uses).toHaveLength(0);await page.screenshot({path:testInfo.outputPath("workshop-desktop.png"),fullPage:true});
});
test("two tabs reject stale product saves and keep the losing draft",async({page,context})=>{
 const product=await post(page,"product",productRecord()),other=await context.newPage();
 for(const tab of [page,other]){await tab.goto("/workshop.html?product="+product.id);await tab.getByRole("button",{name:"Edit product",exact:true}).click();}
 await page.getByLabel("Product name",{exact:true}).fill("Saved in first tab");await save(page,"product");
 await other.getByLabel("Product name",{exact:true}).fill("Unsaved second tab draft");await other.getByRole("button",{name:"Save product",exact:true}).click();
 await expect(other.locator("#workshop-status")).toContainText("changed in another tab");await expect(other.getByLabel("Product name",{exact:true})).toHaveValue("Unsaved second tab draft");
 expect((await snapshot(page)).products[0].name).toBe("Saved in first tab");await other.close({runBeforeUnload:false});
});
test("field renaming, reordering, hiding and duplication retain values by stable ID",async({page})=>{
 const product=await post(page,"product",productRecord());await page.goto("/workshop.html?family=f-resistor");
 await page.getByRole("button",{name:"Edit template",exact:true}).click();let definition=page.locator('[data-field-id="f-resistor-resistance"]');
 await definition.getByLabel("Field label",{exact:true}).fill("Resistance at test temperature");await definition.getByRole("button",{name:"Move down",exact:true}).click();await save(page,"family");
 await page.getByRole("button",{name:"Edit template",exact:true}).click();definition=page.locator('[data-field-id="f-resistor-resistance"]');await definition.getByRole("button",{name:"Hide field",exact:true}).click();await save(page,"family");
 let data=await snapshot(page);expect(data.products[0].field_values["f-resistor-resistance"]).toBe(10000);expect(data.fields.find(field=>field.id==="f-resistor-resistance").hidden).toBe(1);
 await page.getByRole("button",{name:"Duplicate family",exact:true}).click();await save(page,"family");data=await snapshot(page);
 const duplicate=data.families.find(family=>family.name==="Resistor copy");expect(data.fields.filter(field=>field.family_id===duplicate.id)).toHaveLength(10);expect(data.products.filter(record=>record.family_id===duplicate.id)).toHaveLength(0);expect(data.products[0].id).toBe(product.id);
});
test("multiple documents export with verified bytes and archiving stays reversible",async({page},testInfo)=>{
 await page.goto("/workshop.html?family=f-resistor");await page.getByRole("button",{name:"Edit template",exact:true}).click();
 await page.locator('input[type="file"]').setInputFiles([{name:"datasheet.pdf",mimeType:"application/pdf",buffer:Buffer.from("%PDF-1.7\nfixture")},{name:"pinout.txt",mimeType:"text/plain",buffer:Buffer.from("Pin 1: input")}]);
 await expect(page.locator("#workshop-status")).toHaveText("Files uploaded.");await expect(detail(page).getByRole("link",{name:"datasheet.pdf",exact:true})).toBeVisible();await expect(detail(page).getByRole("link",{name:"pinout.txt",exact:true})).toBeVisible();
 await page.getByRole("button",{name:"Cancel",exact:true}).click();const downloadPromise=page.waitForEvent("download");await page.getByRole("button",{name:"Export Workshop",exact:true}).click();const download=await downloadPromise;
 const result=await verifyWorkshopBackup(createInterface({input:createReadStream(await download.path()),crlfDelay:Infinity}));expect(result.fileCount).toBe(2);expect(result.catalog.attachments).toHaveLength(2);
 const activeProduct=await post(page,"product",productRecord()),archivedProduct=await post(page,"product",{...productRecord(),id:crypto.randomUUID(),name:"Already archived"});const archived=await page.request.patch("/api/workshop",{headers:{origin:"http://127.0.0.1:4173"},data:{entity:"product",id:archivedProduct.id,expectedRevision:archivedProduct.revision,archived:true}});expect(archived.ok()).toBe(true);
 const before=await snapshot(page);await page.getByRole("button",{name:"Archive family",exact:true}).click();const confirmation=page.getByRole("dialog",{name:'Archive “Resistor”?',exact:true});await expect(confirmation).toBeVisible();await expect(confirmation).toContainText("This hides the family and all products within it from the active Workshop.");await expect(confirmation).toContainText("Products archived separately will remain archived.");await expect(confirmation.getByRole("button",{name:"Cancel",exact:true})).toBeFocused();expect(await snapshot(page)).toEqual(before);
 await confirmation.getByRole("button",{name:"Cancel",exact:true}).press("Enter");await expect(confirmation).not.toBeVisible();expect(await snapshot(page)).toEqual(before);
 await page.getByRole("button",{name:"Archive family",exact:true}).click();await confirmation.press("Escape");await expect(confirmation).not.toBeVisible();expect(await snapshot(page)).toEqual(before);
 await page.getByRole("button",{name:"Archive family",exact:true}).click();await page.screenshot({path:testInfo.outputPath("family-archive-confirmation.png"),fullPage:true});await confirmation.getByRole("button",{name:"Archive family",exact:true}).click();await expect(page.locator("#workshop-status")).toContainText("Archived.");const after=await snapshot(page);expect(after.families.find(f=>f.id==="f-resistor").archived).toBe(1);expect(after.products).toEqual(before.products);expect(after.attachments).toEqual(before.attachments);expect(after.fields).toEqual(before.fields);await page.getByLabel("Show archived",{exact:true}).check();
 await page.getByRole("button",{name:"Restore family",exact:true}).click();await page.getByRole("dialog").getByRole("button",{name:"Restore family",exact:true}).click();await expect(page.locator("#workshop-status")).toHaveText("Restored.");const restored=await snapshot(page);expect(restored.products.find(p=>p.id===activeProduct.id).archived).toBe(0);expect(restored.products.find(p=>p.id===archivedProduct.id).archived).toBe(1);
});
test("phone layout and keyboard category actions remain usable; failed saves preserve input",async({page},testInfo)=>{
 await page.setViewportSize({width:390,height:844});await page.goto("/workshop.html");await page.locator("#category-tree button.category-button").filter({hasText:"Electronics"}).press("Shift+F10");await page.getByRole("menuitem",{name:"Add family",exact:true}).click();
 await page.getByLabel("Family name",{exact:true}).fill("Draft after network failure");
 await page.route("**/api/workshop",route=>route.request().method()==="POST"?route.fulfill({status:503,json:{error:"Temporary storage failure"}}):route.continue());
 await page.getByRole("button",{name:"Save family",exact:true}).click();await expect(page.locator("#workshop-status")).toContainText("Temporary storage failure");await expect(page.getByLabel("Family name",{exact:true})).toHaveValue("Draft after network failure");
 await page.unroute("**/api/workshop");await save(page,"family");
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath("workshop-phone.png"),fullPage:true});
});

test("Workshop photo references use the shared unfilled corner pencil",async({page})=>{
 const response=await page.request.post("/api/workshop/file?owner=family&id=f-resistor",{headers:{origin:"http://127.0.0.1:4173","content-type":"image/png","x-file-name":"bench.png"},data:Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=","base64")});expect(response.ok(),await response.text()).toBe(true);await page.goto("/workshop.html?family=f-resistor");const photo=detail(page).getByRole("img",{name:"bench.png",exact:true}),pencil=detail(page).getByRole("button",{name:"Edit photo",exact:true});await expect(photo).toBeVisible();await expect(pencil).toBeVisible();await expect(pencil).toHaveCSS("background-color","rgba(0, 0, 0, 0)");await expect(detail(page).getByRole("button",{name:"Archive reference",exact:true})).not.toBeVisible();await pencil.click();await detail(page).locator(".bs-photo-more").getByRole("button",{name:"Edit template",exact:true}).click();await pencil.click();await detail(page).getByRole("button",{name:"Archive reference",exact:true}).click();await expect(photo).toHaveCount(0);expect((await snapshot(page)).attachments.find(file=>file.title==="bench.png").archived).toBe(1);
});

for(const width of [390,1440])test("family fields start collapsed and products keep existing navigation at "+width,async({page},testInfo)=>{
 await page.setViewportSize({width,height:950});await post(page,"product",productRecord());await page.goto("/workshop.html?family=f-resistor");
 const group=detail(page).locator('[data-section="family-fields"]');await expect(group).not.toHaveAttribute("open");await expect(detail(page).getByRole("button",{name:"Example 10k resistor · EX-10K",exact:true})).toBeVisible();await expect(detail(page).getByRole("heading",{name:"About this family",exact:true})).not.toBeVisible();
 await group.locator(":scope > summary").click();await expect(detail(page).getByRole("heading",{name:"About this family",exact:true})).toBeVisible();await expect(group.getByRole("table",{name:"Family fields",exact:true})).toBeVisible();
 await detail(page).getByRole("button",{name:"Example 10k resistor · EX-10K",exact:true}).click();await detail(page).getByRole("button",{name:"Family: Resistor",exact:true}).click();await expect(group).not.toHaveAttribute("open");expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath("family-products-default.png"),fullPage:true});
});

for(const width of [390,1440])test("shared product confirmation is centered and cancelling preserves records at "+width,async({page},testInfo)=>{
 await page.setViewportSize({width,height:900});const product=await post(page,"product",productRecord());await page.goto("/workshop.html?family=f-resistor&product="+product.id);const before=await snapshot(page);await page.getByRole("button",{name:"Archive product",exact:true}).click();const modal=page.getByRole("dialog",{name:'Archive “Example 10k resistor”?',exact:true});await expect(modal).toBeVisible();await expect(modal.getByRole("button",{name:"Cancel",exact:true})).toBeFocused();await expect(modal).toContainText("Nothing is permanently deleted.");const box=await modal.boundingBox();expect(Math.abs(box.x+box.width/2-width/2)).toBeLessThan(2);expect(Math.abs(box.y+box.height/2-450)).toBeLessThan(2);expect(await snapshot(page)).toEqual(before);await page.screenshot({path:testInfo.outputPath("shared-confirmation.png"),fullPage:true});await modal.getByRole("button",{name:"Cancel",exact:true}).press("Enter");await expect(modal).not.toBeVisible();expect(await snapshot(page)).toEqual(before);await page.getByRole("button",{name:"Archive product",exact:true}).click();await modal.getByRole("button",{name:"Archive product",exact:true}).click();await expect(page.locator("#workshop-status")).toContainText("Archived.");
});

for(const width of [390,1440])test("compact product values keep source evidence accessible at "+width,async({page},testInfo)=>{
 await page.setViewportSize({width,height:950});
 const longValue="Through-hole precision package with a long manufacturer description ".repeat(4).trim();
 const product=await post(page,"product",{...productRecord(),field_values:{"f-resistor-resistance":10000,"f-resistor-power-rating":0.25,"f-resistor-package":longValue},supplier_links:[{supplier:"Example",part_number:"EX-10K",url:"https://example.com/product"}],lookup_provenance:{version:1,identityRequired:true,appliedAt:"2026-11-27T21:00:00Z",fields:{"f-resistor-resistance":{value:10000,label:"Resistance",unit:"Ω",conditions:"25°C",sourceUrl:"https://example.com/datasheet",document:{name:"resistor.pdf",sha256:"a".repeat(64)}}}}});
 await page.goto("/workshop.html?family=f-resistor&product="+product.id);
 const panels=detail(page).locator(".workshop-product-read");await expect(panels).toHaveCount(2);
 const value=panels.locator(".workshop-sourced-value"),source=value.locator("summary");
 await expect(source).toHaveText("AI source");await expect(value.locator("details")).not.toHaveAttribute("open");await expect(value.getByText("Conditions: 25°C",{exact:true})).not.toBeVisible();
 const textBox=await value.locator(":scope > span").boundingBox(),sourceBox=await source.boundingBox();expect(sourceBox.x).toBeGreaterThan(textBox.x+textBox.width);expect(Math.abs(sourceBox.y-textBox.y)).toBeLessThan(8);
 if(width===1440)expect((await value.boundingBox()).height).toBeLessThan(32);
 await source.focus();await source.press("Enter");await expect(value.getByText("Conditions: 25°C",{exact:true})).toBeVisible();if(width>640)expect(Math.abs((await value.locator("..").locator("dt").boundingBox()).y-(await value.boundingBox()).y)).toBeLessThan(3);await expect(value.getByRole("link",{name:"Source",exact:true})).toHaveAttribute("href","https://example.com/datasheet");await expect(value.getByText("Technical document: resistor.pdf",{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await source.press("Enter");await expect(value.locator("details")).not.toHaveAttribute("open");await expect(panels.getByText(longValue.trim(),{exact:true})).toBeVisible();
 const before=await snapshot(page);expect(before.products[0].field_values["f-resistor-package"]).toBe(longValue.trim());
 await panels.first().scrollIntoViewIfNeeded();await page.screenshot({path:testInfo.outputPath("compact-product-read.png"),fullPage:true});
});

const workshopPhoto={name:"bench.webp",mimeType:"image/webp",buffer:readFileSync(new URL("../assets/default-code-photo.webp",import.meta.url))};
for(const width of [390,1440])test("product photos are visible, save independently and survive reload at "+width,async({page},testInfo)=>{
 await page.setViewportSize({width,height:950});const product=await post(page,"product",productRecord());
 await page.goto("/workshop.html?product="+product.id);let photos=page.getByRole("region",{name:"Product photos",exact:true});
 await expect(photos.getByRole("button",{name:"+ Add photo",exact:true})).toBeVisible();
 await photos.getByRole("button",{name:"+ Add photo",exact:true}).click();await photos.locator('input[type="file"]').setInputFiles(workshopPhoto);
 await expect(page.locator("#workshop-status")).toHaveText("Photos saved.");await expect(photos.getByRole("img",{name:"bench.webp",exact:true})).toBeVisible();
 let state=await snapshot(page);expect(state.attachments).toHaveLength(1);expect(state.attachments[0]).toMatchObject({product_id:product.id,family_id:null,kind:"photo"});expect(state.products[0].revision).toBe(product.revision);
 await page.reload();await expect(photos.getByRole("img",{name:"bench.webp",exact:true})).toBeVisible();expect(await photos.locator("img").evaluate(image=>image.naturalWidth)).toBeGreaterThan(0);
 await page.getByRole("button",{name:"Edit product",exact:true}).click();await page.getByLabel("Product name",{exact:true}).fill("Still an unsaved draft");
 await photos.getByRole("button",{name:"+ Add photo",exact:true}).click();await photos.locator('input[type="file"]').setInputFiles({...workshopPhoto,name:"second.webp"});
 await expect(page.locator("#workshop-status")).toHaveText("Photos saved. Your other edits are still unsaved.");await expect(page.getByLabel("Product name",{exact:true})).toHaveValue("Still an unsaved draft");
 state=await snapshot(page);expect(state.products[0].name).toBe(product.name);expect(state.attachments).toHaveLength(2);
 await page.getByRole("button",{name:"Cancel",exact:true}).click();await page.getByRole("dialog").getByRole("button",{name:"Discard changes",exact:true}).click();
 await expect(photos.getByRole("img")).toHaveCount(2);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath("workshop-product-photos.png"),fullPage:true});
});
test("product photo retry after a committed lost response does not duplicate bytes or attachments",async({page})=>{
 const product=await post(page,"product",productRecord());await page.goto("/workshop.html?product="+product.id);const photos=page.getByRole("region",{name:"Product photos",exact:true});let uploads=0;const ids=[];
 await page.route("**/api/workshop/file?owner=product&*",async route=>{uploads++;ids.push(route.request().headers()["x-upload-id"]);if(uploads===1){await route.fetch();await route.abort("failed");}else await route.continue();});
 await photos.getByRole("button",{name:"+ Add photo",exact:true}).click();await photos.locator('input[type="file"]').setInputFiles(workshopPhoto);
 await expect(photos.getByRole("button",{name:"Retry upload",exact:true})).toBeVisible();expect((await snapshot(page)).attachments).toHaveLength(1);
 await photos.getByRole("button",{name:"Retry upload",exact:true}).click();await expect(page.locator("#workshop-status")).toHaveText("Photos saved.");expect((await snapshot(page)).attachments).toHaveLength(1);expect(uploads).toBe(2);expect(ids[0]).toBe(ids[1]);
});
test("product photo paste and drop work; a failed refresh retries only the list",async({page})=>{
 const product=await post(page,"product",productRecord());await page.goto("/workshop.html?product="+product.id);const photos=page.getByRole("region",{name:"Product photos",exact:true});let uploads=0,failRefresh=false;
 await page.route("**/api/workshop/file?owner=product&*",async route=>{uploads++;await route.continue();});
 await page.route("**/api/workshop",route=>route.request().method()==="GET"&&failRefresh?(failRefresh=false,route.fulfill({status:503,json:{error:"Temporary refresh failure"}})):route.continue());
 for(const [event,name] of [["drop","dropped.webp"],["paste","pasted.webp"]]){
  await photos.getByRole("button",{name:"+ Add photo",exact:true}).click();failRefresh=event==="drop";
  await photos.getByRole("textbox",{name:"Paste a copied photo",exact:true}).evaluate((box,{event,name,bytes})=>{const transfer=new DataTransfer();transfer.items.add(new File([new Uint8Array(bytes)],name,{type:"image/webp"}));box.dispatchEvent(event==="drop"?new DragEvent("drop",{bubbles:true,cancelable:true,dataTransfer:transfer}):new ClipboardEvent("paste",{bubbles:true,cancelable:true,clipboardData:transfer}));},{event,name,bytes:[...workshopPhoto.buffer]});
  if(event==="drop"){await expect(photos.getByRole("status")).toContainText("Photos saved, but the list could not refresh.");await photos.getByRole("button",{name:"Refresh photos",exact:true}).click();}
  await expect(photos.getByRole("img",{name,exact:true})).toBeVisible();
 }
 expect(uploads).toBe(2);expect((await snapshot(page)).attachments).toHaveLength(2);
 await photos.getByRole("button",{name:"Edit photo",exact:true}).first().click();await photos.getByRole("button",{name:"Archive photo",exact:true}).click();await page.getByRole("dialog").getByRole("button",{name:"Cancel",exact:true}).click();await expect(photos.getByRole("img")).toHaveCount(2);
 await photos.getByRole("button",{name:"Archive photo",exact:true}).click();await page.getByRole("dialog").getByRole("button",{name:"Archive photo",exact:true}).click();await expect(photos.getByRole("img")).toHaveCount(1);
});
