import {test,expect} from "@playwright/test";
test.describe.configure({mode:"serial"});
const origin="http://127.0.0.1:4173",headers={origin};
for(const width of [1440,390])test("Archived record headers use the shared row without enlarging it at "+width+"px",async({page,request,context},testInfo)=>{
 const {cookie}=await(await request.post("/__test__/reset")).json(),at=cookie.indexOf("=");await context.addCookies([{name:cookie.slice(0,at),value:cookie.slice(at+1),url:origin,httpOnly:true,sameSite:"Strict"}]);
 const response=await context.request.post("/api/components?project=launcher",{headers,data:{name:"Header check",partType:"custom",specifications:[]}});expect(response.ok(),await response.text()).toBe(true);const {component}=await response.json();
 const workspace=await context.request.put("/api/workspace?project=launcher&part="+component.id,{headers,data:{recipe:[{id:"measure",title:"Measure voltage",tileOrder:[]}],expectedRevision:null}});expect(workspace.ok(),await workspace.text()).toBe(true);
 let revision=null;const command=async data=>{const r=await context.request.post("/api/investigations?project=launcher",{headers,data:{...data,expectedRevision:revision}});expect(r.ok(),await r.text()).toBe(true);const body=await r.json();revision=body.revision;return body;};
 const base={action:"create",scope:"step",ownerType:"part",ownerId:component.id,stepId:"measure",category:"test",entries:[]};
 const activeId=(await command({...base,title:"Active"})).createdId,archivedId=(await command({...base,title:"Archived"})).createdId;
 await command({action:"archiveRecord",id:archivedId,note:"Header layout test"});const before=await(await context.request.get("/api/investigations?project=launcher")).json();
 await page.setViewportSize({width,height:1100});await page.goto("/index.html#launcher/part/"+component.id);const instructions=page.locator('#launcher .bom-part-workspace [data-section="work-instructions"]');await instructions.locator(":scope > .ui-section__header").click();await instructions.locator(".investigation-collapse > summary").click();
 const active=instructions.locator('[data-record-id="'+activeId+'"]'),archived=instructions.locator('[data-record-id="'+archivedId+'"]');await expect(active).toBeVisible();await expect(archived).toBeVisible();await archived.locator(":scope > summary").click();
 const metric=el=>{const css=getComputedStyle(el),b=el.getBoundingClientRect();return {height:b.height,padding:css.padding,font:css.fontSize,weight:css.fontWeight};};
 const current=await active.locator(":scope > summary").evaluate(metric),old=await archived.locator(":scope > summary").evaluate(metric);const {height:currentHeight,...currentStyle}=current,{height:oldHeight,...oldStyle}=old;expect(oldStyle).toEqual(currentStyle);expect(oldHeight).toBe(48);expect(oldHeight).toBeLessThanOrEqual(currentHeight);if(width===1440)expect(oldHeight).toBe(currentHeight);
 expect(await archived.getByRole("button",{name:"Delete archived entry",exact:true}).evaluate(el=>el.getBoundingClientRect().height)).toBe(32);await expect(archived.locator(":scope > summary").getByRole("button",{name:"Delete archived entry",exact:true})).toHaveCount(0);await expect(archived).toContainText("Reason: Header layout test");
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);await page.screenshot({path:testInfo.outputPath("archived-record-header.png"),fullPage:true});expect(await(await context.request.get("/api/investigations?project=launcher")).json()).toEqual(before);
});
