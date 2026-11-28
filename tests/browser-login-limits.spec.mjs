// Disposable real Worker/R2 fixtures only. Never exercise a production cooldown.
import {test,expect} from "@playwright/test";
const origin="http://127.0.0.1:4173";
for(const width of [390,1440])test("login cooldown explains retry time, preserves input and keeps existing sessions usable at "+width,async({page,request,context})=>{
 const {cookie}=await (await request.post("/__test__/reset")).json();await context.clearCookies();
 for(let i=0;i<9;i++){
  const response=await request.post("/api/accounts",{headers:{origin},data:{action:"login",email:"owner@example.test",password:"synthetic-wrong-password"}});expect(response.status()).toBe(401);
 }
 await page.setViewportSize({width,height:900});await page.goto("/project.html");await page.locator("[data-signin]").click();const dialog=page.getByRole("dialog",{name:"Owner account",exact:true});
 await dialog.getByLabel("Email",{exact:true}).fill("owner@example.test");await dialog.getByLabel("Password",{exact:true}).fill("disposable-test-password");
 const reply=page.waitForResponse(response=>response.url().endsWith("/api/accounts")&&response.request().method()==="POST");await dialog.getByRole("button",{name:"Sign in",exact:true}).click();const blocked=await reply;
 expect(blocked.status()).toBe(429);expect(Number(blocked.headers()["retry-after"])).toBeGreaterThan(0);expect(blocked.headers()["set-cookie"]).toBeUndefined();
 await expect(dialog.getByRole("alert")).toContainText("Too many sign-in attempts. Try again in");await expect(dialog.getByLabel("Email",{exact:true})).toHaveValue("owner@example.test");await expect(dialog.getByLabel("Password",{exact:true})).toHaveValue("disposable-test-password");await expect(dialog.getByRole("button",{name:"Cancel",exact:true})).toBeEnabled();
 const existing=await request.get("/api/accounts",{headers:{cookie}});expect((await existing.json()).user.role).toBe("admin");
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await dialog.getByRole("button",{name:"Cancel",exact:true}).click();await expect(dialog).not.toBeVisible();
});
