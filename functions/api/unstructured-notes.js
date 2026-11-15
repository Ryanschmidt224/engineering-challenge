// Per-page free-form notes. Existing gallery photo storage/markup is reused.
// Notes never become BOM entries or change the project's feature tree.
import {projectAllowed,canEditProject} from "./projects.js";
const json=(value,status=200)=>new Response(JSON.stringify(value),{
 status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}
});
const validProject=value=>/^(launcher|linear|robot|p[a-f0-9]{32})$/.test(value||"");
const validId=value=>/^(root|[0-9a-f-]{36})$/i.test(value||"");
const validNoteId=value=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value||"");
const validScope=new Set(["summary","workspace","bom","part","parts"]);
const key=(project,scope,id)=>"unstructured-notes/"+project+"/"+scope+"/"+id+".json";
const validPhotos=(photos,project)=>Array.isArray(photos)&&photos.length<=12&&photos.every(id=>
 typeof id==="string"&&new RegExp("^"+project+"/[0-9a-f-]{36}\\.(jpg|png|webp|gif|heic|heif)$","i").test(id));
export async function onRequest({request,env}){
 const url=new URL(request.url),project=url.searchParams.get("project");
 const scope=url.searchParams.get("scope"),id=url.searchParams.get("id")||"root";
 if(!validProject(project)||!validScope.has(scope)||!validId(id))return json({error:"Invalid notes page"},400);
 if(scope==="summary"||scope==="parts"){if(id!=="root")return json({error:"Invalid page ID"},400)}
 else if(scope==="part"&&id==="root")return json({error:"Select a part"},400);
 if(!await projectAllowed(env,project,request))return json({error:"Project unavailable"},403);
 if(!env.PHOTOS)return json({error:"Notes storage unavailable"},503);
 const path=key(project,scope,id);
 const original=await env.PHOTOS.get(path);
 let records=[];
 if(original){
  try{
   const saved=JSON.parse(await original.text());
   if(!Array.isArray(saved.notes))throw Error("Invalid note data");
   records=saved.notes;
  }catch{return json({error:"Saved notes could not be read; no changes were made"},503)}
 }
 if(request.method==="GET")return json({notes:records,revision:original?.etag||null,
  canEdit:await canEditProject(request,env,project)});
 if(request.method!=="PUT")return json({error:"Method not allowed"},405);
 if(request.headers.get("origin")!==url.origin)return json({error:"Invalid origin"},403);
 if(!await canEditProject(request,env,project))return json({error:"Project owner access required"},403);
 const body=await request.json().catch(()=>null);
 if(!body||!Array.isArray(body.notes)||body.notes.length>200)return json({error:"Invalid notes list"},400);
 if((body.expectedRevision||null)!==(original?.etag||null))return json({error:"Notes changed in another tab. Refresh before saving."},409);
 const seen=new Set(),previous=new Map(records.map(n=>[n.id,n]));
 const next=[];
 for(const item of body.notes){
  if(!validNoteId(item?.id)||seen.has(item.id)||typeof item.title!=="string"||
   typeof item.description!=="string"||item.title.trim().length>180||
   !item.title.trim()||item.description.length>12000||!validPhotos(item.photos||[],project))
   return json({error:"Enter a note title, a description under 12,000 characters and up to 12 photos"},400);
  seen.add(item.id);
  const old=previous.get(item.id);
  // The photo API stores the original file in R2 and supports cropping/markups.
  // Verify that each referenced image belongs to this specific note, not
  // another user-owned photo or a different page.
  const photos=[...new Set(item.photos||[])];
  for(const photo of photos){
   const existing=await env.PHOTOS.head(photo);
   if(!existing||existing.customMetadata?.assemblyId!=="note-"+item.id)
    return json({error:"A note photo is missing or belongs to another note"},400);
  }
  next.push({id:item.id,title:item.title.trim(),description:item.description.trim(),
   photos,createdAt:old?.createdAt||new Date().toISOString(),
   updatedAt:new Date().toISOString()});
 }
 const options=original?.etag?{onlyIf:{etagMatches:original.etag}}:{onlyIf:{etagDoesNotMatch:"*"}};
 const saved=await env.PHOTOS.put(path,JSON.stringify({notes:next}),options);
 if(!saved)return json({error:"Notes changed in another tab. Refresh before saving."},409);
 return json({notes:next,revision:saved.etag});
}
