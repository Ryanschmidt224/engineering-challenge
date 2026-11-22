// Compare the candidate stylesheet cascade with the deployed pre-cleanup CSS.
// Expected images come from a fixed Git commit, never the candidate's CSS.
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
 await workspace.locator(".recipe-disclosure-toggle").click();
 for(const selector of [".part-details-collapse>summary",".workspace-resource-disclosure>summary",".workspace-archive-history>summary",".bs-unstructured-notes-heading"]){
  const summary=workspace.locator(selector);if(await summary.count())await summary.click();
 }
}
for(const width of [1440,390])for(const project of projects)for(const kind of ["part","assembly"]){
 test("CSS baseline: "+project.id+" "+kind+" at "+width+"px",async({browser},testInfo)=>{
  const contexts=[],pages=[],errors=[],intercepts=[];
  try{
   for(const original of [true,false]){
    const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:"reduce"});contexts.push(context);
    const page=await context.newPage();page.on("pageerror",error=>errors.push(error.message));intercepts.push(await fixtures(page,original));pages.push(page);
   }
   const workspaces=[];for(const page of pages)workspaces.push(await openWorkspace(page,project.id,kind));
   expect(intercepts[0].size).toBe(await pages[0].locator('link[rel="stylesheet"][href^="/assets/"]').count());
   expect(intercepts[0].size).toBeGreaterThan(0);
   for(const state of (kind==="part"?["collapsed","expanded","editor"]:["collapsed","expanded"])){
    if(state==="expanded")for(const workspace of workspaces)await expand(workspace);
    if(state==="editor")for(let index=0;index<pages.length;index++){await workspaces[index].getByRole("button",{name:"Edit part details",exact:true}).click();await expect(pages[index].locator(".part-editor-dialog")).toBeVisible();}
    const images=[];
    for(let index=0;index<pages.length;index++){
     const image=await pages[index].screenshot({fullPage:true,animations:"disabled",caret:"hide"});images.push(image);
     await writeFile(testInfo.outputPath((index?"candidate-":"baseline-")+state+".png"),image);
    }
    expect(images[1].equals(images[0]),"Rendered CSS changed: inspect the baseline/candidate "+state+" images").toBe(true);
   }
   expect(errors).toEqual([]);
  }finally{for(const context of contexts)await context.close();}
 });
}
