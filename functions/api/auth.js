// Administrator authorization is a role on the signed-in user account.
// The obsolete password-only administrator cookie no longer grants access.
import {accountUser} from "./accounts.js";
export async function isAdmin(request,env){
 const user=await accountUser(request,env);
 return user?.role==="admin";
}
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json","cache-control":"no-store",...headers}});
export async function auth(request,env){
 if(request.method==="GET")return json({authenticated:await isAdmin(request,env)});
 if(request.method==="POST")return json({error:"Administrator sign-in is now part of your normal account. Sign in with the existing owner account."},410);
 if(request.method==="DELETE")return json({authenticated:false},200,{"set-cookie":"bs_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0"});
 return json({error:"Method not allowed"},405);
}
