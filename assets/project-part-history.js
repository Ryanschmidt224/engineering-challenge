import {normalizeCustomItem,normalizeOccurrence,diffProjectItems,formatRevisionValue} from "./project-item-model.js";
import {openHistoryEntryDialog} from "./history-entry-dialog.js";
import {partHelp} from "./part-help.js";
import {projectHelp} from "./project-help.js";
import {dataTable} from "./data-table.js";
import {node} from "./workshop-ui.js";
import {savedPartView,configurationView} from "./project-information.js";

export function partHistoryPrompt(ctx,item,trigger,{archive=false,changes={},path=null,expectedRevision=ctx.client.state.project.revision,onOwnUpload=()=>{},onComplete=()=>{}}={}){
 let token=expectedRevision;const projectId=ctx.projectId;
 const archiveLabel=item.is_assembly?"Archive subassembly":"Archive part";
 const form=openHistoryEntryDialog({trigger,project:projectId,title:archive?archiveLabel:Object.keys(changes).length?"Save as revision":"Create a Revision",description:archive?partHelp.archive:Object.keys(changes).length?partHelp.saveAsRevision:partHelp.revisions,submitLabel:archive?archiveLabel:"Save revision",archive,ui:window.BSUI,photoEditor:window.BSPhotoEditor,
  uploadPhoto:async file=>{const result=await ctx.client.upload(projectId,file,{expectedRevision:token});token=result.revision;onOwnUpload(token);return result.fileId;},
  onSave:async entryDetails=>{
   try{
    await ctx.client.write(projectId,path||(archive&&ctx.occurrenceId?"/occurrences/"+ctx.occurrenceId+"/archive":"/items/"+item.id+(archive?"/archive":"/revisions")),"POST",{...changes,...(ctx.occurrenceId?{occurrenceId:ctx.occurrenceId}:{}),entryDetails},token);
    const refreshed=archive?await ctx.openArchive():await ctx.refresh();
    if(refreshed===false)throw Error("The change was saved but could not be reopened. Retry this same save to reopen it without creating another copy.");onComplete();
   }catch(error){
    if(error.status===409&&!form.body.querySelector("[data-revision-review]")){
     const review=node("div");review.dataset.revisionReview="";
     review.append(window.BSUI.button("Review newer changes",async()=>{try{
      const state=await ctx.client.load(projectId),current=state.items.find(row=>row.id===item.id),occurrence=state.occurrences.find(row=>ctx.occurrenceId?row.id===ctx.occurrenceId:row.item_id===item.id);
      if(!current||!occurrence||occurrence.removed_at!==null)throw Error("This part is archived. Cancel and inspect History → Archive.");
      review.replaceChildren(node("p","Your draft and explanation are retained. Review the current saved part before accepting its version."),configurationView({snapshot:{item:current,occurrence:{...occurrence,root:{name:state.project.name}}}},"Current saved part"));
      if(changes.details){
       const details=normalizeCustomItem({name:current.name,short_name:current.short_name,part_number:current.part_number,kind:current.kind,source:current.source,is_tool:!!current.is_tool,is_assembly:!!current.is_assembly,fields:current.fields}),build=normalizeOccurrence({quantity:occurrence.quantity,unit:occurrence.unit,build_status:occurrence.build_status,attention:!!occurrence.attention,attention_note:occurrence.attention_note,hidden:!!occurrence.hidden});
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
 const section=window.BSUI.section({title:"Revisions",role:"part-revisions",count:0,tooltip:partHelp.revisions}),list=node("div"),detail=node("div"),message=node("p");message.setAttribute("role","status");
 const create=window.BSUI.button("Create a Revision",()=>partHistoryPrompt(ctx,item,create));window.BSUI.sectionActions(section.body,{primary:create});section.body.append(node("p",partHelp.revisions),list,detail,message);
 section.body.insertBefore(node("p",projectHelp.workingRevision),list);const table=dataTable("Part revision table",["Revision","Date","What changed"]);table.append([String(item.revision_level||1)+" (working)","Current","Working draft"]);list.append(table.root);
 let cursor=null,count=0;
 const load=async()=>{try{
  const query=new URLSearchParams({scope:item.id,type:"revisions",limit:"50",...(cursor?{cursor}:{})}),result=await ctx.client.request("/"+ctx.projectId+"/history?"+query);cursor=result.nextCursor;count=result.total;section.setCount(count);
  for(const event of result.entries){const level=event.payload.level,date=node("time",event.created_at.slice(0,10));date.className="ui-table-date";date.dateTime=event.created_at;
   const view=window.BSUI.button(level?"View "+level:"View copy",async()=>{try{const saved=await ctx.client.request("/"+ctx.projectId+"/history/"+event.id);detail.replaceChildren(node("h2",event.payload.level?"Revision "+event.payload.level:"Earlier copy"));detail.append(saved.event.payload.snapshot?savedPartView(ctx,saved.event):configurationView(saved.configurations.find(row=>row.id===saved.event.payload.before)));detail.querySelector("h2")?.scrollIntoView({block:"center"});}catch(error){message.textContent=error.message;}},{small:true});view.setAttribute("aria-label",level?"View revision "+level:"View earlier copy");table.append([view,date,event.payload.entryDetails?.whatChanged||event.summary||""]);
  }
  more.hidden=!cursor;
 }catch(error){message.textContent=error.message;}};
 const more=window.BSUI.button("Load earlier revisions",()=>load());more.hidden=true;list.append(more);await load();return section.root;
}

