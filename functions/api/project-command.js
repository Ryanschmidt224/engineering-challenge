// One atomic D1 command. Every dependent statement checks this *attempt's*
// admission receipt, never changes() or a receipt from an earlier retry.
const insertable=new Set(["engine_projects","engine_items","engine_occurrences","engine_configurations","engine_events","engine_steps","engine_records","engine_files","engine_file_links"]);
const mutable=new Set(["engine_projects","engine_items","engine_occurrences","engine_steps","engine_records","engine_files","engine_file_links"]);
const key=value=>{if(!/^[a-z_][a-z0-9_]*$/.test(value))throw Error("Invalid SQL identifier");return value;};
const uuid=value=>typeof value==="string"&&/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(value);
export class CommandConflict extends Error {constructor(message="This project changed. Keep your draft, reload the current version and review before saving."){super(message);this.status=409;}}
export function canonicalJSON(value){
 if(value===null||typeof value!=="object"){
  if(value===undefined||typeof value==="number"&&!Number.isFinite(value)||!["string","number","boolean","object"].includes(typeof value))throw Error("Use JSON values only.");
  return JSON.stringify(value);
 }
 if(Array.isArray(value))return "["+value.map(canonicalJSON).join(",")+"]";
 return "{"+Object.keys(value).sort().map(name=>JSON.stringify(name)+":"+canonicalJSON(value[name])).join(",")+"}";
}
export async function sha256(value){return [...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))].map(byte=>byte.toString(16).padStart(2,"0")).join("");}
function commandIdentity(input){
 const {projectId,actorId,operationId,expectedRevision,payload}=input;
 if(!uuid(projectId)||!uuid(operationId)||typeof actorId!=="string"||!actorId||actorId.length>180||expectedRevision!==null&&!uuid(expectedRevision))throw Error("A project ID, owner, operation ID and loaded revision are required.");
 return {projectId,actorId,operationId,expectedRevision,payload};
}
const commandHash=({projectId,actorId,expectedRevision,payload})=>sha256(canonicalJSON({projectId,actorId,expectedRevision,payload}));
export async function replayProjectCommand(db,input){
 const identity=commandIdentity(input),{projectId,actorId,operationId}=identity;
 const existing=await db.prepare("SELECT request_hash,result FROM engine_operations WHERE project_id=? AND actor_id=? AND operation_id=?").bind(projectId,actorId,operationId).first();
 if(!existing)return null;
 if(existing.request_hash!==await commandHash(identity))throw new CommandConflict("This operation ID was already used with different content. Your draft has not been saved.");
 return {result:JSON.parse(existing.result)};
}
export async function commitProjectCommand(db,input,build){
 const identity=commandIdentity(input),{projectId,actorId,operationId,expectedRevision}=identity;
 const requestHash=await commandHash(identity);
 const previous=await replayProjectCommand(db,input);if(previous)return previous.result;
 const attemptId=crypto.randomUUID(),revision=crypto.randomUUID(),createdAt=new Date().toISOString();
 const gate="EXISTS(SELECT 1 FROM engine_operations WHERE project_id=? AND actor_id=? AND operation_id=? AND attempt_id=?)";
 const gateValues=[projectId,actorId,operationId,attemptId],writes=[],guards=[];
 let projectInserted=false;
 const statement=(sql,values)=>db.prepare(sql).bind(...values);
 const match=where=>{const keys=Object.keys(where);if(!keys.length)throw Error("A guarded write requires an explicit target.");return {sql:keys.map(name=>key(name)+(where[name]===null?" IS NULL":"=?")).join(" AND "),values:keys.filter(name=>where[name]!==null).map(name=>where[name])};};
 const writer={
  revision,createdAt,
  require(sql,...values){guards.push({sql,values});},
  insert(table,row){
   if(!insertable.has(table))throw Error("Unsupported insert table.");
   const scoped=table==="engine_projects"?row.id===projectId&&row.owner_id===actorId:row.project_id===projectId;
   if(!scoped)throw Error("A command cannot write another project's rows.");
   if(table==="engine_projects"){if(expectedRevision!==null||projectInserted||row.revision!==revision)throw Error("Invalid project creation.");projectInserted=true;}
   const keys=Object.keys(row).map(key);
   writes.push(statement(`INSERT INTO ${table}(${keys.join(",")}) SELECT ${keys.map(()=>"?").join(",")} WHERE ${gate}`,[...keys.map(name=>row[name]),...gateValues]));
  },
  reorderSteps(itemId,ids){
   if(!uuid(itemId)||!Array.isArray(ids)||ids.some(id=>!uuid(id))||new Set(ids).size!==ids.length)throw Error("Provide the complete ordered step IDs.");
   const serialized=JSON.stringify(ids);
   guards.push({sql:"(SELECT COUNT(*) FROM engine_steps WHERE project_id=? AND item_id=? AND retired_at IS NULL)=? AND (SELECT COUNT(*) FROM engine_steps WHERE project_id=? AND item_id=? AND retired_at IS NULL AND id IN(SELECT value FROM json_each(?)))=?",values:[projectId,itemId,ids.length,projectId,itemId,serialized,ids.length]});
   writes.push(statement(`UPDATE engine_steps SET sort_order=(SELECT key FROM json_each(?) WHERE value=engine_steps.id) WHERE project_id=? AND item_id=? AND retired_at IS NULL AND ${gate}`,[serialized,projectId,itemId,...gateValues]));
  },
  update(table,patch,where){
   if(!mutable.has(table))throw Error("Unsupported update table.");
   if(!where||!uuid(where.id))throw Error("A guarded update requires one exact row ID.");
   if(table==="engine_projects"?(where.id!==projectId||where.owner_id!==actorId):where.project_id!==projectId)throw Error("Unsupported update target.");
   // Identity is immutable. The project header's revision is set centrally.
   if(Object.keys(patch).some(name=>["id","project_id","owner_id","revision"].includes(name)))throw Error("Identity and concurrency tokens cannot be edited.");
   const target=match(where),keys=Object.keys(patch).map(key);if(!keys.length)throw Error("An update requires fields.");
   guards.push({sql:`EXISTS(SELECT 1 FROM ${table} WHERE ${target.sql})`,values:target.values});
   writes.push(statement(`UPDATE ${table} SET ${keys.map(name=>name+"=?").join(",")} WHERE ${target.sql} AND ${gate}`,[...keys.map(name=>patch[name]),...target.values,...gateValues]));
  }
 };
 const result=await build(writer);
 if(expectedRevision===null&&!projectInserted)throw Error("Project creation must insert its header.");
 if(!writes.length)throw Error("Do not create receipts for an unchanged save.");
 const response={...result,revision};
 const admission=expectedRevision===null
  ?{sql:"NOT EXISTS(SELECT 1 FROM engine_projects WHERE id=?)",values:[projectId]}
  :{sql:"EXISTS(SELECT 1 FROM engine_projects WHERE id=? AND owner_id=? AND revision=?)",values:[projectId,actorId,expectedRevision]};
 const conditions=[admission,...guards];
 const admit=statement(`INSERT INTO engine_operations(project_id,actor_id,operation_id,request_hash,attempt_id,result,created_at)
 SELECT ?,?,?,?,?,?,? WHERE ${conditions.map(condition=>"("+condition.sql+")").join(" AND ")} ON CONFLICT(project_id,actor_id,operation_id) DO NOTHING`,
 [projectId,actorId,operationId,requestHash,attemptId,JSON.stringify(response),createdAt,...conditions.flatMap(condition=>condition.values)]);
 // A single project-wide token deliberately serializes this single-owner slice.
 // Child/source guards belong in admission, not in a late conditional UPDATE.
 const header=expectedRevision===null?[]:[statement(`UPDATE engine_projects SET revision=? WHERE id=? AND owner_id=? AND ${gate}`,[revision,projectId,actorId,...gateValues])];
 const results=await db.batch([admit,...header,...writes]);
 if(!results[0].meta.changes){const existing=await replayProjectCommand(db,input);if(existing)return existing.result;throw new CommandConflict();}
 return response;
}
