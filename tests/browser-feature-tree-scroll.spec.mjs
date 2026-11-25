import {test,expect} from "@playwright/test";
const origin="http://127.0.0.1:4173";
for(const width of [1440,390])test("long legacy feature tree scrolls independently and its last assembly stays reachable at "+width+"px",async({page,request,context},testInfo)=>{
 const height=width===390?844:900;await page.setViewportSize({width,height});
 const {cookie}=await(await request.post("/__test__/reset")).json(),at=cookie.indexOf("=");await context.addCookies([{name:cookie.slice(0,at),value:cookie.slice(at+1),url:origin,httpOnly:true,sameSite:"Strict"}]);
 const prior=await(await page.request.get("/api/tree?project=launcher")).json(),nodes=Array.from({length:80},(_,i)=>({id:"scroll-"+(i+1),kind:"assembly",name:"Scroll assembly "+String(i+1).padStart(2,"0"),parentId:null}));
 const saved=await page.request.put("/api/tree?project=launcher",{headers:{origin},data:{nodes,expectedRevision:prior.revision}});expect(saved.ok(),await saved.text()).toBe(true);
 const before=await(await page.request.get("/api/tree?project=launcher")).json();await page.goto("/index.html#launcher");
 const tree=page.locator("#launcher .feature-tree-frame"),last=tree.locator(".assembly-name").filter({hasText:"Scroll assembly 80"});await expect(last).toHaveCount(1);
 expect(await tree.evaluate(el=>el.clientHeight)).toBeLessThanOrEqual(height);expect(await tree.evaluate(el=>el.scrollHeight-el.clientHeight)).toBeGreaterThan(0);
 const box=await tree.boundingBox(),scrollY=await page.evaluate(()=>window.scrollY);await page.mouse.move(box.x+box.width/2,Math.min(box.y+box.height-20,height-30));await page.mouse.wheel(0,700);
 await expect.poll(()=>tree.evaluate(el=>el.scrollTop),{timeout:1500}).toBeGreaterThan(0);expect(await page.evaluate(()=>window.scrollY)).toBe(scrollY);
 await tree.evaluate(el=>el.scrollTop=el.scrollHeight);await expect(last).toBeInViewport();await page.screenshot({path:testInfo.outputPath("scrolled-tree.png")});await last.click();
 await expect(page).toHaveURL(/#launcher\/(?:workspace|assembly)\/scroll-80/);expect(await(await page.request.get("/api/tree?project=launcher")).json()).toEqual(before);
});
