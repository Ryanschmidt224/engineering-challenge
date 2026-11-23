import {test,expect} from "@playwright/test";
test.describe.configure({mode:"serial"});
const origin="http://127.0.0.1:4173",png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/qLkAAAAASUVORK5CYII=","base64");
test.beforeEach(async({request,context})=>{const {cookie}=await(await request.post("/__test__/reset")).json(),at=cookie.indexOf("=");await context.addCookies([{name:cookie.slice(0,at),value:cookie.slice(at+1),url:origin,httpOnly:true,sameSite:"Strict"}]);});
async function photo(page,assembly){const response=await page.request.post("/api/photos",{headers:{origin,"content-type":"image/png","x-photo-project":"launcher","x-photo-assembly":assembly,"x-photo-name":"thumbnail.png"},data:png});expect(response.ok(),await response.text()).toBeTruthy();return (await response.json()).id;}
for(const width of [1440,390])test("Explorer-style project views retain sorting, filtering, keyboard access and summary cover at "+width+"px",async({page},testInfo)=>{
 const excluded=await photo(page,"root-assembly"),cover=await photo(page,"project-summary");
 await page.setViewportSize({width,height:1000});await page.goto("/index.html#home");const list=page.locator(".ui-project-list"),card=list.locator('[data-catalog-id="launcher"]');await expect(card.locator("img")).toHaveAttribute("src",new RegExp(encodeURIComponent(cover)));await expect(card.locator("img")).not.toHaveAttribute("src",new RegExp(encodeURIComponent(excluded)));
 const view=page.getByRole("combobox",{name:"Project view",exact:true});
 for(const mode of ["list","tiles","icons","details"]){await view.selectOption(mode);await expect(list).toHaveAttribute("data-view",mode);await expect(list.locator(".ui-project-card")).toHaveCount(3);expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);await page.screenshot({path:testInfo.outputPath(mode+".png"),fullPage:true});}
 await page.locator(".project-sort-filter").selectOption("name_desc");const titles=await list.locator(".ui-project-name").allTextContents();expect(titles).toEqual([...titles].sort((a,b)=>b.localeCompare(a,undefined,{numeric:true,sensitivity:"base"})));
 await page.getByRole("searchbox",{name:"Search projects",exact:true}).fill("Foam-dart");await expect(list.locator(".ui-project-card")).toHaveCount(1);await view.selectOption("icons");await expect(list.locator(".ui-project-card")).toHaveCount(1);
 await page.reload();await expect(view).toHaveValue("icons");await expect(card.locator("img")).toHaveAttribute("src",new RegExp(encodeURIComponent(cover)));await card.getByRole("button").focus();await page.keyboard.press("Enter");await expect(page).toHaveURL(/#launcher$/);
 const summary=page.locator("#launcher .project-summary-photo");await expect(summary).toHaveAttribute("src",new RegExp(encodeURIComponent(cover)));
 const removed=await page.request.delete("/api/photos?id="+encodeURIComponent(cover),{headers:{origin}});expect(removed.ok()).toBeTruthy();const replacement=await photo(page,"project-summary");
 await page.reload();await expect(summary).toHaveAttribute("src",new RegExp(encodeURIComponent(replacement)));await page.getByRole("navigation",{name:"Main navigation"}).getByRole("button",{name:"Projects",exact:true}).click();await expect(card.locator("img")).toHaveAttribute("src",new RegExp(encodeURIComponent(replacement)));
});
