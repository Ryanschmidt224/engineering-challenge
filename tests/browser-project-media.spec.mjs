import {test,expect} from "@playwright/test";
// 1x1 PNG.
const PNG=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==","base64");
async function setup(page,request,context){
 const {cookie}=await(await request.post("/__test__/reset?engine=1")).json(),at=cookie.indexOf("=");await context.addCookies([{name:cookie.slice(0,at),value:cookie.slice(at+1),url:"http://127.0.0.1:4173",httpOnly:true,sameSite:"Strict"}]);
 await page.goto("/project.html");await page.getByRole("button",{name:"New project",exact:true}).click();await page.getByLabel("Project name",{exact:true}).fill("Photo notebook");await page.getByRole("button",{name:"Create project",exact:true}).click();await expect(page.getByRole("dialog")).not.toBeVisible();
 const id=new URL(page.url()).searchParams.get("project"),base="/api/project-engine/projects/"+id,state=async()=>(await(await context.request.get(base+"/state")).json());
 const current=await state(),r=await context.request.post(base+"/items",{headers:{origin:"http://127.0.0.1:4173"},data:{operationId:crypto.randomUUID(),expectedRevision:current.project.revision,details:{name:"Bracket"}}});expect(r.ok(),await r.text()).toBe(true);
 await page.reload();return {id,base,state,itemId:(await r.json()).itemId};
}
test("project photos upload, caption, reorder and remove; a part gets one picture",async({page,request,context},testInfo)=>{
 const f=await setup(page,request,context),photos=page.locator('[data-section="project-photos"]');
 await page.locator('[data-section="summary-photos"] > summary').click();await page.getByRole("button",{name:"Edit photo",exact:true}).click();
 await expect(page.getByText("Part photos",{exact:true})).toHaveCount(0);
 await photos.locator('input[type="file"]').setInputFiles([{name:"one.png",mimeType:"image/png",buffer:PNG},{name:"two.png",mimeType:"image/png",buffer:PNG}]);
 await expect(photos.locator("img")).toHaveCount(2);
 const geometry=await page.locator(".bs-photo-stage > .bs-photo-toggle").evaluateAll(buttons=>buttons.map(button=>{const icon=button.getBoundingClientRect(),frame=button.closest(".bs-photo-control").querySelector(".bs-photo-stage").getBoundingClientRect(),style=getComputedStyle(button);return {below:icon.top>=frame.bottom&&Math.abs(icon.right-frame.right)<=2,background:style.backgroundColor,border:style.borderTopWidth};}));for(const button of geometry){expect(button.below).toBe(true);expect(button.background).toBe("rgba(0, 0, 0, 0)");expect(button.border).toBe("0px");}const upload=photos.locator(".bs-photo-upload-row"),add=await upload.getByRole("button",{name:"Add photos",exact:true}).boundingBox(),drop=await upload.getByRole("textbox",{name:"Paste a copied photo",exact:true}).boundingBox();expect(drop.x).toBeGreaterThan(add.x+add.width);expect(drop.width).toBeLessThan((await upload.boundingBox()).width*0.4);await expect(upload.getByRole("button",{name:"Add photos",exact:true})).not.toHaveClass(/quiet/);
 const photoView=photos.getByLabel("Photo view",{exact:true});await expect(photoView).toHaveValue("tiles");const tiles=photos.locator("figure"),first=await tiles.nth(0).boundingBox(),second=await tiles.nth(1).boundingBox();expect(Math.abs(first.y-second.y)).toBeLessThan(2);expect(second.x).toBeGreaterThan(first.x);const beforeViews=await f.state();await photoView.selectOption("details");await expect(photos.locator(".project-media-meta").first()).toContainText("one.png");await photoView.selectOption("list");await expect(photos.locator(".project-media-meta").first()).toBeHidden();await photoView.selectOption("tiles");expect(await f.state()).toEqual(beforeViews);await page.screenshot({path:testInfo.outputPath("photo-grid-tiles.png"),fullPage:true});
 await photos.locator("figure").first().getByRole("button",{name:"Edit photo",exact:true}).click();
 await photos.getByRole("button",{name:"Caption",exact:true}).first().click();await page.getByLabel("Caption",{exact:true}).fill("Bench setup");await page.getByRole("button",{name:"Save caption",exact:true}).click();
 await expect(photos.locator("figcaption").first()).toHaveText("Bench setup");await expect(page.locator(".project-summary-photo-grid img").first()).toHaveAttribute("alt","Bench setup");
 await photos.getByRole("button",{name:"Move photo later",exact:true}).first().click();await expect(photos.locator("figcaption").nth(1)).toHaveText("Bench setup");
 await photos.locator("figure").first().getByRole("button",{name:"Edit photo",exact:true}).click();
 await photos.locator("figure").first().getByRole("button",{name:"Remove",exact:true}).click();await page.getByRole("button",{name:"Remove photo",exact:true}).click();
 await expect(photos.locator("img")).toHaveCount(1);await expect(page.locator(".project-summary-photo-grid img").first()).toHaveAttribute("alt","Bench setup");
 const editor=page.locator('[data-section="summary-photos"] > .ui-section__body > .project-photo-editor'),save=editor.locator(':scope > .bs-photo-save');await expect(save).toBeVisible();await save.click();await expect(editor).toBeHidden();const pencil=page.locator('[data-section="summary-photos"] .project-picture-holder > .bs-photo-control > .bs-photo-actions > .bs-photo-toggle');await expect(pencil).toHaveAttribute('aria-expanded','false');await expect.poll(async()=>{const image=await page.locator('.project-summary-photo-grid img').first().boundingBox(),icon=await pencil.boundingBox();return Math.abs(image.x+image.width-icon.x-icon.width);}).toBeLessThan(2);await pencil.click();await expect(editor).toBeVisible();

 let s=await f.state();expect(s.media.filter(row=>row.active).length).toBe(1);expect(s.files.length).toBe(2);
 await page.goto("/project.html?project="+f.id+"&item="+f.itemId);
 await expect(page.getByRole("button",{name:"Add picture",exact:true})).not.toBeVisible();
 await page.getByRole("button",{name:"Edit photo",exact:true}).click();
 await page.getByRole("button",{name:"Add picture",exact:true}).waitFor();
 await page.locator('input[aria-label="Part picture"]').setInputFiles({name:"front.png",mimeType:"image/png",buffer:PNG});
 await expect(page.locator(".project-picture-holder img.project-picture")).toHaveCount(1);await expect(page.getByRole("button",{name:"Replace picture",exact:true})).toBeVisible();
 await page.locator('input[aria-label="Part picture"]').setInputFiles({name:"side.png",mimeType:"image/png",buffer:PNG});
 await expect(page.getByRole("status").or(page.locator("[data-notice]"))).toContainText("Picture saved");
 s=await f.state();expect(s.media.filter(row=>row.role==="picture").length).toBe(2);expect(s.media.filter(row=>row.role==="picture"&&row.active).length).toBe(1);
});
