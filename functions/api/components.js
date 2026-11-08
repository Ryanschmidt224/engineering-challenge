import {isAdmin} from "./auth.js";
const projects=new Set(["launcher","linear","robot","buck","motorlab","coiltest"]);
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const authorized=isAdmin;
const key=project=>"components/"+project+".json";
const read=async(env,project)=>{const obj=await env.PHOTOS.get(key(project));return obj?JSON.parse(await obj.text()):[]};
// A manually recorded, historical USD unit price. Never represents live pricing.
const historicalPrice=input=>{
 const raw=input?.historicalPrice;
 if(raw===undefined||raw===null||raw==="")return {price:null,date:null};
 const price=Number(raw);
 const date=input?.historicalPriceDate;
 if(!Number.isFinite(price)||price<0||price>10000000||Math.round(price*100)!==price*100&&Math.abs(Math.round(price*100)-price*100)>1e-6)return null;
 if(typeof date!=="string"||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)return null;
 return {price,date};
};
// BOM quantities may be unspecified or measured in non-piece units.
const quantityData=(input,previous)=>{
 const raw=input.quantity;
 let quantity;
 if(raw===null||raw===undefined||raw==="")quantity=null;
 else{
  quantity=Number(raw);
  if(!Number.isFinite(quantity)||quantity<=0||quantity>10000000||!Number.isFinite(Number(raw)))return null;
 }
 const unit=input.quantityUnit===undefined?(previous?.quantityUnit??"pcs"):String(input.quantityUnit??"").trim();
 if(unit.length>32||(!/^[a-zA-Z0-9 °µ²³/_-]*$/.test(unit)))return null;
 return {quantity,quantityUnit:unit};
};
// Global, zero-setup shop defaults. An explicit override belongs to each BOM
// usage; it never pretends to be a live inventory count.
const standardShopMaterial=part=>{
 const name=String(part.name||"").toLowerCase();
 const category=String(part.category||"").toLowerCase();
 const generic=!String(part.manufacturer||"").trim()&&!String(part.model||"").trim();
 if(!generic)return false;
 if(part.generatedKind==="ferrule")return true;
 if(part.generatedKind==="wire")return /\b(?:18|22)\s*awg\b/i.test(name)&&!(part.specifications||[]).some(x=>String(x.name).toLowerCase()==="insulation"&&/silicone|other/i.test(x.value));
 if(/\bcrimped\s+wire\b/.test(name)||category.includes("crimped wire"))return false;
 if(/\b(?:solder|soldering wire|solder paste|heat[- ]?shrink|heat shrink tubing)\b/.test(name))return true;
 if(/\bferrules?\b/.test(name)||category==="wire termination"&&/ferrule/.test(name))return true;
 return /\b(?:18|22)\s*awg\b/.test(name)&&/\b(?:wire|cable)\b/.test(name);
};
const recommendedWorkshopIds=new Set([
 "workshop:wire22","workshop:wire18","workshop:wire16","workshop:silicone",
 "workshop:ferrule22","workshop:ferrule18",
 "workshop:heatshrink","workshop:sealshrink","workshop:solder"
]);
const presentPart=part=>({...part,assumedOnHand:part.purchaseOverride===true?false:part.purchaseOverride===false?true:standardShopMaterial(part)});
// Derived consumables remain tied to their source part. Never require the
// learner to enter ferrule counts or create a second independent BOM item.
function syncDerived(items,source){
 if(source.generatedFrom)return;
 const spec=new Map((source.specifications||[]).map(x=>[String(x.name).toLowerCase(),String(x.value).trim()]));
 const crimped=String(source.category||"").toLowerCase().includes("crimped wire");
 const gauge=spec.get("awg");
 const validGauge=crimped&&/^\d{1,2}$/.test(gauge||"");
 const updateGenerated=(kind,data)=>{
  const index=items.findIndex(x=>x.generatedFrom===source.id&&x.generatedKind===kind);
  if(!data){if(index>=0)items.splice(index,1);return}
  if(index>=0)items[index]={...items[index],...data};
  else items.push({id:crypto.randomUUID(),createdAt:new Date().toISOString(),...data});
 };
 const ferrules=["end a","end b"].filter(key=>spec.get(key)?.toLowerCase()==="ferrule").length;
 const qty=source.quantityUnit==="pcs"&&Number.isInteger(source.quantity)&&source.quantity>0?source.quantity:null;
 const base={assemblyId:source.assemblyId??null,bomOnly:true,generatedFrom:source.id,
  manufacturer:"",model:"",supplier:"",asin:"",historicalPrice:null,historicalPriceDate:null};
 updateGenerated("ferrule",validGauge&&ferrules?{
  ...base,name:"Ferrule — "+gauge+" AWG",quantity:qty===null?null:qty*ferrules,quantityUnit:"pcs",
  category:"Wire termination",generatedKind:"ferrule",sharedPartRef:"standard:ferrule:"+gauge,
  specifications:[
   {name:"Wire gauge",value:gauge+" AWG",source:"explicit"},
   {name:"Ferrules per wire",value:String(ferrules),source:"explicit"}
  ]
 }:null);
 // A wire assembly consumes raw wire even though the crimped assembly itself
 // remains a significant BOM part. Cut lengths are measured in inches.
 const cut=Number(spec.get("cut length (in)"));
 const conductor=/^(solid|braided|stranded)$/.test(spec.get("conductor")||"")?spec.get("conductor"):"stranded";
 const insulation=spec.get("insulation")||"Insulation not specified";
 updateGenerated("wire",validGauge&&Number.isFinite(cut)&&cut>0&&cut<=40000?{
  ...base,name:"Wire — "+gauge+" AWG "+conductor+" copper",
  quantity:qty===null?null:Number((qty*cut).toFixed(4)),quantityUnit:"in",
  category:"Wire & cable",generatedKind:"wire",sharedPartRef:source.sharedPartRef||null,
  specifications:[
   {name:"AWG",value:gauge,source:"explicit"},
   {name:"Conductor",value:conductor,source:"explicit"},
   {name:"Insulation",value:insulation,source:"explicit"}
  ]
 }:null);
}
const cleanPartRef=value=>{
 if(typeof value!=="string")return null;
 return /^(?:common|wire):[0-9a-f-]{36}$/i.test(value)||/^standard:ferrule:\d{1,2}$/.test(value)?value:null;
};
const safePublicImageUrl=value=>{
 try{
  if(typeof value!=="string"||value.length>1800)return null;
  const u=new URL(value);
  const host=u.hostname.toLowerCase();
  if(u.protocol!=="https:"||u.username||u.password||u.port&&u.port!=="443"||!host.includes(".")||host==="localhost"||host.endsWith(".localhost")||host.endsWith(".local")||host.endsWith(".internal")||host.endsWith(".test")||host.endsWith(".example")||host.endsWith(".invalid")||host.endsWith(".onion")||host.includes(":")||/^\d+(?:\.\d+){0,3}$/.test(host))return null;
  return u.toString();
 }catch{return null}
};

export async function handleComponents(request,env){
 const url=new URL(request.url),project=url.searchParams.get("project");
 if(!projects.has(project))return json({error:"Invalid project"},400);
 if(request.method==="GET")return json({components:(await read(env,project)).map(presentPart)});
 if(!await authorized(request,env))return json({error:"Administrator token required"},401);
 if(request.method==="POST"){
  const input=await request.json().catch(()=>null);
  if(!input||typeof input.name!=="string"||!input.name.trim()||input.name.length>180||!Array.isArray(input.specifications)||input.specifications.length>35)return json({error:"Invalid component"},400);
  const price=historicalPrice(input);
  if(!price)return json({error:"Historical price must be a nonnegative USD amount (2 decimals) with a valid recorded date"},400);
  const amount=quantityData(input);if(!amount)return json({error:"Quantity must be a positive number or blank, with a valid unit"},400);
  const clean=s=>String(s??"").slice(0,300);
  const record={assemblyId:typeof input.assemblyId==="string"?input.assemblyId.slice(0,80):null,...amount,bomOnly:input.bomOnly===true,purchaseOverride:input.purchaseOverride===true||input.purchaseOverride===false?input.purchaseOverride:null,workshopChoice:recommendedWorkshopIds.has(input.workshopChoice)?input.workshopChoice:null,sharedPartRef:cleanPartRef(input.sharedPartRef),id:crypto.randomUUID(),name:clean(input.name),manufacturer:clean(input.manufacturer),model:clean(input.model),supplier:clean(input.supplier),asin:clean(input.asin),category:clean(input.category),historicalPrice:price.price,historicalPriceDate:price.date,specifications:input.specifications.map(s=>({name:clean(s.name),value:clean(s.value),source:s.source==="inferred"?"inferred":"explicit"})).filter(s=>s.name&&s.value),createdAt:new Date().toISOString()};
  const items=await read(env,project);if(items.length>=300)return json({error:"Component limit reached"},400);items.push(record);syncDerived(items,record);await env.PHOTOS.put(key(project),JSON.stringify(items));return json({component:presentPart(record)},201);
 }
 // Tiny opt-in override: no requirement to re-enter part specifications.
 if(request.method==="PATCH"){
  const id=url.searchParams.get("id"),input=await request.json().catch(()=>null);
  if(!id||!input||!((input.purchaseOverride===null||typeof input.purchaseOverride==="boolean")||(input.workshopChoice===null||recommendedWorkshopIds.has(input.workshopChoice))))return json({error:"Invalid shop material preference"},400);
  const items=await read(env,project),entry=items.find(item=>item.id===id);
  if(!entry)return json({error:"Part not found"},404);
  if(Object.prototype.hasOwnProperty.call(input,"purchaseOverride"))entry.purchaseOverride=input.purchaseOverride;
  if(Object.prototype.hasOwnProperty.call(input,"workshopChoice"))entry.workshopChoice=input.workshopChoice;
  await env.PHOTOS.put(key(project),JSON.stringify(items));
  return json({component:presentPart(entry)});
 }
 if(request.method==="PUT"){
  const id=url.searchParams.get("id");
  const input=await request.json().catch(()=>null);
  if(!id||!input||typeof input.name!=="string"||!input.name.trim()||input.name.length>180||!Array.isArray(input.specifications)||input.specifications.length>35)return json({error:"Invalid part update"},400);
  const items=await read(env,project),index=items.findIndex(part=>part.id===id);
  if(index<0)return json({error:"Part not found"},404);
  if(items[index].generatedFrom)return json({error:"This material is calculated from its wire. Edit the wire instead."},409);
  const clean=value=>String(value??"").slice(0,300),previous=items[index];
  const price=historicalPrice(input);
  if(!price)return json({error:"Historical price must be a nonnegative USD amount (2 decimals) with a valid recorded date"},400);

  const amount=quantityData(input,previous);if(!amount)return json({error:"Quantity must be a positive number or blank, with a valid unit"},400);
  const updated={...previous,name:clean(input.name.trim()),...amount,historicalPrice:price.price,historicalPriceDate:price.date};
  if(input.purchaseOverride===true||input.purchaseOverride===false||input.purchaseOverride===null)updated.purchaseOverride=input.purchaseOverride;
  if(input.workshopChoice===null||recommendedWorkshopIds.has(input.workshopChoice))updated.workshopChoice=input.workshopChoice;
  // BOM-only classification persists through normal edits. Only a dedicated move action may change it.
  if(Object.prototype.hasOwnProperty.call(input,"assemblyId")){
   if(input.assemblyId!==null&&!(typeof input.assemblyId==="string"&&/^[a-zA-Z0-9-]{1,80}$/.test(input.assemblyId)))return json({error:"Invalid parent assembly"},400);
   updated.assemblyId=input.assemblyId;
  }
  for(const field of ["manufacturer","model","supplier","asin","category"])updated[field]=clean(input[field]);
  updated.specifications=input.specifications.map(spec=>({name:clean(spec.name),value:clean(spec.value),source:spec.source==="inferred"?"inferred":"explicit"})).filter(spec=>spec.name&&spec.value);
  // Keep the original shared part reference unless a new valid reference is supplied.
  if(Object.prototype.hasOwnProperty.call(input,"sharedPartRef"))updated.sharedPartRef=cleanPartRef(input.sharedPartRef);
  items[index]=updated;syncDerived(items,updated);await env.PHOTOS.put(key(project),JSON.stringify(items));
  return json({component:presentPart(updated)});
 }
 if(request.method==="DELETE"){
  const id=url.searchParams.get("id"),items=await read(env,project),target=items.find(x=>x.id===id);if(!target)return json({error:"Not found"},404);if(target.generatedFrom)return json({error:"This material is calculated from its wire. Delete or edit the wire instead."},409);const remaining=items.filter(x=>x.id!==id&&x.generatedFrom!==id);await env.PHOTOS.put(key(project),JSON.stringify(remaining));await env.PHOTOS.delete("component-thumbnails/"+project+"/"+id);await env.PHOTOS.delete("part-workspaces/"+project+"/"+id+".json");await env.PHOTOS.delete("harnesses/"+project+"/"+id+".json");return json({ok:true});
 }
 return json({error:"Method not allowed"},405)
}
// Small, dedicated part thumbnails are not assembly gallery photos.
export async function handleComponentPhoto(request,env){
 const url=new URL(request.url),project=url.searchParams.get("project"),id=url.searchParams.get("id");
 if(!projects.has(project)||!/^[0-9a-f-]{36}$/i.test(id||""))return json({error:"Invalid part"},400);
 if(!env.PHOTOS)return json({error:"Photo storage unavailable"},503);
 const photoKey="component-thumbnails/"+project+"/"+id;
 if(request.method==="GET"){
  const object=await env.PHOTOS.get(photoKey);if(!object)return new Response("Not found",{status:404});
  const headers=new Headers();object.writeHttpMetadata(headers);headers.set("cache-control","no-store");headers.set("x-content-type-options","nosniff");
  return new Response(object.body,{headers});
 }
 if(request.method!=="POST"&&request.method!=="DELETE")return json({error:"Method not allowed"},405);
 if(!await authorized(request,env))return json({error:"Admin login required"},401);
 const records=await read(env,project);
 if(!records.some(part=>part.id===id))return json({error:"Part not found"},404);
 if(request.method==="DELETE"){
  const existing=await env.PHOTOS.get(photoKey);
  if(!existing)return json({error:"No picture saved for this part"},404);
  await env.PHOTOS.delete(photoKey);
  return json({ok:true});
 }
 const incomingType=(request.headers.get("content-type")||"").split(";")[0].toLowerCase();
 if(incomingType==="application/json"){
  const payload=await request.json().catch(()=>null),remote=safePublicImageUrl(payload?.imageUrl);
  if(!remote)return json({error:"No valid public HTTPS image URL"},400);
  // The image is copied to R2 once. Do not hotlink the seller's server.
  let response;try{
   response=await fetch(remote,{redirect:"manual",headers:{"accept":"image/jpeg,image/png,image/webp"},signal:AbortSignal.timeout(8000)});
  }catch{return json({error:"The product website did not allow image download"},422)}
  if(!response.ok)return json({error:"Product image unavailable (HTTP "+response.status+")"},422);
  const mime=(response.headers.get("content-type")||"").split(";")[0].toLowerCase();
  if(!["image/jpeg","image/png","image/webp"].includes(mime))return json({error:"Product image format unsupported"},415);
  if(Number(response.headers.get("content-length"))>3*1024*1024)return json({error:"Product image is larger than 3 MB"},413);
  // Read at most 3 MB even when the remote server omits Content-Length.
  const limit=3*1024*1024,reader=response.body?.getReader();
  if(!reader)return json({error:"Product image body is empty"},422);
  const chunks=[];let total=0,oversize=false;
  try{
   while(true){
    const {done,value}=await reader.read();if(done)break;
    if(total+value.byteLength>limit){oversize=true;await reader.cancel();break}
    chunks.push(value);total+=value.byteLength;
   }
  }finally{reader.releaseLock()}
  if(oversize)return json({error:"Product image is larger than 3 MB"},413);
  if(!total)return json({error:"Product image body is empty"},422);
  const signature=new Uint8Array(total);let offset=0;for(const chunk of chunks){signature.set(chunk,offset);offset+=chunk.length}
  const buffer=signature.buffer;
  const valid=mime==="image/jpeg"?signature[0]===255&&signature[1]===216&&signature[2]===255:
   mime==="image/png"?signature[0]===137&&signature[1]===80&&signature[2]===78&&signature[3]===71:
   String.fromCharCode(...signature.slice(0,4))==="RIFF"&&String.fromCharCode(...signature.slice(8,12))==="WEBP";
  if(!valid)return json({error:"Website returned an invalid image"},422);
  await env.PHOTOS.put(photoKey,buffer,{httpMetadata:{contentType:mime}});
  return json({ok:true,imported:true});
 }
 const mime=(request.headers.get("content-type")||"").split(";")[0].toLowerCase();
 if(!["image/jpeg","image/png","image/webp"].includes(mime))return json({error:"Use a JPG, PNG or WebP picture"},415);
 const bytes=await request.arrayBuffer();if(!bytes.byteLength||bytes.byteLength>3*1024*1024)return json({error:"Picture must be under 3 MB"},413);
 await env.PHOTOS.put(photoKey,bytes,{httpMetadata:{contentType:mime}});
 return json({ok:true});
}
export async function handleExtract(request,env){
 if(request.method!=="POST")return json({error:"Method not allowed"},405);
 if(!await authorized(request,env))return json({error:"Administrator token required"},401);
 if(!env.OPENAI_API_KEY)return json({error:"AI extraction is not configured: add an OPENAI_API_KEY secret to this Cloudflare Worker. You can still add components manually."},503);
 const body=await request.json().catch(()=>null);
 let description=typeof body?.description==="string"?body.description.trim():"";
 let imageUrl=null;
 const source=description.match(/^https?:\/\/\S+$/i)?.[0];
 if(source){
  // Only fetch ordinary public HTTPS websites. No automatic redirect following.
  let url;try{url=new URL(source)}catch{return json({error:"Invalid product URL"},400)}
  const host=url.hostname.toLowerCase();
  if(url.protocol!=="https:"||url.username||url.password||url.port&&url.port!=="443"||host==="localhost"||host.endsWith(".localhost")||host.endsWith(".local")||host.endsWith(".internal")||host.endsWith(".test")||host.endsWith(".example")||host.endsWith(".invalid")||host.endsWith(".onion")||host.includes(":")||/^\d+(?:\.\d+){0,3}$/.test(host)||!host.includes("."))return json({error:"Enter a public HTTPS product page URL."},400);
  try{
   const page=await fetch(url.toString(),{redirect:"manual",headers:{"accept":"text/html","user-agent":"Mozilla/5.0 (compatible; BuildingSchmidt/1.0)"} ,signal:AbortSignal.timeout(8000)});
   if(page.status>=300&&page.status<400)return json({error:"This website redirects its product page. Open the final URL and try again, or paste the product description."},422);
   if(!page.ok)return json({error:"Website could not be read (HTTP "+page.status+"). Paste its product description instead."},422);
   if(!(page.headers.get("content-type")||"").toLowerCase().includes("text/html"))return json({error:"URL must point to an HTML product page."},422);
   // Large storefront pages often embed megabytes of scripts and tracking data.
   // Read at most 1.5 MB, then extract only product-oriented snippets.
   const reader=page.body?.getReader();if(!reader)return json({error:"No page content returned."},422);
   const MAX_BYTES=1500000;let bytes=0;const chunks=[];
   try{
    while(bytes<MAX_BYTES){
     const part=await reader.read();
     if(part.done)break;
     const amount=Math.min(part.value.byteLength,MAX_BYTES-bytes);
     chunks.push(part.value.subarray(0,amount));bytes+=amount;
     if(amount<part.value.byteLength||bytes>=MAX_BYTES){await reader.cancel();break}
    }
   }finally{reader.releaseLock()}
   const html=new TextDecoder().decode(Uint8Array.from(chunks.flatMap(chunk=>Array.from(chunk))));
   const decode=str=>str.replace(/&(?:nbsp|amp|quot|lt|gt|#39|#x27);/gi,match=>({"&nbsp;":" ","&amp;":"&","&quot;":'"',"&lt;":"<","&gt;":">","&#39;":"'","&#x27;":"'"}[match.toLowerCase()]||" ")).replace(/\s+/g," ").trim();
   const strip=str=>decode(str.replace(/<[^>]*>/g," "));
   const imageCandidates=[];
   const chooseImage=raw=>{
    if(typeof raw!=="string"||!raw.trim())return;
    try{const absolute=new URL(decode(raw.trim()),url).toString();const safe=safePublicImageUrl(absolute);if(safe)imageCandidates.push(safe)}catch{/* ignore invalid image metadata */}
   };
   // First choice: the product's image in Open Graph / Twitter / itemprop metadata.
   for(const meta of html.matchAll(/<meta\b[^>]*>/gi)){
    const tag=meta[0],name=tag.match(/(?:name|property|itemprop)\s*=\s*["']([^"']+)["']/i)?.[1]||"";
    if(!/^(?:og:image(?::secure_url|:url)?|twitter:image(?::src)?|image)$/i.test(name))continue;
    const content=tag.match(/content\s*=\s*["']([^"']+)["']/i)?.[1]||"";
    chooseImage(content);
   }
   const pieces=[];
   const title=html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
   if(title)pieces.push("Page title: "+strip(title).slice(0,400));
   // Common Open Graph, Twitter and ordinary page descriptions, regardless of retailer.
   for(const tag of html.matchAll(/<meta\b[^>]*>/gi)){
    const element=tag[0],name=element.match(/(?:name|property|itemprop)\s*=\s*["']([^"']+)["']/i)?.[1]||"";
    if(!/^(?:description|og:title|og:description|twitter:title|twitter:description|name|brand|sku|mpn|product:price:amount)$/i.test(name))continue;
    const content=element.match(/content\s*=\s*["']([^"']+)["']/i)?.[1]||"";
    if(content)pieces.push(name+": "+decode(content).slice(0,700));
   }
   // Many stores publish Product JSON-LD. Extract structured values without needing
   // retailer-specific selectors or passing script contents directly to the model.
   for(const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
    if(match[1].length>150000)continue;
    let parsed;try{parsed=JSON.parse(match[1].trim())}catch{continue}
    const visit=(value,depth=0)=>{
     if(depth>5||!value||typeof value!=="object")return;
     if(Array.isArray(value)){for(const item of value.slice(0,50))visit(item,depth+1);return}
     const type=String(value["@type"]||"").toLowerCase();
     if(type.includes("product")){
      const images=Array.isArray(value.image)?value.image:[value.image];
      for(const candidate of images.slice(0,5))chooseImage(typeof candidate==="string"?candidate:candidate?.url||candidate?.contentUrl||"");
      for(const key of ["name","description","sku","mpn","gtin","gtin13","gtin12","color","material","size","category"]){
       if(typeof value[key]==="string"&&value[key])pieces.push("Product "+key+": "+decode(value[key]).slice(0,900));
      }
      const brand=value.brand;if(brand)pieces.push("Brand: "+decode(typeof brand==="string"?brand:String(brand.name||"")).slice(0,250));
      const offers=Array.isArray(value.offers)?value.offers[0]:value.offers;
      if(offers&&typeof offers==="object"){
       if(offers.price)pieces.push("Listed price: "+String(offers.price).slice(0,100));
       if(offers.priceCurrency)pieces.push("Currency: "+String(offers.priceCurrency).slice(0,20));
      }
      const properties=Array.isArray(value.additionalProperty)?value.additionalProperty:[];
      for(const property of properties.slice(0,30))if(property?.name&&property?.value)pieces.push("Specification: "+String(property.name).slice(0,100)+" = "+String(property.value).slice(0,250));
     }
     if(value["@graph"])visit(value["@graph"],depth+1);
     if(value.mainEntity)visit(value.mainEntity,depth+1);
     if(value.itemListElement)visit(value.itemListElement,depth+1);
     if(value.item)visit(value.item,depth+1);
    };
    visit(parsed);
    if(pieces.join("\n").length>8000)break;
   }
   // Generic catalog selectors, not Amazon-specific. Keep only visible-looking snippets.
   for(const match of html.matchAll(/<(?:h1|h2|p|li|div|span|section)[^>]*(?:id|class|itemprop)=["'][^"']*(?:product-title|product-name|product-description|product-details|product-info|product-spec|specification|description|feature-bullet|productTitle|feature-bullets|productDescription|detailBullets|productOverview)[^"']*["'][^>]*>([\s\S]{0,9000}?)<\/(?:h1|h2|p|li|div|span|section)>/gi)){
    const value=strip(match[1]);if(value.length>16)pieces.push("Product detail: "+value.slice(0,1100));
    if(pieces.join("\n").length>9000)break;
   }
   // Last-resort visible text for sites that don't provide structured metadata.
   if(pieces.join(" ").length<150){
    const visible=strip(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ").replace(/<(?:nav|footer|header)\b[^>]*>[\s\S]*?<\/(?:nav|footer|header)>/gi," "));
    if(visible.length>70)pieces.push("Page text: "+visible.slice(0,2100));
   }
   const extracted=[...new Set(pieces)].join("\n");
   imageUrl=imageCandidates[0]||null;
   if(extracted.length<60)return json({error:"Product details were not available in the readable portion of this page. The store may limit automated access; paste the product title and specifications instead."},422);
   description=("Source: "+url.hostname+" "+url.pathname+"\n"+extracted).slice(0,3000);
  }catch(e){return json({error:"Could not retrieve that website. It may block automated access. Paste the product description instead."},422)}
 }
 if(description.length<15||description.length>3000)return json({error:"Paste a product description (15–3000 characters) or a public HTTPS product URL."},400);
 // Conservative site-side request allowance, independent of OpenAI billing limits.
 // R2 read/modify/write is not atomic: concurrent requests can exceed this allowance.
 if(!env.PHOTOS)return json({error:"Storage not configured"},503);
 const month=new Date().toISOString().slice(0,7),usageKey="limits/ai-extractions-"+month+".json";
 const usageObject=await env.PHOTOS.get(usageKey);
 const usage=usageObject?JSON.parse(await usageObject.text()):{count:0};
 if(usage.count>=100)return json({error:"Monthly AI extraction allowance reached (100 requests)."},429);
 // Reserve before calling OpenAI; failed requests still consume an allowance.
 await env.PHOTOS.put(usageKey,JSON.stringify({count:usage.count+1,updatedAt:new Date().toISOString()}));
 const schema={type:"object",additionalProperties:false,required:["name","manufacturer","model","supplier","asin","category","specifications"],properties:{name:{type:"string"},manufacturer:{type:"string"},model:{type:"string"},supplier:{type:"string"},asin:{type:"string"},category:{type:"string"},specifications:{type:"array",items:{type:"object",additionalProperties:false,required:["name","value","source"],properties:{name:{type:"string"},value:{type:"string"},source:{type:"string",enum:["explicit","inferred"]}}}}}};
 const response=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{"authorization":"Bearer "+env.OPENAI_API_KEY,"content-type":"application/json"},body:JSON.stringify({model:"gpt-4o-mini",temperature:0,max_tokens:700,messages:[{role:"system",content:"Extract technical component information from a product description. Return concise, accurate fields. Do not invent missing specifications. Empty string for missing scalar fields. Only mark inferred when a detail is reasonably inferred; omit speculative values. ASIN only if explicitly present. Manufacturer and model must not be guessed. Use the source domain to identify the retailer when available; do not assume Amazon. Prefer the product manufacturer over the retailer for manufacturer. Never invent specifications."},{role:"user",content:description}],response_format:{type:"json_schema",json_schema:{name:"component",strict:true,schema}}})});
 const result=await response.json().catch(()=>({}));if(!response.ok)return json({error:"AI extraction failed: "+(result.error?.message||"Provider error"),providerStatus:response.status},502);
 try{return json({component:JSON.parse(result.choices[0].message.content),imageUrl})}catch{return json({error:"Invalid AI response"},502)}
}
