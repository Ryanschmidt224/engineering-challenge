// Shared read-only context projection. Never infer a missing historical level.
export function recordedPart(item){
 return item&&Number.isSafeInteger(item.revision_level)&&item.revision_level>0?{id:item.id,revision_level:item.revision_level}:null;
}
export function legacyRecordContext(snapshot){
 if(snapshot?.format!==1||!snapshot.occurrence)return null;
 const part=recordedPart(snapshot.item);return {format:1,project:snapshot.occurrence.root||{},occurrence:snapshot.occurrence,legacy:true,...(part?{part}:{})};
}
