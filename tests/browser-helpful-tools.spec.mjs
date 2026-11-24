import {test,expect} from "@playwright/test";
test.describe.configure({mode:"serial"});
const origin="http://127.0.0.1:4173",headers={origin};
for(const [width,scope] of [[1440,"part"],[390,"assembly"]])test("Helpful tools keeps saved references but offers only Tool and Calculator at "+width+"px",async({page,context,request},testInfo)=>{
 const {cookie}=await(await request.post("/__test__/reset")).json(),at=cookie.indexOf("=");await context.addCookies([{name:cookie.slice(0,at),value:cookie.slice(at+1),url:origin,httpOnly:true,sameSite:"Strict"}]);
 const created=await context.request.post("/api/components?project=launcher",{headers,data:{name:"Reference fixture",partType:"custom",quantity:3,specifications:[]}});expect(created.ok(),await created.text()).toBe(true);const {component}=await created.json();
 const path="/api/workspace?project=launcher&"+(scope==="part"?"part="+component.id:"assembly=__root__"),parts=["workshop:resistors","wire:legacy-wire"];
 const seed=await context.request.put(path,{headers,data:{recipe:[],resources:{tools:["multimeter"],calculators:[],parts},expectedRevision:null}});expect(seed.ok(),await seed.text()).toBe(true);
 const componentsBefore=await(await context.request.get("/api/components?project=launcher")).json(),treeBefore=await(await context.request.get("/api/tree?project=launcher")).json();
 await page.setViewportSize({width,height:1100});await page.goto("/#launcher/"+(scope==="part"?"part/"+component.id:"workspace/__root__"));
 const section=page.locator('#launcher .assembly-workspace-page'+(scope==="part"?'.bom-part-workspace':':not(.bom-part-workspace)')+' [data-section="helpful-tools"]');await expect(section).toBeVisible();await section.locator(":scope > summary").click();
 const old=section.locator(".linked-resource-group").filter({has:page.getByRole("heading",{name:"Workshop parts",exact:true})});await expect(old.locator(".linked-resource-row")).toHaveCount(2);
 const picker=section.getByRole("combobox",{name:"Resource type",exact:true});
 for(const kind of ["calculators"]){
  await section.getByRole("button",{name:"+ Add entry",exact:true}).click();await expect(picker.locator("option")).toHaveText(["Tool","Calculator"]);await expect(picker.locator('option[value="parts"]')).toHaveCount(0);
  await picker.selectOption(kind);await section.getByRole("button",{name:"Add selected resource",exact:true}).click();
  await expect.poll(async()=>{const {workspace}=await(await context.request.get(path)).json();return {count:workspace.resources[kind].length,parts:workspace.resources.parts};}).toEqual({count:1,parts});
 }
 await section.getByRole("button",{name:"+ Add entry",exact:true}).click();await picker.selectOption("tools");await expect(picker.locator("option")).toHaveText(["Tool","Calculator"]);
 // The retained legacy tool catalog has no tool-kind entries. Do not populate
 // obsolete IDs or pretend the future D1 picker shipped with this small fix.
 await expect(section.getByRole("combobox",{name:"Resource to add",exact:true})).toBeDisabled();await expect(section.getByRole("button",{name:"Add selected resource",exact:true})).toBeDisabled();await section.getByRole("button",{name:"Cancel",exact:true}).click();await expect(section).toContainText("Digital multimeter");
 await page.screenshot({path:testInfo.outputPath("helpful-tools.png"),fullPage:true});
 await old.locator(".linked-resource-row").first().getByRole("button",{name:"Remove",exact:true}).click();await expect.poll(async()=>{const {workspace}=await(await context.request.get(path)).json();return workspace.resources.parts;}).toEqual([parts[1]]);
 await page.reload();const current=section.locator(".linked-resource-group").filter({has:page.getByRole("heading",{name:"Workshop parts",exact:true})});if(await section.getAttribute("open")===null)await section.locator(":scope > summary").click();await expect(current).toContainText("wire:legacy-wire");await expect(current.locator(".linked-resource-row")).toHaveCount(1);
 const {workspace:saved}=await(await context.request.get(path)).json();expect(saved.resources.tools).toEqual(["multimeter"]);expect(saved.resources.calculators).toEqual(["ohms-law"]);
 expect(await(await context.request.get("/api/components?project=launcher")).json()).toEqual(componentsBefore);expect(await(await context.request.get("/api/tree?project=launcher")).json()).toEqual(treeBefore);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);
});
