// Attach extraction results after the part save. A missing supplier image or
// saved product page reports its own warning without discarding the saved part.
export async function attachPartEditorFiles({project,component,snapshotId,imageUrl,photoUrl}){
    let photoMessage="";
    if(snapshotId&&component?.id){
     try{
      const snapshotResponse=await fetch("/api/part-pages?"+new URLSearchParams({project,id:component.id,...(component.selectedImplementationId?{implementation:component.selectedImplementationId}:{})}),{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({snapshotId})});
      const snapshotData=await snapshotResponse.json();if(!snapshotResponse.ok)throw Error(snapshotData.error||"Could not attach saved product page");
      photoMessage+=" Product webpage archived with part details.";
     }catch(error){photoMessage+=" Warning: product webpage was not attached: "+error.message}
    }
    if(imageUrl&&component?.id){
     try{
      const photoResponse=await fetch(photoUrl,{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({imageUrl})});
      const photoData=await photoResponse.json().catch(()=>({}));
      photoMessage=photoResponse.ok?" Product picture added.":" Product picture unavailable; you can upload one manually.";
     }catch{photoMessage=" Product picture unavailable; you can upload one manually."}
    }
    return photoMessage;
}
