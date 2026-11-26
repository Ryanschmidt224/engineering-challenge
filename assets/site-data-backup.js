// The save picker is opened directly from the user's click, before any fetch.
export function backupAllDataButton(){
 const button=window.BSUI.button('Backup all data',async()=>{
  let writable;button.disabled=true;const original=button.textContent;
  try{
   const date=new Date(),parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Phoenix',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).map(v=>[v.type,v.value])),name='BuildingSchmidtDataBackup-'+parts.year+'-'+parts.month+'-'+parts.day+'.bsbackup';
   if(!window.showSaveFilePicker){const link=document.createElement('a');link.href='/api/site-data-backup';link.download=name;link.click();return;}
   const file=await window.showSaveFilePicker({suggestedName:name,types:[{description:'BuildingSchmidt data backup',accept:{'application/octet-stream':['.bsbackup']}}]});writable=await file.createWritable();button.textContent='Backing up…';
   const response=await fetch('/api/site-data-backup',{credentials:'same-origin',cache:'no-store'});if(!response.ok)throw Error(response.status===401?'Sign in again, then retry the backup.':'Could not start backup.');
   const reader=response.body.getReader(),decoder=new TextDecoder();let pending='',complete=false,digest='';try{for(;;){const {value,done}=await reader.read();if(done)break;await writable.write(value);pending+=decoder.decode(value,{stream:true});let at;while((at=pending.indexOf('\n'))!==-1){const line=pending.slice(0,at),entry=JSON.parse(line);pending=pending.slice(at+1);if(complete)throw Error('Unexpected backup content.');if(entry.type==='complete'){if(entry.sha256!==digest)throw Error('Backup verification failed.');complete=true;}else{const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(digest+line));digest=Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');}}if(pending.length>4*1024*1024)throw Error('Backup line is too large.');}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
   if(!complete||pending.trim())throw Error('The backup was interrupted. Please retry.');await writable.close();writable=null;button.textContent='Backup saved';
  }catch(error){if(writable)await writable.abort().catch(()=>{});if(error.name!=='AbortError')window.alert(error.message);}finally{button.disabled=false;if(button.textContent!=='Backup saved')button.textContent=original;}
 });return button;
}
