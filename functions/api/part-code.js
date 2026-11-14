/* Code belongs to an existing component but is stored independently so large
 * source files never bloat the project's BOM record. No execution endpoint.
 * Every saved revision is immutable and is never automatically deleted.
 */
import {projectAllowed,canEditProject,VALID_PROJECT_ID} from "./projects.js";
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const LANGUAGES=new Set(["text","python","javascript","typescript","c","cpp","arduino","html","css","json","bash","sql","yaml","rust"]);
const idPattern=/^[0-9a-f-]{36}$/i;
const currentKey=(project,id)=>"part-code/"+project+"/"+id+"/current.json";
const versionKey=(project,id,revision)=>"part-code/"+project+"/"+id+"/revisions/"+revision+".json";
export async function handlePartCode(request,env){
 const url=new URL(request.url),project=url.searchParams.get("project")||"",id=url.searchParams.get("id")||"";
 if(!VALID_PROJECT_ID.test(project)||!idPattern.test(id))return reply({error:"Invalid part"},400);
 if(!await projectAllowed(env,project,request))return reply({error:"Project not available"},404);
 if(!env.PHOTOS)return reply({error:"Storage unavailable"},503);
 const components=await env.PHOTOS.get("components/"+project+".json");
 const parts=components?JSON.parse(await components.text()):[];
 if(!parts.some(p=>p.id===id&&p.partType==="code"&&!p.generatedFrom))
  return reply({error:"This part is not a Code item"},404);
 const key=currentKey(project,id);
 if(request.method==="GET"){
  const current=await env.PHOTOS.get(key);
  const doc=current?JSON.parse(await current.text()):{source:"",language:"text",filename:"",revision:null,revisions:[]};
  const chosen=url.searchParams.get("revision");
  if(chosen){
   if(!/^[0-9a-f-]{36}$/i.test(chosen)||!doc.revisions.some(r=>r.revision===chosen))return reply({error:"Revision not found"},404);
   const old=await env.PHOTOS.get(versionKey(project,id,chosen));
   return old?reply({version:JSON.parse(await old.text())}):reply({error:"Revision unavailable"},404);
  }
  return reply({document:doc});
 }
 if(request.method!=="PUT")return reply({error:"Method not allowed"},405);
 if(!await canEditProject(request,env,project))return reply({error:"Edit permission required"},403);
 const input=await request.json().catch(()=>null);
 if(!input||typeof input.source!=="string"||input.source.length>100000||!LANGUAGES.has(input.language)||
   typeof input.filename!=="string"||input.filename.length>120||!/^[a-zA-Z0-9_. -]*$/.test(input.filename)||
   !(input.expectedRevision===null||typeof input.expectedRevision==="string"))
   return reply({error:"Invalid source, filename, or language"},400);
 const prior=await env.PHOTOS.get(key);
 const old=prior?JSON.parse(await prior.text()):{source:"",language:"text",filename:"",revision:null,revisions:[]};
 if((old.revision||null)!==(input.expectedRevision||null))
  return reply({error:"Code changed in another tab. Reload before saving.",latestRevision:old.revision||null},409);
 if(old.source===input.source&&old.language===input.language&&old.filename===input.filename)
  return reply({ok:true,revision:old.revision||null,unchanged:true});
 const revision=crypto.randomUUID(),savedAt=new Date().toISOString();
 const version={source:input.source,language:input.language,filename:input.filename,revision,savedAt};
 const history=[...(old.revisions||[]),{revision,savedAt,filename:input.filename,language:input.language}];
 const next={...version,revisions:history};
 // Persist snapshot before index. A failed index CAS leaves a harmless
 // unreferenced snapshot, never overwrites a user's newer code.
 await env.PHOTOS.put(versionKey(project,id,revision),JSON.stringify(version),{httpMetadata:{contentType:"application/json"}});
 const condition=prior?{onlyIf:{etagMatches:prior.etag}}:{onlyIf:{etagDoesNotMatch:"*"}};
 const saved=await env.PHOTOS.put(key,JSON.stringify(next),condition);
 if(saved===null)return reply({error:"Code changed while saving. Reload before trying again."},409);
 return reply({ok:true,revision,savedAt});
}
export const onRequest=({request,env})=>handlePartCode(request,env);
