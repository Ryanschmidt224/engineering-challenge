// Private Workshop photo storage and optional AI-assisted equipment recognition.
// Recognition results are drafts; the user must confirm before an inventory item is created.
import {accountUser} from "./accounts.js";
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json","cache-control":"no-store","x-content-type-options":"nosniff"}});
const key=(uid,id)=>"user-workshop/"+uid+"/photos/"+id;
const allowed=new Set(["image/jpeg","image/png","image/webp"]);
export async function onRequest({request,env}){
 const user=await accountUser(request,env);
 if(!user)return json({error:"Sign in to use personal Workshop photos"},401);
 if(!env.PHOTOS)return json({error:"Storage unavailable"},503);
 const url=new URL(request.url);
 if(request.method==="GET"){
  const id=url.searchParams.get("id");
  if(!/^[0-9a-f-]{36}$/.test(id||""))return json({error:"Invalid photo"},400);
  const obj=await env.PHOTOS.get(key(user.id,id));
  if(!obj)return json({error:"Photo not found"},404);
  return new Response(obj.body,{headers:{"content-type":obj.httpMetadata?.contentType||"image/jpeg","cache-control":"private, no-store","x-content-type-options":"nosniff"}});
 }
 if(request.method!=="POST")return json({error:"Method not allowed"},405);
 if(request.headers.get("origin")!==url.origin)return json({error:"Invalid origin"},403);
 const form=await request.formData().catch(()=>null),file=form?.get("photo");
 if(!file||typeof file.arrayBuffer!=="function"||!allowed.has(file.type)||file.size<1||file.size>4*1024*1024)
  return json({error:"Choose a JPEG, PNG, or WebP image smaller than 4 MB"},400);
 const bytes=new Uint8Array(await file.arrayBuffer());
 const id=crypto.randomUUID();
 await env.PHOTOS.put(key(user.id,id),bytes,{httpMetadata:{contentType:file.type}});
 let suggestion=null,recognitionError=null;
 if(env.OPENAI_API_KEY){
  try{
   // Reuse the site's existing server-side extraction key; never expose it to the browser.
   // Data URL is sent only to the configured image recognition service.
   const binary=Array.from(bytes,byte=>String.fromCharCode(byte)).join("");
   const encoded=btoa(binary);
   const response=await fetch("https://api.openai.com/v1/chat/completions",{
    method:"POST",headers:{"authorization":"Bearer "+env.OPENAI_API_KEY,"content-type":"application/json"},
    signal:AbortSignal.timeout(20000),
    body:JSON.stringify({model:"gpt-4o-mini",max_tokens:500,temperature:0,
     messages:[
      {role:"system",content:"Identify equipment from photos and return ONLY a JSON object with strings name, category, kind, manufacturer, model, partNumber, notes, and specifications as an array of objects with name and value strings. Use kind tool, equipment, material, component or other. Be conservative. Never invent manufacturer, model, part number or ratings. If text is not legible use empty strings; if you cannot identify the object call it Unidentified equipment."},
      {role:"user",content:[{type:"text",text:"Identify this electronics workshop equipment or component for an editable inventory draft."},
       {type:"image_url",image_url:{url:"data:"+file.type+";base64,"+encoded,detail:"low"}}]}
     ],response_format:{type:"json_object"}})
   });
   const payload=await response.json();
   if(!response.ok)throw Error("Recognition provider unavailable");
   const parsed=JSON.parse(payload.choices?.[0]?.message?.content||"null");
   if(parsed&&typeof parsed==="object"){
    suggestion={};if(Array.isArray(parsed.specifications))
     suggestion.specifications=parsed.specifications.slice(0,20).filter(x=>typeof x?.name==="string"&&typeof x?.value==="string").map(x=>({name:x.name.slice(0,80),value:x.value.slice(0,240)}));
    for(const prop of ["name","category","kind","manufacturer","model","partNumber","notes"])
     if(typeof parsed[prop]==="string")suggestion[prop]=parsed[prop].slice(0,240);
   }else recognitionError="Photo saved, but no reliable identification returned. Enter details manually.";
  }catch(error){recognitionError="Photo saved; automatic identification was unavailable. Enter or correct details manually.";}
 }else recognitionError="Photo saved. AI recognition requires the website's OPENAI_API_KEY setting.";

 return json({photoId:id,suggestion,recognitionError});
}
