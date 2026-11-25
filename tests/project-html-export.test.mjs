import test from "node:test";
import assert from "node:assert/strict";
import {readableArchive,htmlArchive} from "../assets/project-html-export.js";

test("readable export consumes streamed rows across UTF-8 boundaries and expands frozen evidence",async()=>{
 const project={id:"project",name:"Résumé notebook"},tables={items:[{id:"part",name:"Bracket",part_number:"BB100",kind:"part",is_tool:0,fields:'{"description":"Current part"}'}],occurrences:[{id:"placement",item_id:"part",quantity:2,unit:"pcs",parent_id:null,removed_at:null}],steps:[],records:[],files:[{id:"drawing",name:"drawing.json",state:"ready",content_type:"application/json"}],file_links:[],events:[{id:"event",item_id:"part",title:"Revision 1",payload:JSON.stringify({snapshot:{format:5,item:{name:"Old bracket"},references:{records:["frozen"],files:[],file:null}}})}],snapshot_values:[{id:"frozen",snapshot:JSON.stringify({title:"Original test",fields:{result:"Before editing"}})}]};
 tables.items.push({id:"old-part",name:"Archived plate",part_number:"BB101",kind:"part",is_tool:0,fields:"{}"});tables.occurrences.push({id:"old-placement",item_id:"old-part",quantity:1,unit:"pcs",parent_id:null,removed_at:"2026-11-24"});
 const entries=[{type:"manifest",manifest:{version:2,project,tableNames:Object.keys(tables)}},...Object.entries(tables).flatMap(([table,rows])=>rows.map(row=>({type:"row",table,row}))),{type:"metadata_complete"},{type:"file",id:"drawing"},{type:"bytes",data:btoa("old")},{type:"bytes",data:btoa(" bytes")},{type:"end_file",id:"drawing"},{type:"complete"}],data=new TextEncoder().encode(entries.map(JSON.stringify).join("\n")),stream=new ReadableStream({start(controller){for(let at=0;at<data.length;at+=7)controller.enqueue(data.subarray(at,at+7));controller.close();}}),parsed=await readableArchive(new Response(stream)),archive=htmlArchive(parsed),history=JSON.parse(Buffer.from(archive.objects.find(row=>row.key==="investigations/history.json").data,"base64").toString());
 assert.equal(parsed.manifest.project.name,"Résumé notebook");assert.equal(history[0].payload.snapshot.records[0].fields.result,"Before editing");assert.equal(history[0].payload.snapshot.references,undefined);assert.equal(archive.objects.find(row=>row.key.startsWith("part-files/")).data,btoa("old bytes"));assert.equal(tables.events[0].payload.includes("frozen"),true);
 const archived=archive.objects.find(row=>row.key==="Archive/archive.json");assert.match(Buffer.from(archived.data,"base64").toString(),/Archived plate/);assert.ok(!archive.objects.some(row=>row.key==="part-workspaces/BB101.json"));
});
test("readable export retains the version-1 format and refuses an incomplete download",async()=>{
 const manifest={version:1,project:{id:"project",name:"Notebook"},tables:{items:[]}},header=JSON.stringify({type:"manifest",manifest})+"\n";
 assert.deepEqual((await readableArchive(new Response(header+'{"type":"complete"}\n'))).manifest,manifest);
 await assert.rejects(readableArchive(new Response(header)),/interrupted/);
});
