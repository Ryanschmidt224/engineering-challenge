import {readWebsiteSettings} from "./website-settings.js";
import {normalizeOverview} from '../../assets/project-overview-model.js';
import {commitProjectCommand,CommandConflict} from './project-command.js';
import {readyFiles} from './project-state.js';
export async function editOverview(db,input,project,data){
 const saved=normalizeOverview(project.overview||{}),next=structuredClone(saved),record={...data.record,id:crypto.randomUUID(),createdAt:new Date().toISOString()};
 if(data.action==='prices'){next.prices=data.prices;}
 else if(data.action==='summary'){next.shortSummary=data.shortSummary;next.description=data.description;next.tags=data.tags;}
 else if(data.action==='intent'){if(saved.intent&&(!data.record?.reason||!data.record.reason.trim()))throw Error('A reason is required when editing original intent.');if(saved.intent&&!next.intentVersions.length)next.intentVersions.push(saved.intent);next.intent={...record,preExistingMilestones:saved.milestones.length};next.intentVersions.push(next.intent);}
 else if(data.action==='milestone')next.milestones.push(record);
 else if(data.action==='note'){if(data.id){const at=next.notes.findIndex(v=>v.id===data.id);if(at<0)throw Error('Note not found.');next.notes[at]={...data.record,id:data.id,createdAt:next.notes[at].createdAt};}else next.notes.push(record);}
 else if(data.action==='remove-note'){const at=next.notes.findIndex(v=>v.id===data.id);if(at<0)throw Error('Note not found.');next.notes.splice(at,1);}
 else throw Error('Unknown overview action.');
 const clean=normalizeOverview(next);if(data.action==='summary'){const settings=await readWebsiteSettings(db);if(clean.tags.some(tag=>!settings.tags.includes(tag)&&!saved.tags.includes(tag)))throw Error("Choose tags from Website settings.");}if(data.action==='prices'){const ids=(await db.prepare("SELECT id FROM engine_items WHERE project_id=?").bind(project.id).all()).results.map(r=>r.id);if(Object.keys(clean.prices).some(id=>!ids.includes(id)))throw Error("Price must belong to a part in this project.");}if(data.action==='note')await readyFiles(db,project.id,clean.notes.find(v=>v.id===(data.id||record.id)).fileIds);
 return commitProjectCommand(db,input,w=>{w.update('engine_projects',{overview:JSON.stringify(clean)},{id:project.id,owner_id:input.actorId});return {projectId:project.id};});
}
