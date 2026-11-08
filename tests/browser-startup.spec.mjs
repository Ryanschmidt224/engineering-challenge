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
 await page.locator("#launcher .assembly-workspace-page:not(.bom-part-workspace) .bom-view-button", {hasText:"List view"}).click();
 const cards=page.locator("#launcher .assembly-workspace-page:not(.bom-part-workspace) .bom-compact-list tbody tr");
 await expect(cards).toHaveCount(2);
 await expect(cards.first()).toContainText("C2822 Brushless Motor");
 await expect(cards.nth(1)).toContainText("20A ESC");
 const appearance=await cards.evaluateAll(rows=>rows.map(row=>{
  const first=row.querySelector("td"),box=row.getBoundingClientRect();
  const css=getComputedStyle(first);
  return {top:box.top,bottom:box.bottom,color:css.backgroundColor,border:css.borderLeftWidth};
 }));
 expect(appearance[1].top-appearance[0].bottom).toBeGreaterThanOrEqual(4);
 expect(appearance[0].color).not.toBe("rgba(0, 0, 0, 0)");
 expect(appearance[0].color).not.toBe(appearance[1].color);
 expect(errors,"Unexpected JavaScript errors during startup/navigation").toEqual([]);
});
