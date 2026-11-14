// One project-wide numbering register for assemblies and custom parts.
// Numbers are never reused, even after deletion or renaming. Each record keeps
// its assigned number permanently; changing formatting affects new issues only.
import {projectAllowed,canEditProject} from "./projects.js";
const key=id=>"project-numbering/"+id+".json";
const defaults=()=>({prefix:"NR",digits:3,nextAssembly:1,nextPart:100,issued:{},issuedSequences:{}});
const err=(message,status=400)=>Object.assign(new Error(message),{status});
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
export async function numberingState(env,project){
 const object=await env.PHOTOS.get(key(project));
 const data=object?JSON.parse(await object.text()):defaults();
 // Migrate allocation cursors without changing any previously issued identifiers.
 if(data.rangeVersion!==2){data.nextAssembly=1;data.nextPart=100;data.rangeVersion=2;}
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
function occupiedSequences(data,existing){
 const occupied=new Set(Object.keys(data.issuedSequences));
 // Also recognize legacy numbers with different zero padding under the current prefix.
 for(const number of [...existing.keys(),...Object.values(data.issued)]){
  if(number.startsWith(data.prefix)&&/^\d+$/.test(number.slice(data.prefix.length)))occupied.add(String(Number(number.slice(data.prefix.length))));
 }
 return occupied;
}
function nextAvailable(data,existing,kind){
 const occupied=occupiedSequences(data,existing);
 let sequence=data[kind==="assembly"?"nextAssembly":"nextPart"];
 const upper=kind==="assembly"?99:Number.MAX_SAFE_INTEGER;
 while(sequence<=upper&&occupied.has(String(sequence)))sequence++;
 return sequence<=upper?sequence:null;
}
export async function issueNumber(env,project,kind,recordId,manual){
 if(!["assembly","part"].includes(kind)||typeof recordId!=="string"||recordId.length>100)throw err("Invalid number allocation",400);
 const recordKey=kind+":"+recordId;
 const existing=await legacyNumbers(env,project);
 return changeRegister(env,project,data=>{
  if(data.issued[recordKey])return data.issued[recordKey];
  const occupied=occupiedSequences(data,existing);
  let value,sequence;
  if(manual!==undefined&&manual!==null&&manual!==""){
   value=String(manual).trim().toUpperCase();
   const prefix=data.prefix;
   if(!value.startsWith(prefix)||!/^\d+$/.test(value.slice(prefix.length)))throw err("Part number must use the project's prefix followed by digits");
   sequence=Number(value.slice(prefix.length));
   if(!Number.isSafeInteger(sequence)||sequence<1)throw err("Invalid sequence number");
   if(kind==="assembly"&&sequence>99)throw err("Assembly numbers must be between 1 and 99");
   if(kind==="part"&&sequence<100)throw err("Numbers 1–99 are reserved for assemblies");
   // Normalize leading zeroes so NR1 cannot bypass the uniqueness of NR0001.
   value=formatNumber(data,sequence);
  }else{
   const cursor=kind==="assembly"?"nextAssembly":"nextPart";
   sequence=data[cursor];
   const upper=kind==="assembly"?99:Number.MAX_SAFE_INTEGER;
   while(sequence<=upper&&(occupied.has(String(sequence))))sequence++;
   if(sequence>upper)throw err("Assembly numbers 1–99 are exhausted. Choose a new prefix for new projects.",409);
   value=formatNumber(data,sequence);
  }
  if(occupied.has(String(sequence))||existing.has(value)&&existing.get(value)!==recordKey||data.issuedSequences[String(sequence)]&&data.issuedSequences[String(sequence)]!==recordKey||Object.entries(data.issued).some(([id,n])=>id!==recordKey&&n===value))throw err("This part number is already assigned in the project",409);
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
  const existing=await legacyNumbers(env,project);
  const lookup=String(new URL(request.url).searchParams.get("lookup")||"").trim().toUpperCase();
  if(lookup){
   if(!/^[A-Z0-9-]{1,32}$/.test(lookup))return json({error:"Invalid part number"},400);
   const issued=Object.entries(data.issued).find(([,number])=>number.toUpperCase()===lookup);
   const exact=issued?.[0]||existing.get(lookup)||null;
   let owner=exact,record=null;
   if(owner){
    const isPart=owner.startsWith("part:");
    const stored=await env.PHOTOS.get((isPart?"components/":"trees/")+project+".json");
    const records=stored?JSON.parse(await stored.text()):[];
    const item=Array.isArray(records)?records.find(p=>p.id===owner.slice(owner.indexOf(":")+1)):null;
    if(item)record={id:item.id,name:item.name||"Unnamed",kind:isPart?"part":"assembly"};
   }
   if(!owner){
    const sequence=lookup.startsWith(data.prefix)&&/^\\d+$/.test(lookup.slice(data.prefix.length))?String(Number(lookup.slice(data.prefix.length))):null;
    if(sequence)owner=data.issuedSequences[sequence]||null;
   }
   return json({number:lookup,reserved:!!owner,kind:owner?.split(":")[0]||null,active:!!record,record,reason:owner?(record?"active":"previously issued or deleted"):"available",note:owner&&!record?"This identifier remains reserved even though no active part or assembly is listed.":""});
  }
  return json({prefix:data.prefix,digits:data.digits,nextAssembly:nextAvailable(data,existing,"assembly"),nextPart:nextAvailable(data,existing,"part"),reservedAssemblyRange:"001–099",issuedCount:Object.keys(data.issued).length});
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
