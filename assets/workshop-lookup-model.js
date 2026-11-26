// Match conservatively: no inferred aliases, unit conversions or stripped limits/ranges.
export const lookupLabel=value=>String(value??"").trim().toLowerCase().replace(/\s+/g," ");
export function lookupValue(field,spec){
 if(field.type==="text"&&!String(field.unit||"").trim()){
  const value=String(spec.value??"").trim();return value?[[value,spec.unit].filter(Boolean).join(" "),spec.conditions].filter(Boolean).join(" · ").slice(0,2000):undefined;
 }
 if(String(field.unit||"").trim()!==String(spec.unit||"").trim())return undefined;
 const value=String(spec.value??"").trim();if(!value)return undefined;
 if(field.type==="number")return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value)&&Number.isFinite(Number(value))?Number(value):undefined;
 if(field.type==="boolean")return /^(true|yes)$/i.test(value)?true:/^(false|no)$/i.test(value)?false:undefined;
 if(field.type==="choice")return field.choices.length?field.choices.find(choice=>lookupLabel(choice)===lookupLabel(value)):value;
 if(field.type==="text")return [value,spec.conditions].filter(Boolean).join(" · ").slice(0,2000);
}
