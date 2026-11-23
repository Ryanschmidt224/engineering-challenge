import {projectAllowed,canEditProject} from "./projects.js";
import {projectFamilyParts} from "./workshop-db.js";
import {resolveFunctionalPart} from "./functional-part-model.js";
const json=(value,status=200)=>Response.json(value,{status,headers:{"cache-control":"private, no-store","x-content-type-options":"nosniff"}});
const safeName=value=>String(value||"file").replace(/[\\/\x00-\x1f\x7f<>:"|?*]/g,"_").replace(/^\.+/,"_").trim().slice(0,180)||"file";
const fingerprint=async value=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))),byte=>byte.toString(16).padStart(2,"0")).join("");
async function readJson(bucket,key,fallback){const object=await bucket.get(key);return object?JSON.parse(await object.text()):fallback;}
async function projectOwners(env,project){
 const parts=[...(await readJson(env.PHOTOS,"components/"+project+".json",[])).map(raw=>({...resolveFunctionalPart(raw),fileSelection:raw.selection||null})),...await projectFamilyParts(env,project)],nodes=await readJson(env.PHOTOS,"trees/"+project+".json",[]),owners=new Map();
 for(const part of parts){
  if(part.generatedFrom||part.fileSelection&&!part.fileSelection.selectedId)continue;
  const selected=part.fileSelection?.selectedId||null,implementation=selected?"implementations/"+selected+"/":"",owner={ownerId:part.id,ownerType:"part",ownerName:part.name,partNumber:part.partNumber||"",implementation:selected};
  owners.set("part-files/"+project+"/"+part.id+"/"+implementation,owner);owners.set("drawings/"+project+"/part/"+part.id+"/"+implementation,owner);
 }
 for(const node of [{id:"__root__",name:"Project"},...nodes.filter(node=>node.kind!=="part")])owners.set("drawings/"+project+"/assembly/"+node.id+"/",{ownerId:node.id,ownerType:"assembly",ownerName:node.name,partNumber:node.partNumber||"",implementation:null});
 return owners;
}
export async function projectFiles(request,env,project){
 const owners=await projectOwners(env,project);
 const files=[];
 for(const prefix of ["part-files/"+project+"/","drawings/"+project+"/"]){let cursor;
  do{const page=await env.PHOTOS.list({prefix,cursor,limit:500,include:["customMetadata"]});
   for(const object of page.objects){const slash=object.key.lastIndexOf("/"),owner=owners.get(object.key.slice(0,slash+1)),leaf=object.key.slice(slash+1);if(!owner||!/^([a-f0-9-]{36})\.([a-z0-9_]+)$/i.test(leaf))continue;
    const kind=prefix.startsWith("drawings/")?"drawing":"cad",name=object.customMetadata?.filename||leaf,id=await fingerprint(object.key+":"+object.etag),query=new URLSearchParams({project,key:object.key,etag:object.etag});
    files.push({...owner,id,name,size:object.size,extension:name.split(".").pop().toLowerCase(),kind,uploaded:object.uploaded?.toISOString?.()||null,url:"/api/project-files?"+query});
    if(files.length>2500)throw Error("This project has too many files for one list. Contact the maintainer before exporting.");
   }
   if(!page.truncated)break;if(!page.cursor||page.cursor===cursor)throw Error("The project file list was incomplete. Refresh and try again.");cursor=page.cursor;
  }while(true);
 }
 return files.sort((a,b)=>(a.partNumber||a.ownerName).localeCompare(b.partNumber||b.ownerName,undefined,{numeric:true})||a.name.localeCompare(b.name));
}
export async function handleProjectFiles(request,env){
 if(request.method!=="GET")return json({error:"Method not allowed"},405);
 const url=new URL(request.url),project=url.searchParams.get("project");
 if(!await projectAllowed(env,project,request)||!await canEditProject(request,env,project))return json({error:"Project owner sign-in required"},403);
 if(!env.PHOTOS)return json({error:"Project file storage is unavailable"},503);
 const key=url.searchParams.get("key");
 if(key!==null){
  const owners=await projectOwners(env,project),slash=key.lastIndexOf("/"),owner=owners.get(key.slice(0,slash+1));
  if(!owner||!/^([a-f0-9-]{36})\.([a-z0-9_]+)$/i.test(key.slice(slash+1)))return json({error:"File is not attached to the current project build."},404);
  const object=await env.PHOTOS.get(key);if(!object)return json({error:"Project file no longer exists. Refresh files."},404);
  if(object.etag!==url.searchParams.get("etag"))return json({error:"This file changed since the list loaded. Refresh files before downloading."},409);
  return new Response(object.body,{headers:{"content-type":"application/octet-stream","content-disposition":"attachment; filename*=UTF-8''"+encodeURIComponent(safeName(object.customMetadata?.filename||key.slice(slash+1))),"cache-control":"private, no-store","x-content-type-options":"nosniff"}});
 }
 return json({files:await projectFiles(request,env,project)});
}
