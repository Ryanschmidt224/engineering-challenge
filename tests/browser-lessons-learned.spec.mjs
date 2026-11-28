// Lessons Learned page against the real Worker/D1 handlers with disposable fixtures.
import { test, expect } from "@playwright/test";

test.describe.configure({ mode: "serial" });
test.beforeEach(async ({ request, context }) => {
  const response = await request.post("/__test__/reset?engine=1");
  const { cookie } = await response.json();
  const separator = cookie.indexOf("=");
  await context.addCookies([
    {
      name: cookie.slice(0, separator),
      value: cookie.slice(separator + 1),
      url: "http://127.0.0.1:4173",
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
});

// 1×1 PNG
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

test("write an lesson with steps, a photo, a link and a rated resolution", async ({
  page,
}, testInfo) => {
  await page.goto("/knowledge.html");
  const main = page.locator(".ib-main");
  await page.getByRole("button", { name: "+ Add lesson" }).click();
  await page
    .getByLabel("What happened?")
    .fill("Buck converter blew up at power-on");

  const step1 = main.getByRole("region", { name: "Step 1" });
  await step1
    .getByLabel("What is the question?")
    .fill("Why did it fail on 24 V?");
  await step1.getByLabel("Hypothesis?").fill("Input overshoot at switch-on");
  await step1
    .getByLabel("What did you test or learn?")
    .fill("Learned about [[LC overshoot]].");
  await step1
    .locator('input[type="file"]')
    .setInputFiles({ name: "trace.png", mimeType: "image/png", buffer: png });
  await expect(step1.locator("img")).toHaveCount(1);

  // Add a second step at the end, then insert one between 1 and 2, then reorder.
  await main
    .locator(".ib-divider")
    .last()
    .getByRole("button", { name: "+ Add a step" })
    .click();
  await main
    .getByRole("region", { name: "Step 2" })
    .getByLabel("What is the question?")
    .fill("What does the scope show?");
  await main
    .locator(".ib-divider")
    .first()
    .getByRole("button", { name: "+ Add a step" })
    .click();
  await expect(
    main
      .getByRole("region", { name: "Step 2" })
      .getByLabel("What is the question?"),
  ).toHaveValue("");
  await main
    .getByRole("region", { name: "Step 2" })
    .getByLabel("What is the question?")
    .fill("How high does it go?");
  await main.getByRole("button", { name: "Move step 3 up" }).click();
  await expect(
    main
      .getByRole("region", { name: "Step 2" })
      .getByLabel("What is the question?"),
  ).toHaveValue("What does the scope show?");
  await expect(
    main.getByRole("button", { name: "Move step 1 up" }),
  ).toBeDisabled();

  await main.getByRole("button", { name: "+ Resolution" }).click();
  await main
    .getByLabel("What was the resolution?")
    .fill("Added a bulk capacitor at the input.");
  await main.getByLabel("Meh").check();
  await main.getByRole("button", { name: "Done" }).click();

  // Read view
  await expect(main.locator(".ib-view__title")).toHaveText(
    "Buck converter blew up at power-on",
  );
  await expect(main.locator(".ib-step")).toHaveCount(3);
  await expect(main.locator(".ib-step__question").nth(1)).toHaveText(
    "What does the scope show?",
  );
  await expect(
    main.locator(".ib-step__hypothesis").filter({ hasText: "Input overshoot at switch-on" }),
  ).toBeVisible();
  await expect(main.locator(".ib-quality")).toContainText("Meh");
  await expect(main.locator(".ib-step img")).toHaveCount(1);
  await page.screenshot({
    path: testInfo.outputPath("info-bit-view.png"),
    fullPage: true,
  });

  // Saved for real: survives a reload.
  await page.reload();
  await expect(main.locator(".ib-view__title")).toHaveText(
    "Buck converter blew up at power-on",
  );
  await expect(main.locator(".ib-step img")).toHaveCount(1);

  // A link to a missing bit starts it; the new bit shows where it is linked from.
  await main.getByRole("button", { name: "LC overshoot" }).click();
  await expect(page.getByLabel("What happened?")).toHaveValue("LC overshoot");
  await main.getByRole("button", { name: "Done" }).click();
  await expect(main.locator(".ib-backlinks")).toContainText(
    "Buck converter blew up at power-on",
  );

  // Search and quality filter.
  const list = page.locator(".ib-list__items");
  await page.getByLabel("Search lessons").fill("bulk capacitor");
  await expect(list.getByRole("button")).toHaveCount(1);
  await page.getByLabel("Search lessons").fill("");
  await page.getByLabel("Quality").selectOption("none");
  await expect(list.getByRole("button")).toHaveText(["LC overshoot"]);
  await page.getByLabel("Quality").selectOption("meh");
  await expect(list.getByRole("button")).toHaveText([
    "Buck converter blew up at power-on",
  ]);
});

test("an untouched new lesson is dropped, and delete archives", async ({
  page,
}) => {
  await page.goto("/knowledge.html");
  const main = page.locator(".ib-main");
  await page.getByRole("button", { name: "+ Add lesson" }).click();
  await main.getByRole("button", { name: "Done" }).click();
  await expect(page.locator(".ib-list__items").getByRole("button")).toHaveCount(
    0,
  );

  await page.getByRole("button", { name: "+ Add lesson" }).click();
  await page.getByLabel("What happened?").fill("Temporary");
  await main.getByRole("button", { name: "Done" }).click();
  await main.getByRole("button", { name: "Edit" }).click();
  await main.getByRole("button", { name: "Archive" }).click();
  await page.getByRole("dialog").getByRole("button",{name:"Archive lesson",exact:true}).click();
  await expect(page.locator(".ib-list__items").getByRole("button")).toHaveCount(
    0,
  );
});

test("phone width: list stacks above the lesson and nothing scrolls sideways", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/knowledge.html");
  await page.getByRole("button", { name: "+ Add lesson" }).click();
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('autosave keeps typing and selecting the current lesson safe, then archive restores',async({page,context},testInfo)=>{
 await page.goto('/knowledge.html');await page.getByRole('button',{name:'+ Add lesson',exact:true}).click();const input=page.getByLabel('What happened?',{exact:true});await input.fill('Autosaved lesson');
 await expect.poll(async()=>(await(await context.request.get('/api/lessons-learned')).json()).bits[0]?.happened).toBe('Autosaved lesson');await expect(input).toBeFocused();
 await page.getByLabel('What did you test or learn?',{exact:true}).fill('The draft stays while typing.');await page.locator('.ib-list__items').getByRole('button',{name:'Autosaved lesson',exact:true}).click();await expect(input).toHaveValue('Autosaved lesson');await expect(page.getByLabel('What did you test or learn?',{exact:true})).toHaveValue('The draft stays while typing.');
 await expect.poll(async()=>(await(await context.request.get('/api/lessons-learned')).json()).bits[0]?.steps[0].result).toBe('The draft stays while typing.');await page.reload();await expect(page.locator('.ib-step__result')).toContainText('The draft stays while typing.');
 await page.getByRole('button',{name:'Edit',exact:true}).click();await page.getByRole('button',{name:'Archive',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Archive lesson',exact:true}).click();await page.getByRole('button',{name:'Archived',exact:true}).click();await page.getByRole('button',{name:'Restore',exact:true}).click();await expect(page.locator('.ib-view__title')).toHaveText('Autosaved lesson');expect((await(await context.request.get('/api/lessons-learned?archived=1')).json()).bits).toHaveLength(0);
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Edit',exact:true}).click();await page.evaluate(()=>scrollTo(0,500));await expect(page.locator('.ib-status')).toBeHidden();const introduction=page.getByRole('region',{name:'Lesson introduction',exact:true});await expect(introduction.getByLabel('What happened?',{exact:true})).toBeVisible();expect(await introduction.evaluate(el=>getComputedStyle(el).borderBottomStyle)).toBe('solid');await page.screenshot({path:testInfo.outputPath('lesson-phone-editor.png'),fullPage:true});
});

test('an interrupted save replays once and a genuine conflict preserves a recoverable draft',async({page,context})=>{
 await page.goto('/knowledge.html');await page.getByRole('button',{name:'+ Add lesson',exact:true}).click();let dropped=false;await page.route('**/api/lessons-learned',async route=>{if(route.request().method()==='POST'&&!dropped){dropped=true;await route.fetch();await route.abort('failed');}else await route.continue();});
 await page.getByLabel('What happened?',{exact:true}).fill('Reply was lost');await expect.poll(async()=>(await(await context.request.get('/api/lessons-learned')).json()).bits[0]?.happened).toBe('Reply was lost');await expect(page.locator('.ib-status')).toBeHidden();let snapshot=await(await context.request.get('/api/lessons-learned')).json();expect(snapshot.bits).toHaveLength(1);expect(snapshot.bits[0].revision).toBe(1);
 const record=snapshot.bits[0];const newer=await context.request.post('/api/lessons-learned',{headers:{origin:'http://127.0.0.1:4173'},data:{record:{...record,happened:'Newer saved version'},expectedRevision:record.revision,operationId:crypto.randomUUID()}});expect(newer.ok()).toBe(true);
 await page.getByLabel('What happened?',{exact:true}).fill('My conflicting draft');await expect(page.getByRole('button',{name:'Load saved lesson',exact:true})).toBeVisible();await expect(page.getByLabel('What happened?',{exact:true})).toHaveValue('My conflicting draft');page.once('dialog',d=>d.accept());await page.reload();await expect(page.getByLabel('What happened?',{exact:true})).toHaveValue('My conflicting draft');await page.getByRole('button',{name:'Load saved lesson',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Load saved lesson',exact:true}).click();await expect(page.locator('.ib-view__title')).toHaveText('Newer saved version');
});

for(const width of [390,1440])test('lesson introduction belongs to the form and only pending saves show status at '+width,async({page,context},testInfo)=>{
 await page.setViewportSize({width,height:1000});await page.goto('/knowledge.html');await page.getByRole('button',{name:'+ Add lesson',exact:true}).click();
 const introduction=page.getByRole('region',{name:'Lesson introduction',exact:true}),step=page.getByRole('region',{name:'Step 1',exact:true}),status=page.locator('.ib-status');
 await expect(status).toBeHidden();await expect(introduction.getByLabel('What happened?',{exact:true})).toBeVisible();
 const form=page.locator('.ib-form');await expect(form.getByRole('heading',{name:'New lesson',exact:true})).toBeVisible();expect(await form.evaluate(el=>getComputedStyle(el).borderTopStyle)).toBe('solid');const frame=await form.boundingBox(),footer=await form.locator('.ib-form__footer').boundingBox();expect(footer.x).toBeGreaterThan(frame.x);expect(footer.x+footer.width).toBeLessThan(frame.x+frame.width);
 const introBox=await introduction.boundingBox(),stepBox=await step.boundingBox();expect(Math.abs(introBox.x-stepBox.x)).toBeLessThan(1);expect(Math.abs(introBox.width-stepBox.width)).toBeLessThan(1);
 await expect(introduction.getByRole('heading',{name:'Lesson details',exact:true})).toBeVisible();
 const row=introduction.locator('.field-row'),label=await row.locator('label').boundingBox(),control=await row.locator('textarea').boundingBox();
 if(width>640){expect(label.x+label.width).toBeLessThanOrEqual(control.x);expect(Math.abs(label.y-control.y)).toBeLessThan(12);}
 else expect(label.y+label.height).toBeLessThanOrEqual(control.y);
 expect(await row.locator('textarea').evaluate(el=>getComputedStyle(el).borderTopStyle)).toBe('solid');
 expect(await introduction.locator('.ui-editor-group__heading').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe(await step.locator('.ui-editor-group__heading').evaluate(el=>getComputedStyle(el).backgroundColor));
 let release;const held=new Promise(resolve=>release=resolve);await page.route('**/api/lessons-learned',async route=>{if(route.request().method()==='POST')await held;await route.continue();});
 const input=introduction.getByLabel('What happened?',{exact:true});await input.fill('Clearly grouped lesson');const beforeSaveY=(await input.boundingBox()).y;await expect(status).toHaveText('Saving…');await expect(status).toBeVisible();expect(Math.abs((await input.boundingBox()).y-beforeSaveY)).toBeLessThan(1);await expect(page.locator('.ib-form__footer .ib-status')).toBeVisible();await expect(input).toBeFocused();
 await page.screenshot({path:testInfo.outputPath('lesson-introduction-saving.png'),fullPage:true});release();await expect(status).toBeHidden();await expect(status).toHaveText('');await expect(input).toBeFocused();await page.screenshot({path:testInfo.outputPath('lesson-introduction-idle.png'),fullPage:true});
 await page.getByRole('button',{name:'Done',exact:true}).click();await expect(page.locator('.ib-view__title')).toHaveText('Clearly grouped lesson');await expect(status).toBeHidden();
 const view=page.locator('.ib-view');await expect(view.getByRole('heading',{name:'Lesson details',exact:true})).toBeVisible();await expect(view.locator('.ib-view__happened')).toHaveText('Clearly grouped lesson');expect(await view.evaluate(el=>getComputedStyle(el).borderTopStyle)).toBe('solid');await expect(view.locator('input,textarea')).toHaveCount(0);const panel=await view.boundingBox(),edit=await view.getByRole('button',{name:'Edit',exact:true}).boundingBox();expect(edit.x+edit.width).toBeLessThan(panel.x+panel.width);await page.screenshot({path:testInfo.outputPath('lesson-framed-view.png'),fullPage:true});
 const snapshot=await(await context.request.get('/api/lessons-learned')).json();expect(snapshot.bits[0].happened).toBe('Clearly grouped lesson');await page.reload();await page.getByRole('button',{name:'Edit',exact:true}).click();await expect(introduction.getByLabel('What happened?',{exact:true})).toHaveValue('Clearly grouped lesson');await expect(status).toBeHidden();
});

test('lesson photo bytes and retry ID survive repeated lost responses; failed response never claims saved',async({page,request})=>{
 await page.goto('/knowledge.html');await page.getByRole('button',{name:'+ Add lesson',exact:true}).click();
 await page.getByLabel('What happened?',{exact:true}).fill('Upload recovery fixture');
 await expect(page.locator('.ib-status')).toBeHidden();
 let failing=true;const ids=[];
 await page.route('**/api/lessons-learned/photo?bit=*',async route=>{
  ids.push(route.request().headers()['x-upload-id']);
  if(failing){await route.fetch();await route.fulfill({status:201,body:'{',contentType:'application/json'});}else await route.continue();
 });
 await page.getByRole('region',{name:'Step 1',exact:true}).locator('input[type="file"]').setInputFiles({name:'recovery.png',mimeType:'image/png',buffer:png});
 await expect(page.getByRole('button',{name:'Retry photo upload',exact:true})).toBeVisible();
 await expect(page.locator('.ib-status')).toContainText('unconfirmed');
 await expect(page.getByLabel('What happened?',{exact:true})).toHaveValue('Upload recovery fixture');
 expect(ids).toHaveLength(2);expect(new Set(ids).size).toBe(1);
 failing=false;await page.getByRole('button',{name:'Retry photo upload',exact:true}).click();
 await expect(page.getByRole('button',{name:'Retry photo upload',exact:true})).toHaveCount(0);
 await expect(page.getByRole('region',{name:'Step 1',exact:true}).locator('img')).toHaveCount(1);
 await page.locator('.ib-form__footer').getByRole('button',{name:'Done',exact:true}).click();
 await page.reload();await expect(page.locator('.ib-main img')).toHaveCount(1);
 expect(new Set(ids).size).toBe(1);
 const response=await page.request.get('/api/lessons-learned');const data=await response.json();expect(data.photos).toHaveLength(1);
});

test('partial lesson photo batches retain remaining files and retry final saves without uploading twice',async({page})=>{
 await page.goto('/knowledge.html');await page.getByRole('button',{name:'+ Add lesson',exact:true}).click();
 await page.getByLabel('What happened?',{exact:true}).fill('Partial upload fixture');await expect(page.locator('.ib-status')).toBeHidden();
 let rejectSecond=true,loseSave=false;const names=[];
 await page.route('**/api/lessons-learned/photo?bit=*',async route=>{
  const name=decodeURIComponent(route.request().headers()['x-file-name']);names.push(name);
  if(name==='second.png'&&rejectSecond) await route.fulfill({status:413,json:{error:'Fixture upload rejected'}});
  else {await route.continue();if(name==='second.png')loseSave=true;}
 });
 await page.route('**/api/lessons-learned',async route=>{
  if(loseSave&&route.request().method()==='POST'){await route.fetch();await route.fulfill({status:200,body:'{',contentType:'application/json'});}else await route.continue();
 });
 await page.getByRole('region',{name:'Step 1',exact:true}).locator('input[type="file"]').setInputFiles([
  {name:'first.png',mimeType:'image/png',buffer:png},{name:'second.png',mimeType:'image/png',buffer:png}]);
 await expect(page.getByRole('button',{name:'Retry photo upload',exact:true})).toBeEnabled();
 expect(names).toEqual(['first.png','second.png']);
 rejectSecond=false;await page.getByRole('button',{name:'Retry photo upload',exact:true}).click();
 await expect(page.locator('.ib-status')).toContainText('unconfirmed');
 expect(names).toEqual(['first.png','second.png','second.png']);
 loseSave=false;await page.getByRole('button',{name:'Retry photo upload',exact:true}).click();
 await expect(page.getByRole('button',{name:'Retry photo upload',exact:true})).toHaveCount(0);
 expect(names).toHaveLength(3);
 await page.locator('.ib-form__footer').getByRole('button',{name:'Done',exact:true}).click();await page.reload();
 await expect(page.locator('.ib-main img')).toHaveCount(2);
 expect((await (await page.request.get('/api/lessons-learned')).json()).photos).toHaveLength(2);
});
