import {defaultWebsiteSettings} from './website-settings-model.js';
let settings=defaultWebsiteSettings(),pending=null;
export const websiteSettings=()=>settings;
export function loadWebsiteSettings(){
 if(!pending)pending=fetch('/api/project-engine/settings',{credentials:'same-origin',cache:'no-store'}).then(async response=>{const data=await response.json();if(!response.ok)throw Object.assign(Error(data.error||'Website settings could not be loaded.'),{status:response.status});settings=data;return settings;}).catch(error=>{pending=null;throw error;});return pending;
}
export function ownerChoices(current=[]){return [...new Set([...settings.owners,...current.filter(Boolean)])];}
