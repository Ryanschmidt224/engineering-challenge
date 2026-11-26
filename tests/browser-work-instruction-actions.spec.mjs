import {test,expect} from "@playwright/test";
test.describe.configure({mode:"serial"});
const origin="http://127.0.0.1:4173",png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/qLkAAAAASUVORK5CYII=","base64");
for(const width of [1440,390])test("first Work Instruction entries stay reachable and all record types save/reopen at "+width+"px",async({page,request,context},testInfo)=>{
 const {cookie}=await(await request.post("/__test__/reset")).json(),at=cookie.indexOf("=");await context.addCookies([{name:cookie.slice(0,at),value:cookie.slice(at+1),url:origin,httpOnly:true,sameSite:"Strict"}]);
 const use=await context.request.post("/api/workshop",{headers:{origin},data:{entity:"use",expectedRevision:null,expectedFamilyRevision:2,record:{id:crypto.randomUUID(),project_id:"launcher",family_id:"f-resistor",product_id:null,tree_node_id:null,purpose:"Instruction regression fixture",quantity:1,unit:"pcs",field_values:{},notes:""}}});expect(use.ok(),await use.text()).toBeTruthy();const partId=(await use.json()).record.id;
 const saved=await context.request.put("/api/workspace?project=launcher&part="+partId,{headers:{origin},data:{recipe:[{id:"print-board",title:"3d Print the board",tileOrder:[]}],expectedRevision:null}});expect(saved.ok(),await saved.text()).toBeTruthy();
 await page.setViewportSize({width,height:1000});await page.goto("/index.html#launcher/part/"+partId);const section=page.locator('#launcher .bom-part-workspace [data-section="work-instructions"]');await section.locator(":scope > .ui-section__header").click();await section.locator(".recipe-step-nav-actions").getByRole("button",{name:"Edit",exact:true}).click();
 const detail=section.locator(".recipe-step-detail"),add=detail.locator(".investigation-active-area > .ui-section__actions").getByRole("button",{name:"+ Add entry",exact:true});
 await expect(add).toBeVisible();await add.click();await detail.locator(".investigation-new-record").getByRole("button",{name:"Cancel",exact:true}).click();await expect(add).toBeVisible();
 const cases=[
  {type:"note",title:"Printing notes",fields:{Description:"Print flat on the bed."}},
  {type:"test",title:"Thickness test",fields:{"What did you want to verify?":"Finished thickness", "How did you test it?":"Use calipers", "What happened?":"Measured 3.00 mm"}},
  {type:"revision",title:"Drawing change",fields:{"What changed?":"Increased the mounting tab", "Why did you change it?":"Reduce flex"}},
  {type:"failure",title:"Cracked tab",fields:{"What happened?":"Tab cracked", "What do you think caused it?":"Too little material"}},
  {type:"photos",title:"Printed bracket",fields:{Note:"Mounting holes after printing"}}
 ];
 for(const entry of cases){
  await add.click();const form=detail.locator(".investigation-new-record");await form.getByRole("combobox",{name:"Entry type",exact:true}).selectOption(entry.type);await form.getByPlaceholder(["note","photos"].includes(entry.type)?"Title (optional)":"Title",{exact:true}).fill(entry.title);
  for(const [label,value]of Object.entries(entry.fields))await form.getByLabel(label,{exact:true}).fill(value);
  if(entry.type==="failure"){await form.getByRole("combobox",{name:"Did you fix it?",exact:true}).selectOption("yes");await form.getByLabel("How?",{exact:true}).fill("Reprinted a thicker tab");}
  if(entry.type==="photos"){await form.getByRole("button",{name:"Add photos",exact:true}).click();await form.locator('input[type="file"]').setInputFiles({name:"bracket.png",mimeType:"image/png",buffer:png});await form.getByRole("textbox",{name:"Photo name for bracket.png",exact:true}).fill("Printed mounting holes");}
  await form.getByRole("button",{name:"Save",exact:true}).click();await expect(form).toHaveCount(0);await expect(detail.locator(".investigation-card").filter({has:page.locator("summary").filter({hasText:entry.title})})).toHaveCount(1);
 }
 const before=await(await context.request.get("/api/investigations?project=launcher")).json();expect(before.records.filter(row=>row.stepId==="print-board")).toHaveLength(5);
 await page.reload();await section.locator(":scope > .ui-section__header").click();for(const entry of cases){const card=detail.locator(".investigation-card").filter({has:page.locator("summary").filter({hasText:entry.title})});await card.locator(":scope > summary").click();for(const value of Object.values(entry.fields))await expect(card).toContainText(value);}
 await expect(detail.getByRole("img",{name:"Printed mounting holes",exact:true})).toBeVisible();const after=await(await context.request.get("/api/investigations?project=launcher")).json();expect(after.records.map(row=>row.id)).toEqual(before.records.map(row=>row.id));
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(0);await page.screenshot({path:testInfo.outputPath("work-instructions-restored.png"),fullPage:true});
});
