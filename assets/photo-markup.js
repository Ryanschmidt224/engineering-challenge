/* Shared photo markup editor. Original image and annotations remain editable.
 * No page-specific upload logic lives here.
 */
(function(){
 "use strict";
 const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e};
 const url=(kind,id,project,view=false)=>"/api/photo-annotations?kind="+encodeURIComponent(kind)+"&id="+encodeURIComponent(id)+(project?"&project="+encodeURIComponent(project):"")+(view?"&view=1":"");
 const source=(kind,id,project)=>kind==="gallery"?"/api/photo?id="+encodeURIComponent(id):kind==="recipe"?"/api/recipe-files?id="+encodeURIComponent(id):"/api/components/photo?project="+encodeURIComponent(project)+"&id="+encodeURIComponent(id);
 const snapshot=s=>JSON.parse(JSON.stringify(s));
 const clamp=x=>Math.max(0,Math.min(1,x));
 const button=(label,action)=>{const b=el("button","btn",label);b.type="button";b.onclick=action;return b};
 function open({kind,id,project,onSave}){
  if(!["gallery","recipe","part"].includes(kind)||!id)return;
  const dialog=el("dialog","bs-markup-modal");dialog.setAttribute("aria-label","Edit photo");
  const header=el("div","bs-markup-header");
  const title=el("strong","", "Edit photo");
  const close=button("Close",()=>{finishText();void persist(true)});header.append(title,close);
  const toolbar=el("div","bs-markup-toolbar"),frame=el("div","bs-markup-canvas-wrap");
  const canvas=el("canvas","bs-markup-canvas");
  const status=el("p","small muted","Loading photo…");status.setAttribute("role","status");
  const footer=el("div","bs-markup-footer");
  const save=button("Save & close",()=>{finishText();void persist(true)});save.classList.add("primary");
  const undo=button("Undo",()=>{finishText();stepBack()});
  const redo=button("Redo",()=>{finishText();stepForward()});
  const reset=button("Reset edits",()=>{if(confirm("Clear all crops and annotations?")){finishText(false);commit({crop:null,marks:[]})}});
  footer.append(undo,redo,reset,save);
  frame.append(canvas);dialog.append(header,toolbar,frame,status,footer);document.body.append(dialog);dialog.showModal();
  dialog.addEventListener("close",()=>{finishText(false);dialog.remove()});
  let image=null,state={crop:null,marks:[]},history=[],future=[],tool="pen",drag=null,strokeColor="#e63838",textEditor=null;
  let generation=0,savedGeneration=0,saveTimer=null,saveInFlight=null;
  const scheduleSave=()=>{generation++;clearTimeout(saveTimer);saveTimer=setTimeout(()=>void persist(false),950);status.textContent="Unsaved changes…"};
  dialog.addEventListener("cancel",e=>{if(textEditor)finishText();if(generation!==savedGeneration){e.preventDefault();void persist(true)}});
  const color=el("input");color.type="color";color.value=strokeColor;color.setAttribute("aria-label","Annotation color");
  color.onchange=()=>strokeColor=color.value;
  for(const [key,label] of [["pen","Pen"],["highlight","Highlight"],["arrow","Arrow"],["circle","Circle"],["text","Text"],["crop","Crop"]]){
   const choice=button(label,()=>{finishText();tool=key;activate()});choice.dataset.tool=key;toolbar.append(choice);
  }
  toolbar.append(color);activate();
  function activate(){for(const b of toolbar.querySelectorAll("[data-tool]"))b.setAttribute("aria-pressed",String(b.dataset.tool===tool))}
  function commit(next){history.push(snapshot(state));future=[];state=snapshot(next);draw();sync();scheduleSave()}
  function stepBack(){if(!history.length)return;future.push(snapshot(state));state=history.pop();draw();sync();scheduleSave()}
  function stepForward(){if(!future.length)return;history.push(snapshot(state));state=future.pop();draw();sync();scheduleSave()}
  function sync(){undo.disabled=!history.length;redo.disabled=!future.length}
  // Type on the photo itself, not in a browser prompt. Keep the original image untouched.
  function finishText(apply=true){
   const active=textEditor;
   if(!active)return;
   textEditor=null;
   const value=active.input.value.slice(0,120);
   active.input.remove();
   if(apply&&value.trim()){
    commit({...state,marks:[...state.marks,{
     tool:"text",a:active.anchor,color:active.color,size:active.size,
     top:true,wrapW:active.wrapW,text:value
    }]});
   }
  }
  function beginText(a,event){
   finishText();
   const imageRect=canvas.getBoundingClientRect(),frameRect=frame.getBoundingClientRect();
   const width=Math.max(80,Math.min(280,imageRect.width-12));
   const left=Math.max(0,Math.min(event.clientX-imageRect.left,imageRect.width-width-4));
   const top=Math.max(0,Math.min(event.clientY-imageRect.top,imageRect.height-36));
   const input=el("textarea","bs-markup-inline-text");
   input.rows=1;input.maxLength=120;input.spellcheck=false;
   input.placeholder="Type here…";input.setAttribute("aria-label","Text on photo");
   const fontPixels=18;
   const scale=imageRect.width/canvas.width;
   const size=(fontPixels/scale)/(Math.min(canvas.width,canvas.height)*6);
   input.style.left=(imageRect.left-frameRect.left+frame.scrollLeft+left)+"px";
   input.style.top=(imageRect.top-frameRect.top+frame.scrollTop+top)+"px";
   input.style.width=width+"px";
   input.style.color=strokeColor;
   const anchor=[left/imageRect.width,top/imageRect.height];
   textEditor={input,anchor,color:strokeColor,size,wrapW:width/imageRect.width};
   input.addEventListener("input",()=>{
    input.style.height="auto";
    input.style.height=Math.min(170,Math.max(34,input.scrollHeight))+"px";
   });
   input.addEventListener("keydown",e=>{
    if(e.key==="Escape"){e.preventDefault();e.stopPropagation();finishText(false)}
    else if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();finishText()}
   });
   input.addEventListener("blur",()=>finishText());
   frame.append(input);input.focus();
  }
  function xy(e){const rect=canvas.getBoundingClientRect();return [clamp((e.clientX-rect.left)/rect.width),clamp((e.clientY-rect.top)/rect.height)]}
  function render(target,s,scale=1){
   const w=target.canvas.width,h=target.canvas.height;
   target.drawImage(image,0,0,w,h);
   target.lineJoin="round";target.lineCap="round";
   for(const m of s.marks){
    const p=([x,y])=>[x*w,y*h];
    const width=Math.max(1,m.size*Math.min(w,h));
    target.strokeStyle=m.color;target.fillStyle=m.color;target.lineWidth=width;
    target.globalAlpha=m.tool==="highlight"?.35:1;
    if(m.tool==="pen"||m.tool==="highlight"){
     if(!m.points.length)continue;
     target.beginPath();const [x,y]=p(m.points[0]);target.moveTo(x,y);
     for(const point of m.points.slice(1)){const [cx,cy]=p(point);target.lineTo(cx,cy)}
     if(m.points.length===1)target.lineTo(x+.01,y+.01);
     target.stroke();
    }else if(m.tool==="text"){
     const [x,y]=p(m.a);
     const fontPx=Math.max(12,m.size*Math.min(w,h)*6);
     target.font="bold "+fontPx+"px sans-serif";
     target.textBaseline=m.top?"top":"alphabetic";
     const maxWidth=m.wrapW?m.wrapW*w:Infinity;
     let lineNumber=0;
     for(const paragraph of m.text.split("\\n")){
      let line="";
      for(const word of paragraph.split(/(\\s+)/)){
       if(line&&target.measureText(line+word).width>maxWidth){
        target.fillText(line,x,y+lineNumber*fontPx*1.25);
        lineNumber++;line=word.trimStart();
       }else line+=word;
      }
      target.fillText(line,x,y+lineNumber*fontPx*1.25);
      lineNumber++;
     }
     target.textBaseline="alphabetic";
    }else{
     const [x,y]=p(m.a),[x2,y2]=p(m.b);
     target.beginPath();
     if(m.tool==="circle")target.ellipse((x+x2)/2,(y+y2)/2,Math.max(1,Math.abs(x2-x)/2),Math.max(1,Math.abs(y2-y)/2),0,0,2*Math.PI);
     else{target.moveTo(x,y);target.lineTo(x2,y2)}
     target.stroke();
     if(m.tool==="arrow"){
      const angle=Math.atan2(y2-y,x2-x),length=Math.max(10,width*5);
      target.beginPath();target.moveTo(x2,y2);
      target.lineTo(x2-length*Math.cos(angle-.5),y2-length*Math.sin(angle-.5));
      target.moveTo(x2,y2);target.lineTo(x2-length*Math.cos(angle+.5),y2-length*Math.sin(angle+.5));target.stroke();
     }
    }
   }
   target.globalAlpha=1;
  }
  function draw(){
   if(!image)return;
   const ctx=canvas.getContext("2d");ctx.clearRect(0,0,canvas.width,canvas.height);
   render(ctx,state);
   if(state.crop){
    const [x,y,w,h]=state.crop;
    ctx.save();ctx.strokeStyle="#ffffff";ctx.lineWidth=3;ctx.setLineDash([10,5]);
    ctx.strokeRect(x*canvas.width,y*canvas.height,w*canvas.width,h*canvas.height);
    ctx.restore();
   }
  }
  canvas.addEventListener("pointerdown",e=>{
   if(!image||e.button!==0)return;
   e.preventDefault();
   const a=xy(e);
   if(tool==="text"){beginText(a,e);return}
   canvas.setPointerCapture(e.pointerId);
   drag={a,original:snapshot(state)};
   if(tool==="pen"||tool==="highlight"){
    drag.mark={tool,points:[a],color:tool==="highlight"?"#fff000":strokeColor,size:tool==="highlight"?.025:.004};
   }
  });
  canvas.addEventListener("pointermove",e=>{
   if(!drag||!image)return;
   const b=xy(e);const next=snapshot(drag.original);
   if(tool==="crop"){
    const x=Math.min(drag.a[0],b[0]),y=Math.min(drag.a[1],b[1]);
    next.crop=[x,y,Math.max(.001,Math.abs(b[0]-drag.a[0])),Math.max(.001,Math.abs(b[1]-drag.a[1]))];
   }else if(drag.mark){
    if(drag.mark.points.length<1200)drag.mark.points.push(b);
    next.marks.push(snapshot(drag.mark));
   }else next.marks.push({tool,a:drag.a,b,color:strokeColor,size:.004});
   state=next;draw();
  });
  canvas.addEventListener("pointerup",e=>{
   if(!drag)return;
   const b=xy(e),start=drag.original;
   let next=snapshot(start);
   if(tool==="crop"){
    const x=Math.min(drag.a[0],b[0]),y=Math.min(drag.a[1],b[1]);
    const w=Math.abs(b[0]-drag.a[0]),h=Math.abs(b[1]-drag.a[1]);
    if(w>.01&&h>.01)next.crop=[x,y,w,h];
   }else if(drag.mark){
    drag.mark.points.push(b);next.marks.push(drag.mark);
   }else next.marks.push({tool,a:drag.a,b,color:strokeColor,size:.004});
   drag=null;state=start;commit(next);
  });
  canvas.addEventListener("pointercancel",()=>{if(drag){state=drag.original;drag=null;draw()}});
  async function load(){
   try{
    const [response,img]=await Promise.all([
     fetch(url(kind,id,project),{credentials:"same-origin"}),
     new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error("Photo cannot be opened. HEIC may require conversion to JPG."));i.src=source(kind,id,project)})
    ]);
    if(!response.ok)throw Error("Could not load photo edits");
    const data=await response.json();
    image=img;state=data.state||{crop:null,marks:[]};
    const max=1800,ratio=Math.min(1,max/Math.max(image.naturalWidth,image.naturalHeight));
    canvas.width=Math.round(image.naturalWidth*ratio);canvas.height=Math.round(image.naturalHeight*ratio);
    history=[];future=[];draw();sync();status.textContent="Drag on the image to annotate. Crop selects the visible area. Original photo is preserved.";
   }catch(e){status.textContent=e.message;save.disabled=true}
  }
  async function persist(closeAfter=false){
   clearTimeout(saveTimer);
   if(!image){if(closeAfter)dialog.close();return}
   if(saveInFlight){
    try{await saveInFlight}catch{/* The next save may succeed. */}
   }
   if(generation===savedGeneration){if(closeAfter)dialog.close();return}
   const version=generation,working=snapshot(state);
   const task=(async()=>{
    const c=working.crop||[0,0,1,1],w=Math.max(1,Math.round(canvas.width*c[2])),h=Math.max(1,Math.round(canvas.height*c[3]));
    const composed=document.createElement("canvas");composed.width=canvas.width;composed.height=canvas.height;
    render(composed.getContext("2d"),working);
    const output=document.createElement("canvas");output.width=w;output.height=h;
    output.getContext("2d").drawImage(composed,c[0]*canvas.width,c[1]*canvas.height,w,h,0,0,w,h);
    const blob=await new Promise(resolve=>output.toBlob(resolve,"image/webp",.88));
    if(!blob)throw Error("Could not render photo");
    const form=new FormData();form.append("image",blob,"edited.webp");form.append("state",JSON.stringify(working));
    const res=await fetch(url(kind,id,project),{method:"PUT",credentials:"same-origin",body:form});
    const data=await res.json().catch(()=>({}));if(!res.ok)throw Error(data.error||"Save failed");
    savedGeneration=version;onSave?.();
   })();
   saveInFlight=task;status.textContent="Saving changes…";
   try{
    await task;
    status.textContent="Saved automatically.";
   }catch(e){status.textContent="Save failed: "+e.message;return}
   finally{if(saveInFlight===task)saveInFlight=null}
   if(generation!==savedGeneration){
    if(closeAfter)await persist(true);
    else saveTimer=setTimeout(()=>void persist(false),950);
   }else if(closeAfter)dialog.close();
  }

  void load();
 }
 function pasteOn(root,handler){
  root.addEventListener("paste",e=>{
   const file=[...(e.clipboardData?.files||[])].find(f=>f.type.startsWith("image/"));
   if(!file)return;
   // Never intercept a text-only paste or a paste into an unrelated editor.
   e.preventDefault();void handler(new File([file],"pasted-photo."+(file.type==="image/webp"?"webp":file.type==="image/jpeg"?"jpg":"png"),{type:file.type||"image/png"}));
  });
 }
 // Every visible photo target intercepts image drops even when editing is locked.
 // Otherwise the browser navigates away to display the local image.
 function dropOn(root,onFile,{canUpload=()=>true,onBlocked=()=>{}}={}){
  if(!root)return;
  const incoming=event=>Array.from(event.dataTransfer?.types||[]).some(type=>["Files","text/uri-list","text/html"].includes(type));
  root.addEventListener("dragover",event=>{
   if(!incoming(event))return;
   event.preventDefault();event.stopPropagation();
   event.dataTransfer.dropEffect=canUpload()?"copy":"none";
   root.classList.add("is-dragover");
  });
  root.addEventListener("dragleave",event=>{
   if(!root.contains(event.relatedTarget))root.classList.remove("is-dragover");
  });
  root.addEventListener("drop",event=>{
   if(!incoming(event)&&!event.dataTransfer?.files?.length)return;
   event.preventDefault();event.stopPropagation();root.classList.remove("is-dragover");
   if(!canUpload()){onBlocked();return}
   const files=Array.from(event.dataTransfer?.files||[]);
   if(!files.length){
    onBlocked("This is a link, not an image file. For Google Photos, use Windows + Shift + S then Ctrl + V, or select a downloaded image.");
    return;
   }
   const image=files.find(file=>file.type.startsWith("image/")||/\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name||""));
   if(!image){onBlocked("Please drop an image file.");return}
   void onFile(image);
  });
 }
 window.BSPhotoMarkup=Object.freeze({open,pasteOn,dropOn,displayUrl:(kind,id,project)=>url(kind,id,project,true)});
})();
