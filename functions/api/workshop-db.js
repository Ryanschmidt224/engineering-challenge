import {workshopSchema} from "./workshop-schema.js";
import {starterCategories,starterFamilies,starterFields} from "./workshop-seed.js";
import {validateFamilyFields,validateFamilyValues,validId,isWebUrl,familyUsePart} from "../../assets/family-model.js";
import {isAdmin} from "./auth.js";
import {projectAllowed} from "./projects.js";

const json = (data,status=200) => Response.json(data,{status,headers:{"cache-control":"private, no-store","x-content-type-options":"nosniff"}});
const tables = {category:"workshop_categories",family:"workshop_families",product:"workshop_products",use:"workshop_uses",attachment:"workshop_attachments"};
const bootstraps = new WeakMap();
const stmt = (db,sql,...values) => db.prepare(sql).bind(...values);
const parseRow = row => row && Object.fromEntries(Object.entries(row).map(([key,value])=>[key,["choices","field_values","supplier_links","project_state"].includes(key)?JSON.parse(value):value]));
export const dbRows = async (db,sql,...values) => (await stmt(db,sql,...values).all()).results.map(parseRow);
export async function initializeWorkshop(db) {
 if(!db)throw Error("The Workshop database is not bound to this deployment.");
 if(bootstraps.has(db))return bootstraps.get(db);
 const setup=(async()=>{
  try{if((await stmt(db,"SELECT value FROM workshop_meta WHERE key='schema'").first())?.value==="1")return;}catch{}
  const seed=(table,columns,entries)=>stmt(db,`INSERT OR IGNORE INTO ${table} (${columns.join(",")}) SELECT ${columns.map(key=>`json_extract(value,'$.${key}')`).join(",")} FROM json_each(?) WHERE NOT EXISTS(SELECT 1 FROM workshop_meta WHERE key='seed')`,JSON.stringify(entries));
  await db.batch([...workshopSchema.map(sql=>db.prepare(sql)),
   seed("workshop_categories",["id","parent_id","name","sort_order"],starterCategories),
   seed("workshop_families",["id","category_id","name","kind"],starterFamilies),
   seed("workshop_fields",["id","family_id","label","unit","type","choices","sort_order","hidden","filled_on_use"],starterFields),
   db.prepare("INSERT OR IGNORE INTO workshop_meta(key,value) VALUES('seed','1'),('schema','1')")]);
 })();
 bootstraps.set(db,setup);
 try{await setup;}catch(error){bootstraps.delete(db);throw error;}
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
   const suppliers=record.supplier_links||[];
   if(!Array.isArray(suppliers)||suppliers.length>20)throw Error("Use at most 20 supplier links.");
   for(const supplier of suppliers)if(supplier.url&&!isWebUrl(supplier.url))throw Error("Supplier links need an http or https URL.");
   return writeSimple(db,tables.product,{id:record.id,family_id:family.id,name:text(record.name,180,true),manufacturer:text(record.manufacturer),mpn:text(record.mpn),supplier_links:JSON.stringify(suppliers),notes:text(record.notes,12000),field_values:JSON.stringify(record.field_values)},input.expectedRevision,family);
  }
  if(!await projectAllowed(env,record.project_id,request))throw Error("Project not found.");
  if(previous&&previous.project_id!==record.project_id)throw Error("Create a new use to copy this part into another project.");
  if(record.quantity!==null&&(!Number.isFinite(record.quantity)||record.quantity<0))throw Error("Quantity must be zero or greater, or blank.");
  const product=record.product_id?await stmt(db,"SELECT * FROM workshop_products WHERE id=? AND family_id=?",record.product_id,family.id).first():null;
  if(record.product_id&&!product)throw Error("The selected product does not belong to this family.");
  return writeSimple(db,tables.use,{id:record.id,project_id:record.project_id,tree_node_id:record.tree_node_id||null,family_id:family.id,product_id:record.product_id||null,purpose:text(record.purpose,180),quantity:record.quantity,unit:text(record.unit,32)||"pcs",field_values:JSON.stringify(record.field_values),notes:text(record.notes,12000)},input.expectedRevision,family);
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
 if(request.method==="GET")return json(await workshopSnapshot(env.WORKSHOP_DB));
 if(!["POST","PATCH"].includes(request.method))return json({error:"Method not allowed"},405);
 let input;
 try{
  const raw=await request.text();if(raw.length>128*1024)return json({error:"Record is too large"},413);input=JSON.parse(raw);
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
