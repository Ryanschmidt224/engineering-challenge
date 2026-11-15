// AI-assisted Workshop product lookup. This endpoint creates a draft only.
import {accountUser} from "./accounts.js";
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json","cache-control":"no-store","x-content-type-options":"nosniff"}});
const text=(v,n=200)=>typeof v==="string"?v.trim().slice(0,n):"";
const validUrl=v=>{try{const u=new URL(v);return u.protocol==="https:"&&!u.username&&!u.password&&!u.hostname.endsWith(".local")&&u.hostname!=="localhost"&&!/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)&&!u.hostname.includes(":")?u.href:""}catch{return ""}};
const categories=new Set(["tools","consumables","electronics","hardware","safety"]);
const kinds=new Set(["tool","equipment","component","material","other"]);
export async function onRequest({request,env}){
 if(request.method!=="POST")return json({error:"Method not allowed"},405);
 if(!env.OPENAI_API_KEY)return json({error:"AI lookup is not configured. Set OPENAI_API_KEY for this website."},503);
 const user=await accountUser(request,env);
 if(!user)return json({error:"Sign in to use AI part lookup"},401);
 const url=new URL(request.url);
 if(request.headers.get("origin")!==url.origin)return json({error:"Invalid request origin"},403);
 const body=await request.json().catch(()=>null);
 const mpn=text(body?.partNumber,80);
 if(!/^[A-Za-z0-9][A-Za-z0-9._+ #()/\-]{1,79}$/.test(mpn))return json({error:"Enter a valid manufacturer part number (2–80 characters)."},400);
 // Limit paid lookups per signed-in account. A failure does not count against the daily limit.
 if(!env.PHOTOS)return json({error:"Workshop storage unavailable"},503);
 const date=new Date().toISOString().slice(0,10),key="workshop-ai-lookup/"+user.id+"/"+date;
 const usage=await env.PHOTOS.get(key);
 const count=Number(usage?await usage.text():0)||0;
 if(count>=15)return json({error:"Daily AI lookup limit reached (15). Try again tomorrow."},429);
 const prompt=[
  "Identify the product with part number "+JSON.stringify(mpn)+" and suggest practical details for a beginner-friendly Workshop inventory.",
  "Provide a useful component overview: main specifications, typical uses, and basic pinout where relevant.",
  "Prefer manufacturer specifications where readily available. Sources are optional; never fabricate links.",
  "Important: a generic number (e.g. 2N7000) may be sold by multiple manufacturers in different packages.",
  "Where ratings vary by manufacturer or package, use a useful representative value when reasonable, and note differences in caution.",
  "Suggest pinouts only when reasonably confident; include package and viewing orientation when known.",
  "Include voltage/current limits, Rds(on), threshold, power dissipation, temperature, switching behavior and package only where supported.",
  "Include test conditions when readily available, without requiring extensive verification.",
  "Provide a practical 2-4 sentence summary and a concise feature tree description (<=20 characters).",
  "Return ONLY valid JSON, without fences or commentary, with string keys:",
  "partNumber, manufacturer, name, subtitle, featureTreeDescription, kind, category, familyName, typeName,",
  "spec, use, caution, supplier, supplierUrl, documentationUrl, notes, package, pinoutOrientation;",
  "an array specs of objects {name,value,unit,conditions}, array pins of objects {number,name,function},",
  "an array applications of short strings, and optional sources as an array of up to 6 HTTPS URLs.",
  "For specs, return unit separately from the value when possible (e.g. value 60, unit V). Omit unsupported values.",
  "For pins, use strings and include package/face/orientation in pinoutOrientation.",
  "For applications, include 3-6 typical verified practical uses. 'spec' is a fallback human-readable summary; 'use' is a summary of applications.",
  "kind: tool/equipment/component/material/other; category: tools/consumables/electronics/hardware/safety.",
  "Use best-effort descriptions, mark important uncertainty briefly, and keep optional details empty when unknown.",
  "Use the requested partNumber exactly if confirmed and no substitute is intended."
 ].join("\n");
 try{
  const response=await fetch("https://api.openai.com/v1/responses",{
   method:"POST",headers:{"authorization":"Bearer "+env.OPENAI_API_KEY,"content-type":"application/json"},
   body:JSON.stringify({model:"gpt-5.4",reasoning:{effort:"low"},max_output_tokens:3600,
    tools:[{type:"web_search",search_context_size:"medium",search_content_types:["text","image"],image_settings:{max_results:4,caption:true}}],
    tool_choice:"required",include:["web_search_call.results"],input:prompt})
  });
  const payload=await response.json().catch(()=>({}));
  if(!response.ok){
   console.error("Workshop lookup model error",response.status,JSON.stringify(payload.error||{}).slice(0,300));
   return json({error:"Product lookup is unavailable. Verify the AI service configuration and try again."},502);
  }
  const raw=(payload.output||[]).filter(v=>v.type==="message").flatMap(v=>v.content||[]).filter(v=>v.type==="output_text").map(v=>v.text).join("\n");
  const stripped=raw.replace(/^\s*```(?:json)?\s*/i,"").replace(/\s*```\s*$/,"").trim();
  let data;
  try{data=JSON.parse(stripped)}catch{return json({error:"The lookup did not return usable product details. Try again or enter the item manually."},502)}
  if(!data||typeof data!=="object"||Array.isArray(data))return json({error:"Product lookup returned invalid details"},502);
  const sources=(Array.isArray(data.sources)?data.sources:[]).map(validUrl).filter(Boolean).slice(0,6);
  const research={
   package:text(data.package,120),pinoutOrientation:text(data.pinoutOrientation,240),
   specs:(Array.isArray(data.specs)?data.specs:[]).slice(0,24).map(row=>({
    name:text(row?.name,100),value:text(row?.value,180),unit:text(row?.unit,32),
    conditions:text(row?.conditions,240),sourceUrl:validUrl(row?.sourceUrl)
   })).filter(row=>row.name&&row.value),
   pins:(Array.isArray(data.pins)?data.pins:[]).slice(0,32).map(pin=>({
    number:text(pin?.number,24),name:text(pin?.name,80),function:text(pin?.function,240)
   })).filter(pin=>pin.number&&pin.name),
   applications:(Array.isArray(data.applications)?data.applications:[]).slice(0,10).map(x=>text(x,200)).filter(Boolean)
  };
  const engineeringSpecs=research.specs.map(row=>row.name+": "+row.value+(row.unit?" "+row.unit:"")+(row.conditions?" ("+row.conditions+")":"")).join("\n");
  const pinout=research.pins.length?("Pinout — "+[research.package,research.pinoutOrientation].filter(Boolean).join(", ")+":\n"+
   research.pins.map(pin=>"Pin "+pin.number+": "+pin.name+(pin.function?" — "+pin.function:"")).join("\n")):"";
  const applications=research.applications.map(x=>"• "+x).join("\n");
  const draft={
   partNumber:text(data.partNumber,160)||mpn,
   manufacturer:text(data.manufacturer,160),name:text(data.name,180),
   subtitle:text(data.subtitle,240),
   featureTreeDescription:text(data.featureTreeDescription,20),
   kind:kinds.has(data.kind)?data.kind:"component",
   category:categories.has(data.category)?data.category:"electronics",
   familyName:text(data.familyName,120),typeName:text(data.typeName,120),
   spec:(engineeringSpecs||text(data.spec,5000)).slice(0,5000),use:(applications||text(data.use,3000)).slice(0,3000),
   caution:text(data.caution,3000),supplier:text(data.supplier,160),
   supplierUrl:validUrl(data.supplierUrl),documentationUrl:validUrl(data.documentationUrl),
   notes:([pinout,text(data.notes,2400),sources.length?"Research sources (verify against manufacturer datasheet):\n"+sources.join("\n"):""].filter(Boolean).join("\n\n")).slice(0,5000)
  };
  // A generated answer is not a verified identity: require an exact part-number match.
  const normalize=v=>String(v||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
  if(normalize(draft.partNumber)!==normalize(mpn))return json({error:"The lookup returned a different part number. No fields were populated."},422);
  // Image search is a candidate, never authoritative. Require a visible part-number
  // match in its caption or source page and have the user review the picture.
  const images=(payload.output||[]).filter(v=>v.type==="web_search_call").flatMap(v=>v.results||[]).filter(v=>v.type==="image_result");
  const candidate=images.find(img=>{
   const page=validUrl(img.source_website_url),image=validUrl(img.image_url);
   return page&&image&&normalize((img.caption||"")+" "+page.split("?")[0]).includes(normalize(mpn));
  });
  const imageSuggestion=candidate?{url:validUrl(candidate.image_url),sourceUrl:validUrl(candidate.source_website_url),caption:text(candidate.caption,180)}:null;
  await env.PHOTOS.put(key,String(count+1));
  return json({draft,research,sources,imageSuggestion,needsReview:true,
   note:"AI-generated draft. Check the ratings and package before saving."});
 }catch(error){
  console.error("Workshop lookup failed",String(error));
  return json({error:"Product lookup failed. Try again or enter the details manually."},502);
 }
}
