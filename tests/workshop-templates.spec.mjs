// Exercise real browser UI and real template/item API handlers using isolated R2.
import {test,expect} from '@playwright/test';
import {onRequest as templatesAPI} from '../functions/api/workshop-templates.js';
import {onRequest as referencesAPI} from '../functions/api/workshop-reference.js';
import {fixture,request,templateBody} from './helpers/workshop-fixture.mjs';
const category='electrical-switching';
let f;
test.beforeEach(async({page})=>{
 f=await fixture();
 await page.route('**/api/**',async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname;
  const handler=path==='/api/workshop-templates'?templatesAPI:path==='/api/workshop-reference'?referencesAPI:null;
  if(handler){
   const response=await handler({request:request(path+url.search,req.method(),req.postData()?req.postDataJSON():undefined,f.session),env:f.env});
   await route.fulfill({status:response.status,contentType:'application/json',body:await response.text()});return;
  }
  const data=path==='/api/accounts'?{user:f.user}:path==='/api/auth'?{authenticated:false}:
   path==='/api/personal-workshop'?{items:[]}:path==='/api/tree'?{nodes:[],revision:'test'}:
   path==='/api/components'?{components:[]}:path==='/api/workspace'?{workspace:{recipe:[],resources:[]},revision:'test'}:
   path==='/api/photos'?{photos:[]}:path==='/api/drawings'?{drawings:[]}:{};
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
});
const openWorkshop=async page=>{await page.goto('/#commonparts');await expect(page.locator('.workshop-template-launch')).toBeVisible()};
const manager=page=>page.locator('.workshop-template-manager');
const nameInput=page=>manager(page).getByPlaceholder('e.g., MOSFET, relay, pushbutton');
const savedSelect=page=>manager(page).getByLabel('Saved layouts');
const field= (page,key)=>page.locator(`[data-workshop-field="${key}"] > input:not(.workshop-table-rename),[data-workshop-field="${key}"] > textarea`);
const form=page=>page.locator('.workshop-item-edit-form');
const customRows=page=>page.locator('[data-part-editor-section="identity"] .workshop-table-custom-row');
async function seedTemplate(body=templateBody()){
 const res=await templatesAPI({request:request('/api/workshop-templates','POST',body,f.session),env:f.env});
 expect(res.status).toBe(200);return (await res.json()).template;
}
async function createFromCategory(page,templateId='',target=category){
 const button=page.locator(`.bs-workshop-category-sidebar [data-catalog-category="${target}"]`);
 // Electronics children can be inside a collapsed branch; expand its parent first.
 await page.locator('.bs-workshop-category-sidebar [data-catalog-category="electronics"]').click();
 await button.click({button:'right'});
 await page.getByRole('menuitem',{name:'Add part',exact:true}).click();
 const dialog=page.locator('.workshop-category-create-dialog');
 await expect(dialog.getByRole('button',{name:'Add part',exact:true})).toBeEnabled();
 await dialog.getByLabel('Master template').selectOption(templateId);
 await dialog.getByRole('button',{name:'Add part',exact:true}).click();
 await expect(form(page)).toBeVisible();
 if(templateId)await expect(page.locator('.workshop-template-status')).toContainText('Applied');
}

test('create, reopen, edit and delete a value-free master independently of catalog items',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await openWorkshop(page);await page.locator('.workshop-template-launch').click();
 await manager(page).getByLabel('Category').selectOption(category);
 await nameInput(page).fill('MOSFET');
 const identity=manager(page).locator('.workshop-template-manager-section').first();
 await identity.getByRole('button',{name:'+ Add row',exact:true}).click();
 await identity.locator('.workshop-template-row-label').fill('Gate rating');
 await identity.locator('.workshop-template-manager-standard-row').last().getByRole('checkbox').check();
 await manager(page).getByRole('button',{name:'Save template',exact:true}).click();
 await expect(manager(page).getByRole('status')).toContainText("Saved 'MOSFET'");
 const id=await savedSelect(page).inputValue();expect(id).toMatch(/^tpl-/);
 await page.reload();await page.locator('.workshop-template-launch').click();
 await manager(page).getByLabel('Category').selectOption(category);
 await expect(savedSelect(page).locator('option',{hasText:'MOSFET'})).toHaveCount(1);
 await savedSelect(page).selectOption(id);
 await expect(identity.locator('.workshop-template-row-label')).toHaveValue('Gate rating');
 await nameInput(page).fill('MOSFET Rev B');
 await manager(page).getByRole('button',{name:'Save template',exact:true}).click();
 await expect(manager(page).getByRole('status')).toContainText("Saved 'MOSFET Rev B'");
 page.once('dialog',dialog=>dialog.accept());
 await manager(page).getByRole('button',{name:'Delete template',exact:true}).click();
 await expect(manager(page).getByRole('status')).toContainText('deleted');
 expect(errors).toEqual([]);
});

test('right-click creation applies template, persists across refresh, and hides/restores fields without losing values',async({page})=>{
 const template=await seedTemplate();await openWorkshop(page);
 await createFromCategory(page,template.id);
 await expect(field(page,'name')).toHaveValue('');
 await expect(customRows(page).locator('[data-table-value]')).toHaveValue('');
 await form(page).getByRole('radio',{name:'Specific product',exact:true}).check();
 await field(page,'name').fill('Test MOSFET');
 await field(page,'partNumber').fill('MY-MPN');
 await customRows(page).locator('[data-table-value]').fill('5 V');
 const identity=page.locator('[data-part-editor-section="identity"]');
 await identity.getByRole('button',{name:'Edit table',exact:true}).click();
 const mpn=page.locator('[data-workshop-field="partNumber"]');
 await mpn.getByRole('button',{name:'Remove',exact:true}).click();
 await identity.getByRole('button',{name:'Done',exact:true}).click();
 await expect(mpn).toBeHidden();
 await form(page).getByRole('button',{name:'Create catalog item',exact:true}).click();
 await expect(page.locator('.workshop-under-image-edit')).toBeVisible();
 const url=page.url();await page.reload();await expect(page).toHaveURL(url);
 await page.locator('.workshop-under-image-edit').click();
 await identity.getByRole('button',{name:'Edit table',exact:true}).click();
 await mpn.getByRole('button',{name:'Restore',exact:true}).click();
 await identity.getByRole('button',{name:'Done',exact:true}).click();
 await expect(field(page,'partNumber')).toHaveValue('MY-MPN');
 await expect(customRows(page).locator('[data-table-value]')).toHaveValue('5 V');
});

test('generic/specific mode preserves ordering and existing values across template changes and deletion',async({page})=>{
 const first=await seedTemplate();
 const second=templateBody('Relay');second.tableLayout.sections.identity.rows=[{id:'row-22222222-2222-4222-8222-222222222222',label:'Contact rating',value:''}];second.productSections=[];
 const relay=await seedTemplate(second);await openWorkshop(page);await createFromCategory(page,first.id);
 await form(page).getByRole('radio',{name:'Specific product',exact:true}).check();
 await field(page,'name').fill('Existing switch');await field(page,'supplier').fill('Supplier to retain');
 await form(page).getByRole('radio',{name:'Generic component',exact:true}).check();
 await expect(page.locator('[data-part-editor-section="ordering"]')).toBeHidden();
 await form(page).getByRole('radio',{name:'Specific product',exact:true}).check();
 await expect(field(page,'supplier')).toHaveValue('Supplier to retain');
 await customRows(page).locator('[data-table-value]').fill('Retained custom value');
 await form(page).getByRole('button',{name:'Create catalog item',exact:true}).click();
 await page.locator('.workshop-under-image-edit').click();
 await page.getByLabel('Select a master template',{exact:true}).selectOption(relay.id);
 await form(page).getByRole('button',{name:'Use template',exact:true}).click();
 await expect(customRows(page)).toHaveCount(2);
 await expect(field(page,'name')).toHaveValue('Existing switch');
 await expect(field(page,'supplier')).toHaveValue('Supplier to retain');
 await form(page).getByRole('button',{name:'Save changes',exact:true}).click();
 await templatesAPI({request:request('/api/workshop-templates','DELETE',{id:relay.id,expectedRevision:relay.revision},f.session),env:f.env});
 await page.reload();await page.locator('.workshop-under-image-edit').click();
 await expect(customRows(page)).toHaveCount(2);
 await expect(customRows(page).locator('[data-table-value]').last()).toHaveValue('Retained custom value');
});

test('switching templates removes unrelated empty fields while keeping populated fields',async({page})=>{
 const first=await seedTemplate();const relayBody=templateBody('Relay');relayBody.tableLayout={};relayBody.productSections=[];
 const relay=await seedTemplate(relayBody);await openWorkshop(page);await createFromCategory(page,first.id);
 await expect(page.locator('.workshop-builder-field')).toHaveCount(1);
 await page.getByLabel('Select a master template',{exact:true}).selectOption(relay.id);
 await form(page).getByRole('button',{name:'Use template',exact:true}).click();
 await expect(customRows(page)).toHaveCount(0);await expect(page.locator('.workshop-builder-field')).toHaveCount(0);
});

test('category with no templates supports keyboard menu and blank creation; failed load remains usable',async({page})=>{
 await openWorkshop(page);
 await page.locator('.bs-workshop-category-sidebar [data-catalog-category="electronics"]').click();
 const power=page.locator('.bs-workshop-category-sidebar [data-catalog-category="electrical-power"]');
 await power.focus();await page.keyboard.press('Shift+F10');
 await page.getByRole('menuitem',{name:'Add part',exact:true}).click();
 const dialog=page.locator('.workshop-category-create-dialog');
 await expect(dialog.getByRole('status')).toContainText('No templates yet');
 await dialog.getByRole('button',{name:'Add part',exact:true}).click();
 await expect(form(page).getByLabel('Website category')).toHaveValue('electrical-power');
 await expect(customRows(page)).toHaveCount(0);
 await form(page).getByRole('button',{name:'Cancel',exact:true}).click();
 await page.route('**/api/workshop-templates',route=>route.fulfill({status:503,json:{error:'Offline'}}));
 await power.click({button:'right'});await page.getByRole('menuitem',{name:'Add part',exact:true}).click();
 await expect(dialog.getByRole('status')).toContainText('Could not load');
 await dialog.getByRole('button',{name:'Add part',exact:true}).click();await expect(form(page)).toBeVisible();
});

test('stale template save keeps the draft, blocks duplicate submits, and offers a fresh saved version',async({page})=>{
 const template=await seedTemplate();await openWorkshop(page);await page.locator('.workshop-template-launch').click();
 await manager(page).getByLabel('Category').selectOption(category);
 await savedSelect(page).selectOption(template.id);await nameInput(page).fill('My unsaved change');
 const other=await templatesAPI({request:request('/api/workshop-templates','PUT',{
  ...template,name:'Other contributor',expectedRevision:template.revision},f.session),env:f.env});expect(other.status).toBe(200);
 await manager(page).getByRole('button',{name:'Save template',exact:true}).click();
 await expect(manager(page).getByRole('status')).toContainText('changed since you opened');
 await expect(nameInput(page)).toHaveValue('My unsaved change');
 await manager(page).getByRole('button',{name:'Close',exact:true}).click();await page.locator('.workshop-template-launch').click();
 await expect(savedSelect(page).locator('option',{hasText:'Other contributor'})).toHaveCount(1);
 page.once('dialog',dialog=>dialog.accept());await savedSelect(page).selectOption(template.id);
 await expect(nameInput(page)).toHaveValue('Other contributor');
});

test('new template clears prior fields and category menu cleanup survives navigation at narrow width',async({page})=>{
 const template=await seedTemplate();await openWorkshop(page);await page.locator('.workshop-template-launch').click();
 await manager(page).getByLabel('Category').selectOption(category);await savedSelect(page).selectOption(template.id);
 await manager(page).getByRole('button',{name:'New template',exact:true}).click();
 await expect(nameInput(page)).toHaveValue('');await expect(manager(page).locator('.workshop-template-row-label')).toHaveCount(0);
 await expect(manager(page).locator('.workshop-builder-field')).toHaveCount(0);
 await manager(page).getByRole('button',{name:'Close',exact:true}).click();
 await page.setViewportSize({width:390,height:844});
 await page.locator('.bs-workshop-category-sidebar [data-catalog-category="electronics"]').click();
 await page.locator('.bs-workshop-category-sidebar [data-catalog-category="electrical-power"]').click({button:'right'});
 await page.getByRole('menuitem',{name:'Add part',exact:true}).click();
 await page.evaluate(()=>{location.hash='#projects'});
 await expect(page.locator('.workshop-category-create-dialog')).toHaveCount(0);
 await expect(page.locator('.workshop-category-context-menu')).toBeHidden();
});
