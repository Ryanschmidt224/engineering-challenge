import {isAdmin} from './auth.js';
const enc=new TextEncoder(),quote=name=>'"'+name.replaceAll('"','""')+'"';
const hash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(text))),v=>v.toString(16).padStart(2,'0')).join('');
const serial=value=>value instanceof ArrayBuffer?{blob:Array.from(new Uint8Array(value))}:value instanceof Uint8Array||Array.isArray(value)?{blob:Array.from(value)}:value;
export function backupFilename(date=new Date()){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Phoenix',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).map(v=>[v.type,v.value]));return 'BuildingSchmidtDataBackup-'+parts.year+'-'+parts.month+'-'+parts.day+'.bsbackup';
}
export async function* database(db){
 const schema=(await db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT GLOB '_cf_*' AND name NOT GLOB '__cf_*' ORDER BY type,name").all()).results;
 yield {type:'schema',objects:schema};
 for(const table of schema.filter(s=>s.type==='table')){
  const columns=(await db.prepare('PRAGMA table_info('+quote(table.name)+')').all()).results.map(v=>v.name);if(!columns.length)throw Error('A database table has no columns.');let offset=0;
  for(;;){const rows=(await db.prepare('SELECT * FROM '+quote(table.name)+' ORDER BY '+columns.map(quote).join(',')+' LIMIT 100 OFFSET ?').bind(offset).all()).results;if(!rows.length)break;for(const row of rows)yield {type:'row',table:table.name,value:Object.fromEntries(Object.entries(row).map(([k,v])=>[k,serial(v)]))};offset+=rows.length;}
 }
}
async function* inventory(bucket){let cursor;const seen=new Set();do{const page=await bucket.list({limit:100,cursor,include:['httpMetadata','customMetadata']});if(!Array.isArray(page.objects)||page.truncated&&(!page.cursor||seen.has(page.cursor)))throw Error('Incomplete object inventory.');for(const o of page.objects)yield {key:o.key,size:o.size,etag:o.etag,uploaded:o.uploaded?.toISOString(),httpMetadata:o.httpMetadata||{},customMetadata:o.customMetadata||{}};cursor=page.truncated?page.cursor:null;if(cursor)seen.add(cursor);}while(cursor);}
const advance=async(previous,value)=>hash(previous+JSON.stringify(value));
export async function* siteBackupEntries(env,date=new Date()){
 if(!env.WORKSHOP_DB||!env.PHOTOS)throw Error('Website data storage is unavailable.');
 yield {type:'manifest',format:'building-schmidt-site-data',version:1,createdAt:date.toISOString(),database:'WORKSHOP_DB',bucket:'PHOTOS',sourceVersion:env.CF_VERSION_METADATA?.id||null};
 let dbHash='',objectHash='',files=0;for await(const entry of database(env.WORKSHOP_DB)){dbHash=await advance(dbHash,entry);yield entry;}
 for await(const meta of inventory(env.PHOTOS)){
  objectHash=await advance(objectHash,meta);const file=await env.PHOTOS.get(meta.key);if(!file||file.etag!==meta.etag||file.size!==meta.size)throw Error('A file changed during backup. Retry when editing has stopped.');yield {type:'object',...meta};
  const reader=file.body.getReader();let size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;for(let at=0;at<value.length;at+=49152){const bytes=value.subarray(at,at+49152);size+=bytes.length;let raw='';for(let i=0;i<bytes.length;i+=8192)raw+=String.fromCharCode(...bytes.subarray(i,i+8192));yield {type:'bytes',data:btoa(raw)};}}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  if(size!==meta.size)throw Error('A file was truncated during backup.');yield {type:'end_object',key:meta.key,size};files++;
 }
 let verifyObjects='';for await(const meta of inventory(env.PHOTOS))verifyObjects=await advance(verifyObjects,meta);if(verifyObjects!==objectHash)throw Error('Stored files changed during backup. Retry when editing has stopped.');
 let verifyDB='';for await(const entry of database(env.WORKSHOP_DB))verifyDB=await advance(verifyDB,entry);if(verifyDB!==dbHash)throw Error('Database changed during backup. Retry when editing has stopped.');
 yield {type:'verified',databaseHash:dbHash,objectInventoryHash:objectHash,files};
}

const json=data=>Response.json(data,{headers:{'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
export async function backupPart(request,env,part){
 let data={};if(request.method==='POST'){if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Invalid origin'},{status:403});const raw=await request.text();if(raw.length>8192)throw Error('Backup request too large.');data=JSON.parse(raw);}else if(!['manifest','schema'].includes(part))return Response.json({error:'Use a POST request'},{status:405});
 if(part==='manifest')return json({type:'manifest',format:'building-schmidt-site-data',version:1,createdAt:new Date().toISOString(),database:'WORKSHOP_DB',bucket:'PHOTOS',sourceVersion:env.CF_VERSION_METADATA?.id||null});
 if(part==='schema'){const first=await database(env.WORKSHOP_DB).next();return json(first.value.objects);}
 if(part==='rows'){
  if(typeof data.table!=='string'||!Number.isSafeInteger(data.offset)||data.offset<0)throw Error('Invalid table page.');const schema=await database(env.WORKSHOP_DB).next();if(!schema.value.objects.some(o=>o.type==='table'&&o.name===data.table))throw Error('Unknown application table.');
  const info=(await env.WORKSHOP_DB.prepare('PRAGMA table_info('+quote(data.table)+')').all()).results,keys=info.filter(v=>v.pk).sort((a,b)=>a.pk-b.pk).map(v=>v.name),order=(keys.length?keys:info.map(v=>v.name)).map(quote).join(',');
  const names=info.map(v=>v.name);let total='__backup_byte_total',number='__backup_row_number';while(names.includes(total))total+='_';while(names.includes(number))number+='_';const columns=names.map(quote).join(','),size=names.map(name=>'COALESCE(length(CAST('+quote(name)+' AS BLOB)),0)').join('+');const query='SELECT '+columns+' FROM (SELECT '+columns+',SUM('+size+') OVER(ORDER BY '+order+' ROWS UNBOUNDED PRECEDING) AS '+quote(total)+',ROW_NUMBER() OVER(ORDER BY '+order+') AS '+quote(number)+' FROM (SELECT * FROM '+quote(data.table)+' ORDER BY '+order+' LIMIT 500 OFFSET ?)) WHERE '+quote(total)+'<=1048576 OR '+quote(number)+'=1 ORDER BY '+order;const rows=(await env.WORKSHOP_DB.prepare(query).bind(data.offset).all()).results.map(row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k,serial(v)])));return json({rows,nextOffset:rows.length?data.offset+rows.length:null});
 }
 if(part==='objects'){if(data.cursor!==null&&data.cursor!==undefined&&(typeof data.cursor!=='string'||data.cursor.length>4096))throw Error('Invalid inventory cursor.');const page=await env.PHOTOS.list({limit:100,cursor:data.cursor||undefined,include:['httpMetadata','customMetadata']});if(page.truncated&&!page.cursor)throw Error('Incomplete object inventory.');return json({objects:page.objects.map(o=>({key:o.key,size:o.size,etag:o.etag,uploaded:o.uploaded?.toISOString(),httpMetadata:o.httpMetadata||{},customMetadata:o.customMetadata||{}})),cursor:page.truncated?page.cursor:null});}
 if(part==='object'){
  if(typeof data.key!=='string'||data.key.length>1024||typeof data.etag!=='string'||data.etag.length>200||!Number.isSafeInteger(data.offset)||data.offset<0||!Number.isSafeInteger(data.size)||data.size<0||!Number.isInteger(data.length)||data.length<1||data.length>1048576||data.offset+data.length>data.size)throw Error('Invalid object range.');
  const file=await env.PHOTOS.get(data.key,{range:{offset:data.offset,length:data.length},onlyIf:{etagMatches:data.etag}});if(!file?.body||file.etag!==data.etag||file.size!==data.size)return Response.json({error:'File changed during backup'},{status:409});return new Response(file.body,{headers:{'content-type':'application/octet-stream','cache-control':'private, no-store','x-content-type-options':'nosniff'}});
 }
 return Response.json({error:'Unknown backup part'},{status:400});
}

export async function handleSiteDataBackup(request,env){
 if(!await isAdmin(request,env))return Response.json({error:'Owner sign-in required'},{status:401});if(!['GET','POST'].includes(request.method))return Response.json({error:'Method not allowed'},{status:405});if(!env.WORKSHOP_DB||!env.PHOTOS)return Response.json({error:'Website data storage unavailable'},{status:503});
 const part=new URL(request.url).searchParams.get('part');if(part){try{return await backupPart(request,env,part);}catch(error){return Response.json({error:error.message},{status:400});}}if(request.method!=='GET')return Response.json({error:'Method not allowed'},{status:405});
 let digest='';const iterator=siteBackupEntries(env)[Symbol.asyncIterator]();const body=new ReadableStream({async pull(controller){try{const {value,done}=await iterator.next();if(done){controller.enqueue(enc.encode(JSON.stringify({type:'complete',sha256:digest})+'\n'));controller.close();return;}const line=JSON.stringify(value);digest=await hash(digest+line);controller.enqueue(enc.encode(line+'\n'));}catch(error){console.error('Whole-site data backup interrupted',error);controller.error(Error('Backup incomplete. Please retry.'));}},async cancel(){await iterator.return?.();}});
 return new Response(body,{headers:{'content-type':'application/x-ndjson','content-disposition':'attachment; filename="'+backupFilename()+'"','cache-control':'private, no-store','x-content-type-options':'nosniff'}});
}
