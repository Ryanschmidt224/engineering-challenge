// Real Worker/D1/R2 handlers with disposable fixtures. No production credentials.
import {test,expect} from "@playwright/test";
import {createReadStream} from "node:fs";
import {createInterface} from "node:readline";
import {verifyWorkshopBackup} from "../scripts/workshop-backup.mjs";

test.describe.configure({mode:"serial"});
test.beforeEach(async({request,context})=>{
 const response=await request.post("/__test__/reset");const {cookie}=await response.json();const separator=cookie.indexOf("=");
 await context.addCookies([{name:cookie.slice(0,separator),value:cookie.slice(separator+1),url:"http://127.0.0.1:4173",httpOnly:true,sameSite:"Strict"}]);
});
const detail=page=>page.locator("#workshop-detail");
async function save(page,entity){await page.getByRole("button",{name:"Save "+entity,exact:true}).click();await expect(page.locator("#workshop-status")).toHaveText("Saved.");await expect(detail(page).getByRole("button",{name:"Edit "+entity,exact:true})).toBeVisible();}
async function snapshot(page){const response=await page.request.get("/api/workshop");expect(response.ok()).toBe(true);return response.json();}
async function post(page,entity,record,expectedRevision=null){const response=await page.request.post("/api/workshop",{headers:{origin:"http://127.0.0.1:4173"},data:{entity,record,expectedRevision,expectedFamilyRevision:1}});expect(response.ok(),await response.text()).toBe(true);return (await response.json()).record;}
const productRecord=()=>({id:crypto.randomUUID(),family_id:"f-resistor",name:"Example 10k resistor",manufacturer:"Example",mpn:"EX-10K",field_values:{"f-resistor-resistance":10000},supplier_links:[],notes:""});

test("family and name-only product work without templates, stock or a manufacturer number",async({page},testInfo)=>{
 await page.goto("/workshop.html");await expect(page.locator("#family-list .family-card")).toHaveCount(60);
 await page.getByRole("button",{name:"Add family",exact:true}).click();await page.getByLabel("Family name",{exact:true}).fill("Bench fixture");await save(page,"family");
 await page.getByRole("button",{name:"Add product",exact:true}).click();await page.getByLabel("Product name",{exact:true}).fill("Fixture prototype");await save(page,"product");
 await expect(detail(page)).not.toContainText(/Inventory|In stock|Master template|Product Builder/);
 const data=await snapshot(page);expect(data.products).toHaveLength(1);expect(data.products[0].mpn).toBe("");expect(data.uses).toHaveLength(0);await page.screenshot({path:testInfo.outputPath("workshop-desktop.png"),fullPage:true});
});
test("generic use opens its project; selecting and editing a product preserves requirements and instructions",async({page})=>{
 await page.goto("/workshop.html?family=f-resistor&project=launcher&return=%23launcher");
 await page.getByRole("button",{name:"Use in a project",exact:true}).click();
 await page.getByLabel("Purpose / project name",{exact:true}).fill("Hall input pull-up");await page.getByLabel("Resistance (Ω)",{exact:true}).fill("10000");await page.getByLabel("Power rating (W)",{exact:true}).fill("0.25");await page.getByLabel("Quantity",{exact:true}).fill("2");await save(page,"use");
 const use=(await snapshot(page)).uses[0];await page.getByRole("link",{name:"Open project part",exact:true}).click();
 const workspace=page.locator("#launcher .bom-part-workspace");await expect(workspace.getByRole("heading",{name:"Hall input pull-up",exact:true})).toBeVisible();
 await expect(workspace).not.toContainText("Part not found");await workspace.getByText("Part details",{exact:true}).click();
 const product=await post(page,"product",productRecord());
 await workspace.getByRole("button",{name:"Edit project use",exact:true}).click();await expect(page.getByLabel("Purpose / project name",{exact:true})).toHaveValue("Hall input pull-up");
 const recipe=[{id:"measure",title:"Measure before installing",tileOrder:[]}];const response=await page.request.put("/api/workspace?project=launcher&part="+use.id,{headers:{origin:"http://127.0.0.1:4173"},data:{recipe,expectedRevision:null}});expect(response.ok()).toBe(true);
 await page.getByLabel("Selected product",{exact:true}).selectOption(product.id);await save(page,"use");
 product.field_values["f-resistor-resistance"]=12000;await post(page,"product",product,1);await page.reload();
 await expect(detail(page)).toContainText("12000");await expect(detail(page)).toContainText("Project requirement: 10000 Ω");
 const stored=await snapshot(page);expect(stored.uses[0].field_values["f-resistor-resistance"]).toBe(10000);
 const instructions=await(await page.request.get("/api/workspace?project=launcher&part="+use.id)).json();expect(instructions.workspace.recipe[0].title).toBe("Measure before installing");
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
 await page.getByRole("button",{name:"Edit family",exact:true}).click();let definition=page.locator('[data-field-id="f-resistor-resistance"]');
 await definition.getByLabel("Field label",{exact:true}).fill("Resistance at test temperature");await definition.getByRole("button",{name:"Move down",exact:true}).click();await save(page,"family");
 await page.getByRole("button",{name:"Edit family",exact:true}).click();definition=page.locator('[data-field-id="f-resistor-resistance"]');await definition.getByRole("button",{name:"Hide field",exact:true}).click();await save(page,"family");
 let data=await snapshot(page);expect(data.products[0].field_values["f-resistor-resistance"]).toBe(10000);expect(data.fields.find(field=>field.id==="f-resistor-resistance").hidden).toBe(1);
 await page.getByRole("button",{name:"Duplicate family",exact:true}).click();await save(page,"family");data=await snapshot(page);
 const duplicate=data.families.find(family=>family.name==="Resistor copy");expect(data.fields.filter(field=>field.family_id===duplicate.id)).toHaveLength(4);expect(data.products.filter(record=>record.family_id===duplicate.id)).toHaveLength(0);expect(data.products[0].id).toBe(product.id);
});
test("multiple documents export with verified bytes and archiving stays reversible",async({page})=>{
 await page.goto("/workshop.html?family=f-resistor");await page.getByRole("button",{name:"Edit family",exact:true}).click();
 await page.locator('input[type="file"]').setInputFiles([{name:"datasheet.pdf",mimeType:"application/pdf",buffer:Buffer.from("%PDF-1.7\nfixture")},{name:"pinout.txt",mimeType:"text/plain",buffer:Buffer.from("Pin 1: input")}]);
 await expect(page.locator("#workshop-status")).toHaveText("Files uploaded.");await expect(detail(page).getByRole("link",{name:"datasheet.pdf",exact:true})).toBeVisible();await expect(detail(page).getByRole("link",{name:"pinout.txt",exact:true})).toBeVisible();
 await page.getByRole("button",{name:"Cancel",exact:true}).click();const downloadPromise=page.waitForEvent("download");await page.getByRole("button",{name:"Export Workshop",exact:true}).click();const download=await downloadPromise;
 const result=await verifyWorkshopBackup(createInterface({input:createReadStream(await download.path()),crlfDelay:Infinity}));expect(result.fileCount).toBe(2);expect(result.catalog.attachments).toHaveLength(2);
 page.once("dialog",dialog=>dialog.accept());await page.getByRole("button",{name:"Archive family",exact:true}).click();await expect(page.locator("#workshop-status")).toContainText("Archived.");await page.getByLabel("Show archived",{exact:true}).check();
 page.once("dialog",dialog=>dialog.accept());await page.getByRole("button",{name:"Restore family",exact:true}).click();await expect(page.locator("#workshop-status")).toHaveText("Restored.");
});
test("phone layout and keyboard category actions remain usable; failed saves preserve input",async({page},testInfo)=>{
 await page.setViewportSize({width:390,height:844});await page.goto("/workshop.html");await page.locator("#category-tree button.category-button").filter({hasText:"Electronics"}).press("Shift+F10");await page.getByRole("menuitem",{name:"Add family",exact:true}).click();
 await page.getByLabel("Family name",{exact:true}).fill("Draft after network failure");
 await page.route("**/api/workshop",route=>route.request().method()==="POST"?route.fulfill({status:503,json:{error:"Temporary storage failure"}}):route.continue());
 await page.getByRole("button",{name:"Save family",exact:true}).click();await expect(page.locator("#workshop-status")).toContainText("Temporary storage failure");await expect(page.getByLabel("Family name",{exact:true})).toHaveValue("Draft after network failure");
 await page.unroute("**/api/workshop");await save(page,"family");
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath("workshop-phone.png"),fullPage:true});
});
