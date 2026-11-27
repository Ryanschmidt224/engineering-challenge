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
for(const width of [390,1440])test('ordered project part and subassembly galleries share controls at '+width,async({page,request,context},testInfo)=>{
 await page.setViewportSize({width,height:1100});const f=await setup(page,request,context);
 await page.goto('/project.html?project='+f.id+'&item='+f.itemId);
 const root=page.locator('.project-photo-gallery'),viewer=root.getByRole('region',{name:'Photo viewer'}),library=root.locator('[data-section="part-photos"]');
 await expect(root.getByRole('button',{name:'Next photo'})).toBeHidden();await root.getByRole('button',{name:'Edit photos',exact:true}).click();await expect(root.getByRole('button',{name:'Done',exact:true})).toHaveClass(/ui-button--primary/);
 await expect(page.locator('input[type="file"][accept="image/*"]')).toHaveCount(1);
 const paste=async(name)=>root.getByRole('textbox',{name:'Paste a copied photo'}).evaluate((el,{name,bytes})=>{const data=new DataTransfer();data.items.add(new File([Uint8Array.from(bytes)],name,{type:'image/png'}));el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));},{name,bytes:[...PNG]});
 await paste('pasted.png');await expect(viewer.locator('img')).toHaveAttribute('alt','pasted.png');await expect(root.getByRole('button',{name:'Next photo'})).toBeHidden();
 await root.getByLabel('Photo library files').setInputFiles(['assets/default-code-photo.webp','assets/default-document-photo.webp']);await expect(library.locator('figure')).toHaveCount(3);let s=await f.state();expect(s.files).toHaveLength(3);
 const order=()=>f.state().then(s=>s.media.filter(r=>r.active&&r.role==='photo'&&r.item_id===f.itemId).sort((a,b)=>a.sort_order-b.sort_order).map(r=>s.files.find(file=>file.id===r.file_id).name));
 if(width===1440)await library.locator('figure').nth(2).dragTo(library.locator('figure').nth(0));else await root.getByRole('button',{name:'Move photo 3 earlier',exact:true}).click();
 await expect.poll(order).toEqual(width===1440?['default-document-photo.webp','pasted.png','default-code-photo.webp']:['pasted.png','default-document-photo.webp','default-code-photo.webp']);await expect(root.locator('.project-library-main')).toHaveCount(1);
 const before=await f.state();let writes=0;page.on('request',r=>{if(r.method()!=='GET'&&r.url().includes(f.base))writes++;});await root.getByRole('button',{name:'Previous photo'}).click();await expect(root.locator('.part-photo-navigation')).toHaveText('‹3 / 3›');await viewer.press('ArrowRight');await expect(root.locator('.part-photo-navigation')).toHaveText('‹1 / 3›');await root.getByRole('button',{name:'Next photo'}).click();expect(await f.state()).toEqual(before);expect(writes).toBe(0);
 await page.getByRole('button',{name:'Project summary',exact:true}).click();await page.locator('[data-occurrence-id]').last().click();await expect(root.locator('.part-photo-navigation')).toHaveText('‹1 / 3›');
 const controls=await page.locator('.project-build-controls').boundingBox(),photos=await root.boundingBox();expect(controls.y+controls.height).toBeLessThanOrEqual(photos.y);expect(await page.locator('.project-build-controls').evaluate(el=>el.closest('.project-photo-gallery'))).toBeNull();await expect(root.locator('.part-photo-caption,.part-photo-hint')).toHaveCount(0);await expect(root.getByRole('button',{name:/Use .* as main/})).toHaveCount(0);
 await viewer.locator('img').evaluate(img=>{Object.defineProperty(img,'naturalWidth',{value:100});Object.defineProperty(img,'naturalHeight',{value:100});});await viewer.locator('img').dblclick();const full=page.getByRole('dialog',{name:'Full-screen photo',exact:true});await expect(full).toBeVisible();const start=await full.locator('img').getAttribute('src');await full.press('ArrowRight');expect(await full.locator('img').getAttribute('src')).not.toBe(start);await full.getByRole('button',{name:'Previous photo',exact:true}).click();await expect(full.locator('img')).toHaveAttribute('src',start);await full.getByRole('button',{name:'Close full-screen photo',exact:true}).click();
 const firstName=(await order())[0];await expect(viewer.locator('img')).toHaveAttribute('alt',firstName);await root.getByRole('button',{name:'Done',exact:true}).click();await expect(library).toBeHidden();await root.getByRole('button',{name:'Edit photos',exact:true}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);await page.screenshot({path:testInfo.outputPath('ordered-gallery.png'),fullPage:true});
 await library.getByRole('button',{name:'Edit caption for '+firstName,exact:true}).click();await page.getByLabel('Caption',{exact:true}).fill('Front view');await page.getByRole('button',{name:'Save caption',exact:true}).click();await expect(viewer.locator('img')).toHaveAttribute('alt','Front view');await library.getByRole('button',{name:'Remove Front view',exact:true}).click();await page.getByRole('button',{name:'Remove photo',exact:true}).click();await expect(library.locator('figure')).toHaveCount(2);expect((await f.state()).files).toHaveLength(3);
 // A second assembly keeps the first one on its own page instead of folding it into summary.
 for(const name of ['First assembly','Second assembly']){s=await f.state();const r=await context.request.post(f.base+'/items',{headers:{origin:'http://127.0.0.1:4173'},data:{operationId:crypto.randomUUID(),expectedRevision:s.project.revision,details:{name,is_assembly:true}}});expect(r.ok()).toBe(true);if(name==='First assembly'){f.assembly=await r.json();}}
 await page.goto('/project.html?project='+f.id+'&item='+f.assembly.itemId);await expect(root).toContainText('Subassembly photos');await root.getByRole('button',{name:'Edit photos',exact:true}).click();await root.getByLabel('Photo library files').setInputFiles({name:'assembly.png',mimeType:'image/png',buffer:PNG});await expect(viewer.locator('img')).toHaveAttribute('alt','assembly.png');
 await page.getByRole('button',{name:'Project summary',exact:true}).click();await page.locator('[data-section="summary-photos"] > summary').click();const project=page.locator('.project-photo-gallery[data-photo-owner="project"]');await project.getByRole('button',{name:'Edit photos',exact:true}).click();await project.getByLabel('Photo library files').setInputFiles({name:'cover.png',mimeType:'image/png',buffer:PNG});await expect(project.getByRole('region',{name:'Photo viewer'}).locator('img')).toHaveAttribute('alt','cover.png');await page.getByRole('button',{name:'All projects',exact:true}).click();await expect(page.locator('[data-catalog-id="'+f.id+'"] img')).toHaveJSProperty('naturalWidth',1);
});
for(const width of [390,1440])test('ordered gallery upload feedback and failed attachment preserve existing photos at '+width,async({page,request,context})=>{
 await page.setViewportSize({width,height:1000});const f=await setup(page,request,context);await page.goto('/project.html?project='+f.id+'&item='+f.itemId);const root=page.locator('.project-photo-gallery');await root.getByRole('button',{name:'Edit photos',exact:true}).click();
 let release;const paused=new Promise(r=>release=r);await page.route('**/files/prepare',async route=>{await paused;await route.continue();});const upload=root.getByLabel('Photo library files').setInputFiles({name:'pending.png',mimeType:'image/png',buffer:PNG});await expect(page.getByRole('img',{name:'Uploading photo — not saved yet'})).toBeVisible();await expect(page.getByRole('progressbar',{name:'Photo upload in progress'})).toBeVisible();release();await upload;await expect(root.locator('figure')).toHaveCount(1);const before=await f.state();
 await page.unroute('**/files/prepare');await page.route('**/media',route=>route.request().method()==='POST'?route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Photo save temporarily unavailable'})}):route.continue());await root.getByLabel('Photo library files').setInputFiles({name:'failed.png',mimeType:'image/png',buffer:PNG});await expect(page.locator('.project-upload-feedback:visible')).toContainText('Photo save temporarily unavailable');expect((await f.state()).media).toEqual(before.media);
});

for(const width of [390,1440])test('photo reorder gives immediate feedback and reuses thumbnails after a lost reply at '+width,async({page,request,context},testInfo)=>{
 await page.setViewportSize({width,height:1100});const f=await setup(page,request,context);await page.goto('/project.html?project='+f.id+'&item='+f.itemId);
 const root=page.locator('.project-photo-gallery'),library=root.locator('.part-photo-library'),tiles=library.locator('figure');
 await root.getByRole('button',{name:'Edit photos',exact:true}).click();await root.getByLabel('Photo library files').setInputFiles(['assets/default-code-photo.webp','assets/default-document-photo.webp']);await expect(tiles).toHaveCount(2);
 const initial=await tiles.evaluateAll(nodes=>nodes.map(n=>n.dataset.mediaId));
 await tiles.evaluateAll(nodes=>{nodes.forEach((node,i)=>{node.dataset.retainedTile=String(i);node.querySelector('img').dataset.retainedImage=String(i);});});
 let release,requests=[],stateReads=0;const held=new Promise(resolve=>release=resolve);
 page.on('request',r=>{if(new URL(r.url()).pathname===f.base+'/state')stateReads++;});
 await page.route('**/media/reorder',async route=>{
  requests.push(route.request().postDataJSON());
  if(requests.length===1){await held;await route.fetch();await route.fulfill({status:503,json:{error:'Order reply was lost'}});}
  else await route.continue();
 });
 await root.getByRole('button',{name:'Move photo 2 earlier',exact:true}).click();
 await expect(root.getByRole('progressbar',{name:'Saving photo order',exact:true})).toBeVisible();
 await expect(root.getByRole('status').filter({hasText:'Saving photo order…'})).toBeVisible();
 await expect(root.getByRole('button',{name:'Done',exact:true})).toBeDisabled();expect(await tiles.evaluateAll(nodes=>nodes.map(n=>n.dataset.mediaId))).toEqual(initial);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);await root.screenshot({path:testInfo.outputPath('photo-order-saving.png')});
 release();await expect(root.getByRole('status').filter({hasText:'Order reply was lost'})).toBeVisible();await expect(root.getByRole('progressbar',{name:'Saving photo order',exact:true})).toBeHidden();
 expect(await tiles.evaluateAll(nodes=>nodes.map(n=>n.dataset.mediaId))).toEqual(initial);
 await root.getByRole('button',{name:'Move photo 2 earlier',exact:true}).click();
 await expect(tiles.first()).toHaveAttribute('data-media-id',initial[1]);await expect(root.getByRole('button',{name:'Done',exact:true})).toBeEnabled();
 expect(requests[1]).toEqual(requests[0]);expect(stateReads).toBe(0);
 expect(await tiles.evaluateAll(nodes=>nodes.map(n=>[n.dataset.retainedTile,n.querySelector('img').dataset.retainedImage]))).toEqual([['1','1'],['0','0']]);
 // Repeated controls use their current positions after nodes move in place.
 await root.getByRole('button',{name:'Move photo 1 later',exact:true}).click();await expect(tiles.first()).toHaveAttribute('data-media-id',initial[0]);
 const current=await f.state();const changed=await context.request.patch(f.base,{headers:{origin:'http://127.0.0.1:4173'},data:{operationId:crypto.randomUUID(),expectedRevision:current.project.revision,name:'Edited elsewhere'}});expect(changed.ok()).toBe(true);
 await root.getByRole('button',{name:'Move photo 2 earlier',exact:true}).click();await expect(root.getByRole('status').filter({hasText:/changed/i})).toBeVisible();expect(await tiles.evaluateAll(nodes=>nodes.map(n=>n.dataset.mediaId))).toEqual(initial);
 await page.reload();await expect(root.getByRole('region',{name:'Photo viewer'}).locator('img')).toHaveAttribute('alt','default-code-photo.webp');
});
