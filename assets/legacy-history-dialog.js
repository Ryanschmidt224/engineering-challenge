// Only retained legacy editors know the legacy recipe-file upload endpoint.
// The shared prompt owns drafts/retries; each project system owns persistence.
import {openHistoryEntryDialog} from "./history-entry-dialog.js";

export function openLegacyHistoryEntryDialog({project,...options}){
 return openHistoryEntryDialog({...options,uploadPhoto:async file=>{
  const response=await fetch("/api/recipe-files?project="+encodeURIComponent(project),{method:"POST",credentials:"same-origin",headers:{"content-type":"application/octet-stream","x-file-name":encodeURIComponent(file.name)},body:file});
  const data=await response.json();if(!response.ok||!data.id)throw Error(data.error||"Photo upload failed. Your draft is preserved.");return data.id;
 }});
}
