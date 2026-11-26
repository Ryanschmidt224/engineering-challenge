import {test,expect} from "@playwright/test";
const origin="http://127.0.0.1:4173";
test("home and old index open current Projects, with one working Account dialog",async({page,request,context})=>{
 const {cookie}=await(await request.post('/__test__/reset?engine=1')).json(),at=cookie.indexOf('=');await context.addCookies([{name:cookie.slice(0,at),value:cookie.slice(at+1),url:origin,httpOnly:true,sameSite:'Strict'}]);
 for(const path of ['/','/index.html?legacy=1#home']){await page.goto(path);await expect(page).toHaveURL(/\/project.html(?:#home)?$/);await expect(page.getByRole('button',{name:'New project',exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'Legacy projects',exact:true})).toHaveCount(0);}
 for(const path of ['/project.html','/workshop.html','/knowledge.html','/calculators.html','/website-settings.html']){
  await page.goto(path);await page.locator('.ui-site-account').click();await page.getByRole('menuitem',{name:'Account',exact:true}).click();await expect(page.getByRole('dialog',{name:'Owner account',exact:true})).toHaveCount(1);await expect(page.getByRole('dialog').getByRole('button',{name:'Sign out',exact:true})).toBeVisible();await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
 }
});
test('anonymous Projects serves sign-in without loading retired controllers',async({page,request,context})=>{
 await request.post('/__test__/reset?engine=1');await context.clearCookies();const paths=[];page.on('request',r=>paths.push(new URL(r.url()).pathname));const response=await page.goto('/project.html');expect(response.status()).toBe(401);await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('dialog',{name:'Owner account',exact:true})).toBeVisible();expect(paths.filter(path=>['/assets/site.js','/assets/site-assembly.js','/api/projects'].includes(path))).toEqual([]);
});
