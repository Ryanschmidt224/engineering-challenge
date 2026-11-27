import {fieldHelp} from './project-item-fields.js';
import {checkbox,node} from './workshop-ui.js';
// Persist the user's choice; equal names alone do not imply linked fields.
export function identityNameLink(details,generic,specific,{creating=false,rows=[]}={}){
 let linked=details.fields.name_linked??(creating||details.short_name===details.name),separateName=details.name;
 const sync=()=>{details.fields.name_linked=linked;specific.readOnly=linked;for(const row of rows)row.hidden=linked;specific.required=!linked;generic.required=linked;if(linked){details.name=generic.value;specific.value=details.name;}};
 const choice=checkbox('Part Name (Generic) and Part Name (Specific) are the same.',linked,value=>{if(value)separateName=specific.value;linked=value;if(!linked&&separateName){details.name=separateName;specific.value=separateName;}sync();});
 fieldHelp(choice,'matching part names','Uses Part Name (Generic) as Part Name (Specific). Hides the separate specific-name and description fields. Uncheck to edit them; entered values are preserved.');
 generic.addEventListener('input',()=>{if(linked)sync();});specific.addEventListener('input',()=>{if(!linked)separateName=specific.value;});sync();
 const root=node('div');root.append(choice);return root;
}
