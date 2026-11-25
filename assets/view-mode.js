// Shared Details/List/Tiles control; content renderers own their row fields.
export function viewMode({label="View",storageKey,initial="details",onChange}){
 const modes=[["details","Details"],["list","List"],["tiles","Tiles"]];let value=initial;
 try{const saved=localStorage.getItem(storageKey),mode=saved==="icons"?"tiles":saved;if(modes.some(([key])=>key===mode))value=mode;}catch{}
 const root=document.createElement("label"),select=document.createElement("select");root.className="ui-toolbar-field";root.append("View");select.className="ui-control";select.setAttribute("aria-label",label);
 for(const [key,title]of modes){const option=document.createElement("option");option.value=key;option.textContent=title;select.append(option);}select.value=value;root.append(select);
 select.onchange=()=>{value=select.value;try{localStorage.setItem(storageKey,value);}catch{}onChange(value);};return {root,select,value};
}
