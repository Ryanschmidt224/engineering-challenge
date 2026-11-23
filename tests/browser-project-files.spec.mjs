import {test,expect} from "@playwright/test";
import {readFile} from "node:fs/promises";
import {readStoredZip} from "./helpers/zip.mjs";
test.describe.configure({mode:"serial"});
const origin="http://127.0.0.1:4173";
test.beforeEach(async({request,context})=>{const {cookie}=await(await request.post("/__test__/reset")).json(),at=cookie.indexOf("=");await context.addCookies([{name:cookie.slice(0,at),value:cookie.slice(at+1),url:origin,httpOnly:true,sameSite:"Strict"}]);});
async function upload(page,path,name,data,pdf=false){const response=await page.request.post(path,{headers:{origin,"x-file-name":encodeURIComponent(name),"x-drawing-name":encodeURIComponent(name),"content-type":pdf?"application/pdf":"application/octet-stream"},data:Buffer.from(data)});expect(response.ok(),await response.text()).toBeTruthy();return response.json();}
for(const width of [1440,390])test("project-wide files select and download ten STLs and ten drawings together at "+width+"px",async({page},testInfo)=>{
 const expected=[];
 for(let index=0;index<10;index++){
  const response=await page.request.post("/api/components?project=launcher",{headers:{origin},data:{name:"Bracket "+index,partType:"custom",specifications:[]}});expect(response.ok(),await response.text()).toBeTruthy();const {component}=await response.json();
  const suffix="?project=launcher&id="+component.id+"&implementation="+component.selectedImplementationId,stl="solid bracket "+index+"\nendsolid",pdf="%PDF-1.7\nDrawing "+index+"\n%%EOF";expected.push(stl,pdf);
  await upload(page,"/api/part-files"+suffix,"bracket.stl",stl);await upload(page,"/api/drawings"+suffix+"&type=part","drawing.pdf",pdf,true);
 }
 await page.setViewportSize({width,height:1000});await page.goto("/index.html#launcher/parts");const section=page.locator('#launcher [data-section="project-files"]');await expect(section).toBeVisible();await section.locator(":scope > .ui-section__header").click();await expect(section.locator(".ui-project-file-row")).toHaveCount(20);
 await section.getByRole("combobox",{name:"File type",exact:true}).selectOption("stl");await expect(section.getByRole("checkbox")).toHaveCount(10);await section.getByRole("button",{name:"Select visible files",exact:true}).click();await expect(section.getByRole("status")).toContainText("10 selected");
 await section.getByRole("combobox",{name:"File type",exact:true}).selectOption("drawing");await expect(section.getByRole("checkbox")).toHaveCount(10);await section.getByRole("button",{name:"Select visible files",exact:true}).click();await expect(section.getByRole("status")).toContainText("20 selected");
 const waiting=page.waitForEvent("download");await section.getByRole("button",{name:"Download selected ZIP",exact:true}).click();const download=await waiting;await download.saveAs(testInfo.outputPath("twenty-project-files.zip"));const files=readStoredZip(await readFile(await download.path()));expect(files).toHaveLength(20);expect(new Set(files.map(file=>file.name)).size).toBe(20);expect(files.map(file=>file.bytes.toString()).sort()).toEqual(expected.sort());
 await expect(section.getByRole("status")).toContainText("ZIP ready — 20 files");await page.screenshot({path:testInfo.outputPath("project-files.png"),fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);
 await section.getByRole("searchbox",{name:"Search project files",exact:true}).fill("Bracket 4");await expect(section.locator(".ui-project-file-row")).toHaveCount(1);await section.getByRole("button",{name:"Clear selection",exact:true}).click();await expect(section.getByRole("button",{name:"Download selected ZIP",exact:true})).toBeDisabled();
});
test("a file replaced after selection prevents a partial ZIP and keeps selection available",async({page})=>{
 let downloads=0;page.on("download",()=>downloads++);
 const response=await page.request.post("/api/components?project=launcher",{headers:{origin},data:{name:"Replace fixture",partType:"custom",specifications:[]}}),{component}=await response.json();const suffix="?project=launcher&id="+component.id+"&implementation="+component.selectedImplementationId+"&type=part",{drawing}=await upload(page,"/api/drawings"+suffix,"drawing.pdf","%PDF-1.7\nVersion A",true);
 await page.goto("/index.html#launcher/parts");const section=page.locator('#launcher [data-section="project-files"]');await section.locator(":scope > .ui-section__header").click();await expect(section.getByRole("checkbox")).toHaveCount(1);await section.getByRole("checkbox").check();
 const index=await(await page.request.get("/api/project-files?project=launcher")).json(),file=index.files[0],id=new URL(file.url,origin).searchParams.get("key").split("/").pop().split(".")[0];await upload(page,"/api/drawings"+suffix+"&file="+id,"drawing.pdf","%PDF-1.7\nVersion B",true);
 await section.getByRole("button",{name:"Download selected ZIP",exact:true}).click();await expect(section.getByRole("status")).toContainText("ZIP not created: This file changed");await expect(section.getByRole("checkbox")).toBeChecked();expect(downloads).toBe(0);await section.getByRole("button",{name:"Refresh files",exact:true}).click();await expect(section.getByRole("status")).toContainText("0 selected");
});
