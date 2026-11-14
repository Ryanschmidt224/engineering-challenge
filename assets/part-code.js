/* Versioned source-code workspace for Code items.
 * Source is inert text: never eval, import, or run uploaded code.
 */
(function(){
 "use strict";
 const node=(tag,className,text)=>{const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n};
 const languages=[["text","Plain text"],["python","Python"],["javascript","JavaScript"],["typescript","TypeScript"],["c","C"],["cpp","C++"],["arduino","Arduino"],["html","HTML"],["css","CSS"],["json","JSON"],["bash","Bash"],["sql","SQL"],["yaml","YAML"],["rust","Rust"]];
 const extensions={text:".txt",python:".py",javascript:".js",typescript:".ts",c:".c",cpp:".cpp",arduino:".ino",html:".html",css:".css",json:".json",bash:".sh",sql:".sql",yaml:".yaml",rust:".rs"};
 const url=(project,id)=>"/api/part-code?project="+encodeURIComponent(project)+"&id="+encodeURIComponent(id);
 function mount(target,{project,canEdit}){
  const section=node("section","bs-part-code hide");
  const head=node("div","bs-code-heading"),title=node("h2","","Source code"),tools=node("div","bs-code-head-actions");
  const edit=node("button","btn","Edit"),download=node("button","btn","Download");
  edit.type=download.type="button";
  tools.append(download,edit);head.append(title,tools);
  const description=node("p","muted bs-code-description","Source is stored as text and is never executed by this website.");
  const metadata=node("div","bs-code-metadata");
  const fileLabel=node("label","","Filename"),filename=node("input","field");
  filename.maxLength=120;filename.placeholder="e.g. main.py";fileLabel.append(filename);
  const languageLabel=node("label","","Language"),language=node("select","field");
  for(const [value,label] of languages){const option=node("option","",label);option.value=value;language.append(option)}
  languageLabel.append(language);metadata.append(fileLabel,languageLabel);
  const viewer=node("pre","bs-code-viewer"),editor=node("textarea","bs-code-editor");
  editor.spellcheck=false;editor.wrap="off";editor.setAttribute("aria-label","Source code");editor.placeholder="// Start writing code…";
  const status=node("p","small muted bs-code-status");status.setAttribute("role","status");
  const actions=node("div","bs-code-actions"),save=node("button","btn primary","Save code"),cancel=node("button","btn","Cancel");
  save.type=cancel.type="button";actions.append(save,cancel);
  const history=node("details","bs-code-history"),summary=node("summary","","Previous versions"),historyList=node("div","bs-code-history-list");
  history.append(summary,historyList);
  section.append(head,description,metadata,viewer,editor,actions,status,history);target.append(section);
  let partId=null,partName="",documentData=null,editing=false,dirty=false,loading=false;
  const setStatus=message=>{status.textContent=message||""};
  function configureEdit(value){
   editing=!!value;editor.hidden=!editing;viewer.hidden=editing;actions.hidden=!editing;
   metadata.hidden=!editing;edit.textContent=editing?"Editing…":"Edit";edit.disabled=!canEdit()||editing;
  }
  const safeFilename=()=>{const ext=extensions[language.value]||".txt";let name=filename.value.trim().replace(/[^a-zA-Z0-9_. -]/g,"_");if(!name)name=(partName||"code").replace(/[^a-zA-Z0-9_. -]/g,"_").slice(0,70)+ext;return name};
  function showHistory(){
   historyList.replaceChildren();
   const versions=[...(documentData?.revisions||[])].reverse();
   history.hidden=!versions.length;
   for(const v of versions){
    const row=node("div","bs-code-history-row");
    row.append(node("span","",new Date(v.savedAt).toLocaleString()+" · "+(v.filename||v.language||"Code")));
    const open=node("button","btn","View");open.type="button";
    open.onclick=async()=>{
     if(dirty&&!confirm("Discard unsaved changes before viewing an older version?"))return;
     try{
      const res=await fetch(url(project,partId)+"&revision="+encodeURIComponent(v.revision),{credentials:"same-origin",cache:"no-store"});
      const data=await res.json();if(!res.ok)throw Error(data.error||"Revision unavailable");
      const version=data.version||{};configureEdit(false);viewer.textContent=version.source||"";
      filename.value=version.filename||"";language.value=version.language||"text";download.dataset.version="old";download.dataset.filename=version.filename||"";download.dataset.source=version.source||"";
      setStatus("Viewing an earlier version (read-only). Click Edit to load the latest version before changing code.");
     }catch(error){setStatus(error.message)}
    };
    row.append(open);historyList.append(row);
   }
  }
  function showCurrent(){
   editor.value=documentData?.source||"";
   viewer.textContent=editor.value||"No code saved yet.";
   filename.value=documentData?.filename||"";
   language.value=documentData?.language||"text";
   download.dataset.version="current";
   download.dataset.source="";download.dataset.filename="";
   dirty=false;configureEdit(false);showHistory();
  }
  async function load(id,name){
   partId=id;partName=name||"Code";loading=true;
   section.classList.remove("hide");configureEdit(false);setStatus("Loading code…");
   const requested=id;
   try{
    const res=await fetch(url(project,id),{credentials:"same-origin",cache:"no-store"}),data=await res.json();
    if(!res.ok)throw Error(data.error||"Could not load source code");
    if(requested!==partId)return;
    documentData=data.document||{source:"",language:"text",filename:"",revision:null,revisions:[]};showCurrent();setStatus("");
   }catch(error){if(requested===partId)setStatus(error.message)}
   finally{loading=false}
  }
  edit.onclick=()=>{
   if(!partId||!documentData||loading||!canEdit())return;
   showCurrent();configureEdit(true);editor.focus();setStatus("Use Tab to indent. Save creates a new revision; older versions are preserved.");
  };
  cancel.onclick=()=>{showCurrent();setStatus("Changes discarded.")};
  const markDirty=()=>{dirty=true};
  editor.addEventListener("input",markDirty);filename.addEventListener("input",markDirty);language.addEventListener("change",markDirty);
  editor.addEventListener("keydown",event=>{
   if(event.key!=="Tab")return;
   event.preventDefault();const a=editor.selectionStart,b=editor.selectionEnd;
   editor.setRangeText("  ",a,b,"end");dirty=true;
  });
  save.onclick=async()=>{
   if(!partId||!canEdit()||!documentData||!editing)return;
   const name=safeFilename();
   const source=editor.value;
   if(source.length>100000){setStatus("Maximum source length is 100,000 characters.");return}
   save.disabled=true;setStatus("Saving code…");
   try{
    const response=await fetch(url(project,partId),{method:"PUT",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({source,language:language.value,filename:name,expectedRevision:documentData.revision||null})});
    const data=await response.json();if(!response.ok)throw Error(data.error||"Could not save source");
    documentData={...documentData,source,language:language.value,filename:name,revision:data.revision||documentData.revision,
     revisions:data.unchanged?documentData.revisions:[...(documentData.revisions||[]),{revision:data.revision,savedAt:data.savedAt,filename:name,language:language.value}]};
    showCurrent();setStatus(data.unchanged?"No changes to save.":"Saved. Earlier versions are preserved.");
   }catch(error){setStatus(error.message)}
   finally{save.disabled=false}
  };
  download.onclick=()=>{
   if(!documentData)return;
   const old=download.dataset.version==="old";
   const bytes=old?download.dataset.source:documentData.source;
   const name=old?download.dataset.filename:safeFilename();
   const blob=new Blob([bytes],{type:"text/plain;charset=utf-8"});
   const object=URL.createObjectURL(blob),link=node("a");link.href=object;link.download=name;link.click();
   setTimeout(()=>URL.revokeObjectURL(object),1000);
  };
  return {load,setVisible(value){section.classList.toggle("hide",!value);if(!value){partId=null;dirty=false}}};
 }
 window.BSPartCode=Object.freeze({mount});
})();
