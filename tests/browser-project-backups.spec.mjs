import {test,expect} from "@playwright/test";
import {readFile} from "node:fs/promises";
test("Project settings lists downloadable automatic backups and retries a failed read without changing a settings draft",async({page,request,context})=>{
 const origin="http://127.0.0.1:4173",{cookie}=await(await request.post("/__test__/reset?engine=1")).json(),at=cookie.indexOf("=");
 await context.addCookies([{name:cookie.slice(0,at),value:cookie.slice(at+1),url:origin,httpOnly:true,sameSite:"Strict"}]);
 await page.goto("/project.html");await page.getByRole("button",{name:"New project",exact:true}).click();
 await expect(page.locator('[data-section="automatic-backups"]')).toHaveCount(0);
 await page.getByLabel("Project name",{exact:true}).fill("Backup notebook");await page.getByRole("button",{name:"Create project",exact:true}).click();await expect(page.getByRole("dialog")).not.toBeVisible();
 const projectId=new URL(page.url()).searchParams.get("project"),endpoint="/api/project-engine/projects/"+projectId+"/automatic-backups",before=await(await page.request.get("/api/project-engine/projects/"+projectId+"/state")).json();
 await page.getByRole("button",{name:"Project settings",exact:true}).click();const dialog=page.locator(".project-main"),section=dialog.locator('[data-section="automatic-backups"]');
 await expect(section).not.toHaveAttribute("open");await section.locator(":scope > summary").click();await expect(section).toContainText("No automatic backup is available");
 await dialog.getByLabel("Project name",{exact:true}).fill("Unsaved name stays here");
 let fail=true;
 const backupId="2026-11-25T03-45-00Z-11111111-1111-4111-8111-111111111111";
 await context.route(url=>url.pathname===endpoint,route=>new URL(route.request().url()).searchParams.has("id")
  ?route.fulfill({contentType:"application/x-ndjson",headers:{"content-disposition":'attachment; filename="nightly.bsproject"'},body:'{"type":"complete"}\n'})
  :route.fulfill({status:fail?503:200,contentType:"application/json",body:JSON.stringify(fail?{error:"Storage temporarily unavailable"}:{backups:[{id:backupId,date:"2026-11-25T03:45:00.000Z",size:2097152}],retention:"append-only",storage:"same Cloudflare R2 bucket"})}));
 await section.getByRole("button",{name:"Refresh backups",exact:true}).click();await expect(section).toContainText("Storage temporarily unavailable");
 fail=false;await section.getByRole("button",{name:"Retry backups",exact:true}).click();const table=section.getByRole("table",{name:"Automatic project backups",exact:true});
 await expect(table.locator("tbody tr")).toHaveCount(1);await expect(table).toContainText("2.0 MiB");await expect(table.locator("time")).toHaveAttribute("datetime","2026-11-25T03:45:00.000Z");
 const link=table.getByRole("link");await expect(link).toHaveAttribute("href",endpoint+"?id="+backupId);
 let unexpectedDialogs=0;page.on("dialog",async message=>{unexpectedDialogs++;await message.dismiss();});
 const downloading=new Promise(resolve=>{page.once("download",resolve);context.once("page",popup=>popup.once("download",resolve));});await link.click();const downloaded=await downloading;
 expect(await readFile(await downloaded.path(),"utf8")).toBe('{"type":"complete"}\n');expect(downloaded.suggestedFilename()).toBe("nightly.bsproject");
 expect(unexpectedDialogs).toBe(0);await expect(dialog.getByLabel("Project name",{exact:true})).toHaveValue("Unsaved name stays here");await dialog.getByRole("button",{name:"Cancel",exact:true}).click();
 expect(await(await page.request.get("/api/project-engine/projects/"+projectId+"/state")).json()).toEqual(before);
});
