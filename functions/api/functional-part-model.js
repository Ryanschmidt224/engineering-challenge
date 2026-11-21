// Functional-part identity and physical implementations have separate sources of truth.
// Stored records keep project-level identity, quantity and history outside the
// solution selection. No manufacturer, MPN, supplier or price is stored twice.
const SOLUTION_FIELDS=[
 "partType","manufacturer","model","supplier","asin","supplierOffers","category",
 "specifications","sharedPartRef","workshopChoice","historicalPrice",
 "historicalPriceDate","historicalPriceBasis","historicalPackageQuantity",
 "historicalPurchasePrice","photoRevision"
];
const PROJECT_SOLUTION_FIELDS=["workshopReferenceId","workshopTreeDescription"];
const emptySolution=()=>({
 partType:"purchased",manufacturer:"",model:"",supplier:"",asin:"",supplierOffers:[],
 category:"",specifications:[],sharedPartRef:null,workshopChoice:null,
 historicalPrice:null,historicalPriceDate:null,historicalPriceBasis:"per_part",
 historicalPackageQuantity:null,historicalPurchasePrice:null,photoRevision:null,
 workshopReferenceId:"",workshopTreeDescription:""
});
const implementationFields=(part)=>{
 const fields={};
 for(const key of SOLUTION_FIELDS)if(part[key]!==undefined)fields[key]=part[key];
 const details=part.projectDetails||{};
 for(const key of PROJECT_SOLUTION_FIELDS)if(details[key]!==undefined)fields[key]=details[key];
 return fields;
};
const solutionIdentity=(part)=>String(part.implementationName||part.model||part.name||"Implementation").trim().slice(0,180);
const isFunctional=part=>part&&!part.generatedFrom&&part.itemType!=="document"&&part.partType!=="code";
const legacySelection=part=>{
 const id="implementation-"+part.id;
 return {selectedId:id,candidates:[{...emptySolution(),...implementationFields(part),
  id,name:solutionIdentity(part),revision:part.revision||null,createdAt:part.createdAt||null}]};
};
function selectionOf(part){
 if(part?.selection&&Array.isArray(part.selection.candidates))return part.selection;
 return legacySelection(part);
}
export function resolveFunctionalPart(record){
 if(!isFunctional(record)&&!record?.selection)return record;
 const selection=selectionOf(record);
 const active=selection.candidates.find(candidate=>candidate.id===selection.selectedId)||null;
 const details={...(record.projectDetails||{})};
 for(const key of PROJECT_SOLUTION_FIELDS)delete details[key];
 if(active)for(const key of PROJECT_SOLUTION_FIELDS)details[key]=active[key]||"";
 const flattened={...emptySolution(),...(active||{})};
 for(const key of ["id","name","createdAt","revision",...PROJECT_SOLUTION_FIELDS])delete flattened[key];
 const result={
  ...record,...flattened,description:record.functional?.purpose??record.description??"",
  functionalRequirements:record.functional?.requirements??record.functionalRequirements??"",
  acceptanceCriteria:record.functional?.acceptanceCriteria??record.acceptanceCriteria??"",
  projectDetails:details,selection,
  implementations:selection.candidates,
  selectedImplementationId:selection.selectedId||null,
  resolvedImplementationId:active?.id||null,
  implementationName:active?.name||"",
  implementationRevision:active?.revision||null,
  implementationHistory:selection.history||[],
  implementationResolved:!!active,
  partSchemaVersion:2
 };
 // The top-level name is the stable functional identity, never the MPN.
 return result;
}
export function encodeFunctionalPart(part){
 if(!isFunctional(part)&&!part?.selection)return part;
 const selection=selectionOf(part);
 const candidates=selection.candidates.map(candidate=>({...candidate}));
 // Write edits to the implementation that was displayed to the user.
 // This remains correct even if a PATCH switches selectedId in the same request.
 const editedId=part.resolvedImplementationId||selection.selectedId;
 const active=candidates.find(candidate=>candidate.id===editedId);
 if(active){
  const fields=implementationFields(part);
  Object.assign(active,fields);
  if(part.implementationName!==undefined)active.name=String(part.implementationName).trim().slice(0,180)||active.name;
  active.revision=part.implementationRevision??active.revision??null;
 }
 const functional={...part.functional,
  purpose:String(part.description??part.functional?.purpose??"").trim().slice(0,2000),
  requirements:String(part.functionalRequirements??part.functional?.requirements??"").trim().slice(0,6000),
  acceptanceCriteria:String(part.acceptanceCriteria??part.functional?.acceptanceCriteria??"").trim().slice(0,6000)
 };
 const projectDetails={...(part.projectDetails||{})};
 for(const key of PROJECT_SOLUTION_FIELDS)delete projectDetails[key];
 const stored={...part,partSchemaVersion:2,functional,
  selection:{selectedId:selection.selectedId||null,candidates,history:[...(selection.history||[])]},projectDetails};
 for(const key of [...SOLUTION_FIELDS,...PROJECT_SOLUTION_FIELDS,"description","functionalRequirements","acceptanceCriteria",
  "implementations","implementationName","implementationRevision","implementationResolved",
  "selectedImplementationId","resolvedImplementationId","implementationHistory","workshopSourcing","workshopDocumentation"])delete stored[key];
 return stored;
}
export function changeImplementation(part,action,payload,now=new Date().toISOString()){
 const resolved=resolveFunctionalPart(part);
 const selection={selectedId:resolved.selection.selectedId,history:[...(resolved.selection.history||[])],
  candidates:resolved.selection.candidates.map(item=>({...item}))};
 // Flush edits to the previously displayed implementation before changing pointers.
 const flushed=encodeFunctionalPart({...resolved,selection});
 const next={...flushed,selection:flushed.selection};
 const previousId=next.selection.selectedId;
 if(action==="add"){
  if(next.selection.candidates.length>=24)throw Error("Maximum of 24 implementations per functional part");
  if(!payload||typeof payload.name!=="string"||!payload.name.trim()||payload.name.length>180)
   throw Error("Give the implementation a name");
  const type=["purchased","custom","custom_purchased"].includes(payload.partType)?payload.partType:"purchased";
  const id=crypto.randomUUID();
  const candidate={...emptySolution(),id,name:payload.name.trim(),partType:type,
   model:String(payload.model||"").trim().slice(0,300),
   manufacturer:String(payload.manufacturer||"").trim().slice(0,300),
   createdAt:now,revision:crypto.randomUUID(),photoRevision:crypto.randomUUID(),selectionReason:String(payload.reason||"").slice(0,1000)};
  next.selection.candidates.push(candidate);
  next.selection.selectedId=id;
 }else if(action==="select"){
  const id=payload?.id;
  if(id!==null&&!next.selection.candidates.some(candidate=>candidate.id===id))
   throw Error("Implementation not found");
  next.selection.selectedId=id;
 }else if(action==="retire"){
  const id=payload?.id;
  const candidate=next.selection.candidates.find(candidate=>candidate.id===id);
  if(!candidate)throw Error("Implementation not found");
  candidate.retiredAt=now;
  if(next.selection.selectedId===id)next.selection.selectedId=null;
 }else throw Error("Invalid implementation operation");
 if(action==="select"&&next.selection.selectedId&&
    next.selection.candidates.find(candidate=>candidate.id===next.selection.selectedId)?.retiredAt)
  throw Error("Retired implementation cannot be selected");
 if(previousId!==next.selection.selectedId){
  next.selection.history.push({at:now,from:previousId||null,to:next.selection.selectedId||null,
   reason:String(payload?.reason||"").slice(0,1000)});
  if(next.selection.history.length>300)next.selection.history=next.selection.history.slice(-300);
 }
 return resolveFunctionalPart(next);
}
export function implementationForBOM(part){
 const value=resolveFunctionalPart(part);
 if(value?.generatedFrom||value?.itemType==="document")return {status:"not-applicable",part:value};
 if(!value?.implementationResolved)return {status:"unselected",part:value};
 if(value.partType==="custom")return {status:"fabricate",part:value};
 return {status:"purchase",part:value};
}
