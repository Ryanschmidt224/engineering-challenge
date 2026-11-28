import {test,expect} from "@playwright/test";
const origin="http://127.0.0.1:4173";
test.beforeEach(async({request,context})=>{const {cookie}=await(await request.post('/__test__/reset?engine=1')).json(),at=cookie.indexOf('=');await context.addCookies([{name:cookie.slice(0,at),value:cookie.slice(at+1),url:origin,httpOnly:true,sameSite:'Strict'}]);});

test("application startup remains usable under CSP and injected scripts are blocked",async({page})=>{
 const errors=[];page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 for(const path of ['/project.html','/workshop.html','/knowledge.html#calculators','/calculators.html','/website-settings.html']){
  const response=await page.goto(path);expect(response.headers()['content-security-policy']).toContain("script-src 'self'");expect(response.headers()['x-frame-options']).toBe('SAMEORIGIN');await expect(page.locator('.ui-site-brand')).toBeVisible();
  if(path==='/workshop.html')await expect(page.getByRole('button',{name:'Resistor 0 products',exact:true})).toBeVisible();
  else if(path.startsWith('/knowledge'))await expect(page.getByRole('button',{name:'+ Add lesson',exact:true})).toBeVisible();
  else if(path==='/calculators.html')await expect(page.locator('#resource-calculators .ui-project-card')).toHaveCount(4);
  else if(path==='/project.html')await expect(page.locator('[data-page-title]')).toHaveText('Projects');
  else await expect(page.getByRole('heading',{name:'Website settings',exact:true})).toBeVisible();
 }
 expect(errors.filter(text=>/content security policy|violates.*directive/i.test(text))).toEqual([]);
 await page.goto('/calculators.html');let external=0;await page.route('https://untrusted.example.test/blocked.js',route=>{external++;return route.fulfill({contentType:'application/javascript',body:'window.cspProbe=true;'});});
 await page.evaluate(()=>{window.cspViolations=[];document.addEventListener('securitypolicyviolation',event=>window.cspViolations.push(event.effectiveDirective));const script=document.createElement('script');script.textContent='window.cspProbe=true;';document.body.append(script);const external=document.createElement('script');external.src='https://untrusted.example.test/blocked.js';document.body.append(external);const button=document.createElement('button');button.setAttribute('onclick','window.cspProbe=true');document.body.append(button);button.click();});
 await expect.poll(()=>page.evaluate(()=>window.cspViolations.length)).toBeGreaterThanOrEqual(3);expect(await page.evaluate(()=>window.cspProbe)).toBeUndefined();expect(external).toBe(0);
});
test("same-origin calculators can be framed while another origin cannot embed the site",async({page})=>{
 await page.goto('/calculators.html');await page.evaluate(()=>{const frame=document.createElement('iframe');frame.src='/calculators.html';frame.id='same-origin';document.body.append(frame);});
 await expect(page.frameLocator('#same-origin').locator('#resource-calculators .ui-project-card')).toHaveCount(4);
 await page.route('http://localhost:4173/attacker',route=>route.fulfill({contentType:'text/html',body:'<html><body><iframe src="http://127.0.0.1:4173/calculators.html"></iframe></body></html>'}));
 const response=await page.request.get('/calculators.html');await page.goto('http://localhost:4173/attacker');expect(response.headers()['content-security-policy']).toContain("frame-ancestors 'self'");await expect.poll(()=>page.frames().filter(frame=>frame.parentFrame()).map(frame=>frame.url())).toEqual(['chrome-error://chromewebdata/']);await expect(page.frameLocator('iframe').locator('#resource-calculators')).toHaveCount(0);
 // Control case: removing just these headers from the disposable response permits the same embed.
 await page.route(origin+'/calculators.html',async route=>{const response=await route.fetch(),headers={...response.headers()};delete headers['content-security-policy'];delete headers['x-frame-options'];await route.fulfill({response,headers});});await page.reload();await expect(page.frameLocator('iframe').locator('#resource-calculators .ui-project-card')).toHaveCount(4);
});
