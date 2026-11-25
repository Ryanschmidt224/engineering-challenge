import {node,field,actions} from "./workshop-ui.js";
import {recordPrompts} from "./project-record-model.js";

// One upload surface; saved prompt associations and immutable file IDs stay intact.
export function recordAttachments(ctx,draft,editor){
 const groups=structuredClone(draft.fields.attachments||{}),assigned=new Set(Object.values(groups).flat().map(row=>row.id));
 groups.support||=[];groups.support.push(...draft.fileIds.filter(id=>!assigned.has(id)).map(id=>({id,name:""})));
 const sync=()=>{const entries=Object.fromEntries(Object.entries(groups).filter(([key,list])=>list.length&&list.length<=12&&(key!=="support"||list.some(entry=>entry.name)||draft.fields.attachments?.support)));if(Object.keys(entries).length)draft.fields.attachments=entries;else delete draft.fields.attachments;draft.fileIds=[...new Set(Object.values(groups).flat().map(row=>row.id))];};
 const prompts=recordPrompts[draft.type],section=window.BSUI.section({title:"Attachments",role:"entry-attachments",open:true}),input=node("input"),files=node("div"),status=node("p","","ui-status");
 let target="support",pending=[],busy=false;input.type="file";input.multiple=true;input.setAttribute("aria-label","Attachments");if(draft.fields.category==="photos")input.accept="image/*";
 if(Object.keys(prompts).length>1)section.body.append(field("Attach files to",target,value=>target=value,{options:[{value:"support",label:"Entry (general)"},...Object.entries(prompts).map(([value,label])=>({value,label}))]}));
 const render=()=>{files.replaceChildren();for(const [key,list]of Object.entries(groups))for(const entry of list){const saved=ctx.client.state.files.find(row=>row.id===entry.id),name=entry.name||saved?.name||"Uploaded attachment";files.append(actions(field("Attachment name",entry.name,value=>{entry.name=value;sync();},{placeholder:name}),node("span",saved?.name||name),...(key!=="support"?[node("span",prompts[key]||key,"muted")]:[]),window.BSUI.button("Remove attachment",()=>{list.splice(list.indexOf(entry),1);sync();render();},{variant:"quiet"})));}};
 input.onchange=()=>pending=Array.from(input.files,file=>({file,key:null}));
 const send=async incoming=>{
  if(busy)return;if(incoming)pending.push(...incoming.map(file=>({file,key:target})));if(!pending.length)return;for(const entry of pending)entry.key??=target;
  const counts=new Map(Object.entries(groups).map(([key,list])=>[key,list.length]));for(const entry of pending)counts.set(entry.key,(counts.get(entry.key)||0)+1);if([...counts].some(([key,count])=>pending.some(entry=>entry.key===key)&&count>12)){status.textContent="Choose up to 12 attachments for each destination.";return;}
  busy=true;editor.fields.inert=true;editor.uploadBusy(true);
  try{while(pending.length){const {file,key}=pending[0];if(file.size>20*1024*1024)throw Error("Choose files of at most 20 MB each.");if(draft.fields.category==="photos"&&!file.type.startsWith("image/"))throw Error("Photos entries accept images only.");const result=await ctx.client.upload(ctx.projectId,file,{expectedRevision:editor.revision});editor.acceptOwnWrites(result.revision);(groups[key]||=[]).push({id:result.fileId,name:file.name.slice(0,120)});pending.shift();sync();render();}input.value="";status.textContent="Attachments uploaded. Save the record to attach them.";}catch(error){status.textContent=error.message;editor.handleError(error);}finally{busy=false;editor.fields.inert=false;editor.uploadBusy(false);}
 };
 const upload=window.BSUI.button("Upload attachments",()=>send());
 section.body.addEventListener("paste",event=>{const incoming=Array.from(event.clipboardData?.files||[]);if(incoming.length){event.preventDefault();void send(incoming);}});
 section.body.addEventListener("dragover",event=>{if([...event.dataTransfer.types].includes("Files"))event.preventDefault();});section.body.addEventListener("drop",event=>{const incoming=Array.from(event.dataTransfer.files);if(incoming.length){event.preventDefault();event.stopPropagation();void send(incoming);}});
 section.body.append(node("p","Choose files, drop them here, or paste an image. Up to 12 per destination, 20 MB each.","muted"),input,upload,files,status);render();sync();return section.root;
}
