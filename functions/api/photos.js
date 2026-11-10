import {projectAllowed,canEditProject,VALID_PROJECT_ID} from "./projects.js";
import {isAdmin} from "./auth.js";
const TYPES={"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/gif":"gif","image/heic":"heic","image/heif":"heif"};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const authorized=async(request,env)=>{const u=new URL(request.url);let project=u.searchParams.get("project")||request.headers.get("x-photo-project");if(!project&&request.method==="DELETE")project=(u.searchParams.get("id")||"").split("/")[0];return project?canEditProject(request,env,project):false};
// Legacy work-instruction photos were uploaded to the same root gallery path.
// Exclude photos referenced by saved recipes without moving or deleting any R2 objects.
async function recipePhotoReferences(bucket,project){
 const used=new Set();
 const keys=[];
 for(const prefix of ["workspaces/"+project+"/","part-workspaces/"+project+"/"]){
  let cursor;
  do{
   const page=await bucket.list({prefix,limit:500,cursor});
   keys.push(...page.objects.filter(o=>o.key.endsWith(".json")).map(o=>o.key));
   if(keys.length>2500)throw Error("Workspace photo-reference scan limit exceeded");
   if(!page.truncated)break;
   if(!page.cursor||page.cursor===cursor)throw Error("Incomplete workspace listing");
   cursor=page.cursor;
  }while(true);
 }
 for(let i=0;i<keys.length;i+=20){
  const batch=await Promise.all(keys.slice(i,i+20).map(async key=>{
   const object=await bucket.get(key);
   return object?JSON.parse(await object.text()):null;
  }));
  for(const workspace of batch){
   if(!workspace)continue;
   const versions=[workspace,...(Array.isArray(workspace.history)?workspace.history:[])];
   // Include revision history so older recipe images cannot reappear in the gallery.
   for(const version of versions){
    for(const step of Array.isArray(version?.recipe)?version.recipe:[]){
     for(const id of Array.isArray(step?.photos)?step.photos:[])
      if(typeof id==="string"&&id.startsWith(project+"/"))used.add(id);
    }
   }
  }
 }
 return used;
}
export async function onRequestGet({request,env}){
 if(!env.PHOTOS)return json({error:"Photo storage isn't configured."},503);
 const u=new URL(request.url),project=u.searchParams.get("project");
 if(!await projectAllowed(env,project,request))return json({error:"Unknown project"},400);
 const assembly=u.searchParams.get("assembly");
 const objects=await env.PHOTOS.list({prefix:project+"/",limit:500,include:["customMetadata"]});
 // Assembly-specific photos already have their own assembly ID and are unaffected.
 let used=new Set();
 if(assembly===null){
  try{used=await recipePhotoReferences(env.PHOTOS,project)}
  catch(error){console.error("Could not separate legacy step photos",error);return json({error:"Photo gallery is temporarily unavailable."},503)}
 }
 return json({photos:objects.objects.filter(o=>(assembly===null?!o.customMetadata?.assemblyId:o.customMetadata?.assemblyId===assembly)&&!used.has(o.key)).map(o=>({
  id:o.key,assembly:o.customMetadata?.assemblyId||"",caption:o.customMetadata?.caption||"",
  name:o.customMetadata?.name||"Photo",uploaded:o.uploaded.toISOString(),
  url:"/api/photo?id="+encodeURIComponent(o.key)
 })),truncated:objects.truncated});
}
export async function onRequestPost({request,env}){if(!await authorized(request,env))return json({error:"Administrator access required. Check your token."},401);if(!env.PHOTOS)return json({error:"Photo storage isn't configured."},503);const project=request.headers.get("x-photo-project");let caption,name;try{caption=decodeURIComponent(request.headers.get("x-photo-caption")||"").trim().slice(0,240);name=decodeURIComponent(request.headers.get("x-photo-name")||"photo").slice(0,100)}catch(e){return json({error:"Invalid caption or filename"},400)}if(!await projectAllowed(env,project,request))return json({error:"Unknown project"},400);const type=(request.headers.get("content-type")||"").split(";")[0].toLowerCase();if(!TYPES[type])return json({error:"Use JPG, PNG, WebP, GIF, or HEIC."},415);const size=Number(request.headers.get("content-length"));if(size>10*1024*1024)return json({error:"Maximum photo size is 10 MB."},413);const data=await request.arrayBuffer();if(!data.byteLength||data.byteLength>10*1024*1024)return json({error:"Maximum photo size is 10 MB."},413);const assemblyId=request.headers.get("x-photo-assembly")||"";if(assemblyId&&!/^[a-zA-Z0-9-]{1,80}$/.test(assemblyId))return json({error:"Invalid assembly"},400);const key=project+"/"+crypto.randomUUID()+"."+TYPES[type];await env.PHOTOS.put(key,data,{httpMetadata:{contentType:type,cacheControl:"public, max-age=3600"},customMetadata:{caption,name,assemblyId}});return json({ok:true,id:key},201)}
export async function onRequestDelete({request,env}){if(!await authorized(request,env))return json({error:"Administrator access required."},401);if(!env.PHOTOS)return json({error:"Photo storage isn't configured."},503);const key=new URL(request.url).searchParams.get("id")||"";if(!/^(launcher|linear|robot|buck|motorlab|coiltest|p[a-f0-9]{32})\/[0-9a-f-]{36}\.(jpg|png|webp|gif|heic|heif)$/.test(key))return json({error:"Invalid photo"},400);await env.PHOTOS.delete(key);return json({ok:true})}
