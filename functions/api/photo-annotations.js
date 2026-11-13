/* Non-destructive image annotations. Originals remain at their existing R2 keys.
 * A saved WebP rendition and edit instructions are stored under separate prefixes.
 */
import {projectAllowed,canEditProject} from "./projects.js";
const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"private, no-store"}});
const projectPattern="(?:launcher|linear|robot|buck|motorlab|coiltest|p[a-f0-9]{32})";
const galleryPattern=new RegExp("^("+projectPattern+")/[0-9a-f-]{36}\\.(?:jpg|png|webp|gif|heic|heif)$","i");
const recipePattern=new RegExp("^recipe-files/("+projectPattern+")/[0-9a-f-]{36}\\.(?:jpg|jpeg|png|webp|gif|heic|heif)$","i");
const partPattern=/^[0-9a-f-]{36}$/i;
export function resolvePhotoSource(url){
 const kind=url.searchParams.get("kind"),id=url.searchParams.get("id")||"";
 if(kind==="gallery"&&galleryPattern.test(id))return {key:id,project:id.split("/")[0]};
 if(kind==="recipe"&&recipePattern.test(id))return {key:id,project:id.split("/")[1]};
 if(kind==="part"&&partPattern.test(id)){
  const project=url.searchParams.get("project")||"";
  if(new RegExp("^"+projectPattern+"$","i").test(project))
   return {key:"component-thumbnails/"+project+"/"+id,project};
 }
 return null;
}
export const renditionKey=key=>"photo-renders/"+key+".webp";
export const annotationKey=key=>"photo-annotations/"+key+".json";
const number=n=>typeof n==="number"&&Number.isFinite(n)&&n>=0&&n<=1;
const point=p=>Array.isArray(p)&&p.length===2&&p.every(number);
function validState(s){
 if(!s||typeof s!=="object"||!Array.isArray(s.marks)||s.marks.length>200)return false;
 if(s.crop!==null&&s.crop!==undefined&&(!Array.isArray(s.crop)||s.crop.length!==4||!s.crop.every(number)||s.crop[2]<=0||s.crop[3]<=0||s.crop[0]+s.crop[2]>1.001||s.crop[1]+s.crop[3]>1.001))return false;
 return s.marks.every(m=>{
  if(!m||!["pen","highlight","arrow","circle","text"].includes(m.tool))return false;
  if(!/^#[0-9a-f]{6}$/i.test(m.color||"")||!number(m.size)||m.size===0)return false;
  if(m.tool==="pen"||m.tool==="highlight")return Array.isArray(m.points)&&m.points.length>=1&&m.points.length<=1200&&m.points.every(point);
  if(m.tool==="text")return point(m.a)&&typeof m.text==="string"&&m.text.length<=120;
  return point(m.a)&&point(m.b);
 });
}
export async function handlePhotoAnnotations(request,env){
 if(!env.PHOTOS)return json({error:"Photo storage unavailable"},503);
 const target=resolvePhotoSource(new URL(request.url));
 if(!target)return json({error:"Invalid image"},400);
 if(!await projectAllowed(env,target.project,request))return json({error:"Image not found"},404);
 const {key,project}=target;
 if(request.method==="GET"){
  if(!await env.PHOTOS.head(key))return json({error:"Image not found"},404);
  const obj=await env.PHOTOS.get(annotationKey(key));
  if(!obj)return json({state:{crop:null,marks:[]}});
  return json({state:JSON.parse(await obj.text())});
 }
 if(request.method!=="PUT")return json({error:"Method not allowed"},405);
 if(!await canEditProject(request,env,project))return json({error:"Sign in to edit photos"},401);
 if(!await env.PHOTOS.head(key))return json({error:"Original photo not found"},404);
 const declared=Number(request.headers.get("content-length")||0);
 if(declared>9*1024*1024)return json({error:"Edited image is too large"},413);
 const form=await request.formData().catch(()=>null);
 const image=form?.get("image"),raw=form?.get("state");
 if(!(image instanceof File)||image.type!=="image/webp"||!image.size||image.size>8*1024*1024||
   typeof raw!=="string"||raw.length>100000)return json({error:"Invalid edit payload"},422);
 let state;try{state=JSON.parse(raw)}catch{return json({error:"Invalid edit data"},422)}
 if(!validState(state))return json({error:"Invalid annotations"},422);
 const bytes=await image.arrayBuffer();
 if(new TextDecoder().decode(new Uint8Array(bytes).slice(0,4))!=="RIFF"||
    new TextDecoder().decode(new Uint8Array(bytes).slice(8,12))!=="WEBP")return json({error:"Invalid image format"},415);
 // The original is never overwritten. Rendered view and edit instructions are
 // separate objects so the annotations can be changed without quality loss.
 await env.PHOTOS.put(annotationKey(key),JSON.stringify(state),{httpMetadata:{contentType:"application/json"}});
 await env.PHOTOS.put(renditionKey(key),bytes,{httpMetadata:{contentType:"image/webp",cacheControl:"private, no-store"}});
 return json({ok:true});
}
