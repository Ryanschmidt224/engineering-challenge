import {test,expect} from '@playwright/test';
test.describe.configure({mode:'serial'});
async function setup(page,context,request){
 const {cookie}=await(await request.post('/__test__/reset?engine=1')).json(),at=cookie.indexOf('=');await context.addCookies([{name:cookie.slice(0,at),value:cookie.slice(at+1),url:'http://127.0.0.1:4173',httpOnly:true,sameSite:'Strict'}]);
 const project=crypto.randomUUID(),base='/api/project-engine/projects/'+project;
 const state=async()=>(await(await page.request.get(base+'/state')).json());
 const write=async(path,data,method='POST')=>{const revision=path===''&&method==='POST'?null:(await state()).project.revision;const r=await page.request.fetch(base+path,{method,headers:{origin:'http://127.0.0.1:4173'},data:{...data,operationId:crypto.randomUUID(),expectedRevision:revision}});expect(r.ok(),await r.text()).toBe(true);return r.json();};
 await write('',{name:'CAD project'});await page.goto('/project.html?project='+project);return {project,base,state,write};
}
async function open(section){if(await section.getAttribute('open')===null)await section.locator(':scope > summary').click();}
async function add(page,section,name,url,kind){await open(section);await section.getByRole('button',{name:'+ Add Dropbox link',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Add Dropbox link',exact:true});await dialog.getByLabel('Name',{exact:true}).fill(name);await dialog.getByLabel('Link to',{exact:true}).selectOption(kind);await dialog.getByLabel('Dropbox link',{exact:true}).fill(url);return dialog;}
const file='https://www.dropbox.com/scl/fi/demo/bracket.step?rlkey=keep-me&dl=0',folder='https://www.dropbox.com/scl/fo/demo/assembly?rlkey=folder-key&dl=0';
for(const width of [390,1440])test('summary CAD section exists without an assembly, and file/folder links remain scoped at '+width,async({page,context,request},info)=>{
 await page.setViewportSize({width,height:1000});const f=await setup(page,context,request),summary=page.locator('[data-section="summary-cad-files"]');await expect(summary).toBeVisible();await expect(summary.locator('input[type=file]')).toHaveCount(0);
 let dialog=await add(page,summary,'Project CAD folder',folder,'folder');await dialog.getByRole('button',{name:'Save link',exact:true}).click();await expect(dialog).not.toBeVisible();await open(summary);await expect(summary.getByRole('link',{name:'Project CAD folder',exact:true})).toHaveAttribute('href',folder);await expect(summary.getByRole('link',{name:'Project CAD folder',exact:true})).toHaveAttribute('target','_blank');
 const assembly=await f.write('/items',{details:{name:'Top frame',is_assembly:true},build:{quantity:1}}),part=await f.write('/items',{details:{name:'Bracket'},parentId:assembly.occurrenceId});
 await page.reload();await open(summary);await expect(summary.getByRole('link',{name:'Project CAD folder',exact:true})).toBeVisible();
 await page.goto('/project.html?'+new URLSearchParams({project:f.project,item:part.itemId,occurrence:part.occurrenceId}));const cad=page.locator('[data-section="engineering-file"]');await open(cad);await expect(cad.getByRole('link')).toHaveCount(0);
 dialog=await add(page,cad,'Bracket CAD',file,'file');await dialog.getByRole('button',{name:'Save link',exact:true}).click();await expect(dialog).not.toBeVisible();await open(cad);await expect(cad.getByRole('link',{name:'Bracket CAD',exact:true})).toHaveAttribute('href',file);
 await page.reload();await open(cad);await expect(cad.getByRole('link',{name:'Bracket CAD',exact:true})).toBeVisible();
 const state=await f.state();expect(state.files).toHaveLength(0);expect(state.items.find(i=>i.id===part.itemId).fields.cad_links).toHaveLength(1);expect(JSON.parse(state.project.overview).cadLinks).toHaveLength(1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await cad.screenshot({path:info.outputPath('cad-links.png')});
 await cad.getByRole('button',{name:'Remove link',exact:true}).click();const confirmation=page.getByRole('dialog',{name:'Remove CAD link?',exact:true});await expect(confirmation).toContainText('Dropbox file or folder is kept');await confirmation.getByRole('button',{name:'Cancel',exact:true}).click();await expect(cad.getByRole('link',{name:'Bracket CAD',exact:true})).toBeVisible();
 await cad.getByRole('button',{name:'Remove link',exact:true}).click();await confirmation.getByRole('button',{name:'Remove link',exact:true}).click();await expect(confirmation).not.toBeVisible();expect((await f.state()).items.find(i=>i.id===part.itemId).fields.cad_links).toHaveLength(0);expect(JSON.parse((await f.state()).project.overview).cadLinks).toHaveLength(1);
});
test('lost link-save replies replay the original operation and rejected links retain their draft',async({page,context,request})=>{
 const f=await setup(page,context,request),section=page.locator('[data-section="summary-cad-files"]');const ids=[];let lost=false;
 await page.route('**/api/project-engine/projects/*/overview',async route=>{ids.push(route.request().postDataJSON().operationId);if(!lost){lost=true;await route.fetch();await route.abort('failed');}else await route.continue();});
 const dialog=await add(page,section,'Main CAD',folder,'folder');await dialog.getByRole('button',{name:'Save link',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('unconfirmed');await expect(dialog.getByLabel('Name',{exact:true})).toHaveValue('Main CAD');
 await dialog.getByRole('button',{name:'Save link',exact:true}).click();await expect(dialog).not.toBeVisible();expect(ids).toHaveLength(2);expect(ids[0]).toBe(ids[1]);expect(JSON.parse((await f.state()).project.overview).cadLinks).toHaveLength(1);
 const bad=await add(page,section,'Bad URL','https://dropbox.com.evil.test/s/id/cad','file');await bad.getByRole('button',{name:'Save link',exact:true}).click();await expect(bad.getByRole('alert')).toContainText('Dropbox');expect(ids).toHaveLength(2);await bad.getByRole('button',{name:'Cancel',exact:true}).click();
 const state=await f.state();const response=await page.request.post(f.base+'/files/prepare',{headers:{origin:'http://127.0.0.1:4173'},data:{name:'model.step',content_type:'application/octet-stream',expectedRevision:state.project.revision,operationId:crypto.randomUUID()}});expect(response.status()).toBe(400);expect((await response.json()).error).toContain('Dropbox');expect((await f.state()).files).toHaveLength(0);
});
