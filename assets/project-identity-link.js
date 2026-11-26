import {checkbox,node} from './workshop-ui.js';
// An editor shortcut over existing fields, not a new persistent relationship.
export function identityNameLink(details,generic,specific,{creating=false}={}){
 let linked=creating||details.short_name===details.name,separateName=details.name;
 const sync=()=>{specific.readOnly=linked;generic.required=linked;if(linked){details.name=generic.value;specific.value=details.name;}};
 const choice=checkbox('Part details are same as Part identity',linked,value=>{if(value)separateName=specific.value;linked=value;if(!linked&&separateName){details.name=separateName;specific.value=separateName;}sync();});
 const description=node('small','Links Generic Part Name to Specific Part Name. Description, manufacturer and specifications stay independent.','muted');description.id='identity-link-'+crypto.randomUUID();choice.querySelector('input').setAttribute('aria-describedby',description.id);
 generic.addEventListener('input',()=>{if(linked)sync();});specific.addEventListener('input',()=>{if(!linked)separateName=specific.value;});sync();
 const root=node('div');root.append(choice,description);return root;
}
