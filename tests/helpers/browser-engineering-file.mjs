// Inert legacy engineering-file fixture: independent of the removed CAD upload UI.
import {expect} from '@playwright/test';
export async function engineeringFixture(page,name,bytes,{itemId,occurrenceId}={}){
 const url=new URL(page.url()),project=url.searchParams.get('project');
 itemId ||= url.searchParams.get('item');occurrenceId ||= url.searchParams.get('occurrence');
 const base='/api/project-engine/projects/'+project;
 const write=async(path,data)=>{const state=await(await page.request.get(base+'/state')).json();const response=await page.request.post(base+path,{headers:{origin:'http://127.0.0.1:4173'},data:{...data,operationId:crypto.randomUUID(),expectedRevision:state.project.revision}});expect(response.ok(),await response.text()).toBe(true);return response.json();};
 const prepared=await write('/files/prepare',{name,content_type:'application/octet-stream'});
 const response=await page.request.put(base+'/files/'+prepared.fileId+'/bytes',{headers:{origin:'http://127.0.0.1:4173','x-operation-id':crypto.randomUUID(),'x-project-revision':prepared.revision},data:Buffer.from(bytes)});expect(response.ok(),await response.text()).toBe(true);
 await write('/files/'+prepared.fileId+'/admit',{role:'engineering',itemId,occurrenceId});await page.reload();
}
