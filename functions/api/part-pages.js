import {projectAllowed,canEditProject,VALID_PROJECT_ID} from "./projects.js";
import {isAdmin} from "./auth.js";
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const uuid=s=>typeof s==="string"&&/^[0-9a-f-]{36}$/i.test(s);
export async function handlePartPages(request,env){
 const u=new URL(request.url),project=u.searchParams.get("project"),partId=u.searchParams.get("id"),file=u.searchParams.get("file");
 if(!await projectAllowed(env,project,request)||!uuid(partId)||file!==null&&!uuid(file))return json({error:"Invalid saved product page location"},400);
 if(!["GET","POST"].includes(request.method))return json({error:"Method not allowed"},405);
 if(!await canEditProject(request,env,project))return json({error:"Project owner login required"},401);
 if(!env.PHOTOS)return json({error:"Storage unavailable"},503);
 const item=await env.PHOTOS.get("components/"+project+".json");
 const parts=item?JSON.parse(await item.text()):[];
 if(!parts.some(p=>p.id===partId))return json({error:"Part not found"},404);
 const prefix="part-pages/"+project+"/"+partId+"/";
 if(request.method==="GET"){
  if(file!==null){
   const obj=await env.PHOTOS.get(prefix+file+".html");
   if(!obj)return json({error:"Snapshot missing"},404);
   // Download only. Never execute untrusted product-page HTML on our origin.
   return new Response(obj.body,{headers:{"content-type":"application/octet-stream",
    "content-disposition":"attachment; filename=\"product-page-"+file+".html\"",
    "content-security-policy":"sandbox","x-content-type-options":"nosniff","cache-control":"no-store"}});
  }
  const records=[];let cursor;
  do{
   const list=await env.PHOTOS.list({prefix,limit:400,cursor,include:["customMetadata"]});
   records.push(...list.objects.map(o=>({id:o.key.slice(prefix.length).replace(/\.html$/,""),
    url:o.customMetadata?.sourceUrl||"",savedAt:o.customMetadata?.savedAt||""})));
   if(!list.truncated)break;
   if(!list.cursor||list.cursor===cursor)return json({error:"Incomplete page listing"},500);
   cursor=list.cursor;
  }while(records.length<800);
  return json({pages:records});
 }
 if(file!==null)return json({error:"Invalid save location"},400);
 const data=await request.json().catch(()=>null);
 if(!uuid(data?.snapshotId))return json({error:"Invalid extracted page reference"},400);
 const original=await env.PHOTOS.get("extraction-snapshots/"+project+"/"+data.snapshotId+".html");
 if(!original)return json({error:"Extracted page is no longer available"},404);
 const snapshotKey=prefix+data.snapshotId+".html";
 if(await env.PHOTOS.head(snapshotKey))return json({ok:true,alreadySaved:true});
 const bytes=await original.arrayBuffer();
 if(bytes.byteLength>1500000)return json({error:"Page snapshot too large"},413);
 await env.PHOTOS.put(snapshotKey,bytes,{httpMetadata:{contentType:"application/octet-stream"},
  customMetadata:{sourceUrl:original.customMetadata?.sourceUrl||"",savedAt:new Date().toISOString()}});
 return json({ok:true},201);
}