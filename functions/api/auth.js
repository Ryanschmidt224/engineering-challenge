const enc=new TextEncoder();
const b64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const unb64=s=>Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));
async function key(env){return crypto.subtle.importKey("raw",enc.encode(env.admin_password),{name:"HMAC",hash:"SHA-256"},false,["sign","verify"])}
async function digest(value){return new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(value)))}
export async function isAdmin(request,env){
 if(!env.admin_password||env.admin_password.length<10)return false;
 const raw=request.headers.get("cookie")?.split(";").map(x=>x.trim()).find(x=>x.startsWith("bs_admin="))?.slice(9);
 if(!raw)return false;
 const parts=raw.split(".");if(parts.length!==2)return false;
 try{const payload=JSON.parse(new TextDecoder().decode(unb64(parts[0])));if(payload.exp<Date.now()||payload.exp>Date.now()+31*86400000)return false;
 const hash=b64(await digest(env.admin_password));if(payload.version!==hash)return false;
 return await crypto.subtle.verify("HMAC",await key(env),unb64(parts[1]),enc.encode(parts[0]));}catch{return false}
}
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json","cache-control":"no-store",...headers}});
const cookie=(value,maxAge)=>"bs_admin="+value+"; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age="+maxAge;
export async function auth(request,env){
 const method=request.method;
 if(method==="GET")return json({authenticated:await isAdmin(request,env)});
 if(method!=="POST"&&method!=="DELETE")return json({error:"Method not allowed"},405);
 const url=new URL(request.url);if(request.headers.get("origin")!==url.origin)return json({error:"Invalid origin"},403);
 if(method==="DELETE")return json({authenticated:false},200,{"set-cookie":cookie("",0)});
 const body=await request.json().catch(()=>null),password=body?.password;
 if(!env.admin_password||env.admin_password.length<10)return json({error:"Administrator password secret is missing or shorter than 10 characters in this Worker deployment.",diagnostics:{bindingPresent:Object.prototype.hasOwnProperty.call(env,"admin_password"),bindingType:typeof env.admin_password,configuredLength:typeof env.admin_password==="string"?(env.admin_password.length>=10?"10 or more":"under 10"):"not a string",bindingNames:Object.keys(env).filter(k=>k!=="ASSETS"&&k!=="PHOTOS")}},503);
 if(typeof password!=="string"||password.length>256)return json({error:"Invalid password input"},400);
 const a=await digest(password),b=await digest(env.admin_password);if(a.length!==b.length||!a.every((x,i)=>x===b[i]))return json({error:"Incorrect password"},401);
 const payload=b64(enc.encode(JSON.stringify({exp:Date.now()+30*86400000,version:b64(b)})));
 const sig=b64(new Uint8Array(await crypto.subtle.sign("HMAC",await key(env),enc.encode(payload))));
 return json({authenticated:true},200,{"set-cookie":cookie(payload+"."+sig,30*86400)});
}
