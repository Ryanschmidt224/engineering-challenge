
const tiles=[
{id:"speed",title:"How fast does a dart need to travel?",category:"Mechanics",short:"Distance depends on launch speed, angle, release height, and air resistance. A theoretical starting point is useful, but real darts experience substantial drag.",deep:"Ignoring air resistance and assuming equal launch and landing height, range R = v² sin(2θ)/g. At 45°, a 50-foot (15.24 m) range suggests about 12.2 m/s. This is only an ideal lower-bound model; foam darts slow dramatically in air. Test actual range and repeatability.",related:["measurement","mechanisms"]},
{id:"mechanisms",title:"What mechanism should launch the dart?",category:"Design",short:"A spring, flywheel pair, air system, or electromagnetic actuator can transfer energy to a dart. Each creates different control, safety, and repeatability challenges.",deep:"Compare available energy, transfer efficiency, speed control, mechanical complexity, noise, and how easily you can measure performance. Start with a sketch and a testable hypothesis before choosing a mechanism.",related:["speed","motors","measurement"]},
{id:"motors",title:"What do an ESC and brushless motor do?",category:"Electronics",short:"A brushless motor needs its windings energized in sequence. An electronic speed controller (ESC) switches power among the motor phases to produce rotation.",deep:"Three motor leads carry controlled phase currents; there is no separate common ground wire for the motor windings. The ESC uses switching devices and a commutation strategy, often with back-EMF feedback, to time the phase drive. ESC signal inputs are separate from motor power.",related:["rpm","voltage","measurement"]},
{id:"rpm",title:"How does RPM relate to wheel speed?",category:"Mechanics",short:"Wheel surface speed increases with wheel diameter and RPM. The dart may travel more slowly because of slip and deformation.",deep:"Tangential surface speed is v = π × diameter × RPM / 60, using diameter in meters and v in meters per second. Two wheels and dart compression introduce additional variables. Measure dart speed rather than treating surface speed as a guaranteed launch velocity.",related:["speed","measurement"]},
{id:"voltage",title:"Why can a coil produce a voltage spike?",category:"Electricity",short:"A coil resists changes in current. When current is interrupted, the changing magnetic field can drive the voltage high enough to keep current flowing through some path.",deep:"The inductor relation is v = L × di/dt with a sign determined by the chosen voltage and current reference directions. A sudden attempt to stop current can produce a large voltage across the switching device. The magnitude is not necessarily twice the supply; it depends on circuit parasitics, switching speed, and available clamp paths. Use proper flyback or transient protection for inductive loads.",related:["power","measurement"]},
{id:"power",title:"Why might a buck converter fail at startup?",category:"Troubleshooting",short:"Possible causes include overvoltage, startup inrush, reverse polarity, inadequate component ratings, layout problems, or a faulty module. The failed part alone does not prove the cause.",deep:"Check the exact module's absolute maximum input rating and current capability. Test the supply and converter without a load, then with a current-limited supply if appropriate. Capture input voltage and current during startup using properly rated isolated or differential measurement equipment. Never assume an observed steady voltage captures brief transients.",related:["voltage","measurement"]},
{id:"measurement",title:"How do I make a test repeatable?",category:"Experiment",short:"Change one variable at a time, keep the test setup consistent, and record actual measurements alongside the conditions that produced them.",deep:"Record dart type, launch angle, wheel geometry, supply voltage, motor speed, test method, and individual distances. Separate direct observations from hypotheses and conclusions. Use appropriate guards, eye protection, and measurement tools.",related:["speed","rpm","power"]},
{id:"threads",title:"What does M4 × 0.7 mean?",category:"Manufacturing",short:"M4 is a nominal 4 mm metric thread diameter. The 0.7 is the thread pitch: 0.7 mm between adjacent thread crests.",deep:"For a standard ISO metric M4 × 0.7 internal thread, a common tapping drill is 3.3 mm, subject to material and thread-engagement requirements. The pitch is not a thread depth or tolerance designation.",related:["measurement"]}
];
const disciplines=["All","Mechanics","Electronics","Controls","Manufacturing","Testing"];let activeDiscipline="All";
const topicDisciplines={speed:["Mechanics","Testing"],mechanisms:["Mechanics"],motors:["Electronics","Controls"],rpm:["Mechanics","Testing"],voltage:["Electronics"],power:["Electronics","Testing"],measurement:["Testing"],threads:["Manufacturing"]};
const topicProjects={speed:[["Foam-dart launcher","launcher"]],mechanisms:[["Foam-dart launcher","launcher"]],motors:[["Foam-dart launcher","launcher"],["Brushless motor","motorlab"]],rpm:[["Foam-dart launcher","launcher"],["Brushless motor","motorlab"]],voltage:[["Linear actuator","linear"],["Switch a coil","coiltest"],["Buck converter","buck"]],power:[["Buck converter","buck"]],measurement:[["Foam-dart launcher","launcher"],["Buck converter","buck"],["Robotic arm","robot"]],threads:[]};
const byId=id=>tiles.find(t=>t.id===id);const safe=s=>String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const store=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){alert("Browser storage is unavailable. Export your notes instead.")}};
const load=k=>{try{return JSON.parse(localStorage.getItem(k))||[]}catch(e){return []}};
let notes=load("bs_notes"),drafts=load("bs_drafts"),feedback=load("bs_feedback"),hintIndex=0,selectionText="";
function navigate(page){const route=page.match(/^([a-z0-9]+)\/(?:assembly|workspace|part|bom)\/([^/]+)$/);if(route)page=route[1];if(page==="challenge"||page==="workshop")page="launcher";if(page==="community")page="learn";if(page==="tools")page="commonparts";if(!document.getElementById(page))page="home";document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===page));document.querySelectorAll("nav button").forEach(b=>b.classList.toggle("active",b.dataset.nav===page));if(!route||location.hash.slice(1)!==route[0])location.hash=page;window.scrollTo({top:0,behavior:"instant"});if(page==="learn")renderTiles()}
document.addEventListener("click",e=>{const nav=e.target.closest("[data-nav]");if(nav){e.preventDefault();navigate(nav.dataset.nav)}const topic=e.target.closest("[data-topic]");if(topic)openTile(topic.dataset.topic);const project=e.target.closest("[data-project]");if(project)navigate(project.dataset.project)});
window.addEventListener("hashchange",()=>{const hash=location.hash.slice(1)||"home";navigate(hash);const match=hash.match(/^([a-z0-9]+)\/(?:assembly|workspace|part|bom)\/([^/]+)$/);if(match){const root=document.querySelector('[data-assembly-tree="'+match[1]+'"]');root?.dispatchEvent(new CustomEvent(hash.includes("/part/")?"openpart":"openassembly",{detail:decodeURIComponent(match[2])}))}});
function renderTiles(){const q=document.getElementById("search").value.toLowerCase().trim();document.getElementById("topicFilters").innerHTML=disciplines.map(d=>'<button class="filter'+(d===activeDiscipline?' selected':'')+'" data-filter="'+d+'" aria-pressed="'+(d===activeDiscipline)+'">'+d+'</button>').join("");const found=tiles.filter(t=>(activeDiscipline==="All"||topicDisciplines[t.id].includes(activeDiscipline))&&(t.title+" "+t.category+" "+t.short+" "+topicDisciplines[t.id].join(" ")).toLowerCase().includes(q));document.getElementById("tileList").innerHTML=found.map(t=>'<article class="card"><div class="project-tags">'+topicDisciplines[t.id].map(d=>'<span>'+d+'</span>').join("")+'</div><h3 style="margin-top:12px">'+safe(t.title)+'</h3><p>'+safe(t.short)+'</p><button class="btn" data-topic="'+t.id+'">Open</button></article>').join("")||'<p>No results.</p>'}
document.getElementById("topicFilters").addEventListener("click",e=>{const b=e.target.closest("[data-filter]");if(b){activeDiscipline=b.dataset.filter;renderTiles()}});
document.getElementById("search").addEventListener("input",renderTiles);
function modal(body){document.getElementById("modalRoot").className="modalback";document.getElementById("modalRoot").innerHTML='<div class="modal" role="dialog" aria-modal="true" aria-label="Knowledge detail"><header><span class="eyebrow">Building Schmidt</span><button class="close" id="closeModal" aria-label="Close">×</button></header>'+body+'</div>';document.getElementById("closeModal").focus()}
function closeModal(){document.getElementById("modalRoot").className="hide";document.getElementById("modalRoot").innerHTML=""}
document.getElementById("modalRoot").addEventListener("click",e=>{if(e.target.id==="modalRoot"||e.target.closest("#closeModal"))closeModal()});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal()});
// Public, read-only lookup for contextual searches from work instructions.
window.BSKnowledgeArticles={
 search(query){
  const q=String(query||"").toLowerCase().trim().replace(/\s+/g," ");
  if(!q||q.length>220)return [];
  const words=q.split(/\s+/).filter(x=>x.length>2);
  return tiles.map(t=>{
   const title=t.title.toLowerCase(),short=t.short.toLowerCase();
   const score=title===q?100:title.includes(q)?80:short.includes(q)?35:
    words.length&&words.every(w=>(title+" "+short).includes(w))?20:0;
   return {id:t.id,title:t.title,summary:t.short,score};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,8);
 },
 open(id){openTile(id)}
};
function openTile(id){const t=byId(id);if(!t)return;const count=feedback.filter(f=>f.id===id&&f.type==="helpful").length;modal('<h2>'+safe(t.title)+'</h2><span class="tag">Explanation</span><p>'+safe(t.short)+'</p><details><summary><strong>Go deeper</strong></summary><p>'+safe(t.deep)+'</p></details><div class="line"></div><h3>Related topics</h3><div class="row">'+t.related.map(x=>'<button class="btn" data-topic="'+x+'">'+safe(byId(x).title)+'</button>').join("")+'</div><div class="line"></div><h3>Used in</h3><div class="row">'+(topicProjects[id].length?topicProjects[id].map(p=>'<button class="btn" data-project="'+p[1]+'">'+safe(p[0])+'</button>').join(""):'<span class="muted">No projects linked yet</span>')+'</div><div class="line"></div><h3>Feedback</h3><p class="small muted">Local feedback · Helpful marks: '+count+'</p><div class="row"><button class="btn" id="helpful" data-id="'+id+'">Helpful</button><button class="btn" id="flagTile" data-id="'+id+'">Suggest correction</button></div><div class="line"></div><h3>Versions</h3><div class="version"><strong>Official starter version</strong><p class="small muted">Current version.</p></div>'+drafts.filter(d=>d.tile===id).map(d=>'<div class="version"><strong>My local draft</strong><p>'+safe(d.text)+'</p></div>').join(""))}
document.getElementById("modalRoot").addEventListener("click",e=>{const t=e.target.closest("[data-topic]");if(t){openTile(t.dataset.topic);return}const p=e.target.closest("[data-project]");if(p){closeModal();navigate(p.dataset.project);return}if(e.target.id==="helpful"){feedback.push({id:e.target.dataset.id,type:"helpful"});store("bs_feedback",feedback);openTile(e.target.dataset.id)}if(e.target.id==="flagTile"){const id=e.target.dataset.id;closeModal();navigate("learn");document.getElementById("topic-contributions").scrollIntoView({behavior:"smooth"});document.getElementById("proposalTitle").value=byId(id).title;document.getElementById("proposalText").focus()}});
const hints=["Start by defining how you will measure a 50-foot launch. What counts as a successful test?","Sketch two possible mechanisms and list what each needs to store or transfer energy.","Identify the variables you can control: geometry, supply, motor speed, launch angle, and dart type.","Build a small, guarded test. Record what actually happens before deciding what to change.","Choose one variable to change, make a prediction, and test whether the measurement supports it."];
document.getElementById("hintBtn").onclick=()=>{document.getElementById("hintBox").classList.remove("hide");document.getElementById("hintBox").textContent=hints[Math.min(hintIndex,hints.length-1)];hintIndex++;if(hintIndex>=hints.length)document.getElementById("hintBtn").disabled=true;document.getElementById("resetHints").classList.remove("hide")};
document.getElementById("resetHints").onclick=()=>{hintIndex=0;document.getElementById("hintBox").classList.add("hide");document.getElementById("hintBtn").disabled=false;document.getElementById("resetHints").classList.add("hide")};
function calc(){const rpm=Number(document.getElementById("rpm").value),mm=Number(document.getElementById("diameter").value);document.getElementById("speedResult").textContent=Number.isFinite(rpm)&&Number.isFinite(mm)&&rpm>=0&&mm>0?(Math.PI*mm/1000*rpm/60).toFixed(1)+" m/s":"Enter valid values"}
["rpm","diameter"].forEach(id=>document.getElementById(id).addEventListener("input",calc));calc();
function validLink(s){try{const u=new URL(s);return ["https:","http:"].includes(u.protocol)?u.href:""}catch(e){return ""}}
function renderNotes(){document.getElementById("notes").innerHTML=notes.length?notes.map((n,i)=>'<div class="topic"><strong>'+safe(n.title)+'</strong><span class="chip">'+safe(n.type)+'</span><p>'+safe(n.observation)+'</p>'+(n.theory?'<p><strong>Next:</strong> '+safe(n.theory)+'</p>':'')+(n.evidence?'<p><a target="_blank" rel="noopener noreferrer" href="'+safe(n.evidence)+'">Evidence link</a></p>':'')+'<button class="btn" data-delete-note="'+i+'">Delete note</button></div>').join(""):'<p class="muted">No notes yet.</p>'}
document.getElementById("logForm").onsubmit=e=>{e.preventDefault();notes.unshift({title:document.getElementById("logTitle").value.trim(),type:document.getElementById("logType").value,observation:document.getElementById("logObservation").value.trim(),theory:document.getElementById("logTheory").value.trim(),evidence:validLink(document.getElementById("logEvidence").value)});store("bs_notes",notes);renderNotes();e.target.reset()};
document.getElementById("notes").onclick=e=>{const b=e.target.closest("[data-delete-note]");if(b&&confirm("Delete this local note?")){notes.splice(Number(b.dataset.deleteNote),1);store("bs_notes",notes);renderNotes()}};
function renderDrafts(){document.getElementById("drafts").innerHTML=drafts.length?drafts.map((d,i)=>'<div class="topic"><strong>'+safe(d.title)+'</strong><p>'+safe(d.text)+'</p>'+(d.source?'<a target="_blank" rel="noopener noreferrer" href="'+safe(d.source)+'">Source</a>':'')+'<p class="small muted">Local draft</p><button class="btn" data-delete-draft="'+i+'">Delete draft</button></div>').join(""):'<p class="muted">No drafts yet.</p>'}
document.getElementById("proposalForm").onsubmit=e=>{e.preventDefault();const title=document.getElementById("proposalTitle").value.trim();const match=tiles.find(t=>t.title.toLowerCase()===title.toLowerCase());drafts.unshift({title,text:document.getElementById("proposalText").value.trim(),source:validLink(document.getElementById("proposalSource").value),tile:match?match.id:null});store("bs_drafts",drafts);renderDrafts();e.target.reset()};
document.getElementById("drafts").onclick=e=>{const b=e.target.closest("[data-delete-draft]");if(b&&confirm("Delete this local draft?")){drafts.splice(Number(b.dataset.deleteDraft),1);store("bs_drafts",drafts);renderDrafts()}};
function exportData(data,name){const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
document.getElementById("exportNotes").onclick=()=>exportData(notes,"building-schmidt-experiments.json");
document.getElementById("exportDrafts").onclick=()=>exportData(drafts,"building-schmidt-drafts.json");

document.addEventListener("selectionchange",()=>{return;const s=String(window.getSelection()).trim();if(s&&s.length<220&&!document.getElementById("modalRoot").classList.contains("modalback")){selectionText=s;document.getElementById("explainSelection").classList.remove("hide")}else if(!s){document.getElementById("explainSelection").classList.add("hide")}});
document.getElementById("explainSelection").onclick=()=>{const selected=selectionText;window.getSelection().removeAllRanges();document.getElementById("explainSelection").classList.add("hide");const found=tiles.find(t=>(t.title+" "+t.short+" "+t.deep).toLowerCase().includes(selected.toLowerCase())&&selected.length>3);if(found){openTile(found.id)}else{modal('<h2>Please explain this</h2><p class="muted">Selected term or phrase:</p><p><strong>'+safe(selected)+'</strong></p><p>No matching tile yet. Add one.</p><button class="btn primary" id="proposeSelected">Add draft</button>');document.getElementById("proposeSelected").onclick=()=>{closeModal();navigate("community");document.getElementById("proposalTitle").value=selected;document.getElementById("proposalText").focus()}}};

// Reuse the site's knowledge tiles for precisely highlighted recipe terms.
window.BSExplainText=(selected,context={})=>{
 const term=String(selected||"").trim().slice(0,220);
 if(!term)return;
 const normalized=term.toLowerCase().replace(/\s+/g," ").trim();
 const aliases={
  "m4×0.7":"threads","m4 x 0.7":"threads","m4 0.7":"threads","thread pitch":"threads",
  "rpm":"rpm","revolutions per minute":"rpm","flywheel speed":"rpm",
  "esc":"motors","brushless motor":"motors","electronic speed controller":"motors",
  "voltage spike":"voltage","inductive spike":"voltage","flyback":"voltage",
  "buck converter":"power","startup inrush":"power","inrush current":"power",
  "measure":"measurement","repeatability":"measurement"
 };
 const alias=aliases[normalized.replace(/\s*×\s*/g,"×")];
 const found=tiles.find(t=>t.id===alias)||
  tiles.find(t=>t.title.toLowerCase()===normalized);
 if(found){openTile(found.id);return}
 const step=String(context.stepTitle||"");
 modal('<h2>Please explain this</h2><p class="muted">Selected from '+safe(step||"the recipe")+':</p><p><strong>'+safe(term)+'</strong></p><p>There is no matching knowledge tile yet.</p><button class="btn primary" id="proposeSelected">Request an explanation</button>');
 document.getElementById("proposeSelected").onclick=()=>{
  closeModal();navigate("community");
  const title=document.getElementById("proposalTitle"),body=document.getElementById("proposalText");
  if(title)title.value=term;
  if(body){body.value="Please explain \""+term+"\" in the context of: "+step+".";body.focus()}
 };
};

let adminAuthenticated=false;
const photoToken=()=>adminAuthenticated?"session":"";
 const isOwnProject=element=>window.BSProjectManager?.isOwner?.(element.closest(".view")?.id)===true;
const adminButton=document.getElementById("adminLoginButton"),adminDialog=document.getElementById("adminDialog"),adminForm=document.getElementById("adminLoginForm"),adminStatus=document.getElementById("adminLoginStatus");
function refreshAdminUI(){adminButton.textContent=adminAuthenticated?"Log out":"Admin login";window.BSResources?.setAdmin?.(adminAuthenticated);document.querySelectorAll(".photo-admin,.component-section").forEach(el=>{el.querySelectorAll(".photo-upload,.component-save").forEach(control=>control.hidden=!(adminAuthenticated||isOwnProject(el)));el.querySelectorAll(".component-extract").forEach(control=>control.hidden=false)});}
async function checkAdmin(){try{const r=await fetch("/api/auth",{cache:"no-store"});adminAuthenticated=!!(await r.json()).authenticated}catch{adminAuthenticated=false}refreshAdminUI()}
adminButton.onclick=async()=>{if(adminAuthenticated){await fetch("/api/auth",{method:"DELETE"});adminAuthenticated=false;refreshAdminUI();location.reload()}else{adminStatus.textContent="";adminDialog.showModal()}};
document.getElementById("adminCancel").onclick=()=>adminDialog.close();
adminForm.onsubmit=async e=>{e.preventDefault();adminStatus.textContent="Checking password…";try{const r=await fetch("/api/auth",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({password:document.getElementById("adminPassword").value})});if(!r.ok){const error=await r.json().catch(()=>({}));adminStatus.textContent=error.error||(r.status===401?"Incorrect password. Please try again.":"Login failed (HTTP "+r.status+").");return}adminAuthenticated=true;document.getElementById("adminPassword").value="";adminDialog.close();refreshAdminUI();location.reload()}catch{adminStatus.textContent="Unable to sign in. Try again."}};
checkAdmin();
function setupPhotos(){document.querySelectorAll("[data-photos]:not([data-photos-ready])").forEach(root=>{root.dataset.photosReady="true";const project=root.dataset.photos,canEditPhoto=()=>adminAuthenticated||window.BSProjectManager?.isOwner?.(project),grid=root.querySelector(".photo-grid"),status=root.querySelector(".photo-status"),fileInput=root.querySelector('input[type="file"]'),caption=root.querySelector(".photo-caption");const zone=root.querySelector(".photo-dropzone"),preview=root.querySelector(".photo-preview"),previewImg=preview.querySelector("img"),filename=root.querySelector(".photo-filename");let selectedFile=null,previewUrl=null;
function selectFile(file){if(!file)return;if(!file.type.startsWith("image/")&&!/\\.(heic|heif)$/i.test(file.name)){say("Choose an image file.");return}if(file.size>10*1024*1024){say("Choose a photo under 10 MB.");return}selectedFile=file;filename.textContent=file.name;preview.classList.remove("hide");if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=URL.createObjectURL(file);previewImg.src=previewUrl;previewImg.onerror=()=>{previewImg.style.display="none"};previewImg.onload=()=>{previewImg.style.display=""};say("Photo selected.");uploadSelected()}
zone.addEventListener("click",e=>{if(e.target!==fileInput)fileInput.click()});zone.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();fileInput.click()}});fileInput.addEventListener("change",()=>selectFile(fileInput.files?.[0]));
let dragDepth=0;zone.addEventListener("dragenter",e=>{e.preventDefault();dragDepth++;zone.classList.add("dragover")});zone.addEventListener("dragover",e=>{e.preventDefault();e.dataTransfer.dropEffect="copy"});zone.addEventListener("dragleave",e=>{e.preventDefault();if(--dragDepth<=0){dragDepth=0;zone.classList.remove("dragover")}});zone.addEventListener("drop",e=>{e.preventDefault();dragDepth=0;zone.classList.remove("dragover");selectFile([...e.dataTransfer.files].find(f=>f.type.startsWith("image/")||/\\.(heic|heif)$/i.test(f.name)))});root.querySelector(".photo-clear").addEventListener("click",()=>{selectedFile=null;fileInput.value="";preview.classList.add("hide");if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=null;say("Selection cleared.")});
const uploadStatus=root.querySelector(".photo-upload-status");const say=s=>{uploadStatus.textContent=s};
async function render(){try{const res=await fetch("/api/photos?project="+encodeURIComponent(project));const data=await res.json();if(!res.ok){status.textContent=data.error||"Photos unavailable.";grid.replaceChildren();return}grid.replaceChildren();for(const p of data.photos){const card=document.createElement("div");card.className="photo-card";const link=document.createElement("a");link.href=p.url;link.target="_blank";link.rel="noopener noreferrer";const img=document.createElement("img");img.src=p.url;img.alt=p.caption||p.name;img.loading="lazy";link.append(img);card.append(link);if(p.caption){const label=document.createElement("p");label.textContent=p.caption;card.append(label)}if(canEditPhoto()){const del=document.createElement("button");del.className="btn photo-delete";del.textContent="Delete";del.addEventListener("click",async()=>{if(!confirm("Delete this photo from the website?"))return;const res=await fetch("/api/photos?id="+encodeURIComponent(p.id),{method:"DELETE",credentials:"same-origin"});const data=await res.json();if(!res.ok){say(data.error||"Delete failed");return}await render()});card.append(del)}grid.append(card)}if(root.closest(".assembly-main-tile")){let active=0;const cards=[...grid.children];const update=()=>cards.forEach((c,i)=>c.hidden=i!==active);update();if(cards.length>1){for(const [dir,mark] of [[-1,"‹"],[1,"›"]]){const arrow=document.createElement("button");arrow.type="button";arrow.className="assembly-main-arrow "+(dir<0?"previous":"next");arrow.textContent=mark;arrow.setAttribute("aria-label",dir<0?"Previous photo":"Next photo");arrow.onclick=()=>{active=(active+dir+cards.length)%cards.length;update()};grid.append(arrow)}}}status.textContent=data.photos.length?data.photos.length+" photo"+(data.photos.length===1?"":"s"):(data.truncated?"More photos available.":"No photos yet.")}catch(e){status.textContent="Photos unavailable. Check the Cloudflare R2 setup."}}
async function uploadSelected(){const file=selectedFile;if(!file){say("Choose a photo first.");return}if(!canEditPhoto()){say("Log in using Admin login at the top of the website.");return}if(file.size>10*1024*1024){say("Choose a photo under 10 MB.");return}zone.setAttribute("aria-busy","true");say("Uploading…");try{const res=await fetch("/api/photos",{method:"POST",headers:{"authorization":"Bearer "+photoToken(),"content-type":file.type||"application/octet-stream","x-photo-project":project,"x-photo-caption":encodeURIComponent(caption.value).slice(0,600),"x-photo-name":encodeURIComponent(file.name).slice(0,300)},body:file});const data=await res.json();if(!res.ok){if(res.status===401){adminAuthenticated=false;refreshAdminUI()}say(res.status===401?"Session expired. Log in again using Admin login.":data.error||"Upload failed.");return}fileInput.value="";selectedFile=null;preview.classList.add("hide");if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=null;caption.value="";await render();say("Photo uploaded.")}catch(e){say("Upload failed. Check your connection and Cloudflare setup.")}finally{zone.removeAttribute("aria-busy")}}
render()})}
setupPhotos();


// Canonical assembly, BOM, part and photo controller is in assets/site-assembly.js.
setupAssemblyTrees();

function setupComponents(){
 document.querySelectorAll("[data-components]:not([data-components-ready])").forEach(root=>{root.dataset.componentsReady="true";
 const project=root.dataset.components,canEditComponent=()=>adminAuthenticated||window.BSProjectManager?.isOwner?.(project),list=root.querySelector(".component-list"),status=root.querySelector(".component-status"),review=root.querySelector(".component-review"),specs=root.querySelector(".component-specs");

 // The old markup nested the part list inside a collapsible <details>.
 // Keep the saved parts in a permanent visible region, independent of the editor.
 if(root.closest("[data-assembly-tree]")||["launcher","linear","robot"].includes(project)){
  root.prepend(list);
  list.classList.add("bom-visible-parts");
 }
 const field=name=>root.querySelector(".component-"+name);
 const priceBasis=field("historical-price-basis"),packageCount=field("historical-package-quantity"),priceField=field("historical-price");
 const recordedDate=field("historical-price-date");
 const todayLocal=()=>new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
 priceField?.addEventListener("input",()=>{if(priceField.value&&!recordedDate?.value&&recordedDate)recordedDate.value=todayLocal()});
 const updatePriceControls=()=>{
  const packaged=priceBasis?.value==="per_package";
  const packageLabel=root.querySelector(".historical-package-count");
  if(packageLabel)packageLabel.hidden=!packaged;
  if(packageCount)packageCount.required=packaged&&!!priceField?.value;
  const hint=root.querySelector(".historical-unit-hint");
  const amount=Number(priceField?.value),count=Number(packageCount?.value);
  if(hint)hint.textContent=packaged&&priceField?.value&&Number.isSafeInteger(count)&&count>0?
   "Equivalent to $"+(amount/count).toFixed(4)+" per part.":"";
 };
 priceBasis?.addEventListener("change",updatePriceControls);
 priceField?.addEventListener("input",updatePriceControls);
 packageCount?.addEventListener("input",updatePriceControls);
 updatePriceControls();
 const say=message=>{status.textContent=message;status.hidden=false;status.style.display="block";status.setAttribute("aria-live","polite");};
 function specRow(name="",value="",source="explicit"){
  const row=document.createElement("div");row.className="row component-spec-row";
  const a=document.createElement("input"),b=document.createElement("input"),c=document.createElement("select"),del=document.createElement("button");
  a.className=b.className="field";a.placeholder="Specification";b.placeholder="Value";a.value=name;b.value=value;
  c.className="field component-spec-source";c.setAttribute("aria-label","Specification source");
  for(const opt of ["explicit","inferred"]){const el=document.createElement("option");el.value=opt;el.textContent=opt==="explicit"?"✓ From product listing":"◇ Estimated / inferred";c.append(el)}c.value=source;
  del.className="btn component-spec-remove";del.type="button";del.textContent="×";del.title="Remove specification";del.setAttribute("aria-label","Remove specification");del.onclick=()=>row.remove();row.append(a,b,c,del);specs.append(row)
 }
 let refreshVersion=0;
 async function refresh(){
  const version=++refreshVersion,selected=assemblySelections[project]??null;
  try{
   const response=await fetch("/api/components?project="+encodeURIComponent(project),{cache:"no-store"});
   const payload=await response.json();
   if(!response.ok)throw Error(payload.error||"HTTP "+response.status);
   if(version!==refreshVersion||selected!==(assemblySelections[project]??null))return;
   const all=Array.isArray(payload.components)?payload.components:[];
   const tree=assemblyTreeSnapshots[project];
   // Traverse the selected assembly and its children, not unrelated branches.
   const orderedIds=[selected];
   const seen=new Set(orderedIds);
   if(tree){
    const walk=parent=>{
     for(const node of tree.nodes.filter(n=>n.parentId===parent)){
      if(seen.has(node.id))continue;
      seen.add(node.id);orderedIds.push(node.id);walk(node.id);
     }
    };
    walk(selected);
   }
   const partGroups=orderedIds.map(id=>({
    id,
    name:id===null?(tree?.title||"Main project"):(tree?.nodes.find(n=>n.id===id)?.name||"Assembly"),
    parts:all.filter(part=>(part.assemblyId??null)===id)
   })).filter(group=>group.parts.length);
   list.replaceChildren();
   if(!partGroups.length){
    const empty=document.createElement("p");empty.className="bom-empty";
    empty.textContent="No parts saved in this assembly"+(tree?" or its subassemblies":"")+". Use + New part to add one.";
    list.append(empty);return;
   }
   const total=partGroups.reduce((sum,g)=>sum+g.parts.length,0);
   const count=document.createElement("p");count.className="bom-count";
   count.textContent=total+" part"+(total===1?"":"s")+" in this assembly"+(tree?" and its subassemblies":"");
   list.append(count);
   for(const group of partGroups){
    const section=document.createElement("section");section.className="bom-origin-group";
    if(tree){
     const heading=document.createElement("h3");heading.className="bom-origin-title";
     heading.textContent=group.name+(group.id===selected?" · This assembly":" · Subassembly");
     section.append(heading);
    }
    const stack=document.createElement("div");stack.className="bom-part-stack";
    for(const c of group.parts){
     const item=document.createElement("details");item.className="bom-part";item.dataset.partId=c.id;
     const summary=document.createElement("summary");summary.className="bom-part-summary";
     summary.title="Click to expand or collapse part details";
     summary.setAttribute("aria-label","Show or hide details for "+c.name);
     const label=document.createElement("span");label.className="bom-part-name";label.textContent=c.name;
     const meta=document.createElement("span");meta.className="bom-part-meta";meta.textContent=(c.quantity===null||c.quantity===undefined?"Qty not specified":"Qty "+c.quantity+(c.quantityUnit?" "+c.quantityUnit:""))+(c.model?" · "+c.model:"");
     const hint=document.createElement("span");hint.className="bom-part-toggle-label";hint.textContent="Details";
     summary.append(label,meta,hint);item.append(summary);
     const body=document.createElement("div");body.className="bom-part-body";
     for(const [fieldName,value] of [["Historical price",c.historicalPrice!==null&&c.historicalPrice!==undefined?"$"+Number(c.historicalPrice).toFixed(2)+" USD per unit"+(c.historicalPriceDate?" (recorded "+c.historicalPriceDate+")":""):null],["Manufacturer",c.manufacturer],["Model",c.model],["Supplier",c.supplier],["ASIN",c.asin],["Category",c.category]]){
      if(!value)continue;
      const line=document.createElement("p"),strong=document.createElement("strong");
      strong.textContent=fieldName+": ";line.append(strong,document.createTextNode(value));body.append(line);
     }
     if(c.specifications?.length){
      const title=document.createElement("strong");title.textContent="Specifications";body.append(title);
      const ul=document.createElement("ul");
      for(const spec of c.specifications){const li=document.createElement("li");li.textContent=spec.name+": "+spec.value+(spec.source==="inferred"?" (inferred)":"");ul.append(li)}
      body.append(ul);
     }
     if(canEditComponent()){
      const del=document.createElement("button");del.type="button";del.className="btn";del.textContent="Delete part";
      del.onclick=async()=>{
       if(!confirm("Delete "+c.name+" from "+group.name+"?"))return;
       del.disabled=true;
       try{
        const res=await fetch("/api/components?project="+encodeURIComponent(project)+"&id="+encodeURIComponent(c.id),{method:"DELETE",credentials:"same-origin"});
        const data=await res.json().catch(()=>({}));
        if(!res.ok)throw Error(data.error||"Delete failed");
        say("Part deleted.");await refresh();
       }catch(error){say(error.message);del.disabled=false}
      };
      body.append(del);
     }
     item.append(body);stack.append(item);
    }
    section.append(stack);list.append(section);
   }
  }catch(error){
   if(version!==refreshVersion)return;
   list.replaceChildren();
   const failure=document.createElement("p");failure.className="bom-error";
   failure.textContent="Unable to load BOM: "+error.message;
   list.append(failure);
  }
 }
 const importPanel=root.querySelector(".component-admin");
 // A fresh part is a fresh draft. Only Save component writes a new BOM record.
 function clearPartEditor(){
  for(const name of ["name","full-name","manufacturer","model","category","supplier","asin"]){const control=field(name);if(control)control.value=""}
  field("description").value="";if(field("quantity"))field("quantity").value="";if(field("historical-price"))field("historical-price").value="";if(field("historical-price-date"))field("historical-price-date").value="";if(priceBasis)priceBasis.value="per_part";if(packageCount)packageCount.value="";updatePriceControls();
  specs.replaceChildren();review.classList.remove("hide");
 }
 root.addEventListener("bom:new-part",()=>{
  clearPartEditor();
  feedback.textContent="";
  say("New part — enter the fields or extract specifications, then click Save part to add it to this BOM.");
  if(importPanel)importPanel.open=true;
 });

 const extract=field("extract"),description=field("description"),addSpec=field("add-spec"),save=field("save");
 if(!extract||!description||!addSpec||!save){say("Component editor is incomplete. Please refresh this page.");return}
 save.textContent="Save part";
 // Put status immediately beside the action and mirror errors above the workspace.
 if(importPanel){
  const cancel=document.createElement("button");cancel.type="button";cancel.className="btn component-cancel";cancel.textContent="Cancel / Collapse";
  cancel.onclick=()=>{importPanel.open=false;review.classList.add("hide");say("");feedback.textContent="";};
  importPanel.append(cancel);
 }
 const feedback=document.createElement("p");feedback.className="component-extraction-feedback";feedback.setAttribute("role","status");feedback.setAttribute("aria-live","assertive");
 extract.after(feedback);
 const extractStatus=message=>{
  // One status location. The old component status and feedback previously
  // repeated the same message in two separate panels.
  feedback.textContent=message;
  status.textContent="";status.hidden=true;status.style.display="none";
 };
 if(importPanel){
  const summary=importPanel.querySelector("summary");if(summary)summary.textContent="Part details";
 }
 // Product lookup is optional; the editable fields are always immediately available.
 review.classList.remove("hide");
 const lookupHint=document.createElement("p");
 lookupHint.className="component-lookup-help small muted";
 lookupHint.textContent="Paste a product link or description, then click Look up product details to suggest manufacturer, model and specifications. Review the suggestions before saving. You can also enter all fields directly.";
 const lookupPanel=document.createElement("section");lookupPanel.className="component-lookup-panel";
 const lookupLabel=description.closest("label");
 if(lookupLabel){lookupLabel.before(lookupPanel);lookupPanel.append(lookupLabel,lookupHint,extract,feedback)}
 description.rows=3;
 extract.textContent="Look up product details";
 extract.hidden=false;extract.type="button";
 extract.onclick=async event=>{
  event.preventDefault();
  extractStatus("");
  const value=description.value.trim();
  if(!value){extractStatus("Paste a product description or public HTTPS product URL first.");return}
  if(!canEditComponent()){extractStatus("Sign in using Admin login, then try extracting.");return}
  extract.disabled=true;
  extractStatus("Looking up product details…");
  try{
   const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
   let response;
   try{response=await fetch("/api/components/extract",{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({description:value}),signal:controller.signal})}finally{clearTimeout(timeout)}
   const raw=await response.text();let data;
   try{data=JSON.parse(raw)}catch{throw Error("The server returned non-JSON data (HTTP "+response.status+"): "+raw.slice(0,120))}
   if(!response.ok)throw Error((data.error||"Extraction request failed")+" (HTTP "+response.status+")");
   const component=data.component;
   if(!component||typeof component!=="object")throw Error("The service returned no product information.");
   for(const name of ["name","manufacturer","model","category","supplier","asin"]){const el=field(name);if(el)el.value=component[name]||""}
   if(field("full-name"))field("full-name").value=component.fullName||component.name||"";
   // A successful product lookup creates a fresh recorded-date reference.
   if(recordedDate)recordedDate.value=todayLocal();
   specs.replaceChildren();for(const spec of component.specifications||[])specRow(spec.name,spec.value,spec.source);
   review.classList.remove("hide");extractStatus("Product details suggested. Review the fields and specifications before saving.");
  }catch(e){review.classList.remove("hide");extractStatus("Product lookup failed: "+(e.name==="AbortError"?"The service did not respond within 20 seconds":e.message)+". You can enter this part manually.")}
  finally{extract.disabled=false}
 };
 field("add-spec").onclick=()=>specRow();
 field("save").onclick=async()=>{
  const priceInput=field("historical-price")?.value.trim()||"";
  const dateInput=field("historical-price-date")?.value||"";
  if(priceInput&&priceBasis?.value==="per_package"&&(!Number.isSafeInteger(Number(packageCount?.value))||Number(packageCount?.value)<1)){
   say("Enter how many parts are in a package.");return;
  }
  const rawQuantity=field("quantity")?.value.trim()??"";
  const quantity=rawQuantity===""?null:Number(rawQuantity);
  if(quantity!==null&&(!Number.isFinite(quantity)||quantity<=0||quantity>10000000)){say("Quantity must be a positive number or left blank.");return}
  const c={assemblyId:assemblySelections[project]??null,quantity,quantityUnit:field("quantity-unit")?.value??"pcs",
   historicalPurchasePrice:priceInput===""?null:Number(priceInput),historicalPriceBasis:priceBasis?.value??"per_part",
   historicalPackageQuantity:priceBasis?.value==="per_package"?(packageCount?.value||null):null,
   historicalPriceDate:priceInput===""?null:(dateInput||new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10))};for(const name of ["name","manufacturer","model","category","supplier","asin"])c[name]=field(name).value.trim();c.fullName=field("full-name")?.value.trim()||c.name;
  c.specifications=[...specs.querySelectorAll(".component-spec-row")].map(row=>({name:row.children[0].value.trim(),value:row.children[1].value.trim(),source:row.children[2].value})).filter(s=>s.name&&s.value);
  if(!c.name){say("Component name is required.");return}
  field("save").disabled=true;try{const res=await fetch("/api/components?project="+project,{method:"POST",headers:{"content-type":"application/json"},credentials:"same-origin",body:JSON.stringify(c)}),data=await res.json();if(!res.ok)throw Error(data.error||"Save failed");review.classList.add("hide");field("description").value="";if(field("quantity"))field("quantity").value="";say("Part added to BOM.");feedback.textContent="";clearPartEditor();if(importPanel)importPanel.open=false;review.classList.add("hide");await refresh()}catch(e){say(e.message)}finally{field("save").disabled=false}
 };
 root.addEventListener("assemblychange",()=>{clearPartEditor();review.classList.add("hide");feedback.textContent="";if(importPanel)importPanel.open=false;refresh()});
 root.addEventListener("bom:refresh",()=>{refresh()});
 refresh();
 })
}
setupComponents();

// First edit replaces existing text instead of appending to a saved value.
// Subsequent clicks allow normal caret placement and partial corrections.
const overwriteSelector=".workspace-main-bom-editor input.field, .workspace-main-bom-editor textarea.field, .recipe-one-step-body input.recipe-input, .recipe-one-step-body textarea.recipe-input";
const overwriteFocus=new WeakMap();
document.addEventListener("focusin",event=>{
 const field=event.target;
 if(!field.matches?.(overwriteSelector)||field.readOnly||field.disabled)return;
 overwriteFocus.set(field,true);
 if(field.type!=="number"&&field.type!=="date"&&typeof field.select==="function")field.select();
});
document.addEventListener("click",event=>{
 const field=event.target;
 if(!field.matches?.(overwriteSelector)||!overwriteFocus.get(field))return;
 if(field.type==="number"||field.type==="date")return;
 if(typeof field.select==="function")field.select();
 overwriteFocus.set(field,false);
});
document.addEventListener("keydown",event=>{
 const field=event.target;
 if(!field.matches?.(overwriteSelector)||field.type!=="number"||!overwriteFocus.get(field))return;
 if(event.ctrlKey||event.metaKey||event.altKey)return;
 if(/^[0-9.+-]$/.test(event.key)){
  field.value="";
  overwriteFocus.set(field,false);
 }
});
document.addEventListener("focusout",event=>{
 if(event.target.matches?.(overwriteSelector))overwriteFocus.delete(event.target);
});


window.BSResources?.init();
renderNotes();renderDrafts();renderTiles();navigate(location.hash.slice(1)||"home");
