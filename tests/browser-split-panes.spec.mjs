import {test,expect} from "@playwright/test";
test.describe.configure({mode:"serial"});
test.beforeEach(async({request,context})=>{
 const {cookie}=await(await request.post("/__test__/reset")).json(),at=cookie.indexOf("=");
 await context.addCookies([{name:cookie.slice(0,at),value:cookie.slice(at+1),url:"http://127.0.0.1:4173",httpOnly:true,sameSite:"Strict"}]);
});
for(const [name,path,labels] of [["workshop","/workshop.html",["categories","families"]],["knowledge","/knowledge.html",["tiles"]]])test(name+" columns support drag, keyboard, remembered widths, reset and phone stacking",async({page},testInfo)=>{
 await page.setViewportSize({width:1440,height:1000});await page.goto(path);
 const handles=page.getByRole("separator");await expect(handles).toHaveCount(labels.length);
 for(const label of labels){
  const handle=page.getByRole("separator",{name:"Resize "+label+" column",exact:true});
  await expect(handle).toBeVisible();const before=Number(await handle.getAttribute("aria-valuenow"));
  await handle.focus();await handle.press("ArrowRight");expect(Number(await handle.getAttribute("aria-valuenow"))).toBeGreaterThan(before);
  await handle.press("Home");expect(await handle.getAttribute("aria-valuenow")).toBe(await handle.getAttribute("aria-valuemin"));
  await handle.press("End");expect(await handle.getAttribute("aria-valuenow")).toBe(await handle.getAttribute("aria-valuemax"));
  await handle.dblclick();
  const start=Number(await handle.getAttribute("aria-valuenow")),box=await handle.boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+24);await page.mouse.down();await page.mouse.move(box.x+box.width/2+30,box.y+24);await page.mouse.up();
  const dragged=Number(await handle.getAttribute("aria-valuenow"));expect(dragged).toBeGreaterThan(start);
  await page.reload();await expect(handle).toHaveAttribute("aria-valuenow",String(dragged));
  const newBox=await handle.boundingBox();await page.mouse.move(newBox.x+newBox.width/2,newBox.y+24);await page.mouse.down();await page.mouse.move(newBox.x+newBox.width/2+20,newBox.y+24);await page.keyboard.press("Escape");await page.mouse.up();await expect(handle).toHaveAttribute("aria-valuenow",String(dragged));
 }
 await page.screenshot({path:testInfo.outputPath("resizable-desktop.png"),fullPage:true});
 await page.setViewportSize({width:900,height:1000});
 const active=page.getByRole("separator").last();await expect(active).toBeVisible();
 if(name==="workshop")await expect(page.getByRole("separator",{name:"Resize categories column",exact:true})).toBeHidden();
 await active.focus();await active.press("End");expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);
 await page.setViewportSize({width:390,height:844});await expect(page.getByRole("separator")).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);
 const panels=page.locator("."+name+"-layout > section, ."+name+"-layout > aside, ."+name+"-layout > main");
 const boxes=await panels.evaluateAll(nodes=>nodes.map(node=>{const b=node.getBoundingClientRect();return {x:b.x,width:b.width,y:b.y};}));
 for(const box of boxes){expect(box.width).toBeGreaterThan(300);expect(box.x).toBe(boxes[0].x);}
 await page.screenshot({path:testInfo.outputPath("stacked-phone.png"),fullPage:true});
 // Initializing on a phone must not turn its full-width list into the desktop default.
 await page.evaluate(()=>localStorage.clear());await page.reload();await page.setViewportSize({width:1440,height:1000});await expect(page.getByRole("separator")).toHaveCount(labels.length);
 for(const handle of await page.getByRole("separator").all())expect(Number(await handle.getAttribute("aria-valuenow"))).toBeLessThan(400);
});

for(const mode of ["malformed","blocked"])test(mode+" local preferences do not break pane layout",async({page})=>{
 await page.addInitScript(mode=>{if(mode==="blocked")Object.defineProperty(window,"localStorage",{get(){throw new DOMException("Storage blocked","SecurityError");}});else localStorage.setItem("building-schmidt:panes:workshop",'{"categories":"oops","families":-99}');},mode);
 await page.goto("/workshop.html");await expect(page.getByRole("separator",{name:"Resize families column",exact:true})).toBeVisible();
 const handle=page.getByRole("separator",{name:"Resize families column",exact:true});await handle.focus();await handle.press("ArrowRight");
 expect(Number(await handle.getAttribute("aria-valuenow"))).toBeGreaterThan(192);
});
