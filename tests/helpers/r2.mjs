export class TestR2 {
 objects=new Map();
 async put(key,value,options={}){
  const previous=this.objects.get(key);
  if(options.onlyIf?.etagMatches&&previous?.etag!==options.onlyIf.etagMatches||options.onlyIf?.etagDoesNotMatch==="*"&&previous)return null;
  const bytes=typeof value==="string"?new TextEncoder().encode(value):value instanceof ReadableStream?new Uint8Array(await new Response(value).arrayBuffer()):new Uint8Array(value);
  const record={bytes,etag:crypto.randomUUID(),httpMetadata:options.httpMetadata||{},customMetadata:options.customMetadata||{},uploaded:new Date()};this.objects.set(key,record);return {etag:record.etag};
 }
 async get(key,options={}){const record=this.objects.get(key);if(!record||options.onlyIf?.etagMatches&&options.onlyIf.etagMatches!==record.etag)return null;const range=options.range,bodyBytes=range?record.bytes.subarray(range.offset,range.offset+range.length):record.bytes;return {key,etag:record.etag,size:record.bytes.length,httpMetadata:record.httpMetadata,customMetadata:record.customMetadata,
  text:async()=>new TextDecoder().decode(record.bytes),json:async()=>JSON.parse(new TextDecoder().decode(record.bytes)),arrayBuffer:async()=>record.bytes.slice().buffer,
  body:new ReadableStream({start(controller){controller.enqueue(bodyBytes);controller.close();}}),writeHttpMetadata(headers){for(const [name,value] of Object.entries(record.httpMetadata))if(name==="contentType")headers.set("content-type",value);}};}
 async head(key){const record=this.objects.get(key);return record?{key,etag:record.etag,size:record.bytes.length,uploaded:record.uploaded,httpMetadata:record.httpMetadata,customMetadata:record.customMetadata}:null;}
 async list({prefix="",cursor,limit=500}={}){const entries=[...this.objects].filter(([key])=>key.startsWith(prefix)).sort(([a],[b])=>a.localeCompare(b));const start=Number(cursor)||0;const objects=entries.slice(start,start+limit).map(([key,record])=>({key,size:record.bytes.length,etag:record.etag,httpMetadata:record.httpMetadata,customMetadata:record.customMetadata,uploaded:record.uploaded}));return {objects,truncated:start+limit<entries.length,cursor:start+limit<entries.length?String(start+limit):undefined};}
 // Minimal multipart model: parts are stored separately and only become a
 // visible object on complete(); abort() discards them.
 uploads=new Map();
 multipartHandles=new Map();
 resumeMultipartUpload(key,uploadId){const handle=this.multipartHandles.get(uploadId);if(handle?.key===key)return handle;return {async abort(){throw Error('NoSuchUpload (10024)');}};}
 async createMultipartUpload(key,options={}){
  const uploadId=crypto.randomUUID(),parts=new Map();this.uploads.set(uploadId,parts);const r2=this;
  const handle={key,uploadId,
   async uploadPart(number,value){if(!r2.uploads.has(uploadId))throw Error("Upload aborted.");const bytes=new Uint8Array(value);parts.set(number,bytes);return {partNumber:number,etag:crypto.randomUUID()};},
   async complete(list){if(!r2.uploads.has(uploadId))throw Error("Upload aborted.");const chunks=list.map(part=>parts.get(part.partNumber));if(chunks.slice(0,-1).some(chunk=>chunk.length<5*1024*1024))throw Error("Multipart parts must be at least 5 MiB except the last.");const size=chunks.reduce((sum,chunk)=>sum+chunk.length,0),bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}r2.uploads.delete(uploadId);r2.multipartHandles.delete(uploadId);return r2.put(key,bytes,options);},
   async abort(){r2.uploads.delete(uploadId);r2.multipartHandles.delete(uploadId);}
  };this.multipartHandles.set(uploadId,handle);return handle;
 }
 async delete(key){for(const entry of Array.isArray(key)?key:[key])this.objects.delete(entry);}
}
