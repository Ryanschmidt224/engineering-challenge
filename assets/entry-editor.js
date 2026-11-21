/* Shared visual primitives for Work Instructions and their records.
   Domain persistence remains with the respective editor; this module owns
   only repeated form controls and consistent labeling. */
(function(){
 "use strict";
 const make=(tag,cls,text)=>{
  const node=document.createElement(tag);
  if(cls)node.className=cls;
  if(text!==undefined)node.textContent=text;
  return node;
 };
 function action(label,callback,{kind="secondary",className=""}={}){
  const control=make("button","btn bs-entry-action"+(kind==="primary"?" primary":"")+(kind==="danger"?" bs-entry-action-danger":"")+(className?" "+className:""),label);
  control.type="button";
  control.addEventListener("click",callback);
  return control;
 }
 function actionRow(buttons=[]){
  const row=make("div","bs-entry-editor-actions");
  for(const control of buttons){
   if(!control)continue;
   control.classList.add("bs-entry-action");
   row.append(control);
  }
  return row;
 }
 function attachmentButton(open,{label="Add photos / documents",className=""}={}){
  return action(label,open,{className:"bs-attachment-add"+(className?" "+className:"")});
 }
 function titleInput(value,onChange,{placeholder="Title",maxLength=180}={}){
  const field=make("input","field bs-entry-title-input");
  field.type="text";field.value=value||"";field.maxLength=maxLength;field.placeholder=placeholder;
  field.addEventListener("input",()=>onChange?.(field.value));
  return field;
 }
 window.BSEntryEditor=Object.freeze({action,actionRow,attachmentButton,titleInput});
})();