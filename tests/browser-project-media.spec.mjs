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
 await expect(photos.locator("figure img")).toHaveCount(2);
 for(const width of [1600,390,1280]) {
  await page.setViewportSize({width,height:1000});
  const geometry=await page.locator(".bs-photo-toggle:visible").evaluateAll(buttons=>buttons.map(button=>{const icon=button.getBoundingClientRect(),images=[...button.closest(".bs-photo-control").querySelector(".bs-photo-stage").querySelectorAll("img")].map(image=>image.getBoundingClientRect()),style=getComputedStyle(button);return {below:icon.top>=Math.max(...images.map(image=>image.bottom))&&Math.abs(icon.right-Math.max(...images.map(image=>image.right)))<=2,background:style.backgroundColor,border:style.borderTopWidth,transform:style.transform};}));
  expect(geometry.length).toBeGreaterThan(0);
  for(const button of geometry){expect(button.below).toBe(true);expect(button.background).toBe("rgba(0, 0, 0, 0)");expect(button.border).toBe("0px");expect(button.transform).toBe("none");}
 }
 const upload=photos.locator(".bs-photo-upload-row"),add=await upload.getByRole("button",{name:"Add photos",exact:true}).boundingBox(),drop=await upload.getByRole("textbox",{name:"Paste a copied photo",exact:true}).boundingBox();expect(drop.x).toBeGreaterThan(add.x+add.width);expect(drop.width).toBeLessThan((await upload.boundingBox()).width*0.4);await expect(upload.getByRole("button",{name:"Add photos",exact:true})).not.toHaveClass(/quiet/);
 const photoView=photos.getByLabel("Photo view",{exact:true});await expect(photoView).toHaveValue("tiles");const tiles=photos.locator("figure"),first=await tiles.nth(0).boundingBox(),second=await tiles.nth(1).boundingBox();expect(Math.abs(first.y-second.y)).toBeLessThan(2);expect(second.x).toBeGreaterThan(first.x);const beforeViews=await f.state();await photoView.selectOption("details");await expect(photos.locator(".project-media-meta").first()).toContainText("one.png");await photoView.selectOption("list");await expect(photos.locator(".project-media-meta").first()).toBeHidden();await photoView.selectOption("tiles");expect(await f.state()).toEqual(beforeViews);await page.screenshot({path:testInfo.outputPath("photo-grid-tiles.png"),fullPage:true});
 await photos.locator("figure").first().getByRole("button",{name:"Edit photo",exact:true}).click();
 await photos.getByRole("button",{name:"Caption",exact:true}).first().click();await page.getByLabel("Caption",{exact:true}).fill("Bench setup");await page.getByRole("button",{name:"Save caption",exact:true}).click();
 await expect(photos.locator("figcaption").first()).toHaveText("Bench setup");await expect(page.locator(".project-summary-photo-grid img").first()).toHaveAttribute("alt","Bench setup");
 await photos.getByRole("button",{name:"Move photo later",exact:true}).first().click();await expect(photos.locator("figcaption").nth(1)).toHaveText("Bench setup");
 await photos.locator("figure").first().getByRole("button",{name:"Edit photo",exact:true}).click();
 await photos.locator("figure").first().getByRole("button",{name:"Remove",exact:true}).click();await page.getByRole("button",{name:"Remove photo",exact:true}).click();
 await expect(photos.locator("figure img")).toHaveCount(1);await expect(page.locator(".project-summary-photo-grid img").first()).toHaveAttribute("alt","Bench setup");
 const editor=page.locator('[data-section="summary-photos"] > .ui-section__body > .project-photo-editor'),save=editor.locator(':scope > .bs-photo-save');await expect(save).toBeVisible();await expect(save).toHaveClass(/ui-button/);await expect(save).toHaveCSS("border-top-style","solid");await save.click();await expect(editor).toBeHidden();const pencil=page.locator('[data-section="summary-photos"] .project-picture-holder > .bs-photo-control > .bs-photo-stage > .bs-photo-toggle');await expect(pencil).toHaveAttribute('aria-expanded','false');await expect.poll(async()=>{const image=await page.locator('.project-summary-photo-grid img').first().boundingBox(),icon=await pencil.boundingBox();return Math.abs(image.x+image.width-icon.x-icon.width);}).toBeLessThan(2);await pencil.click();await expect(editor).toBeVisible();

 let s=await f.state();expect(s.media.filter(row=>row.active).length).toBe(1);expect(s.files.length).toBe(2);
 await page.goto("/project.html?project="+f.id+"&item="+f.itemId);
 await page.getByRole("button",{name:"Edit photos",exact:true}).click();
 await page.getByLabel('Photo library files',{exact:true}).setInputFiles([{name:'front.png',mimeType:'image/png',buffer:PNG},{name:'side.png',mimeType:'image/png',buffer:PNG}]);
 await expect(page.getByRole('button',{name:'Use front.png as main',exact:true})).toBeVisible();await page.getByRole('button',{name:'Use front.png as main',exact:true}).click();
 await expect(page.locator('.project-part-photos img.project-picture')).toHaveCount(1);await page.getByRole('button',{name:'Use side.png as main',exact:true}).click();await expect(page.locator('[data-notice]')).toContainText('Main photo saved');
 s=await f.state();expect(s.media.filter(row=>row.role==='picture').length).toBe(2);expect(s.media.filter(row=>row.role==='picture'&&row.active).length).toBe(1);expect(s.media.filter(row=>row.item_id===f.itemId&&row.role==='photo'&&row.active)).toHaveLength(2);
 const firstPhoto=s.media.filter(row=>row.active&&row.role==='photo'&&!row.item_id).sort((a,b)=>a.sort_order-b.sort_order||a.id.localeCompare(b.id))[0];
 await page.getByRole('button',{name:'All projects',exact:true}).click();
 const card=page.locator('[data-catalog-id="'+f.id+'"]'),cover=card.locator('img');await expect(cover).toHaveAttribute('src',f.base+'/files/'+firstPhoto.file_id+'?inline=1');await expect(cover).toHaveJSProperty('naturalWidth',1);
 await page.getByLabel('Project view',{exact:true}).selectOption('tiles');await expect(card.locator('img')).toHaveAttribute('src',f.base+'/files/'+firstPhoto.file_id+'?inline=1');

});

for(const width of [390,1440])test('one photo library accepts chooser paste drop and selects a main without reupload at '+width,async({page,request,context})=>{
 await page.setViewportSize({width,height:1000});const f=await setup(page,request,context);await page.goto('/project.html?project='+f.id+'&item='+f.itemId);await page.getByRole('button',{name:'Edit photos',exact:true}).click();
 const library=page.locator('[data-section="part-photos"]'),slot=page.getByRole('region',{name:'Main photo slot',exact:true});
 await expect(page.locator('input[type="file"][accept="image/*"]')).toHaveCount(1);await expect(page.getByRole('textbox',{name:'Paste a copied photo',exact:true})).toHaveCount(1);
 const transfer=async(kind,name)=>page.getByRole('textbox',{name:'Paste a copied photo',exact:true}).evaluate((el,{kind,name,bytes})=>{const data=new DataTransfer();data.items.add(new File([Uint8Array.from(bytes)],name,{type:'image/png'}));el.dispatchEvent(kind==='paste'?new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}):new DragEvent('drop',{dataTransfer:data,bubbles:true,cancelable:true}));},{kind,name,bytes:[...PNG]});
 await transfer('paste','pasted.png');await expect(library.getByRole('button',{name:'Use pasted.png as main',exact:true})).toBeVisible();
 let s=await f.state();expect(s.media.filter(r=>r.role==='picture'&&r.active)).toHaveLength(0);expect(s.files).toHaveLength(1);
 const chooser=page.waitForEvent('filechooser');await library.getByRole('button',{name:'Add photos',exact:true}).click();await(await chooser).setFiles({name:'chosen.png',mimeType:'image/png',buffer:PNG});await expect(library.getByRole('button',{name:'Use chosen.png as main',exact:true})).toBeVisible();
 await transfer('drop','dropped.png');await expect(library.getByRole('button',{name:'Use dropped.png as main',exact:true})).toBeVisible();
 await library.getByRole('button',{name:'Use pasted.png as main',exact:true}).click();await expect(slot.locator('img')).toHaveCount(1);
 const drag=library.locator('figure').filter({has:page.getByRole('img',{name:'chosen.png',exact:true})});if(width===390)await library.getByRole('button',{name:'Use chosen.png as main',exact:true}).click();else await drag.dragTo(slot);
 await expect.poll(async()=>{const state=await f.state(),main=state.media.find(r=>r.active&&r.role==='picture');return state.files.find(file=>file.id===main?.file_id)?.name}).toBe('chosen.png');
 s=await f.state();expect(s.files).toHaveLength(3);expect(s.media.filter(r=>r.role==='photo'&&r.active)).toHaveLength(3);await expect(library.locator('.project-library-main-label')).toHaveCount(1);
 await page.reload();await expect(slot.locator('img')).toHaveJSProperty('naturalWidth',1);await page.getByRole('button',{name:'Edit photos',exact:true}).click();await page.getByRole('button',{name:'Clear main',exact:true}).click();await expect(slot.locator('img')).toHaveCount(0);s=await f.state();expect(s.media.filter(r=>r.role==='photo'&&r.active)).toHaveLength(3);expect(s.files).toHaveLength(3);
});

for(const width of [390,1440])test('library upload has immediate feedback and failure keeps main photo at '+width,async({page,request,context})=>{
 await page.setViewportSize({width,height:1000});const f=await setup(page,request,context);await page.goto('/project.html?project='+f.id+'&item='+f.itemId);await page.getByRole('button',{name:'Edit photos',exact:true}).click();
 let releaseUpload;const paused=new Promise(resolve=>releaseUpload=resolve);await page.route('**/files/prepare',async route=>{await paused;await route.continue();});
 const paste=async(name)=>page.getByRole('textbox',{name:'Paste a copied photo',exact:true}).evaluate((el,{name,bytes})=>{const data=new DataTransfer();data.items.add(new File([Uint8Array.from(bytes)],name,{type:'image/png'}));el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));},{name,bytes:[...PNG]});
 await paste('pending.png');const preview=page.getByRole('img',{name:'Uploading photo — not saved yet',exact:true});await expect(preview).toBeVisible();await expect(page.getByRole('progressbar',{name:'Photo upload in progress'})).toBeVisible();expect((await f.state()).files).toHaveLength(0);releaseUpload();await expect(preview).toHaveCount(0);await page.getByRole('button',{name:'Use pending.png as main',exact:true}).click();await expect(page.locator('[data-notice]')).toContainText('Main photo saved');const before=await f.state();
 await page.unroute('**/files/prepare');await page.route('**/media',route=>route.request().method()==='POST'?route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Photo save temporarily unavailable'})}):route.continue());
 await paste('failed.png');await expect(page.locator('.project-upload-feedback:visible')).toContainText('Photo save temporarily unavailable');await expect(preview).toHaveCount(0);expect((await f.state()).media).toEqual(before.media);
});

for(const width of [390,1440])test('approved part photo layout and preview arrows preserve saved main at '+width,async({page,request,context},testInfo)=>{
 await page.setViewportSize({width,height:1100});const f=await setup(page,request,context);await page.goto('/project.html?project='+f.id+'&item='+f.itemId);
 const photos=page.locator('.project-part-photos'),slot=photos.getByRole('region',{name:'Main photo slot',exact:true}),next=photos.getByRole('button',{name:'Next photo',exact:true}),previous=photos.getByRole('button',{name:'Previous photo',exact:true});
 await expect(next).toBeHidden();await photos.getByRole('button',{name:'Edit photos',exact:true}).click();
 await photos.getByLabel('Photo library files',{exact:true}).setInputFiles('assets/default-code-photo.webp');await expect(photos.locator('figure')).toHaveCount(1);await expect(next).toBeHidden();
 await photos.getByLabel('Photo library files',{exact:true}).setInputFiles(['assets/default-document-photo.webp']);await expect(photos.locator('figure')).toHaveCount(2);
 await photos.getByLabel('Photo library files',{exact:true}).setInputFiles({name:'detail.png',mimeType:'image/png',buffer:PNG});await expect(photos.locator('figure')).toHaveCount(3);
 await photos.getByRole('button',{name:'Use default-code-photo.webp as main',exact:true}).click();await expect(slot.locator('img')).toBeVisible();const before=await f.state();let writes=0;page.on('request',request=>{if(request.method()!=='GET'&&request.url().includes(f.base))writes++;});
 await expect(photos.locator('.part-photo-navigation')).toHaveText('‹1 / 3›');await next.click();await expect(photos.locator('.part-photo-caption')).toContainText('default-document-photo.webp · Preview');await previous.click();await expect(photos.locator('.part-photo-caption')).toContainText('default-code-photo.webp · Main photo');await previous.click();await expect(photos.locator('.part-photo-navigation')).toHaveText('‹3 / 3›');await slot.press('ArrowRight');await expect(photos.locator('.part-photo-navigation')).toHaveText('‹1 / 3›');await slot.press('ArrowLeft');await expect(photos.locator('.part-photo-navigation')).toHaveText('‹3 / 3›');await next.click();
 expect(writes).toBe(0);expect(await f.state()).toEqual(before);
 const bounds=await photos.boundingBox(),controls=await page.locator('.project-build-controls').boundingBox(),main=await photos.locator('.part-photo-main').boundingBox(),library=await photos.locator('.part-photo-library').boundingBox(),done=await photos.getByRole('button',{name:'Done',exact:true}).boundingBox();expect(controls.y).toBeGreaterThanOrEqual(bounds.y+bounds.height);expect(Math.abs(done.x+done.width-bounds.x-bounds.width)).toBeLessThan(2);
 if(width===390){expect(library.y).toBeGreaterThan(main.y+main.height);}else{expect(Math.abs(main.y-library.y)).toBeLessThan(2);expect(library.x).toBeGreaterThan(main.x+main.width);}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);await page.screenshot({path:testInfo.outputPath('approved-photo-layout.png'),fullPage:true});
 await photos.getByRole('button',{name:'Done',exact:true}).click();await expect(photos.locator('.part-photo-library')).toBeHidden();await expect(next).toBeVisible();await next.click();expect(await f.state()).toEqual(before);await page.reload();await expect(slot.locator('img')).toHaveAttribute('alt','default-code-photo.webp');
 await photos.getByRole('button',{name:'Edit photos',exact:true}).click();await photos.getByRole('button',{name:'Edit caption for default-document-photo.webp',exact:true}).click();await page.getByLabel('Caption',{exact:true}).fill('Side view');await page.getByRole('button',{name:'Save caption',exact:true}).click();await expect(photos.getByRole('button',{name:'Edit caption for Side view',exact:true})).toBeVisible();await photos.getByRole('button',{name:'Remove Side view',exact:true}).click();await page.getByRole('button',{name:'Remove photo',exact:true}).click();await expect(photos.locator('figure')).toHaveCount(2);const after=await f.state();expect(after.media.find(row=>row.active&&row.role==='picture').file_id).toBe(before.media.find(row=>row.active&&row.role==='picture').file_id);expect(after.files).toHaveLength(3);
});
