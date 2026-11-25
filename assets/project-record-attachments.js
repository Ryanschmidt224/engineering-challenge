import {node,field,actions} from "./workshop-ui.js";
import {recordPrompts} from "./project-record-model.js";

// Per-prompt names live with the record, so edits and frozen snapshots preserve
// both the explanation and its exact immutable file IDs.
export function recordAttachments(ctx,draft,editor){
 const area=node("div"),groups=structuredClone(draft.fields.attachments||{}),assigned=new Set(Object.values(groups).flat().map(row=>row.id));
 const unassigned=draft.fileIds.filter(id=>!assigned.has(id));groups.support||=[];groups.support.push(...unassigned.map(id=>({id,name:""})));
 const sync=()=>{const entries=Object.fromEntries(Object.entries(groups).filter(([key,list])=>list.length&&list.length<=12&&(key!=="support"||list.some(entry=>entry.name)||draft.fields.attachments?.support)));if(Object.keys(entries).length)draft.fields.attachments=entries;else delete draft.fields.attachments;draft.fileIds=[...new Set(Object.values(groups).flat().map(row=>row.id))];};
 for(const [key,label]of [...Object.entries(recordPrompts[draft.type]),["support","Supporting files"]]){
  const list=groups[key]||=[];const section=window.BSUI.section({title:key==="support"?label:label+" — attachments"}),input=node("input"),files=node("div"),status=node("p","","ui-status");section.root.open=key==="support";input.type="file";input.multiple=true;input.setAttribute("aria-label",key==="support"?label:label+" files");
  const render=()=>{files.replaceChildren();for(const entry of list){const saved=ctx.client.state.files.find(row=>row.id===entry.id),name=entry.name||saved?.name||"Uploaded attachment";files.append(actions(field("Attachment name",entry.name,value=>{entry.name=value;sync();},{placeholder:name}),node("span",saved?.name||name),window.BSUI.button("Remove attachment",()=>{list.splice(list.indexOf(entry),1);sync();render();},{variant:"quiet"})));}if(list.length>12)files.append(node("p","Older attachments are retained. Keep up to 12 here to give this group individual names."));};
  let pending=[],busy=false;input.onchange=()=>pending=Array.from(input.files);if(draft.fields.category==="photos")input.accept="image/*";
  const send=async incoming=>{
   if(busy)return;if(incoming)pending.push(...incoming);if(!pending.length)return;
   if(pending.length+list.length>12){status.textContent="Choose up to 12 attachments per prompt.";return;}
   busy=true;editor.fields.inert=true;editor.uploadBusy(true);
   try{while(pending.length){const file=pending[0];if(file.size>20*1024*1024)throw Error("Choose files of at most 20 MB each.");if(draft.fields.category==="photos"&&!file.type.startsWith("image/"))throw Error("Photos entries accept images only.");const result=await ctx.client.upload(ctx.projectId,file,{expectedRevision:editor.revision});editor.acceptOwnWrites(result.revision);list.push({id:result.fileId,name:file.name.slice(0,120)});pending.shift();sync();render();}input.value="";status.textContent="Attachments uploaded. Save the record to attach them.";}catch(error){status.textContent=error.message;editor.handleError(error);}finally{busy=false;editor.fields.inert=false;editor.uploadBusy(false);}
  };
  const upload=window.BSUI.button(key==="support"?"Upload supporting files":"Upload "+label.toLowerCase()+" files",()=>send());
  section.body.addEventListener("paste",event=>{const incoming=Array.from(event.clipboardData?.files||[]);if(incoming.length){event.preventDefault();void send(incoming);}});
  section.body.addEventListener("dragover",event=>{if([...event.dataTransfer.types].includes("Files"))event.preventDefault();});section.body.addEventListener("drop",event=>{const incoming=Array.from(event.dataTransfer.files);if(incoming.length){event.preventDefault();event.stopPropagation();void send(incoming);}});
  section.body.append(node("p","Choose files, drop them here, or paste an image. Up to 12 per prompt, 20 MB each.","muted"),input,upload,files,status);render();area.append(section.root);
 }
 sync();return area;
}
