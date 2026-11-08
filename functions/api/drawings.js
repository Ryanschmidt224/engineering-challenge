import {isAdmin} from "./auth.js";

const projects=new Set(["launcher","linear","robot"]);
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const validId=value=>typeof value==="string"&&/^[a-zA-Z0-9-]{1,80}$/.test(value);
const validUuid=value=>typeof value==="string"&&/^[a-f0-9-]{36}$/i.test(value);
const LIMIT=20*1024*1024;
const sanitizeName=value=>{
 const cleaned=String(value||"drawing.pdf").replace(/[\\/\x00-\x1f\x7f]/g,"_").trim().slice(0,140);
 return (cleaned||"drawing.pdf").replace(/\.pdf$/i,"")+".pdf";
};
const prefix=(project,type,id)=>"drawings/"+project+"/"+type+"/"+id+"/";
const keyFor=(project,type,id,file)=>prefix(project,type,id)+file+".pdf";
const downloadHeaders=(name,download)=>{
 const fileName=sanitizeName(name);
 const headers=new Headers({
  "content-type":"application/pdf",
  "content-disposition":(download?"attachment":"inline")+"; filename*=UTF-8''"+encodeURIComponent(fileName),
  "cache-control":"no-store",
  "x-content-type-options":"nosniff"
 });
 return headers;
};
async function validOwner(env,project,type,id){
 if(type==="assembly"){
  if(id==="__root__")return true;
  if(!validId(id))return false;
  const record=await env.PHOTOS.get("trees/"+project+".json");
  const nodes=record?JSON.parse(await record.text()):[];
  return nodes.some(node=>node.id===id&&node.kind!=="part");
 }
 if(type==="part"&&validUuid(id)){
  const record=await env.PHOTOS.get("components/"+project+".json");
  const parts=record?JSON.parse(await record.text()):[];
  return parts.some(part=>part.id===id);
 }
 return false;
}
export async function handleDrawings(request,env){
 if(!env.PHOTOS)return json({error:"Drawing storage is unavailable"},503);
 const url=new URL(request.url);
 const project=url.searchParams.get("project"),type=url.searchParams.get("type"),id=url.searchParams.get("id");
 if(!projects.has(project)||!["assembly","part"].includes(type)||!(id==="__root__"&&type==="assembly"||validId(id)))return json({error:"Invalid drawing location"},400);
 if(!await validOwner(env,project,type,id))return json({error:"Assembly or part not found"},404);
 const file=url.searchParams.get("file");
 if(file!==null&&!validUuid(file))return json({error:"Invalid drawing ID"},400);
 const location=prefix(project,type,id);
 const objectKey=file===null?null:keyFor(project,type,id,file);
 if(request.method==="GET"){
  if(file!==null){
   const object=await env.PHOTOS.get(objectKey);
   if(!object)return json({error:"Drawing not found"},404);
   const headers=downloadHeaders(object.customMetadata?.filename||"drawing.pdf",url.searchParams.get("download")==="1");
   return new Response(object.body,{status:200,headers});
  }
  const listed=await env.PHOTOS.list({prefix:location,limit:100,include:["customMetadata"]});
  return json({drawings:listed.objects.filter(item=>item.key.endsWith(".pdf")).map(item=>({
   id:item.key.slice(location.length,-4),
   name:item.customMetadata?.filename||"Drawing.pdf",
   size:item.size,
   uploaded:item.uploaded.toISOString()
  })),truncated:listed.truncated});
 }
 if(!["POST","DELETE"].includes(request.method))return json({error:"Method not allowed"},405);
 if(!await isAdmin(request,env))return json({error:"Administrator login required"},401);
 if(request.method==="DELETE"){
  if(file===null)return json({error:"Select a drawing to delete"},400);
  if(!await env.PHOTOS.head(objectKey))return json({error:"Drawing not found"},404);
  await env.PHOTOS.delete(objectKey);return json({ok:true});
 }
 if(file!==null&&!await env.PHOTOS.head(objectKey))return json({error:"Drawing to replace not found"},404);
 const typeHeader=(request.headers.get("content-type")||"").split(";")[0].trim().toLowerCase();
 if(!["application/pdf","application/octet-stream"].includes(typeHeader))return json({error:"Upload a PDF exported from SolidWorks or another drawing program"},415);
 const declaredSize=Number(request.headers.get("content-length")||0);
 if(declaredSize>LIMIT)return json({error:"PDF exceeds the 20 MB limit"},413);
 const reader=request.body?.getReader();
 if(!reader)return json({error:"No PDF selected"},400);
 let total=0,oversize=false;
 const chunks=[];
 try{
  for(;;){
   const {done,value}=await reader.read();
   if(done)break;
   if(total+value.byteLength>LIMIT){oversize=true;await reader.cancel();break}
   chunks.push(value);total+=value.byteLength;
  }
 }finally{reader.releaseLock()}
 if(oversize)return json({error:"PDF exceeds the 20 MB limit"},413);
 if(total<6)return json({error:"PDF file is empty or invalid"},400);
 const bytes=new Uint8Array(total);let offset=0;
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
 // Confirm PDF signature instead of accepting arbitrary files renamed .pdf.
 const header=new TextDecoder().decode(bytes.subarray(0,8));
 if(!header.startsWith("%PDF-"))return json({error:"File is not a valid PDF export"},415);
 let suppliedName="drawing.pdf";
 try{suppliedName=decodeURIComponent(request.headers.get("x-drawing-name")||"drawing.pdf")}catch{return json({error:"Invalid drawing filename"},400)}
 const newId=file||crypto.randomUUID(),filename=sanitizeName(suppliedName);
 await env.PHOTOS.put(keyFor(project,type,id,newId),bytes,{
  httpMetadata:{contentType:"application/pdf"},
  customMetadata:{filename}
 });
 return json({ok:true,drawing:{id:newId,name:filename,size:total}},file?200:201);
}
