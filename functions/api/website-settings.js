import {normalizeWebsiteSettings} from '../../assets/website-settings-model.js';
export async function readWebsiteSettings(db){const row=await db.prepare("SELECT revision,value FROM website_settings WHERE id='global'").first();if(!row)throw Error('Website settings are unavailable.');return {revision:row.revision,...normalizeWebsiteSettings(JSON.parse(row.value))};}
export async function configuredOwner(db,value,current=null){const settings=await readWebsiteSettings(db),name=value===undefined?settings.defaultOwner:value;if(typeof name!=='string'||!settings.owners.includes(name)&&name!==current)throw Error('Choose a project owner from Website settings.');return name;}
export async function websiteSettingsBody(request){const raw=await request.text();if(raw.length>32000)throw Object.assign(Error('Settings too large'),{status:413});const body=JSON.parse(raw);if(typeof body.expectedRevision!=='string'||body.expectedRevision.length>80)throw Error('Load website settings before saving.');return {expectedRevision:body.expectedRevision,value:normalizeWebsiteSettings(body.value)};}
export async function websiteSettingsResponse(db,body){
 const current=await readWebsiteSettings(db);if(!body)return current;const value=body.value;
 if(JSON.stringify(value)===JSON.stringify({tags:current.tags,owners:current.owners,defaultOwner:current.defaultOwner}))return current;
 const conflict=()=>Object.assign(Error('Website settings changed. Reload and review before saving.'),{status:409});if(body.expectedRevision!==current.revision)throw conflict();
 const revision=crypto.randomUUID(),result=await db.prepare("UPDATE website_settings SET value=?,revision=? WHERE id='global' AND revision=?").bind(JSON.stringify(value),revision,current.revision).run();if(result.meta.changes!==1)throw conflict();return {revision,...value};
}
