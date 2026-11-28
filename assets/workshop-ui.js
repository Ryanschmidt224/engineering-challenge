import {requestResult} from "./request-result.js";
import {interfaceHelp} from "./interface-help.js";
import {present,isWebUrl} from "./family-model.js";

export const node=(tag,text="",className="")=>{const element=document.createElement(tag);element.className=className;element.textContent=text;return element;};
export const button=(label,action,variant="")=>{const element=node("button",label,"button "+variant);element.type="button";element.onclick=action;return element;};
// Selectable list rows own their layout; action-button styles must not apply.
export const listCard=(label,action,variant="")=>{const element=node("button",label,"list-card "+variant);element.type="button";element.onclick=action;return element;};
export const actions=(...elements)=>{const element=node("div","","actions");element.append(...elements);return element;};
export const help=(title,key)=>{const button=window.BSDialogs.helpButton("About "+title,interfaceHelp[key]);button.setAttribute("aria-label","About "+title);return button;};
export const panel=(title,helpKey="")=>{const element=node("section","","panel"),header=node("div","","panel-heading");header.append(node("h3",title));if(helpKey)header.append(help(title,helpKey));element.append(header);return element;};
export function field(label,value,update,{type="text",options=null,required=false,placeholder=""}={}) {
 const row=node("div","","field-row"),caption=node("label",label),input=node(options?"select":type==="textarea"?"textarea":"input","","field");
 input.id="field-"+crypto.randomUUID();caption.htmlFor=input.id;
 if(options)for(const option of options){const entry=node("option",option.label);entry.value=option.value;input.append(entry);}
 else if(type!=="textarea")input.type=type;
 if(type==="number")input.step="any";
 input.value=value??"";input.required=required;input.placeholder=placeholder;
 input.addEventListener(options?"change":"input",()=>update(type==="number"?input.value===""?null:Number(input.value):input.value));
 row.append(caption,input);return row;
}
export function checkbox(label,value,update) {
 const row=node("label","","checkbox"),input=node("input");input.type="checkbox";input.checked=!!value;input.onchange=()=>update(input.checked);row.append(input,document.createTextNode(label));return row;
}
export function readValue(label,value,{url=false}={}) {
 if(!present(value))return null;
 const row=node("div","","field-row field-row--read"),labelElement=node("dt",label),description=node("dd");
 if(url&&isWebUrl(value)){const link=node("a",value);link.href=value;link.target="_blank";link.rel="noopener noreferrer";description.append(link);}
 else description.textContent=typeof value==="boolean"?value?"Yes":"No":String(value);
 row.append(labelElement,description);return row;
}
export function valuesEditor(fields,values,change,{product=false,productValues={},showUseFields=false}={}) {
 const area=node("div");
 const sorted=[...fields].sort((a,b)=>product?a.sort_order-b.sort_order:Number(b.filled_on_use)-Number(a.filled_on_use)||a.sort_order-b.sort_order);
 for(const definition of sorted){
  if(definition.hidden||product&&definition.filled_on_use&&!showUseFields&&!present(values[definition.id]))continue;
  const label=definition.label+(definition.unit?" ("+definition.unit+")":"");
  const options=definition.type==="boolean"?[{value:"",label:"Not set"},{value:"true",label:"Yes"},{value:"false",label:"No"}]
   :definition.type==="choice"&&definition.choices.length?[{value:"",label:"Not set"},...definition.choices.map(value=>({value,label:value}))]:null;
  const value=definition.type==="boolean"&&present(values[definition.id])?String(values[definition.id]):values[definition.id];
  const row=field(label,value,next=>{values[definition.id]=definition.type==="boolean"?next===""?null:next==="true":next;change();},{type:definition.type==="number"?"number":"text",options});
  row.dataset.fieldId=definition.id;
  if(present(productValues[definition.id])){
   const note=node("small","Selected product: "+(typeof productValues[definition.id]==="boolean"?productValues[definition.id]?"Yes":"No":productValues[definition.id])+(definition.unit?" "+definition.unit:""),"specification-note");
   row.lastChild.after(note);
  }
  area.append(row);
 }
 return area;
}
export async function requestWorkshop(path="/api/workshop",method="GET",payload) {
 return requestResult(path,{method,credentials:"same-origin",cache:"no-store",...(payload===undefined?{}:{headers:{"content-type":"application/json"},body:JSON.stringify(payload)})});
}
