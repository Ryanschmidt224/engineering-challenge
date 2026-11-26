import {projectRestorePicker} from "./project-restore-controls.js";
import {createProjectClient} from "./project-client.js";
import {backupAllDataButton} from "./site-data-backup.js";
import {node,field,actions} from './workshop-ui.js';
import {initSiteHeader} from './site-header.js';
import {settingsSaved} from "./website-settings-client.js";
import {normalizeWebsiteSettings} from './website-settings-model.js';
initSiteHeader();
const root=document.querySelector('[data-website-settings]'),notice=document.querySelector('[data-notice]'),button=(...args)=>window.BSUI.button(...args);let draft,revision,dirty=false;
const backup=window.BSUI.section({title:'Data backup',role:'website-backup',open:true});
const backupButton=backupAllDataButton();backup.body.append(node('p','Download the website database and stored files to a backup file on your device.','muted'),backupButton);if(backupButton.disabled)backup.body.append(node('p',backupButton.title,'muted'));root.after(backup.root);
const report=message=>{notice.textContent=message;};
const restore=window.BSUI.section({title:'Restore project backup',role:'website-project-restore'});
restore.body.append(node('p','Restore a .bsproject backup as a separate project with independent files. Existing projects stay unchanged.','muted'),projectRestorePicker({client:createProjectClient(),notify:report,onRestored:result=>{report('Recovered copy created with '+result.verifiedFiles+' verified files. ');const link=node('a','Open restored project','ui-button');link.href='project.html?project='+encodeURIComponent(result.projectId);notice.append(link);}}));backup.root.after(restore.root);

async function read(){const response=await fetch('/api/project-engine/settings',{credentials:'same-origin',cache:'no-store'}),data=await response.json();if(!response.ok)throw Error(data.error||'Settings could not be loaded.');draft=normalizeWebsiteSettings(data);revision=data.revision;dirty=false;render();}
function render(){
 root.replaceChildren();const form=node('form'),owners=window.BSUI.section({title:'Project owners',role:'website-owners',open:true}),tags=window.BSUI.section({title:'Tags',role:'website-tags',open:true});
 const defaultField=field('Default project owner',draft.defaultOwner,value=>{draft.defaultOwner=value;dirty=true;},{options:draft.owners.map(value=>({value,label:value}))});
 const updateDefault=()=>{const select=defaultField.querySelector('select');select.replaceChildren();for(const value of draft.owners){const option=node('option',value);option.value=value;select.append(option);}select.value=draft.defaultOwner;};
 const list=(key,section,label,max)=>{const rows=node('div','','ui-settings-list');section.body.append(rows);const draw=()=>{rows.replaceChildren();draft[key].forEach((value,index)=>{const row=node('div','','ui-settings-row'),input=node('input','','ui-control');input.value=value;input.maxLength=max;input.required=true;input.setAttribute('aria-label',label+' '+(index+1));input.oninput=()=>{if(key==='owners'&&draft.defaultOwner===draft[key][index])draft.defaultOwner=input.value;draft[key][index]=input.value;dirty=true;if(key==='owners')updateDefault();};row.append(input,button('Remove',()=>{if(key==='owners'&&draft.owners.length===1){report('Keep at least one project owner.');return;}const removed=draft[key].splice(index,1)[0];if(key==='owners'&&draft.defaultOwner===removed)draft.defaultOwner=draft.owners[0];dirty=true;draw();if(key==='owners')updateDefault();},{variant:'quiet',small:true}));rows.append(row);});};draw();section.body.append(button('Add '+label.toLowerCase(),()=>{draft[key].push('');dirty=true;draw();rows.lastElementChild.querySelector('input').focus();}));};
 list('owners',owners,'Owner',80);owners.body.append(defaultField,node('p','Names label projects; they do not grant access. New projects start with the default owner.','muted'));list('tags',tags,'Tag',60);
 const save=button('Save settings',()=>form.requestSubmit(),{variant:'primary'}),reload=button('Reload settings',()=>{if(!dirty||confirm('Discard unsaved settings and reload?'))void read().catch(error=>report(error.message));});
 form.append(node('p','Manage the choices available across the website. Removing or renaming a choice does not change existing projects.','muted'),owners.root,tags.root,actions(save,reload));
 form.onsubmit=async event=>{event.preventDefault();if(!form.reportValidity())return;save.disabled=true;try{const value=normalizeWebsiteSettings(draft),response=await fetch('/api/project-engine/settings',{method:'PATCH',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({expectedRevision:revision,value})}),data=await response.json();if(!response.ok)throw Error(data.error||'Settings could not be saved.');settingsSaved(data);draft=normalizeWebsiteSettings(data);revision=data.revision;dirty=false;render();report('Website settings saved.');}catch(error){report(error.message);}finally{save.disabled=false;}};root.append(form);
}
addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
void read().catch(error=>{report(error.message);root.replaceChildren(button('Try again',()=>void read().catch(error=>report(error.message))));});
