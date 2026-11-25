// Screen wording only; persisted record types and item fields stay unchanged.
export const recordLabels=Object.freeze({test:"Tests / Measurements",problem:"Failures",note:"Notes",change_note:"Change notes"});
export const containerName=item=>item.short_name||item.name;
export const containerHelp="The top-level name shown in the feature tree, such as Power supply or Controller. Use up to 20 characters. Leave it blank to use the Specific Part Name. The Generic Part Name describes the role; the Specific Part Name identifies the selected physical component.";
