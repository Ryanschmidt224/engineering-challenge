import {test,expect} from "@playwright/test";
test("legacy pages show their read-only state and reject old-tab saves while new work uses the engine",async({page,request,context})=>{
 const origin="http://127.0.0.1:4173",{cookie}=await(await request.post("/__test__/reset?engine=1")).json(),at=cookie.indexOf("=");
 await context.addCookies([{name:cookie.slice(0,at),value:cookie.slice(at+1),url:origin,httpOnly:true,sameSite:"Strict"}]);
 await page.goto("/index.html#home");
 const notice=page.getByRole("status").filter({hasText:"Legacy projects are read-only"});await expect(notice).toBeVisible();
 await expect(page.getByRole("button",{name:"+ New project",exact:true})).toBeHidden();
 const catalog=await(await page.request.get("/api/projects")).json(),original=catalog.projects.find(p=>p.id==="launcher").name;
 const failed=await page.request.patch("/api/projects",{headers:{origin},data:{id:"launcher",name:"Must not save"}});
 expect(failed.status()).toBe(409);expect((await failed.json()).code).toBe("LEGACY_READ_ONLY");
 await page.locator('[data-catalog-id="launcher"]').getByRole("button").click();await expect(page).toHaveURL(/#launcher$/);await expect(notice).toBeVisible();
 expect((await(await page.request.get("/api/projects")).json()).projects.find(p=>p.id==="launcher").name).toBe(original);
 await notice.getByRole("link",{name:"Open new Projects",exact:true}).click();await expect(page).toHaveURL(/\/project.html$/);
 await page.getByRole("button",{name:"New project",exact:true}).click();await page.getByLabel("Project name",{exact:true}).fill("New work after activation");await page.getByRole("button",{name:"Create project",exact:true}).click();
 await expect(page.getByRole("dialog")).not.toBeVisible();await expect(page.getByRole("heading",{name:"New work after activation",exact:true})).toBeVisible();
});
