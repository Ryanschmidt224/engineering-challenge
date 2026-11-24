import {initializeWorkshop,dbRows} from "./workshop-db.js";
import {validateFamilyValues,resolveFamilyValues,validId,present} from "../../assets/family-model.js";
import {commitProjectCommand,CommandConflict} from "./project-command.js";
import {createItem} from "./project-workspace-commands.js";
import {statement,rows,itemContext,itemDetails,storedItem,buildContext,configurationPlan,currentEngineeringFile,addFileLinks,addEvent} from "./project-state.js";
import {captureProjectPart,entryEvidence} from "./project-part-snapshot.js";
import {bytesHash,MAX_ENGINE_FILE} from "./project-engine-files.js";
import {assertStorageKeyWritable} from "./project-storage-fence.js";
export async function workshopChoices(db,params){
 await initializeWorkshop(db);const familyId=params.get("family")||"",q=(params.get("q")||"").trim();if(q.length>180||familyId&&!validId(familyId))throw Error("Invalid Workshop search.");
 const families=await dbRows(db,"SELECT * FROM workshop_families WHERE archived=0 AND (?='' OR id=?) AND (?='' OR instr(lower(name||' '||description),lower(?))>0 OR id IN(SELECT family_id FROM workshop_products WHERE archived=0 AND instr(lower(name||' '||manufacturer||' '||mpn),lower(?))>0)) ORDER BY name,id LIMIT 51",familyId,familyId,familyId?"":q,q,q);
 const ids=families.slice(0,50).map(row=>row.id),products=await dbRows(db,"SELECT * FROM workshop_products WHERE archived=0 AND family_id IN(SELECT value FROM json_each(?)) AND (?='' OR instr(lower(name||' '||manufacturer||' '||mpn),lower(?))>0) ORDER BY name,id LIMIT 201",JSON.stringify(ids),q,q);
 const fields=familyId?await dbRows(db,"SELECT * FROM workshop_fields WHERE family_id=? ORDER BY sort_order,id",familyId):[];
 return {families:families.slice(0,50),products:products.slice(0,200),fields,more:families.length>50||products.length>200};
}
async function sourcePlan(env,project,input,data,previous=null){
 const db=env.WORKSHOP_DB;await initializeWorkshop(db);
 const selection=data.selection;if(!selection||!validId(selection.familyId)||selection.productId!==null&&!validId(selection.productId))throw Error("Choose a Workshop family and optional product.");
 const family=(await dbRows(db,"SELECT * FROM workshop_families WHERE id=? AND archived=0",selection.familyId))[0],product=selection.productId?(await dbRows(db,"SELECT * FROM workshop_products WHERE id=? AND family_id=? AND archived=0",selection.productId,selection.familyId))[0]:null;
 if(!family||selection.productId&&!product)throw Error("Choose an active family and product from the same family.");
 if(selection.expectedFamilyRevision!==family.revision||(selection.expectedProductRevision??null)!==(product?.revision??null))throw new CommandConflict("The Workshop source changed. Refresh the choices and review the new specifications before saving.");
 if(previous&&previous.family_id!==family.id)throw Error("Choose a product in the same family to preserve requirement identities. Add a separate part for a different family.");
 const fields=await dbRows(db,"SELECT * FROM workshop_fields WHERE family_id=? ORDER BY sort_order,id",family.id),requirements=data.requirements??previous?.requirements??{};validateFamilyValues(fields,requirements);
 for(const old of previous?.snapshot?.fields||[]){const current=fields.find(row=>row.id===old.id);if(present(requirements[old.id])&&current&&(old.type!==current.type||old.unit!==current.unit))throw Error("The Workshop field "+old.label+" changed type or unit. Clear its old project requirement before reloading; values are never converted automatically.");}
 const attachments=await dbRows(db,"SELECT * FROM workshop_attachments WHERE archived=0 AND (family_id=? OR product_id=?) ORDER BY id",family.id,product?.id||"");
 if(attachments.length>12)throw Error("This preview copies up to 12 Workshop documents/photos per selection. Review a smaller source set.");
 const documents=[],files=[];let total=0;
 for(const attachment of attachments){
  if(!attachment.r2_key){documents.push({title:attachment.title,url:attachment.url,kind:attachment.kind});continue;}
  const object=await env.PHOTOS.get(attachment.r2_key);if(!object||object.size>MAX_ENGINE_FILE)throw Error("A Workshop attachment is missing or exceeds 20 MB. No project part was saved.");
  total+=object.size;if(total>40*1024*1024)throw Error("Workshop attachments exceed the 40 MB preview selection limit.");
  const bytes=new Uint8Array(await object.arrayBuffer()),hash=await bytesHash(bytes),key="project-engine/workshop/"+project.id+"/"+input.operationId+"/"+attachment.id;
  await assertStorageKeyWritable(db,key);
  await env.PHOTOS.put(key,bytes,{onlyIf:{etagDoesNotMatch:"*"},httpMetadata:{contentType:attachment.media_type||"application/octet-stream"},customMetadata:{sha256:hash}});
  await assertStorageKeyWritable(db,key);
  const staged=await env.PHOTOS.get(key);if(!staged||staged.size!==bytes.length||await bytesHash(new Uint8Array(await staged.arrayBuffer()))!==hash)throw Error("A copied Workshop file failed verification.");
  const file={id:crypto.randomUUID(),project_id:project.id,name:attachment.title,content_type:attachment.media_type||"application/octet-stream",r2_key:key,state:"ready",size:bytes.length,sha256:hash};files.push(file);documents.push({title:attachment.title,kind:attachment.kind,file_id:file.id});
 }
 const resolved=resolveFamilyValues(fields,product?.field_values||{},requirements),snapshot={family:{id:family.id,name:family.name,kind:family.kind,description:family.description,revision:family.revision},product:product?{id:product.id,name:product.name,manufacturer:product.manufacturer,mpn:product.mpn,revision:product.revision,supplier_links:product.supplier_links,notes:product.notes}:null,fields:resolved.map(row=>Object.fromEntries(Object.entries(row).filter(([,value])=>value!==undefined))),documents};
 const frozen={family_id:family.id,product_id:product?.id||null,family_revision:family.revision,product_revision:product?.revision||null,snapshot,requirements};
 const details={name:product?.name||family.name,is_tool:family.kind==="tool",fields:{description:family.description,manufacturer:product?.manufacturer||"",mpn:product?.mpn||"",specs:resolved.map(row=>({field_id:row.id,label:row.label,unit:row.unit,...(row.value!==undefined?{value:row.value}:{})}))}};
 return {selection:frozen,details,files,write(w,itemId){
  w.require("EXISTS(SELECT 1 FROM workshop_families WHERE id=? AND revision=? AND archived=0)",family.id,family.revision);
  if(product)w.require("EXISTS(SELECT 1 FROM workshop_products WHERE id=? AND family_id=? AND revision=? AND archived=0)",product.id,family.id,product.revision);
  w.require("(SELECT COUNT(*) FROM workshop_attachments WHERE archived=0 AND (family_id=? OR product_id=?))=?",family.id,product?.id||"",attachments.length);
  for(const attachment of attachments)w.require("EXISTS(SELECT 1 FROM workshop_attachments WHERE id=? AND revision=? AND archived=0)",attachment.id,attachment.revision);
  const row={...frozen,id:itemId,project_id:project.id,snapshot:JSON.stringify(snapshot),requirements:JSON.stringify(requirements)};
  if(previous)w.update("engine_selections",Object.fromEntries(Object.entries(row).filter(([key])=>!["id","project_id"].includes(key))),{project_id:project.id,id:itemId});else w.insert("engine_selections",row);
  for(const file of files)w.insert("engine_files",{...file,created_at:w.createdAt});
 }};
}
export async function createWorkshopItem(env,input,project,data){const plan=await sourcePlan(env,project,input,data);return createItem(env.WORKSHOP_DB,input,project,{...data,details:{...plan.details,name:data.name||plan.details.name,short_name:data.short_name||"",fields:{...plan.details.fields,...(data.purpose?{purpose:data.purpose}:{})}}},{selectionPlan:plan});}
export async function selectWorkshopProduct(env,input,project,itemId,data){
 const db=env.WORKSHOP_DB,{item,occurrence}=await itemContext(db,project.id,itemId,{occurrenceId:data.occurrenceId,requireOccurrence:true}),raw=await statement(db,"SELECT * FROM engine_selections WHERE project_id=? AND id=?",project.id,itemId).first();
 if(!raw)throw Error("This part has no Workshop family selection.");
 const previous={...raw,snapshot:JSON.parse(raw.snapshot),requirements:JSON.parse(raw.requirements)},plan=await sourcePlan(env,project,input,data,previous),old=itemDetails(item),details={...old,is_tool:plan.details.is_tool,fields:{...old.fields,...plan.details.fields,purpose:old.fields.purpose||""}},level=item.revision_level||1,evidence=await entryEvidence(db,project,data),capture=await captureProjectPart(db,project,item,occurrence),snapshot=capture.snapshot;
 const file=await currentEngineeringFile(db,project.id,itemId),before=await configurationPlan(db,project,item,occurrence,file),after=await configurationPlan(db,project,{...item,...details,revision_level:level+1},occurrence,file,{selection:{...plan.selection,id:itemId,project_id:project.id},cache:before.cache});
 return commitProjectCommand(db,input,w=>{capture.write(w);before.write(w);plan.write(w,itemId);w.update("engine_items",{...storedItem(details),revision_level:level+1},{project_id:project.id,id:itemId});after.write(w);addFileLinks(w,project.id,{configuration_id:after.id},plan.files);const eventId=addEvent(w,project.id,itemId,"revision","Revision "+level,{level,before:before.id,after:after.id,snapshot,entryDetails:evidence.details,build_context:{before:buildContext(project,occurrence,item),after:buildContext(project,occurrence,{...item,revision_level:level+1})},source:{id:itemId,name:item.name,part_number:item.part_number},selectionChange:true});addFileLinks(w,project.id,{event_id:eventId},evidence.photos);return {itemId,occurrenceId:occurrence.id,eventId,configurationId:after.id};});
}
