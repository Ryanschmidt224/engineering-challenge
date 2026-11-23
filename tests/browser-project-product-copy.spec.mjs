import {test,expect} from "@playwright/test";
test.describe.configure({mode:"serial"});
const origin="http://127.0.0.1:4173";
test.beforeEach(async({request,context})=>{const {cookie}=await(await request.post("/__test__/reset")).json(),at=cookie.indexOf("=");await context.addCookies([{name:cookie.slice(0,at),value:cookie.slice(at+1),url:origin,httpOnly:true,sameSite:"Strict"}]);});
async function post(page,path,data){const response=await page.request.post(path,{headers:{origin},data});expect(response.ok(),await response.text()).toBeTruthy();return response.json();}
const sourceInput={name:"Pull-up",implementationName:"Example resistor",partType:"purchased",manufacturer:"Example",model:"EX-10K",quantity:4,description:"Project-only purpose",projectDetails:{notes:"Project-only notes"},specifications:[{name:"Resistance",value:"10k Ω"}],supplierOffers:[{vendor:"digikey",sku:"EX-ND",url:"https://www.digikey.com/example"}]};
for(const width of [1440,390])test("project part copies into a reviewed Workshop product without changing its source at "+width+"px",async({page},testInfo)=>{
 const {component}=await post(page,"/api/components?project=launcher",sourceInput);
 const source=await(await page.request.get("/api/components?project=launcher")).json();
 await page.setViewportSize({width,height:1000});await page.goto("/index.html#launcher/part/"+component.id);
 await page.locator('#launcher .bom-part-workspace [data-section="part-details"] > .ui-section__header').click();
 await page.getByRole("button",{name:"Copy to Workshop",exact:true}).click();await expect(page.getByRole("heading",{name:"Copy project part to Workshop",exact:true})).toBeVisible();
 await page.getByLabel("Workshop family",{exact:true}).selectOption("f-resistor");await page.getByRole("button",{name:"Review product copy",exact:true}).click();
 await expect(page.getByLabel("Product name",{exact:true})).toHaveValue("Example resistor");await expect(page.getByLabel("Manufacturer part number",{exact:true})).toHaveValue("EX-10K");await expect(page.getByLabel("Notes",{exact:true})).toHaveValue(/Resistance: 10k Ω/);
 await page.getByLabel("Show fields usually filled in for a project",{exact:true}).check();await page.getByLabel("Resistance (Ω)",{exact:true}).fill("10000");
 await page.route("**/api/workshop",route=>route.request().method()==="POST"?route.fulfill({status:503,json:{error:"Temporary storage failure"}}):route.continue());
 await page.getByRole("button",{name:"Save product",exact:true}).click();await expect(page.locator("#workshop-status")).toContainText("Temporary storage failure");await expect(page.getByLabel("Product name",{exact:true})).toHaveValue("Example resistor");await page.unroute("**/api/workshop");
 await page.getByRole("button",{name:"Save product",exact:true}).click();await expect(page.locator("#workshop-status")).toHaveText("Saved.");
 const catalog=await(await page.request.get("/api/workshop")).json(),product=catalog.products.find(product=>product.mpn==="EX-10K");expect(product.field_values["f-resistor-resistance"]).toBe(10000);expect(product.supplier_links[0].part_number).toBe("EX-ND");expect(JSON.stringify(product)).not.toContain("Project-only");expect(catalog.uses).toHaveLength(0);
 expect(await(await page.request.get("/api/components?project=launcher")).json()).toEqual(source);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);await page.screenshot({path:testInfo.outputPath("copied-product.png"),fullPage:true});
 await page.getByRole("link",{name:"Back to project",exact:true}).click();await expect(page).toHaveURL(new RegExp("/index.html#launcher/part/"+component.id+"$"));
});
test("copy is cancellable and warns about an existing product; custom parts do not offer it",async({page})=>{
 const {component}=await post(page,"/api/components?project=launcher",sourceInput);
 const {record:product}=await post(page,"/api/workshop",{entity:"product",expectedRevision:null,expectedFamilyRevision:1,record:{id:crypto.randomUUID(),family_id:"f-resistor",name:"Existing resistor",manufacturer:"Example",mpn:"EX-10K",field_values:{},supplier_links:[],notes:""}});
 const query=new URLSearchParams({copyProject:"launcher",copyPart:component.id});await page.goto("/workshop.html?"+query);await page.getByLabel("Workshop family",{exact:true}).selectOption("f-resistor");await page.getByRole("button",{name:"Review product copy",exact:true}).click();await expect(page.getByRole("link",{name:"Open existing product",exact:true})).toHaveAttribute("href",/product=/);
 expect((await(await page.request.get("/api/workshop")).json()).products.map(product=>product.id)).toEqual([product.id]);
 await page.getByRole("button",{name:"Create another copy",exact:true}).click();page.once("dialog",dialog=>dialog.accept());await page.getByRole("button",{name:"Cancel",exact:true}).click();expect((await(await page.request.get("/api/workshop")).json()).products).toHaveLength(1);
 const {component:custom}=await post(page,"/api/components?project=launcher",{name:"Printed bracket",partType:"custom",specifications:[]});await page.goto("/index.html#launcher/part/"+custom.id);await page.locator('#launcher .bom-part-workspace [data-section="part-details"] > .ui-section__header').click();await expect(page.getByRole("button",{name:"Copy to Workshop",exact:true})).toHaveCount(0);
});
