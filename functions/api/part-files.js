import {isAdmin} from "./auth.js";
const PROJECTS=new Set(["launcher","linear","robot","buck","motorlab","coiltest"]);
const EXTENSIONS=new Set(["x_t","x_b","stl","step","stp","iges","igs","sldprt","sldasm","dxf","dwg","zip","pdf","3mf","obj","csv","txt"]);
const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const MAX_BYTES=20*1024*1024;
const uuid=s=>typeof s==="string"&&/^[a-f0-9-]{36}$/i.test(s);
export async function handlePartFiles(request,env){
 const u=new URL(request.url),project=u.searchParams.get("project"),partId=u.searchParams.get("id"),file=u.searchParams.get("file");
 if(!PROJECTS.has(project)||!uuid(partId)||file!==null&&!uuid(file))return json({error:"Invalid part file location"},400);
 if(!["GET","POST"].includes(request.method))return json({error:"Method not allowed"},405);
 // CAD files can contain proprietary engineering data: require admin to read and upload.
 if(!await isAdmin(request,env))return json({error:"Administrator login required for private engineering files"},401);
 if(!env.PHOTOS)return json({error:"Storage unavailable"},503);
 const component=await env.PHOTOS.get("components/"+project+".json");
 const parts=component?JSON.parse(await component.text()):[];
 if(!parts.some(p=>p.id===partId))return json({error:"Part not found"},404);
 const prefix="part-files/"+project+"/"+partId+"/";
 if(request.method==="GET"){
  if(file!==null){
   const listing=await env.PHOTOS.list({prefix:prefix+file+".",limit:30,include:["customMetadata"]});
   const match=listing.objects.find(obj=>obj.key.startsWith(prefix+file+"."));
   if(!match)return json({error:"File not found"},404);
   const stored=await env.PHOTOS.get(match.key);if(!stored)return json({error:"File missing"},404);
   const name=stored.customMetadata?.filename||match.key.slice(prefix.length);
   return new Response(stored.body,{headers:{"content-type":"application/octet-stream",
    "content-disposition":"attachment; filename*=UTF-8''"+encodeURIComponent(name),
    "cache-control":"no-store","x-content-type-options":"nosniff"}});
  }
  const entries=[];let cursor;
  do{
   const response=await env.PHOTOS.list({prefix,limit:500,cursor,include:["customMetadata"]});
   entries.push(...response.objects.map(obj=>({
    id:obj.key.slice(prefix.length).split(".")[0],name:obj.customMetadata?.filename||obj.key.slice(prefix.length),
    size:obj.size,uploaded:obj.uploaded?.toISOString?.()||null
   })));
   if(entries.length>1500)return json({error:"Too many part files"},413);
   if(!response.truncated)break;
   if(!response.cursor||response.cursor===cursor)return json({error:"File listing incomplete"},500);
   cursor=response.cursor;
  }while(true);
  return json({files:entries});
 }
 if(file!==null)return json({error:"Replacement is not supported; upload another revision"},400);
 const rawName=request.headers.get("x-file-name")||"";
 let name;try{name=decodeURIComponent(rawName)}catch{return json({error:"Invalid filename"},400)}
 if(!name||name.length>180||/[\\/\x00-\x1f]/.test(name))return json({error:"Invalid filename"},400);
 const ext=name.split(".").pop().toLowerCase();
 if(!EXTENSIONS.has(ext))return json({error:"Unsupported file type. Use CAD, mesh, drawing or archive formats."},415);
 const bytes=await request.arrayBuffer();
 if(!bytes.byteLength||bytes.byteLength>MAX_BYTES)return json({error:"Files must be below 20 MB"},413);
 const id=crypto.randomUUID();
 await env.PHOTOS.put(prefix+id+"."+ext,bytes,{httpMetadata:{contentType:"application/octet-stream"},
  customMetadata:{filename:name}});
 return json({ok:true,file:{id,name,size:bytes.byteLength}},201);
}