import {handleAccounts} from '../../functions/api/accounts.js';
export const ORIGIN='https://workshop.example';
export class WorkshopBucket {
 constructor(){this.objects=new Map();this.beforePut=null;}
 async get(key){
  const entry=this.objects.get(key);if(!entry)return null;
  const {body,etag}=entry;
  return {etag,async text(){return body},async json(){return JSON.parse(body)}};
 }
 async put(key,value,options={}){
  if(this.beforePut){const hook=this.beforePut;this.beforePut=null;await hook(key);}
  const previous=this.objects.get(key);
  if(options.onlyIf?.etagMatches&&options.onlyIf.etagMatches!==previous?.etag)return null;
  if(options.onlyIf?.etagDoesNotMatch==='*'&&previous)return null;
  const etag=crypto.randomUUID();this.objects.set(key,{body:String(value),etag});return {etag};
 }
 async head(key){return this.get(key)}
 async delete(key){this.objects.delete(key)}
}
export function request(path,method='GET',body,session){
 return new Request(ORIGIN+path,{method,headers:{origin:ORIGIN,
  ...(session?{cookie:session}:{}),'content-type':'application/json'},
  ...(body===undefined?{}:{body:JSON.stringify(body)})});
}
export async function fixture(){
 const env={PHOTOS:new WorkshopBucket(),admin_password:'isolated-test-session-secret'};
 const response=await handleAccounts(request('/api/accounts','POST',{
  action:'register',email:'contributor@example.test',password:'isolated-test-password'}),env);
 if(response.status!==201)throw Error('Unable to prepare test account');
 const session=response.headers.get('set-cookie').split(';')[0];
 return {env,session,user:(await response.json()).user};
}
export const templateBody=(name='MOSFET')=>({name,category:'electrical-switching',
 tableLayout:{sections:{identity:{labels:{partNumber:'MPN'},hiddenFields:['model','name'],
  rows:[{id:'row-11111111-1111-4111-8111-111111111111',label:'Gate rating',value:'SOURCE VALUE'}]}}},
 genericFields:[{label:'Load current',unit:'A'}],
 productSections:[{id:'ratings',title:'Ratings',fields:[{id:'gate',label:'Gate voltage',type:'number',scope:'workshop',unit:'V',value:'SOURCE VALUE'}]}]});
