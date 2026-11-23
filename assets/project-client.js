// One preview API client. A transport retry keeps the exact operation and token;
// edited content receives a new operation. Conflicts never retry automatically.
export function createProjectClient(){
 let state=null,loadSequence=0;const pending=new Map();
 async function request(path,options={}){
  const response=await fetch("/api/project-engine/projects"+path,{credentials:"same-origin",cache:"no-store",...options});
  const result=await response.json().catch(()=>({}));if(!response.ok){const error=Error(result.error||"Request failed. Your draft is retained.");error.status=response.status;throw error;}return result;
 }
 async function load(projectId){const sequence=++loadSequence,result=await request("/"+projectId+"/state");if(sequence===loadSequence)state=result;return result;}
 async function write(projectId,path,method,data={},expectedRevision=state?.project.revision??null){
  const key=JSON.stringify([projectId,path,method,data,expectedRevision]);let body=pending.get(key);if(!body){body={...data,expectedRevision,operationId:crypto.randomUUID()};pending.set(key,body);}
  const result=await request("/"+projectId+path,{method,headers:{"content-type":"application/json"},body:JSON.stringify(body)});loadSequence++;if(state?.project.id===projectId&&(state.project.revision===expectedRevision||state.project.revision===result.revision))state.project.revision=result.revision;return result;
 }
 async function upload(projectId,file,{itemId=null,expectedRevision=state?.project.revision??null}={}){
  const prepared=await write(projectId,"/files/prepare","POST",{name:file.name,content_type:file.type||"application/octet-stream"},expectedRevision);
  const operationId=crypto.randomUUID(),revision=prepared.revision,options={method:"PUT",headers:{"x-operation-id":operationId,"x-project-revision":revision},body:file};
  // Only a transport failure is retried; the immutable key and upload ID stay.
  try{await request("/"+projectId+"/files/"+prepared.fileId+"/bytes",options);}catch(error){if(error.status)throw error;await request("/"+projectId+"/files/"+prepared.fileId+"/bytes",options);}
  return write(projectId,"/files/"+prepared.fileId+"/admit","POST",{role:itemId?"engineering":"support",...(itemId?{itemId}:{})},revision);
 }
 return {request,load,write,upload,get state(){return state;}};
}
