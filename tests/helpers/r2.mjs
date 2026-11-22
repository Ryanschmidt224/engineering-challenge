export class TestR2 {
 objects=new Map();
 async put(key,value,options={}){
  const previous=this.objects.get(key);
  if(options.onlyIf?.etagMatches&&previous?.etag!==options.onlyIf.etagMatches||options.onlyIf?.etagDoesNotMatch==="*"&&previous)return null;
  const bytes=typeof value==="string"?new TextEncoder().encode(value):value instanceof ReadableStream?new Uint8Array(await new Response(value).arrayBuffer()):new Uint8Array(value);
  const record={bytes,etag:crypto.randomUUID(),httpMetadata:options.httpMetadata||{},customMetadata:options.customMetadata||{},uploaded:new Date()};this.objects.set(key,record);return {etag:record.etag};
 }
 async get(key){const record=this.objects.get(key);if(!record)return null;return {key,etag:record.etag,size:record.bytes.length,httpMetadata:record.httpMetadata,customMetadata:record.customMetadata,
  text:async()=>new TextDecoder().decode(record.bytes),json:async()=>JSON.parse(new TextDecoder().decode(record.bytes)),arrayBuffer:async()=>record.bytes.slice().buffer,
  body:new ReadableStream({start(controller){controller.enqueue(record.bytes);controller.close();}}),writeHttpMetadata(headers){for(const [name,value] of Object.entries(record.httpMetadata))if(name==="contentType")headers.set("content-type",value);}};}
 async head(key){const record=this.objects.get(key);return record?{key,etag:record.etag,size:record.bytes.length,httpMetadata:record.httpMetadata,customMetadata:record.customMetadata}:null;}
 async list({prefix="",cursor,limit=500}={}){const entries=[...this.objects].filter(([key])=>key.startsWith(prefix)).sort(([a],[b])=>a.localeCompare(b));const start=Number(cursor)||0;const objects=entries.slice(start,start+limit).map(([key,record])=>({key,size:record.bytes.length,etag:record.etag,httpMetadata:record.httpMetadata,customMetadata:record.customMetadata,uploaded:record.uploaded}));return {objects,truncated:start+limit<entries.length,cursor:start+limit<entries.length?String(start+limit):undefined};}
 async delete(key){for(const entry of Array.isArray(key)?key:[key])this.objects.delete(entry);}
}
