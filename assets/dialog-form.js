// Shared custom-body form dialog. Domain editors supply their controls and
// persistence; this shell keeps focus, cancellation and busy behavior in one place.
export function dialogForm({title,description="",submitLabel="Save",cancelLabel="Cancel",ui,onSubmit,onClose=()=>{}}){
 const make=(tag,text,cls="")=>{const node=document.createElement(tag);node.textContent=text;node.className=cls;return node;};
 const dialog=make("dialog","","bs-dialog"),heading=make("h2",title),body=make("div",""),feedback=make("p","","muted"),actions=make("div","","bs-dialog-actions");
 heading.id="dialog-title-"+crypto.randomUUID();dialog.setAttribute("aria-labelledby",heading.id);feedback.setAttribute("role","status");feedback.setAttribute("aria-live","polite");
 let busy=false;
 const cancel=ui.button(cancelLabel,()=>{if(!busy)dialog.close();});
 const submit=onSubmit?ui.button(submitLabel,async()=>{
  if(busy)return;busy=true;cancel.disabled=submit.disabled=true;submit.textContent="Saving…";feedback.textContent="Saving…";
  const controls=[...body.querySelectorAll("input,textarea,button,select")].map(node=>[node,node.disabled]);for(const [node] of controls)node.disabled=true;
  try{await onSubmit();dialog.close();}
  catch(error){feedback.textContent=error.message||"Save failed. Your draft is preserved.";}
  finally{busy=false;cancel.disabled=submit.disabled=false;submit.textContent=submitLabel;for(const [node,disabled] of controls)node.disabled=disabled;}
 },{variant:"primary"}):null;
 actions.append(...[submit,cancel].filter(Boolean));dialog.append(heading);if(description)dialog.append(make("p",description));dialog.append(body,feedback,actions);
 dialog.addEventListener("cancel",event=>{if(busy)event.preventDefault();});
 dialog.addEventListener("close",()=>{onClose();dialog.remove();},{once:true});document.body.append(dialog);
 return {dialog,body,feedback,submit,open(){dialog.showModal();body.querySelector("textarea,input")?.focus();},isBusy:()=>busy};
}
