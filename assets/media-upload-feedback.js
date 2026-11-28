import {node} from './workshop-ui.js?v=save-upload-20261128';
// Temporary browser feedback only: never publish a local preview as saved data.
export function mediaUploadFeedback(cover=null){
 const root=node('div','','project-upload-feedback'),progress=node('progress'),message=node('span');
 root.hidden=true;root.setAttribute('role','status');root.setAttribute('aria-live','polite');progress.setAttribute('aria-label','Photo upload in progress');root.append(progress,message);
 let preview=null,url=null;const galleryUrls=[];
 const clearPreview=()=>{preview?.remove();preview=null;for(const uri of galleryUrls)URL.revokeObjectURL(uri);galleryUrls.length=0;if(url)URL.revokeObjectURL(url);url=null;if(cover)cover.hidden=false;};
 const update=({phase,images=[],message:error})=>{
  root.hidden=false;progress.hidden=phase==='error'||phase==='complete';
  if(phase==='uploading'&&!preview&&cover&&images.length===1&&/^image\/(png|jpeg|webp)$/.test(images[0].type)){
   url=URL.createObjectURL(images[0]);preview=node('img','','project-picture');preview.alt='Uploading picture — not saved yet';preview.src=url;cover.before(preview);cover.hidden=true;
  }
  if(phase==='uploading'&&!preview&&!cover){preview=node('div');for(const image of images.slice(0,20)){if(!/^image\/(png|jpeg|webp|gif|avif)$/.test(image.type))continue;const uri=URL.createObjectURL(image),img=node('img');galleryUrls.push(uri);img.src=uri;img.alt='Uploading photo — not saved yet';preview.append(img);}root.append(preview);}
  message.textContent=phase==='uploading'?'Uploading photo…':phase==='saving'?'Saving photo…':phase==='refreshing'?'Photo saved. Loading picture…':phase==='error'?error:'Photo saved.';
  if(phase==='error'||phase==='complete')clearPreview();
 };
 return {root,update,finish:clearPreview};
}
