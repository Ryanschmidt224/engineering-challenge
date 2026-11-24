import {normalizeCustomItem,normalizeOccurrence,diffProjectItems,formatRevisionValue} from "./project-item-model.js";
import {openHistoryEntryDialog} from "./history-entry-dialog.js";
import {partHelp} from "./part-help.js";
import {node} from "./workshop-ui.js";
import {savedPartView,configurationView} from "./project-information.js";

export function partHistoryPrompt(ctx,item,trigger,{archive=false,changes={},expectedRevision=ctx.client.state.project.revision,onOwnUpload=()=>{},onComplete=()=>{}}={}){
 let token=expectedRevision;const projectId=ctx.projectId;
 const form=openHistoryEntryDialog({trigger,project:projectId,title:archive?"Archive part":Object.keys(changes).length?"Save as revision":"Create a Revision",description:archive?partHelp.archive:Object.keys(changes).length?partHelp.saveAsRevision:partHelp.revisions,submitLabel:archive?"Archive part":"Save revision",archive,ui:window.BSUI,photoEditor:window.BSPhotoEditor,
  uploadPhoto:async file=>{const result=await ctx.client.upload(projectId,file,{expectedRevision:token});token=result.revision;onOwnUpload(token);return result.fileId;},
  onSave:async entryDetails=>{
   try{
    await ctx.client.write(projectId,"/items/"+item.id+(archive?"/archive":"/revisions"),"POST",{...changes,entryDetails},token);
    const refreshed=archive?await ctx.openArchive():await ctx.refresh();
    if(refreshed===false)throw Error("The change was saved but could not be reopened. Retry this same save to reopen it without creating another copy.");onComplete();
   }catch(error){
    if(error.status===409&&!form.body.querySelector("[data-revision-review]")){
     const review=node("div");review.dataset.revisionReview="";
     review.append(window.BSUI.button("Review newer changes",async()=>{try{
      const state=await ctx.client.load(projectId),current=state.items.find(row=>row.id===item.id),occurrence=state.occurrences.find(row=>row.item_id===item.id);
      if(!current||!occurrence||occurrence.removed_at!==null)throw Error("This part is archived. Cancel and inspect History → Archive.");
      review.replaceChildren(node("p","Your draft and explanation are retained. Review the current saved part before accepting its version."),configurationView({snapshot:{item:current,occurrence:{...occurrence,root:{name:state.project.name}}}},"Current saved part"));
      if(changes.details){
       const details=normalizeCustomItem({name:current.name,short_name:current.short_name,part_number:current.part_number,kind:current.kind,source:current.source,is_tool:!!current.is_tool,fields:current.fields}),build=normalizeOccurrence({quantity:occurrence.quantity,unit:occurrence.unit,build_status:occurrence.build_status,attention:!!occurrence.attention,attention_note:occurrence.attention_note,hidden:!!occurrence.hidden});
       for(const change of diffProjectItems(details,changes.details,build,changes.build||build))review.append(window.BSUI.fieldRow(change.label,formatRevisionValue(change.before)+" saved → "+formatRevisionValue(change.after)+" in your draft").root);
      }
      const reviewed=state.project.revision;review.append(window.BSUI.button("Use newer version after review",()=>{token=reviewed;onOwnUpload(token);review.remove();form.feedback.textContent="Newer version reviewed. Your draft and explanation are retained; save when ready.";}));
     }catch(problem){form.feedback.textContent=problem.message;}}));form.body.append(review);
    }
    throw error;
   }
  }});return form;
}

export async function partRevisions(ctx,item){
 const section=window.BSUI.section({title:"Revisions",role:"part-revisions",count:0,countLabel:["saved","saved"],tooltip:partHelp.revisions}),list=node("div"),message=node("p");message.setAttribute("role","status");
 const create=window.BSUI.button("Create a Revision",()=>partHistoryPrompt(ctx,item,create));window.BSUI.sectionActions(section.body,{primary:create});section.body.append(node("p","Working revision "+(item.revision_level||1),"muted"),list,message);
 let cursor=null,loading=false;const seen=new Set();
 const load=async()=>{if(loading)return;loading=true;more.disabled=true;try{
  const query=new URLSearchParams({scope:item.id,type:"revisions",limit:"50",...(cursor?{cursor}:{})}),result=await ctx.client.request("/"+ctx.projectId+"/history?"+query);cursor=result.nextCursor;section.setCount(result.total);
  for(const event of result.entries){if(seen.has(event.id))continue;seen.add(event.id);
   const title=event.payload.level?"Revision "+event.payload.level:"Earlier copy",entry=window.BSUI.section({title,role:"part-revision"}),date=node("time",event.created_at.slice(0,10),"ui-revision-date"),changed=node("span",event.payload.entryDetails?.whatChanged||event.summary||"","ui-revision-change");date.dateTime=event.created_at;entry.count.remove();entry.aside.remove();entry.header.classList.add("ui-revision-header");entry.header.append(date,changed);list.append(entry.root);
   let loaded=false,busy=false;entry.root.addEventListener("toggle",async()=>{if(!entry.root.open||loaded||busy)return;busy=true;try{const saved=await ctx.client.request("/"+ctx.projectId+"/history/"+event.id);entry.body.replaceChildren(saved.event.payload.snapshot?savedPartView(ctx,saved.event):configurationView(saved.configurations.find(row=>row.id===saved.event.payload.before)));loaded=true;}catch(error){entry.body.replaceChildren(node("p",error.message));}finally{busy=false;}});
  }
  list.append(more);more.hidden=!cursor;
 }catch(error){message.textContent=error.message;}finally{loading=false;more.disabled=false;}};
 const more=window.BSUI.button("Load earlier revisions",()=>load());more.hidden=true;await load();return section.root;
}
