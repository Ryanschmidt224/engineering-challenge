import {test,expect} from '@playwright/test';
const origin='http://127.0.0.1:4173',base='/api/project-engine/projects';
test.beforeEach(async({request,context})=>{
 const {cookie}=await(await request.post('/__test__/reset')).json(),at=cookie.indexOf('=');await context.addCookies([{name:cookie.slice(0,at),value:cookie.slice(at+1),url:origin,httpOnly:true,sameSite:'Strict'}]);
});
for(const width of [390,1440])test('permanent project numbers distinguish identical names, warn before saving and search independently at '+width,async({page})=>{
 await page.setViewportSize({width,height:950});await page.goto('/project.html');
 async function newProject(name){await page.getByRole('button',{name:'New project',exact:true}).click();await page.getByRole('dialog',{name:'New project',exact:true}).getByLabel('Project name',{exact:true}).fill(name);await page.getByRole('dialog',{name:'New project',exact:true}).getByRole('button',{name:'Create project',exact:true}).click();}
 await newProject('USB-C supply');await expect(page.getByRole('heading',{name:'P1001 — USB-C supply',exact:true})).toBeVisible();const first=new URL(page.url()).searchParams.get('project');
 await page.getByRole('button',{name:'All projects',exact:true}).click();await newProject('  usb-c   SUPPLY  ');
 const warning=page.getByRole('dialog',{name:'Project name already used',exact:true});await expect(warning).toContainText('P1001 — USB-C supply');await expect(warning.getByRole('button',{name:'Change name',exact:true})).toBeFocused();
 expect((await(await page.request.get(base)).json()).projects).toHaveLength(1);
 await warning.getByRole('button',{name:'Change name',exact:true}).click();const editor=page.getByRole('dialog',{name:'New project',exact:true});await expect(editor).toBeVisible();await expect(editor.getByLabel('Project name',{exact:true})).toHaveValue('  usb-c   SUPPLY  ');
 await editor.getByLabel('Project name',{exact:true}).fill('USB-C supply');await editor.getByRole('button',{name:'Create project',exact:true}).click();await warning.getByRole('button',{name:'Keep same name',exact:true}).click();
 await expect(page.getByRole('heading',{name:'P1002 — USB-C supply',exact:true})).toBeVisible();const second=new URL(page.url()).searchParams.get('project');expect(second).not.toBe(first);
 await page.getByRole('button',{name:'All projects',exact:true}).click();const firstCard=page.getByRole('button',{name:'Open P1001 — USB-C supply',exact:true}),secondCard=page.getByRole('button',{name:'Open P1002 — USB-C supply',exact:true});await expect(firstCard).toBeVisible();await expect(secondCard).toBeVisible();
 await page.getByLabel('Search projects',{exact:true}).fill('P1002');await expect(firstCard).toHaveCount(0);await expect(secondCard).toBeVisible();await secondCard.click();
 await page.getByRole('button',{name:'Project settings',exact:true}).click();await expect(page.locator('[data-project-content]')).toContainText('Project number: P1002');await page.getByLabel('Project name',{exact:true}).fill('Different supply');await page.getByRole('button',{name:'Save settings',exact:true}).click();
 await page.getByRole('button',{name:'Project summary',exact:true}).click();await expect(page.getByRole('heading',{name:'P1002 — Different supply',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Project settings',exact:true}).click();await page.getByLabel('Project name',{exact:true}).fill('USB-C SUPPLY');await page.getByRole('button',{name:'Save settings',exact:true}).click();await expect(warning).toContainText('P1001 — USB-C supply');await warning.getByRole('button',{name:'Change name',exact:true}).click();
 expect((await(await page.request.get(base+'/'+second+'/state')).json()).project.name).toBe('Different supply');expect((await(await page.request.get(base+'/'+first+'/state')).json()).project.name).toBe('USB-C supply');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('duplicate-name approval survives a lost creation response without a second project or number',async({page})=>{
 const existing=crypto.randomUUID();await page.request.post(base+'/'+existing,{headers:{origin},data:{operationId:crypto.randomUUID(),expectedRevision:null,name:'Same name'}});
 await page.goto('/project.html');await page.getByRole('button',{name:'New project',exact:true}).click();const editor=page.getByRole('dialog',{name:'New project',exact:true});await editor.getByLabel('Project name',{exact:true}).fill('Same name');
 let failed=false;const writes=[];await page.route('**/api/project-engine/projects/*',async route=>{
  if(route.request().method()!=='POST')return route.continue();writes.push(route.request().postDataJSON());if(!failed){failed=true;await route.fetch();await route.abort('failed');}else await route.continue();
 });
 await editor.getByRole('button',{name:'Create project',exact:true}).click();await page.getByRole('dialog',{name:'Project name already used'}).getByRole('button',{name:'Keep same name'}).click();await expect(editor.getByRole('alert')).toContainText(/fetch|network/i);
 await editor.getByRole('button',{name:'Create project',exact:true}).click();await expect(page.getByRole('heading',{name:'P1002 — Same name',exact:true})).toBeVisible();expect(writes).toHaveLength(2);expect(writes[1]).toEqual(writes[0]);
 const projects=(await(await page.request.get(base)).json()).projects;expect(projects.map(p=>p.project_number).sort()).toEqual([1001,1002]);
});
