// Flexible Workshop specification records, independent of product family.
// Property IDs make future filtering possible; display names and values stay editable.
const clip=(value,max)=>String(value??"").trim().slice(0,max);
export function normalizeSpecifications(raw){
 if(raw===undefined||raw===null)return [];
 if(!Array.isArray(raw)||raw.length>60)return null;
 const normalized=[];
 for(const record of raw){
  if(!record||typeof record!=="object"||Array.isArray(record))return null;
  const label=clip(record.label||record.name,100);
  const value=clip(record.value,220);
  const unit=clip(record.unit,32);
  const conditions=clip(record.conditions,300);
  const inferredId=label.toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"").slice(0,80);
  const propertyId=clip(record.propertyId,80).toLowerCase()||( /^[a-z]/.test(inferredId)?inferredId:"");
  if(propertyId&&!/^[a-z][a-z0-9_]*$/.test(propertyId))return null;
  if(!label&&!value)continue;
  if(!label)return null;
  normalized.push({propertyId,label,value,unit,conditions});
 }
 return normalized;
}
