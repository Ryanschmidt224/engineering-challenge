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
 if(env.AI){
  try{
   const binary=Array.from(bytes,byte=>String.fromCharCode(byte)).join("");
   const encoded=btoa(binary);
   const prompt="Identify the primary electronics tool, equipment or component pictured. Reply ONLY with a compact JSON object having string keys name, category, kind, manufacturer, model, partNumber, notes. Use kind tool, equipment, material, component or other. If text/identification is uncertain, omit the field rather than guess. Do not claim exact specifications unless legible.";
   const result=await env.AI.run("@cf/meta/llama-3.2-11b-vision-instruct",{prompt,image:"data:"+file.type+";base64,"+encoded,max_tokens:350});
   const raw=String(result?.response||result?.result||"");
   const parsed=JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0]||"null");
   if(parsed&&typeof parsed==="object"){
    suggestion={};for(const prop of ["name","category","kind","manufacturer","model","partNumber","notes"])
     if(typeof parsed[prop]==="string")suggestion[prop]=parsed[prop].slice(0,240);
   }else recognitionError="Image was saved but no usable identification was returned.";
  }catch(error){recognitionError="Image saved; automatic recognition was unavailable. Enter or correct the details manually.";}
 }else recognitionError="Image saved. Automatic recognition requires an AI binding configured by the website owner.";
 return json({photoId:id,suggestion,recognitionError});
}
