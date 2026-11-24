// Browser regression: a script-load error must never silently empty the feature tree.
// No production data or credentials are used; every /api request is mocked.
import {test,expect} from "@playwright/test";

// Supply the catalog contract even when a test only mocks a narrower feature.
// Missing catalog fixtures previously hid all project cards before a test began.
function apiResponse(route, data) {
 if(new URL(route.request().url()).pathname!=="/api/projects"||Array.isArray(data?.projects))return data;
 return {projects:[
  {id:"launcher",name:"Foam-dart launcher",isOwner:true,builtIn:true},
  {id:"linear",name:"Electromagnetic linear actuator",isOwner:true,builtIn:true},
  {id:"robot",name:"Robotic arm",isOwner:true,builtIn:true}
 ]};
}


test("owner sign-in remains available without public registration controls",async({page})=>{
 await page.route("**/api/**",route=>route.fulfill({json:apiResponse(route,{})}));
 await page.goto("/");
 await page.locator("#accountMenuButton").click();
 const account=page.locator(".project-account-dialog");
 await expect(account).toBeVisible();
 await expect(account).toContainText("Public registration is closed");
 await expect(account.getByLabel("Email",{exact:true})).toBeVisible();
 await expect(account.locator('input[name="password"]')).toBeVisible();
 await expect(account.getByRole("button",{name:"Sign in",exact:true})).toBeVisible();
 await expect(account.locator(".project-register,.project-switch-login")).toHaveCount(0);
});

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
    {id:"part-esc",name:"20A ESC",assemblyId:"smoke-motor",quantity:2},
    {id:"tool-iron",name:"Soldering Iron",assemblyId:"smoke-motor",isTool:true,quantity:1}
   ]};break;
   case "/api/photos": data={photos:url.searchParams.get("assembly")==="root-assembly"
    ?[{id:"launcher/assembly-photo.png",url:"/root-assembly-photo.png",caption:"Assembly build photo",assembly:"root-assembly"}]
    :url.searchParams.get("assembly")==="project-summary"
     ?[{id:"launcher/photo-a.png",url:"/test-photo-a.png",caption:"Launcher front view",assembly:"project-summary"},
       {id:"launcher/photo-b.png",url:"/test-photo-b.png",caption:"Launcher side view",assembly:"project-summary"}]
     :[]};break;
   case "/api/workspace": data={workspace:{recipe:[{id:"step-prepare",title:"Prepare components",standard:"Inspect the parts",kind:"action",notes:[],photos:[]},{id:"step-measure",title:"Measure resistance",standard:"Verify resistance",kind:"measurement",notes:[],photos:[]}],resources:[]},revision:"test"};break;
   case "/api/auth": data={authenticated:false,isAdmin:false};break;
   case "/api/drawings": data={drawings:[]};break;
   case "/api/part-files": data={files:[]};break;
   case "/api/commonparts": data={parts:[]};break;
   case "/api/purchased-parts": data={parts:[]};break;
   case "/api/wires": data={wires:[]};break;
   default: data={};break;
  }
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(apiResponse(route,data))});
 });
 await page.goto("/");
 const initialTree=page.locator("#launcher .assembly-tree-nodes");
 await expect(initialTree.locator(".assembly-name")).toHaveCount(2);
 await page.locator('.ui-project-open[data-project="launcher"]').click();
 const workspace=page.locator("#launcher .assembly-workspace-page:not(.bom-part-workspace)");
 const screen=page.locator("#launcher .assembly-bom-screen");
 const tree=page.locator("#launcher .assembly-tree-nodes");
 const summary=page.locator("#launcher .project-summary-page");
 await expect(summary).toBeVisible();
 const summaryEntry=page.locator("#launcher .assembly-summary-sidebar-card .assembly-project-summary-entry:first-child");
 await expect(summaryEntry).toHaveText("Project summary");
 await expect(summaryEntry).toHaveAttribute("aria-current","page");
 const partsEntry=page.locator("#launcher .assembly-project-parts-entry");
 await expect(partsEntry).toBeVisible();
 const navVisual=await page.locator("#launcher .assembly-sidebar").evaluate(sidebar=>{
  const a=sidebar.querySelector(".assembly-summary-sidebar-card .assembly-project-summary-entry:first-child");
  const b=sidebar.querySelector(".assembly-project-parts-entry");
  const box=element=>{const r=element.getBoundingClientRect(),style=getComputedStyle(element);
   return {x:r.x,width:r.width,height:r.height,padding:style.padding,borderRadius:style.borderRadius,
    borderWidth:style.borderWidth,fontSize:style.fontSize}};
  return {summary:box(a),parts:box(b),wrapperDisplay:getComputedStyle(a.parentElement).display};
 });
 expect(navVisual.wrapperDisplay).toBe("grid");
 expect(navVisual.summary.width).toBeCloseTo(navVisual.parts.width,1);
 expect(navVisual.summary.height).toBeCloseTo(navVisual.parts.height,1);
 expect(navVisual.summary.x).toBeCloseTo(navVisual.parts.x,1);
 expect(navVisual.summary.padding).toBe(navVisual.parts.padding);
 expect(navVisual.summary.borderRadius).toBe(navVisual.parts.borderRadius);
 await expect(summary.locator(".project-summary-title")).toContainText("Foam");
 await expect(summary.locator(".project-summary-bom-items")).toContainText("C2822 Brushless Motor");
 await expect(summary.locator(".project-summary-bom-items")).toContainText("20A ESC");
 await expect(summary.locator(".project-summary-tool-items")).toContainText("Soldering Iron");
 await expect(summary.locator(".project-summary-bom-items")).not.toContainText("Soldering Iron");
 await expect(summary.locator(".project-summary-photo-position")).toContainText("1 of 2");
 await expect(summary.locator(".project-summary-photo-caption")).toContainText("Launcher front view");
 await summary.locator('[data-section="summary-photos"] > .ui-section__header').click();
 await summary.locator(".project-summary-next").click();
 await expect(summary.locator(".project-summary-photo-position")).toContainText("2 of 2");
 await expect(summary.locator(".project-summary-photo-caption")).toContainText("Launcher side view");
 await summary.locator(".project-summary-previous").click();
 await expect(summary.locator(".project-summary-photo-position")).toContainText("1 of 2");
 await expect(summary.locator(".project-summary-workspace,.project-summary-bom,.project-summary-add-photo")).toHaveCount(0);
 await tree.locator(".assembly-name").first().click();
 await expect(workspace).toBeVisible();
 await expect(workspace.locator(".workspace-back")).toHaveText("Open BOM");
 await expect(workspace.locator(".workspace-cover img")).toHaveAttribute("src",/photo-annotations/);
 await tree.locator(".assembly-name").first().click();
 await expect(page).toHaveURL(/#launcher\/workspace\/__root__/);
 await summaryEntry.click();
 await expect(summary).toBeVisible();
 await tree.locator(".assembly-name").first().click();
 const header=workspace.locator(":scope > .workspace-heading");
 const buttonBounds=await header.locator(".workspace-back").boundingBox();
 const titleBounds=await header.locator(".workspace-title").boundingBox();
 expect(buttonBounds.y).toBeGreaterThan(titleBounds.y+titleBounds.height);
 await expect(header.locator(".workspace-back")).toBeVisible();
 await workspace.locator(".workspace-back").click();
 await expect(page).toHaveURL(/#launcher\/bom\/__root__/);
 await expect(screen).toBeVisible();
 await expect(screen.locator(".assembly-bom-list")).toHaveAttribute("aria-pressed","true");
 const toolbar=screen.locator(":scope > .workspace-bom-heading");
 await expect(toolbar).toBeVisible();
 await expect(toolbar.locator("h2")).toHaveText("Bill of materials");
 await expect(toolbar.locator(".assembly-bom-list")).toBeVisible();
 await expect(toolbar.locator(".assembly-bom-pictures")).toBeVisible();
 await expect(toolbar.locator(".workspace-new-part")).toBeHidden();
 await expect(screen.locator(".assembly-bom-screen-header .assembly-bom-view-switch")).toHaveCount(0);
 await expect(screen.locator(".assembly-bom-picture-view")).toBeHidden();
 await expect(screen.locator(".workspace-bom")).toBeVisible();
 await expect(screen.locator(".workspace-saved-parts")).toContainText("Motor and Motor Control");
 await screen.locator(".assembly-bom-pictures").click();
 await expect(screen.locator(".assembly-bom-picture-view")).toBeVisible();
 await expect(screen.locator(".assembly-bom-list-view")).toBeHidden();
 await expect(screen.locator(".assembly-bom-picture-view .assembly-tile")).toHaveCount(1);
 await screen.locator(".assembly-bom-list").click();
 await expect(screen.locator(".workspace-saved-parts")).toBeVisible();
 await screen.locator(".assembly-bom-back").click();
 await expect(workspace).toBeVisible();
 await tree.locator(".assembly-name",{hasText:"Motor and Motor Control"}).click();
 await expect(page).toHaveURL(/#launcher\/workspace\/smoke-motor/);
 await workspace.locator(".workspace-back").click();
 await expect(screen).toBeVisible();
 await expect(screen.locator(".assembly-bom-list")).toHaveAttribute("aria-pressed","true");
 await expect(screen.locator(".workspace-saved-parts")).toContainText("C2822 Brushless Motor");
 await screen.locator(".assembly-bom-pictures").click();
 await expect(screen.locator(".assembly-bom-picture-view .assembly-tile")).toHaveCount(2);
 await screen.locator(".assembly-bom-back").click();
 await expect(workspace.locator(".recipe-instructions")).toBeVisible();
 expect(errors,"Unexpected JavaScript errors during startup/navigation").toEqual([]);
});


test("new custom part retains explicit project numbering without confusing it with manufacturer MPN",async({page})=>{
 await page.goto("/");
 await page.evaluate(async()=>{const {openPartCreator}=await import("/assets/part-create.js");void openPartCreator({onCreate:async part=>{window.__testCreatedPart=part}});});
 await expect(page.locator(".library-part-dialog")).toBeVisible();
 const selection=await page.evaluate(async()=>{
  const dialog=document.querySelector(".library-part-dialog");
  dialog.querySelector(".library-field select")?.setAttribute("data-test-picker","mode");
  const classification=[...dialog.querySelectorAll("label")].find(l=>l.textContent.includes("Part type"))?.querySelector("select");
  classification.value="custom";classification.dispatchEvent(new Event("change"));
  return {exists:!!dialog,numberingText:dialog.querySelector(".library-auto-number")?.textContent,
   checked:dialog.querySelector('input[name="new-part-number-mode"][value="auto"]')?.checked,
   manualAvailable:!!dialog.querySelector('input[name="new-part-number-mode"][value="manual"]'),
   numberAfterSource:[...dialog.querySelectorAll(".library-part-form > *")].findIndex(e=>e.classList.contains("library-number-choice"))===
    [...dialog.querySelectorAll(".library-part-form > *")].findIndex(e=>e.classList.contains("library-workshop-choice-group"))+1,
   numberVisible:!dialog.querySelector(".library-number-choice").classList.contains("hide")};
 });
 expect(selection.exists).toBe(true);
 expect(selection.checked).toBe(true);
 expect(selection.manualAvailable).toBe(true);
 await expect(page.locator(".library-part-dialog .library-auto-number")).toContainText(["Auto assign part number","User assign part number"]);
 expect(selection.numberingText).toContain("Auto assign part number");
 expect(selection.numberAfterSource).toBe(true); // Part number is framed immediately after Part source.
 await expect(page.locator(".library-part-dialog .library-identity-section")).toBeVisible();
 const partDetailsOrder=await page.locator(".library-part-dialog .library-identity-section > .library-field").allTextContents();
 expect(partDetailsOrder[0]).toContain("Part type");
 await expect(page.locator(".library-part-dialog .library-auto-number-tip")).toHaveAttribute("title", /next available part number as defined in the part settings page/);
 await expect(page.locator('.library-part-dialog [data-bs-help-topic="container"]')).toHaveAttribute("title", /project hierarchy/);
 // Tooltip must be visible in the modal top layer, not behind the dialog.
 await page.locator(".library-part-dialog .library-auto-number-tip").hover();
 const sharedTip=page.locator(".library-part-dialog > .bs-global-tooltip");
 await expect(sharedTip).toBeVisible();
 await expect(sharedTip).toContainText("part settings page");
 await page.locator('.library-part-dialog [data-bs-help-topic="container"]').hover();
 await expect(sharedTip).toContainText("project hierarchy");
 // Double-click the information button for a full set of Container examples.
 await page.locator('.library-part-dialog [data-bs-help-topic="container"]').dblclick();
 const guide=page.locator(".bs-help-container-guide");
 await expect(guide).toBeVisible();
 await expect(guide).toContainText("Custom part — made in-house");
 await expect(guide).toContainText("Purchased part");
 await expect(guide).toContainText("Part from Workshop");
 await expect(guide).toContainText("No part selected yet");
 await guide.getByRole("button",{name:"Close examples"}).click();
 await expect(guide).toHaveCount(0);
 await expect(page.locator(".library-part-dialog .library-field",{hasText:"Container"}).locator("input[placeholder=\"e.g. Motor switch\"]")).toHaveAttribute("maxlength","20");
 await expect(page.locator(".library-part-dialog .library-container-name-hint")).toHaveText("(name)");
 await expect(page.locator(".library-part-dialog .library-auto-number-help")).toHaveCount(0);
 expect(selection.numberVisible).toBe(true);
 const itemType=page.locator(".library-part-dialog .library-field",{hasText:"Item type"}).locator("select");
 await expect(itemType).toBeVisible();
 await itemType.selectOption("document");
 await expect(page.locator(".library-part-dialog .library-field",{hasText:"Unit"})).toHaveCount(0);
 await expect(page.locator(".library-part-dialog .library-field",{hasText:"Quantity"})).toBeHidden();
 await itemType.selectOption("part");
 await page.locator('.library-part-dialog input[name="new-part-number-mode"][value="manual"]').check();
 await expect(page.locator(".library-part-dialog .library-number-choice")).toBeVisible();
 await expect(page.locator(".library-part-dialog .library-field",{hasText:"Project BOM number"})).toBeVisible();
 await page.locator('.library-part-dialog input[name="new-part-number-mode"][value="auto"]').check();
 await expect(page.locator(".library-part-dialog .library-field",{hasText:"Project BOM number"})).toBeHidden();
 await page.locator(".library-part-dialog .library-dialog-actions").getByRole("button",{name:"Cancel"}).click();
});

test("new assembly offers automatic or manually entered part numbers",async({page})=>{
 await page.route("**/api/**",route=>route.fulfill({json:apiResponse(route,{user:{id:"assembly-fixture",role:"admin"},nodes:[],components:[],photos:[],workspace:{recipe:[],resources:{tools:[],parts:[],calculators:[]}}})}));
 await page.goto("/");
 const dialog=page.locator("#launcher ~ .assembly-create-dialog").first();
 // Dialogs are mounted at document level, outside the project view.
 const modal=page.locator(".assembly-create-dialog").first();
 await expect(modal).toHaveCount(1);
 await page.evaluate(()=>document.querySelector(".assembly-create-dialog").showModal());
 await expect(modal.getByRole("heading",{name:"New assembly"})).toBeVisible();
 await expect(modal.locator('input[name="assembly-number-mode"][value="auto"]')).toBeChecked();
 await expect(modal.locator(".assembly-manual-number")).toBeHidden();
 await modal.locator('input[name="assembly-number-mode"][value="manual"]').check();
 await expect(modal.locator(".assembly-manual-number")).toBeVisible();
 await expect(modal.locator(".assembly-number-input")).toHaveAttribute("required","");
 await modal.locator(".assembly-number-input").fill("NR0005");
 await modal.locator('input[name="assembly-number-mode"][value="auto"]').check();
 await expect(modal.locator(".assembly-manual-number")).toBeHidden();
 await modal.getByRole("button",{name:"Cancel"}).click();
 await expect(modal).not.toBeVisible();
});

test("linear and robot projects share the complete feature tree, summary, BOM and workspace",async({page})=>{
 const errors=[];page.on("pageerror",error=>errors.push(error.message));
 await page.route("**/api/**",async route=>{
  const u=new URL(route.request().url());let data={};
  if(u.pathname==="/api/auth")data={authenticated:false,isAdmin:false};
  else if(u.pathname==="/api/tree")data=u.searchParams.has("metadata")?{title:null,revision:null}:{nodes:[],revision:"test"};
  else if(u.pathname==="/api/components")data={components:[]};
  else if(u.pathname==="/api/photos")data={photos:[]};
  else if(u.pathname==="/api/workspace")data={workspace:{recipe:[],resources:{tools:[],parts:[],calculators:[]}},revision:"test"};
  else if(u.pathname==="/api/projects")data={};
  else if(u.pathname==="/api/accounts")data={user:null};
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(apiResponse(route,data))});
 });
 await page.goto("/");
 for(const id of ["linear","robot"]){
  await page.goto("/#"+id);
  const root=page.locator("#"+id);
  const tree=root.locator(".assembly-tree-nodes");
  await expect(root.locator(".assembly-summary-sidebar-card .assembly-project-summary-entry:first-child")).toBeVisible();
  await expect(root.locator(".project-summary-page")).toBeVisible();
  for(const role of ["summary-photos","summary-bom","summary-tools"]){
   await expect(root.locator('[data-section="'+role+'"] > .ui-section__header')).toBeVisible();
   await expect(root.locator('[data-section="'+role+'"] > .ui-section__body')).toBeHidden();
  }
  await tree.locator(".assembly-name").first().click();
  await expect(root.locator(".assembly-workspace-page:not(.bom-part-workspace)")).toBeVisible();
  await expect(root.locator(".workspace-back")).toHaveText("Open BOM");
  await root.locator(".workspace-back").click();
  await expect(root.locator(".assembly-bom-screen")).toBeVisible();
  await expect(root.locator(".assembly-bom-list")).toHaveAttribute("aria-pressed","true");
 }
 expect(errors).toEqual([]);
});

test("admin tree right-click menu replaces rename/delete toolbar and main page has rounded frame",async({page})=>{
 const errors=[];
 page.on("pageerror",error=>errors.push(error.message));
 await page.route("**/api/**",async route=>{
  const url=new URL(route.request().url());
  let data={};
  if(url.pathname==="/api/accounts")data={user:{id:"u"+"1".repeat(32),email:"site-admin@example.test",displayName:"Admin",role:"admin"}};
   if(url.pathname==="/api/auth")data={authenticated:true,isAdmin:true};
  if(url.pathname==="/api/tree"&&url.searchParams.has("metadata")){
   data=route.request().method()==="PUT"?{ok:true,title:"Renamed Foam Dart Project",revision:"v2"}:{title:null,revision:null};
  }else if(url.pathname==="/api/tree")data={nodes:[
   {id:"smoke-motor",parentId:null,name:"Motor and Motor Control",kind:"assembly"},
   {id:"smoke-part",parentId:"smoke-motor",name:"Linked Motor",kind:"part",partId:"11111111-1111-4111-8111-111111111111"}
  ],revision:"test"};
  if(url.pathname==="/api/components")data={components:[
   {id:"11111111-1111-4111-8111-111111111111",name:"Linked Motor",fullName:"Long descriptive motor part name",assemblyId:"smoke-motor",quantity:2,quantityUnit:"pcs",
    manufacturer:"Example Motors",model:"C2822",specifications:[],category:"Motor",supplier:"",asin:"",bomOnly:false}
  ]};
  if(url.pathname==="/api/photos")data={photos:[]};
  if(url.pathname==="/api/workspace")data={workspace:{recipe:[
   {id:"step-one",title:"Prepare components",standard:"Inspect the parts",notes:[],photos:[]},
   {id:"step-two",title:"Measure resistance",standard:"Verify resistance",notes:[],photos:[]}
  ],resources:[]},revision:"test"};
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(apiResponse(route,data))});
 });
 await page.goto("/");
 await page.locator('.ui-project-open[data-project="launcher"]').click();
 const sidebar=page.locator("#launcher .assembly-sidebar");
 await expect(sidebar.locator(".assembly-rename")).toBeHidden();
 await expect(sidebar.locator(".assembly-add")).toBeHidden();
 await expect(sidebar.locator(".assembly-add-part")).toBeHidden();
 await expect(sidebar.locator(".assembly-move-button").first()).toBeHidden();
 // Context menu remains accessible with the BOM on a separate screen.
 await expect(sidebar.locator(".assembly-remove")).toBeHidden();
 const row=sidebar.locator(".assembly-node",{hasText:"Motor and Motor Control"});
 const name=row.locator(".assembly-name");
 const prior=await name.boundingBox();
 // Hovering reveals the context-menu affordance without shifting tree text.
 await row.hover();
 const hovered=await name.boundingBox();
 expect(Math.abs(hovered.x-prior.x)).toBeLessThan(0.5);
 expect(Math.abs(hovered.width-prior.width)).toBeLessThan(0.5);
 await expect(row.locator(".assembly-row-menu-trigger")).toBeVisible();
 // Overview and workspace should share the same desktop gutter.
 const overviewSidebar=await sidebar.boundingBox();
 const overviewContent=await page.locator("#launcher .assembly-layout > .assembly-content").boundingBox();
 expect(Math.abs((overviewContent.x-(overviewSidebar.x+overviewSidebar.width))-26)).toBeLessThanOrEqual(2);
 await row.click({button:"right"});
 const menu=page.locator(".assembly-context-menu:visible").last();
 await expect(menu).toBeVisible();
 await expect(menu.locator(".assembly-context-heading")).toContainText("Motor and Motor Control");
 await expect(menu.locator(".assembly-context-section-label")).toContainText(["Create","Edit","Move"]);
 await expect(menu.getByRole("menuitem",{name:"Add part"})).toBeVisible();
 await expect(menu.getByRole("menuitem",{name:"Add subassembly"})).toBeVisible();
 await expect(menu.getByRole("menuitem",{name:"Rename"})).toBeVisible();
 await expect(menu.getByRole("menuitem",{name:"Archive subassembly",exact:true})).toBeVisible();
 await expect(menu.getByRole("menuitem",{name:"Delete",exact:true})).toHaveCount(0);
 await expect(menu.getByRole("menuitem",{name:"Move to…"})).toBeVisible();
 await expect(menu.getByRole("menuitem",{name:"Move up"})).toBeVisible();
 await page.keyboard.press("Escape");
 await expect(menu).toBeHidden();
 // Opening Edit from the narrow BOM moves the existing form to the main pane.
 await sidebar.locator(".assembly-name",{hasText:"Motor and Motor Control"}).click();

 const workspace=page.locator("#launcher .assembly-workspace-page:not(.bom-part-workspace)");
 await expect(workspace).toBeVisible();
 await workspace.locator('[data-section="work-instructions"]>.ui-section__header').click();
 const browser=workspace.locator(".recipe-step-browser");
 const divider=browser.locator(".recipe-step-resizer");
 await expect(divider).toBeVisible();
 await expect(divider).toHaveAttribute("role","separator");
 await divider.focus();
 await page.keyboard.press("ArrowRight");
 expect(Number(await divider.getAttribute("aria-valuenow"))).toBeGreaterThan(31);
 await expect(browser.locator(".recipe-step-list")).toBeVisible();
 await expect(browser.locator(".recipe-step-detail")).toBeVisible();
 // Assembly and part photo controls share the inline photo action bar.
 const assemblyPencil=workspace.locator(".bs-photo-toggle");
 await expect(assemblyPencil).toBeVisible();
 await assemblyPencil.click();
 const assemblyPhotoActions=workspace.locator(".bs-photo-more");
 await expect(assemblyPhotoActions).toBeVisible();
 await expect(assemblyPhotoActions.getByRole("button",{name:"Add"})).toBeVisible();
 await assemblyPencil.click();
 await expect(assemblyPhotoActions).toBeHidden();
 await workspace.locator(".workspace-back").click();
 const bomScreen=page.locator("#launcher .assembly-bom-screen");
 const rowPart=bomScreen.locator(".workspace-saved-parts .bom-part",{hasText:"Linked Motor"}).first();
 await expect(rowPart.locator("input,select,textarea")).toHaveCount(0);
 await rowPart.locator(".bom-part-edit").click();
 await expect(page).toHaveURL(/#launcher\/part\//);
 const partPage=page.locator("#launcher .bom-part-workspace");
 await expect(partPage).toBeVisible();
 await expect(partPage.locator(".part-progress-panel")).toBeVisible();
 await expect(partPage.locator(".part-progress-select")).toHaveValue("not_started");
 // Part instructions use the same white cards as assembly instructions.
 const partInstructionCard=partPage.locator(".workspace-panels > article.recipe-instructions");
 await expect(partInstructionCard).toBeVisible();
 const partCardSurface=await partInstructionCard.evaluate(el=>{
  const style=getComputedStyle(el);
  return {background:style.backgroundColor,border:style.borderTopStyle};
 });
 expect(partCardSurface.background).toBe("rgb(255, 255, 255)");
 expect(partCardSurface.border).toBe("solid");
 const partPencil=partPage.locator(".bs-photo-toggle");
 await expect(partPencil).toBeVisible();
 await partPencil.click();
 const partPhotoActions=partPage.locator(".bs-photo-more");
 await expect(partPhotoActions).toBeVisible();
 await expect(partPhotoActions.getByRole("button",{name:"Add"})).toBeVisible();
 await partPencil.click();
 await expect(partPhotoActions).toBeHidden();
 await partPage.locator('[data-section="part-details"]>.ui-section__header').click();
 await expect(partPage.getByRole("button",{name:"Edit part details",exact:true})).toBeVisible();
 await partPage.getByRole("button",{name:"Edit part details",exact:true}).click();
 await expect(workspace).toHaveClass(/is-editing-bom-part/);
 const editor=workspace.locator(".workspace-main-bom-editor");
 await expect(editor).toBeVisible();
 await expect(workspace.locator(":scope > .workspace-heading")).toBeHidden();
 await expect(workspace.locator(":scope > .workspace-back")).toBeHidden();
 await expect(workspace.locator(".recipe-instructions")).toBeHidden();
 await expect(editor.locator(".part-type-select option[value='custom']")).toHaveText("Custom — made in-house");
 await expect(editor.locator(".part-description-input")).toBeVisible();

 await expect(editor.locator(".component-name")).toHaveValue("Linked Motor");
 await expect(editor.locator(".component-full-name")).toBeHidden();
 // The short headline is the BOM and tree label; the legacy full-name field remains hidden.
 await expect(bomScreen.locator(".workspace-saved-parts")).toContainText("Linked Motor");
 await expect(bomScreen.locator(".workspace-saved-parts")).not.toContainText("Long descriptive motor part name");
 await editor.locator(".component-name").fill("Short motor");
 await expect(editor.locator(".component-name")).toHaveValue("Short motor");
 await editor.locator(".component-quantity").fill("3");
 await expect(editor.locator(".component-quantity")).toHaveValue("3");

 await expect(editor.locator(".component-quantity")).toHaveValue("3");
 // Product lookup is optional; direct fields stay visible without a manual-mode button.
 await expect(editor.locator(".component-manual")).toHaveCount(0);
 await expect(editor.locator(".product-ai-find")).toHaveText("Find part specs with AI");
 await expect(editor.locator(".component-extract")).toBeHidden();
 await expect(editor.locator(".product-ai-inline .product-ai-field")).toHaveCount(0);
 await expect(editor.locator('[data-part-editor-group="additional"]')).toHaveCount(0);
 await expect(editor.locator('[data-part-editor-group="specifications"]')).toHaveCount(0);
 await expect(editor.locator(".part-editor-specs-disclosure")).toHaveCount(1);
 await expect(editor.locator(".component-name")).toBeVisible();
 const basis=editor.locator(".component-historical-price-basis");
 const pack=editor.locator(".component-historical-package-quantity");
 await expect(basis).toHaveValue("per_part");
 await expect(editor.locator(".historical-package-count")).toBeHidden();
 await editor.locator(".component-historical-price").fill("20");
 await basis.selectOption("per_package");
 await expect(editor.locator(".historical-package-count")).toBeVisible();
 await pack.fill("5");
 await expect(editor.locator(".historical-unit-hint")).toContainText("$4.0000 per part");
 await basis.selectOption("per_part");
 await expect(editor.locator(".historical-package-count")).toBeHidden();
 // Add / origin / save / cancel controls form one coherent footer.
 const actions=editor.locator(".component-editor-actions");
 await expect(actions).toBeVisible();
 await editor.locator('[data-section="part-specifications"] > summary').click();
 await editor.locator(".part-editor-group .component-add-spec").click();
 await expect(editor.locator(".part-editor-specs-disclosure")).toBeVisible();
 await expect(editor.locator(".component-spec-row")).toHaveCount(1);
 await expect(editor.locator(".component-spec-row input").first()).toBeFocused();
 const source=editor.locator(".component-spec-row .component-spec-source").first();
 await expect(source).toBeVisible();
 await expect(source.locator('option[value="explicit"]')).toContainText("From product listing");
 await expect(source.locator('option[value="inferred"]')).toContainText("Estimated / inferred");
 await source.selectOption("inferred");
 await expect(actions.locator(".component-editor-primary-actions .component-save")).toBeVisible();
 await expect(actions.locator(".component-editor-primary-actions .workspace-bom-editor-cancel")).toBeVisible();

 // Purchased retains source fields; custom hides fields that do not apply.
 const kind=editor.locator(".part-type-select");
 await expect(kind).toHaveValue("purchased");
 await expect(editor.locator(".component-manufacturer")).toBeVisible();
 await kind.selectOption("custom");
 await expect(editor.locator(".part-functional-edit-field",{hasText:"Part name"})).toBeHidden();
 await expect(editor.locator(".component-manufacturer")).toBeHidden();
 await expect(editor.locator(".component-supplier")).toBeHidden();
 await expect(editor.locator(".component-asin")).toBeHidden();
 await expect(editor.locator(".component-historical-price")).toBeHidden();
 await expect(editor.locator(".component-name")).toBeVisible();
 await kind.selectOption("purchased");
 await expect(editor.locator(".part-functional-edit-field",{hasText:"Part name"})).toBeVisible();
 await expect(editor.locator(".component-manufacturer")).toBeVisible();
 // The old component list must not be duplicated inside the editing form.
 await expect(editor.locator(".component-list")).toBeHidden();
 await expect(bomScreen.locator(".workspace-bom")).toBeHidden();
 expect(await editor.evaluate(el=>el.closest(".part-editor-dialog")!==null)).toBe(true);
 await expect(workspace.locator(".recipe-instructions")).toBeHidden();
 await editor.locator(".workspace-bom-editor-cancel").click();
 await expect(editor).toBeHidden();
 // Editing was launched from Part Details, so Cancel returns to that page.
 await expect(partPage).toBeVisible();
 await sidebar.locator(".assembly-name",{hasText:"Motor and Motor Control"}).click();
 await expect(workspace).toBeVisible();
 // Linked resources show one action until a user creates a reference.
 const toolsDisclosure=workspace.locator('[data-section="helpful-tools"]');
 const resources=workspace.locator(".workspace-resources");
 await expect(resources.locator(".linked-resource-group")).toHaveCount(0);
 await expect(toolsDisclosure.getByRole("button",{name:"+ Add entry",exact:true})).toBeHidden();
 await toolsDisclosure.locator(":scope>.ui-section__header").click();
 await expect(workspace.locator('[data-section="history"]>.ui-section__header')).toContainText("History");
 await expect(workspace.locator('[data-section="history"]')).not.toHaveAttribute("open","");
 await workspace.locator('[data-section="history"]>.ui-section__header').click();
 await expect(workspace.locator('[data-section="history"]')).toHaveAttribute("open","");
 await expect(workspace.locator(".workspace-archive-history > .investigations-panel")).toBeHidden();
 await expect(workspace.locator('[data-section="history"]').getByRole("button",{name:"+ Add entry",exact:true})).toBeVisible();
 await expect(toolsDisclosure.getByRole("button",{name:"+ Add entry",exact:true})).toBeVisible();
 await toolsDisclosure.getByRole("button",{name:"+ Add entry",exact:true}).click();
 await expect(resources.locator(".linked-resource-chooser")).toBeVisible();
 await resources.locator(".linked-resource-chooser select[aria-label='Resource type']").selectOption("calculators");
 await resources.locator(".linked-resource-chooser button",{hasText:"Add selected resource"}).click();
 await expect(resources.locator(".linked-resource-group")).toHaveCount(1);
 await expect(resources.locator(".linked-resource-group h3")).toContainText("Calculators");
 await expect(toolsDisclosure.getByRole("button",{name:"+ Add entry",exact:true})).toBeVisible();
 const frame=page.locator("#launcher .assembly-layout > .assembly-content");
 const radius=await frame.evaluate(el=>parseFloat(getComputedStyle(el).borderTopLeftRadius));
 expect(radius).toBeGreaterThanOrEqual(8);
 expect(errors).toEqual([]);
});


test("Work Instructions keep stable containers while typed entries own their content",async({page})=>{
 await page.route("**/api/**",route=>route.fulfill({json:apiResponse(route,{})}));
 await page.goto("/");
 await page.evaluate(()=>{
  const article=document.createElement("article");article.className="recipe-current-fixture";
  article.innerHTML="<h2>Work instructions</h2>";document.body.append(article);
  window.testRecipe=window.BSRecipes.mount(article,{
   project:"launcher",admin:()=>true,onSave:async()=>{window.lastRecipeSave=window.testRecipe.getData()},
   renderInvestigations:(step,area)=>{
    const host=document.createElement("div");host.className="investigation-active-content";
    const entry=document.createElement("details");entry.className="investigation-card";
    entry.innerHTML="<summary>Voltage measurement</summary><p>5 V</p>";host.append(entry);area.append(host);
   }
  });
  window.testRecipe.setData({recipe:[{id:"step-measure",title:"Measure voltage",tileOrder:["record:measurement"]}]});
 });
 const card=page.locator(".recipe-current-fixture");
 await card.locator(':scope>.ui-section__header').click();
 await expect(card.getByText("Voltage measurement",{exact:true})).toBeVisible();
 await card.getByRole("button",{name:"Expand all entries"}).click();
 await expect(card.locator("details.investigation-card")).toHaveAttribute("open","");
 await card.getByRole("button",{name:"Edit",exact:true}).click();
 await card.getByPlaceholder("Work Instruction name").fill("Measure loaded voltage");
 await card.getByRole("button",{name:"Save",exact:true}).click();
 expect(await page.evaluate(()=>window.lastRecipeSave)).toEqual([{
  id:"step-measure",title:"Measure loaded voltage",archivedAt:"",archiveNote:"",tileOrder:["record:measurement"]
 }]);
 await expect(card.getByRole("button",{name:"Edit",exact:true})).toBeVisible();
});

test("failed Work Instruction saves preserve the edited title and allow retry",async({page})=>{
 await page.route("**/api/**",route=>route.fulfill({json:apiResponse(route,{})}));
 await page.goto("/");
 await page.evaluate(()=>{
  const article=document.createElement("article");article.className="recipe-save-fixture";
  article.innerHTML="<h2>Work instructions</h2>";document.body.append(article);
  window.saveAttempts=0;
  window.testRecipe=window.BSRecipes.mount(article,{
   project:"launcher",admin:()=>true,onSave:async()=>{
    window.saveAttempts++;if(window.saveAttempts===1)throw Error("Network unavailable");
    window.successfulRecipe=window.testRecipe.getData();
   }
  });
  window.testRecipe.setData({recipe:[{id:"step-inspect",title:"Inspect"}]});
 });
 const card=page.locator(".recipe-save-fixture");
 await card.locator(':scope>.ui-section__header').click();
 await card.getByRole("button",{name:"Edit",exact:true}).click();
 await card.getByPlaceholder("Work Instruction name").fill("Inspect voltage");
 await card.getByRole("button",{name:"Save",exact:true}).click();
 await expect(card.locator(".recipe-feedback")).toHaveText("Network unavailable");
 await expect(card.getByPlaceholder("Work Instruction name")).toHaveValue("Inspect voltage");
 await card.getByRole("button",{name:"Save",exact:true}).click();
 await expect(card.getByRole("button",{name:"Edit",exact:true})).toBeVisible();
 expect(await page.evaluate(()=>window.successfulRecipe[0].title)).toBe("Inspect voltage");
});

test("Workshop and Document tree filters operate independently",async({page})=>{
 const errors=[];page.on("pageerror",error=>errors.push(error.message));
 await page.route("**/api/**",async route=>{
  const url=new URL(route.request().url());
  let data={};
  if(url.pathname==="/api/tree")data=url.searchParams.has("assembly")?{page:{description:""},revision:"test"}:{nodes:[
   {id:"assembly-a",parentId:null,name:"Electronics assembly",kind:"assembly"}],revision:"test"};
  if(url.pathname==="/api/components")data={components:[
   {id:"11111111-1111-4111-8111-111111111111",name:"Solder Sucker",assemblyId:"assembly-a",category:"Tool",isTool:true,hideFromFeatureTree:false},
   {id:"22222222-2222-4222-8222-222222222222",name:"Mount Plate",assemblyId:"assembly-a",category:"Machined",isTool:false,hideFromFeatureTree:false},
   {id:"33333333-3333-4333-8333-333333333333",name:"M4 Screws",assemblyId:"assembly-a",category:"Fasteners",isTool:false,hideFromFeatureTree:true},
    {id:"44444444-4444-4444-8444-444444444444",name:"Assembly Drawing",assemblyId:"assembly-a",itemType:"document",hideFromFeatureTree:false}
  ]};
  if(url.pathname==="/api/photos")data={photos:[]};
  if(url.pathname==="/api/workspace")data={workspace:{recipe:[],resources:[]},revision:"test"};
  if(url.pathname==="/api/auth")data={authenticated:false,isAdmin:false};
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(apiResponse(route,data))});
 });
 await page.goto("/");
 await page.locator('.ui-project-open[data-project="launcher"]').click();
 const tree=page.locator("#launcher .assembly-tree-nodes");
 const controls=page.locator("#launcher .assembly-tree-filters");
 await expect(controls).toBeVisible();
 await expect(controls.getByLabel("Workshop item")).toBeVisible();
 await expect(controls.getByLabel("Document")).toBeVisible();
 const assemblyRow=tree.locator(".assembly-node",{hasText:"Electronics assembly"});
 await expect(assemblyRow).toBeVisible();
 await assemblyRow.locator(".assembly-expander").click();
 await expect(tree).toContainText("Mount Plate");
 await expect(tree).toContainText("Assembly Drawing");
 await controls.getByLabel("Workshop item").uncheck();
 await expect(tree).not.toContainText("Solder Sucker");
 await expect(tree).not.toContainText("M4 Screws");
 await controls.getByLabel("Workshop item").check();
 await expect(tree).toContainText("Solder Sucker");
 await controls.getByLabel("Document").uncheck();
 await expect(tree).not.toContainText("Assembly Drawing");
 await expect(tree).toContainText("Solder Sucker");
 await controls.getByLabel("Workshop item").uncheck();
 await expect(tree).not.toContainText("Solder Sucker");
 await expect(tree).not.toContainText("M4 Screws");
 expect(errors).toEqual([]);
});


test("saving a part closes the moved editor and restores part workspace",async({page})=>{
 const partId="11111111-1111-4111-8111-111111111111";
 const part={id:partId,name:"Linked Motor",fullName:"Linked Motor",assemblyId:"smoke-motor",
  quantity:2,quantityUnit:"pcs",partType:"purchased",specifications:[],category:"Motor"};
 let saves=0;const errors=[];
 page.on("pageerror",error=>errors.push(error.message));
 await page.route("**/api/**",async route=>{
  const url=new URL(route.request().url());
  const method=route.request().method();
  let data={};
  if(url.pathname==="/api/accounts")data={user:{id:"u"+"1".repeat(32),email:"site-admin@example.test",displayName:"Admin",role:"admin"}};
   if(url.pathname==="/api/auth")data={authenticated:true,isAdmin:true};
  else if(url.pathname==="/api/tree")data=url.searchParams.has("assembly")?
   {page:{description:""},revision:"test"}:{nodes:[
    {id:"smoke-motor",parentId:null,name:"Motor Control",kind:"assembly"},
    {id:"smoke-part",parentId:"smoke-motor",name:part.name,kind:"part",partId}
   ],revision:"test"};
  else if(url.pathname==="/api/components"){
   if(method==="PUT"){Object.assign(part,route.request().postDataJSON());saves++;data={component:part};}
   else data={components:[part]};
  }else if(url.pathname==="/api/photos")data={photos:[]};
  else if(url.pathname==="/api/workspace")data={workspace:{recipe:[],resources:[]},revision:"test"};
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(apiResponse(route,data))});
 });
 await page.goto("/");
 await page.locator('.ui-project-open[data-project="launcher"]').click();
 const motorRow=page.locator("#launcher .assembly-tree-nodes .assembly-node",{hasText:"Motor Control"});
 await expect(motorRow).toBeVisible();
 await motorRow.locator(".assembly-expander").click();
 await page.locator("#launcher .assembly-tree-nodes .assembly-name",{hasText:"Linked Motor"}).click();
 const partWorkspace=page.locator("#launcher .bom-part-workspace");
 await expect(partWorkspace).toBeVisible();
 await partWorkspace.locator('[data-section="part-details"]>.ui-section__header').click();
 await partWorkspace.getByRole("button",{name:"Edit part details",exact:true}).click();
 const workspace=page.locator("#launcher .assembly-workspace-page:not(.bom-part-workspace)");
 const editor=workspace.locator(".workspace-main-bom-editor");
 await expect(editor).toBeVisible();
 await editor.locator(".component-name").fill("Updated Motor");
 await editor.locator(".component-save").click();
 await expect.poll(()=>saves).toBe(1);
 await expect(page).toHaveURL(new RegExp("#launcher/part/"+partId));
 await expect(partWorkspace).toBeVisible();
 await expect(editor).toBeHidden();
 await expect(workspace).not.toHaveClass(/is-editing-bom-part/);
 expect(errors).toEqual([]);
});


test("personal project builds a private editable workspace from the shared project template",async({page})=>{
 const id="p"+"a".repeat(32),errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 await page.route("**/api/**",async route=>{
  const url=new URL(route.request().url());
  let value={};
  if(url.pathname==="/api/accounts")value={user:{id:"u"+"1".repeat(32),email:"test@example.com",displayName:"Tester"}};
  if(url.pathname==="/api/projects")value={projects:[{id,name:"Test Personal Project",description:"Private prototype",
   visibility:"private",editMode:"approval",ownerId:"u"+"1".repeat(32),isOwner:true}]};
  if(url.pathname==="/api/auth")value={authenticated:false,isAdmin:false};
  if(url.pathname==="/api/tree")value=url.searchParams.has("metadata")?{title:null,revision:null}:{nodes:[],revision:null};
  if(url.pathname==="/api/components")value={components:[]};
  if(url.pathname==="/api/workspace")value={workspace:{recipe:[],resources:{tools:[],parts:[],calculators:[]}},revision:null};
  if(url.pathname==="/api/photos")value={photos:[]};
  if(url.pathname==="/api/drawings")value={drawings:[]};
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(apiResponse(route,value))});
 });
 await page.goto("/");
 const card=page.locator(".ui-project-card",{hasText:"Test Personal Project"});
 await expect(card).toBeVisible();
 await card.locator(".ui-project-open").click();
 const section=page.locator("#"+id);
 await expect(section.locator(".project-summary-page")).toBeVisible();
 await section.locator(".assembly-tree-nodes .assembly-name").first().click();
 await expect(section.locator(".assembly-workspace-page:not(.bom-part-workspace)")).toBeVisible();
 await expect(section.locator(".assembly-workspace-page .workspace-back")).toHaveText("Open BOM");
 await expect(section.locator(".assembly-tree-nodes")).toContainText("Test Personal Project");
 await expect(section.locator(".assembly-add")).not.toHaveClass(/hide/);
 await expect(section.locator(".project-proposals-button")).toHaveCount(0);
 await section.locator(".workspace-back").click();
 await expect(section.locator(".assembly-bom-screen")).toBeVisible();
 await expect(section.locator(".assembly-bom-list")).toHaveAttribute("aria-pressed","true");
 expect(errors).toEqual([]);
});


test("owner manages project settings, numbering and removal",async({page})=>{
 const errors=[];page.on("pageerror",error=>errors.push(error.message));
 const id="p"+"a".repeat(32),ownerId="u"+"1".repeat(32);
 const catalog=[{id,name:"Private test project",description:"Prototype",visibility:"private",
  ownerId,kind:"project",editMode:"approval",isOwner:true}];
 const numbering={prefix:"NR",digits:4,nextAssembly:1,nextPart:1001};
 const proposals=[{id:"33333333-3333-4333-8333-333333333333",project:id,scope:"assembly",targetId:"__root__",
   stepId:"draft-step",field:"standard",originalText:"Use two screws",suggestedText:"Use three screws",status:"pending"}];
 await page.route("**/api/**",async route=>{
  const url=new URL(route.request().url());let value={};
  if(url.pathname==="/api/accounts")value={user:{id:ownerId,email:"owner@example.com",displayName:"Owner"}};
  else if(url.pathname==="/api/projects"){
   if(route.request().method()==="PATCH"){const input=route.request().postDataJSON();Object.assign(catalog[0],input);value={ok:true,projects:catalog};}
   else value={projects:catalog};
  }else if(url.pathname==="/api/proposals"){
   if(route.request().method()==="PATCH"){
    const input=route.request().postDataJSON(),item=proposals.find(p=>p.id===input.id);
    if(item)item.status=input.action==="approve"?"approved":"rejected";
    value={proposal:item};
   }else value={proposals};
  }else if(url.pathname==="/api/numbering"){
   if(route.request().method()==="PUT"){const input=route.request().postDataJSON();numbering.prefix=input.prefix;numbering.digits=input.digits;value={settings:{...numbering}};}
   else value={...numbering,reservedAssemblyRange:"0001–1000"};
  }else if(url.pathname==="/api/tree")value=url.searchParams.has("metadata")?{title:null,revision:null}:{nodes:[],revision:null};
  else if(url.pathname==="/api/components")value={components:[]};
  else if(url.pathname==="/api/photos")value={photos:[]};
  else if(url.pathname==="/api/workspace")value={workspace:{recipe:[],resources:{tools:[],parts:[],calculators:[]}},revision:null};
  else if(url.pathname==="/api/personal-workshop")value={items:[]};
  else if(url.pathname==="/api/auth")value={authenticated:false};
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(apiResponse(route,value))});
 });
 await page.goto("/");
 await expect(page.locator(".project-directory-new")).toBeVisible();
 await page.locator("#home .ui-project-card .ui-project-open").click();
 const summary=page.locator("#"+id+" .project-summary-page");
 const settings=page.locator("#"+id+" .project-settings-page");
 await expect(settings).toBeHidden();
 const tree=page.locator("#"+id+" .assembly-tree-nodes");
 const summaryEntry=page.locator("#"+id+" .assembly-summary-sidebar-card .assembly-project-summary-entry:first-child");
 // Community approval queues are outside the private-application workflow.
 await page.locator("#"+id+" .assembly-project-settings-entry").click();
 await expect(settings.getByRole("heading",{name:"Project settings"})).toBeVisible();
 await expect(page).toHaveURL(new RegExp("#"+id+"/settings$"));
 await expect(settings.locator(".project-settings-card")).toBeVisible();
 await expect(settings.locator(".project-numbering-card")).toBeVisible();
 await expect(settings.getByRole("button",{name:"Delete Project"})).toBeVisible();
 await settings.getByRole("button",{name:"Delete Project"}).click();
 const confirmation=page.locator(".project-delete-dialog:visible");
 await expect(confirmation.getByRole("heading",{name:"Delete project?"})).toBeVisible();
 await expect(confirmation).toContainText("archived, not permanently erased");
 await expect(confirmation.getByRole("button",{name:"Delete Project"})).toBeDisabled();
 await confirmation.getByLabel("Confirm project name").fill("not the project name");
 await expect(confirmation.getByRole("button",{name:"Delete Project"})).toBeDisabled();
 await confirmation.getByLabel("Confirm project name").fill("Private test project");
 await expect(confirmation.getByRole("button",{name:"Delete Project"})).toBeEnabled();
 await confirmation.getByRole("button",{name:"Cancel"}).click();
 await expect(confirmation).toBeHidden();
 await expect(settings.getByRole("heading",{name:"Part numbering"})).toBeVisible();
 await expect(settings.locator(".project-numbering-preview")).toContainText("NR0001");
 await expect(settings.locator(".project-numbering-preview")).toContainText("NR1001");
 await expect(settings.locator(".project-numbering-nomenclature")).toContainText("manufacturer");
 await settings.getByLabel("Prefix").fill("PR");
 await settings.getByLabel("Minimum digits").selectOption("5");
 await settings.getByRole("button",{name:"Save numbering format"}).click();
 await expect.poll(()=>numbering.prefix).toBe("PR");
 await expect(settings.locator(".project-numbering-preview")).toContainText("PR01001");
 await expect(settings.getByLabel("Visibility")).toHaveCount(0);
 const savedSettings=page.waitForResponse(response=>response.url().includes("/api/projects")&&response.request().method()==="PATCH");
 await settings.getByRole("button",{name:"Save settings"}).click();
 expect((await savedSettings).ok()).toBe(true);
 await expect.poll(()=>catalog[0].visibility).toBe("private");
 await expect(settings.getByLabel("Editing permissions")).toHaveCount(0);
 await settings.getByRole("button",{name:"← Project summary",exact:true}).click();
 await tree.locator(".assembly-name").first().click();
 await expect(page).toHaveURL(new RegExp("#"+id+"/workspace/__root__"));
 await expect(page.locator("#"+id+" .workspace-project-settings")).toHaveCount(0);
 await page.locator("#"+id+" .assembly-summary-sidebar-card .assembly-project-summary-entry:first-child").click();
 await expect(summary).toBeVisible();
 expect(errors).toEqual([]);
});


test("documents can be hidden independently in feature tree and BOM",async({page})=>{
 const components=[
  {id:"44444444-4444-4444-8444-444444444444",name:"Assembly drawing",itemType:"document",partType:"purchased",quantity:1,quantityUnit:"pcs"},
  {id:"55555555-5555-4555-8555-555555555555",name:"Housing",itemType:"part",partType:"custom",quantity:1,quantityUnit:"pcs"}
 ];
 await page.route("**/api/**",async route=>{
  const u=new URL(route.request().url());let data={};
  if(u.pathname==="/api/auth")data={authenticated:false,isAdmin:false};
  else if(u.pathname==="/api/tree")data=u.searchParams.has("metadata")?{title:null,revision:null}:{nodes:[],revision:"one"};
  else if(u.pathname==="/api/components")data={components};
  else if(u.pathname==="/api/photos")data={photos:[]};
  else if(u.pathname==="/api/workspace")data={workspace:{recipe:[],resources:{tools:[],parts:[],calculators:[]}},revision:"one"};
  else if(u.pathname==="/api/projects")data={};
  else if(u.pathname==="/api/accounts")data={user:null};
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(apiResponse(route,data))});
 });
 await page.goto("/#launcher");
 const tree=page.locator("#launcher .assembly-tree-nodes");
 const filter=page.locator("#launcher .assembly-tree-filters").getByLabel("Documents");
 await expect(tree).toContainText("Assembly drawing");
 await filter.uncheck();
 await expect(tree).not.toContainText("Assembly drawing");
 await expect(tree).toContainText("Housing");
 await filter.check();
 await tree.locator(".assembly-name").first().click();
 await page.locator("#launcher .workspace-back").click();
 const bom=page.locator("#launcher .assembly-bom-screen");
 const documentToggle=bom.locator(".assembly-bom-documents-toggle input");
 await expect(documentToggle).toBeChecked();
 // Scope visibility assertions to rendered BOM rows. The surrounding
 // screen also contains the part editor, which does not inherit BOM filters.
 const bomRows=bom.locator(".workspace-saved-parts");
 await expect(bomRows).toContainText("Assembly drawing");
 await documentToggle.uncheck();
 await expect(bomRows).not.toContainText("Assembly drawing");
 await expect(bomRows).toContainText("Housing");
 await bom.locator(".assembly-bom-pictures").click();
 await expect(bom.locator(".assembly-bom-picture-view")).not.toContainText("Assembly drawing");
});

test("Edit Part separates Container, Part details and purchased alternatives",async({page})=>{
 await page.goto("/");
 const source=await page.evaluate(async()=>{
  const response=await fetch("/assets/site-assembly.js",{cache:"no-store"});
  return response.text();
 });
 expect(source).toContain('group("container","Container",controls.itemType,controls.name,controls.partNumber,');
 expect(source).toContain('partDescriptionRow);');
 expect(source).not.toContain('functionalRequirementsField');
 expect(source).not.toContain('functionalAcceptanceField');
 expect(source).not.toContain('partImplementationUnselectedRow');
 expect(source).toContain('group("implementation","Part details"');
 expect(source).toContain('toolRow,partImplementationNameRow');
 expect(source).toContain('fields.display.filter(key=>key!=="isTool")');
 expect(source).toContain('toolCaption.textContent="Is a tool?"');
 expect(source).toContain('toolControl.append(toolCheckbox,toolHelp)');
 expect(source).toContain('className="part-visibility-field part-tool-field"');
 expect(source).not.toContain('retire.textContent="Retire selected implementation"');
 expect(source).not.toContain('addButton.textContent="Add implementation"');
 expect(source).not.toContain('heading.textContent="Function & requirements"');
 expect(source).toContain("initPartSpecifications");
 expect(source).not.toContain('group("additional","Additional details"');
 expect(source).not.toContain('group("specifications","Specifications"');
 expect(source).toContain('document.createTextNode("Part number")');
 expect(source).toContain('className="part-container-caption"');
 expect(source).toContain('textContent="Container (name)"');
 expect(source).not.toContain('firstChild.nodeValue="Functional part name"');
 expect(source).not.toContain('document.createTextNode("Functional part number")');
 const editorStyles=await page.evaluate(async()=>{
  const response=await fetch("/assets/site-controls.css",{cache:"no-store"});
  return response.text();
 });
 expect(editorStyles).toMatch(/--edit-part-label-width:\s*168px/);
 expect(editorStyles).toMatch(/grid-template-columns:\s*var\(--edit-part-label-width\) minmax\(0,\s*1fr\)/);
 expect(editorStyles).toMatch(/\.part-editor-group\s*>\s*label\s*>\s*\.field/);
 expect(editorStyles).toMatch(/@media\s*\(max-width:\s*520px\)/);
});

test("project navigation orders summary below tree and page notes can be created with existing photo upload",async({page})=>{
 const saves=[],seen=[];
 page.on("pageerror",e=>{throw e});
 await page.route("**/api/**",async route=>{
  const url=new URL(route.request().url()),method=route.request().method();
  let data={};
  if(url.pathname==="/api/unstructured-notes"){
   const scope=url.searchParams.get("scope"),id=url.searchParams.get("id");
   seen.push(scope+":"+id);
   if(method==="PUT"){
    const body=route.request().postDataJSON();saves.push({scope,id,...body});
    data={notes:body.notes,revision:"new-revision"};
   }else data={notes:[],revision:null,canEdit:true};
  }else if(url.pathname==="/api/photos"){
   if(method==="POST")data={ok:true,id:"launcher/11111111-1111-4111-8111-111111111111.png"};
   else data={photos:[]};
  }else if(url.pathname==="/api/components")data={components:[]};
  else if(url.pathname==="/api/tree")data={nodes:[],revision:"test"};
  else if(url.pathname==="/api/workspace")data={workspace:{recipe:[],resources:[]},revision:"test"};
  else if(url.pathname==="/api/projects")data={};
  else if(url.pathname==="/api/auth")data={authenticated:false,isAdmin:false};
  else if(url.pathname==="/api/accounts")data={user:null};
  else if(url.pathname==="/api/commonparts"||url.pathname==="/api/purchased-parts")data={parts:[]};
  else if(url.pathname==="/api/wires")data={wires:[]};
  else if(url.pathname==="/api/part-files")data={files:[]};
  else if(url.pathname==="/api/drawings")data={drawings:[]};
  await route.fulfill({status:method==="POST"&&url.pathname==="/api/photos"?201:200,
   contentType:"application/json",body:JSON.stringify(apiResponse(route,data))});
 });
 await page.goto("/#launcher");
 const sidebar=page.locator("#launcher .assembly-sidebar");
 await expect(sidebar.locator(".assembly-summary-sidebar-card")).toBeVisible();
 const order=await sidebar.evaluate(root=>[...root.children].map(e=>e.className));
 const tree=order.findIndex(c=>c.includes("feature-tree-frame"));
 const summary=order.findIndex(c=>c.includes("assembly-summary-sidebar-card"));
 expect(tree).toBeGreaterThanOrEqual(0);expect(summary).toBe(tree+1);
 await expect(sidebar.locator(".assembly-summary-sidebar-card button")).toHaveText(["Project summary","Parts Management","Project Settings"]);
 await expect(sidebar.locator(".assembly-project-settings-entry")).toBeVisible();
 const panel=page.locator('#launcher .project-summary-page [data-section="notes"]');
 await expect(panel).toBeVisible();
 await expect(panel.getByRole("button",{name:"+ Add entry"})).toBeHidden();
 await panel.locator(".ui-section__header").click();
 await panel.getByRole("button",{name:"+ Add entry"}).click();
 await panel.getByPlaceholder("Enter a note title").fill("Loose thoughts");
 await panel.getByPlaceholder("Write anything useful here…").fill("Test mounting orientation");
 await panel.locator('input[type="file"]').setInputFiles({
  name:"fixture.png",mimeType:"image/png",buffer:Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/qLkAAAAASUVORK5CYII=","base64")
 });
 await expect(panel.getByText("Photo uploaded.")).toBeVisible();
 await panel.getByRole("button",{name:"Save note"}).click();
 await expect(panel.getByRole("button",{name:"Loose thoughts"})).toBeVisible();
 await panel.getByRole("button",{name:"Loose thoughts"}).click();
 await expect(panel.getByText("Test mounting orientation")).toBeVisible();
 expect(saves).toHaveLength(1);
 expect(saves[0].scope).toBe("summary");
 expect(saves[0].notes[0].photos).toHaveLength(1);
 await sidebar.locator(".assembly-tree-nodes .assembly-name").first().click();
 await expect(page.locator('#launcher .assembly-workspace-page:not(.bom-part-workspace) [data-section="notes"]')).toBeVisible();
 expect(seen).toContain("summary:root");expect(seen.some(x=>x.startsWith("workspace:"))).toBe(true);
});

test("photo pencil accepts pasted images and Code and Document items have distinct defaults",async({page})=>{
 const code="22222222-2222-4222-8222-222222222222",doc="33333333-3333-4333-8333-333333333333";
 const uploads=[];
 let partHasImage=false;
 await page.route("**/api/**",async route=>{
  const url=new URL(route.request().url());
  const method=route.request().method();
  let data={};
  if(url.pathname==="/api/accounts")data={user:{id:"test-admin",displayName:"Test admin",role:"admin"}};
  if(url.pathname==="/api/tree")data={nodes:[],revision:"test"};
  if(url.pathname==="/api/workspace")data={workspace:{recipe:[],resources:[]}};
  if(url.pathname==="/api/components")data={components:[
   {id:code,name:"Controller code",itemType:"document",partType:"code"},
   {id:doc,name:"Wiring notes",itemType:"document"}
  ]};
  if(url.pathname==="/api/photos"){
   data={photos:[]};
   if(method==="POST")uploads.push({scope:route.request().headers()["x-photo-assembly"],mime:route.request().headers()["content-type"]});
  }
  if(url.pathname==="/api/components/photo"&&method==="POST"){
   partHasImage=true;
   uploads.push({scope:url.searchParams.get("id"),mime:route.request().headers()["content-type"]});
  }
  if(url.pathname==="/api/photo-annotations"&&url.searchParams.get("view")==="1"){
   if(partHasImage&&url.searchParams.get("id")===code)
    return route.fulfill({path:"assets/default-document-photo.webp",contentType:"image/webp"});
   return route.fulfill({status:404});
  }
  await route.fulfill({json:apiResponse(route,data)});
 });
 const pasteImage=async field=>field.evaluate(element=>{
  const data=new DataTransfer();
  data.items.add(new File([new Uint8Array([137,80,78,71])],"clipboard.png",{type:"image/png"}));
  element.dispatchEvent(new ClipboardEvent("paste",{clipboardData:data,bubbles:true,cancelable:true}));
 });
 await page.goto("/#launcher/workspace/__root__");
 const assembly=page.locator("#launcher .assembly-workspace-page:not(.bom-part-workspace)");
 const pasteField=scope=>scope.getByRole("textbox",{name:"Paste a copied photo",includeHidden:true});
 await expect(pasteField(assembly)).toBeHidden();
 await assembly.getByRole("button",{name:"Edit photo"}).click();
 await assembly.getByRole("button",{name:"Add",exact:true}).click();
 await expect(pasteField(assembly)).toBeVisible();
 await expect(pasteField(assembly)).toHaveAttribute("contenteditable","true");
 await pasteImage(pasteField(assembly));
 await expect.poll(()=>uploads.at(0)).toEqual({scope:"root-assembly",mime:"image/png"});
 await assembly.getByRole("button",{name:"Edit photo"}).click();
 await expect(pasteField(assembly)).toBeHidden();

 await page.goto("/#launcher/part/"+code);
 const part=page.locator("#launcher .bom-part-workspace");
 const cover=part.locator(".part-workspace-cover img");
 await expect(cover).toHaveAttribute("src","/assets/default-code-photo.webp");
 await expect.poll(()=>cover.evaluate(image=>image.naturalWidth)).toBeGreaterThan(0);
 await part.getByRole("button",{name:"Edit photo"}).click();
 await expect(part.getByRole("button",{name:"Delete",exact:true})).toBeDisabled();
 await part.getByRole("button",{name:"Add",exact:true}).click();
 await expect(pasteField(part)).toBeVisible();
 await pasteImage(pasteField(part));
 await expect.poll(()=>uploads.at(1)).toEqual({scope:code,mime:"image/png"});
 await expect(cover).toHaveAttribute("src",/\/api\/photo-annotations/);
 await expect(part.getByRole("button",{name:"Delete",exact:true})).toBeEnabled();

 await page.goto("/#launcher/part/"+doc);
 await expect(cover).toHaveAttribute("src","/assets/default-document-photo.webp");
 await expect.poll(()=>cover.evaluate(image=>image.naturalWidth)).toBeGreaterThan(0);
});
