import "../../assets/resources.js";
import {accountUser} from "./accounts.js";

const {workshopReferences,workshopLinkId}=globalThis.BSResources;
export {workshopLinkId};
const uuid=/^[0-9a-f-]{36}$/i;

async function readJSON(env,key){
 const object=await env.PHOTOS.get(key);
 return object?JSON.parse(await object.text()):null;
}

export function workshopItemLookup(request,env,resolveUser=()=>accountUser(request,env)){
 const records=new Map();
 let user;
 const cachedRead=key=>{
  if(!records.has(key))records.set(key,readJSON(env,key));
  return records.get(key);
 };
 return part=>linkedWorkshopItem(request,env,part,cachedRead,()=>user??=resolveUser());
}

export async function linkedWorkshopItem(request,env,part,read=key=>readJSON(env,key),getUser=()=>accountUser(request,env)){
 const id=workshopLinkId(part);
 if(!id)return null;
 if(id.startsWith("my:")){
  const user=await getUser();
  if(!user)return null;
  const inventory=await read("user-workshop/"+user.id+"/inventory.json");
  const item=inventory?.find(entry=>entry.id===id.slice(3));
  if(!item)return null;
  const photoKey=uuid.test(item.photoId||"")?"user-workshop/"+user.id+"/photos/"+item.photoId:null;
  return {id,item,photoKey};
 }
 const stored=await read("workshop-reference-overrides/v1.json");
 const override=stored?.[id];
 const seed=workshopReferences.find(item=>item.id===id);
 if(!seed&&!override?.created)return null;
 const item={...seed,...override};
 const photoId=item.photos?.[0]?.id;
 const photoKey=uuid.test(photoId||"")?"workshop-reference-photos/"+photoId:null;
 return {id,item,photoKey};
}

export function workshopDocumentation(item){
 const specs = [...(item.specRecords || []), ...(item.specifications || [])];
 const links = new Map();
 const candidates = [
  {label:"Documentation", url:item.documentationUrl || item.source},
  ...(item.workshopDocumentation || []),
  ...specs.filter(spec=>/documentation|datasheet|manual/i.test(spec.name || spec.label || ""))
   .map(spec=>({label:spec.name || spec.label, url:spec.value}))
 ];
 for(const entry of candidates){
  for(const raw of String(entry.url || "").match(/https:\/\/[^\s<>"]+/gi) || []){
   try{
    const url=new URL(raw);
    if(!url.username && !url.password && !links.has(url.href))
     links.set(url.href,{label:entry.label || "Documentation",url:url.href});
   }catch{}
  }
 }
 return [...links.values()];
}

export const workshopSourcing=item=>({
 supplierPartNumber:String(item.supplierPartNumber??"").trim().slice(0,160),
 url:String(item.supplierUrl??"").trim().slice(0,1200),
 price:String(item.price??"").trim().slice(0,80),
 packageQuantity:String(item.packageQuantity??"").trim().slice(0,80)
});

export function workshopPartDetails({id,item}){
 const clean=(value,n=300)=>String(value??"").trim().slice(0,n);
 const specifications=(item.specRecords?.length?item.specRecords:item.specifications||[]).map(spec=>({
  name:clean(spec.label||spec.name),
  value:clean([spec.value,spec.unit,spec.conditions&&"("+spec.conditions+")"].filter(Boolean).join(" ")),
  source:"explicit"
 })).filter(spec=>spec.name&&spec.value);
 const additional=[
  ["Specifications",item.spec],["Typical use",item.use],["Considerations",item.caution],
  ["Supplier part number",item.supplierPartNumber],["Documentation URL",item.documentationUrl||item.source],["How to order",item.orderNotes]
 ];
 for(const [name,value] of additional){
  if(value&&!specifications.some(spec=>spec.name===name))specifications.push({name,value:clean(value,1200),source:"explicit"});
 }
 return {
  name:clean(item.name,180),description:clean(item.subtitle||item.description,2000),
  category:clean(item.category),manufacturer:clean(item.manufacturer),
  model:clean(item.partNumber||item.model),supplier:clean(item.supplier),asin:clean(item.asin),
  specifications:specifications.slice(0,35),supplierOffers:[],workshopSourcing:workshopSourcing(item),
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
