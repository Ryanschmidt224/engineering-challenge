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
  "Search the web to identify the EXACT manufacturer product with part number "+JSON.stringify(mpn)+".",
  "Prefer manufacturer datasheets and manufacturer product pages; use reputable authorized distributors second.",
  "Do not confuse equivalent components, variants, package suffixes or supplier SKUs with the requested MPN.",
  "Return ONLY one valid JSON object, no markdown, with these string keys:",
  "partNumber, manufacturer, name, subtitle, featureTreeDescription, kind, category, familyName, typeName,",
  "spec, use, caution, supplier, supplierUrl, documentationUrl, notes, and sources (array of HTTPS URLs).",
  "name should be a descriptive product name; subtitle a concise description; featureTreeDescription at most 20 characters.",
  "spec should contain important verified specs with units and conditions, separated by newlines.",
  "kind must be one of tool/equipment/component/material/other; category one of tools/consumables/electronics/hardware/safety.",
  "Do not fabricate specs, images, exact vendor availability or prices; leave unknown details as empty strings.",
  "If MPN is ambiguous among manufacturers or insufficiently supported, set manufacturer empty and explain in notes.",
  "Return at most 4 source URLs, preferably exact MPN pages. No JSON fields outside those named."
 ].join("\n");
 try{
  const response=await fetch("https://api.openai.com/v1/responses",{
   method:"POST",headers:{"authorization":"Bearer "+env.OPENAI_API_KEY,"content-type":"application/json"},
   body:JSON.stringify({model:"gpt-5.4",reasoning:{effort:"low"},max_output_tokens:1800,
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
  const sources=(Array.isArray(data.sources)?data.sources:[]).map(validUrl).filter(Boolean).slice(0,4);
  const draft={
   partNumber:text(data.partNumber,160)||mpn,
   manufacturer:text(data.manufacturer,160),name:text(data.name,180),
   subtitle:text(data.subtitle,240),
   featureTreeDescription:text(data.featureTreeDescription,20),
   kind:kinds.has(data.kind)?data.kind:"component",
   category:categories.has(data.category)?data.category:"electronics",
   familyName:text(data.familyName,120),typeName:text(data.typeName,120),
   spec:text(data.spec,5000),use:text(data.use,3000),
   caution:text(data.caution,3000),supplier:text(data.supplier,160),
   supplierUrl:validUrl(data.supplierUrl),documentationUrl:validUrl(data.documentationUrl),
   notes:text(data.notes,5000)
  };
  // A generated answer is not a verified identity: require an exact part-number match.
  const normalize=v=>String(v||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
  if(normalize(draft.partNumber)!==normalize(mpn))return json({error:"The lookup returned a different part number. No fields were populated."},422);
  // Image search is a candidate, never authoritative. Require a visible part-number
  // match in its caption or source page and have the user review the picture.
  const images=(payload.output||[]).filter(v=>v.type==="web_search_call").flatMap(v=>v.results||[]).filter(v=>v.type==="image_result");
  const candidate=images.find(img=>{
   const page=validUrl(img.source_website_url),image=validUrl(img.image_url);
   return page&&image&&normalize((img.caption||"")+" "+decodeURIComponent(page.split("?")[0])).includes(normalize(mpn));
  });
  const imageSuggestion=candidate?{url:validUrl(candidate.image_url),sourceUrl:validUrl(candidate.source_website_url),caption:text(candidate.caption,180)}:null;
  await env.PHOTOS.put(key,String(count+1));
  return json({draft,sources,imageSuggestion,needsReview:true,
   note:"AI-generated draft. Confirm the exact manufacturer, package, ratings, sources and photo before saving."});
 }catch(error){
  console.error("Workshop lookup failed",String(error));
  return json({error:"Product lookup failed. Try again or enter the details manually."},502);
 }
}
