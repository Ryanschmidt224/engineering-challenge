// Browser regression: a script-load error must never silently empty the feature tree.
// No production data or credentials are used; every /api request is mocked.
import {test,expect} from "@playwright/test";

test("project feature tree and workspace initialize without browser errors", async ({page}) => {
 const errors=[];
 page.on("pageerror", error=>errors.push(error.stack||error.message));
 await page.route("**/api/**", async route=>{
  const url=new URL(route.request().url());
  let data={};
  switch(url.pathname){
   case "/api/tree":
    data=url.searchParams.has("assembly")
      ? {page:{description:""},revision:"test"}
      : {nodes:[{id:"smoke-motor",parentId:null,name:"Motor and Motor Control",kind:"assembly"}],revision:"test"};
    break;
   case "/api/components": data={components:[
    {id:"part-motor",name:"C2822 Brushless Motor",assemblyId:"smoke-motor",quantity:2},
    {id:"part-esc",name:"20A ESC",assemblyId:"smoke-motor",quantity:2}
   ]};break;
   case "/api/photos": data={photos:[]};break;
   case "/api/workspace": data={workspace:{recipe:[],resources:[]},revision:"test"};break;
   case "/api/auth": data={authenticated:false,isAdmin:false};break;
   case "/api/drawings": data={drawings:[]};break;
   case "/api/part-files": data={files:[]};break;
   case "/api/commonparts": data={parts:[]};break;
   case "/api/purchased-parts": data={parts:[]};break;
   case "/api/wires": data={wires:[]};break;
   default: data={};break;
  }
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(data)});
 });
 await page.goto("/");
 await page.locator(".project-link[data-nav=\"launcher\"]").click();
 await expect(page.locator("#launcher")).toHaveClass(/active/);
 const tree=page.locator("#launcher .assembly-tree-nodes");
 await expect(tree.locator(".assembly-name").first()).toContainText("Foam-dart launcher");
 await expect(tree.locator(".assembly-name", {hasText:"Motor and Motor Control"})).toBeVisible();
 await tree.locator(".assembly-name", {hasText:"Motor and Motor Control"}).click();
 await expect(page).toHaveURL(/#launcher\/assembly\/smoke-motor/);
 await expect(page.locator("#launcher .assembly-detail-title")).toContainText("Motor and Motor Control");
 await page.locator("#launcher .assembly-detail .assembly-open-workspace").click();
 await expect(page.locator("#launcher .assembly-workspace-page:not(.bom-part-workspace)")).toBeVisible();
 // The BOM has one text-first hierarchical view (no thumbnails or view switch).
 const bomList=page.locator("#launcher .assembly-sidebar .workspace-saved-parts");
 const rows=bomList.locator(".bom-part-stack > .bom-part");
 await expect(rows).toHaveCount(2);
 await expect(rows.first()).toContainText("C2822 Brushless Motor");
 await expect(rows.nth(1)).toContainText("20A ESC");
 await expect(page.locator("#launcher .assembly-sidebar .bom-view-switch")).toHaveCount(0);
 await expect(bomList.locator(".bom-row-thumbnail")).toHaveCount(0);
 // Legacy component UI must not create a second, competing BOM listing.
 const legacyLists=page.locator("#launcher .assembly-sidebar .workspace-bom .component-section > .component-list");
 const legacyCount=await legacyLists.count();
 for(let i=0;i<legacyCount;i++)await expect(legacyLists.nth(i)).toBeHidden();
 const legacyEditor=page.locator("#launcher .assembly-sidebar .workspace-bom .component-admin");
 if(await legacyEditor.count())await expect(legacyEditor.first()).toBeHidden();

 await expect(rows.first().locator(".bom-part-name")).toBeVisible();
 await expect(rows.first().locator(".bom-part-meta")).toContainText("Qty 2");
 // Expanding a part visibly highlights its header without recoloring children.
 const header=rows.first().locator(":scope > .bom-part-summary");
 const closedColor=await header.evaluate(el=>getComputedStyle(el).backgroundColor);
 await header.click();
 await expect(rows.first()).toHaveAttribute("open", "");
 const openedColor=await header.evaluate(el=>getComputedStyle(el).backgroundColor);
 expect(openedColor).not.toBe(closedColor);
 // BOM occupies the left column and can be resized by a visible divider.
 const workspace=page.locator("#launcher .assembly-workspace-page:not(.bom-part-workspace)");
 const sidebar=page.locator("#launcher .assembly-sidebar");
 const bom=sidebar.locator(".workspace-bom");
 const instructions=workspace.locator(".recipe-instructions");
 const splitter=page.locator("#launcher .assembly-layout > .workspace-bom-resizer");
 await expect(sidebar).toHaveClass(/bom-sidebar-active/);
 // The feature tree, BOM, and content groups have separate visible frames.
 const treeFrame=sidebar.locator(".feature-tree-frame");
 await expect(treeFrame).toBeVisible();
 expect(await treeFrame.evaluate(el=>getComputedStyle(el).borderTopStyle)).toBe("solid");
 expect(await bom.evaluate(el=>getComputedStyle(el).borderTopStyle)).toBe("solid");
 const panels=workspace.locator(".workspace-panels > article");
 await expect(panels).toHaveCount(4);
 for(let i=0;i<await panels.count();i++){
  expect(await panels.nth(i).evaluate(el=>getComputedStyle(el).borderTopStyle)).toBe("solid");
 }

 expect(await bom.evaluate(el=>el.parentElement.classList.contains("assembly-sidebar"))).toBe(true);
 const treeBounds=await tree.boundingBox();
 const bomStart=await bom.boundingBox();
 expect(bomStart.y).toBeGreaterThan(treeBounds.y+treeBounds.height-1);
 await expect(splitter).toBeVisible();
 const before=await sidebar.boundingBox();
 const right=await instructions.boundingBox();
 expect(before.x).toBeLessThan(right.x);
 const sidebarGap=await splitter.boundingBox();
 expect(sidebarGap.x-(before.x+before.width)).toBeGreaterThanOrEqual(10);
 const handle=await splitter.boundingBox();
 await page.mouse.move(handle.x+handle.width/2,handle.y+70);
 await page.mouse.down();
 await page.mouse.move(handle.x+handle.width/2+85,handle.y+70,{steps:6});
 await page.mouse.up();
 const after=await sidebar.boundingBox();
 expect(after.width).toBeGreaterThan(before.width+40);
 // Keyboard resize is available for accessibility, and persists in storage.
 await splitter.focus();
 await page.keyboard.press("ArrowLeft");
 const keyboard=await sidebar.boundingBox();
 expect(keyboard.width).toBeLessThan(after.width);
 expect(await page.evaluate(()=>Number(localStorage.getItem("bs-workspace-bom-width")))).toBeGreaterThan(0);
 expect(errors,"Unexpected JavaScript errors during startup/navigation").toEqual([]);
});


test("admin tree right-click menu replaces rename/delete toolbar and main page has rounded frame",async({page})=>{
 const errors=[];
 page.on("pageerror",error=>errors.push(error.message));
 await page.route("**/api/**",async route=>{
  const url=new URL(route.request().url());
  let data={};
  if(url.pathname==="/api/auth")data={authenticated:true,isAdmin:true};
  if(url.pathname==="/api/tree")data={nodes:[
   {id:"smoke-motor",parentId:null,name:"Motor and Motor Control",kind:"assembly"},
   {id:"smoke-part",parentId:"smoke-motor",name:"Linked Motor",kind:"part",partId:"p1"}
  ],revision:"test"};
  if(url.pathname==="/api/components")data={components:[]};
  if(url.pathname==="/api/photos")data={photos:[]};
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(data)});
 });
 await page.goto("/");
 await page.locator('.project-link[data-nav="launcher"]').click();
 const sidebar=page.locator("#launcher .assembly-sidebar");
 await expect(sidebar.locator(".assembly-rename")).toBeHidden();
 await expect(sidebar.locator(".assembly-remove")).toBeHidden();
 const row=sidebar.locator(".assembly-node",{hasText:"Motor and Motor Control"});
 await row.click({button:"right"});
 const menu=page.locator(".assembly-context-menu:visible").last();
 await expect(menu).toBeVisible();
 await expect(menu.getByRole("menuitem",{name:"Add part"})).toBeVisible();
 await expect(menu.getByRole("menuitem",{name:"Add subassembly"})).toBeVisible();
 await expect(menu.getByRole("menuitem",{name:"Rename"})).toBeVisible();
 await expect(menu.getByRole("menuitem",{name:"Delete",exact:true})).toBeVisible();
 await page.keyboard.press("Escape");
 await expect(menu).toBeHidden();
 const frame=page.locator("#launcher .assembly-layout > .assembly-content");
 const radius=await frame.evaluate(el=>parseFloat(getComputedStyle(el).borderTopLeftRadius));
 expect(radius).toBeGreaterThanOrEqual(8);
 expect(errors).toEqual([]);
});
