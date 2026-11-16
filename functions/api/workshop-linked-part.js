import "../../assets/resources.js";
import {accountUser} from "./accounts.js";

const {workshopReferences,workshopLinkId}=globalThis.BSResources;
export {workshopLinkId};
const uuid=/^[0-9a-f-]{36}$/i;

export async function linkedWorkshopItem(request,env,part){
 const id=workshopLinkId(part);
 if(!id)return null;
 if(id.startsWith("my:")){
  const user=await accountUser(request,env);
  if(!user)return null;
  const object=await env.PHOTOS.get("user-workshop/"+user.id+"/inventory.json");
  const item=object&&JSON.parse(await object.text()).find(entry=>entry.id===id.slice(3));
  if(!item)return null;
  const photoKey=uuid.test(item.photoId||"")?"user-workshop/"+user.id+"/photos/"+item.photoId:null;
  return {id,item,photoKey};
 }
 const stored=await env.PHOTOS.get("workshop-reference-overrides/v1.json");
 const override=stored&&JSON.parse(await stored.text())[id];
 const seed=workshopReferences.find(item=>item.id===id);
 if(!seed&&!override?.created)return null;
 const item={...seed,...override};
 const photoId=item.photos?.[0]?.id;
 const photoKey=uuid.test(photoId||"")?"workshop-reference-photos/"+photoId:null;
 return {id,item,photoKey};
}

export function workshopPartDetails({id,item}){
 const clean=(value,n=300)=>String(value??"").trim().slice(0,n);
 const specifications=(item.specRecords?.length?item.specRecords:item.specifications||[]).map(spec=>({
  name:clean(spec.label||spec.name),
  value:clean([spec.value,spec.unit,spec.conditions&&"("+spec.conditions+")"].filter(Boolean).join(" ")),
  source:"explicit"
 })).filter(spec=>spec.name&&spec.value);
 const additional=[
  ["Specifications",item.spec],["Typical use",item.use],["Considerations",item.caution],
  ["Supplier URL",item.supplierUrl],["Documentation URL",item.documentationUrl||item.source],
  ["Reference price",item.price],["Quantity per package",item.packageQuantity],["How to order",item.orderNotes]
 ];
 for(const [name,value] of additional){
  if(value&&!specifications.some(spec=>spec.name===name))specifications.push({name,value:clean(value,1200),source:"explicit"});
 }
 return {
  name:clean(item.name,180),description:clean(item.subtitle||item.description,2000),
  category:clean(item.category),manufacturer:clean(item.manufacturer),
  model:clean(item.partNumber||item.model),supplier:clean(item.supplier),asin:clean(item.asin),
  specifications:specifications.slice(0,35),supplierOffers:[],
  partType:"purchased",itemType:"part",isTool:item.kind==="tool"||item.category==="tools",
  projectDetails:{workshopReferenceId:id,workshopTreeDescription:clean(item.featureTreeDescription,20),notes:clean(item.notes,6000)}
 };
}

export function partPhotoKey(project,part){
 const base="component-thumbnails/"+project+"/"+part.id;
 return uuid.test(part.photoRevision||"")?base+"/"+part.photoRevision:base;
}

export async function getPartPhoto(request,env,project,part,key=partPhotoKey(project,part)){
 const original=await env.PHOTOS.get(key);
 if(original||part.photoRevision)return original;
 const source=await linkedWorkshopItem(request,env,part);
 return source?.photoKey?env.PHOTOS.get(source.photoKey):null;
}
