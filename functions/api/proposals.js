// Suggested instruction changes require owner approval and optimistic revision checks.
import {accountUser} from "./accounts.js";
import {projectAllowed,projectDetails} from "./projects.js";
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
const UUID=/^[0-9a-f-]{36}$/i;
const proposalKey=project=>"change-proposals/"+project+".json";
const read=async(env,project)=>{
 const object=await env.PHOTOS.get(proposalKey(project));
 return {entries:object?JSON.parse(await object.text()):[],etag:object?.etag??null};
};
async function save(env,project,entries,etag){
 const opts={onlyIf:etag?{etagMatches:etag}:{etagDoesNotMatch:"*"}};
 return !!await env.PHOTOS.put(proposalKey(project),JSON.stringify(entries),opts);
}
const locationKey=(project,scope,targetId)=>scope==="part"?"part-workspaces/"+project+"/"+targetId+".json":"workspaces/"+project+"/"+targetId+".json";
export async function handleProposals(request,env){
 if(!env.PHOTOS)return json({error:"Storage unavailable"},503);
 const url=new URL(request.url),project=url.searchParams.get("project");
 if(!await projectAllowed(env,project,request))return json({error:"Project not found"},404);
 const {project:settings,owner,user}=await projectDetails(request,env,project);
 const method=request.method;
 if(method==="GET"){
  if(!user&&!owner)return json({proposals:[]});
  const {entries}=await read(env,project);
  return json({proposals:entries.filter(p=>owner||p.authorId===user?.id).map(p=>({...p,authorId:owner?p.authorId:undefined}))});
 }
 if(!["POST","PATCH"].includes(method))return json({error:"Method not allowed"},405);
 if(request.headers.get("origin")!==url.origin)return json({error:"Invalid origin"},403);
 const input=await request.json().catch(()=>null);
 if(!input)return json({error:"Invalid proposal"},400);
 if(method==="POST"){
  if(!user)return json({error:"Sign in before suggesting changes"},401);
  if(settings.editMode==="locked")return json({error:"Project is locked against suggestions"},403);
  const scope=input.scope,targetId=input.targetId,stepId=input.stepId,field=input.field,suggested=input.suggestedText;
  if(!["assembly","part"].includes(scope)||!(targetId==="__root__"&&scope==="assembly"||UUID.test(targetId))||
     typeof stepId!=="string"||stepId.length>80||!["standard","detail"].includes(field)||
     typeof suggested!=="string"||!suggested.trim()||suggested.length>8000)return json({error:"Choose an instruction step and provide revised text"},400);
  const object=await env.PHOTOS.get(locationKey(project,scope,targetId));
  if(!object)return json({error:"Instruction not found"},404);
  const workspace=JSON.parse(await object.text());
  const step=workspace.recipe?.find(step=>step.id===stepId);
  if(!step)return json({error:"Step not found"},404);
  const original=String(step[field]||"");
  if(original===suggested)return json({error:"Suggestion does not change the instruction"},400);
  const data=await read(env,project);
  if(data.entries.length>=1000)return json({error:"Suggestion queue full"},409);
  const proposal={id:crypto.randomUUID(),project,scope,targetId,stepId,field,originalText:original,suggestedText:suggested,authorId:user.id,status:"pending",submittedAt:new Date().toISOString()};
  data.entries.push(proposal);
  if(!await save(env,project,data.entries,data.etag))return json({error:"Suggestions changed, please retry"},409);
  return json({proposal},201);
 }
 if(!owner)return json({error:"Only the owner can approve changes"},403);
 if(typeof input.id!=="string"||!UUID.test(input.id)||!["approve","reject"].includes(input.action))return json({error:"Invalid review decision"},400);
 const data=await read(env,project),proposal=data.entries.find(p=>p.id===input.id);
 if(!proposal)return json({error:"Suggestion not found"},404);
 if(proposal.status!=="pending")return json({error:"Suggestion already reviewed"},409);
 if(input.action==="approve"){
  const key=locationKey(project,proposal.scope,proposal.targetId),object=await env.PHOTOS.get(key);
  if(!object)return json({error:"Instruction was deleted"},409);
  const workspace=JSON.parse(await object.text());
  const step=workspace.recipe?.find(step=>step.id===proposal.stepId);
  if(!step||String(step[proposal.field]||"")!==proposal.originalText)return json({error:"Instruction changed since proposal. Review and resubmit against latest text."},409);
  const before={recipe:structuredClone(workspace.recipe||[]),resources:structuredClone(workspace.resources||{}),experiments:structuredClone(workspace.experiments||[])};
  const history=Array.isArray(workspace.history)?workspace.history.slice(-19):[];
  history.push({savedAt:workspace.updatedAt||new Date().toISOString(),revision:workspace.revision??null,...before});
  step[proposal.field]=proposal.suggestedText;
  workspace.history=history;workspace.revision=crypto.randomUUID();workspace.updatedAt=new Date().toISOString();
  const applied=await env.PHOTOS.put(key,JSON.stringify(workspace),{onlyIf:{etagMatches:object.etag}});
  if(!applied)return json({error:"Instruction was edited during approval. Try again."},409);
 }
 proposal.status=input.action==="approve"?"approved":"rejected";
 proposal.reviewedAt=new Date().toISOString();
 if(!await save(env,project,data.entries,data.etag))return json({error:"Change was applied, but review log could not be updated. Check before retrying."},409);
 return json({proposal});
}
