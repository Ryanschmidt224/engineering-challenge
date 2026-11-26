import {test} from "node:test";
import assert from "node:assert/strict";
import {fixture} from "./helpers/project-workspace.mjs";
import {handleProjectWorkspace} from "../functions/api/project-workspace-api.js";
const origin="https://preview.example.test",base=origin+"/api/project-engine/projects",id=()=>crypto.randomUUID();
const ok=reply=>{assert.equal(reply.status,200,JSON.stringify(reply.result));return reply.result;};
async function api(f,project,path="/state",method="GET",data=null,headers={}){return handleProjectWorkspace(new Request(base+"/"+project+path,{method,headers:{origin,...headers},...(data!==null?{body:typeof data==='string'?data:JSON.stringify(data)}:{})}),f.env,f.owner);}
test('owner names default to Ryan, validate choices and survive backup/restore; old backups default to Ryan',async t=>{
 const f=await fixture();t.after(()=>f.db.close());assert.equal(ok(await f.call('/state')).project.owner_name,'Ryan');const token=f.revision();ok(await f.call('','PATCH',{owner_name:'Wes'}));assert.equal(ok(await f.call('/state')).project.owner_name,'Wes');assert.equal((await f.call('','PATCH',{owner_name:'Wyatt'},{revision:token})).status,409);assert.equal((await f.call('','PATCH',{owner_name:'Other'})).status,400);
 const backup=await(await api(f,f.projectId,'/export')).text(),target=id();const restored=await api(f,target,'/import-copy?name=Recovered','POST',backup,{'x-operation-id':id(),'x-project-revision':'new'});assert.equal(restored.status,200,await restored.clone().text());assert.equal((await(await api(f,target)).json()).project.owner_name,'Wes');
 const lines=backup.trimEnd().split('\n').map(JSON.parse);delete lines[0].manifest.project.owner_name;const older=lines.map(JSON.stringify).join('\n')+'\n',legacy=id();assert.equal((await api(f,legacy,'/import-copy?name=Older','POST',older,{'x-operation-id':id(),'x-project-revision':'new'})).status,200);assert.equal((await(await api(f,legacy)).json()).project.owner_name,'Ryan');
});
