// One project-wide numbering register for assemblies and custom parts.
// Numbers are never reused, even after deletion or renaming. Each record keeps
// its assigned number permanently; changing formatting affects new issues only.
import {projectAllowed,canEditProject} from "./projects.js";
const key=id=>"project-numbering/"+id+".json";
const defaults=()=>({prefix:"NR",digits:4,nextAssembly:1,nextPart:1001,issued:{},issuedSequences:{}});
const err=(message,status=400)=>Object.assign(new Error(message),{status});
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
export async function numberingState(env,project){
 const object=await env.PHOTOS.get(key(project));
 const data=object?JSON.parse(await object.text()):defaults();
 return {data:{...defaults(),...data,issued:data.issued||{},issuedSequences:data.issuedSequences||{}},etag:object?.etag||null};
}
export const formatNumber=(data,sequence)=>data.prefix+String(sequence).padStart(data.digits,"0");
const validateSettings=input=>{
 const prefix=String(input?.prefix??"").trim().toUpperCase(),digits=Number(input?.digits);
 if(!/^[A-Z][A-Z0-9]{0,9}$/.test(prefix))throw err("Prefix must start with a letter and contain up to 10 letters or digits");
 if(!Number.isSafeInteger(digits)||digits<3||digits>8)throw err("Choose 3 to 8 digits");
 return {prefix,digits};
};
async function changeRegister(env,project,update){
 for(let attempt=0;attempt<5;attempt++){
  const state=await numberingState(env,project);
  const result=update(state.data);
  const saved=await env.PHOTOS.put(key(project),JSON.stringify(state.data),{onlyIf:state.etag?{etagMatches:state.etag}:{etagDoesNotMatch:"*"}});
  if(saved!==null)return result;
 }
 throw err("Numbering was updated in another session. Retry the save.",409);
}
// Legacy project records may predate the numbering registry. Include them
// when allocating or validating numbers, without renumbering existing items.
async function legacyNumbers(env,project){
 const keys=["components/"+project+".json","trees/"+project+".json"];
 const entries=await Promise.all(keys.map(k=>env.PHOTOS.get(k)));
 const numbers=new Map();
 for(let i=0;i<entries.length;i++){
  if(!entries[i])continue;
  const records=JSON.parse(await entries[i].text());
  if(!Array.isArray(records))continue;
  for(const part of records){
   if(i===1&&part.kind==="part")continue;
   const value=String(part.partNumber||"").trim().toUpperCase();
   if(!value)continue;
   const owner=(i===0?"part:":"assembly:")+part.id;
   if(numbers.has(value)&&numbers.get(value)!==owner)throw err("Duplicate existing project number "+value+". Resolve this conflict before issuing new numbers.",409);
   numbers.set(value,owner);
  }
 }
 return numbers;
}
export async function issueNumber(env,project,kind,recordId,manual){
 if(!["assembly","part"].includes(kind)||typeof recordId!=="string"||recordId.length>100)throw err("Invalid number allocation",400);
 const recordKey=kind+":"+recordId;
 const existing=await legacyNumbers(env,project);
 return changeRegister(env,project,data=>{
  if(data.issued[recordKey])return data.issued[recordKey];
  let value,sequence;
  if(manual!==undefined&&manual!==null&&manual!==""){
   value=String(manual).trim().toUpperCase();
   const prefix=data.prefix;
   if(!value.startsWith(prefix)||!/^\d+$/.test(value.slice(prefix.length)))throw err("Part number must use the project's prefix followed by digits");
   sequence=Number(value.slice(prefix.length));
   if(!Number.isSafeInteger(sequence)||sequence<1)throw err("Invalid sequence number");
   if(kind==="assembly"&&sequence>1000)throw err("Assembly numbers must be between 1 and 1000");
   if(kind==="part"&&sequence<=1000)throw err("Numbers 1–1000 are reserved for assemblies");
   // Normalize leading zeroes so NR1 cannot bypass the uniqueness of NR0001.
   value=formatNumber(data,sequence);
  }else{
   const cursor=kind==="assembly"?"nextAssembly":"nextPart";
   sequence=data[cursor];
   const upper=kind==="assembly"?1000:Number.MAX_SAFE_INTEGER;
   while(sequence<=upper&&(data.issuedSequences[String(sequence)]||Object.values(data.issued).includes(formatNumber(data,sequence))||existing.has(formatNumber(data,sequence))))sequence++;
   if(sequence>upper)throw err("Assembly numbers 1–1000 are exhausted. Choose a new prefix for new projects.",409);
   value=formatNumber(data,sequence);
  }
  if(existing.has(value)&&existing.get(value)!==recordKey||data.issuedSequences[String(sequence)]&&data.issuedSequences[String(sequence)]!==recordKey||Object.entries(data.issued).some(([id,n])=>id!==recordKey&&n===value))throw err("This part number is already assigned in the project",409);
  data.issued[recordKey]=value;
  data.issuedSequences[String(sequence)]=recordKey;
  const cursor=kind==="assembly"?"nextAssembly":"nextPart";
  data[cursor]=Math.max(data[cursor],sequence+1);
  return value;
 });
}
export async function onRequest({request,env}){
 const project=new URL(request.url).searchParams.get("project");
 if(!await projectAllowed(env,project,request))return json({error:"Project unavailable"},404);
 if(request.method==="GET"){
  const {data}=await numberingState(env,project);
  return json({prefix:data.prefix,digits:data.digits,nextAssembly:Math.min(data.nextAssembly,1000),nextPart:data.nextPart,reservedAssemblyRange:"0001–1000",issuedCount:Object.keys(data.issued).length});
 }
 if(request.method!=="PUT")return json({error:"Method not allowed"},405);
 if(!await canEditProject(request,env,project))return json({error:"Owner permission required"},403);
 if(request.headers.get("origin")!==new URL(request.url).origin)return json({error:"Invalid origin"},403);
 const input=await request.json().catch(()=>null);
 try{
  const proposed=validateSettings(input);
  const result=await changeRegister(env,project,data=>{
   data.prefix=proposed.prefix;data.digits=proposed.digits;
   return {prefix:data.prefix,digits:data.digits,nextAssembly:data.nextAssembly,nextPart:data.nextPart};
  });
  return json({settings:result});
 }catch(e){return json({error:e.message},e.status||400)}
}
