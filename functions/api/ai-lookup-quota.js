// Reserve paid attempts before contacting the provider. R2's conditional write
// keeps concurrent tabs from sharing the last daily slot. Billing caps stay at
// the API provider; this is an additional request limit, not a dollar estimate.
export async function reserveLookupAttempt(bucket,userId){
 const date=new Date().toISOString().slice(0,10),key="workshop-ai-lookup/"+userId+"/"+date;
 for(let attempt=0;attempt<6;attempt++){
  const object=await bucket.get(key),count=object?Number(await object.text()):0;
  if(!Number.isSafeInteger(count)||count<0)throw Object.assign(Error("AI lookup usage could not be read. Try again later."),{status:503});
  if(count>=15)throw Object.assign(Error("Daily AI lookup limit reached (15 attempts). Try again tomorrow."),{status:429,code:"AI_DAILY_LIMIT"});
  if(object&&!object.etag)throw Object.assign(Error("AI lookup storage is unavailable."),{status:503});
  const saved=await bucket.put(key,String(count+1),{onlyIf:object?{etagMatches:object.etag}:{etagDoesNotMatch:"*"}});
  if(saved)return;
 }
 throw Object.assign(Error("Another lookup is starting. Wait a moment and try again."),{status:429,code:"AI_LOOKUP_BUSY"});
}
