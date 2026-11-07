import {isAdmin} from "./auth.js";
const projects=new Set(["launcher","linear","robot","buck","motorlab","coiltest"]);
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const authorized=isAdmin;
const key=project=>"components/"+project+".json";
const read=async(env,project)=>{const obj=await env.PHOTOS.get(key(project));return obj?JSON.parse(await obj.text()):[]};
export async function handleComponents(request,env){
 const url=new URL(request.url),project=url.searchParams.get("project");
 if(!projects.has(project))return json({error:"Invalid project"},400);
 if(request.method==="GET")return json({components:await read(env,project)});
 if(!await authorized(request,env))return json({error:"Administrator token required"},401);
 if(request.method==="POST"){
  const input=await request.json().catch(()=>null);
  if(!input||typeof input.name!=="string"||!input.name.trim()||input.name.length>180||!Array.isArray(input.specifications)||input.specifications.length>35)return json({error:"Invalid component"},400);
  const clean=s=>String(s??"").slice(0,300);
  const record={id:crypto.randomUUID(),name:clean(input.name),manufacturer:clean(input.manufacturer),model:clean(input.model),supplier:clean(input.supplier),asin:clean(input.asin),category:clean(input.category),specifications:input.specifications.map(s=>({name:clean(s.name),value:clean(s.value),source:s.source==="inferred"?"inferred":"explicit"})).filter(s=>s.name&&s.value),createdAt:new Date().toISOString()};
  const items=await read(env,project);if(items.length>=300)return json({error:"Component limit reached"},400);items.push(record);await env.PHOTOS.put(key(project),JSON.stringify(items));return json({component:record},201);
 }
 if(request.method==="DELETE"){
  const id=url.searchParams.get("id"),items=await read(env,project),remaining=items.filter(x=>x.id!==id);if(remaining.length===items.length)return json({error:"Not found"},404);await env.PHOTOS.put(key(project),JSON.stringify(remaining));return json({ok:true});
 }
 return json({error:"Method not allowed"},405)
}
export async function handleExtract(request,env){
 if(request.method!=="POST")return json({error:"Method not allowed"},405);
 if(!await authorized(request,env))return json({error:"Administrator token required"},401);
 if(!env.OPENAI_API_KEY)return json({error:"OpenAI API key not configured"},503);
 const body=await request.json().catch(()=>null),description=body?.description;
 if(typeof description!=="string"||description.trim().length<15||description.length>3000)return json({error:"Paste a product description (15–3000 characters)"},400);
 // Conservative site-side request allowance, independent of OpenAI billing limits.
 // R2 read/modify/write is not atomic: concurrent requests can exceed this allowance.
 if(!env.PHOTOS)return json({error:"Storage not configured"},503);
 const month=new Date().toISOString().slice(0,7),usageKey="limits/ai-extractions-"+month+".json";
 const usageObject=await env.PHOTOS.get(usageKey);
 const usage=usageObject?JSON.parse(await usageObject.text()):{count:0};
 if(usage.count>=100)return json({error:"Monthly AI extraction allowance reached (100 requests)."},429);
 // Reserve before calling OpenAI; failed requests still consume an allowance.
 await env.PHOTOS.put(usageKey,JSON.stringify({count:usage.count+1,updatedAt:new Date().toISOString()}));
 const schema={type:"object",additionalProperties:false,required:["name","manufacturer","model","supplier","asin","category","specifications"],properties:{name:{type:"string"},manufacturer:{type:"string"},model:{type:"string"},supplier:{type:"string"},asin:{type:"string"},category:{type:"string"},specifications:{type:"array",items:{type:"object",additionalProperties:false,required:["name","value","source"],properties:{name:{type:"string"},value:{type:"string"},source:{type:"string",enum:["explicit","inferred"]}}}}}};
 const response=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{"authorization":"Bearer "+env.OPENAI_API_KEY,"content-type":"application/json"},body:JSON.stringify({model:"gpt-4o-mini",temperature:0,max_tokens:700,messages:[{role:"system",content:"Extract technical component information from a product description. Return concise, accurate fields. Do not invent missing specifications. Empty string for missing scalar fields. Only mark inferred when a detail is reasonably inferred; omit speculative values. ASIN only if explicitly present. Manufacturer and model must not be guessed. Supplier is Amazon only if mentioned or context explicitly identifies Amazon."},{role:"user",content:description}],response_format:{type:"json_schema",json_schema:{name:"component",strict:true,schema}}})});
 const result=await response.json().catch(()=>({}));if(!response.ok)return json({error:"AI extraction failed",detail:result.error?.message||"Provider error"},502);
 try{return json({component:JSON.parse(result.choices[0].message.content)})}catch{return json({error:"Invalid AI response"},502)}
}
