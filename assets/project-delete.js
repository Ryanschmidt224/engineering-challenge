import {node,field,actions} from "./workshop-ui.js";
const button=(...args)=>window.BSUI.button(...args);
export function showProjectDeletion(ctx,project){
 const dialog=ctx.dialog,form=node("form"),error=node("p","","error"),status=node("p","","muted"),operationId=project.deletion_operation_id||crypto.randomUUID(),expectedRevision=project.deletion_expected_revision||project.revision;
 let busy=false;const name=field("Type project name","",()=>{submit.disabled=input.value!==project.name;},{required:true}),input=name.querySelector("input");input.maxLength=180;input.autocomplete="off";
 const submit=button(project.deletion_state?"Continue deletion":"Permanently delete project",()=>form.requestSubmit(),{variant:"danger"}),cancel=button("Cancel",()=>dialog.close());submit.disabled=true;error.setAttribute("role","alert");status.setAttribute("role","status");
 form.append(node("p",'Permanently delete “'+project.name+'”? This removes its parts, files, instructions, history and automatic backups from this website. It cannot be undone.'),node("p","Reusable Workshop templates/products and other projects stay separate.","muted"),name,error,status,actions(submit,cancel));
 form.onsubmit=async event=>{
  event.preventDefault();if(busy||input.value!==project.name)return;busy=true;submit.disabled=true;cancel.disabled=true;input.disabled=true;error.replaceChildren();status.textContent="Deleting project files and backups…";
  try{
   for(let step=0;step<1000;step++){
    const result=await ctx.client.request("/"+project.id+"/delete",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({operationId,expectedRevision,name:input.value})});
    if(result.deleted===true){dialog.close();await ctx.navigate();ctx.notify("Project permanently deleted.");return;}
    if(result.deleting!==true)throw Error("The deletion response was not recognized. Retry to check its progress.");
   }
   throw Error("Deletion has more work to do. Retry to continue the same deletion.");
  }catch(problem){
   status.textContent="";error.append(document.createTextNode(problem.message));submit.textContent="Retry deletion";cancel.textContent="Close";
   if(problem.status===409)error.append(button("Return to Projects",()=>{dialog.close();void ctx.navigate();}));
   if(problem.status===401&&ctx.signIn)error.append(button("Log in again",()=>ctx.signIn()));
  }finally{busy=false;submit.disabled=false;cancel.disabled=false;}
 };
 dialog.oncancel=event=>{if(busy)event.preventDefault();};dialog.replaceChildren(node("h2","Delete project permanently"),form);dialog.setAttribute("aria-label","Delete project permanently");if(!dialog.open)dialog.showModal();input.focus();
}
export function projectDeletionSection(ctx,project){
 const section=window.BSUI.section({title:"Delete project",role:"delete-project",tooltip:"Permanently remove this project's website data and automatic backups."});section.body.append(node("p","Permanently remove this project and its automatic backups. A typed-name confirmation is required."),button("Delete project",()=>showProjectDeletion(ctx,project),{variant:"danger"}));return section.root;
}
