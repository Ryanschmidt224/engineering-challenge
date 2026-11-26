import {node,button,actions,panel,field,checkbox} from "./workshop-ui.js";
import {present,isWebUrl,validateFamilyValues} from "./family-model.js";
import {lookupLabel,lookupValue} from "./workshop-lookup-model.js";
import {dataTable} from "./data-table.js";

export function workshopProductLookup({record,family,fields,showUseFields=false,onApply}){
 const root=panel("Product lookup"),message=node("p","","muted"),results=node("div");message.setAttribute("role","status");
 let hint="",searching=false;
 const search=button("Find with AI",async()=>{
  if(searching)return;
  if(!record.mpn.trim()&&!record.name.trim()){message.textContent="Enter a product name or manufacturer part number first.";return;}
   const stamp=JSON.stringify(record),submittedHint=hint;searching=true;search.disabled=true;results.replaceChildren();message.textContent="Looking up product details…";
  try{
   const response=await fetch("/api/workshop-lookup",{method:"POST",credentials:"same-origin",cache:"no-store",headers:{"content-type":"application/json"},body:JSON.stringify({partNumber:record.mpn,manufacturer:record.manufacturer,partName:record.name||family.name,searchHint:hint})});
   const data=await response.json();if(!root.isConnected)return;
   const cost=Number.isFinite(data.lookupUsage?.estimatedUsd)?" Estimated API cost: $"+data.lookupUsage.estimatedUsd.toFixed(4)+".":"";
   if(!response.ok)throw Error((data.error||"Product lookup failed. Try again.")+cost);
   if(JSON.stringify(record)!==stamp||hint!==submittedHint){message.textContent="Product details changed during lookup. Search again using the current details."+cost;return;}
   if(!data.draft||!Array.isArray(data.research?.specs))throw Error("The lookup did not return usable suggestions. Try again.");
   message.textContent="Review the exact manufacturer, package, ratings and test conditions before applying. Nothing has been saved."+cost;
   review(data,stamp);
  }catch(error){if(root.isConnected)message.textContent=error.message;}
  finally{searching=false;search.disabled=false;}
 });
 root.append(node("p","Find product details using the name, manufacturer and part number above. Suggestions only change this draft when you apply them; Save product stores your changes.","muted"),field("Search hint (optional)","",value=>hint=value,{placeholder:"Manufacturer product page or datasheet link"}),actions(search),message,results);
 function review(data,stamp){
  const proposed=data.draft,identity=[];
  for(const [key,source,label] of [["name","name","Product name"],["manufacturer","manufacturer","Manufacturer"],["mpn","partNumber","Manufacturer part number"]]){
   const value=proposed[source];if(typeof value!=="string"||!value||value===record[key])continue;
   const choice={key,value,selected:!present(record[key])};identity.push(choice);
   const row=node("div");row.append(checkbox(label+": "+value+(present(record[key])?" (replaces “"+record[key]+"”)":""),choice.selected,value=>choice.selected=value));results.append(row);
  }
  if(proposed.caution)results.append(node("p",proposed.caution,"notice"));
  if(data.research.package)results.append(node("p","Package: "+data.research.package));
  const available=fields.filter(f=>!f.hidden&&(!f.filled_on_use||showUseFields)),mappings=[],used=new Set(),table=dataTable("AI specification suggestions",["Suggested specification","Use in field","Current value"]);
  for(const spec of data.research.specs){
   const candidates=available.filter(f=>lookupValue(f,spec)!==undefined),matches=candidates.filter(f=>lookupLabel(f.label)===lookupLabel(spec.name));
   const unique=data.research.specs.filter(row=>lookupLabel(row.name)===lookupLabel(spec.name)).length===1;
   const match=unique&&matches.length===1&&!present(record.field_values[matches[0].id])&&!used.has(matches[0].id)?matches[0]:null;
   if(match)used.add(match.id);
   const mapping={spec,id:match?.id||""},current=node("span"),describe=()=>{const f=available.find(f=>f.id===mapping.id);current.textContent=f?(present(record.field_values[f.id])?String(record.field_values[f.id])+(f.unit?" "+f.unit:""):"Empty"):"—";};
   const picker=field("Destination for "+spec.name,mapping.id,value=>{mapping.id=value;describe();},{options:[{value:"",label:"Do not apply"},...candidates.map(f=>({value:f.id,label:f.label+(f.unit?" ("+f.unit+")":"")}))]});
   const select=picker.querySelector("select");select.setAttribute("aria-label","Destination for "+spec.name);
   const suggestion=node("div");suggestion.append(node("strong",spec.name),node("p",[spec.value,spec.unit].filter(Boolean).join(" ")));
   if(spec.conditions)suggestion.append(node("small","Conditions: "+spec.conditions));
   if(!candidates.length)suggestion.append(node("small","No compatible family field. Add or edit fields in the family, then look up again."));
   table.append([suggestion,select,current]);mappings.push(mapping);describe();
  }
  if(mappings.length)results.append(table.root);
  else results.append(node("p","No structured specifications were returned. Review the research notes below."));
  const urls=[...new Set([...(data.sources||[]),...data.research.specs.map(spec=>spec.sourceUrl),proposed.documentationUrl,proposed.supplierUrl].filter(url=>typeof url==="string"&&isWebUrl(url)))],links=node("ul");
  for(const url of urls){const entry=node("li"),link=node("a",url);link.href=url;link.target="_blank";link.rel="noopener noreferrer";entry.append(link);links.append(entry);}if(urls.length)results.append(links);
  const specText=data.research.specs.map(spec=>spec.name+": "+[spec.value,spec.unit].filter(Boolean).join(" ")+(spec.conditions?" ("+spec.conditions+")":"")).join("\n");
  const research=[proposed.caution,specText||proposed.spec,proposed.use,proposed.notes,...urls].filter(value=>typeof value==="string"&&value).join("\n\n");let keepNotes=!!research;
  if(research){const notes=node("details"),summary=node("summary","Research notes and sources");notes.append(summary,node("p",research,"notes"));results.append(notes,checkbox("Append research notes and sources to product notes",true,value=>keepNotes=value));}
  const apply=button("Apply selected suggestions",()=>{
   if(JSON.stringify(record)!==stamp){message.textContent="Product details changed since lookup. Search again before applying suggestions.";return;}
   const next=structuredClone(record),destinations=new Set();
   for(const mapping of mappings){if(!mapping.id)continue;if(destinations.has(mapping.id)){message.textContent="Choose only one suggestion for each destination field.";return;}destinations.add(mapping.id);const f=available.find(f=>f.id===mapping.id);next.field_values[f.id]=lookupValue(f,mapping.spec);}
   for(const choice of identity)if(choice.selected)next[choice.key]=choice.value;
   if(keepNotes)next.notes=[next.notes,research].filter(Boolean).join("\n\n");
   if(next.notes.length>12000){message.textContent="The combined notes are too long. Uncheck research notes or shorten the existing notes first.";return;}
   try{validateFamilyValues(fields,next.field_values);}catch(error){message.textContent=error.message;return;}
   Object.assign(record,next);onApply();
  },"button--primary");
  results.append(node("p","Numeric fields require identical units. Text fields without a fixed unit retain the source units and test conditions. No units are converted. Selecting a filled field replaces its current value. Unmatched suggestions do not add template fields.","muted"),actions(apply,button("Discard suggestions",()=>{results.replaceChildren();message.textContent="Suggestions discarded. Your draft is unchanged.";})));
 }
 return root;
}
