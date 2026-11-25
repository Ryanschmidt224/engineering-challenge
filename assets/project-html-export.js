import {projectTree} from "./project-tree-model.js";
import {summaryParts} from "./project-summary.js";

// A display consumer of the existing verified .bsproject export. It neither
// changes that format nor participates in import, recovery or guarded saves.
export async function readableArchive(response){
 if(!response.ok)throw Error("Could not export this project. Try again.");
 let pending="",manifest=null,current=null,complete=false;const bytes=new Map(),decoder=new TextDecoder();
 const accept=line=>{
  if(!line.trim())return;const entry=JSON.parse(line);if(complete)throw Error("Unexpected content after the project export.");
  if(entry.type==="manifest"){if(manifest||![1,2].includes(entry.manifest?.version))throw Error("Unsupported project export.");manifest={...entry.manifest,tables:entry.manifest.tables||Object.fromEntries((entry.manifest.tableNames||[]).map(name=>[name,[]]))};}
  else if(entry.type==="row"){if(!manifest?.tables[entry.table])throw Error("Invalid project export row.");manifest.tables[entry.table].push(entry.row);}
  else if(entry.type==="metadata_complete"){}
  else if(entry.type==="file"){if(current)throw Error("Incomplete project file.");current={id:entry.id,chunks:[]};}
  else if(entry.type==="bytes"){if(!current)throw Error("Missing project file.");current.chunks.push(entry.data);}
  else if(entry.type==="end_file"){if(!current||current.id!==entry.id)throw Error("Incomplete project file.");bytes.set(current.id,current.chunks.join(""));current=null;}
  else if(entry.type==="complete")complete=true;
  else throw Error("Unsupported project export entry.");
 };
 const reader=response.body.getReader();try{for(;;){const {done,value}=await reader.read();if(done)break;pending+=decoder.decode(value,{stream:true});let end;while((end=pending.indexOf("\n"))!==-1){accept(pending.slice(0,end));pending=pending.slice(end+1);}}pending+=decoder.decode();if(pending.trim())accept(pending);}finally{reader.releaseLock();}
 if(!complete||current||!manifest?.project||!manifest.tables.items)throw Error("The export was interrupted. Try again; no HTML copy was created.");
 return {manifest,bytes};
}
const jsonFields=new Set(["fields","snapshot","payload","step_snapshot","removed_path","retired_path","requirements","members"]);
function decoded(row){return Object.fromEntries(Object.entries(row).map(([key,value])=>[key,jsonFields.has(key)&&typeof value==="string"?JSON.parse(value):value]));}
export function htmlArchive({manifest,bytes}){
 const tables=Object.fromEntries(Object.entries(manifest.tables).map(([name,rows])=>[name,rows.map(decoded)])),objects=[],keys=new Map(),frozen=new Map((tables.snapshot_values||[]).map(row=>[row.id,row.snapshot]));
 for(const [index,file]of (tables.files||[]).filter(file=>file.state==="ready").entries()){
  if(!bytes.has(file.id))throw Error("The export is missing a file. Try again.");const key="part-files/"+(index+1)+"-"+file.name;keys.set(file.id,key);objects.push({key,contentType:file.content_type,data:bytes.get(file.id),customMetadata:{filename:file.name}});
 }
 const expand=snapshot=>{if(snapshot?.format!==5)return snapshot;const result={...snapshot};delete result.references;for(const [name,refs]of Object.entries(snapshot.references||{})){const read=id=>{if(!frozen.has(id))throw Error("A historical value is missing from the export.");return frozen.get(id);};result[name]=Array.isArray(refs)?refs.map(read):refs===null?null:read(refs);}if(snapshot.parts)result.parts=snapshot.parts.map(expand);return result;};
 const display=value=>{if(Array.isArray(value))return value.map(display);if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).filter(([key])=>!["r2_key","restore_job_id"].includes(key)).map(([key,item])=>[key,display(key==="snapshot"?expand(item):item)]));return typeof value==="string"&&keys.has(value)?keys.get(value):value;};
 const encode=value=>{const data=new TextEncoder().encode(JSON.stringify(display(value)));let text="";for(let at=0;at<data.length;at+=8192)text+=String.fromCharCode(...data.subarray(at,at+8192));return btoa(text);};
 const add=(key,value)=>objects.push({key,contentType:"application/json",data:encode(value)}),tree=projectTree(tables.items,tables.occurrences),summary=summaryParts(tables);
 add("project-profile/summary.json",{name:manifest.project.name,note:"Readable notebook copy. Keep the .bsproject export for restoring a project.",numbering:{prefix:manifest.project.prefix,digits:manifest.project.digits},bill_of_materials:summary.bom.map(row=>({number:row.item.part_number,name:row.item.name,quantity:row.quantity,unit:row.unit})),tools:summary.tools.map(({item})=>({number:item.part_number,name:item.name}))});
 const placements=rows=>rows.map(row=>({path:tree.path(row).map(part=>part.name).join(" / "),...row})),archived=tables.occurrences.filter(row=>!tree.active(row)),archivedParts=[];add("trees/placements.json",placements(tables.occurrences.filter(tree.active)));
 for(const item of tables.items){const matches=rows=>(rows||[]).filter(row=>row.item_id===item.id),active=matches(tables.occurrences).some(tree.active),part={name:item.name,part:item,placements:matches(tables.occurrences).filter(row=>active?tree.active(row):true),work_instructions:matches(tables.steps),records:matches(tables.records),files:matches(tables.file_links),workshop_selection:(tables.selections||[]).find(row=>row.id===item.id)||null};if(active)add("part-workspaces/"+item.part_number+".json",part);else archivedParts.push(part);}
 if(archived.length||archivedParts.length)add("Archive/archive.json",{placements:placements(archived),parts:archivedParts});
 add("investigations/history.json",(tables.events||[]).map(event=>({...event,part:tables.items.find(item=>item.id===event.item_id)?.name||manifest.project.name})));
 return {projectId:manifest.project.id,exportedAt:new Date().toISOString(),objects};
}
export async function downloadProjectHTML(projectId){
 const response=await fetch("/api/project-engine/projects/"+encodeURIComponent(projectId)+"/export",{credentials:"same-origin",cache:"no-store"}),source=await readableArchive(response),archive=htmlArchive(source),html=window.BSReadableBackup.build(archive,source.manifest.project.name),blob=new Blob([html],{type:"text/html;charset=utf-8"}),url=URL.createObjectURL(blob),link=document.createElement("a");
 link.href=url;link.download=source.manifest.project.name.replace(/[^a-z0-9_-]/gi,"_")+".html";link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
