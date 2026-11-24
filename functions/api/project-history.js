import {rows,statement,decode,uuid,ProjectNotFound} from "./project-state.js";
const effectiveType="COALESCE(r.type,e.type)";
const searchText=`lower(COALESCE(r.title,e.title)||' '||CASE WHEN r.id IS NULL THEN e.summary ELSE '' END||' '||i.name||' '||i.part_number||' '||COALESCE(json_extract(e.payload,'$.entryDetails.whatChanged'),'')||' '||COALESCE(json_extract(e.payload,'$.entryDetails.whyChanged'),'')||' '||COALESCE(json_extract(e.payload,'$.entryDetails.notes'),'')||' '||COALESCE(json_extract(e.payload,'$.reason'),'')||' '||COALESCE(json_extract(e.payload,'$.label'),'')||' '||COALESCE((SELECT group_concat(value,' ') FROM json_each(r.fields)),'')||' '||COALESCE((SELECT group_concat(COALESCE(json_extract(value,'$.label'),'')||' '||COALESCE(json_extract(value,'$.before.value'),'')||' '||COALESCE(json_extract(value,'$.after.value'),''),' ') FROM json_each(e.payload,'$.changes')),''))`;
const filterTypes={revisions:["revision"],archives:["archived","removed"],activity:["test","problem","note","change_note","file_replaced","restored","step_retired","step_restored"],tests:["test"],problems:["problem"],notes:["note"],changes:["revision","change_note","file_replaced","archived","removed","restored","step_retired","step_restored"]};
function cursorValue(value){
 if(!value)return null;
 try{const parsed=JSON.parse(atob(value.replace(/-/g,"+").replace(/_/g,"/")));if(!uuid(parsed.id)||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(parsed.time))throw Error();return parsed;}catch{throw Error("Invalid History cursor. Start from the first page.");}
}
const cursor=row=>btoa(JSON.stringify({time:row.created_at,id:row.id})).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
export async function historyPage(db,projectId,params){
 const occurrence=params.get("occurrence")||"";if(occurrence&&!uuid(occurrence))throw Error("Invalid History placement.");
 const type=params.get("type")||"all",scope=params.get("scope")||"",q=(params.get("q")||"").trim().toLowerCase(),limit=Number(params.get("limit")||20),after=cursorValue(params.get("cursor"));
 if(type!=="all"&&!Object.hasOwn(filterTypes,type)||scope&&!uuid(scope)||q.length>180||!Number.isInteger(limit)||limit<1||limit>50)throw Error("Invalid History filter.");
 const conditions=["e.project_id=?"],values=[projectId];
 if(scope){conditions.push("(e.item_id=? OR json_extract(e.payload,'$.parent_item_id')=?)");values.push(scope,scope);}
 if(type!=="all"){conditions.push(effectiveType+" IN("+filterTypes[type].map(()=>"?").join(",")+")");values.push(...filterTypes[type]);}
 if(q){conditions.push("instr("+searchText+",?)>0");values.push(q);}
 if(occurrence){conditions.push("json_extract(e.payload,'$.occurrence_id')=?");values.push(occurrence);}
 const countConditions=[...conditions],countValues=[...values];
 if(after){conditions.push("(e.created_at<? OR e.created_at=? AND e.id<?)");values.push(after.time,after.time,after.id);}
 const from=`FROM engine_events e JOIN engine_items i ON i.project_id=e.project_id AND i.id=e.item_id LEFT JOIN engine_records r ON r.project_id=e.project_id AND r.id=json_extract(e.payload,'$.record_id')`;
 const result=await db.batch([statement(db,`SELECT e.*,${effectiveType} AS display_type,COALESCE(r.title,e.title) AS display_title,r.event_date,
 COALESCE(json_extract(r.fields,'$.result'),json_extract(r.fields,'$.resolution'),json_extract(r.fields,'$.text'),json_extract(r.fields,'$.changed'),e.summary) AS outcome,
 COALESCE(json_extract(e.payload,'$.source.name'),i.name) AS source_name,i.part_number
 ${from} WHERE ${conditions.join(" AND ")} ORDER BY e.created_at DESC,e.id DESC LIMIT ?`,...values,limit+1),statement(db,`SELECT COUNT(*) AS total ${from} WHERE ${countConditions.join(" AND ")}`,...countValues)]);
 const list=result[0].results;
 const selected=list.slice(0,limit).map(decode);return {total:result[1].results[0].total,entries:selected,nextCursor:list.length>limit?cursor(selected.at(-1)):null};
}
export async function eventDetail(db,projectId,id){
 if(!uuid(id))throw new ProjectNotFound("History entry not found.");
 const event=decode(await statement(db,"SELECT * FROM engine_events WHERE project_id=? AND id=?",projectId,id).first());if(!event)throw new ProjectNotFound("History entry not found.");
 const record=event.payload.record_id?decode(await statement(db,"SELECT * FROM engine_records WHERE project_id=? AND id=?",projectId,event.payload.record_id).first()):null;
 const configIds=[record?.configuration_id,event.payload.configuration_id,event.payload.before,event.payload.after].filter(value=>uuid(value));
 const configurations=[];for(const id of new Set(configIds)){const config=decode(await statement(db,"SELECT * FROM engine_configurations WHERE project_id=? AND id=?",projectId,id).first());if(config)configurations.push(config);}
 const attachments=await rows(db,"SELECT f.* FROM engine_file_links l JOIN engine_files f ON f.project_id=l.project_id AND f.id=l.file_id WHERE l.project_id=? AND (l.event_id=? OR l.record_id=? AND l.active=1)",projectId,id,record?.id||"");
 return {event,record,configurations,attachments};
}
