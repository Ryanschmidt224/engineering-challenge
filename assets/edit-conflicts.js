/* Compare the record originally loaded by the editor with the version returned on a conflict. */
window.BSEditConflicts = (() => {
 const labels = {model:"Mfg part number", treeDescription:"Feature tree description", partValue:"Value",
  historicalPurchasePrice:"Purchase price", historicalPackageQuantity:"Package quantity", progressStatus:"Status"};
 const label = key => labels[key] || key.replace(/([a-z])([A-Z])/g,"$1 $2").replace(/^./,c=>c.toUpperCase());
 const plain = v => v !== null && typeof v === "object" && !Array.isArray(v);
 const comparable = v => plain(v) ? Object.fromEntries(Object.keys(v).sort().map(k=>[k,comparable(v[k])]))
  : Array.isArray(v) ? v.map(comparable) : String(v??"");
 const equal = (a,b) => JSON.stringify(comparable(a))===JSON.stringify(comparable(b));
 const valueFor = (record,key) => {
  if(key==="treeDescription")return window.BSPartFields.treeDescriptionFor(record);
  if(key==="partValue")return window.BSPartFields.valueFor(record);
  if(key==="historicalPurchasePrice")return record[key]??record.historicalPrice;
  return record[key];
 };
 function compare(original, draft, saved) {
  const rows=[], merged={...draft};
  function visit(target,key,before,mine,theirs,name) {
   if(equal(before,theirs)||equal(mine,theirs))return;
   if(plain(mine)&&plain(theirs)){
    const fields={...theirs,...mine};target[key]=fields;
    for(const field of Object.keys(mine))visit(fields,field,before?.[field],mine[field],theirs[field],label(field));
    return;
   }
   const edited=!equal(mine,before);
   target[key]=theirs;
   rows.push({name,mine,theirs,edited,chooseDraft:()=>{target[key]=mine}});
  }
  for(const key of Object.keys(draft))
   visit(merged,key,valueFor(original,key),draft[key],valueFor(saved,key),label(key));
  return {merged,rows};
 }
 const display = v => v===null||v===undefined||v===""?"(empty)":typeof v==="object"?JSON.stringify(v,null,2):String(v);
 function review(rows) {
  return new Promise(resolve=>{
   const dialog=document.createElement("dialog");dialog.className="bs-dialog bs-edit-conflict";
   const el=(tag,text)=>{const node=document.createElement(tag);node.textContent=text;return node};
   const heading=el("h2","Review newer changes");
   dialog.setAttribute("aria-label",heading.textContent);
   dialog.append(heading,el("p",rows.length?"Someone saved changes while this editor was open. Choose which values to save.":"Another edit was saved. Your changes can be applied to the latest version."));
   const choices=[];
   for(const row of rows){
    const section=document.createElement("fieldset");
    section.append(el("legend",row.name),el("p","Saved version"),el("pre",display(row.theirs)));
    if(row.edited){
     section.append(el("p","Your draft"),el("pre",display(row.mine)));
     const choice=el("label"," Use my draft for this field");
     const check=document.createElement("input");check.type="checkbox";choice.prepend(check);
     choices.push([check,row]);section.append(choice);
    }
    dialog.append(section);
   }
   const actions=document.createElement("div");actions.className="bs-dialog-actions";
   const cancel=el("button","Keep editing"),save=el("button","Save reviewed changes");
   cancel.type=save.type="button";cancel.className="btn";save.className="btn primary";
   actions.append(cancel,save);dialog.append(actions);document.body.append(dialog);
   cancel.onclick=()=>dialog.close();
   save.onclick=()=>{for(const [check,row] of choices)if(check.checked)row.chooseDraft();dialog.close("save")};
   dialog.addEventListener("close",()=>{dialog.remove();resolve(dialog.returnValue==="save")},{once:true});
   dialog.showModal();cancel.focus();
  });
 }
 async function save(url,{method="PATCH",original,changes,extra={},revision=original.revision??null,active=()=>true}){
  for(;;){
   const response=await fetch(url,{method,credentials:"same-origin",headers:{"content-type":"application/json"},
    body:JSON.stringify({...extra,...changes,expectedRevision:revision})});
   const data=await response.json();
   if(response.ok)return data;
   if(response.status!==409||!data.current)throw Error(data.error||"Unable to save changes");
   const {merged,rows}=compare(original,changes,data.current);
   if(!active()||!await review(rows)||!active())throw Error("Your draft is still in the editor. Save again to review the latest version.");
   original=data.current;changes=merged;revision=data.revision??null;
  }
 }
 return Object.freeze({save,compare});
})();
