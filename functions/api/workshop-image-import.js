// Import a user-approved product image from a recognized manufacturer/distributor host.
// The image is never published until the user saves the Workshop reference.
import {accountUser} from "./accounts.js";
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json","cache-control":"no-store","x-content-type-options":"nosniff"}});
const accepted=["digikey.com","mouser.com","onsemi.com","nexperia.com","ti.com","st.com","st.com.cn","infineon.com","vishay.com","analog.com","microchip.com","sparkfun.com","adafruit.com","pololu.com","arduino.cc","rs-online.com","farnell.com","newark.com","arrow.com","jameco.com","mcmaster.com"];
const hostAllowed=host=>accepted.some(domain=>host===domain||host.endsWith("."+domain));
export async function onRequest({request,env}){
 if(request.method!=="POST")return json({error:"Method not allowed"},405);
 if(!env.PHOTOS)return json({error:"Workshop storage unavailable"},503);
 const user=await accountUser(request,env);
 if(!user)return json({error:"Sign in to import a Workshop photo"},401);
 const origin=new URL(request.url).origin;
 if(request.headers.get("origin")!==origin)return json({error:"Invalid origin"},403);
 const body=await request.json().catch(()=>null);
 let image;
 try{image=new URL(body?.url)}catch{return json({error:"Invalid image URL"},400)}
 if(image.protocol!=="https:"||image.username||image.password||!hostAllowed(image.hostname))
  return json({error:"This picture host is not approved for direct import. Upload the photo manually instead."},400);
 try{
  const response=await fetch(image.href,{redirect:"manual",headers:{"accept":"image/jpeg,image/png,image/webp"}});
  if(!response.ok)return json({error:"Unable to retrieve the suggested image. You can upload a photo manually."},422);
  const type=(response.headers.get("content-type")||"").split(";")[0].trim().toLowerCase();
  if(!["image/jpeg","image/png","image/webp"].includes(type))
   return json({error:"Suggested file is not a supported image"},422);
  if(Number(response.headers.get("content-length")||0)>5*1024*1024)return json({error:"Suggested image exceeds 5 MB"},413);
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(bytes.length<32||bytes.length>5*1024*1024)return json({error:"Suggested image size is invalid"},413);
  const jpg=bytes[0]===255&&bytes[1]===216;
  const png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71;
  const webp=String.fromCharCode(...bytes.slice(0,4))==="RIFF"&&String.fromCharCode(...bytes.slice(8,12))==="WEBP";
  if(!(type==="image/jpeg"&&jpg||type==="image/png"&&png||type==="image/webp"&&webp))
   return json({error:"Suggested image format failed validation"},422);
  const id=crypto.randomUUID();
  await env.PHOTOS.put("workshop-reference-photos/"+id,bytes,{
   httpMetadata:{contentType:type},customMetadata:{ownerId:user.id,sourceUrl:image.href.slice(0,900)}
  });
  return json({photo:{id,caption:"Product photo — verify against manufacturer"}},201);
 }catch(error){
  console.error("Workshop image import failed",String(error));
  return json({error:"Could not import this image. Upload a photo manually instead."},502);
 }
}
