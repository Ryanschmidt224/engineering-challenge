import {openHistoryEntryDialog} from "./history-entry-dialog.js";
import {partHelp} from "./part-help.js";

export function revisionSaveButton({project,ui,prepare,onSave,onError}){
 const button=ui.button("Save as revision",async()=>{
  if(button.disabled)return;button.disabled=true;
  try{
  const context=await prepare();if(!context)return;
  openHistoryEntryDialog({trigger:button,project,title:"Save as revision",description:partHelp.saveAsRevision,submitLabel:"Save as revision",ui,photoEditor:window.BSPhotoEditor,
   onSave:(entryDetails,operationId)=>onSave({...context,entryDetails,operationId})});
  }catch(error){onError(error.message);}finally{button.disabled=false;}
 });
 button.title=partHelp.saveAsRevision;button.setAttribute("aria-description",partHelp.saveAsRevision);return button;
}

export async function saveRevisionChanges(address,changes,original,options){
 const response=await fetch(address,{method:"PUT",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({...changes,...options,saveAsRevision:true,expectedRevision:original.revision??null})});
 const result=await response.json();if(!response.ok)throw Error(result.error||"Could not save revision. Your draft is preserved.");return result;
}

export async function revisionContext(project,part){
 const response=await fetch("/api/workspace?"+new URLSearchParams({project,part}),{cache:"no-store"}),data=await response.json();
 if(!response.ok)throw Error(data.error||"Could not load saved instructions.");
 return {expectedWorkspaceRevision:data.workspace?.revision??null};
}
