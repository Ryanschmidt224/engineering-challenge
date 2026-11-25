import {parseArgs} from "node:util";
import {pathToFileURL} from "node:url";
import {writeFile} from "node:fs/promises";
import {createProjectClient} from "../assets/project-client.js";
import {runSourceRecoveryProof,runRestoreRecoveryProof,verifySourceRecoveryProof} from "../assets/project-recovery-proof.js";
import {runAssemblySourceProof} from "../assets/project-assembly-proof.js";

const sourceDatabase="3314f42f-7c04-4798-99dc-b5b97c4fb82f",targetDatabase="d761ae08-64f2-4130-8cfa-f596e8e89b80",bucket="building-schmidt-photos-preview";
const requireValue = (value, message, status) => {
 if (value) return value;
 const error = new Error(message);
 if (Number.isInteger(status)) error.status = status;
 throw error;
};
export function previewOrigin(value){
 const url=new URL(value);requireValue(url.protocol==="https:"&&!url.username&&!url.password&&!url.search&&!url.hash&&url.pathname==="/"&&/^(?:feature|preview|fix)-[a-z0-9-]+-engineering-challenge\.ryanschmidt224\.workers\.dev$/.test(url.hostname),"Use a BuildingSchmidt branch preview origin, without a path, query or credentials.");return url.origin;
}
export function verifyBindings(version,expectedDatabase){
 const raw=version?.env,list=Array.isArray(raw)?raw:raw&&typeof raw==="object"?Object.entries(raw).map(([name,binding])=>({...binding,name})):[];
 const binding=name=>{const found=list.filter(row=>row.name===name);requireValue(found.length===1,"Missing or duplicate preview binding: "+name);return found[0];};
 const db=binding("WORKSHOP_DB"),photos=binding("PHOTOS"),flag=binding("NEW_PROJECT_ENGINE");
 requireValue(db.type==="d1"&&db.database_id===expectedDatabase,"Preview D1 binding does not match the isolated database. No proof may run.");
 requireValue(photos.type==="r2_bucket"&&photos.bucket_name===bucket,"Preview R2 binding does not match the isolated bucket. No proof may run.");
 requireValue(flag.type==="plain_text"&&flag.text==="1","The project engine is not explicitly enabled on this preview.");
 return {WORKSHOP_DB:db.database_id,PHOTOS:photos.bucket_name,NEW_PROJECT_ENGINE:flag.text};
}
export function previewTransport(origin,cookie,fetcher=fetch){
 requireValue(typeof cookie==="string"&&cookie.length>0&&!/[\r\n]/.test(cookie),"Provide the preview owner session through the runner's secret environment.");
 return async(path,options={})=>{
  const url=new URL(path,origin);requireValue(url.origin===origin&&!url.username&&!url.password,"The proof cannot send preview credentials to another origin.");
  const headers=new Headers(options.headers);headers.set("cookie",cookie);if(!["GET","HEAD"].includes(options.method||"GET"))headers.set("origin",origin);
  return fetcher(url.href,{...options,headers,redirect:"error",signal:AbortSignal.timeout(30000)});
 };
}
async function readJSON(fetcher, path, options) {
 const response = await fetcher(path, options);
 requireValue(response.ok, "Preview request failed (HTTP " + response.status + "). No acceptance is claimed.", response.status);
 return response.json();
}
export async function verifyLegacyReadOnly(fetcher){
 const catalogPath="/api/projects?includeArchived=1",beforeResponse=await fetcher(catalogPath);requireValue(beforeResponse.ok,"Legacy project catalog must remain readable.");
 const before=await beforeResponse.text(),catalog=JSON.parse(before);requireValue(catalog.readOnly===true&&Array.isArray(catalog.projects),"The legacy catalog must explicitly report read-only mode.");
 // Deliberately invalid even without the boundary: legacy projects require
 // private visibility and a valid project identity. No real edit is prepared.
 const denied=await fetcher("/api/projects",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({visibility:"public"})});
 requireValue(denied.status===409&&(await denied.json()).code==="LEGACY_READ_ONLY","The deployed legacy save boundary did not refuse the harmless probe.");
 const after=await fetcher(catalogPath);requireValue(after.ok&&await after.text()===before,"The legacy catalog changed during its read-only check.");
 const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(before)),catalogSha256=Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,"0")).join("");
 return {ok:true,projectCount:catalog.projects.length,catalogSha256,rejectedStatus:409,code:"LEGACY_READ_ONLY",checks:["Legacy catalog is readable and declares read-only mode","An invalid save probe is refused by the server boundary","Catalog response is byte-for-byte unchanged after the probe"]};
}
export async function runPreviewAcceptance({source,target,account,worker="engineering-challenge",token,sourceCookie,targetCookie,fetcher=fetch,progress=()=>{}}){
 progress("Checking preview URLs and required credentials.");
 const sourceOrigin=previewOrigin(source),targetOrigin=previewOrigin(target);
 requireValue(sourceOrigin!==targetOrigin,"Source and recovery previews must be different.");
 requireValue(/^[a-f0-9]{32}$/.test(account||"")&&worker==="engineering-challenge","Use this project's Cloudflare account ID and engineering-challenge Worker.");
 progress("Checking Cloudflare token format.");
 requireValue(typeof token==="string"&&token.length>0&&!/[\r\n]/.test(token),"CLOUDFLARE_API_TOKEN with Workers Scripts Read permission is required to verify actual version bindings.");
 progress("Checking source owner-session format.");
 const sourceTransport = previewTransport(sourceOrigin, sourceCookie, fetcher);
 progress("Checking recovery owner-session format.");
 const targetTransport = previewTransport(targetOrigin, targetCookie, fetcher);
 const transports = [sourceTransport, targetTransport];
 const origins = [sourceOrigin, targetOrigin];
 const databases = [sourceDatabase, targetDatabase];
 const bindings = [];
 // Every check in this loop is read-only. No proof write occurs until both
 // deployments' actual control-plane bindings have passed verification.
 const labels = ["source", "recovery"];
 for(let index=0;index<2;index++){
  progress("Checking unsigned " + labels[index] + " preview access.");
  const unsigned=await fetcher(origins[index]+"/api/project-engine/environment",{redirect:"error",signal:AbortSignal.timeout(30000)});requireValue(unsigned.status===401,"An unsigned preview environment request must return 401.",unsigned.status);
  progress("Checking " + labels[index] + " owner session.");
  const identity=await readJSON(transports[index],"/api/project-engine/environment");requireValue(/^[a-f0-9-]{36}$/i.test(identity.versionId||""),"The preview did not supply its runtime version identity.");
  progress("Reading " + labels[index] + " Preview deployment from Cloudflare.");
  const previewSlug=new URL(origins[index]).hostname.slice(0,-("-"+worker+".ryanschmidt224.workers.dev").length);
  const response=await fetcher("https://api.cloudflare.com/client/v4/accounts/"+account+"/workers/workers/"+worker+"/previews/"+encodeURIComponent(previewSlug)+"/deployments/"+identity.versionId,{headers:{authorization:"Bearer "+token},redirect:"error",signal:AbortSignal.timeout(30000)});
  requireValue(response.ok,"Cloudflare Preview deployment verification failed. No proof may run.",response.status);
  const body = await response.json();
  requireValue(body.success===true&&body.result?.id===identity.versionId,"Cloudflare Preview deployment verification failed. No proof may run.",response.status);
  progress("Checking " + labels[index] + " database, storage and engine flag bindings.");
  bindings.push({environment:origins[index],versionId:identity.versionId,cpuLimitMs:Number.isSafeInteger(body.result.limits?.cpu_ms)&&body.result.limits.cpu_ms>0?body.result.limits.cpu_ms:null,bindings:verifyBindings(body.result,databases[index])});
 }
 progress("Checking production remains gated.");
 for(const path of ["/api/project-engine/environment","/api/project-engine/proof","/project.html"]){const response=await fetcher("https://buildingschmidt.com"+path,{redirect:"error",signal:AbortSignal.timeout(30000)});requireValue(response.status===404,"Production must keep new-engine routes disabled before this preview proof.",response.status);}
 const stable=async index=>{const now=await readJSON(transports[index],"/api/project-engine/environment");requireValue(now.versionId===bindings[index].versionId,"The preview deployment changed during acceptance. Retain the partial evidence and rerun on stable deployments.");};
 const legacyReadOnly=[];for(let index=0;index<2;index++){progress("Checking deployed legacy read-only preservation…");await stable(index);legacyReadOnly.push({environment:origins[index],...await verifyLegacyReadOnly(transports[index])});await stable(index);}
 progress("Running guarded D1 command proof and identical replay…");await stable(0);
 const proofBody={operationId:crypto.randomUUID(),expectedRevision:null},proofOptions={method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(proofBody)};
 const foundation=await readJSON(transports[0],"/api/project-engine/proof",proofOptions),replayed=await readJSON(transports[0],"/api/project-engine/proof",proofOptions);
 requireValue(foundation.ok&&replayed.ok&&foundation.projectId===replayed.projectId&&JSON.stringify(foundation.counts)===JSON.stringify(replayed.counts),"The foundation proof replay changed its durable result.");await stable(0);
 const pair=[];
 for(const [name,run]of [["custom-part",runSourceRecoveryProof],["assembly-workshop",runAssemblySourceProof]]){
  progress("Running "+name+" source and independent recovery checks…");await stable(0);
  const sourceResult=await run(createProjectClient({fetcher:transports[0]}),{fetcher:transports[0],environment:sourceOrigin});await stable(0);await stable(1);
  const restored=await runRestoreRecoveryProof(sourceResult.backup,crypto.randomUUID(),createProjectClient({fetcher:transports[1]}),{fetcher:transports[1],environment:targetOrigin});
  requireValue(restored.targetWasAbsent,"This proof requires an initially absent recovery project.");await stable(1);
  const sourceIntegrity=await verifySourceRecoveryProof(sourceResult.backup,{fetcher:transports[0],environment:sourceOrigin});await stable(0);
  pair.push({name,source:sourceResult.report,restore:restored,sourceIntegrity});
 }
 return {ok:true,checkedAt:new Date().toISOString(),bindingEvidence:"Cloudflare Preview deployment API checked before proof writes; runtime identities rechecked at each phase.",deployments:bindings,legacyReadOnly,foundation,proofs:pair};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const {values}=parseArgs({options:{source:{type:"string"},target:{type:"string"},account:{type:"string"},report:{type:"string"}}});
  const report=await runPreviewAcceptance({...values,token:process.env.CLOUDFLARE_API_TOKEN,sourceCookie:process.env.SOURCE_SESSION_COOKIE,targetCookie:process.env.TARGET_SESSION_COOKIE,progress:message=>process.stderr.write(message+"\n")});
  const output=JSON.stringify(report,null,2)+"\n";if(values.report)await writeFile(values.report,output,{mode:0o600});else process.stdout.write(output);
 }catch{process.stderr.write("Preview acceptance did not pass. Check preview URLs, owner-session secrets, read-only Cloudflare access and bindings. No success report was produced.\n");process.exitCode=1;}
}
