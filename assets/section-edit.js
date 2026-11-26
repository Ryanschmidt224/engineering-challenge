// Shared header action for any expanded disclosure section.
export function sectionEdit(section,label,onClick){
 const edit=window.BSUI.button(label,event=>{event.preventDefault();event.stopPropagation();onClick(event);},{variant:'quiet',small:true,className:'ui-section__edit'});section.aside.append(edit);return edit;
}
