import {verifyDocumentCompletion} from "./workshop-document-completion.js";
import {normalizeLookupProvenance} from "../../assets/workshop-lookup-provenance.js";
import {migrateWorkshop} from "./workshop-migrations.js";
import {validateFamilyFields,validateFamilyValues,validId,isWebUrl,familyUsePart} from "../../assets/family-model.js";
import {isAdmin} from "./auth.js";
import {projectAllowed} from "./projects.js";
import {projectSelectionUses} from "./project-selection-uses.js";
import {legacyProjectsReadOnly,legacyReadOnlyResponse} from "./legacy-projects.js";

const json = (data,status=200) => Response.json(data,{status,headers:{"cache-control":"private, no-store","x-content-type-options":"nosniff"}});
const tables = {category:"workshop_categories",family:"workshop_families",product:"workshop_products",use:"workshop_uses",attachment:"workshop_attachments"};
const stmt = (db,sql,...values) => db.prepare(sql).bind(...values);
const parseRow = row => row && Object.fromEntries(Object.entries(row).map(([key,value])=>[key,["choices","field_values","supplier_links","project_state","lookup_provenance"].includes(key)?JSON.parse(value):value]));
export const dbRows = async (db,sql,...values) => (await stmt(db,sql,...values).all()).results.map(parseRow);
export async function initializeWorkshop(db) {
 if(!db)throw Error("The Workshop database is not bound to this deployment.");
 // A binding can outlive the request that created a promise. Keep setup local
 // to this request; the database ledger already makes migrations race-safe.
 await migrateWorkshop(db);
}
export async function workshopSnapshot(db) {
 const names=["categories","families","fields","products","uses","attachments"];
 const results=await db.batch(names.map(name=>db.prepare("SELECT * FROM workshop_"+name)));
 return Object.fromEntries(names.map((name,index)=>[name,results[index].results.map(parseRow)]));
}
function text(value,max=180,required=false) {
 if(value===undefined||value===null)value="";
 if(typeof value!=="string"||value.length>max||required&&!value.trim())throw Error("Enter valid text"+(required?" (required)":"")+" of at most "+max+" characters.");
 return value.trim();
}
function revision(input) {
 if(input.expectedRevision!==null&&(!Number.isInteger(input.expectedRevision)||input.expectedRevision<1))throw Error("Provide the revision you opened, or null for a new record.");
}
async function writeSimple(db,table,row,expected,familyGuard=null) {
 const keys=Object.keys(row).filter(key=>key!=="id");
 const condition=familyGuard?" AND EXISTS(SELECT 1 FROM workshop_families WHERE id=? AND revision=?)":"";
 const guards=familyGuard?[familyGuard.id,familyGuard.revision]:[];
 const result=expected===null
  ?await stmt(db,`INSERT INTO ${table} (id,${keys.join(",")}) SELECT ?,${keys.map(()=>"?").join(",")} WHERE 1=1${condition}`,row.id,...keys.map(key=>row[key]),...guards).run()
  :await stmt(db,`UPDATE ${table} SET ${keys.map(key=>key+"=?").join(",")},revision=revision+1 WHERE id=? AND revision=?${condition}`,...keys.map(key=>row[key]),row.id,expected,...guards).run();
 if(!result.meta.changes)return null;
 return parseRow(await stmt(db,"SELECT * FROM "+table+" WHERE id=?",row.id).first());
}
async function assemblyFor(env,project,id) {
 if(!id||id==="__root__")return null;
 const file=await env.PHOTOS.get("trees/"+project+".json");
 const nodes=file?JSON.parse(await file.text()):[];
 if(typeof id!=="string"||!nodes.some(node=>node.id===id&&node.kind!=="part"))throw Error("Choose an existing project assembly, or the project root.");
 return id;
}
export async function saveFamily(db,record,expected) {
 validateFamilyFields(record.fields);
 const token=crypto.randomUUID(),columns=["category_id","name","kind","description","notes","mutation_id"];
 if(!["part","material","tool"].includes(record.kind))throw Error("Choose Part, Material or Tool.");
 const values=[record.category_id||null,text(record.name,180,true),record.kind,text(record.description,2000),text(record.notes,12000),token];
 const previousIds=await dbRows(db,"SELECT * FROM workshop_fields WHERE family_id=?",record.id);
 for(const field of record.fields){
  const existing=await stmt(db,"SELECT family_id FROM workshop_fields WHERE id=?",field.id).first();
  if(existing&&existing.family_id!==record.id)throw Error("A field ID belongs to another family.");
 }
 const header=expected===null?stmt(db,`INSERT INTO workshop_families(id,${columns.join(",")}) VALUES(?,${columns.map(()=>"?")})`,record.id,...values)
  :stmt(db,`UPDATE workshop_families SET ${columns.map(key=>key+"=?")},revision=revision+1 WHERE id=? AND revision=?`,...values,record.id,expected);
 const updates=record.fields.map((field,index)=>stmt(db,`INSERT INTO workshop_fields(id,family_id,label,unit,type,choices,sort_order,hidden,filled_on_use)
 SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM workshop_families WHERE id=? AND mutation_id=?)
 ON CONFLICT(id) DO UPDATE SET label=excluded.label,unit=excluded.unit,type=excluded.type,choices=excluded.choices,sort_order=excluded.sort_order,hidden=excluded.hidden,filled_on_use=excluded.filled_on_use
 WHERE workshop_fields.family_id=excluded.family_id`,field.id,record.id,text(field.label,100,true),field.unit,field.type,JSON.stringify(field.choices),index,field.hidden?1:0,field.filled_on_use?1:0,record.id,token));
 const kept=new Set(record.fields.map(field=>field.id));
 for(const field of previousIds)if(!kept.has(field.id))updates.push(stmt(db,"UPDATE workshop_fields SET hidden=1 WHERE id=? AND EXISTS(SELECT 1 FROM workshop_families WHERE id=? AND mutation_id=?)",field.id,record.id,token));
 const results=await db.batch([header,...updates]);
 if(!results[0].meta.changes)return null;
 return parseRow(await stmt(db,"SELECT * FROM workshop_families WHERE id=?",record.id).first());
}
export async function saveWorkshopEntity(request,env,input) {
 const db=env.WORKSHOP_DB,{entity,record}=input; revision(input);
 if(!tables[entity]||!record||!validId(record.id))throw Error("Invalid Workshop record.");
 const previous=await stmt(db,"SELECT * FROM "+tables[entity]+" WHERE id=?",record.id).first();
 if(input.expectedRevision===null?!!previous:!previous||previous.revision!==input.expectedRevision)return null;
 if(entity==="family")return saveFamily(db,record,input.expectedRevision);
 if(entity==="category")return writeSimple(db,tables.category,{id:record.id,parent_id:record.parent_id||null,name:text(record.name,100,true),sort_order:Number.isInteger(record.sort_order)?record.sort_order:0},input.expectedRevision);
 if(entity==="product"||entity==="use"){
  const family=await stmt(db,"SELECT * FROM workshop_families WHERE id=? AND archived=0",record.family_id).first();
  if(!family)throw Error("Choose an active family.");
  if(input.expectedFamilyRevision!==family.revision)return null;
  if(previous&&previous.family_id!==family.id)throw Error("Moving an existing record to another family requires a reviewed field mapping. Create a new record in that family instead.");
  const fields=await dbRows(db,"SELECT * FROM workshop_fields WHERE family_id=?",family.id);
  validateFamilyValues(fields,record.field_values);
  if(entity==="product"){
   const rawSuppliers=record.supplier_links||[];
   if(!Array.isArray(rawSuppliers)||rawSuppliers.length>20)throw Error("Use at most 20 supplier links.");
   const suppliers=rawSuppliers.map(supplier=>{
    if(!supplier||typeof supplier!=="object"||Array.isArray(supplier))throw Error("Invalid supplier link.");
    const url=text(supplier.url,1200);if(url&&!isWebUrl(url))throw Error("Supplier links need an http or https URL.");
    return {supplier:text(supplier.supplier,120),part_number:text(supplier.part_number,160),url};
   });
   const provenance=normalizeLookupProvenance(record,fields,parseRow(previous)||{});await verifyDocumentCompletion(env,record.id,provenance,parseRow(previous)?.lookup_provenance);
   return writeSimple(db,tables.product,{id:record.id,family_id:family.id,name:text(record.name,180,true),manufacturer:text(record.manufacturer),mpn:text(record.mpn),supplier_links:JSON.stringify(suppliers),notes:text(record.notes,12000),field_values:JSON.stringify(record.field_values),lookup_provenance:JSON.stringify(provenance)},input.expectedRevision,family);
  }
  if(!await projectAllowed(env,record.project_id,request))throw Error("Project not found.");
  if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(record.id))throw Error("Project uses require UUID identifiers.");
  if(previous&&previous.project_id!==record.project_id)throw Error("Create a new use to copy this part into another project.");
  if(record.quantity!==null&&(!Number.isFinite(record.quantity)||record.quantity<0))throw Error("Quantity must be zero or greater, or blank.");
  const product=record.product_id?await stmt(db,"SELECT * FROM workshop_products WHERE id=? AND family_id=?",record.product_id,family.id).first():null;
  if(record.product_id&&!product)throw Error("The selected product does not belong to this family.");
  if(product?.archived&&previous?.product_id!==product.id)throw Error("Restore the product before selecting it for a new use.");
  const assembly=await assemblyFor(env,record.project_id,record.tree_node_id);
  return writeSimple(db,tables.use,{id:record.id,project_id:record.project_id,tree_node_id:assembly,family_id:family.id,product_id:record.product_id||null,purpose:text(record.purpose,180),quantity:record.quantity,unit:text(record.unit,32)||"pcs",field_values:JSON.stringify(record.field_values),notes:text(record.notes,12000)},input.expectedRevision,family);
 }
 if(entity==="attachment"){
  if(!["family","product","use"].includes(record.owner_type)||!validId(record.owner_id))throw Error("Choose an attachment owner.");
  if(!isWebUrl(record.url))throw Error("Enter an http or https reference link.");
  return writeSimple(db,tables.attachment,{id:record.id,family_id:record.owner_type==="family"?record.owner_id:null,product_id:record.owner_type==="product"?record.owner_id:null,use_id:record.owner_type==="use"?record.owner_id:null,title:text(record.title,180,true),url:record.url,r2_key:null,kind:text(record.kind,30)||"document"},input.expectedRevision);
 }
}
export async function handleFamilyWorkshop(request,env) {
 if(!await isAdmin(request,env))return json({error:"Owner sign-in required"},401);
 if(!["GET","HEAD"].includes(request.method)&&request.headers.get("origin")!==new URL(request.url).origin)return json({error:"Invalid request origin"},403);
 if(!env.WORKSHOP_DB)return json({error:"Workshop database is not configured",code:"WORKSHOP_SETUP_REQUIRED"},503);
 await initializeWorkshop(env.WORKSHOP_DB);
 if(request.method==="GET"){const snapshot=await workshopSnapshot(env.WORKSHOP_DB);if(env.NEW_PROJECT_ENGINE==="1")snapshot.project_uses=await projectSelectionUses(request,env);return json(snapshot);}
 if(!["POST","PATCH"].includes(request.method))return json({error:"Method not allowed"},405);
 let input;
 try{
  const raw=await request.text();if(raw.length>128*1024)return json({error:"Record is too large"},413);input=JSON.parse(raw);
  // Workshop families/products remain editable. Uses and their attachments
  // belong to the preserved legacy projects, including edits of existing links.
  if(legacyProjectsReadOnly(env)){
   if(input.entity==="use"||input.entity==="attachment"&&input.record?.owner_type==="use")return legacyReadOnlyResponse();
   const attachmentId=request.method==="PATCH"?input.id:input.record?.id;
   if(input.entity==="attachment"&&validId(attachmentId)&&await stmt(env.WORKSHOP_DB,"SELECT id FROM workshop_attachments WHERE id=? AND use_id IS NOT NULL",attachmentId).first())return legacyReadOnlyResponse();
  }
  if(request.method==="PATCH"){
   revision(input);if(!tables[input.entity]||!validId(input.id)||typeof input.archived!=="boolean")throw Error("Invalid archive request.");
   if(input.entity==="category"&&input.archived){
    const dependents=await stmt(env.WORKSHOP_DB,"SELECT id FROM workshop_categories WHERE parent_id=? AND archived=0 UNION ALL SELECT id FROM workshop_families WHERE category_id=? AND archived=0",input.id,input.id).first();
    if(dependents)throw Error("Move or archive the category's children first.");
   }
   const result=await stmt(env.WORKSHOP_DB,"UPDATE "+tables[input.entity]+" SET archived=?,revision=revision+1 WHERE id=? AND revision=?",input.archived?1:0,input.id,input.expectedRevision).run();
   return result.meta.changes?json({ok:true}):json({error:"This record changed in another tab. Your draft is preserved.",code:"WORKSHOP_CONFLICT"},409);
  }
  const record=await saveWorkshopEntity(request,env,input);
  return record?json({record}):json({error:"This record changed in another tab. Your draft is preserved.",code:"WORKSHOP_CONFLICT"},409);
 }catch(error){
  const message=String(error.message||error);
  if(/UNIQUE constraint/.test(message))return json({error:"That record already exists. Reload to check whether your previous save succeeded.",code:"WORKSHOP_CONFLICT"},409);
  if(/POPULATED_FIELD/.test(message))return json({error:"A populated field cannot change type, unit or choices. Add a new field instead; existing values are preserved."},409);
  if(/CATEGORY_CYCLE/.test(message))return json({error:"A category cannot be moved inside itself."},400);
  if(/FOREIGN KEY/.test(message))return json({error:"A referenced category, family, product or use is missing or belongs to another family."},400);
  return json({error:message.slice(0,400)},400);
 }
}
export async function projectFamilyParts(env,project) {
 if(!env.WORKSHOP_DB)return [];
 await initializeWorkshop(env.WORKSHOP_DB);
 const snapshot=await workshopSnapshot(env.WORKSHOP_DB);
 return snapshot.uses.filter(use=>!use.archived&&use.project_id===project).map(use=>{
  const family=snapshot.families.find(family=>family.id===use.family_id), product=snapshot.products.find(product=>product.id===use.product_id);
  if(!family)return null;
  const attachments=snapshot.attachments.filter(file=>!file.archived&&(file.family_id===family.id||file.product_id===product?.id||file.use_id===use.id));
  return familyUsePart(use,family,product,snapshot.fields.filter(field=>field.family_id===family.id),attachments);
 }).filter(Boolean);
}
// Tree links are a projection of uses; D1 owns membership and assembly placement.
// Removing a use never deletes its instructions or historical R2 files.
export async function projectUseTree(env,project,nodes) {
 if(!env.WORKSHOP_DB)return nodes;
 await initializeWorkshop(env.WORKSHOP_DB);
 const uses=await dbRows(env.WORKSHOP_DB,"SELECT u.*,f.name AS family_name FROM workshop_uses u JOIN workshop_families f ON f.id=u.family_id WHERE project_id=?",project);
 const ids=new Set(uses.map(use=>use.id)),active=uses.filter(use=>!use.archived);
 const result=nodes.filter(node=>node.kind!=="part"||!ids.has(node.partId)||active.some(use=>use.id===node.partId)).map(node=>({...node}));
 for(const use of active){
  const parent=result.some(node=>node.id===use.tree_node_id&&node.kind!=="part")?use.tree_node_id:null;
  const linked=result.find(node=>node.kind==="part"&&node.partId===use.id);
  if(linked){linked.name=use.purpose||use.family_name;linked.parentId=parent;}
  else result.push({id:"part-"+use.id,kind:"part",partId:use.id,name:use.purpose||use.family_name,parentId:parent});
 }
 return result;
}
export async function getFamilyProjectPart(env,project,id){
 if(!env.WORKSHOP_DB)return null;
 await initializeWorkshop(env.WORKSHOP_DB);
 const use=(await dbRows(env.WORKSHOP_DB,"SELECT * FROM workshop_uses WHERE id=? AND project_id=? AND archived=0",id,project))[0];
 if(!use)return null;
 const family=(await dbRows(env.WORKSHOP_DB,"SELECT * FROM workshop_families WHERE id=?",use.family_id))[0];
 const product=use.product_id?(await dbRows(env.WORKSHOP_DB,"SELECT * FROM workshop_products WHERE id=?",use.product_id))[0]:null;
 const fields=await dbRows(env.WORKSHOP_DB,"SELECT * FROM workshop_fields WHERE family_id=?",use.family_id);
 const attachments=await dbRows(env.WORKSHOP_DB,"SELECT * FROM workshop_attachments WHERE archived=0 AND (family_id=? OR product_id=? OR use_id=?)",use.family_id,use.product_id,id);
 return familyUsePart(use,family,product,fields,attachments);
}
export async function changeFamilyProjectPart(request,env,project,id,input){
 const db=env.WORKSHOP_DB,use=(await dbRows(db,"SELECT * FROM workshop_uses WHERE id=? AND project_id=? AND archived=0",id,project))[0];
 if(!use)return json({error:"Project use not found"},404);
 if(String(input.expectedRevision)!==String(use.revision))return json({error:"This project use changed in another tab. Your draft is preserved."},409);
 if(request.method==="DELETE"){
  const result=await stmt(db,"UPDATE workshop_uses SET archived=1,revision=revision+1 WHERE id=? AND revision=?",id,use.revision).run();
  return result.meta.changes?json({ok:true}):json({error:"Project use changed"},409);
 }
 if(request.method!=="PATCH")return json({error:"Edit this project use in the Workshop family form."},409);
 const state={...use.project_state};
 if(input.progressStatus!==undefined){if(!["not_started","in_progress","complete"].includes(input.progressStatus))return json({error:"Invalid progress"},400);state.progressStatus=input.progressStatus;}
 for(const key of ["needsAttention","hideFromFeatureTree"])if(input[key]!==undefined){if(typeof input[key]!=="boolean")return json({error:"Invalid option"},400);state[key]=input[key];}
 if(input.attentionNote!==undefined){if(typeof input.attentionNote!=="string"||input.attentionNote.length>6000)return json({error:"Attention note is too long"},400);state.attentionNote=input.attentionNote;}
 if(input.quantity!==undefined){if(input.quantity!==null&&(!Number.isFinite(input.quantity)||input.quantity<0))return json({error:"Invalid quantity"},400);use.quantity=input.quantity;}
 if(input.name!==undefined)use.purpose=text(input.name,180,true);
 if(input.assemblyId!==undefined)use.tree_node_id=await assemblyFor(env,project,input.assemblyId);
 if(input.purchaseStatus!==undefined){if(!["not_started","already_have","need_to_buy","ignore"].includes(input.purchaseStatus))return json({error:"Invalid purchase status"},400);state.purchaseStatus=input.purchaseStatus;}
 const updates=structuredClone(state.progressUpdates||[]);
 if(input.progressOperationAdd!==undefined){if(input.progressOperationAdd!==true||updates.length>=200)return json({error:"Progress is limited to 200 operations"},400);updates.push({id:crypto.randomUUID(),text:"",createdAt:new Date().toISOString()});}
 if(input.progressOperationEdit!==undefined){const edit=input.progressOperationEdit,entry=updates.find(item=>item.id===edit?.id);if(!entry||typeof edit.text!=="string"||edit.text.length>500)return json({error:"Invalid progress operation"},400);entry.text=edit.text.trim();}
 if(input.progressOperationAdd||input.progressOperationEdit)state.progressUpdates=updates;
 const supported=new Set(["expectedRevision","progressStatus","needsAttention","hideFromFeatureTree","attentionNote","quantity","quantityUnit","name","assemblyId","purchaseStatus","progressOperationAdd","progressOperationEdit"]);
 if(Object.keys(input).some(key=>!supported.has(key)))return json({error:"Open the project use in Workshop to edit these details."},409);
 const result=await stmt(db,"UPDATE workshop_uses SET purpose=?,quantity=?,unit=?,tree_node_id=?,project_state=?,revision=revision+1 WHERE id=? AND revision=?",use.purpose,use.quantity,input.quantityUnit===undefined?use.unit:text(input.quantityUnit,32),use.tree_node_id,JSON.stringify(state),id,use.revision).run();
 return result.meta.changes?json({component:await getFamilyProjectPart(env,project,id)}):json({error:"Project use changed in another tab"},409);
}
