import {test,expect} from '@playwright/test';
const origin='http://127.0.0.1:4173',endpoint='/api/project-engine/backup-reminder';
test.beforeEach(async({request,context})=>{
 const {cookie}=await(await request.post('/__test__/reset')).json(),at=cookie.indexOf('=');
 await context.addCookies([{name:cookie.slice(0,at),value:cookie.slice(at+1),url:origin,httpOnly:true,sameSite:'Strict'}]);
});
const banner=page=>page.getByRole('complementary',{name:'Backup copy reminder'});
const status=page=>page.locator('[data-backup-reminder-settings]');
async function installSavePicker(page,mode='success'){
 await page.addInitScript(mode=>{
  window.backupSave={chunks:[],closed:false,aborted:false};
  window.showSaveFilePicker=async()=>{
   if(mode==='cancel')throw new DOMException('Cancelled','AbortError');
   return {createWritable:async()=>({write:async bytes=>window.backupSave.chunks.push([...bytes]),close:async()=>{if(mode==='close-fails')throw Error('Fixture disk full');window.backupSave.closed=true;},abort:async()=>{window.backupSave.aborted=true;}})};
  };
 },mode);
}
for(const width of [390,1440])test('owner reminder is inline across pages; snooze persists on another device at '+width,async({page,context,browser})=>{
 await page.setViewportSize({width,height:900});
 for(const path of ['/project.html','/workshop.html','/knowledge.html','/calculators.html']){
  await page.goto(path);await expect(banner(page)).toBeVisible();
  await expect(banner(page)).toContainText('No backup copy outside Cloudflare has been recorded.');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(await banner(page).evaluate(el=>['static','relative'].includes(getComputedStyle(el).position))).toBe(true);
 }
 await banner(page).getByRole('link',{name:'Download now',exact:true}).click();
 await expect(page.locator('#data-backup')).toHaveAttribute('open','');
 await expect(status(page)).toContainText('Never recorded');
 await banner(page).getByRole('button',{name:'Remind me in 3 days'}).click();await expect(banner(page)).toBeHidden();
 await page.reload();await expect(status(page)).toContainText('Reminder snoozed until');await expect(banner(page)).toBeHidden();
 const other=await browser.newContext();try{
  await other.addCookies(await context.cookies());const second=await other.newPage();await second.goto(origin+'/project.html');
  const response=await second.request.get(endpoint);expect((await response.json()).due).toBe(false);await expect(banner(second)).toBeHidden();
 }finally{await other.close();}
});
test('manual confirmation requires second approval; interval validates; errors keep the reminder visible',async({page})=>{
 await page.goto('/website-settings.html');const section=status(page),button=section.getByRole('button',{name:'I saved a copy outside Cloudflare',exact:true});
 await expect(banner(page)).toBeVisible();await button.click();const dialog=page.getByRole('dialog',{name:'Copy saved outside Cloudflare?'});
 await expect(dialog).toContainText('The website cannot check where you stored it.');await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
 expect((await(await page.request.get(endpoint)).json()).lastConfirmed).toBeNull();await expect(banner(page)).toBeVisible();
 await page.route('**/api/project-engine/backup-reminder',route=>route.request().method()==='POST'?route.fulfill({status:503,json:{error:'Fixture confirmation unavailable'}}):route.continue());
 await button.click();await dialog.getByRole('button',{name:'Confirm copy saved',exact:true}).click();await expect(section).toContainText('Fixture confirmation unavailable');await expect(banner(page)).toBeVisible();
 await page.unroute('**/api/project-engine/backup-reminder');await button.click();await dialog.getByRole('button',{name:'Confirm copy saved',exact:true}).click();await expect(banner(page)).toBeHidden();await expect(section).toContainText('(today)');
 const interval=section.getByLabel('Remind me every (days)');await interval.fill('6');await section.getByRole('button',{name:'Save reminder interval'}).click();expect((await(await page.request.get(endpoint)).json()).intervalDays).toBe(30);
 await interval.fill('14');await section.getByRole('button',{name:'Save reminder interval'}).click();await expect(section).toContainText('Reminder interval saved.');await page.reload();await expect(status(page).getByLabel('Remind me every (days)')).toHaveValue('14');
 // Reminder saves must not turn an unrelated owner/tag draft into a stale save.
 await page.getByRole('button',{name:'Add tag',exact:true}).click();await page.getByLabel('Tag 6',{exact:true}).fill('Reminder-safe tag');
 await status(page).getByLabel('Remind me every (days)').fill('21');await status(page).getByRole('button',{name:'Save reminder interval'}).click();await expect(status(page)).toContainText('Reminder interval saved.');
 await page.getByRole('button',{name:'Save settings',exact:true}).click();await expect(page.getByRole('status')).toHaveText('Website settings saved.');
 const settings=await(await page.request.get('/api/project-engine/settings')).json();expect(settings.tags).toContain('Reminder-safe tag');expect(settings.backupReminder.intervalDays).toBe(21);
});
test('completed manual save records download only, until outside-copy confirmation clears the reminder',async({page})=>{
 await installSavePicker(page);await page.goto('/website-settings.html');await expect(banner(page)).toBeVisible();
 await page.getByRole('button',{name:'Backup all data',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Copy saved outside Cloudflare?'});await expect(dialog).toBeVisible();
 expect(await page.evaluate(()=>window.backupSave.closed)).toBe(true);
 let data=await(await page.request.get(endpoint)).json();expect(data.lastDownloaded.source).toBe('manual');expect(data.lastConfirmed).toBeNull();expect(data.due).toBe(true);
 await dialog.getByRole('button',{name:'Confirm copy saved',exact:true}).click();await expect(banner(page)).toBeHidden();
 data=await(await page.request.get(endpoint)).json();expect(data.lastConfirmed.backupCreatedAt).toBe(data.lastDownloaded.backupCreatedAt);
 await page.reload();await expect(status(page)).toContainText('Confirmed backup created');await expect(banner(page)).toBeHidden();
});
for(const mode of ['cancel','close-fails'])test('a '+mode+' save does not record a download or an outside copy',async({page})=>{
 await installSavePicker(page,mode);await page.goto('/website-settings.html');await expect(banner(page)).toBeVisible();await page.getByRole('button',{name:'Backup all data',exact:true}).click();
 if(mode==='close-fails'){
  const alert=page.getByRole('dialog',{name:'Backup could not be saved'});await expect(alert).toContainText('Fixture disk full');await alert.getByRole('button',{name:'Close',exact:true}).click();expect(await page.evaluate(()=>window.backupSave.aborted)).toBe(true);
 }
 await expect(page.getByRole('button',{name:'Backup all data',exact:true})).toBeEnabled();
 const data=await(await page.request.get(endpoint)).json();expect(data.lastDownloaded).toBeNull();expect(data.lastConfirmed).toBeNull();await expect(banner(page)).toBeVisible();
});
test('nightly save highlights newest verified copy, validates bytes and does not count a truncated stream',async({page,request})=>{
 expect((await request.post('/__test__/nightly-backup')).ok()).toBe(true);
 await installSavePicker(page);await page.goto('/website-settings.html#data-backup');const latest=page.locator('[data-newest-backup]');
 await expect(latest).toContainText('Newest verified copy');const download=latest.getByRole('button',{name:/Download whole-site backup from/});
 await page.route('**/api/automatic-site-backups?id=*',route=>route.fulfill({body:'truncated backup'}));
 await download.click();let alert=page.getByRole('dialog',{name:'Backup could not be saved'});await expect(alert).toContainText('incomplete');await alert.getByRole('button',{name:'Close',exact:true}).click();
 expect((await(await page.request.get(endpoint)).json()).lastDownloaded).toBeNull();expect(await page.evaluate(()=>window.backupSave.aborted)).toBe(true);
 await page.unroute('**/api/automatic-site-backups?id=*');await download.click();const confirm=page.getByRole('dialog',{name:'Copy saved outside Cloudflare?'});await expect(confirm).toBeVisible();
 const data=await(await page.request.get(endpoint)).json();expect(data.lastDownloaded.source).toBe('nightly');expect(data.lastConfirmed).toBeNull();
 await confirm.getByRole('button',{name:'Cancel',exact:true}).click();await expect(banner(page)).toBeVisible();
});
test('signed-out pages never show reminder and reject acknowledgement changes',async({browser})=>{
 const anonymous=await browser.newContext();try{const page=await anonymous.newPage();for(const path of ['/project-signin.html','/project.html','/workshop.html','/knowledge.html','/calculators.html']){
  await page.goto(origin+path);const response=await page.request.get(endpoint);expect(response.status()).toBe(401);await expect(banner(page)).toBeHidden();
 }expect((await page.request.post(endpoint,{headers:{origin},data:{action:'confirm',confirmed:true}})).status()).toBe(401);
 }finally{await anonymous.close();}
});
