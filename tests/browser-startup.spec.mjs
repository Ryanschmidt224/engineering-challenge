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
 await page.locator('.project-link[data-nav="launcher"]').click();
 const workspace=page.locator("#launcher .assembly-workspace-page:not(.bom-part-workspace)");
 const screen=page.locator("#launcher .assembly-bom-screen");
 const tree=page.locator("#launcher .assembly-tree-nodes");
 await expect(workspace).toBeVisible();
 await expect(workspace.locator(".workspace-back")).toHaveText("Open BOM");
 const header=workspace.locator(":scope > .workspace-heading");
 const buttonBounds=await header.locator(".workspace-back").boundingBox();
 const titleBounds=await header.locator(".workspace-title").boundingBox();
 expect(buttonBounds.x).toBeGreaterThan(titleBounds.x+titleBounds.width);
 await expect(header.locator(".workspace-back")).toBeVisible();
 await workspace.locator(".workspace-back").click();
 await expect(page).toHaveURL(/#launcher\/bom\/__root__/);
 await expect(screen).toBeVisible();
 await expect(screen.locator(".assembly-bom-list")).toHaveAttribute("aria-pressed","true");
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


test("admin tree right-click menu replaces rename/delete toolbar and main page has rounded frame",async({page})=>{
 const errors=[];
 page.on("pageerror",error=>errors.push(error.message));
 await page.route("**/api/**",async route=>{
  const url=new URL(route.request().url());
  let data={};
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
 expect(Math.abs((overviewContent.x-(overviewSidebar.x+overviewSidebar.width))-22)).toBeLessThanOrEqual(2);
 await row.click({button:"right"});
 const menu=page.locator(".assembly-context-menu:visible").last();
 await expect(menu).toBeVisible();
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
 // Assembly and part photo dialogs reuse the same small pencil launcher.
 const assemblyPencil=workspace.locator(".workspace-photo-launch");
 await expect(assemblyPencil).toBeVisible();
 await assemblyPencil.click();
 const assemblyPhotoDialog=workspace.locator(".workspace-photo-dialog");
 await expect(assemblyPhotoDialog).toBeVisible();
 await expect(assemblyPhotoDialog.locator(".assembly-photo-pick")).toBeVisible();
 await assemblyPhotoDialog.getByRole("button",{name:"Done"}).click();
 await expect(assemblyPhotoDialog).toBeHidden();
 await workspace.locator(".workspace-back").click();
 const bomScreen=page.locator("#launcher .assembly-bom-screen");
 const rowPart=bomScreen.locator(".workspace-saved-parts .bom-part",{hasText:"Linked Motor"}).first();
 await expect(rowPart.locator("input,select,textarea")).toHaveCount(0);
 await rowPart.locator(".bom-part-edit").click();
 await expect(page).toHaveURL(/#launcher\/part\//);
 const partPage=page.locator("#launcher .bom-part-workspace");
 await expect(partPage).toBeVisible();
 // Part instructions use the same white cards as assembly instructions.
 const partInstructionCard=partPage.locator(".workspace-panels > article.recipe-instructions");
 await expect(partInstructionCard).toBeVisible();
 const partCardSurface=await partInstructionCard.evaluate(el=>{
  const style=getComputedStyle(el);
  return {background:style.backgroundColor,border:style.borderTopStyle};
 });
 expect(partCardSurface.background).toBe("rgb(255, 255, 255)");
 expect(partCardSurface.border).toBe("solid");
 const partPencil=partPage.locator(".workspace-photo-launch");
 await expect(partPencil).toBeVisible();
 await partPencil.click();
 const partPhotoDialog=partPage.locator(".part-photo-dialog");
 await expect(partPhotoDialog).toBeVisible();
 await expect(partPhotoDialog.locator(".part-photo-add")).toBeVisible();
 await partPhotoDialog.getByRole("button",{name:"Done"}).click();
 await expect(partPhotoDialog).toBeHidden();
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
 await expect(editor.locator(".component-full-name")).toHaveValue("Long descriptive motor part name");
 // The short headline is the BOM and tree label, while the full name stays editable.
 await expect(bomScreen.locator(".workspace-saved-parts")).toContainText("Linked Motor");
 await expect(bomScreen.locator(".workspace-saved-parts")).not.toContainText("Long descriptive motor part name");
 // First typing replaces the saved value; subsequent typing edits normally.
 await editor.locator(".component-full-name").click();
 await page.keyboard.type("Replacement full name");
 await expect(editor.locator(".component-full-name")).toHaveValue("Replacement full name");
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
 await expect(editor.locator(".component-category")).toBeVisible();
 await expect(editor.locator(".component-name")).toBeVisible();
 await kind.selectOption("purchased");
 await expect(editor.locator(".component-manufacturer")).toBeVisible();
 // The old component list must not be duplicated inside the editing form.
 await expect(editor.locator(".component-list")).toBeHidden();
 await expect(bomScreen.locator(".workspace-bom")).toBeHidden();
 await expect(workspace.locator(".workspace-saved-parts")).toContainText("Linked Motor");
 expect(await editor.locator(".workspace-bom-mount").evaluate(el=>el.closest(".workspace-main-bom-editor")!==null)).toBe(true);
 await expect(workspace.locator(".recipe-instructions")).toBeHidden();
 await editor.locator(".workspace-bom-editor-cancel").click();
 await expect(editor).toBeHidden();
 // Editing was launched from Part Details, so Cancel returns to that page.
 await expect(partPage).toBeVisible();
 await partPage.locator(".part-workspace-back").click();
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

test("tool and hidden-part filters operate independently",async({page})=>{
 const errors=[];page.on("pageerror",error=>errors.push(error.message));
 await page.route("**/api/**",async route=>{
  const url=new URL(route.request().url());
  let data={};
  if(url.pathname==="/api/tree")data=url.searchParams.has("assembly")?{page:{description:""},revision:"test"}:{nodes:[
   {id:"assembly-a",parentId:null,name:"Electronics assembly",kind:"assembly"}],revision:"test"};
  if(url.pathname==="/api/components")data={components:[
   {id:"11111111-1111-4111-8111-111111111111",name:"Solder Sucker",assemblyId:"assembly-a",category:"Tool",isTool:true,hideFromFeatureTree:false},
   {id:"22222222-2222-4222-8222-222222222222",name:"Mount Plate",assemblyId:"assembly-a",category:"Machined",isTool:false,hideFromFeatureTree:false},
   {id:"33333333-3333-4333-8333-333333333333",name:"M4 Screws",assemblyId:"assembly-a",category:"Fasteners",isTool:false,hideFromFeatureTree:true}
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
 await expect(controls.locator("label",{hasText:"Tools"})).toBeVisible();
 await expect(tree).toContainText("Mount Plate");
 await expect(tree).not.toContainText("Solder Sucker");
 await expect(tree).not.toContainText("M4 Screws");
 await controls.getByLabel("Tools").check();
 await expect(tree).toContainText("Solder Sucker");
 await expect(tree).not.toContainText("M4 Screws");
 await controls.getByLabel("Hidden parts").check();
 await expect(tree).toContainText("M4 Screws");
 await controls.getByLabel("Tools").uncheck();
 await expect(tree).not.toContainText("Solder Sucker");
 await expect(tree).toContainText("M4 Screws");
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
 await page.locator("#launcher .assembly-tree-nodes .assembly-name",{hasText:"Motor Control"}).click();
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
