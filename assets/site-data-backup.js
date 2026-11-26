import {backupDataLines,siteBackupReader} from "./site-data-backup-model.js";
const directSaveSupported=()=>typeof window.showSaveFilePicker==='function';
const browserHelp='This browser does not support saving a whole-site backup directly. Use desktop Chrome or Edge.';
// The save picker is opened directly from the user's click, before any fetch.
export function backupAllDataButton(){
 const button=window.BSUI.button('Backup all data',async()=>{
  let writable;button.disabled=true;const original=button.textContent;
  try{
   const date=new Date(),parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Phoenix',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).map(v=>[v.type,v.value])),name='BuildingSchmidtDataBackup-'+parts.year+'-'+parts.month+'-'+parts.day+'.bsbackup';
   if(!directSaveSupported())throw Error(browserHelp);
   const file=await window.showSaveFilePicker({suggestedName:name,types:[{description:'BuildingSchmidt data backup',accept:{'application/octet-stream':['.bsbackup']}}]});writable=await file.createWritable();button.textContent='Backing up…';
   for await(const bytes of backupDataLines(siteBackupReader()))await writable.write(bytes);await writable.close();writable=null;button.textContent='Backup saved';
  }catch(error){if(writable)await writable.abort().catch(()=>{});if(error.name!=='AbortError')window.alert(error.message);}finally{button.disabled=!directSaveSupported();if(button.textContent!=='Backup saved')button.textContent=original;}
 });button.disabled=!directSaveSupported();if(button.disabled)button.title=browserHelp;return button;
}
