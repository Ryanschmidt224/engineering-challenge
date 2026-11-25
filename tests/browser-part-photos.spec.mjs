import {test,expect} from "@playwright/test";
const origin="http://127.0.0.1:4173",headers={origin},png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/qLkAAAAASUVORK5CYII=","base64");
for(const width of [1440,390])test("parts without photos make no thumbnail request; older uploaded photos still display at "+width+"px",async({page,request,context})=>{
 const {cookie}=await(await request.post("/__test__/reset")).json(),at=cookie.indexOf("=");await context.addCookies([{name:cookie.slice(0,at),value:cookie.slice(at+1),url:origin,httpOnly:true,sameSite:"Strict"}]);await page.setViewportSize({width,height:1000});
 const response=await context.request.post("/api/components?project=launcher",{headers,data:{name:"Photo availability check",partType:"custom",specifications:[]}});expect(response.ok(),await response.text()).toBe(true);const {component}=await response.json();
 const requested=[];page.on("request",r=>{if(new URL(r.url()).pathname==="/api/components/photo"&&r.method()==="GET")requested.push(r.url());});
 await page.goto("/index.html#launcher/part/"+component.id);const part=page.locator("#launcher .bom-part-workspace");await expect(part).toBeVisible();await expect(part.locator(".part-workspace-cover")).toContainText("No picture yet");expect(requested).toHaveLength(0);
 const uploaded=await context.request.post("/api/components/photo?project=launcher&id="+component.id,{headers:{...headers,"content-type":"image/png"},data:png});expect(uploaded.ok(),await uploaded.text()).toBe(true);
 await page.reload();await expect(part.locator(".part-workspace-cover img")).toBeVisible();await expect.poll(()=>requested.length).toBeGreaterThan(0);
});
