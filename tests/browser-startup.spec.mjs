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
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(data)});
 });
 await page.goto("/");
 const initialTree=page.locator("#launcher .assembly-tree-nodes");
 await expect(initialTree.locator(".assembly-name")).toHaveCount(2);
 await page.locator('.project-link[data-nav="launcher"]').click();
 const workspace=page.locator("#launcher .assembly-workspace-page:not(.bom-part-workspace)");
 const screen=page.locator("#launcher .assembly-bom-screen");
 const tree=page.locator("#launcher .assembly-tree-nodes");
 const summary=page.locator("#launcher .project-summary-page");
 await expect(summary).toBeVisible();
 const summaryEntry=page.locator("#launcher .assembly-summary-sidebar-card .assembly-project-summary-entry");
 await expect(summaryEntry).toHaveText("Project summary");
 await expect(summaryEntry).toHaveAttribute("aria-current","page");
 const partsEntry=page.locator("#launcher .assembly-parts-management-link");
 await expect(partsEntry).toBeVisible();
 const navVisual=await page.locator("#launcher .assembly-sidebar").evaluate(sidebar=>{
  const a=sidebar.querySelector(".assembly-summary-sidebar-card .assembly-project-summary-entry");
  const b=sidebar.querySelector(".assembly-parts-management-link");
  const box=element=>{const r=element.getBoundingClientRect(),style=getComputedStyle(element);
   return {x:r.x,width:r.width,height:r.height,padding:style.padding,borderRadius:style.borderRadius,
    borderWidth:style.borderWidth,fontSize:style.fontSize}};
  return {summary:box(a),parts:box(b),wrapperDisplay:getComputedStyle(a.parentElement).display};
 });
 expect(navVisual.wrapperDisplay).toBe("contents");
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
 const selection=await page.evaluate(async()=>{
  const opened=window.BSLibraryPartPicker.open({onCreate:async part=>{window.__testCreatedPart=part}});
  const dialog=document.querySelector(".library-part-dialog");
  dialog.querySelector(".library-field select")?.setAttribute("data-test-picker","mode");
  const classification=[...dialog.querySelectorAll("label")].find(l=>l.textContent.includes("Part type"))?.querySelector("select");
  classification.value="custom";classification.dispatchEvent(new Event("change"));
  return {exists:!!dialog,numberingText:dialog.querySelector(".library-auto-number")?.textContent,
   checked:dialog.querySelector('input[name="new-part-number-mode"][value="auto"]')?.checked,
   manualAvailable:!!dialog.querySelector('input[name="new-part-number-mode"][value="manual"]'),
   nameBeforeNumber:[...dialog.querySelectorAll(".library-part-form > *")].findIndex(e=>e.classList.contains("library-number-choice"))<
    [...dialog.querySelectorAll(".library-part-form > *")].findIndex(e=>e.textContent?.startsWith("Part name")),
   numberVisible:!dialog.querySelector(".library-number-choice").classList.contains("hide")};
 });
 expect(selection.exists).toBe(true);
 expect(selection.checked).toBe(true);
 expect(selection.manualAvailable).toBe(true);
 expect(selection.numberingText).toContain("Assign next available project number");
 expect(selection.nameBeforeNumber).toBe(true); // Project part number appears before Part name.
 await expect(page.locator(".library-part-dialog .library-auto-number-inline-note")).toHaveText("Assigned when part is saved");
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
  else if(u.pathname==="/api/projects")data={projects:[]};
  else if(u.pathname==="/api/accounts")data={user:null};
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(data)});
 });
 await page.goto("/");
 for(const id of ["linear","robot"]){
  await page.goto("/#"+id);
  const root=page.locator("#"+id);
  const tree=root.locator(".assembly-tree-nodes");
  await expect(root.locator(".assembly-summary-sidebar-card .assembly-project-summary-entry")).toBeVisible();
  await expect(root.locator(".project-summary-page")).toBeVisible();
  await expect(root.locator(".project-summary-gallery")).toBeVisible();
  await expect(root.locator(".project-summary-bom-section")).toBeVisible();
  await expect(root.locator(".project-summary-tools-section")).toBeVisible();
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
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(data)});
 });
 await page.goto("/");
 await page.locator('.project-link[data-nav="launcher"]').click();
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
 await expect(menu.getByRole("menuitem",{name:"Delete",exact:true})).toBeVisible();
 await expect(menu.getByRole("menuitem",{name:"Move to…"})).toBeVisible();
 await expect(menu.getByRole("menuitem",{name:"Move up"})).toBeVisible();
 await page.keyboard.press("Escape");
 await expect(menu).toBeHidden();
 // Opening Edit from the narrow BOM moves the existing form to the main pane.
 await sidebar.locator(".assembly-name",{hasText:"Motor and Motor Control"}).click();

 const workspace=page.locator("#launcher .assembly-workspace-page:not(.bom-part-workspace)");
 await expect(workspace).toBeVisible();
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
 await partPage.locator(".part-details-collapse summary").click();
 await expect(partPage.locator(".part-details-edit")).toBeVisible();
 await partPage.locator(".part-details-edit").click();
 await expect(workspace).toHaveClass(/is-editing-bom-part/);
 const editor=workspace.locator(".workspace-main-bom-editor");
 await expect(editor).toBeVisible();
 await expect(workspace.locator(":scope > .workspace-heading")).toBeHidden();
 await expect(workspace.locator(":scope > .workspace-back")).toBeHidden();
 await expect(workspace.locator(".recipe-instructions")).toBeHidden();
 await expect(editor.locator(".part-type-select option[value='custom']")).toHaveText("Custom");
 const optionalLabels=await editor.locator("label").allTextContents();
 expect(optionalLabels.some(label=>label.includes("(optional)"))).toBe(false);

 await expect(editor.locator(".component-name")).toHaveValue("Linked Motor");
 await expect(editor.locator(".component-full-name")).toBeHidden();
 // The short headline is the BOM and tree label; the legacy full-name field remains hidden.
 await expect(bomScreen.locator(".workspace-saved-parts")).toContainText("Linked Motor");
 await expect(bomScreen.locator(".workspace-saved-parts")).not.toContainText("Long descriptive motor part name");
 await editor.locator(".component-name").click();
 await page.keyboard.type("Short motor");
 await expect(editor.locator(".component-name")).toHaveValue("Short motor");
 await editor.locator(".component-quantity").click();
 await page.keyboard.press("3");
 await expect(editor.locator(".component-quantity")).toHaveValue("3");

 await expect(editor.locator(".component-quantity")).toHaveValue("3");
 // Product lookup is optional; direct fields stay visible without a manual-mode button.
 await expect(editor.locator(".component-manual")).toHaveCount(0);
 await expect(editor.locator(".component-extract")).toHaveText("Look up product details");
 await expect(editor.locator(".component-lookup-help")).toContainText("Paste a product link");
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
 await actions.locator(".component-add-spec").click();
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
 await expect(editor.locator(".component-manufacturer")).toBeHidden();
 await expect(editor.locator(".component-supplier")).toBeHidden();
 await expect(editor.locator(".component-asin")).toBeHidden();
 await expect(editor.locator(".component-historical-price")).toBeHidden();
 await expect(editor.locator(".component-category")).toBeHidden();
 await expect(editor.locator(".component-name")).toBeVisible();
 await kind.selectOption("purchased");
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
 const resources=workspace.locator(".workspace-resources");
 await expect(resources.locator(".linked-resource-group")).toHaveCount(0);
 await expect(resources.locator(".linked-resource-add")).toBeVisible();
 await resources.locator(".linked-resource-add").click();
 await expect(resources.locator(".linked-resource-chooser")).toBeVisible();
 await resources.locator(".linked-resource-chooser select[aria-label='Resource type']").selectOption("calculators");
 await resources.locator(".linked-resource-chooser button",{hasText:"Add selected resource"}).click();
 await expect(resources.locator(".linked-resource-group")).toHaveCount(1);
 await expect(resources.locator(".linked-resource-group h3")).toContainText("Calculators");
 await expect(resources.locator(".linked-resource-add")).toBeVisible();
 const frame=page.locator("#launcher .assembly-layout > .assembly-content");
 const radius=await frame.evaluate(el=>parseFloat(getComputedStyle(el).borderTopLeftRadius));
 expect(radius).toBeGreaterThanOrEqual(8);
 expect(errors).toEqual([]);
});


test("step editor keeps photo attachments with their note and saves from either end",async({page})=>{
 const errors=[];
 page.on("pageerror",error=>errors.push(error.message));
 await page.route("**/api/**",route=>{
  const pathname=new URL(route.request().url()).pathname;
  if(pathname==="/api/recipe-files"&&route.request().method()==="POST"){
   return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({id:"recipe-files/launcher/11111111-1111-4111-8111-111111111111.png"})});
  }
  return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(pathname==="/api/auth"?{authenticated:false,isAdmin:false}:{})});
 });
 await page.goto("/");
 await page.evaluate(()=>{
  const article=document.createElement("article");
  article.className="recipe-test-article";
  article.innerHTML="<h2>Work instructions</h2>";
  document.body.append(article);
  window.testRecipe=window.BSRecipes.mount(article,{
   project:"launcher",admin:()=>true,
   onSave:async()=>{window.lastRecipeSave=window.testRecipe.getData()}
  });
  window.testRecipe.setData({recipe:[
   {id:"test-step",title:"Measure",standard:"Verify resistance",
    notes:["Connect the meter","Record the reading"],photos:[],photoNames:{}}
  ]});
 });
 const card=page.locator(".recipe-test-article");
 await card.locator(".recipe-step-edit-toggle").click();
 await expect(card.locator(".recipe-step-edit-toggle")).toHaveText("Save");
 await expect(card.locator(".recipe-save-step-bottom")).toHaveText("Save");
 await expect(card.getByRole("button",{name:"Duplicate"})).toHaveCount(0);
 const notes=card.locator(".recipe-step-note");
 await expect(notes).toHaveCount(2);
 const chooser=page.waitForEvent("filechooser");
 await notes.nth(0).getByRole("button",{name:"Add photo after note 1"}).click();
 await (await chooser).setFiles({name:"measurement.png",mimeType:"image/png",buffer:Buffer.from("sample")});
 await expect(notes.nth(0).locator(".recipe-step-photo")).toHaveCount(1);
 await expect(notes.nth(1).locator(".recipe-step-photo")).toHaveCount(0);
 await expect.poll(()=>page.evaluate(()=>window.testRecipe.hasPendingUploads())).toBe(false);
 await card.locator(".recipe-save-step-bottom").click();
 await expect(card.locator(".recipe-step-edit-toggle")).toHaveText("Edit");
 const saved=await page.evaluate(()=>window.lastRecipeSave?.[0]);
 expect(saved.photoAfterNote).toEqual({"recipe-files/launcher/11111111-1111-4111-8111-111111111111.png":0});
 expect(saved.noteIds).toHaveLength(2);
 expect(saved.photoNoteIds["recipe-files/launcher/11111111-1111-4111-8111-111111111111.png"]).toBe(saved.noteIds[0]);
 await page.evaluate(()=>window.testRecipe.setData({recipe:window.lastRecipeSave}));
 await expect(card.locator(".recipe-step-detail .recipe-reader-photo")).toHaveCount(1);
 const content=await card.locator(".recipe-reader-text").innerText();
 expect(content.indexOf("Connect the meter")).toBeLessThan(content.indexOf("Record the reading"));
 // Removing an associated note makes its photo unassigned, never deleted.
 await card.locator(".recipe-step-edit-toggle").click();
 await card.locator(".recipe-step-note").first().getByRole("button",{name:"Remove note"}).click();
 await expect(card.locator(".recipe-step-photos .recipe-step-photo")).toHaveCount(1);
 await card.locator(".recipe-save-step-bottom").click();
 const afterRemoval=await page.evaluate(()=>window.lastRecipeSave?.[0]);
 expect(afterRemoval.notes).toEqual(["Record the reading"]);
 expect(afterRemoval.noteIds).toHaveLength(1);
 expect(afterRemoval.photos).toHaveLength(1);
 expect(afterRemoval.photoNoteIds).toEqual({});
 await page.evaluate(()=>window.testRecipe.setData({recipe:window.lastRecipeSave}));
 await expect(card.locator(".recipe-step-detail .recipe-reader-photo")).toHaveCount(1);
 expect(errors).toEqual([]);
});

test("in-flight uploads block saving and a failed save preserves the editor",async({page})=>{
 let releaseUpload;
 const uploadGate=new Promise(resolve=>{releaseUpload=resolve});
 const errors=[];
 page.on("pageerror",error=>errors.push(error.message));
 await page.route("**/api/**",async route=>{
  const pathname=new URL(route.request().url()).pathname;
  if(pathname==="/api/recipe-files"&&route.request().method()==="POST"){
   await uploadGate;
   return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
    id:"recipe-files/launcher/22222222-2222-4222-8222-222222222222.png"
   })});
  }
  return route.fulfill({status:200,contentType:"application/json",body:"{}"});
 });
 await page.goto("/");
 await page.evaluate(()=>{
  const article=document.createElement("article");
  article.className="recipe-upload-guard";
  article.innerHTML="<h2>Work instructions</h2>";
  document.body.append(article);
  window.saveAttempts=0;
  window.guardedRecipe=window.BSRecipes.mount(article,{
   project:"launcher",admin:()=>true,
   onSave:async()=>{
    window.saveAttempts++;
    if(window.saveAttempts===1)throw Error("Network unavailable");
    window.successfulRecipe=window.guardedRecipe.getData();
   }
  });
  window.guardedRecipe.setData({recipe:[{
   id:"guard-step",title:"Inspect",standard:"Check voltage",
   notes:["Test note"],photos:[],photoNames:{}
  }]});
 });
 const card=page.locator(".recipe-upload-guard");
 await card.locator(".recipe-step-edit-toggle").click();
 const chooser=page.waitForEvent("filechooser");
 await card.getByRole("button",{name:"Add photo after note 1"}).click();
 await (await chooser).setFiles({name:"meter.png",mimeType:"image/png",buffer:Buffer.from("sample")});
 await expect(card.locator(".recipe-feedback")).toContainText("Uploading attachment");
 await card.locator(".recipe-save-step-bottom").click();
 await expect(card.locator(".recipe-feedback")).toContainText("Wait for photo uploads");
 expect(await page.evaluate(()=>window.saveAttempts)).toBe(0);
 releaseUpload();
 await expect(card.locator(".recipe-step-note .recipe-step-photo")).toHaveCount(1);
 await card.locator(".recipe-save-step-bottom").click();
 await expect(card.locator(".recipe-feedback")).toContainText("Network unavailable");
 await expect(card.locator(".recipe-step-edit-toggle")).toHaveText("Save");
 await expect(card.locator(".recipe-step-note textarea")).toHaveValue("Test note");
 await card.locator(".recipe-save-step-bottom").click();
 await expect(card.locator(".recipe-step-edit-toggle")).toHaveText("Edit");
 const saved=await page.evaluate(()=>window.successfulRecipe?.[0]);
 expect(saved.photoNoteIds[saved.photos[0]]).toBe(saved.noteIds[0]);
 expect(errors).toEqual([]);
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
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(data)});
 });
 await page.goto("/");
 await page.locator('.project-link[data-nav="launcher"]').click();
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
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(data)});
 });
 await page.goto("/");
 await page.locator('.project-link[data-nav="launcher"]').click();
 const motorRow=page.locator("#launcher .assembly-tree-nodes .assembly-node",{hasText:"Motor Control"});
 await expect(motorRow).toBeVisible();
 await motorRow.locator(".assembly-expander").click();
 await page.locator("#launcher .assembly-tree-nodes .assembly-name",{hasText:"Linked Motor"}).click();
 const partWorkspace=page.locator("#launcher .bom-part-workspace");
 await expect(partWorkspace).toBeVisible();
 await partWorkspace.locator(".part-details-collapse summary").click();
 await partWorkspace.locator(".part-details-edit").click();
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
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(value)});
 });
 await page.goto("/");
 const card=page.locator(".project-personal-card",{hasText:"Test Personal Project"});
 await expect(card).toBeVisible();
 await card.locator(".project-link").click();
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


test("owner manages project privacy and removal from the summary",async({page})=>{
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
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(value)});
 });
 await page.goto("/");
 await expect(page.locator(".project-owner-actions")).toBeVisible();
 await page.locator(".project-personal-card .project-link").click();
 const summary=page.locator("#"+id+" .project-summary-page");
 const settings=page.locator(".project-settings-dialog .project-summary-owner-settings");
 await expect(settings).toBeHidden();
 const tree=page.locator("#"+id+" .assembly-tree-nodes");
 const summaryEntry=page.locator("#"+id+" .assembly-summary-sidebar-card .assembly-project-summary-entry");
 await expect(summaryEntry).toContainText("1 change waiting");
 await expect(summary.locator(".project-summary-review")).toBeVisible();
 await expect(summary.locator(".project-summary-review-list li")).toHaveCount(1);
 await summary.getByRole("button",{name:"Review suggestions"}).click();
 const modal=page.locator(".project-manage-dialog:visible");
 await expect(modal).toContainText("Use three screws");
 await modal.getByRole("button",{name:"Approve and apply"}).click();
 await expect(summary.locator(".project-summary-review")).toBeHidden();
 await expect(summaryEntry).not.toContainText("change waiting");
 await modal.getByRole("button",{name:"Close"}).click();

 await page.getByRole("button",{name:"Project Settings",exact:true}).click();
 await expect(settings.getByRole("heading",{name:"Project settings"})).toBeVisible();
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
 await settings.getByLabel("Visibility").selectOption("public");
 await settings.getByRole("button",{name:"Save settings"}).click();
 await expect.poll(()=>catalog[0].visibility).toBe("public");
 await expect(settings.getByLabel("Visibility")).toHaveValue("public");
 await page.getByRole("dialog",{name:"Project settings"}).getByRole("button",{name:"Close",exact:true}).click();
 await tree.locator(".assembly-name").first().click();
 await expect(page).toHaveURL(new RegExp("#"+id+"/workspace/__root__"));
 await expect(page.locator("#"+id+" .workspace-project-settings")).toHaveCount(0);
 await page.locator("#"+id+" .assembly-summary-sidebar-card .assembly-project-summary-entry").click();
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
  else if(u.pathname==="/api/projects")data={projects:[]};
  else if(u.pathname==="/api/accounts")data={user:null};
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(data)});
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

test("administrator can add a catalog item from the Workshop and open its details",async({page})=>{
 let posted=null;
 page.on("pageerror",error=>{throw error});
 await page.route("**/api/**",async route=>{
  const url=new URL(route.request().url()),method=route.request().method();
  let data={};
  if(url.pathname==="/api/workshop-reference"){
   if(method==="GET")data={items:{},canEdit:true};
   else if(method==="POST"&&route.request().headers()["content-type"]?.includes("application/json")){
    posted=route.request().postDataJSON();
    data={id:"workshop:custom-test-item",details:{...posted.details,created:true}};
   }
  }else if(url.pathname==="/api/accounts"){
   data={user:{id:"u"+("1".repeat(32)),role:"admin",displayName:"Test Administrator",email:"admin@example.test"}};
  }else if(url.pathname==="/api/auth"){
   data={authenticated:true,isAdmin:true};
  }else if(url.pathname==="/api/personal-workshop")data={items:[]};
  else if(url.pathname==="/api/tree")data={nodes:[],revision:"test"};
  else if(url.pathname==="/api/components")data={components:[]};
  else if(url.pathname==="/api/photos")data={photos:[]};
  else if(url.pathname==="/api/workspace")data={workspace:{recipe:[],resources:[]},revision:"test"};
  await route.fulfill({status:url.pathname==="/api/workshop-reference"&&method==="POST"?201:200,
   contentType:"application/json",body:JSON.stringify(data)});
 });
 await page.goto("/#commonparts");
 const workshop=page.locator("#commonparts");
 const create=workshop.locator(".workshop-catalog-create");
 await expect(create).toBeVisible();
 await create.click();
 const editor=workshop.locator(".workshop-item-edit-form");
 await expect(editor).toBeVisible();
 await editor.getByLabel("Item name").fill("Adjustable 24 V supply");
 await editor.getByLabel("Product type (e.g. Multimeters)").fill("Bench DC Power Supplies");
 await editor.getByLabel("Specifications").fill("24 V DC output");
 await editor.getByLabel("Website category").selectOption("electronics");
 await editor.getByLabel("Product family").selectOption("power-supplies");
 await editor.getByRole("button",{name:"Create catalog item"}).click();
 await expect(workshop.locator(".workshop-item-page-heading h2")).toContainText("Adjustable 24 V supply");
 await expect(workshop.locator(".workshop-spec-table")).toContainText("24 V DC output");
 expect(posted.details.familyId).toBe("power-supplies");
 expect(posted.details.category).toBe("electronics");
 expect(posted.details.typeName).toBe("Bench DC Power Supplies");
});

test("New Part ends Workshop edits after identity and confirms public/private saves before creating a project part",async({page})=>{
 const workshopPosts=[];
 await page.route("**/api/**",async route=>{
  const u=new URL(route.request().url());
  let data={};
  if(u.pathname==="/api/workshop-reference"&&route.request().method()==="POST"){
   const posted=route.request().postDataJSON();workshopPosts.push({scope:"public",body:posted});
   data={id:"workshop:custom-11111111-1111-4111-8111-111111111111",details:posted.details};
  }else if(u.pathname==="/api/personal-workshop"&&route.request().method()==="POST"){
   const posted=route.request().postDataJSON();workshopPosts.push({scope:"private",body:posted});
   data={items:[{id:"22222222-2222-4222-8222-222222222222",...posted}]};
  }else if(u.pathname==="/api/commonparts"||u.pathname==="/api/purchased-parts")data={parts:[]};
  else if(u.pathname==="/api/projects")data={projects:[]};
  else if(u.pathname==="/api/accounts")data={user:null};
  else if(u.pathname==="/api/auth")data={authenticated:false,isAdmin:false};
  else if(u.pathname==="/api/tree")data={nodes:[],revision:"test"};
  else if(u.pathname==="/api/components")data={components:[]};
  else if(u.pathname==="/api/photos")data={photos:[]};
  else if(u.pathname==="/api/workspace")data={workspace:{recipe:[],resources:[]},revision:"test"};
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(data)});
 });
 await page.goto("/");
 const open=()=>page.evaluate(()=>{
  window.__createdTestPart=null;
  window.BSLibraryPartPicker.open({onCreate:async payload=>{window.__createdTestPart=payload}});
 });
 await open();
 let modal=page.locator(".library-part-dialog");
 await expect(modal).toBeVisible();
 const type=modal.locator(".library-field",{hasText:"Item type"}).first();
 await expect(type).toBeVisible();
 const from=modal.locator('input[name="new-part-source"][value="from"]');
 const create=modal.locator('input[name="new-part-source"][value="new"]');
 const add=modal.locator(".library-workshop-add input");
 await expect(create).toBeChecked();
 await expect(modal.locator(".library-workshop-choice-copy strong")).toContainText(["Use from","Create new"]);
 await from.check();
 await expect(modal.locator(".library-workshop-add")).toBeHidden();
 await create.check();
 await expect(add).toBeVisible();
 await add.check();
 await expect(modal.locator(".library-workshop-scope")).toBeVisible();
 const privateRadio=modal.locator('input[name="workshop-destination"][value="private"]');
 const publicRadio=modal.locator('input[name="workshop-destination"][value="public"]');
 await expect(privateRadio).toBeChecked();
 await publicRadio.check();
 await modal.getByLabel("Public Workshop category").selectOption("electronics");
 await expect(modal.locator(".library-field",{hasText:"Part type"}).first()).toBeHidden();
 await modal.locator(".library-field",{hasText:"Manufacturer part number (MPN)"}).locator("input").fill("PSU-24V");
 await modal.locator(".library-field",{hasText:"Part name"}).locator("input").fill("Purchased DC supply");
 await expect(modal.locator(".library-project-only")).toBeHidden();
 await expect(modal.locator(".library-number-choice")).toBeHidden();
 await expect(modal.locator(".library-field",{hasText:"Quantity (optional)"})).toBeHidden();
 await expect(modal.locator(".library-vendor-info")).toBeHidden();
 await expect(modal.locator(".library-workshop-finish-note")).toBeVisible();
 await expect(modal.locator(".library-workshop-finish-note")).toContainText("part page after saving");
 await modal.locator(".library-dialog-actions").getByRole("button",{name:"Create part"}).click();
 await expect(modal).toHaveCount(0);
 let payload=await page.evaluate(()=>window.__createdTestPart);
 expect(payload.name).toBe("Purchased DC supply");
 expect(payload.partType).toBe("purchased");
 expect(payload.itemType).toBe("part");
 expect(payload.addToWorkshop).toBeUndefined();
 expect(payload.workshopSavedMessage).toContain("public Workshop");
 expect(payload.projectDetails.workshopReferenceId).toBe("workshop:custom-11111111-1111-4111-8111-111111111111");
 expect(payload.projectDetails.notes).toBe("");
 expect(workshopPosts).toHaveLength(1);
 expect(workshopPosts[0].scope).toBe("public");
 expect(workshopPosts[0].body.details.partNumber).toBe("PSU-24V");
 await open();
 modal=page.locator(".library-part-dialog");
 await modal.locator(".library-workshop-add input").check();
 await modal.locator(".library-field",{hasText:"Part name"}).locator("input").fill("1/4 W resistor");
 await modal.locator(".library-dialog-actions").getByRole("button",{name:"Create part"}).click();
 await expect(modal).toHaveCount(0);
 payload=await page.evaluate(()=>window.__createdTestPart);
 expect(payload.name).toBe("1/4 W resistor");
 expect(payload.addToWorkshop).toBeUndefined();
 expect(payload.workshopSavedMessage).toContain("My Workshop");
 expect(payload.projectDetails.workshopReferenceId).toBe("my:22222222-2222-4222-8222-222222222222");
 expect(workshopPosts).toHaveLength(2);
 expect(workshopPosts[1].scope).toBe("private");
 expect(workshopPosts[1].body.partNumber).toBe("");
 expect(workshopPosts[1].body.name).toBe("1/4 W resistor");
 await open();
 modal=page.locator(".library-part-dialog");
 await modal.locator(".library-field",{hasText:"Item type"}).first().locator("select").selectOption("document");
 await expect(modal.locator(".library-workshop-choice-group")).toBeHidden();
 await modal.locator(".library-field",{hasText:"Part name"}).locator("input").fill("Design notes");
 await modal.locator(".library-dialog-actions").getByRole("button",{name:"Create part"}).click();
 payload=await page.evaluate(()=>window.__createdTestPart);
 expect(payload.itemType).toBe("document");
 expect(payload.addToWorkshop).toBeUndefined();
});
test("Failed Workshop publication remains in New Part dialog and does not create a BOM part",async({page})=>{
 let createCalls=0,postCalls=0;
 await page.route("**/api/**",async route=>{
  const url=new URL(route.request().url());
  if(url.pathname==="/api/workshop-reference"&&route.request().method()==="POST"){
   postCalls++;
   return route.fulfill({status:401,contentType:"application/json",
    body:JSON.stringify({error:"Sign in to contribute to the public Workshop"})});
  }
  const body=url.pathname==="/api/commonparts"||url.pathname==="/api/purchased-parts"?{parts:[]}:
   url.pathname==="/api/workshop-reference"?{items:{}}:
   url.pathname==="/api/personal-workshop"?{items:[]}:
   url.pathname==="/api/projects"?{projects:[]}:{};
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(body)});
 });
 await page.goto("/");
 await page.exposeFunction("recordBomCreate",()=>{createCalls++});
 await page.evaluate(()=>{
  void window.BSLibraryPartPicker.open({onCreate:async()=>window.recordBomCreate()});
 });
 const modal=page.locator(".library-part-dialog");
 await modal.locator(".library-workshop-add input").check();
 await modal.locator('input[name="workshop-destination"][value="public"]').check();
 await modal.locator(".library-field",{hasText:"Manufacturer part number (MPN)"}).locator("input").fill("2N7000");
 await modal.locator(".library-field",{hasText:"Part name"}).locator("input").fill("2N7000 MOSFET");
 await modal.locator(".library-dialog-actions").getByRole("button",{name:"Create part"}).click();
 await expect(modal).toBeVisible();
 await expect(modal.locator(".library-dialog-status")).toContainText("Sign in to contribute to the public Workshop");
 expect(createCalls).toBe(0);
 expect(postCalls).toBe(1);
 await modal.locator(".library-dialog-actions").getByRole("button",{name:"Cancel"}).click();
});

test("Searching Workshop for missing 2N7000 opens a purchased part with separate manufacturer number",async({page})=>{
 await page.route("**/api/**",async route=>{
  const url=new URL(route.request().url());let data={};
  if(["/api/commonparts","/api/purchased-parts"].includes(url.pathname))data={parts:[]};
  else if(url.pathname==="/api/workshop-reference")data={items:{},canEdit:true};
  else if(url.pathname==="/api/personal-workshop")data=route.request().method()==="POST"?
   {items:[{id:"33333333-3333-4333-8333-333333333333"}]}:{items:[]};
  else if(url.pathname==="/api/accounts")data={user:null};
  else if(url.pathname==="/api/projects")data={projects:[]};
  else if(url.pathname==="/api/auth")data={authenticated:false,isAdmin:false};
  else if(url.pathname==="/api/tree")data={nodes:[],revision:"test"};
  else if(url.pathname==="/api/components")data={components:[]};
  else if(url.pathname==="/api/workspace")data={workspace:{recipe:[],resources:[]},revision:"test"};
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(data)});
 });
 await page.goto("/");
 await page.evaluate(()=>{
  window.__partPayload=null;
  window.BSLibraryPartPicker.open({onCreate:async value=>{window.__partPayload=value}});
 });
 const dialog=page.locator(".library-part-dialog");
 await dialog.locator('input[name="new-part-source"][value="from"]').check();
 await dialog.getByLabel("Search all Workshop items").fill("2N7000");
 await expect(dialog.locator(".library-workshop-quick-results")).toContainText("No matching Workshop items");
 await dialog.getByRole("button",{name:"Not listed? Create a purchased part"}).click();
 await expect(dialog.locator('input[name="new-part-source"][value="new"]')).toBeChecked();
 await expect(dialog.locator(".library-field",{hasText:"Part name"}).locator("input")).toHaveValue("2N7000");
 await expect(dialog.locator(".library-field",{hasText:"Manufacturer part number (MPN)"}).locator("input")).toHaveValue("2N7000");
 await expect(dialog.locator('input[name="new-part-number-mode"][value="none"]')).toBeChecked();
 await expect(dialog.locator(".library-vendor-links")).toContainText("DigiKey search");
 await dialog.getByRole("textbox",{name:"Manufacturer",exact:true}).fill("onsemi");
 await dialog.locator(".library-dialog-actions").getByRole("button",{name:"Create part"}).click();
 await expect(dialog).toHaveCount(0);
 const saved=await page.evaluate(()=>window.__partPayload);
 expect(saved.name).toBe("2N7000");
 expect(saved.model).toBe("2N7000");
 expect(saved.manufacturer).toBe("onsemi");
 expect(saved.partNumber).toBeNull();
 expect(saved.assignNumber).toBe(false);
 expect(saved.addToWorkshop).toBeUndefined();
 expect(saved.projectDetails.workshopReferenceId).toBe("my:33333333-3333-4333-8333-333333333333");
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
  else if(url.pathname==="/api/projects")data={projects:[]};
  else if(url.pathname==="/api/auth")data={authenticated:false,isAdmin:false};
  else if(url.pathname==="/api/accounts")data={user:null};
  else if(url.pathname==="/api/commonparts"||url.pathname==="/api/purchased-parts")data={parts:[]};
  else if(url.pathname==="/api/wires")data={wires:[]};
  else if(url.pathname==="/api/part-files")data={files:[]};
  else if(url.pathname==="/api/drawings")data={drawings:[]};
  await route.fulfill({status:method==="POST"&&url.pathname==="/api/photos"?201:200,
   contentType:"application/json",body:JSON.stringify(data)});
 });
 await page.goto("/#launcher");
 const sidebar=page.locator("#launcher .assembly-sidebar");
 await expect(sidebar.locator(".assembly-summary-sidebar-card")).toBeVisible();
 const order=await sidebar.evaluate(root=>[...root.children].map(e=>e.className));
 const tree=order.findIndex(c=>c.includes("feature-tree-frame"));
 const summary=order.findIndex(c=>c.includes("assembly-summary-sidebar-card"));
 const parts=order.findIndex(c=>c.includes("assembly-parts-management-link"));
 expect(tree).toBeGreaterThanOrEqual(0);expect(summary).toBe(tree+1);expect(parts).toBe(summary+1);
 const panel=page.locator("#launcher .project-summary-page .bs-unstructured-notes");
 await expect(panel).toBeVisible();
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
 await expect(page.locator("#launcher .assembly-workspace-page:not(.bom-part-workspace) .bs-unstructured-notes")).toBeVisible();
 expect(seen).toContain("summary:root");expect(seen.some(x=>x.startsWith("workspace:"))).toBe(true);
});

test("linked Workshop items open, search current fields and return to the originating part",async ({page})=>{
 const publicId="workshop:custom-motor-switch";
 const personalId="11111111-1111-4111-8111-111111111111";
 const publicPart="22222222-2222-4222-8222-222222222222";
 const privatePart="33333333-3333-4333-8333-333333333333";
 const item={name:"Public motor switch",partNumber:"ABC-10",featureTreeDescription:"Motor switch",
  category:"electronics",kind:"component",familyId:"test-switches",created:true};
 const searches=[],errors=[];
 page.on("pageerror",error=>errors.push(error.message));
 await page.route("**/api/**",async route=>{
  const path=new URL(route.request().url()).pathname;
  let data={};
  if(path==="/api/accounts")data={user:{id:"test-user",displayName:"Test user"}};
  if(path==="/api/tree")data={nodes:[],revision:"test"};
  if(path==="/api/components")data={components:[
   {id:publicPart,name:"Project switch",specifications:[],projectDetails:{workshopReferenceId:publicId}},
   {id:privatePart,name:"Project spare switch",specifications:[{name:"My Workshop reference",value:personalId}]}
  ]};
  if(path==="/api/workspace")data={workspace:{recipe:[],resources:[]}};
  if(path==="/api/workshop-reference"){
   await new Promise(resolve=>setTimeout(resolve,150));
   data={items:{[publicId]:item},canEdit:true,canCreate:true};
  }
  if(path==="/api/personal-workshop")data={items:[{...item,id:personalId,name:"Personal spare switch",quantity:1}]};
  if(path==="/api/workshop-lookup"){
   searches.push(route.request().postDataJSON());
   data={draft:{name:"Suggested switch"},needsReview:true,
    lookupUsage:{estimatedUsd:0.051,searches:2},missingSpecs:searches.at(-1).searchHint?["Coating"]:[]};
  }
  await route.fulfill({json:data});
 });
 const details=page.locator("#launcher .part-details-collapse");
 const itemPage=page.locator(".workshop-item-page");
 async function openFromProject(id,name){
  await page.goto("/#launcher/part/"+id);
  await expect(page.locator("#launcher .part-workspace-title")).toHaveText(name);
  await details.locator("summary").click();
  await details.getByRole("button",{name:"View in Workshop"}).click();
 }
 await openFromProject(publicPart,"Project switch");
 await expect(itemPage.getByRole("heading",{name:item.name,exact:true})).toBeVisible();
 await page.evaluate(()=>history.back());
 await expect(page).toHaveURL(new RegExp("#launcher/part/"+publicPart+"$"));
 await page.evaluate(()=>history.forward());
 await expect(itemPage.getByRole("heading",{name:item.name,exact:true})).toBeVisible();
 await page.reload();
 await expect(itemPage.getByRole("heading",{name:item.name,exact:true})).toBeVisible();
 await itemPage.getByRole("button",{name:"Edit",exact:true}).click();
 await itemPage.getByRole("button",{name:"Find with AI"}).click();
 await expect.poll(()=>searches.at(-1)).toEqual({partNumber:"ABC-10",featureTreeDescription:"Motor switch"});
 await itemPage.getByLabel("Manufacturer part number",{exact:true}).fill("");
 await itemPage.getByRole("button",{name:"Find with AI"}).click();
 await expect.poll(()=>searches.at(-1)).toEqual({partNumber:"",featureTreeDescription:"Motor switch"});
 await itemPage.getByRole("button",{name:"Back to project part"}).click();
 await expect(page).toHaveURL(new RegExp("#launcher/part/"+publicPart+"$"));
 await expect(page.locator("#launcher .part-workspace-title")).toHaveText("Project switch");

 await openFromProject(privatePart,"Project spare switch");
 await expect(itemPage.getByRole("heading",{name:"Personal spare switch"})).toBeVisible();
 await itemPage.getByRole("button",{name:"Edit",exact:true}).click();
 await page.locator("#workshop-editor").getByRole("button",{name:"Fill details with AI"}).click();
 await expect.poll(()=>searches.length).toBe(3);
 await expect.poll(()=>searches.at(-1)).toEqual({partNumber:"ABC-10",featureTreeDescription:"Motor switch"});
 await page.getByRole("button",{name:"Back to project part"}).click();
 await expect(page).toHaveURL(new RegExp("#launcher/part/"+privatePart+"$"));
 await expect(page.locator("#launcher .part-workspace-title")).toHaveText("Project spare switch");
 await page.locator('nav [data-nav="commonparts"]').click();
 await page.getByRole("button",{name:"+ Add catalog item"}).click();
 await itemPage.getByLabel("Manufacturer part number",{exact:true}).fill("NEW-42");
 const placement=await itemPage.locator('[data-part-editor-section="identity"]').evaluate(section=>{
  const [,description,,manufacturer]=section.querySelectorAll("input");
  const button=section.querySelector(".workshop-ai-lookup-row button");
  return [description,button,manufacturer].map(element=>element.getBoundingClientRect().toJSON());
 });
 const [description,button,manufacturer]=placement;
 expect(button.top).toBeGreaterThanOrEqual(description.bottom);
 expect(button.left).toBeCloseTo(description.left,1);
 expect(manufacturer.top).toBeGreaterThan(button.bottom);
 await itemPage.getByRole("button",{name:"Find with AI"}).click();
 await expect.poll(()=>searches.at(-1)).toEqual({partNumber:"NEW-42",featureTreeDescription:""});
 await itemPage.getByLabel("Help AI find the item (optional)",{exact:true}).fill("DigiKey https://www.digikey.com/example");
 await itemPage.getByLabel("Help AI find the item (optional)",{exact:true}).press("Enter");
 await expect.poll(()=>searches.at(-1)).toEqual({
  partNumber:"NEW-42",featureTreeDescription:"",searchHint:"DigiKey https://www.digikey.com/example"
 });
 await expect(itemPage.getByText("Estimated API cost $0.051 · 2 web searches",{exact:true})).toBeVisible();
 const review=itemPage.locator(".workshop-ai-changes-panel");
 await expect(review.getByText("Could not verify: Coating.",{exact:true})).toBeVisible();
 await expect(review.getByRole("button",{name:"Apply suggested changes and save"})).toBeVisible();
 await expect(itemPage.getByLabel("Item name",{exact:true})).toHaveValue("");
 await review.getByRole("button",{name:"Cancel"}).click();
 await expect(review).toBeHidden();
 await itemPage.getByRole("button",{name:"View suggested changes"}).click();
 await expect(review).toBeVisible();
 const endMillType=itemPage.getByLabel("Product type (e.g. Multimeters)",{exact:true});
 await endMillType.fill("End mills");
 await endMillType.blur();
 await expect.poll(()=>itemPage.locator('.workshop-structured-spec-rows [data-spec="label"]').evaluateAll(fields=>fields.map(field=>field.value))).toEqual([
  "Cutting diameter","Shank diameter","Length of cut","Overall length","Flute count","Tool material","Coating","End geometry"
 ]);
 const specs=itemPage.locator(".workshop-structured-specs");
 const values=specs.locator('[data-spec="value"]');
 await specs.getByRole("button",{name:"Suggest fields for this category"}).click();
 await expect(values.first()).toBeFocused();
 await expect(values).toHaveCount(8);
 await expect(specs.getByRole("status")).toHaveText("Suggested fields are ready for values.");
 await specs.getByRole("button",{name:"+ Add specification"}).click();
 const newProperty=specs.locator('[data-spec="label"]').last();
 await expect(values).toHaveCount(9);
 await expect(newProperty).toBeFocused();
 await newProperty.fill("Helix angle");
 await expect(specs.getByRole("status")).toHaveText("Added a blank specification.");
 expect(errors).toEqual([]);
});

test("Reload Workshop data sits after Modify part and refreshes the linked project copy",async({page})=>{
 const id="22222222-2222-4222-8222-222222222222";
 let part={id,name:"Project edit",specifications:[],projectDetails:{workshopReferenceId:"workshop:custom-switch"}};
 const updates=[];
 await page.route("**/api/**",async route=>{
  const url=new URL(route.request().url());
  let data={};
  if(url.pathname==="/api/accounts")data={user:{id:"test-admin",displayName:"Test admin",role:"admin"}};
  if(url.pathname==="/api/tree")data={nodes:[],revision:"test"};
  if(url.pathname==="/api/components"){
   if(route.request().method()==="PATCH"){
    updates.push({id:url.searchParams.get("id"),body:route.request().postDataJSON()});
    part={...part,name:"Workshop switch"};
    data={component:part};
   }else data={components:[part]};
  }
  if(url.pathname==="/api/workspace")data={workspace:{recipe:[],resources:[]}};
  await route.fulfill({json:data});
 });
 await page.goto("/#launcher/part/"+id);
 await expect(page.locator("#launcher .part-workspace-title")).toHaveText("Project edit");
 const details=page.locator("#launcher .part-details-collapse");
 const summary=details.locator("summary.part-details-view-heading");
 await summary.click();
 const actions=summary.getByRole("button");
 await expect(actions).toHaveText(["View in Workshop","Modify part","Reload Workshop data"]);
 await actions.last().click();
 const confirmation=page.getByRole("dialog",{name:"Reload Workshop data?"});
 await confirmation.getByRole("button",{name:"Cancel"}).click();
 expect(updates).toHaveLength(0);
 await actions.last().click();
 await confirmation.getByRole("button",{name:"Reload Workshop data"}).click();
 await expect(page.locator("#launcher .part-workspace-title")).toHaveText("Workshop switch");
 await expect(details.getByRole("status")).toHaveText("Workshop data reloaded.");
 expect(updates).toEqual([{id,body:{reloadWorkshop:true}}]);
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
  await route.fulfill({json:data});
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
 await expect(pasteField(part)).toBeVisible();
 await pasteImage(pasteField(part));
 await expect.poll(()=>uploads.at(1)).toEqual({scope:code,mime:"image/png"});
 await expect(cover).toHaveAttribute("src",/\/api\/photo-annotations/);
 await expect(part.getByRole("button",{name:"Delete",exact:true})).toBeEnabled();

 await page.goto("/#launcher/part/"+doc);
 await expect(cover).toHaveAttribute("src","/assets/default-document-photo.webp");
 await expect.poll(()=>cover.evaluate(image=>image.naturalWidth)).toBeGreaterThan(0);
});
