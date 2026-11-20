import {projectAllowed,canEditProject,VALID_PROJECT_ID} from "./projects.js";
import {isAdmin} from "./auth.js";

import "../../assets/attachment-types.js";
const {types: TYPES, accepts, isImage: imageExtension} = globalThis.BSAttachmentTypes;
const MAX_BYTES=20*1024*1024;
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const pattern=/^recipe-files\/(launcher|linear|robot|buck|motorlab|coiltest|p[a-f0-9]{32})\/([a-f0-9-]{36})\.([a-z0-9_]{1,12})$/;
export function isProjectRecipeFile(id,project){
 const match=typeof id==="string"?id.match(pattern):null;
 return !!match&&match[1]===project&&accepts(match[3]);
}
export async function handleRecipeFiles(request,env){
 if(!env.PHOTOS)return json({error:"Storage unavailable"},503);
 const url=new URL(request.url);
 if(request.method==="POST"){
  const project=url.searchParams.get("project");
  if(!await canEditProject(request,env,project))return json({error:"Project owner login required"},401);
  if(!await projectAllowed(env,project,request))return json({error:"Invalid project"},400);
  let filename;
  try{filename=decodeURIComponent(request.headers.get("x-file-name")||"")}catch{return json({error:"Invalid filename"},400)}
  if(!filename||filename.length>180||/[\\/\x00-\x1f]/.test(filename))return json({error:"Invalid filename"},400);
  const extension=filename.split(".").pop().toLowerCase();
  if(!accepts(extension))return json({error:"Unsupported file type"},415);
  const size=Number(request.headers.get("content-length"));
  if(size>MAX_BYTES)return json({error:"Maximum file size is 20 MB"},413);
  const bytes=await request.arrayBuffer();
  if(!bytes.byteLength||bytes.byteLength>MAX_BYTES)return json({error:"Maximum file size is 20 MB"},413);
  const id="recipe-files/"+project+"/"+crypto.randomUUID()+"."+extension;
  // Attachments inherit project visibility; GET checks ownership for private projects.
  await env.PHOTOS.put(id,bytes,{httpMetadata:{contentType:TYPES[extension]},
   customMetadata:{filename}});
  return json({ok:true,id,name:filename,isImage:imageExtension(extension)},201);
 }
 if(request.method==="GET"||request.method==="HEAD"){
  const id=url.searchParams.get("id")||"",match=id.match(pattern);
  if(!match||!accepts(match[3]))return json({error:"File not found"},404);
  if(!await projectAllowed(env,match[1],request))return json({error:"File not found"},404);
  const metadataOnly=request.method==="HEAD";
  const file=await (metadataOnly?env.PHOTOS.head(id):env.PHOTOS.get(id));
  if(!file)return json({error:"File not found"},404);
  const ext=match[3],isImage=imageExtension(ext);
  const filename=file.customMetadata?.filename||"attachment."+ext;
  const safeFilename=filename.replace(/[\\/\r\n"\x00-\x1f]/g,"_");
  const headers=new Headers({
   "content-type":TYPES[ext],
   "content-disposition":(isImage||ext==="pdf"?"inline":"attachment")+"; filename*=UTF-8''"+encodeURIComponent(safeFilename),
   "cache-control":"private, no-store",
   "x-content-type-options":"nosniff",
   "content-security-policy":"default-src 'none'; sandbox"
  });
  return new Response(metadataOnly?null:file.body,{headers});
 }
 return json({error:"Method not allowed"},405);
}
