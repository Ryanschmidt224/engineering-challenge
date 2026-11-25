import {parseArgs} from "node:util";
import {pathToFileURL} from "node:url";
import {writeFile,mkdir} from "node:fs/promises";
import {dirname} from "node:path";
import {createProjectClient} from "../assets/project-client.js";
import {backupAt,manifestOf,digest,runRestoreRecoveryProof,verifySourceRecoveryProof} from "../assets/project-recovery-proof.js";
import {canonicalJSON} from "../functions/api/project-command.js";
import {previewOrigin,previewTransport,runPreviewAcceptance} from "./preview-acceptance.mjs";
import {makeCapacityFixture} from "./preview-capacity-fixture.mjs";

export const CAPACITY_COUNTS=[1000,2500,3000,5000,10000];
const check=(value,message)=>{if(!value)throw Error(message);};
const hash=value=>digest(new TextEncoder().encode(typeof value==="string"?value:canonicalJSON(value)));
const median=values=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.floor(sorted.length/2)];};

// Uses the unchanged authenticated project APIs. No new Worker route, SQL
// endpoint, migration, cleanup action, provider lookup or production write.
export async function runPreviewCapacity(options,{recordCounts=[3000,10000],onCheckpoint=async()=>{}}={}){
 const report={ok:false,status:"running",phase:"preflight",checkedAt:new Date().toISOString(),runnerNode:process.version,runnerGitCommit:process.env.GITHUB_SHA||null,scenarios:[],limitations:[
  "HTTP timings include transport, authentication and application work; they are not exact D1 SQL execution or Worker CPU measurements.",
  "A successful revision request bounds its complete guarded batch by the measured request duration; no exact per-statement CPU/SQL duration is claimed.",
  "No cleanup intent is created. Trigger-state comparison and Worker CPU/limit evidence still require the separately reviewed operator measurement.",
  "Successful samples do not change production bounds or authorize activation by themselves."
 ]};
 let scenario=null;
 const phase=async name=>{report.phase=name;await onCheckpoint(report);};
 async function timed(name,operation){
  await phase(name);const started=performance.now();
  try{const value=await operation();return {value,elapsedMs:Number((performance.now()-started).toFixed(2))};}
  catch(error){if(scenario)scenario.failedRequestElapsedMs=Number((performance.now()-started).toFixed(2));throw error;}
 }
 try{
  check(recordCounts.length>0&&new Set(recordCounts).size===recordCounts.length&&recordCounts.every(value=>CAPACITY_COUNTS.includes(value)),"Choose a supported capacity profile.");
  // Includes cookie presence, both actual runtime versions/control-plane
  // bindings, production-off checks and the full functional proof matrix.
  report.functionalAcceptance = await runPreviewAcceptance({
   ...options,
   progress: message => {
    report.acceptanceStep = message;
    options.progress?.(message);
   }
  });
  await phase("functional-acceptance-passed");
  const source=previewOrigin(options.source),target=previewOrigin(options.target),fetcher=options.fetcher||fetch;
  // Large request deadline is an operator transport setting, not a Worker or
  // database limit. Existing origin/credential containment remains in use.
  const largeFetch=async(url,request)=>{
   const parsed=new URL(url),entry={phase:report.phase,method:request.method||"GET",origin:parsed.origin,path:parsed.pathname},started=performance.now();
   if(scenario)(scenario.requests||=[]).push(entry);
   const response=await fetcher(url,{...request,signal:AbortSignal.timeout(120000)});
   entry.elapsedToHeadersMs=Number((performance.now()-started).toFixed(2));entry.status=response.status;entry.cfRay=response.headers.get("cf-ray");return response;
  };
  const sourceFetch=previewTransport(source,options.sourceCookie,largeFetch),targetFetch=previewTransport(target,options.targetCookie,largeFetch);
  const sourceClient=createProjectClient({fetcher:sourceFetch}),targetClient=createProjectClient({fetcher:targetFetch});
  const stable=async()=>{
   for(const [index,transport]of [sourceFetch,targetFetch].entries()){
    const response=await transport("/api/project-engine/environment");check(response.ok,"Runtime identity could not be rechecked.");
    check((await response.json()).versionId===report.functionalAcceptance.deployments[index].versionId,"Deployment changed during capacity measurement.");
   }
  };
  for(const recordCount of recordCounts){
   scenario={recordCount,notePaddingCharactersPerRecord:600,drawingBytes:3*1024*1024,revisionCount:6,ordinarySaveSamplesMs:[],revisionSamples:[]};report.scenarios.push(scenario);
   await phase("recheck-runtime-"+recordCount);await stable();
   const generated=await timed("prepare-local-fixture-"+recordCount,()=>makeCapacityFixture(recordCount)),seed=generated.value;
   scenario.localPreparationMs=generated.elapsedMs;scenario.projectId=seed.projectId;scenario.itemId=seed.itemId;scenario.seedBackupBytes=Buffer.byteLength(seed.backup);
   const listed=await sourceClient.request("");check(!listed.projects.some(row=>row.id===seed.projectId),"Synthetic source identity already exists; refusing admission.");
   scenario.sourceImportOperationId=crypto.randomUUID();
   const imported=await timed("source-seed-import-"+recordCount,()=>sourceClient.request("/"+seed.projectId+"/import",{method:"POST",headers:{"x-operation-id":scenario.sourceImportOperationId,"x-project-revision":"new"},body:seed.backup}));
   scenario.seedImportMs=imported.elapsedMs;scenario.seedRecovery=imported.value.recovery;await stable();
   const state=await sourceClient.load(seed.projectId),item=state.items.find(row=>row.id===seed.itemId);
   check(state.records.length===recordCount&&item,"Imported synthetic fixture differs.");
   const details={name:item.name,part_number:item.part_number,kind:item.kind,source:item.source,is_tool:!!item.is_tool,fields:structuredClone(item.fields)};
   for(let sample=0;sample<5;sample++){
    details.fields.description="Synthetic ordinary-save sample "+sample;
    const saved=await timed("ordinary-save-"+recordCount+"-"+sample,()=>sourceClient.write(seed.projectId,"/items/"+seed.itemId,"PATCH",{details}));
    scenario.ordinarySaveSamplesMs.push(saved.elapsedMs);
   }
   scenario.medianOrdinarySaveMs=median(scenario.ordinarySaveSamplesMs);
   for(let index=0;index<6;index++){
    const data={entryDetails:{whatChanged:"Synthetic capacity checkpoint "+(index+1),whyChanged:"Measure retained history at "+recordCount+" records"}},expected=sourceClient.state.project.revision;
    const saved=await timed("revision-"+recordCount+"-"+(index+1),()=>sourceClient.write(seed.projectId,"/items/"+seed.itemId+"/revisions","POST",data,expected));
    const retry=await sourceClient.write(seed.projectId,"/items/"+seed.itemId+"/revisions","POST",data,expected);
    check(retry.eventId===saved.value.eventId&&retry.revision===saved.value.revision,"Revision retry did not replay.");
    const detail=await sourceClient.request("/"+seed.projectId+"/history/"+saved.value.eventId);
    check(detail.event.payload.snapshot.records.length===recordCount,"Historical revision is incomplete.");
    scenario.revisionSamples.push({eventId:saved.value.eventId,elapsedMs:saved.elapsedMs,snapshotSha256:await hash(detail.event.payload.snapshot)});
   }
   scenario.firstRevisionRequestUpperBoundMs=scenario.revisionSamples[0].elapsedMs;
   const exported=await timed("source-export-"+recordCount,()=>backupAt(seed.projectId,sourceFetch)),backup=exported.value,manifest=manifestOf(backup);
   scenario.exportMs=exported.elapsedMs;scenario.backupBytes=Buffer.byteLength(backup);scenario.backupSha256=await hash(backup);
   scenario.counts=Object.fromEntries(Object.entries(manifest.tables).map(([name,rows])=>[name,rows.length]));scenario.frozenValueRows=manifest.tables.snapshot_values.length;
   check(manifest.tables.records.length===recordCount&&manifest.tables.files.some(row=>row.id===seed.drawingId&&row.size===scenario.drawingBytes),"Export lost records or drawing metadata.");
   await stable();scenario.targetImportOperationId=crypto.randomUUID();
   const recordingTarget={request:async(path,request)=>{
    if(!path.endsWith("/import"))return targetClient.request(path,request);
    const restored=await timed("target-import-"+recordCount,()=>targetClient.request(path,request));
    (scenario.restoreRequests||=[]).push({elapsedMs:restored.elapsedMs,recovery:restored.value.recovery});return restored.value;
   }};
   const recovered=await timed("target-restore-and-verification-"+recordCount,()=>runRestoreRecoveryProof(backup,scenario.targetImportOperationId,recordingTarget,{fetcher:targetFetch,environment:target}));
   scenario.restoreProof=recovered.value;scenario.restoreAndVerificationMs=recovered.elapsedMs;check(recovered.value.targetWasAbsent,"Recovery target was not absent.");
   await phase("verify-restored-history-"+recordCount);
   for(const revision of scenario.revisionSamples){
    const detail=await targetClient.request("/"+seed.projectId+"/history/"+revision.eventId);
    check(await hash(detail.event.payload.snapshot)===revision.snapshotSha256,"Restored historical revision differs.");
   }
   await phase("verify-unchanged-source-"+recordCount);
   scenario.sourceIntegrity=await verifySourceRecoveryProof(backup,{fetcher:sourceFetch,environment:source});await stable();scenario.ok=true;await phase("scenario-passed-"+recordCount);
  }
  report.ok=true;report.status="measured-samples-passed";report.phase="complete";
  report.productionReadiness="Not decided. Review these samples and the listed CPU/trigger-state measurement gaps before activation.";
 }catch(error){
  report.status="failed";report.failure={phase:report.phase,httpStatus:Number.isInteger(error.status)?error.status:null,message:"Measurement did not pass. Retained phase/project/operation IDs are for inspection; no project was deleted and no production acceptance is claimed."};
 }
 report.finishedAt=new Date().toISOString();await onCheckpoint(report);return report;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const {values}=parseArgs({options:{source:{type:"string"},target:{type:"string"},account:{type:"string"},report:{type:"string"},profile:{type:"string",default:"capacity-3000"}}});
  check(values.report,"Provide a protected report destination.");
  const profiles={"capacity-1000":[1000],"capacity-3000":[3000],"capacity-10000":[10000],"capacity-matrix":CAPACITY_COUNTS};check(Object.hasOwn(profiles,values.profile),"Choose a supported capacity profile.");
  await mkdir(dirname(values.report),{recursive:true});
  const result = await runPreviewCapacity({
   ...values,
   token: process.env.CLOUDFLARE_API_TOKEN,
   sourceCookie: process.env.SOURCE_SESSION_COOKIE,
   targetCookie: process.env.TARGET_SESSION_COOKIE,
   progress: message => process.stderr.write(message + "\n")
  }, {
   recordCounts: profiles[values.profile],
   onCheckpoint: report => writeFile(values.report, JSON.stringify(report, null, 2) + "\n", {mode: 0o600})
  });
  process.stderr.write(result.ok?"Measured capacity samples passed; review the recorded limitations before activation.\n":"Capacity measurement did not pass; inspect its non-secret report.\n");if(!result.ok)process.exitCode=1;
 }catch{process.stderr.write("Capacity runner could not start. Check its profile, protected report path and securely supplied preview credentials.\n");process.exitCode=1;}
}
