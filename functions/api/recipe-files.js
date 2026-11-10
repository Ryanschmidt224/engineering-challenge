import {projectAllowed,VALID_PROJECT_ID} from "./projects.js";
import {isAdmin} from "./auth.js";

const TYPES={
 jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp",
 gif:"image/gif",heic:"image/heic",heif:"image/heif",
 pdf:"application/pdf",dwg:"application/octet-stream",dxf:"application/octet-stream",
 sldprt:"application/octet-stream",sldasm:"application/octet-stream",
 step:"application/octet-stream",stp:"application/octet-stream",stl:"application/octet-stream",
 igs:"application/octet-stream",iges:"application/octet-stream",
 x_t:"application/octet-stream",x_b:"application/octet-stream",
 obj:"application/octet-stream","3mf":"application/octet-stream",
 doc:"application/octet-stream",docx:"application/octet-stream",
 xls:"application/octet-stream",xlsx:"application/octet-stream",
 txt:"text/plain",csv:"text/plain",zip:"application/octet-stream"
};
const IMAGE_TYPES=new Set(["jpg","jpeg","png","webp","gif","heic","heif"]);
const MAX_BYTES=20*1024*1024;
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const pattern=/^recipe-files\/(launcher|linear|robot|buck|motorlab|coiltest|p[a-f0-9]{32})\/([a-f0-9-]{36})\.([a-z0-9_]{1,8})$/;
export async function handleRecipeFiles(request,env){
 if(!env.PHOTOS)return json({error:"Storage unavailable"},503);
 const url=new URL(request.url);
 if(request.method==="POST"){
  if(!await isAdmin(request,env))return json({error:"Administrator login required"},401);
  const project=url.searchParams.get("project");
  if(!await projectAllowed(env,project))return json({error:"Invalid project"},400);
  let filename;
  try{filename=decodeURIComponent(request.headers.get("x-file-name")||"")}catch{return json({error:"Invalid filename"},400)}
  if(!filename||filename.length>180||/[\\/\x00-\x1f]/.test(filename))return json({error:"Invalid filename"},400);
  const extension=filename.split(".").pop().toLowerCase();
  if(!Object.hasOwn(TYPES,extension))return json({error:"Unsupported file type"},415);
  const size=Number(request.headers.get("content-length"));
  if(size>MAX_BYTES)return json({error:"Maximum file size is 20 MB"},413);
  const bytes=await request.arrayBuffer();
  if(!bytes.byteLength||bytes.byteLength>MAX_BYTES)return json({error:"Maximum file size is 20 MB"},413);
  const id="recipe-files/"+project+"/"+crypto.randomUUID()+"."+extension;
  // The work-instruction itself is public, so linked files are publicly retrievable.
  await env.PHOTOS.put(id,bytes,{httpMetadata:{contentType:TYPES[extension]},
   customMetadata:{filename}});
  return json({ok:true,id,name:filename,isImage:IMAGE_TYPES.has(extension)},201);
 }
 if(request.method==="GET"){
  const id=url.searchParams.get("id")||"",match=id.match(pattern);
  if(!match||!Object.hasOwn(TYPES,match[3]))return json({error:"File not found"},404);
  const file=await env.PHOTOS.get(id);
  if(!file)return json({error:"File not found"},404);
  const ext=match[3],isImage=IMAGE_TYPES.has(ext);
  const filename=file.customMetadata?.filename||"attachment."+ext;
  const safeFilename=filename.replace(/[\\/\r\n"\x00-\x1f]/g,"_");
  const headers=new Headers({
   "content-type":TYPES[ext],
   "content-disposition":(isImage||ext==="pdf"?"inline":"attachment")+"; filename*=UTF-8''"+encodeURIComponent(safeFilename),
   "cache-control":"public, max-age=3600",
   "x-content-type-options":"nosniff",
   "content-security-policy":"default-src 'none'; sandbox"
  });
  return new Response(file.body,{headers});
 }
 return json({error:"Method not allowed"},405);
}
