// Explicitly installed per editor; no page state or event handlers at import time.
export function installWorkInstructionSaveGuard({article,state,save,review,error}) {
 let replay=false;
 const pending=()=>{const value=state();return value.dirty||value.draft||value.saving||value.uploading;};
 const beforeUnload=event=>{
  if(!pending())return;
  review();event.preventDefault();event.returnValue="";
 };
 const beforeNavigation=async event=>{
  if(replay||!pending()||!article.isConnected||article.closest(".hide")||article.offsetParent===null)return;
  const target=event.target.closest?.("button,a,[role=button]");
  if(!target||article.contains(target)||target.closest(".modalback,dialog,[role=dialog]")||target.matches(".workspace-save,.part-workspace-save"))return;
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
  const value=state();
  if(value.draft||value.saving||value.uploading){review();return;}
  try{await save();replay=true;try{target.click();}finally{replay=false;}}
  catch(problem){review();error(problem.message||"Save failed; navigation cancelled.");}
 };
 window.addEventListener("beforeunload",beforeUnload);
 document.addEventListener("click",beforeNavigation,true);
 return ()=>{window.removeEventListener("beforeunload",beforeUnload);document.removeEventListener("click",beforeNavigation,true);};
}
