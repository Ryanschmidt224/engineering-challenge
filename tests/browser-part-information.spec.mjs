import {test, expect} from "@playwright/test";
test.describe.configure({mode:"serial"});
test.beforeEach(async ({request, context}) => {
 const {cookie}=await (await request.post("/__test__/reset")).json(),at=cookie.indexOf("=");
 await context.addCookies([{name:cookie.slice(0,at),value:cookie.slice(at+1),url:"http://127.0.0.1:4173",httpOnly:true,sameSite:"Strict"}]);
});
const headers={origin:"http://127.0.0.1:4173"};
async function post(page,path,data){const response=await page.request.post(path,{headers,data});expect(response.ok(),await response.text()).toBe(true);return response.json();}
async function openPart(page,id){
 await page.goto("/#launcher/part/"+id);
 const section=page.locator('#launcher [data-section="part-details"]');
 await expect(section).toBeVisible();await section.locator(":scope > .ui-section__header").click();
 await expect(section.locator('[data-information="project"]')).toBeVisible();return section;
}
for(const width of [1440,390])test("matching information tiles, purpose editing and alternatives at "+width+"px",async({page},testInfo)=>{
 await page.setViewportSize({width,height:1000});
 const {component}=await post(page,"/api/components?project=launcher",{
  name:"Signal switch",partType:"purchased",quantity:2,quantityUnit:"pcs",description:"Switch a low-current signal",
  manufacturer:"Example",model:"EX-1",specifications:[{name:"Gate voltage",value:"5 V"}],
  supplierOffers:[{vendor:"digikey",sku:"EX-1-ND",url:""}],projectDetails:{notes:"Fit inside the housing",footprint:"TO-92",featureTreeName:"LED switch"}
 });
 const section=await openPart(page,component.id),panels=section.locator(".ui-information-panel");
 await expect(panels.locator(":scope > h3")).toHaveText(["Part information","Project information"]);
 const shapes=await panels.evaluateAll(nodes=>nodes.map(node=>{const s=getComputedStyle(node),heading=getComputedStyle(node.querySelector("h3")),body=getComputedStyle(node.lastElementChild);return {border:s.border,bg:s.backgroundColor,radius:s.borderRadius,font:heading.fontSize,weight:heading.fontWeight,padding:body.padding};}));
 expect(shapes[0]).toEqual(shapes[1]);expect(shapes[0].font).toBe("16px");
 const reference=section.locator('[data-information="reference"]'),project=section.locator('[data-information="project"]');
 await expect(reference).toContainText("EX-1");await expect(reference).toContainText("5 V");await expect(reference).not.toContainText("Fit inside the housing");
 await expect(project).toContainText("LED switch");await expect(project).toContainText("Fit inside the housing");
 await expect(project.getByRole("textbox",{name:"Container name",exact:true})).toHaveCount(0);
 await expect(reference.getByRole("link",{name:"Search DigiKey · EX-1-ND",exact:true})).toHaveAttribute("href",/digikey\.com/);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);
 const rows=await section.locator(".ui-field-row").evaluateAll(nodes=>nodes.map(node=>{const label=node.querySelector("strong"),value=node.lastElementChild;return {label:getComputedStyle(label).fontSize,value:getComputedStyle(value).fontSize,x:value.getBoundingClientRect().x,labelX:label.getBoundingClientRect().x};}));
 for(const row of rows){expect(row.label).toBe("14px");expect(row.value).toBe("14px");if(width===390)expect(row.x).toBe(row.labelX);}
 await expect(project.getByRole("button",{name:"Edit purpose",exact:true})).toHaveCount(0);
 await section.getByRole("button",{name:"Edit part details",exact:true}).click();const editor=page.getByRole("dialog",{name:"Part editor",exact:true});await editor.getByLabel("Purpose (optional)",{exact:true}).fill("Revised project purpose");
 await page.route("**/api/components?**",route=>route.request().method()==="PUT"?route.fulfill({status:503,json:{error:"Temporary storage failure"}}):route.continue());
 await editor.getByRole("button",{name:"Save changes",exact:true}).click();await expect(editor).toContainText("Temporary storage failure");await expect(editor.getByLabel("Purpose (optional)",{exact:true})).toHaveValue("Revised project purpose");
 await page.unroute("**/api/components?**");await editor.getByRole("button",{name:"Save changes",exact:true}).click();await expect(editor).not.toBeVisible();await expect(project).toContainText("Revised project purpose");
 if(await section.getAttribute("open")===null)await section.locator(":scope > summary").click();
 await project.locator('[data-section="part-alternatives"] > summary').click();
 await project.getByRole("button",{name:"Add alternative part",exact:true}).click();await project.getByRole("textbox",{name:"Part name",exact:true}).fill("Replacement switch");await project.getByRole("textbox",{name:"Manufacturer part number",exact:true}).fill("EX-2");await project.getByRole("button",{name:"Add and use part",exact:true}).click();
 await expect(reference).toContainText("EX-2");await expect(project).toContainText("Revised project purpose");
 const stored=(await (await page.request.get("/api/components?project=launcher")).json()).components.find(part=>part.id===component.id);
 expect(stored.projectDetails.notes).toBe("Fit inside the housing");expect(stored.implementations).toHaveLength(2);expect(stored.description).toBe("Revised project purpose");
 await page.screenshot({path:testInfo.outputPath("part-information.png"),fullPage:true});
});

test("Workshop product values and project requirements remain distinct in matching tiles",async({page},testInfo)=>{
 const product={id:crypto.randomUUID(),family_id:"f-resistor",name:"12k resistor",manufacturer:"Example",mpn:"EX-12K",field_values:{"f-resistor-resistance":12000},supplier_links:[],notes:""};
 await post(page,"/api/workshop",{entity:"product",expectedRevision:null,expectedFamilyRevision:1,record:product});
 const {record:use}=await post(page,"/api/workshop",{entity:"use",expectedRevision:null,expectedFamilyRevision:1,record:{id:crypto.randomUUID(),family_id:product.family_id,product_id:product.id,project_id:"launcher",tree_node_id:null,purpose:"Pull-up resistor",quantity:1,unit:"pcs",notes:"Test the threshold",field_values:{"f-resistor-resistance":10000}}});
 const section=await openPart(page,use.id),reference=section.locator('[data-information="reference"]'),project=section.locator('[data-information="project"]');
 await expect(reference.getByRole("heading",{name:"Workshop information",exact:true})).toBeVisible();
 await expect(reference).toContainText("12000 Ω");await expect(reference).not.toContainText("10000 Ω");await expect(reference).not.toContainText("Test the threshold");
 await expect(project).toContainText("10000 Ω (differs from selected product; review)");await expect(project).toContainText("Test the threshold");
 const snapshot=await (await page.request.get("/api/workshop")).json();expect(snapshot.products[0].field_values["f-resistor-resistance"]).toBe(12000);expect(snapshot.uses[0].field_values["f-resistor-resistance"]).toBe(10000);
 await page.screenshot({path:testInfo.outputPath("workshop-project-values.png"),fullPage:true});
});

test("document information keeps project captions and technical fields without container controls",async({page})=>{
 const {component}=await post(page,"/api/components?project=launcher",{name:"Board drawing",itemType:"document",description:"Assembly drawing",specifications:[{name:"Revision",value:"B"}],projectDetails:{featureTreeName:"Assembly view",notes:"Print before assembly"}});
 const section=await openPart(page,component.id),reference=section.locator('[data-information="reference"]'),project=section.locator('[data-information="project"]');
 await expect(reference).toContainText("Assembly drawing");await expect(reference).toContainText("Revision");await expect(project).toContainText("Assembly view");await expect(project).toContainText("Print before assembly");
 await expect(project.getByRole("button",{name:"Edit purpose",exact:true})).toHaveCount(0);
});
