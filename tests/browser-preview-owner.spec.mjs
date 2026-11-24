import {test,expect} from "@playwright/test";
import {pathToFileURL} from "node:url";
import {resolve} from "node:path";
import {readFileSync} from "node:fs";
test("offline preview owner generator works from a saved file and downloads no plaintext password",async({page},testInfo)=>{
 const requests=[];page.on("request",request=>requests.push(request.url()));
 await page.setViewportSize({width:1000,height:1000});
 await page.goto(pathToFileURL(resolve("scripts/preview-owner-setup.html")).href);
 await page.locator("#confirm-target").check();
 const password="synthetic-offline-browser-password";
 await page.locator("#password").fill(password);await page.locator("#repeat").fill("different-synthetic-password");
 await page.getByRole("button",{name:"Generate account files"}).click();await expect(page.getByRole("status")).toContainText("do not match");
 await page.locator("#repeat").fill(password);await page.getByRole("button",{name:"Generate account files"}).click();
 await expect(page.getByRole("status")).toContainText("Files ready");
 await expect(page.locator("#password")).toHaveValue("");await expect(page.locator("#repeat")).toHaveValue("");
 const objects=[];
 for(const selector of ["#user-download","#email-download"]){
  const downloadPromise=page.waitForEvent("download");await page.locator(selector).click();const download=await downloadPromise;
  const content=readFileSync(await download.path(),"utf8");expect(content).not.toContain(password);objects.push(JSON.parse(content));
 }
 expect(objects[0].email).toBe("owner@preview.test");expect(objects[0].role).toBe("admin");expect(objects[1].id).toBe(objects[0].id);
 expect(requests.filter(url=>/^https?:/.test(url))).toEqual([]);
 await page.screenshot({path:testInfo.outputPath("offline-owner-setup.png"),fullPage:true});
});
