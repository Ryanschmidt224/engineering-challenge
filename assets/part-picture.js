// The legacy part page owns its controls; this loader owns image request state.
export function createPartPictureLoader({project,current,cover,preview,placeholder,markup,remove,actions,fallback}){
 let generation=0;
 return function show(partId,bust=false){
  const part=current(),turn=++generation;
  if(!partId)return;
  preview.hidden=true;preview.removeAttribute("src");placeholder.hidden=false;markup.disabled=true;remove.disabled=true;actions.setPhotoPresent(false);
  if(part?.familyUse){actions.setEnabled(false);if(part.photoUrl){const image=document.createElement("img");image.src=part.photoUrl;image.alt=part.name;cover.replaceChildren(image);}else fallback();return;}
  if(!bust&&part?.hasPhoto===false){fallback();return;}
  const src=window.BSPhotoMarkup.displayUrl("part",partId,project)+(bust?"&v="+Date.now():""),image=document.createElement("img");image.alt=part?.name||"Part image";
  image.onload=()=>{if(turn!==generation||current()?.id!==partId)return;const main=document.createElement("img");main.src=src;main.alt=image.alt;cover.replaceChildren(main);preview.src=src;preview.hidden=false;placeholder.hidden=true;remove.disabled=false;markup.disabled=false;actions.setPhotoPresent(true);};
  image.onerror=()=>{if(turn!==generation||current()?.id!==partId)return;fallback();};image.src=src;
 };
}
