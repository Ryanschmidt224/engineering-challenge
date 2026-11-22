// Retain before/after evidence while checking the approved standard geometry.
import {test,expect} from "@playwright/test";
import {execFileSync} from "node:child_process";
import {writeFile} from "node:fs/promises";

const baseline="1ed47284dcea58bdadb4f86b4065e3746fa2995d";
const partId="11111111-1111-4111-8111-111111111111";
const projects=[
 {id:"launcher",name:"Foam-dart launcher",isOwner:true,builtIn:true},
 {id:"linear",name:"Electromagnetic linear actuator",isOwner:true,builtIn:true},
 {id:"robot",name:"Robotic arm",isOwner:true,builtIn:true},
 {id:"p00000000000000000000000000000001",name:"Personal CSS fixture",isOwner:true,builtIn:false,ownerId:"css-owner"}
];
const baselineStyles=new Map();
async function fixtures(page,originalCSS){
 const intercepted=new Set();
 if(originalCSS)await page.route(/\/assets\/[a-z-]+\.css(?:\?.*)?$/,async route=>{
  const path=new URL(route.request().url()).pathname.slice(1);
  if(!/^assets\/[a-z-]+\.css$/.test(path))throw Error("Unexpected stylesheet path");
  if(!baselineStyles.has(path))baselineStyles.set(path,execFileSync("git",["show",baseline+":"+path],{encoding:"utf8"}));
  intercepted.add(path);await route.fulfill({contentType:"text/css",body:baselineStyles.get(path)});
 });
 await page.route("**/api/**",async route=>{
  const url=new URL(route.request().url());let data={};
  switch(url.pathname){
   case "/api/accounts":data={user:{id:"css-owner",role:"admin",displayName:"CSS fixture"}};break;
   case "/api/auth":data={authenticated:true};break;
   case "/api/projects":data={projects};break;
   case "/api/tree":data=url.searchParams.has("metadata")?{metadata:{title:"CSS fixture"},revision:"tree"}:url.searchParams.has("assembly")?{page:{description:"A fixed description for the visual baseline."},revision:"tree"}:{nodes:[{id:"control",kind:"assembly",parentId:null,name:"Control assembly",quantity:2}],revision:"tree"};break;
   case "/api/components":data={components:[{id:partId,name:"Sensor bracket",partType:"custom",assemblyId:"control",quantity:2,quantityUnit:"pcs",revision:"part",description:"Retains instructions, measurements and project history.",specifications:[{name:"Material",value:"Aluminum"}]}]};break;
   case "/api/workspace":data={workspace:{recipe:[{id:"measure",title:"Measure voltage before connecting the sensor",tileOrder:[]}],resources:{tools:[],parts:[],calculators:[]},experiments:[],history:[]}};break;
   case "/api/investigations":data={records:[],revision:null};break;
   case "/api/unstructured-notes":data={notes:[],revision:null,canEdit:true};break;
   case "/api/photos":data={photos:[]};break;
   case "/api/photo-annotations":return route.fulfill({status:404});
   case "/api/drawings":data={drawings:[],truncated:false};break;
   case "/api/part-files":data={files:[]};break;
   case "/api/part-pages":data={pages:[]};break;
   case "/api/assembly-archive":data={items:[]};break;
   case "/api/harness":data={cuts:[]};break;
   case "/api/wires":data={wires:[]};break;
   case "/api/project-tasks":data={tasks:[]};break;
   case "/api/project-milestones":data={milestones:[]};break;
  }
  await route.fulfill({json:data});
 });
 return intercepted;
}
async function openWorkspace(page,project,kind){
 await page.goto("/#"+project+"/"+(kind==="part"?"part/"+partId:"workspace/__root__"));
 const workspace=page.locator("#"+project+" .assembly-workspace-page"+(kind==="part"?".bom-part-workspace":":not(.bom-part-workspace)"));
 await expect(workspace).toBeVisible();await expect(workspace.locator(".recipe-disclosure-toggle")).toContainText("1 record");
 await expect(workspace.locator(".bs-unstructured-notes-heading")).toContainText("0 records");
 await page.waitForLoadState("networkidle");return workspace;
}
async function expand(workspace){
 await workspace.locator(".recipe-disclosure-toggle").press("Enter");
 for(const selector of [".part-details-collapse>summary",".workspace-resource-disclosure>summary",".workspace-archive-history>summary",".bs-unstructured-notes-heading"]){
  const summary=workspace.locator(selector);if(await summary.count())await summary.press("Enter");
 }
}
for(const width of [1440,390])for(const project of projects)for(const kind of ["part","assembly"]){
 test("CSS baseline: "+project.id+" "+kind+" at "+width+"px",async({browser},testInfo)=>{
  const contexts=[],pages=[],errors=[],intercepts=[];
  try{
   for(const original of [true,false]){
    const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:"reduce"});contexts.push(context);
    const page=await context.newPage();page.setDefaultTimeout(5000);page.on("pageerror",error=>errors.push(error.message));intercepts.push(await fixtures(page,original));pages.push(page);
   }
   const workspaces=[];for(const page of pages)workspaces.push(await openWorkspace(page,project.id,kind));
   expect(intercepts[0].size).toBe(await pages[0].locator('link[rel="stylesheet"][href^="/assets/"]').count());
   expect(intercepts[0].size).toBeGreaterThan(0);
   for(const state of (kind==="part"?["collapsed","expanded","editor"]:["collapsed","expanded"])){
    if(state==="expanded")for(const workspace of workspaces)await expand(workspace);
    if(state==="editor")for(let index=0;index<pages.length;index++){await workspaces[index].getByRole("button",{name:"Edit part details",exact:true}).click();await expect(pages[index].getByRole("dialog",{name:"Part editor",exact:true})).toBeVisible();}
    for(let index=0;index<pages.length;index++){
     await pages[index].evaluate(()=>window.scrollTo(0,0));
     const image=await pages[index].screenshot({fullPage:true,animations:"disabled",caret:"hide"});
     await writeFile(testInfo.outputPath((index?"candidate-":"baseline-")+state+".png"),image);
    }
    // The owner approves standard sizes over exact preservation of legacy pixels.
    const metrics=await workspaces[1].locator(".recipe-disclosure-toggle,.workspace-resource-disclosure>summary,.workspace-archive-history>summary,.bs-unstructured-notes-heading,.part-details-collapse>summary").evaluateAll(elements=>elements.filter(element=>element.getClientRects().length).map(element=>{
     const heading=element.querySelector("h2,h4"),count=element.querySelector(".workspace-record-count"),box=element.getBoundingClientRect();
     // Hidden, absolutely positioned tooltips may enlarge scrollHeight without
     // clipping the actual title. Check the visible text boxes themselves.
     const clipped=[heading,count].filter(Boolean).some(text=>{const r=text.getBoundingClientRect();return text.scrollHeight>text.clientHeight+1||text.scrollWidth>text.clientWidth+1||r.top<box.top-1||r.bottom>box.bottom+1||r.left<box.left-1||r.right>box.right+1;});
     return {title:heading?.textContent||"",font:heading?getComputedStyle(heading).fontSize:null,count:count?getComputedStyle(count).fontSize:null,height:box.height,clipped};
    }));
    if(state!=="editor"){
     expect(metrics.length).toBeGreaterThanOrEqual(4);
     const help=workspaces[1].getByRole("button",{name:"About Helpful tools",exact:true});
     await help.focus();
     const tip=workspaces[1].getByRole("tooltip").filter({hasText:"Link calculators, tools, and Workshop references"});
     await expect(tip).toBeVisible();
     const bounds=await tip.boundingBox();
     expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(width);
     // A text-only help surface must not swallow the next section's click.
     const archive=workspaces[1].locator(".workspace-archive-history");
     const wasOpen=await archive.getAttribute("open");
     await archive.locator("summary").click();
     expect(await archive.getAttribute("open")).not.toBe(wasOpen);
     await archive.locator("summary").click();
     await help.focus();await help.press("Escape");await expect(tip).toBeHidden();
    }
    const issues=[];
    for(const metric of metrics){if(metric.font!=="16px")issues.push(metric.title+": title "+metric.font);if(metric.count&&metric.count!=="14px")issues.push(metric.title+": count "+metric.count);if(metric.height<48)issues.push(metric.title+": header "+metric.height);if(metric.clipped)issues.push(metric.title+": visible text is clipped");}
    const overflow=await pages[1].evaluate(()=>({width:document.documentElement.scrollWidth,viewport:window.innerWidth,elements:[...document.querySelectorAll("body *")].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.right>window.innerWidth+1;}).slice(0,30).map(el=>({tag:el.tagName,id:el.id,cls:el.className,right:el.getBoundingClientRect().right,width:el.getBoundingClientRect().width,visibility:getComputedStyle(el).visibility,position:getComputedStyle(el).position}))}));
    if(overflow.width>width+1)issues.push("Page overflows horizontally: "+JSON.stringify(overflow));
    if(state==="editor"){const bounds=await pages[1].getByRole("dialog",{name:"Part editor",exact:true}).boundingBox();if(bounds.x<0||bounds.x+bounds.width>width+1)issues.push("Part editor overflows horizontally");}
    expect(issues).toEqual([]);
   }
   expect(errors).toEqual([]);
  }finally{await Promise.all(contexts.map(context=>context.close().catch(()=>{})));}
 });
}
