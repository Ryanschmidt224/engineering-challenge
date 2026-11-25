import {node} from "./workshop-ui.js";
import {dataTable} from "./data-table.js";

const fileSize=bytes=>!Number.isFinite(bytes)||bytes<0?"Unknown":bytes>=1048576?(bytes/1048576).toFixed(1)+" MiB":bytes>=1024?(bytes/1024).toFixed(1)+" KiB":bytes+" B";
export function automaticBackupSection({client,projectId}){
 const section=window.BSUI.section({title:"Automatic backups",role:"automatic-backups",countLabel:["backup","backups"],tooltip:"Download nightly snapshots of this project. Backups are stored in the same Cloudflare R2 bucket."});
 const list=node("div");list.setAttribute("aria-live","polite");let loaded=false,busy=false;
 const refresh=window.BSUI.button("Refresh backups",load,{variant:"quiet"});
 async function load(){
  if(busy)return;busy=true;refresh.disabled=true;list.replaceChildren(node("p","Loading automatic backups…"));
  try{
   const data=await client.request("/"+projectId+"/automatic-backups");
   if(!Array.isArray(data.backups))throw Error("The backup list was not returned.");
   loaded=true;refresh.textContent="Refresh backups";section.setCount(data.backups.length);
   if(!data.backups.length){list.replaceChildren(node("p","No automatic backups have been saved for this project yet."));return;}
   const table=dataTable("Automatic project backups",["Saved","Size","Download"]);
   for(const backup of data.backups){
    const date=new Date(backup.date),validDate=!!backup.date&&Number.isFinite(date.getTime()),label=validDate?date.toLocaleString():"Date unavailable",time=node("time",label);
    if(validDate)time.dateTime=backup.date;
    const download=node("a","Download");download.href="/api/project-engine/projects/"+encodeURIComponent(projectId)+"/automatic-backups?"+new URLSearchParams({id:backup.id});download.target="_blank";download.rel="noopener";download.setAttribute("aria-label","Download backup from "+label);
    table.append([time,fileSize(backup.size),download]);
   }
   list.replaceChildren(table.root);
  }catch(error){list.replaceChildren(node("p","Could not load automatic backups. "+error.message));refresh.textContent="Retry backups";}
  finally{busy=false;refresh.disabled=false;}
 }
 section.body.append(node("p","Changed projects are saved by the nightly backup job. These copies use the same Cloudflare R2 bucket.","muted"),list);
 window.BSUI.sectionActions(section.body,{secondary:[refresh]});
 section.root.addEventListener("toggle",()=>{if(section.root.open&&!loaded)void load();});
 return section.root;
}
