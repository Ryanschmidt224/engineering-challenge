import {test,expect} from "@playwright/test";
const origin="http://127.0.0.1:4173";
async function owner(request,context,engine){
 const {cookie}=await(await request.post("/__test__/reset"+(engine?"?engine=1":""))).json(),at=cookie.indexOf("=");
 await context.addCookies([{name:cookie.slice(0,at),value:cookie.slice(at+1),url:origin,httpOnly:true,sameSite:"Strict"}]);
}
test("enabled home opens new Projects while legacy links, bookmarks and Account stay available",async({page,request,context})=>{
 await owner(request,context,true);await page.setViewportSize({width:390,height:844});await page.goto("/");
 await expect(page).toHaveURL(/\/project.html$/);await expect(page.getByRole("button",{name:"New project",exact:true})).toBeVisible();await expect(page.locator("[data-project-environment]")).toHaveText("Private preview");
 await expect(page.getByRole("navigation",{name:"Main navigation"}).getByRole("link",{name:"Projects",exact:true})).toHaveAttribute("href","project.html");
 await page.getByRole("link",{name:"Legacy projects",exact:true}).click();await expect(page).toHaveURL(/\/index.html\?legacy=1#home$/);
 await expect(page.getByRole("status").filter({hasText:"Legacy projects are read-only"})).toBeVisible();await expect(page.locator(".project-directory-new")).toBeHidden();
 await page.goto("/#launcher");await expect(page.locator("#launcher")).toHaveClass(/\bactive\b/);await expect(page).toHaveURL(/\/#launcher$/);
 await page.goto("/#calculators");await expect(page.locator("#calculators")).toHaveClass(/\bactive\b/);
 await page.goto("/index.html?account=1#home");await expect(page.locator(".project-account-dialog")).toBeVisible();await expect(page.getByRole("status").filter({hasText:"Legacy projects are read-only"})).toBeVisible();expect(new URL(page.url()).pathname).toBe("/index.html");
});
test("disabled engine keeps the existing home and shared header Projects link working",async({page,request,context})=>{
 await owner(request,context,false);await page.goto("/");await expect(page.locator("#home .ui-project-list [data-catalog-id]")).toHaveCount(3);expect(new URL(page.url()).pathname).toBe("/");
 await page.goto("/workshop.html");const projects=page.getByRole("navigation",{name:"Main navigation"}).getByRole("link",{name:"Projects",exact:true});await expect(projects).toHaveAttribute("href","/");await projects.click();
 await expect(page.locator("#home .ui-project-list [data-catalog-id]")).toHaveCount(3);expect(new URL(page.url()).pathname).toBe("/");expect((await request.get("/project.html")).status()).toBe(404);
});
