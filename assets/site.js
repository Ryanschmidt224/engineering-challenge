
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
function navigate(page){const route=page.match(/^([a-z]+)\/(?:assembly|workspace|part)\/([^/]+)$/);if(route)page=route[1];if(page==="challenge"||page==="workshop")page="launcher";if(page==="community")page="learn";if(page==="tools")page="commonparts";if(!document.getElementById(page))page="home";document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===page));document.querySelectorAll("nav button").forEach(b=>b.classList.toggle("active",b.dataset.nav===page));if(!route||location.hash.slice(1)!==route[0])location.hash=page;window.scrollTo({top:0,behavior:"instant"});if(page==="learn")renderTiles()}
document.addEventListener("click",e=>{const nav=e.target.closest("[data-nav]");if(nav){e.preventDefault();navigate(nav.dataset.nav)}const topic=e.target.closest("[data-topic]");if(topic)openTile(topic.dataset.topic);const project=e.target.closest("[data-project]");if(project)navigate(project.dataset.project)});
window.addEventListener("hashchange",()=>{const hash=location.hash.slice(1)||"home";navigate(hash);const match=hash.match(/^([a-z]+)\/(?:assembly|workspace|part)\/([^/]+)$/);if(match){const root=document.querySelector('[data-assembly-tree="'+match[1]+'"]');root?.dispatchEvent(new CustomEvent(hash.includes("/part/")?"openpart":"openassembly",{detail:decodeURIComponent(match[2])}))}});
function renderTiles(){const q=document.getElementById("search").value.toLowerCase().trim();document.getElementById("topicFilters").innerHTML=disciplines.map(d=>'<button class="filter'+(d===activeDiscipline?' selected':'')+'" data-filter="'+d+'" aria-pressed="'+(d===activeDiscipline)+'">'+d+'</button>').join("");const found=tiles.filter(t=>(activeDiscipline==="All"||topicDisciplines[t.id].includes(activeDiscipline))&&(t.title+" "+t.category+" "+t.short+" "+topicDisciplines[t.id].join(" ")).toLowerCase().includes(q));document.getElementById("tileList").innerHTML=found.map(t=>'<article class="card"><div class="project-tags">'+topicDisciplines[t.id].map(d=>'<span>'+d+'</span>').join("")+'</div><h3 style="margin-top:12px">'+safe(t.title)+'</h3><p>'+safe(t.short)+'</p><button class="btn" data-topic="'+t.id+'">Open</button></article>').join("")||'<p>No results.</p>'}
document.getElementById("topicFilters").addEventListener("click",e=>{const b=e.target.closest("[data-filter]");if(b){activeDiscipline=b.dataset.filter;renderTiles()}});
document.getElementById("search").addEventListener("input",renderTiles);
function modal(body){document.getElementById("modalRoot").className="modalback";document.getElementById("modalRoot").innerHTML='<div class="modal" role="dialog" aria-modal="true" aria-label="Knowledge detail"><header><span class="eyebrow">Building Schmidt</span><button class="close" id="closeModal" aria-label="Close">×</button></header>'+body+'</div>';document.getElementById("closeModal").focus()}
function closeModal(){document.getElementById("modalRoot").className="hide";document.getElementById("modalRoot").innerHTML=""}
document.getElementById("modalRoot").addEventListener("click",e=>{if(e.target.id==="modalRoot"||e.target.closest("#closeModal"))closeModal()});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal()});
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
const adminButton=document.getElementById("adminLoginButton"),adminDialog=document.getElementById("adminDialog"),adminForm=document.getElementById("adminLoginForm"),adminStatus=document.getElementById("adminLoginStatus");
function refreshAdminUI(){adminButton.textContent=adminAuthenticated?"Log out":"Admin login";window.BSResources?.setAdmin?.(adminAuthenticated);document.querySelectorAll(".photo-admin,.component-section").forEach(el=>{el.querySelectorAll(".photo-upload,.component-save").forEach(control=>control.hidden=!adminAuthenticated);el.querySelectorAll(".component-extract").forEach(control=>control.hidden=false)});}
async function checkAdmin(){try{const r=await fetch("/api/auth",{cache:"no-store"});adminAuthenticated=!!(await r.json()).authenticated}catch{adminAuthenticated=false}refreshAdminUI()}
adminButton.onclick=async()=>{if(adminAuthenticated){await fetch("/api/auth",{method:"DELETE"});adminAuthenticated=false;refreshAdminUI();location.reload()}else{adminStatus.textContent="";adminDialog.showModal()}};
document.getElementById("adminCancel").onclick=()=>adminDialog.close();
adminForm.onsubmit=async e=>{e.preventDefault();adminStatus.textContent="Checking password…";try{const r=await fetch("/api/auth",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({password:document.getElementById("adminPassword").value})});if(!r.ok){const error=await r.json().catch(()=>({}));adminStatus.textContent=error.error||(r.status===401?"Incorrect password. Please try again.":"Login failed (HTTP "+r.status+").");return}adminAuthenticated=true;document.getElementById("adminPassword").value="";adminDialog.close();refreshAdminUI();location.reload()}catch{adminStatus.textContent="Unable to sign in. Try again."}};
checkAdmin();
function setupPhotos(){document.querySelectorAll("[data-photos]").forEach(root=>{const project=root.dataset.photos,grid=root.querySelector(".photo-grid"),status=root.querySelector(".photo-status"),fileInput=root.querySelector('input[type="file"]'),caption=root.querySelector(".photo-caption");const zone=root.querySelector(".photo-dropzone"),preview=root.querySelector(".photo-preview"),previewImg=preview.querySelector("img"),filename=root.querySelector(".photo-filename");let selectedFile=null,previewUrl=null;
function selectFile(file){if(!file)return;if(!file.type.startsWith("image/")&&!/\\.(heic|heif)$/i.test(file.name)){say("Choose an image file.");return}if(file.size>10*1024*1024){say("Choose a photo under 10 MB.");return}selectedFile=file;filename.textContent=file.name;preview.classList.remove("hide");if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=URL.createObjectURL(file);previewImg.src=previewUrl;previewImg.onerror=()=>{previewImg.style.display="none"};previewImg.onload=()=>{previewImg.style.display=""};say("Photo selected.");uploadSelected()}
zone.addEventListener("click",e=>{if(e.target!==fileInput)fileInput.click()});zone.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();fileInput.click()}});fileInput.addEventListener("change",()=>selectFile(fileInput.files?.[0]));
let dragDepth=0;zone.addEventListener("dragenter",e=>{e.preventDefault();dragDepth++;zone.classList.add("dragover")});zone.addEventListener("dragover",e=>{e.preventDefault();e.dataTransfer.dropEffect="copy"});zone.addEventListener("dragleave",e=>{e.preventDefault();if(--dragDepth<=0){dragDepth=0;zone.classList.remove("dragover")}});zone.addEventListener("drop",e=>{e.preventDefault();dragDepth=0;zone.classList.remove("dragover");selectFile([...e.dataTransfer.files].find(f=>f.type.startsWith("image/")||/\\.(heic|heif)$/i.test(f.name)))});root.querySelector(".photo-clear").addEventListener("click",()=>{selectedFile=null;fileInput.value="";preview.classList.add("hide");if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=null;say("Selection cleared.")});
const uploadStatus=root.querySelector(".photo-upload-status");const say=s=>{uploadStatus.textContent=s};
async function render(){try{const res=await fetch("/api/photos?project="+encodeURIComponent(project));const data=await res.json();if(!res.ok){status.textContent=data.error||"Photos unavailable.";grid.replaceChildren();return}grid.replaceChildren();for(const p of data.photos){const card=document.createElement("div");card.className="photo-card";const link=document.createElement("a");link.href=p.url;link.target="_blank";link.rel="noopener noreferrer";const img=document.createElement("img");img.src=p.url;img.alt=p.caption||p.name;img.loading="lazy";link.append(img);card.append(link);if(p.caption){const label=document.createElement("p");label.textContent=p.caption;card.append(label)}if(photoToken()){const del=document.createElement("button");del.className="btn photo-delete";del.textContent="Delete";del.addEventListener("click",async()=>{if(!confirm("Delete this photo from the website?"))return;const res=await fetch("/api/photos?id="+encodeURIComponent(p.id),{method:"DELETE",credentials:"same-origin"});const data=await res.json();if(!res.ok){say(data.error||"Delete failed");return}await render()});card.append(del)}grid.append(card)}if(root.closest(".assembly-main-tile")){let active=0;const cards=[...grid.children];const update=()=>cards.forEach((c,i)=>c.hidden=i!==active);update();if(cards.length>1){for(const [dir,mark] of [[-1,"‹"],[1,"›"]]){const arrow=document.createElement("button");arrow.type="button";arrow.className="assembly-main-arrow "+(dir<0?"previous":"next");arrow.textContent=mark;arrow.setAttribute("aria-label",dir<0?"Previous photo":"Next photo");arrow.onclick=()=>{active=(active+dir+cards.length)%cards.length;update()};grid.append(arrow)}}}status.textContent=data.photos.length?data.photos.length+" photo"+(data.photos.length===1?"":"s"):(data.truncated?"More photos available.":"No photos yet.")}catch(e){status.textContent="Photos unavailable. Check the Cloudflare R2 setup."}}
async function uploadSelected(){const file=selectedFile;if(!file){say("Choose a photo first.");return}if(!adminAuthenticated){say("Log in using Admin login at the top of the website.");return}if(file.size>10*1024*1024){say("Choose a photo under 10 MB.");return}zone.setAttribute("aria-busy","true");say("Uploading…");try{const res=await fetch("/api/photos",{method:"POST",headers:{"authorization":"Bearer "+photoToken(),"content-type":file.type||"application/octet-stream","x-photo-project":project,"x-photo-caption":encodeURIComponent(caption.value).slice(0,600),"x-photo-name":encodeURIComponent(file.name).slice(0,300)},body:file});const data=await res.json();if(!res.ok){if(res.status===401){adminAuthenticated=false;refreshAdminUI()}say(res.status===401?"Session expired. Log in again using Admin login.":data.error||"Upload failed.");return}fileInput.value="";selectedFile=null;preview.classList.add("hide");if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=null;caption.value="";await render();say("Photo uploaded.")}catch(e){say("Upload failed. Check your connection and Cloudflare setup.")}finally{zone.removeAttribute("aria-busy")}}
render()})}
setupPhotos();


// Project assembly trees are public; editing requires administrator login.
const assemblySelections={};
// Public tree snapshots let each assembly BOM roll up all descendant parts.
const assemblyTreeSnapshots={};
function setupAssemblyTrees(){
 document.querySelectorAll("[data-assembly-tree]").forEach(root=>{
  const project=root.dataset.assemblyTree,view=document.getElementById(project),nodesEl=root.querySelector(".assembly-tree-nodes"),status=root.querySelector(".assembly-tree-status"),controls=root.querySelector(".assembly-edit");
  const title=view.querySelector(".assembly-main h1")?.textContent||"Project";let nodes=[],selected=null,expanded=new Set([null]);
  const detail=view.querySelector(".assembly-detail"),main=view.querySelector(".assembly-main"),detailStatus=detail.querySelector(".assembly-detail-status");
  const isPartNode=node=>node?.kind==="part"&&!!node.partId;
  const openTreePart=node=>{
   if(!isPartNode(node))return;
   partBackAssembly=node.parentId;
   selected=node.parentId;
   history.pushState(null,"","#"+project+"/part/"+encodeURIComponent(node.partId));
   render();void showAssemblyPage();window.scrollTo(0,0);
  };
  let detailVersion=0;
  // All project and subassembly pages now instantiate the exact same tile DOM.
  // Preserve the existing BOM widget (and its event handlers) when replacing root markup.
  function createUnifiedTile(){
   const tile=detail.querySelector(".assembly-unified-tile").cloneNode(true);
   tile.querySelector(".assembly-photos").replaceChildren();
   tile.querySelector(".assembly-description").textContent="";
   tile.querySelector(".assembly-description-input").value="";
   tile.querySelector(".assembly-content-tiles").replaceChildren();
   return tile;
  }
  const oldRootTile=main.querySelector(".assembly-unified-tile");
  const rootBom=oldRootTile.querySelector(".component-section");
  const rootStatus=oldRootTile.querySelector(".root-photo-status");
  const newRootTile=createUnifiedTile();
  newRootTile.classList.add("assembly-main-tile");
  newRootTile.querySelector(".assembly-content-tiles").append(rootBom);
  oldRootTile.replaceWith(newRootTile);
  if(rootStatus)main.insertBefore(rootStatus,newRootTile.nextSibling);
  // Shared image tile renderer for root projects and all subassemblies.
  function makeAssemblyPhotoStage(photos,name,onAdd,onDelete){
   let active=0;
   const stage=document.createElement("div");stage.className="assembly-photo-stage";
   const picture=document.createElement("img");picture.className="assembly-stage-image";picture.alt="";
   const empty=document.createElement("div");empty.className="assembly-photo-placeholder";empty.textContent="No photo yet";
   const prev=document.createElement("button"),next=document.createElement("button");
   prev.type=next.type="button";prev.className="assembly-photo-arrow previous";next.className="assembly-photo-arrow next";prev.textContent="‹";next.textContent="›";prev.setAttribute("aria-label","Previous photo");next.setAttribute("aria-label","Next photo");
   const label=document.createElement("span");label.className="assembly-photo-name";label.textContent=name;
   const actions=document.createElement("div");actions.className="assembly-photo-actions";
   const add=document.createElement("button");add.type="button";add.className="assembly-photo-icon";add.textContent="+";add.title="Add photo";add.setAttribute("aria-label","Add photo");add.onclick=onAdd;
   const del=document.createElement("button");del.type="button";del.className="assembly-photo-icon";del.textContent="×";del.title="Delete current photo";del.setAttribute("aria-label","Delete current photo");del.onclick=()=>onDelete(photos[active]);
   if(adminAuthenticated)actions.append(add,del);
   const show=()=>{const p=photos[active];picture.hidden=!p;empty.hidden=!!p;if(p){picture.src=p.url;picture.alt=p.caption||name}else picture.removeAttribute("src");prev.hidden=next.hidden=photos.length<2;del.hidden=!p};
   prev.onclick=()=>{active=(active+photos.length-1)%photos.length;show()};
   next.onclick=()=>{active=(active+1)%photos.length;show()};
   stage.append(picture,empty,prev,next,label,actions);show();return stage;
  }
  // Separate workspace route; the existing assembly overview remains unchanged.
  const workspace=document.createElement("section");workspace.className="assembly-workspace-page hide";
  workspace.innerHTML='<button type="button" class="btn workspace-back">← Assembly overview</button><div class="workspace-heading"><div class="workspace-cover"><span>No photo yet</span></div><div><h1 class="workspace-title"></h1><p class="muted">Workspace</p></div></div><section class="workspace-panels"><article class="workspace-bom"><div class="workspace-bom-heading"><h2>Bill of materials</h2><button type="button" class="btn primary workspace-new-part">+ New BOM-only part</button></div><div class="workspace-saved-parts" aria-live="polite">Loading saved parts…</div><div class="workspace-bom-mount"></div></article><article><h2>Work instructions</h2><textarea class="field workspace-instructions" placeholder="Add build steps, tools, measurements and checks…" rows="8"></textarea></article><article class="workspace-drawing-panel"></article><article><h2>Pictures</h2><div class="workspace-picture-list">Photos uploaded to this assembly appear in the overview.</div></article><article><h2>Machine settings / procedures</h2><textarea class="field workspace-procedures" placeholder="Add settings, recipes and procedures…" rows="5"></textarea></article><article><h2>Notes</h2><textarea class="field workspace-notes" placeholder="Add notes…" rows="5"></textarea></article><article class="workspace-resources"></article><div class="workspace-actions"><button type="button" class="btn primary workspace-save">Save workspace</button><span class="workspace-status" role="status"></span></div></section>';
  detail.after(workspace);
  // Each saved BOM part has its own independent instructions document.
  const partWorkspace=document.createElement("section");partWorkspace.className="assembly-workspace-page bom-part-workspace hide";
  partWorkspace.innerHTML='<button type="button" class="btn part-workspace-back">← Assembly BOM</button><div class="workspace-heading"><div class="workspace-cover part-workspace-cover"><span>No picture yet</span></div><div><h1 class="part-workspace-title">Part instructions</h1><p class="muted">Part build instructions</p></div></div><section class="workspace-panels"><article><h2>Build instructions</h2><textarea class="field part-instructions" rows="9" placeholder="Build steps, tools, measurements and checks…"></textarea></article><article class="part-drawing-panel"></article><article class="part-harness-preview hide"><h2>Wire harness cutting list</h2><div class="part-harness-preview-content"></div></article><article><h2>Machine settings / procedures</h2><textarea class="field part-procedures" rows="5" placeholder="Settings and procedures…"></textarea></article><article><h2>Notes</h2><textarea class="field part-notes" rows="5" placeholder="Additional notes…"></textarea></article><article class="part-linked-resources"></article><div class="workspace-actions"><button type="button" class="btn primary part-workspace-save">Save part instructions</button><span class="part-workspace-status" role="status"></span></div></section>';
  workspace.after(partWorkspace);
  const assemblyDrawingPanel=window.BSDrawings?.mount(workspace.querySelector(".workspace-drawing-panel"),()=>adminAuthenticated);
  const partDrawingPanel=window.BSDrawings?.mount(partWorkspace.querySelector(".part-drawing-panel"),()=>adminAuthenticated);

  const assemblyResourcePicker=window.BSResources?.mount(workspace.querySelector(".workspace-resources"));
  const partResourcePicker=window.BSResources?.mount(partWorkspace.querySelector(".part-linked-resources"));

  // Optional progressive disclosure: the textarea remains the simplest authoring tool.
  // Steps, test logs and history never require separate forms or mandatory fields.
  function installInstructionExtras(panel,prefix,onRestoreResources,onRestoreRecipe){
   const instruction=panel.querySelector("."+prefix+"-instructions");
   const article=instruction.closest("article");
   const previewButton=document.createElement("button");previewButton.type="button";previewButton.className="btn instruction-preview-toggle";previewButton.textContent="Preview steps";
   article.querySelector("h2").after(previewButton);
   const preview=document.createElement("div");preview.className="instruction-steps-preview hide";article.append(preview);
   const renderPreview=()=>{
    preview.replaceChildren();
    const chunks=instruction.value.trim().split(/\n\s*\n|\n(?=\s*\d+[.)]\s)/).map(x=>x.trim()).filter(Boolean);
    if(!chunks.length){preview.textContent="Write instructions above to preview the steps.";return}
    const list=document.createElement("ol");
    for(const chunk of chunks){
     const entry=document.createElement("li");entry.textContent=chunk.replace(/^\d+[.)]\s*/,"");list.append(entry);
    }
    preview.append(list);
   };
   previewButton.onclick=()=>{
    const show=preview.classList.contains("hide");preview.classList.toggle("hide",!show);
    previewButton.textContent=show?"Hide preview":"Preview steps";if(show)renderPreview();
   };
   instruction.addEventListener("input",()=>{if(!preview.classList.contains("hide"))renderPreview()});
   const notes=panel.querySelector("."+prefix+"-notes").closest("article");
   const logDetails=document.createElement("details");logDetails.className="instruction-log";
   const logSummary=document.createElement("summary");logSummary.textContent="Experiments & decisions";
   const logEntries=document.createElement("div");logEntries.className="instruction-log-entries";
   const addLog=document.createElement("button");addLog.type="button";addLog.className="btn";addLog.textContent="+ Record a test";
   logDetails.append(logSummary,logEntries,addLog);notes.append(logDetails);
   let experiments=[];
   const renderLogs=()=>{
    logEntries.replaceChildren();
    for(const entry of experiments){
     const row=document.createElement("div");row.className="instruction-log-item";
     const timestamp=document.createElement("small");timestamp.textContent=new Date(entry.createdAt).toLocaleDateString();
     const text=document.createElement("p");text.textContent=entry.text;
     row.append(timestamp,text);
     if(adminAuthenticated){const remove=document.createElement("button");remove.type="button";remove.className="btn";remove.textContent="Remove";remove.onclick=()=>{experiments=experiments.filter(x=>x.id!==entry.id);renderLogs()};row.append(remove)}
     logEntries.append(row);
    }
    if(!experiments.length){const empty=document.createElement("p");empty.className="muted";empty.textContent="No tests recorded yet.";logEntries.append(empty)}
   };
   addLog.onclick=()=>{
    if(!adminAuthenticated)return;
    const value=prompt("What did you test, observe or decide?");
    if(!value?.trim())return;
    experiments.push({id:crypto.randomUUID(),text:value.trim().slice(0,3000),createdAt:new Date().toISOString()});
    renderLogs();logDetails.open=true;
    const feedback=panel.querySelector(prefix==="part"?".part-workspace-status":".workspace-status");if(feedback)feedback.textContent="Test noted. Save the workspace to keep it.";
   };
   const historyDetails=document.createElement("details");historyDetails.className="instruction-history";
   const historySummary=document.createElement("summary");historySummary.textContent="Recent changes";
   const historyList=document.createElement("div");historyList.className="instruction-history-list";
   historyDetails.append(historySummary,historyList);panel.querySelector(prefix==="part"?".part-workspace-save":".workspace-save").after(historyDetails);
   function setData(data){
    const hasRecipe=Array.isArray(data?.recipe)&&data.recipe.length>0;
    previewButton.classList.toggle("hide",hasRecipe);
    if(hasRecipe)preview.classList.add("hide");
    experiments=Array.isArray(data?.experiments)?data.experiments.map(x=>({...x})):[];
    renderLogs();historyList.replaceChildren();
    const history=Array.isArray(data?.history)?[...data.history].reverse():[];
    for(const snapshot of history){
     const item=document.createElement("div");item.className="instruction-history-item";
     const label=document.createElement("span");
     label.textContent=new Date(snapshot.savedAt).toLocaleString();
     item.append(label);
     if(adminAuthenticated){
      const restore=document.createElement("button");restore.type="button";restore.className="btn";restore.textContent="Load this version";
      restore.onclick=()=>{
       for(const name of ["instructions","procedures","notes"])panel.querySelector("."+prefix+"-"+name).value=snapshot[name]||"";
       experiments=Array.isArray(snapshot.experiments)?snapshot.experiments.map(x=>({...x})):[];
       renderLogs();onRestoreResources?.(snapshot.resources);onRestoreRecipe?.(snapshot);
       if(!preview.classList.contains("hide"))renderPreview();
       panel.querySelector(prefix==="part"?".part-workspace-status":".workspace-status").textContent="Previous version loaded. Click Save to keep it.";
      };
      item.append(restore);
     }
     historyList.append(item);
    }
    if(!history.length)historyList.textContent="Older saved versions will appear here after edits.";
   }
   return {setData,getExperiments:()=>experiments};
  }
  const assemblyRecipe=window.BSRecipes?.mount(workspace.querySelector(".workspace-instructions").closest("article"),{admin:()=>adminAuthenticated});
  const partRecipe=window.BSRecipes?.mount(partWorkspace.querySelector(".part-instructions").closest("article"),{admin:()=>adminAuthenticated});
  const assemblyExtras=installInstructionExtras(workspace,"workspace",resources=>assemblyResourcePicker?.setData(resources,adminAuthenticated),snapshot=>assemblyRecipe?.setData(snapshot));
  const partExtras=installInstructionExtras(partWorkspace,"part",resources=>partResourcePicker?.setData(resources,adminAuthenticated),snapshot=>partRecipe?.setData(snapshot));

  const partTools=document.createElement("div");partTools.className="part-workspace-tools";
  partTools.classList.add("hide");
  partTools.innerHTML='<div class="part-photo-edit-label">Part picture</div><div class="part-photo-edit-preview"></div><button type="button" class="btn part-workspace-picture">Add / change picture</button><input type="file" class="part-workspace-file" accept="image/jpeg,image/png,image/webp" hidden>';
  const detailsPanel=document.createElement("section");detailsPanel.className="part-details-view";
  detailsPanel.innerHTML='<div class="part-details-view-heading"><h2>Part details</h2><span class="part-details-view-mode">View mode</span></div><div class="part-details-view-rows"></div><div class="part-details-view-actions"><button type="button" class="btn part-details-edit">Edit part details</button></div>';
  partWorkspace.querySelector(".workspace-heading").after(detailsPanel);
  const detailRows=detailsPanel.querySelector(".part-details-view-rows");
  const renderPartDetails=part=>{
   detailRows.replaceChildren();
   const fields=[["Qty",part.quantity===null||part.quantity===undefined?"Not specified":String(part.quantity)+(part.quantityUnit?" "+part.quantityUnit:"")],...(part.historicalPrice!==null&&part.historicalPrice!==undefined&&Number.isFinite(Number(part.historicalPrice))?[["Historical price","$"+Number(part.historicalPrice).toFixed(2)+" USD per unit"+(part.historicalPriceDate?" (recorded "+part.historicalPriceDate+")":"")]]:[]),["Manufacturer",part.manufacturer],["Model",part.model],["Category",part.category],["Supplier",part.supplier],["ASIN",part.asin]];
   for(const [title,value] of fields){
    if(value===null||value===undefined||String(value).trim()==="")continue;
    const line=document.createElement("div");line.className="part-details-view-row";
    const label=document.createElement("strong");label.textContent=title;
    const separator=document.createElement("span");separator.textContent=" - ";
    const content=document.createElement("span");content.textContent=String(value);
    line.append(label,separator,content);detailRows.append(line);
   }
   if(part.specifications?.length){
    const heading=document.createElement("h3");heading.textContent="Specifications";detailRows.append(heading);
    for(const spec of part.specifications){
     const line=document.createElement("div");line.className="part-details-view-row";
     const label=document.createElement("strong");label.textContent=spec.name||"Specification";
     const separator=document.createElement("span");separator.textContent=" - ";
     const value=document.createElement("span");value.textContent=(spec.value||"")+(spec.source==="inferred"?" (inferred)":"");
     line.append(label,separator,value);detailRows.append(line);
    }
   }
   detailsPanel.classList.remove("hide");
  };

  let currentPartInfo=null;
  const partFile=partTools.querySelector(".part-workspace-file"),pictureButton=partTools.querySelector(".part-workspace-picture");
  const photoEditPreview=partTools.querySelector(".part-photo-edit-preview");
  const photoEditingId=()=>editingPart||null;
  const photoFeedback=message=>{if(photoEditingId())bomReport(message);else partStatus.textContent=message};
  function refreshEditPhoto(){
   const id=photoEditingId();photoEditPreview.replaceChildren();if(!id)return;
   const img=document.createElement("img");img.alt="Current part picture";img.src=partPhotoUrl(id)+"&v="+Date.now();
   img.onerror=()=>{if(img.isConnected)photoEditPreview.replaceChildren(Object.assign(document.createElement("span"),{textContent:"No picture yet"}))};
   photoEditPreview.append(img);
  }
  const deletePictureButton=document.createElement("button");deletePictureButton.type="button";deletePictureButton.className="btn part-workspace-delete-picture";deletePictureButton.textContent="Delete picture";partTools.append(deletePictureButton);
  const partPictureDialog=document.createElement("dialog");partPictureDialog.className="part-picture-dialog";
  const pictureClose=document.createElement("button");pictureClose.type="button";pictureClose.className="btn part-picture-close";pictureClose.textContent="Close ✕";
  const fullImage=document.createElement("img");fullImage.className="part-picture-full";fullImage.alt="Full-size part picture";
  pictureClose.onclick=()=>partPictureDialog.close();
  partPictureDialog.onclick=event=>{if(event.target===partPictureDialog)partPictureDialog.close()};
  partPictureDialog.append(pictureClose,fullImage);partWorkspace.append(partPictureDialog);
  const pictureCover=partWorkspace.querySelector(".part-workspace-cover");
  pictureCover.title="Double-click to view the full-size picture";
  pictureCover.ondblclick=event=>{
   const image=pictureCover.querySelector("img");
   if(!image)return;
   event.preventDefault();
   fullImage.src=image.src;fullImage.alt=image.alt||"Full-size part picture";
   if(!partPictureDialog.open)partPictureDialog.showModal();
  };
  async function deletePartPicture(partId,feedback){
   if(!adminAuthenticated)return;
   if(!confirm("Delete this part picture? The BOM part and its instructions will remain."))return;
   const response=await fetch(partPhotoUrl(partId),{method:"DELETE",credentials:"same-origin"});
   const result=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(result.error||"Picture deletion failed (HTTP "+response.status+")");
   if(typeof feedback==="function")feedback();
  }
  deletePictureButton.onclick=async()=>{
   const partId=photoEditingId();if(!partId)return;
   deletePictureButton.disabled=true;
   try{
    await deletePartPicture(partId,()=>{
     pictureCover.replaceChildren(Object.assign(document.createElement("span"),{textContent:"No picture yet"}));
     refreshEditPhoto();
     if(partPictureDialog.open)partPictureDialog.close();
     photoFeedback("Part picture deleted.");
    });
   }catch(error){photoFeedback(error.message)}
   finally{deletePictureButton.disabled=false}
  };
  async function uploadPartPicture(file){
   const partId=photoEditingId();if(!file||!partId)return;
   const mime=file.type||({jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp"}[file.name.split(".").pop().toLowerCase()]||"");
   if(!["image/jpeg","image/png","image/webp"].includes(mime)||file.size>3*1024*1024){photoFeedback("Choose JPG, PNG or WebP under 3 MB.");return}
   pictureButton.disabled=true;photoFeedback("Uploading picture…");
   try{
    const response=await fetch(partPhotoUrl(partId),{method:"POST",credentials:"same-origin",headers:{"content-type":mime},body:file});
    const data=await response.json();if(!response.ok)throw Error(data.error||"Upload failed");
    const image=document.createElement("img");image.src=partPhotoUrl(partId)+"&v="+Date.now();image.alt=currentPartInfo?.name||"Part picture";
    partWorkspace.querySelector(".part-workspace-cover").replaceChildren(image);refreshEditPhoto();photoFeedback("Picture saved.");
   }catch(e){photoFeedback(e.message)}finally{pictureButton.disabled=false;partFile.value=""}
  }
  pictureButton.onclick=()=>partFile.click();
  partFile.onchange=()=>void uploadPartPicture(partFile.files?.[0]);
  detailsPanel.querySelector(".part-details-edit").onclick=()=>{
   const part=currentPartInfo;if(!part)return;
   const linked=nodes.find(n=>isPartNode(n)&&n.partId===part.id);
   selected=linked?linked.parentId:(part.assemblyId??null);
   partEditReturn={id:part.id,scrollY:window.scrollY};
   partBackAssembly=selected;
   history.pushState(null,"","#"+project+"/workspace/"+encodeURIComponent(selected??"__root__"));
   render();notify();
   editBomPart(part,selected);
   window.scrollTo(0,0);
  };


  const partRoute=()=>location.hash.slice(1).match(new RegExp("^"+project+"/part/([0-9a-f-]{36})$","i"))?.[1]||null;
  let partLoadVersion=0,partBackAssembly=null,partEditReturn=null;
  function returnToEditedPart(){
   if(!partEditReturn)return;
   const id=partEditReturn.id;
   history.replaceState(null,"","#"+project+"/part/"+encodeURIComponent(id));
   render();notify();
  }
  const partStatus=partWorkspace.querySelector(".part-workspace-status");
  async function showPartWorkspace(){
   const partId=partRoute();if(!partId)return;
   const version=++partLoadVersion;
   detailsPanel.querySelector(".part-details-view-actions").classList.toggle("hide",!adminAuthenticated);
   partWorkspace.classList.remove("hide");workspace.classList.add("hide");main.classList.add("hide");detail.classList.add("hide");
   const heading=partWorkspace.querySelector(".part-workspace-title"),cover=partWorkspace.querySelector(".part-workspace-cover");
   heading.textContent="Loading part…";currentPartInfo=null;partStatus.textContent="Loading instructions…";
   detailRows.replaceChildren();detailsPanel.classList.add("hide");
   partWorkspace.querySelector(".part-harness-preview").classList.add("hide");
   cover.replaceChildren();
   const placeholder=document.createElement("span");placeholder.textContent="No picture yet";cover.append(placeholder);
   for(const name of ["instructions","procedures","notes"])partWorkspace.querySelector(".part-"+name).value="";
   try{
    const [partResponse,response]=await Promise.all([fetch("/api/components?project="+encodeURIComponent(project),{cache:"no-store"}),fetch("/api/workspace?project="+encodeURIComponent(project)+"&part="+encodeURIComponent(partId),{cache:"no-store"})]);
    const partData=await partResponse.json(),data=await response.json();
    if(!partResponse.ok)throw Error(partData.error||"Unable to load part");
    if(!response.ok)throw Error(data.error||"Unable to load instructions");
    if(version!==partLoadVersion||partRoute()!==partId)return;
    const part=partData.components?.find(item=>item.id===partId);
    if(!part)throw Error("Part not found");
    heading.textContent=part.name;
    currentPartInfo=part;
    renderPartDetails(part);
    void partDrawingPanel?.load(project,"part",partId);
    void showHarnessPreview(partId,version);
    if(partBackAssembly===null)partBackAssembly=part.assemblyId??null;
    for(const name of ["instructions","procedures","notes"])partWorkspace.querySelector(".part-"+name).value=data.workspace?.[name]||"";
    partResourcePicker?.setData(data.workspace?.resources,adminAuthenticated);
    partRecipe?.setData(data.workspace);
    partExtras.setData(data.workspace);
    const img=document.createElement("img");img.alt=part.name;img.src=partPhotoUrl(partId);
    img.onload=()=>{if(partRoute()===partId)cover.replaceChildren(img)};
    partStatus.textContent="";
    if(partEditReturn?.id===partId){
     const y=partEditReturn.scrollY;partEditReturn=null;
     requestAnimationFrame(()=>window.scrollTo(0,y));
    }
   }catch(e){if(version===partLoadVersion)partStatus.textContent=e.message}
  }
  async function showHarnessPreview(partId,version){
   const panel=partWorkspace.querySelector(".part-harness-preview"),body=panel.querySelector(".part-harness-preview-content");
   try{
    const [response,wiresResponse]=await Promise.all([
     fetch("/api/harness?project="+encodeURIComponent(project)+"&part="+encodeURIComponent(partId),{cache:"no-store"}),
     fetch("/api/wires",{cache:"no-store"})
    ]);
    const data=await response.json(),wireData=await wiresResponse.json();
    if(!response.ok)throw Error(data.error||"Could not load cutting list");
    if(!wiresResponse.ok)throw Error(wireData.error||"Could not load wire materials");
    if(version!==partLoadVersion||partRoute()!==partId)return;
    const cuts=data.cuts||[];
    panel.classList.toggle("hide",!cuts.length);body.replaceChildren();
    const byId=new Map((wireData.wires||[]).map(w=>[w.id,w]));
    for(const cut of cuts){
     const wire=byId.get(cut.wireId),row=document.createElement("div");row.className="part-harness-cut";
     const title=document.createElement("strong");title.textContent=(wire?.name||"Wire material")+" · "+cut.qty+" × "+Number((cut.cutLengthMm/25.4).toFixed(3))+" in";
     const detail=document.createElement("span");detail.textContent=[wire?.awg?wire.awg+" AWG":"",wire?.construction||"",cut.endA?"A: "+cut.endA:"",cut.endB?"B: "+cut.endB:""].filter(Boolean).join(" · ");
     row.append(title,detail);body.append(row);
    }
   }catch(error){
    if(version!==partLoadVersion||partRoute()!==partId)return;
    panel.classList.remove("hide");body.textContent="Cutting list unavailable: "+error.message;
   }
  }
  partWorkspace.querySelector(".part-workspace-back").onclick=()=>{
   selected=partBackAssembly;
   partBackAssembly=null;
   history.pushState(null,"","#"+project+"/workspace/"+encodeURIComponent(selected??"__root__"));
   render();notify();window.scrollTo(0,0);
  };
  partWorkspace.querySelector(".part-workspace-save").onclick=async()=>{
   const id=partRoute();if(!id)return;
   if(!adminAuthenticated){partStatus.textContent="Sign in as administrator to save.";return}
   const data={};for(const name of ["instructions","procedures","notes"])data[name]=partWorkspace.querySelector(".part-"+name).value;
   data.resources=partResourcePicker?.getData();data.experiments=partExtras.getExperiments();data.recipe=partRecipe?.getData()||[];
   const button=partWorkspace.querySelector(".part-workspace-save");button.disabled=true;partStatus.textContent="Saving…";
   try{
    const response=await fetch("/api/workspace?project="+encodeURIComponent(project)+"&part="+encodeURIComponent(id),{method:"PUT",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify(data)});
    const result=await response.json();
    if(!response.ok)throw Error(result.error||"Save failed (HTTP "+response.status+")");
    partStatus.textContent="Part instructions saved.";
   }catch(e){partStatus.textContent=e.message}finally{button.disabled=false}
  };
  function openPartInstructions(part,originId){
   partBackAssembly=selected;
   history.pushState(null,"","#"+project+"/part/"+encodeURIComponent(part.id));
   void showAssemblyPage();window.scrollTo(0,0);
  }
  let extractedPictureUrl=null;
  // Workspace-owned extraction handler. Runs even when the legacy component
  // editor failed to initialize; captured before the editor's click listeners.
  const bomNotice=document.createElement("p");
  bomNotice.className="workspace-bom-notice";
  bomNotice.setAttribute("role","status");
  bomNotice.setAttribute("aria-live","assertive");
  workspace.querySelector(".workspace-bom-heading").after(bomNotice);
  workspace.querySelector(".workspace-bom").addEventListener("click",async event=>{
   const target=event.target;
   if(!(target instanceof Element))return;
   const button=target.closest(".component-extract");
   if(!button)return;
   event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
   const section=workspace.querySelector(".component-section");
   const notify=message=>{
    bomNotice.textContent=message;
    bomNotice.classList.add("visible");
    const status=section?.querySelector(".component-status");
    if(status){status.textContent=message;status.style.display="block";status.hidden=false}
   };
   notify("Extract clicked — checking the product information.");
   if(!section){notify("BOM form missing. Refresh the website.");return}
   const description=section.querySelector(".component-description")?.value.trim();
   if(!description){notify("Paste a product description or an HTTPS product URL.");return}
   if(!adminAuthenticated){notify("Sign in using Admin login to extract product specifications.");return}
   extractedPictureUrl=null;
   button.disabled=true;notify("Connecting to the extraction API…");
   try{
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),25000);
    let response;
    try{response=await fetch("/api/components/extract",{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({description}),signal:controller.signal})}finally{clearTimeout(timeout)}
    const raw=await response.text();
    let data;try{data=JSON.parse(raw)}catch{throw Error("Server returned HTTP "+response.status+" instead of valid JSON: "+raw.slice(0,120))}
    if(!response.ok)throw Error((data.error||"Extraction failed")+" (HTTP "+response.status+")");
    if(!data.component||typeof data.component!=="object")throw Error("No product data returned");
    const part=data.component;
    extractedPictureUrl=typeof data.imageUrl==="string"?data.imageUrl:null;
    for(const fieldName of ["name","manufacturer","model","category","supplier","asin"]){
     const field=section.querySelector(".component-"+fieldName);if(field)field.value=part[fieldName]||""
    }
    const specs=section.querySelector(".component-specs");if(specs){
     specs.replaceChildren();
     for(const spec of part.specifications||[]){
      const row=document.createElement("div");row.className="row component-spec-row";
      const name=document.createElement("input"),value=document.createElement("input"),source=document.createElement("select"),remove=document.createElement("button");
      name.className=value.className="field";name.placeholder="Specification";value.placeholder="Value";name.value=spec.name||"";value.value=spec.value||"";
      for(const optionValue of ["explicit","inferred"]){const option=document.createElement("option");option.value=optionValue;option.textContent=optionValue==="explicit"?"Stated in listing":"Inferred";source.append(option)}
      source.value=spec.source==="inferred"?"inferred":"explicit";
      remove.type="button";remove.className="btn";remove.textContent="Remove";remove.onclick=()=>row.remove();
      row.append(name,value,source,remove);specs.append(row);
     }
    }
    section.querySelector(".component-review")?.classList.remove("hide");
    notify("Specifications extracted."+(extractedPictureUrl?" Product picture found and will be added when saved.":" No product picture found.")+" Review and save the part.");
   }catch(error){
    section.querySelector(".component-review")?.classList.remove("hide");
    const message="Extraction failed: "+(error.name==="AbortError"?"The request timed out":error.message);
    notify(message);
   }finally{button.disabled=false}
  },true);
  // Display saved parts independently of the legacy editor's <details> DOM.
  let bomDisplayVersion=0;
  let listView=false;
  const bomHeader=workspace.querySelector(".workspace-bom-heading");
  const viewSwitch=document.createElement("div");viewSwitch.className="bom-view-switch";viewSwitch.setAttribute("role","group");viewSwitch.setAttribute("aria-label","BOM display");
  const thumbButton=document.createElement("button");thumbButton.type="button";thumbButton.className="btn bom-view-button";thumbButton.textContent="Thumbnail view";
  const listButton=document.createElement("button");listButton.type="button";listButton.className="btn bom-view-button";listButton.textContent="List view";
  const updateViewButtons=()=>{
   thumbButton.classList.toggle("is-active",!listView);
   listButton.classList.toggle("is-active",listView);
   thumbButton.setAttribute("aria-pressed",String(!listView));
   listButton.setAttribute("aria-pressed",String(listView));
  };
  thumbButton.onclick=()=>{if(!listView)return;listView=false;updateViewButtons();void renderWorkspaceParts()};
  listButton.onclick=()=>{if(listView)return;listView=true;updateViewButtons();void renderWorkspaceParts()};
  viewSwitch.append(thumbButton,listButton);
  bomHeader.querySelector(".workspace-new-part").before(viewSwitch);
  updateViewButtons();
  let editingPart=null;
  let editingPartAssembly=null;
  const partPhotoUrl=id=>"/api/components/photo?project="+encodeURIComponent(project)+"&id="+encodeURIComponent(id);
  // Local SVG fallback: always show a clear frowny face when a thumbnail is missing.
  const missingPicture="data:image/svg+xml,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" rx="18" fill="#243642"/><circle cx="80" cy="80" r="53" fill="#667b87" stroke="#718894" stroke-width="3"/><circle cx="61" cy="70" r="5" fill="#354b57"/><circle cx="99" cy="70" r="5" fill="#354b57"/><path d="M54 108 Q80 87 106 108" fill="none" stroke="#354b57" stroke-width="6" stroke-linecap="round"/></svg>');
  function makeBomThumbnail(url,alt){
   const image=document.createElement("img");image.className="bom-row-thumbnail";image.alt=alt||"Part picture";image.loading="lazy";
   image.onerror=()=>{image.onerror=null;image.src=missingPicture;image.classList.add("bom-thumbnail-empty");image.alt="Picture unavailable";};
   if(url)image.src=url;else{image.src=missingPicture;image.classList.add("bom-thumbnail-empty")}
   return image;
  }
  // Default to the Workshop's two stocking gauges, with specific heat-shrink and solder choices.
  function recommendedWorkshop(part){
   const name=String(part.name||"").toLowerCase();
   const specs=part.specifications||[];
   const insulation=String(specs.find(x=>String(x.name).toLowerCase()==="insulation")?.value||"").toLowerCase();
   if(/silicone/.test(insulation)||/silicone/.test(name))return "workshop:silicone";
   if(/ferrule/.test(name)){
    if(/\b22\s*awg\b/.test(name))return "workshop:ferrule22";
    if(/\b18\s*awg\b/.test(name))return "workshop:ferrule18";
    return null;
   }
   if(/heat[- ]?shrink/.test(name))return /adhesive|dual.wall|waterproof|seal/.test(name)?"workshop:sealshrink":"workshop:heatshrink";
   if(/\bsolder\b/.test(name))return "workshop:solder";
   if(/\bwire\b|\bcable\b/.test(name)){
    if(/\b18\s*awg\b/.test(name))return "workshop:wire18";
    if(/\b22\s*awg\b/.test(name))return "workshop:wire22";
    return "workshop:wire22";
   }
   return null;
  }
  function allowedWorkshopChoices(part){
   const recommended=recommendedWorkshop(part);
   if(!recommended)return [];
   if(recommended==="workshop:heatshrink"||recommended==="workshop:sealshrink")return ["workshop:heatshrink","workshop:sealshrink"];
   if(recommended==="workshop:wire18"||recommended==="workshop:wire22"){
    const hasGauge=/\b(?:18|22)\s*awg\b/i.test(String(part.name||""));
    return hasGauge?[recommended,"workshop:silicone"]:["workshop:wire22","workshop:wire18","workshop:silicone"];
   }
   return [recommended];
  }
  function workshopLink(part){
   const link=document.createElement("button");link.type="button";link.className="btn bom-workshop-link";
   link.textContent=part.workshopChoice?"Change selection":recommendedWorkshop(part)?"Choose recommended":"Browse Workshop";
   link.onclick=async e=>{
    e.preventDefault();e.stopPropagation();
    const original=location.hash.slice(1);
    const allowed=allowedWorkshopChoices(part);
    const initial=allowed.includes(part.workshopChoice)?part.workshopChoice:recommendedWorkshop(part);
    navigate("commonparts");
    const choose=async item=>{
     const response=await fetch("/api/components?project="+encodeURIComponent(project)+"&id="+encodeURIComponent(part.id),{
      method:"PATCH",credentials:"same-origin",headers:{"content-type":"application/json"},
      body:JSON.stringify({workshopChoice:item.id})
     });
     const data=await response.json().catch(()=>({}));
     if(!response.ok)throw Error(data.error||"Could not save Workshop selection");
     navigate(original);
     bomReport(item.name+" selected from The Workshop for "+part.name+".");
    };
    requestAnimationFrame(()=>window.BSResources?.focusWorkshopItem(initial,choose,allowed));
   };
   return link;
  }
  const shopCandidate=part=>part.generatedKind==="ferrule"||part.generatedKind==="wire"||/\b(?:ferrules?|solder|heat[- ]?shrink|wire|cable)\b/i.test(part.name||"");
  const materialQuantity=part=>part.quantity===null||part.quantity===undefined?"Quantity not specified":String(part.quantity)+(part.quantityUnit?" "+part.quantityUnit:"");
  function preferenceButton(part){
   if(!shopCandidate(part)||!adminAuthenticated)return null;
   const button=document.createElement("button");button.type="button";button.className="btn bom-material-preference";
   button.textContent=part.assumedOnHand?"Treat as purchase item":"Assume on hand";
   button.title="Only changes how this material appears in the BOM. No inventory tracking.";
   button.onclick=async event=>{
    event.preventDefault();event.stopPropagation();button.disabled=true;
    try{
     const response=await fetch("/api/components?project="+encodeURIComponent(project)+"&id="+encodeURIComponent(part.id),{
      method:"PATCH",credentials:"same-origin",headers:{"content-type":"application/json"},
      body:JSON.stringify({purchaseOverride:part.assumedOnHand?true:false})
     });
     const data=await response.json().catch(()=>({}));
     if(!response.ok)throw Error(data.error||"Could not update material preference");
     await renderWorkspaceParts();
     bomReport(part.name+(data.component.assumedOnHand?" moved to standard shop materials.":" moved to the main BOM."));
    }catch(error){bomReport("Could not change material: "+error.message);button.disabled=false}
   };
   return button;
  }
  let shopPanelExpanded=false;
  function shopMaterialsPanel(items){
   if(!items.length)return null;
   const section=document.createElement("details");section.className="bom-shop-materials";
   section.open=shopPanelExpanded;
   section.addEventListener("toggle",()=>{shopPanelExpanded=section.open});
   const summary=document.createElement("summary");
   summary.textContent="Standard shop materials · "+items.length+" item"+(items.length===1?"":"s")+" (assumed available)";
   const description=document.createElement("p");description.className="muted bom-shop-note";
   description.textContent="Check shop supplies before building. These are required materials, not confirmed stock.";
   const rows=document.createElement("div");rows.className="bom-shop-material-rows";
   for(const part of items){
    const row=document.createElement("div");row.className="bom-shop-material-row";
    const name=document.createElement("span");name.className="bom-shop-material-name";name.textContent=part.name;
    const quantity=document.createElement("span");quantity.className="bom-shop-qty";quantity.textContent=materialQuantity(part);
    const openPart=document.createElement("button");openPart.type="button";openPart.className="btn bom-open-part-details";openPart.textContent="Open part details";
    openPart.onclick=()=>openPartInstructions(part,part.assemblyId??null);
    row.append(name,quantity,openPart);
    if(part.workshopChoice){
     const selected=document.createElement("span");selected.className="bom-workshop-selected";
     selected.textContent="Selected: "+(window.BSResources?.all("parts").find(x=>x.id===part.workshopChoice)?.name||"Workshop standard");
     row.append(selected);
    }
    row.append(workshopLink(part));
    const change=preferenceButton(part);if(change)row.append(change);
    rows.append(row);
   }
   section.append(summary,description,rows);return section;
  }
  function createSavedPart(part,originId){
   const item=document.createElement("details");item.className="bom-part";
   const summary=document.createElement("summary");summary.className="bom-part-summary";
   const photo=makeBomThumbnail(partPhotoUrl(part.id),part.name);
   const name=document.createElement("span");name.className="bom-part-name";name.textContent=part.name;
   const openPart=document.createElement("button");openPart.type="button";openPart.className="btn bom-open-part-details";openPart.textContent="Open part details";
   openPart.onclick=event=>{event.preventDefault();event.stopPropagation();openPartInstructions(part,originId)};
   if(part.bomOnly)item.classList.add("bom-only-part");
   if(part.generatedFrom)item.classList.add("bom-generated-part");
   const qty=document.createElement("span");qty.className="bom-part-meta";qty.textContent=(part.quantity===null||part.quantity===undefined?"Qty not specified":"Qty "+part.quantity+(part.quantityUnit?" "+part.quantityUnit:""))+(part.model?" · "+part.model:"");
   const expand=document.createElement("span");expand.className="bom-part-toggle-label";expand.textContent="Details";
   summary.append(photo,name,qty,openPart,expand);item.append(summary);
   const body=document.createElement("div");body.className="bom-part-body";
   for(const [label,value] of [["Manufacturer",part.manufacturer],["Model",part.model],["Supplier",part.supplier],["ASIN",part.asin],["Category",part.category]]){
    if(!value)continue;
    const row=document.createElement("p"),strong=document.createElement("strong");strong.textContent=label+": ";row.append(strong,document.createTextNode(value));body.append(row);
   }
   if(part.specifications?.length){
    const title=document.createElement("strong");title.textContent="Specifications";body.append(title);
    const ul=document.createElement("ul");for(const entry of part.specifications){const li=document.createElement("li");li.textContent=entry.name+": "+entry.value+(entry.source==="inferred"?" (inferred)":"");ul.append(li)}body.append(ul);
   }
   if(part.assumedOnHand)body.append(workshopLink(part));
   const preference=preferenceButton(part);if(preference)body.append(preference);
   if(part.generatedFrom){
    const automatic=document.createElement("p");automatic.className="muted bom-auto-note";
    automatic.textContent="Calculated automatically from the wire configuration. Edit the wire to change this quantity or termination.";
    body.append(automatic);
   }
   if(adminAuthenticated&&!part.generatedFrom){
    const controls=document.createElement("div");controls.className="bom-part-actions";
    const edit=document.createElement("button");edit.type="button";edit.className="btn";edit.textContent="Edit part";
    edit.onclick=()=>{editBomPart(part,originId)};
    const pick=document.createElement("button");pick.type="button";pick.className="btn";pick.textContent="Add / change picture";
    const input=document.createElement("input");input.type="file";input.accept="image/jpeg,image/png,image/webp";input.hidden=true;
    pick.onclick=()=>input.click();
    const uploadThumbnail=async file=>{
     if(!file)return;
     const mime=file.type||({jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp"}[file.name.split(".").pop().toLowerCase()]||"");
     if(!["image/jpeg","image/png","image/webp"].includes(mime)||file.size>3*1024*1024){bomReport("Use JPG, PNG or WebP under 3 MB.");return}
     pick.disabled=true;pick.textContent="Uploading…";
     try{
      const response=await fetch(partPhotoUrl(part.id),{method:"POST",credentials:"same-origin",headers:{"content-type":mime},body:file});
      const result=await response.json();if(!response.ok)throw Error(result.error||"Upload failed");
      photo.classList.remove("bom-thumbnail-empty");photo.src=partPhotoUrl(part.id)+"&v="+Date.now();pick.textContent="Change picture";bomReport("Picture saved for "+part.name+".");
     }catch(error){bomReport("Picture upload failed: "+error.message);pick.textContent="Add / change picture"}
     finally{pick.disabled=false;input.value=""}
    };
    input.onchange=()=>{void uploadThumbnail(input.files?.[0]);input.value=""};
    // Drop a file on the thumbnail or its upload button.
    for(const target of [photo,pick]){
     target.classList.add("bom-picture-drop");
     target.addEventListener("dragover",event=>{if(!event.dataTransfer.types.includes("Files"))return;event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect="copy";target.classList.add("is-dragover")});
     target.addEventListener("dragleave",event=>{event.preventDefault();target.classList.remove("is-dragover")});
     target.addEventListener("drop",event=>{event.preventDefault();event.stopPropagation();target.classList.remove("is-dragover");void uploadThumbnail(event.dataTransfer.files?.[0])});
    }
    const deletePicture=document.createElement("button");deletePicture.type="button";deletePicture.className="btn bom-delete-picture";deletePicture.textContent="Delete picture";
    deletePicture.onclick=async()=>{
     deletePicture.disabled=true;
     try{
      await deletePartPicture(part.id,()=>{
       photo.onerror=null;photo.src=missingPicture;photo.classList.add("bom-thumbnail-empty");photo.alt="Picture unavailable";
       bomReport("Picture removed from "+part.name+".");
      });
     }catch(error){bomReport(error.message)}
     finally{deletePicture.disabled=false}
    };
    controls.append(deletePicture);
    const remove=document.createElement("button");remove.type="button";remove.className="btn";remove.textContent="Delete part";
    remove.onclick=async()=>{
     if(!confirm("Delete "+part.name+"?"))return;
     remove.disabled=true;
     try{
      const featureNodes=nodes.filter(n=>isPartNode(n)&&n.partId===part.id);
      if(featureNodes.length)await save(nodes.filter(n=>!featureNodes.some(link=>link.id===n.id)));
      const response=await fetch("/api/components?project="+encodeURIComponent(project)+"&id="+encodeURIComponent(part.id),{method:"DELETE",credentials:"same-origin"});
      const result=await response.json().catch(()=>({}));if(!response.ok)throw Error(result.error||"Delete failed");
      await renderWorkspaceParts();
     }catch(error){bomReport("Delete failed: "+error.message);remove.disabled=false}
    };
    if(!part.bomOnly&&!nodes.some(n=>isPartNode(n)&&n.partId===part.id)){
     const link=document.createElement("button");link.type="button";link.className="btn";link.textContent="Add to feature tree";
     link.onclick=async()=>{
      link.disabled=true;
      const node={id:crypto.randomUUID(),kind:"part",partId:part.id,name:part.name,parentId:originId};
      try{
       await save([...nodes,node]);expanded.add(originId);
       await renderWorkspaceParts();
       bomReport(part.name+" linked in the feature tree.");
      }catch(error){bomReport("Unable to add to feature tree: "+error.message)}
      finally{link.disabled=false}
     };
     controls.append(link);
    }
    controls.append(edit,pick,remove,input);body.append(controls);
   }
   item.append(body);return item;
  }
  // Only the most recently opened BOM entry has an enlarged thumbnail.
  // Keep other <details> open so nested subassembly BOMs remain visible.
  workspace.querySelector(".workspace-saved-parts").addEventListener("toggle",event=>{
   const entry=event.target;
   if(!(entry instanceof HTMLDetailsElement)||!entry.classList.contains("bom-part"))return;
   if(!entry.open){entry.classList.remove("bom-thumbnail-active");return}
   const list=workspace.querySelector(".workspace-saved-parts");
   list.querySelectorAll(".bom-thumbnail-active").forEach(other=>other.classList.remove("bom-thumbnail-active"));
   entry.classList.add("bom-thumbnail-active");
  },true);
  async function renderWorkspaceParts(){
   const version=++bomDisplayVersion,assemblyId=selected,container=workspace.querySelector(".workspace-saved-parts");
   container.replaceChildren();
   const pending=document.createElement("p");pending.className="bom-count";pending.textContent="Loading saved parts…";container.append(pending);
   try{
    const response=await fetch("/api/components?project="+encodeURIComponent(project),{cache:"no-store"});
    const result=await response.json();if(!response.ok)throw Error(result.error||"Unable to load parts");
    if(version!==bomDisplayVersion||assemblyId!==selected||!workspaceRoute())return;
    const parts=Array.isArray(result.components)?result.components:[];
    const included=new Set([assemblyId]);
    const gather=id=>{for(const node of nodes.filter(n=>n.parentId===id&&!isPartNode(n))){if(!included.has(node.id)){included.add(node.id);gather(node.id)}}};
    gather(assemblyId);
    const shopItems=parts.filter(p=>included.has(p.assemblyId??null)&&p.assumedOnHand);
    const shopIds=new Set(shopItems.map(p=>p.id));
    container.replaceChildren();
    if(listView){
     // A compact tabular representation of the same BOM, not a different purchasing calculation.
     const items=parts.filter(p=>included.has(p.assemblyId??null)&&!shopIds.has(p.id));
     const table=document.createElement("table");table.className="bom-shopping-table";
     const head=document.createElement("thead"),headRow=document.createElement("tr");
     for(const label of ["Part / material","Assembly","Quantity"]){const th=document.createElement("th");th.textContent=label;headRow.append(th)}
     head.append(headRow);table.append(head);
     const body=document.createElement("tbody");
     for(const p of items){
      const tr=document.createElement("tr"),name=document.createElement("td"),assembly=document.createElement("td"),quantity=document.createElement("td");
      const label=document.createElement("span");label.className="bom-list-part-name";label.textContent=p.name;
      name.append(label);
      const openPart=document.createElement("button");openPart.type="button";openPart.className="btn bom-open-part-details";openPart.textContent="Open part details";
      openPart.onclick=()=>openPartInstructions(p,p.assemblyId??null);
      name.append(openPart);
      const preference=preferenceButton(p);if(preference)name.append(preference);
      if(p.generatedFrom){const marker=document.createElement("small");marker.className="muted";marker.textContent=" · calculated";name.append(marker)}
      assembly.textContent=p.assemblyId===assemblyId?(assemblyId===null?"Project":"This assembly"):(nodes.find(n=>n.id===p.assemblyId)?.name||"Project");
      quantity.textContent=p.quantity===null||p.quantity===undefined?"Not specified":String(p.quantity)+(p.quantityUnit?" "+p.quantityUnit:"");
      tr.append(name,assembly,quantity);body.append(tr);
     }
     if(!items.length){const row=document.createElement("tr"),cell=document.createElement("td");cell.colSpan=3;cell.textContent="No materials yet.";row.append(cell);body.append(row)}
     table.append(body);container.append(table);
     const shopSection=shopMaterialsPanel(shopItems);if(shopSection)container.append(shopSection);
     return;
    }
    // A real subassembly is shown once as an expandable BOM row, not duplicated as a normal part.
    const renderAssembly=(parentId,mount,level)=>{
     const linkedIds=new Set(nodes.filter(n=>isPartNode(n)).map(n=>n.partId));
     const ownParts=parts.filter(p=>(p.assemblyId??null)===parentId&&!linkedIds.has(p.id)&&!shopIds.has(p.id));
     const children=nodes.filter(n=>n.parentId===parentId);
     for(const part of ownParts)mount.append(createSavedPart(part,parentId));
     for(const node of children){
      if(isPartNode(node)){
       const part=parts.find(p=>p.id===node.partId);
       if(part&&!shopIds.has(part.id)){
        const entry=createSavedPart(part,node.parentId);
        entry.classList.add("bom-feature-part");
        const badge=document.createElement("span");badge.className="bom-subassembly-label";badge.textContent="– Part";
        entry.querySelector(".bom-part-summary .bom-part-name")?.after(badge);
        mount.append(entry);
       }
       continue;
      }
      const item=document.createElement("details");item.className="bom-part bom-subassembly";item.dataset.assemblyId=node.id;item.open=false;item.setAttribute("aria-label",node.name+" subassembly BOM");
      const summary=document.createElement("summary");summary.className="bom-part-summary";
      const image=makeBomThumbnail("","Assembly image");
      image.classList.add("bom-thumbnail-empty");
      fetch("/api/photos?project="+encodeURIComponent(project)+"&assembly="+encodeURIComponent(node.id))
       .then(r=>r.ok?r.json():null).then(data=>{if(data?.photos?.[0]){image.classList.remove("bom-thumbnail-empty");image.src=data.photos[0].url}}).catch(()=>{});
      const name=document.createElement("span");name.className="bom-part-name";name.textContent=node.name;
      const label=document.createElement("span");label.className="bom-subassembly-label";label.textContent="– Subassembly";
      const hint=document.createElement("span");hint.className="bom-part-toggle-label";hint.textContent="Show BOM";hint.setAttribute("aria-label","Show or hide this subassembly BOM");
      const descendantIds=new Set([node.id]);const collect=id=>{for(const child of nodes.filter(x=>x.parentId===id))if(!descendantIds.has(child.id)){descendantIds.add(child.id);collect(child.id)}};collect(node.id);
      const count=document.createElement("span");count.className="bom-subassembly-count";
      const nParts=parts.filter(part=>descendantIds.has(part.assemblyId??null)||nodes.some(x=>isPartNode(x)&&x.partId===part.id&&descendantIds.has(x.parentId))).length;
      count.textContent=nParts+" part"+(nParts===1?"":"s");
      summary.append(image,name,label,count,hint);item.append(summary);
      item.addEventListener("toggle",()=>{hint.textContent=item.open?"Hide BOM":"Show BOM"});
      const body=document.createElement("div");body.className="bom-part-body bom-subassembly-children";
      const inner=document.createElement("div");inner.className="bom-part-stack";
      renderAssembly(node.id,inner,level+1);
      if(!inner.childElementCount){const empty=document.createElement("p");empty.className="bom-empty";empty.textContent="No parts in this subassembly yet.";inner.append(empty)}
      const open=document.createElement("button");open.type="button";open.className="btn bom-open-subassembly";open.textContent="Open subassembly instructions";
      open.onclick=()=>{selected=node.id;expanded.add(node.parentId);render();notify();history.pushState(null,"","#"+project+"/workspace/"+encodeURIComponent(node.id));showAssemblyPage();window.scrollTo(0,0)};
      body.append(inner,open);item.append(body);mount.append(item);
     }
    };
    const count=document.createElement("p");count.className="bom-count";
    const treeIds=new Set([assemblyId]);
    const visit=id=>{for(const node of nodes.filter(n=>n.parentId===id))if(!treeIds.has(node.id)){treeIds.add(node.id);visit(node.id)}};visit(assemblyId);
    const partCount=parts.filter(p=>(treeIds.has(p.assemblyId??null)&&!nodes.some(n=>isPartNode(n)&&n.partId===p.id))||nodes.some(n=>isPartNode(n)&&n.partId===p.id&&treeIds.has(n.parentId))).length;
    const componentCount=Math.max(0,partCount-shopItems.length);
    count.textContent=componentCount+" BOM part"+(componentCount===1?"":"s")+(shopItems.length?" · "+shopItems.length+" standard shop materials":"")+" · "+nodes.filter(n=>!isPartNode(n)&&treeIds.has(n.id)&&n.id!==assemblyId).length+" subassemblies";
    container.append(count);
    const stack=document.createElement("div");stack.className="bom-part-stack";
    renderAssembly(assemblyId,stack,0);
    if(!stack.childElementCount){const empty=document.createElement("p");empty.className="bom-empty";empty.textContent=shopItems.length?"No purchased components in this assembly. Standard materials appear below.":"No parts yet. Use + New BOM-only part to add one.";stack.append(empty)}
    container.append(stack);
    const shopSection=shopMaterialsPanel(shopItems);if(shopSection)container.append(shopSection);
   }catch(error){
    if(version!==bomDisplayVersion)return;
    container.replaceChildren();
    const message=document.createElement("p");message.className="bom-error";message.textContent="Unable to load BOM: "+error.message;container.append(message);
   }
  }
  // Workspace owns its part editor actions. Keep the mini-project component
  // editors separate; this panel saves one assembly part per request.
  const bomEditorMount=workspace.querySelector(".workspace-bom-mount");
  bomEditorMount.prepend(partTools);
  const bomSavedList=workspace.querySelector(".workspace-saved-parts");
  const bomEditorHeader=document.createElement("div");
  bomEditorHeader.className="workspace-bom-editor-header hide";
  const bomEditorHeading=document.createElement("h3");
  bomEditorHeading.className="workspace-bom-editor-title";
  const bomEditorCancel=document.createElement("button");
  bomEditorCancel.type="button";
  bomEditorCancel.className="btn workspace-bom-editor-cancel";
  bomEditorCancel.textContent="Cancel editing";
  bomEditorHeader.append(bomEditorHeading,bomEditorCancel);
  bomEditorMount.prepend(bomEditorHeader);
  const moveBomEditorToTop=()=>{
   bomSavedList.before(bomEditorMount);
   bomEditorMount.classList.add("is-editing");
   bomEditorHeading.textContent=editingPart?"Edit part: "+(bomField("name")?.value||"Part"):"Add new BOM part";
   bomEditorCancel.textContent=editingPart?"Cancel editing":"Cancel new part";
   bomEditorHeader.classList.remove("hide");
  };
  const dismissBomEditor=()=>{
   bomEditorMount.classList.remove("is-editing");
   bomEditorHeader.classList.add("hide");
   partTools.classList.add("hide");
   bomSavedList.after(bomEditorMount);
  };
  bomEditorCancel.onclick=()=>{
   if(savingBom)return;
   clearBomDraft();
   const form=bomRoot()?.querySelector(".component-admin");
   if(form)form.open=false;
   bomRoot()?.querySelector(".component-review")?.classList.add("hide");
   bomReport("Part editing cancelled.");
   returnToEditedPart();
  };
  const bomRoot=()=>workspace.querySelector(".component-section");
  const bomField=name=>bomRoot()?.querySelector(".component-"+name);
  const bomReport=message=>{
   const label=workspace.querySelector(".workspace-bom-notice");
   if(label){label.textContent=message;label.classList.toggle("visible",!!message)}
   const el=bomRoot()?.querySelector(".component-status");
   if(el){el.textContent=message;el.hidden=false;el.style.display="block"}
  };
  function clearBomDraft(){
   dismissBomEditor();
   extractedPictureUrl=null;
   editingPart=null;editingPartAssembly=null;
   for(const name of ["name","manufacturer","model","category","supplier","asin","description","historical-price","historical-price-date"]){const el=bomField(name);if(el)el.value=""}
   const qty=bomField("quantity");if(qty)qty.value="";
   const unit=bomField("quantity-unit");if(unit)unit.value="pcs";
   bomRoot()?.querySelector(".component-specs")?.replaceChildren();
   bomRoot()?.querySelector(".component-review")?.classList.remove("hide");
   const save=bomField("save");if(save)save.textContent="Save part";
  }
  function editBomPart(part,originId){
   if(savingBom)return;
   clearBomDraft();editingPart=part.id;editingPartAssembly=originId;
   for(const key of ["name","manufacturer","model","supplier","asin","category"]){const field=bomField(key);if(field)field.value=part[key]||""}
   const qty=bomField("quantity");if(qty)qty.value=part.quantity??"";
   const unit=bomField("quantity-unit");if(unit)unit.value=part.quantityUnit??"pcs";
   const price=bomField("historical-price"),date=bomField("historical-price-date");
   if(price)price.value=part.historicalPrice??"";
   if(date)date.value=part.historicalPriceDate||"";
   const specs=bomRoot()?.querySelector(".component-specs");
   if(specs){for(const spec of part.specifications||[]){
    const row=document.createElement("div");row.className="row component-spec-row";
    const a=document.createElement("input"),b=document.createElement("input"),c=document.createElement("select"),remove=document.createElement("button");
    a.className=b.className="field";a.placeholder="Specification";b.placeholder="Value";a.value=spec.name;b.value=spec.value;
    for(const v of ["explicit","inferred"]){const opt=document.createElement("option");opt.value=v;opt.textContent=v==="explicit"?"Stated in listing":"Inferred";c.append(opt)}
    c.value=spec.source==="inferred"?"inferred":"explicit";
    remove.type="button";remove.className="btn";remove.textContent="Remove";remove.onclick=()=>row.remove();
    row.append(a,b,c,remove);specs.append(row);
   }}
   openBomDraft();
   partTools.classList.remove("hide");
   refreshEditPhoto();
   const save=bomField("save");if(save)save.textContent="Save changes";
   bomReport("Editing "+part.name+". Changes will update this part without creating a duplicate.");
  }
  function openBomDraft(){
   const root=bomRoot();if(!root){bomReport("BOM editor unavailable. Refresh the page.");return}
   moveBomEditorToTop();
   root.querySelector("details")?.setAttribute("open","");
   const form=root.querySelector(".component-admin");if(form)form.open=true;
   root.querySelector(".component-review")?.classList.remove("hide");
   bomEditorMount.scrollIntoView({behavior:"smooth",block:"start"});
   bomField("name")?.focus({preventScroll:true});
  }
  let savingBom=false;
  async function saveBomDraft(){
   if(savingBom)return false;
   const name=bomField("name")?.value.trim()||"";
   if(!name){bomReport("Enter a part name before saving.");openBomDraft();return false}
   if(!adminAuthenticated){bomReport("Use Admin login before saving BOM parts.");return false}
   const rawQty=bomField("quantity")?.value.trim()??"";
   const amount=rawQty===""?null:Number(rawQty);
   if(amount!==null&&(!Number.isFinite(amount)||amount<=0||amount>10000000)){bomReport("Quantity must be positive or left blank.");return false}
   const component={assemblyId:editingPart?editingPartAssembly:selected,quantity:amount,quantityUnit:bomField("quantity-unit")?.value??"pcs"};
   const priceInput=bomField("historical-price")?.value.trim()||"";
   const dateInput=bomField("historical-price-date")?.value||"";
   if(priceInput&&(!Number.isFinite(Number(priceInput))||Number(priceInput)<0||Math.round(Number(priceInput)*100)!==Number(priceInput)*100&&Math.abs(Math.round(Number(priceInput)*100)-Number(priceInput)*100)>1e-6)){
    bomReport("Historical price must be a positive USD amount with at most two decimal places.");return false;
   }
   component.historicalPrice=priceInput===""?null:Number(priceInput);
   component.historicalPriceDate=priceInput===""?null:(dateInput||new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10));
   for(const key of ["name","manufacturer","model","category","supplier","asin"])component[key]=bomField(key)?.value.trim()||"";
   component.specifications=[...(bomRoot()?.querySelectorAll(".component-spec-row")||[])].map(row=>({
    name:row.children[0]?.value.trim()||"",value:row.children[1]?.value.trim()||"",source:row.children[2]?.value==="inferred"?"inferred":"explicit"
   })).filter(entry=>entry.name&&entry.value);
   savingBom=true;
   const saveButton=bomField("save");if(saveButton)saveButton.disabled=true;
   bomReport("Saving "+name+"…");
   try{
    const wasEdit=!!editingPart;
    const imageToImport=extractedPictureUrl;
    const address="/api/components?project="+encodeURIComponent(project)+(editingPart?"&id="+encodeURIComponent(editingPart):"");
    const response=await fetch(address,{method:wasEdit?"PUT":"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify(component)});
    const raw=await response.text();let result;
    try{result=JSON.parse(raw)}catch{throw Error("Unexpected save response (HTTP "+response.status+")")}
    if(!response.ok)throw Error(result.error||"Save failed (HTTP "+response.status+")");
    let photoMessage="";
    if(imageToImport&&result.component?.id){
     try{
      const photoResponse=await fetch(partPhotoUrl(result.component.id),{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({imageUrl:imageToImport})});
      const photoData=await photoResponse.json().catch(()=>({}));
      photoMessage=photoResponse.ok?" Product picture added.":" Product picture unavailable; you can upload one manually.";
     }catch{photoMessage=" Product picture unavailable; you can upload one manually."}
    }
    if(wasEdit){
     const linked=nodes.filter(n=>isPartNode(n)&&n.partId===result.component?.id&&n.name!==result.component.name);
     if(linked.length){
      try{await save(nodes.map(n=>linked.some(x=>x.id===n.id)?{...n,name:result.component.name}:n))}
      catch(error){photoMessage+=" Part saved; feature-tree name could not be updated: "+error.message}
     }
    }
    clearBomDraft();
    const editor=bomRoot()?.querySelector(".component-admin");if(editor)editor.open=false;
    bomRoot()?.querySelector(".component-review")?.classList.add("hide");
    bomRoot()?.dispatchEvent(new Event("bom:refresh"));
    await renderWorkspaceParts();
    bomReport(name+(wasEdit?" updated.":" saved to the BOM.")+photoMessage);
    if(wasEdit)returnToEditedPart();
    return true;
   }catch(error){bomReport("Could not save part: "+error.message);return false}
   finally{savingBom=false;if(saveButton)saveButton.disabled=false}
  }
  // BOM-only items share the library/manual/wire wizard, but never create a feature-tree node.
  workspace.querySelector(".workspace-new-part").onclick=async()=>{
   if(savingBom)return;
   if(!window.BSLibraryPartPicker){bomReport("Part library unavailable. Refresh and try again.");return}
   const targetAssembly=selected;
   await window.BSLibraryPartPicker.open({bomOnly:true,onCreate:async payload=>{
    const {wireInfo,...part}=payload;
    let newPart=null,wireId=wireInfo?.wireId||null;
    try{
     if(wireInfo&&!wireId){
      const r=await fetch("/api/wires",{cache:"no-store"}),data=await r.json();
      if(!r.ok)throw Error(data.error||"Unable to load wire library");
      const matched=(data.wires||[]).find(w=>String(w.awg).replace(/\\s*awg/i,"").trim()===String(wireInfo.gauge)&&
       (wireInfo.construction==="solid"?/solid/i.test(w.construction||""):wireInfo.construction==="braided"?/braid/i.test(w.construction||""):/strand/i.test(w.construction||""))&&String(w.insulation||"")===String(wireInfo.insulation||""));
      if(matched)wireId=matched.id;
      else{
       const response=await fetch("/api/wires",{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},
        body:JSON.stringify({name:wireInfo.gauge+" AWG "+wireInfo.construction+" copper (verify)",awg:String(wireInfo.gauge),construction:wireInfo.construction,insulation:wireInfo.insulation,notes:"Created through BOM-only library selection. Verify insulation and terminal compatibility."})});
       const data=await response.json();if(!response.ok)throw Error(data.error||"Could not save wire library material");
       wireId=data.wire.id;
      }
     }
     if(wireId){part.sharedPartRef="wire:"+wireId;if(!part.specifications.some(spec=>spec.name==="Library wire ID"))part.specifications.push({name:"Library wire ID",value:wireId,source:"explicit"})}
     const response=await fetch("/api/components?project="+encodeURIComponent(project),{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({...part,assemblyId:targetAssembly,bomOnly:true})});
     const data=await response.json();if(!response.ok)throw Error(data.error||"Could not create BOM-only part");
     newPart=data.component;
     // A cutting list needs an integer wire count; do not invent a count for unspecified quantities.
     if(wireInfo?.crimp&&wireId&&part.quantityUnit==="pcs"&&Number.isInteger(part.quantity)&&part.quantity>0&&Number.isFinite(wireInfo.mm)&&wireInfo.mm>0){
      const res=await fetch("/api/harness?project="+encodeURIComponent(project)+"&part="+encodeURIComponent(newPart.id),{
       method:"PUT",credentials:"same-origin",headers:{"content-type":"application/json"},
       body:JSON.stringify({cuts:[{wireId,qty:part.quantity,cutLengthMm:wireInfo.mm,stripAmm:0,stripBmm:0,endA:wireInfo.endA,endB:wireInfo.endB}]})
      });
      const data=await res.json();if(!res.ok)throw Error(data.error||"Could not save wire cutting list");
     }
     await renderWorkspaceParts();
     bomReport(newPart.name+" saved to the BOM. Required ferrules are calculated automatically.");
    }catch(error){
     if(newPart)await fetch("/api/components?project="+encodeURIComponent(project)+"&id="+encodeURIComponent(newPart.id),{method:"DELETE",credentials:"same-origin"}).catch(()=>{});
     bomReport("Could not create BOM-only part: "+error.message);
     throw error;
    }
   }});
  };
  workspace.querySelector(".workspace-bom").addEventListener("click",event=>{
   const target=event.target;
   if(!(target instanceof Element))return;
   if(target.closest(".component-add-spec")){
    event.preventDefault();event.stopImmediatePropagation();
    const container=bomRoot()?.querySelector(".component-specs");
    if(!container){bomReport("Specification editor unavailable.");return}
    const row=document.createElement("div");row.className="row component-spec-row";
    const name=document.createElement("input"),value=document.createElement("input"),source=document.createElement("select"),remove=document.createElement("button");
    name.className=value.className="field";name.placeholder="Specification";value.placeholder="Value";
    for(const entry of ["explicit","inferred"]){const option=document.createElement("option");option.value=entry;option.textContent=entry==="explicit"?"Stated in listing":"Inferred";source.append(option)}
    remove.className="btn";remove.type="button";remove.textContent="Remove";remove.onclick=()=>row.remove();
    row.append(name,value,source,remove);container.append(row);
    bomRoot()?.querySelector(".component-review")?.classList.remove("hide");
    name.focus();bomReport("Specification added. Enter the name and value.");
   }else if(target.closest(".component-save")){
    event.preventDefault();event.stopImmediatePropagation();void saveBomDraft();
   }else if(target.closest(".component-cancel")){
    event.preventDefault();event.stopImmediatePropagation();
    const form=bomRoot()?.querySelector(".component-admin");if(form)form.open=false;
    clearBomDraft();bomRoot()?.querySelector(".component-review")?.classList.add("hide");
    bomReport("Part editor collapsed.");
    returnToEditedPart();
   }
  },true);
  const workspaceRoute=()=>location.hash.slice(1).startsWith(project+"/workspace/");
  let workspacePhotoVersion=0;
  async function loadWorkspaceCover(){const id=selected,version=++workspacePhotoVersion,cover=workspace.querySelector(".workspace-cover");cover.replaceChildren();const placeholder=document.createElement("span");placeholder.textContent="No photo yet";cover.append(placeholder);try{const r=await fetch("/api/photos?project="+encodeURIComponent(project)+"&assembly="+encodeURIComponent(id??"__root__"));if(!r.ok)return;const data=await r.json();if(version!==workspacePhotoVersion||selected!==id||!workspaceRoute())return;const photo=(data.photos||[]).find(p=>(p.assembly??null)===id);if(photo){const img=document.createElement("img");img.src=photo.url;img.alt="Assembly photo";cover.replaceChildren(img)}}catch(e){/* cover is optional */}}
  let workspaceLoadVersion=0;
  const workspaceFields=["instructions","procedures","notes"];
  const workspaceStatus=workspace.querySelector(".workspace-status");
  const workspaceUrl=()=>"/api/workspace?project="+encodeURIComponent(project)+"&assembly="+encodeURIComponent(selected??"__root__");
  async function loadWorkspace(){
   const version=++workspaceLoadVersion,url=workspaceUrl();workspaceStatus.textContent="Loading…";
   try{const res=await fetch(url,{credentials:"same-origin",cache:"no-store"});const data=await res.json();if(!res.ok)throw Error(data.error||"Unable to load workspace");
    if(version!==workspaceLoadVersion||url!==workspaceUrl())return;
    for(const name of workspaceFields)workspace.querySelector(".workspace-"+name).value=data.workspace?.[name]||"";
    assemblyResourcePicker?.setData(data.workspace?.resources,adminAuthenticated);
    assemblyRecipe?.setData(data.workspace);
    assemblyExtras.setData(data.workspace);
    workspaceStatus.textContent="";
   }catch(e){workspaceStatus.textContent=e.message}
  }
  workspace.querySelector(".workspace-save").onclick=async()=>{
   if(!adminAuthenticated){workspaceStatus.textContent="Use Admin login at the top of the website to save.";return}
   const button=workspace.querySelector(".workspace-save"),url=workspaceUrl(),data={};
   for(const name of workspaceFields)data[name]=workspace.querySelector(".workspace-"+name).value;
   data.resources=assemblyResourcePicker?.getData();data.experiments=assemblyExtras.getExperiments();data.recipe=assemblyRecipe?.getData()||[];
   button.disabled=true;workspaceStatus.textContent="Saving…";
   try{const res=await fetch(url,{method:"PUT",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify(data)});const result=await res.json();if(!res.ok)throw Error(result.error||"Save failed (HTTP "+res.status+")");workspaceStatus.textContent="Saved."}
   catch(e){workspaceStatus.textContent=e.message}finally{button.disabled=false}
  };
  function openWorkspace(){history.pushState(null,"","#"+project+"/workspace/"+encodeURIComponent(selected??"__root__"));showAssemblyPage();window.scrollTo(0,0)}
  workspace.querySelector(".workspace-back").onclick=()=>{history.pushState(null,"",selected===null?"#"+project:"#"+project+"/assembly/"+encodeURIComponent(selected));showAssemblyPage();window.scrollTo(0,0)};
  async function showAssemblyPage(){
   const version=++detailVersion;
   const isAssembly=selected!==null;
   const bom=main.querySelector(".component-section")||detail.querySelector(".component-section")||workspace.querySelector(".component-section");
   if(bom){workspace.querySelector(".workspace-bom-mount").append(bom)}
   const inPart=!!partRoute();partWorkspace.classList.toggle("hide",!inPart);if(inPart){void showPartWorkspace();return;}
   const inWorkspace=workspaceRoute();workspace.classList.toggle("hide",!inWorkspace);detail.classList.toggle("hide",!isAssembly||inWorkspace);main.classList.toggle("hide",isAssembly);if(inWorkspace){workspace.querySelector(".workspace-title").textContent=selected===null?title:(nodes.find(n=>n.id===selected)?.name||"Assembly");loadWorkspaceCover();loadWorkspace();void assemblyDrawingPanel?.load(project,"assembly",selected??"__root__");void renderWorkspaceParts();if(bom){const details=bom.querySelector("details");if(details)details.open=true;bom.dispatchEvent(new Event("assemblychange"));}return;}
   if(!isAssembly){await loadDescription(null,main,main.querySelector(".root-photo-status"));await renderRootPhotos();return;}
   const node=nodes.find(n=>n.id===selected);if(!node)return;
   const assemblyId=selected;
   detail.querySelector(".assembly-detail-title").textContent=node.name;


   const path=[node.name];let cursor=node;while(cursor.parentId){cursor=nodes.find(n=>n.id===cursor.parentId);if(!cursor)break;path.unshift(cursor.name)}
   detail.querySelector(".assembly-breadcrumb").textContent=[title,...path].join(" / ");
   detailStatus.textContent="";
   await loadDescription(assemblyId,detail,detailStatus);
   await detailPhotoController.refresh();

  }
  detail.querySelector(".assembly-back").onclick=()=>{selected=null;render();notify();history.pushState(null,"","#"+project);window.scrollTo(0,0)};
  // One description loader/saver for the same tile at every depth.
  async function loadDescription(id,container,message){
   const editor=container.querySelector(".assembly-description-edit");
   const display=container.querySelector(".assembly-description");
   const input=container.querySelector(".assembly-description-input");
   editor.classList.toggle("hide",!adminAuthenticated);
   container.querySelector(".assembly-photo-admin").classList.toggle("hide",!adminAuthenticated);
   display.textContent="Loading…";
   const url="/api/tree?project="+encodeURIComponent(project)+"&assembly="+encodeURIComponent(id??"__root__");
   try{
    const r=await fetch(url),data=await r.json();
    if(!r.ok)throw Error(data.error||"Unable to load description");
    if(id!==selected)return;
    display.textContent=data.page?.description||"";
    input.value=data.page?.description||"";
    display.classList.toggle("hide",adminAuthenticated);
   }catch(e){display.textContent="Unable to load description: "+e.message}
  }
  function bindDescriptionSave(container,getId,message){
   container.querySelector(".assembly-description-save").onclick=async()=>{
    const id=getId();
    message.textContent="Saving…";
    try{
     const r=await fetch("/api/tree?project="+encodeURIComponent(project)+"&assembly="+encodeURIComponent(id??"__root__"),{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({description:container.querySelector(".assembly-description-input").value})});
     const data=await r.json();
     if(!r.ok)throw Error(data.error||"Save failed");
     message.textContent="Saved.";
     await loadDescription(id,container,message);
    }catch(e){message.textContent=e.message}
   };
  }
  bindDescriptionSave(main,()=>null,main.querySelector(".root-photo-status"));
  bindDescriptionSave(detail,()=>selected,detailStatus);
  // One controller for every project tile, including the root and nested assemblies.
  function createPhotoController(tile, getAssemblyId, statusElement){
   const gallery=tile.querySelector(".assembly-photos");
   const admin=tile.querySelector(".assembly-photo-admin");
   const input=tile.querySelector(".assembly-photo-input");
   const zone=tile.querySelector(".assembly-photo-zone");
   const caption=tile.querySelector(".assembly-photo-caption");
   const pick=tile.querySelector(".assembly-photo-pick");
   let busy=false;
   const report=message=>{statusElement.textContent=message};
   const currentId=()=>getAssemblyId();
   async function refresh(){
    const id=currentId();
    admin.classList.toggle("hide",!adminAuthenticated);
    const url="/api/photos?project="+encodeURIComponent(project)+(id?"&assembly="+encodeURIComponent(id):"");
    try{
     const r=await fetch(url),data=await r.json();
     if(!r.ok)throw Error(data.error||"Unable to load photos");
     if(id!==currentId())return;
     const photos=(data.photos||[]).filter(p=>id?p.assembly===id:!p.assembly);
     const name=id?nodes.find(n=>n.id===id)?.name||title:title;
     gallery.replaceChildren(makeAssemblyPhotoStage(photos,name,()=>input.click(),async p=>{
      if(!p||!confirm("Delete this photo?"))return;
      try{
       const r=await fetch("/api/photos?id="+encodeURIComponent(p.id),{method:"DELETE",credentials:"same-origin"});
       if(!r.ok)throw Error("Delete failed (HTTP "+r.status+")");
       await refresh();
      }catch(e){report(e.message)}
     }));
    }catch(e){report(e.message)}
   }
   async function upload(file){
    if(!file||busy)return;
    const id=currentId();
    if(!adminAuthenticated){report("Sign in as administrator to upload.");return}
    if(file.size>10*1024*1024){report("Maximum photo size: 10 MB.");return}
    const type=file.type||({jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp",gif:"image/gif",heic:"image/heic",heif:"image/heif"}[file.name.split(".").pop().toLowerCase()]||"");
    if(!type){report("Choose an image file.");return}
    busy=true;zone.setAttribute("aria-busy","true");report("Uploading photo…");
    try{
     const headers={"content-type":type,"x-photo-project":project,"x-photo-caption":encodeURIComponent(caption.value),"x-photo-name":encodeURIComponent(file.name)};
     if(id)headers["x-photo-assembly"]=id;
     const r=await fetch("/api/photos",{method:"POST",credentials:"same-origin",headers,body:file});
     const raw=await r.text();let data;try{data=JSON.parse(raw)}catch{data={error:raw.slice(0,160)||"Unexpected server response"}}
     if(!r.ok)throw Error((data.error||"Upload failed")+" (HTTP "+r.status+")");
     input.value="";caption.value="";
     await refresh();report("Photo uploaded.");
    }catch(e){report(e.message||"Upload failed.")}
    finally{busy=false;zone.removeAttribute("aria-busy")}
   }
   pick.onclick=()=>input.click();
   input.onchange=()=>upload(input.files?.[0]);
   // The zone is hidden in the modern photo-first layout; bind drops to the visible stage.
   const dropTarget=tile.querySelector(".assembly-unified-photo");
   if(dropTarget){
    dropTarget.addEventListener("dragover",event=>{if(!adminAuthenticated||!event.dataTransfer.types.includes("Files"))return;event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect="copy";dropTarget.classList.add("is-dragover")});
    dropTarget.addEventListener("dragleave",event=>{if(!dropTarget.contains(event.relatedTarget))dropTarget.classList.remove("is-dragover")});
    dropTarget.addEventListener("drop",event=>{if(!adminAuthenticated)return;event.preventDefault();event.stopPropagation();dropTarget.classList.remove("is-dragover");void upload(event.dataTransfer.files?.[0])});
   }
   zone.ondragover=e=>{e.preventDefault();zone.classList.add("drag-over")};
   zone.ondragleave=()=>zone.classList.remove("drag-over");
   zone.ondrop=e=>{e.preventDefault();zone.classList.remove("drag-over");void upload(e.dataTransfer.files?.[0])};
   return {refresh};
  }
  // A single explicit entry point on the large assembly photo, not on child tiles.
  function addWorkspaceEntry(container){
   const gallery=container.querySelector(".assembly-photos");
   if(!gallery)return;
   const install=()=>{
    const stage=gallery.querySelector(".assembly-photo-stage");
    if(!stage||stage.querySelector(".assembly-open-workspace"))return;
    const btn=document.createElement("button");btn.type="button";btn.className="assembly-open-workspace";btn.textContent="Build instructions →";btn.title="Open build instructions, procedures and notes";
    btn.onclick=e=>{e.stopPropagation();openWorkspace()};
    stage.append(btn);
   };
   new MutationObserver(install).observe(gallery,{childList:true});install();
  }
  addWorkspaceEntry(detail);
  addWorkspaceEntry(main);
  const rootPhotoController=createPhotoController(main,()=>null,main.querySelector(".root-photo-status"));
  const detailPhotoController=createPhotoController(detail,()=>selected,detailStatus);
  async function renderRootPhotos(){await rootPhotoController.refresh()}
  function renderTiles(){
   const target=(selected===null?main:detail).querySelector(".assembly-workflow");if(!target)return;
   target.replaceChildren();const children=nodes.filter(n=>n.parentId===selected);
   
   if(!children.length)return;
   const grid=document.createElement("div");grid.className="assembly-tile-grid";
   const sorted=[...children];
   for(const n of sorted){
    const tile=document.createElement("article");tile.className="assembly-tile";
    const cover=document.createElement("div");cover.className="assembly-tile-cover";cover.textContent="▧";const overlay=document.createElement("span");overlay.className="assembly-tile-overlay";overlay.textContent=n.name;cover.append(overlay);tile.append(cover);if(isPartNode(n)){const img=document.createElement("img");img.src=partPhotoUrl(n.partId);img.alt="";img.onerror=()=>{img.src=missingPicture;img.onerror=null};cover.replaceChildren(img,overlay)}
    else fetch("/api/photos?project="+project+"&assembly="+encodeURIComponent(n.id)).then(r=>r.json()).then(data=>{if(!tile.isConnected||!data.photos?.length)return;const img=document.createElement("img");img.src=data.photos[0].url;img.alt="";cover.replaceChildren(img,overlay)}).catch(()=>{});
    const stage=document.createElement("span");stage.className="assembly-tile-stage";stage.textContent=isPartNode(n)?"Part":n.stage==="integration"?"Integration":n.dependsOn?.length?"Dependent":"";
    const button=document.createElement("button");button.type="button";button.className="assembly-tile-title";button.textContent=n.name;const openAssembly=()=>{if(isPartNode(n)){openTreePart(n);return}selected=n.id;expanded.add(n.parentId);render();history.pushState(null,"","#"+project+"/assembly/"+encodeURIComponent(n.id));notify();window.scrollTo(0,0)};button.onclick=openAssembly;cover.setAttribute("role","button");cover.tabIndex=0;cover.setAttribute("aria-label","Open "+n.name);cover.onclick=openAssembly;cover.title="Open "+n.name+" overview";cover.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openAssembly()}};
    tile.append(stage,button);
    if(n.dependsOn?.length){const deps=document.createElement("p");deps.className="assembly-tile-deps";deps.textContent="Requires: "+n.dependsOn.map(id=>nodes.find(x=>x.id===id)?.name||"Unknown").join(", ");tile.append(deps)}
    if(adminAuthenticated&&!isPartNode(n)){const edit=document.createElement("button");edit.type="button";edit.className="btn assembly-tile-edit";edit.textContent="Order";edit.onclick=async()=>{const options=nodes.filter(x=>x.id!==n.id);const help=options.map((x,i)=>(i+1)+". "+x.name).join("\\n");const answer=prompt("Enter prerequisite assembly numbers, separated by commas. Leave blank for independent work.\\n"+help,(n.dependsOn||[]).map(id=>options.findIndex(x=>x.id===id)+1).join(","));if(answer===null)return;const indices=answer.trim()?answer.split(",").map(v=>Number(v.trim())-1):[];if(indices.some(i=>!Number.isInteger(i)||i<0||i>=options.length)){status.textContent="Invalid prerequisite numbers.";return}const deps=[...new Set(indices.map(i=>options[i].id))];const stage=prompt("Work type: independent, sequential, or integration",n.stage||"independent");if(stage===null)return;try{await save(nodes.map(x=>x.id===n.id?{...x,dependsOn:deps,stage:stage.trim().toLowerCase()}:x))}catch(e){status.textContent=e.message}};tile.append(edit)}
    if(adminAuthenticated&&!isPartNode(n)){
     const pick=document.createElement("button");pick.type="button";pick.className="btn assembly-tile-photo-button";pick.textContent="＋ Photo";pick.title="Upload a photo to "+n.name;
     const input=document.createElement("input");input.type="file";input.accept="image/*,.heic,.heif";input.hidden=true;
     pick.onclick=()=>input.click();
     input.onchange=async()=>{
      const file=input.files?.[0];if(!file)return;
      const type=file.type||({jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp",gif:"image/gif",heic:"image/heic",heif:"image/heif"}[file.name.split(".").pop().toLowerCase()]||"");
      if(!type||file.size>10*1024*1024){status.textContent="Choose an image under 10 MB.";input.value="";return}
      pick.disabled=true;pick.textContent="Uploading…";
      try{
       const response=await fetch("/api/photos",{method:"POST",credentials:"same-origin",headers:{"content-type":type,"x-photo-project":project,"x-photo-assembly":n.id,"x-photo-caption":"","x-photo-name":encodeURIComponent(file.name)},body:file});
       const data=await response.json();
       if(!response.ok)throw Error(data.error||"Upload failed (HTTP "+response.status+")");
       const img=document.createElement("img");img.src="/api/photo?id="+encodeURIComponent(data.id);img.alt=n.name;cover.replaceChildren(img,overlay);
       status.textContent="Photo added to "+n.name+".";
      }catch(error){status.textContent="Photo upload failed: "+error.message}
      finally{pick.disabled=false;pick.textContent="＋ Photo";input.value=""}
     };
     tile.append(pick,input);
    }
    grid.append(tile)
   }target.append(grid)
  }
  root.addEventListener("openpart",()=>{void showAssemblyPage()});
  root.addEventListener("openassembly",e=>{const id=e.detail;if(id==="__root__"){selected=null;render();notify();return}if(!nodes.some(n=>n.id===id))return;selected=id;let cursor=nodes.find(n=>n.id===id);while(cursor){expanded.add(cursor.parentId);cursor=nodes.find(n=>n.id===cursor.parentId)}render();notify()});
  const validSelection=()=>selected===null||nodes.some(n=>n.id===selected);
  const notify=()=>{assemblySelections[project]=selected;assemblyTreeSnapshots[project]={nodes:[...nodes],title};showAssemblyPage();renderTiles();view.querySelectorAll(".component-section").forEach(section=>section.dispatchEvent(new Event("assemblychange")));};
  async function load(){try{const r=await fetch("/api/tree?project="+project),data=await r.json();if(!r.ok)throw Error(data.error);nodes=data.nodes||[];if(!validSelection())selected=null;const deepLink=decodeURIComponent(location.hash.slice(1)).match(new RegExp("^"+project+"/(?:assembly|workspace)/([^/]+)$"));if(deepLink&&(deepLink[1]==="__root__"||nodes.some(n=>n.id===deepLink[1])))selected=deepLink[1]==="__root__"?null:deepLink[1];render();notify()}catch(e){status.textContent="Feature tree unavailable: "+e.message}}
  async function save(next){const r=await fetch("/api/tree?project="+project,{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({nodes:next})});const data=await r.json();if(!r.ok)throw Error(data.error||"Save failed");nodes=next;render();notify()}
  // Tree ordering is the order of node records; moving a node keeps its permanent ID.
  const siblings=parent=>nodes.filter(n=>n.parentId===parent);
  async function moveSelected(direction){
   if(selected===null){status.textContent="Select a subassembly first.";return}
   const node=nodes.find(n=>n.id===selected);if(!node)return;
   const group=siblings(node.parentId),position=group.findIndex(n=>n.id===selected),other=group[position+direction];
   if(!other){status.textContent=direction<0?"Already first in this assembly.":"Already last in this assembly.";return}
   const a=nodes.findIndex(n=>n.id===node.id),b=nodes.findIndex(n=>n.id===other.id);
   const next=[...nodes];[next[a],next[b]]=[next[b],next[a]];
   try{await save(next);status.textContent="Subassembly reordered."}catch(e){status.textContent=e.message}
  }
  const wouldCycle=(id,newParent)=>{
   let cursor=newParent;while(cursor!==null){if(cursor===id)return true;cursor=nodes.find(n=>n.id===cursor)?.parentId??null}return false
  };
  async function reparent(id,newParent){
   const node=nodes.find(n=>n.id===id);
   if(!node)return;
   if(newParent===id||wouldCycle(id,newParent)||isPartNode(nodes.find(n=>n.id===newParent)))throw Error("Cannot move an assembly inside a part or one of its descendants.");
   if(node.parentId===newParent)return;
   const next=nodes.map(n=>n.id===id?{...n,parentId:newParent}:n);
   await save(next);expanded.add(newParent);
   if(isPartNode(node)){
    let warning="";
    try{
     const response=await fetch("/api/components?project="+encodeURIComponent(project),{cache:"no-store"});
     const data=await response.json();if(!response.ok)throw Error(data.error||"Could not load part");
     const part=data.components?.find(item=>item.id===node.partId);if(!part)throw Error("Linked BOM part not found");
     const update=await fetch("/api/components?project="+encodeURIComponent(project)+"&id="+encodeURIComponent(part.id),{method:"PUT",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({...part,assemblyId:newParent})});
     const result=await update.json();if(!update.ok)throw Error(result.error||"Unable to update BOM parent");
    }catch(error){warning=" Tree moved, but BOM parent could not be updated: "+error.message}
    openTreePart({...node,parentId:newParent});status.textContent="Part moved."+warning;
   }else{selected=id;render();notify();status.textContent="Subassembly moved."}
  }
  async function moveToChoice(){
   if(selected===null){status.textContent="Select a subassembly first.";return}
   const options=[{id:null,name:"Top-level project"},...nodes.filter(n=>!isPartNode(n)&&n.id!==selected&&!wouldCycle(selected,n.id))];
   const help=options.map((n,i)=>(i+1)+". "+n.name).join("\\n");
   const answer=prompt("Move the selected subassembly into:\\n"+help);
   if(answer===null)return;
   const choice=Number(answer)-1;
   if(!Number.isInteger(choice)||choice<0||choice>=options.length){status.textContent="Enter a number from the list.";return}
   try{await reparent(selected,options[choice].id)}catch(e){status.textContent=e.message}
  }
  const reorderControls=document.createElement("span");reorderControls.className="assembly-reorder-controls";
  for(const [label,title,action] of [["↑","Move up",()=>moveSelected(-1)],["↓","Move down",()=>moveSelected(1)],["Move to…","Change parent assembly",moveToChoice]]){
   const button=document.createElement("button");button.type="button";button.className="btn assembly-move-button";button.textContent=label;button.title=title;button.setAttribute("aria-label",title);button.onclick=action;reorderControls.append(button)
  }
  controls.append(reorderControls);
  function render(){nodesEl.replaceChildren();controls.classList.toggle("hide",!adminAuthenticated);const row=(node,depth)=>{
   const id=node?.id??null,children=nodes.filter(n=>n.parentId===id),el=document.createElement("div");el.className="assembly-node"+(selected===id?" selected":"");el.style.paddingLeft=(depth*17+3)+"px";
   const expand=document.createElement("button");expand.type="button";expand.className="assembly-expander";expand.textContent=children.length?(expanded.has(id)?"▾":"▸"):" ";expand.setAttribute("aria-label",expanded.has(id)?"Collapse":"Expand");expand.onclick=()=>{expanded.has(id)?expanded.delete(id):expanded.add(id);render()};
   const name=document.createElement("button");name.type="button";name.className="assembly-name";name.textContent=node?(isPartNode(node)?"🔩  ":"📦  ")+node.name:"🟨  "+title;
   if(isPartNode(node)&&partRoute()===node.partId)el.classList.add("selected");name.onclick=()=>{if(isPartNode(node)){openTreePart(node);return}selected=id;history.pushState(null,"",id===null?"#"+project:"#"+project+"/assembly/"+encodeURIComponent(id));render();notify();window.scrollTo(0,0)};
   el.append(expand,name);
   if(node&&adminAuthenticated){
    el.draggable=true;el.title="Drag to reorder or drop into another assembly";
    el.ondragstart=event=>{event.dataTransfer.setData("text/plain",node.id);event.dataTransfer.effectAllowed="move";el.classList.add("assembly-dragging")};
    el.ondragend=()=>el.classList.remove("assembly-dragging");
    el.ondragover=event=>{const dragged=Array.from(event.dataTransfer.types).includes("text/plain");if(!dragged)return;event.preventDefault();el.classList.add("assembly-drop-target");event.dataTransfer.dropEffect="move"};
    el.ondragleave=()=>el.classList.remove("assembly-drop-target");
    el.ondrop=async event=>{
     event.preventDefault();event.stopPropagation();el.classList.remove("assembly-drop-target");
     const sourceId=event.dataTransfer.getData("text/plain"),source=nodes.find(n=>n.id===sourceId);
     if(!source||source.id===node.id)return;
     try{
      // Dropping on a sibling's upper/lower edge reorders it; dropping in the middle nests it.
      const rect=el.getBoundingClientRect(),fraction=(event.clientY-rect.top)/rect.height;
      if(source.parentId===node.parentId&&(fraction<.25||fraction>.75)){
       const next=[...nodes],from=next.findIndex(n=>n.id===source.id);
       const item=next.splice(from,1)[0];let to=next.findIndex(n=>n.id===node.id);
       if(fraction>.75)to++;next.splice(to,0,item);await save(next);status.textContent="Subassembly reordered.";
      }else await reparent(source.id,node.id);
     }catch(e){status.textContent=e.message}
    };
   }else if(!node&&adminAuthenticated){
    el.ondragover=event=>{event.preventDefault();el.classList.add("assembly-drop-target")};
    el.ondragleave=()=>el.classList.remove("assembly-drop-target");
    el.ondrop=async event=>{event.preventDefault();el.classList.remove("assembly-drop-target");const sourceId=event.dataTransfer.getData("text/plain");if(nodes.some(n=>n.id===sourceId))try{await reparent(sourceId,null)}catch(e){status.textContent=e.message}};
   }
   nodesEl.append(el);
   if(expanded.has(id))children.forEach(child=>row(child,depth+1));
  };row(null,0);status.textContent="";renderTiles()}
  const newPartButton=document.createElement("button");newPartButton.type="button";newPartButton.className="btn assembly-add-part";newPartButton.textContent="+ Part";newPartButton.title="Create a BOM part inside the selected assembly";
  controls.prepend(newPartButton);
  newPartButton.onclick=async()=>{
   const parent=nodes.find(node=>node.id===selected);
   if(isPartNode(parent)){status.textContent="Select an assembly, not a part, before adding a new part.";return}
   if(!window.BSLibraryPartPicker){status.textContent="Part library is still loading. Refresh and try again.";return}
   await window.BSLibraryPartPicker.open({onCreate:async payload=>{
    newPartButton.disabled=true;status.textContent="Creating part…";
    let newPart=null;
    try{
     const info=payload.wireInfo||null;
     let wireId=info?.wireId||null;
     if(info&&!wireId){
      const listResponse=await fetch("/api/wires",{cache:"no-store"}),listData=await listResponse.json();
      if(!listResponse.ok)throw Error(listData.error||"Unable to load wire library");
      const existing=(listData.wires||[]).find(w=>String(w.awg).replace(/\\s*awg/i,"").trim()===String(info.gauge)&&
       (info.construction==="solid"?/solid/i.test(w.construction||""):info.construction==="braided"?/braid/i.test(w.construction||""):/strand/i.test(w.construction||""))&&String(w.insulation||"")===String(info.insulation||""));
      if(existing)wireId=existing.id;
      else{
       const label=info.gauge+" AWG "+info.construction+" copper (construction to verify)";
       const newWire=await fetch("/api/wires",{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({name:label,awg:String(info.gauge),construction:info.construction,insulation:info.insulation,notes:"Created through feature-tree part selection. Verify conductor material, insulation and crimp compatibility before use."})});
       const wireData=await newWire.json();if(!newWire.ok)throw Error(wireData.error||"Unable to save wire material");
       wireId=wireData.wire.id;
      }
     }
     const {wireInfo,...part}=payload;
     if(wireId){part.sharedPartRef="wire:"+wireId;part.specifications.push({name:"Library wire ID",value:wireId,source:"explicit"})}
     const res=await fetch("/api/components?project="+encodeURIComponent(project),{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({assemblyId:selected,...part})});
     const data=await res.json();if(!res.ok)throw Error(data.error||"Unable to create part");
     newPart=data.component;
     if(info?.crimp&&wireId){
      const harnessResponse=await fetch("/api/harness?project="+encodeURIComponent(project)+"&part="+encodeURIComponent(newPart.id),{
       method:"PUT",credentials:"same-origin",headers:{"content-type":"application/json"},
       body:JSON.stringify({cuts:[{wireId,qty:part.quantity,cutLengthMm:info.mm,endA:info.endA,endB:info.endB,stripAmm:0,stripBmm:0}]})
      });
      const harnessData=await harnessResponse.json();
      if(!harnessResponse.ok)throw Error(harnessData.error||"Unable to save harness cutting list");
     }
     const next=[...nodes,{id:crypto.randomUUID(),kind:"part",partId:newPart.id,name:newPart.name,parentId:selected}];
     await save(next);expanded.add(selected);
     openTreePart(next[next.length-1]);
     status.textContent="Part added to the feature tree and BOM. Required ferrules are calculated automatically.";
    }catch(error){
     if(newPart)await fetch("/api/components?project="+encodeURIComponent(project)+"&id="+encodeURIComponent(newPart.id),{method:"DELETE",credentials:"same-origin"}).catch(()=>{});
     status.textContent="Could not add part: "+error.message;throw error;
    }finally{newPartButton.disabled=false}
   }});
  };
  root.querySelector(".assembly-add").onclick=async()=>{if(isPartNode(nodes.find(n=>n.id===selected))){status.textContent="Select an assembly first; parts cannot contain children.";return}const name=prompt("New subassembly name");if(!name?.trim())return;const id=crypto.randomUUID();try{await save([...nodes,{id,name:name.trim(),parentId:selected}]);expanded.add(selected);selected=id;render();notify()}catch(e){status.textContent=e.message}};
  root.querySelector(".assembly-rename").onclick=async()=>{if(selected===null){status.textContent="Select a subassembly to rename.";return}const node=nodes.find(n=>n.id===selected),name=prompt("Rename subassembly",node.name);if(!name?.trim())return;try{await save(nodes.map(n=>n.id===selected?{...n,name:name.trim()}:n))}catch(e){status.textContent=e.message}};
  root.querySelector(".assembly-remove").onclick=async()=>{if(selected===null){status.textContent="Select a subassembly to delete.";return}const node=nodes.find(n=>n.id===selected);if(!confirm("Delete "+node.name+" and its nested subassemblies? Existing BOM components will remain in the project but may become unassigned."))return;const removed=new Set([selected]);let changed=true;while(changed){changed=false;for(const n of nodes)if(removed.has(n.parentId)&&!removed.has(n.id)){removed.add(n.id);changed=true}}try{await save(nodes.filter(n=>!removed.has(n.id)));selected=null;render();notify()}catch(e){status.textContent=e.message}};
  load();
 })
}
setupAssemblyTrees();

function setupComponents(){
 document.querySelectorAll("[data-components]").forEach(root=>{
 const project=root.dataset.components,list=root.querySelector(".component-list"),status=root.querySelector(".component-status"),review=root.querySelector(".component-review"),specs=root.querySelector(".component-specs");

 // The old markup nested the part list inside a collapsible <details>.
 // Keep the saved parts in a permanent visible region, independent of the editor.
 if(["launcher","linear","robot"].includes(project)){
  root.prepend(list);
  list.classList.add("bom-visible-parts");
 }
 const field=name=>root.querySelector(".component-"+name);
 const say=message=>{status.textContent=message;status.hidden=false;status.style.display="block";status.setAttribute("aria-live","polite");};
 function specRow(name="",value="",source="explicit"){
  const row=document.createElement("div");row.className="row component-spec-row";
  const a=document.createElement("input"),b=document.createElement("input"),c=document.createElement("select"),del=document.createElement("button");
  a.className=b.className="field";a.placeholder="Specification";b.placeholder="Value";a.value=name;b.value=value;
  for(const opt of ["explicit","inferred"]){const el=document.createElement("option");el.value=opt;el.textContent=opt==="explicit"?"Stated in listing":"Inferred";c.append(el)}c.value=source;
  del.className="btn";del.type="button";del.textContent="Remove";del.onclick=()=>row.remove();row.append(a,b,c,del);specs.append(row)
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
     if(adminAuthenticated){
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
  for(const name of ["name","manufacturer","model","category","supplier","asin"]){const control=field(name);if(control)control.value=""}
  field("description").value="";if(field("quantity"))field("quantity").value="";if(field("historical-price"))field("historical-price").value="";if(field("historical-price-date"))field("historical-price-date").value="";
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
  say(message);feedback.textContent=message;
  const workspaceStatus=root.closest(".assembly-workspace-page")?.querySelector(".workspace-status");
  if(workspaceStatus)workspaceStatus.textContent=message;
 };
 if(importPanel){
  const manual=document.createElement("button");manual.type="button";manual.className="btn component-manual";manual.textContent="Enter manually";
  manual.onclick=()=>{review.classList.remove("hide");extractStatus("Enter the part details below, then save.")};
  feedback.after(manual);
  const summary=importPanel.querySelector("summary");if(summary)summary.textContent="Add part to BOM";
 }
 extract.hidden=false;extract.type="button";
 extract.onclick=async event=>{
  event.preventDefault();
  extractStatus("Extract clicked — checking input…");
  const value=description.value.trim();
  if(!value){extractStatus("Paste a product description or public HTTPS product URL first.");return}
  if(!adminAuthenticated){extractStatus("Sign in using Admin login, then try extracting.");return}
  extract.disabled=true;
  extractStatus("Requesting product specifications…");
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
   specs.replaceChildren();for(const spec of component.specifications||[])specRow(spec.name,spec.value,spec.source);
   review.classList.remove("hide");extractStatus("Specifications extracted. Review them, then select Save component.");
  }catch(e){review.classList.remove("hide");extractStatus("Extraction failed: "+(e.name==="AbortError"?"The service did not respond within 20 seconds":e.message)+". You can enter this part manually.")}
  finally{extract.disabled=false}
 };
 field("add-spec").onclick=()=>specRow();
 field("save").onclick=async()=>{
  const priceInput=field("historical-price")?.value.trim()||"";
  const dateInput=field("historical-price-date")?.value||"";
  const rawQuantity=field("quantity")?.value.trim()??"";
  const quantity=rawQuantity===""?null:Number(rawQuantity);
  if(quantity!==null&&(!Number.isFinite(quantity)||quantity<=0||quantity>10000000)){say("Quantity must be a positive number or left blank.");return}
  const c={assemblyId:assemblySelections[project]??null,quantity,quantityUnit:field("quantity-unit")?.value??"pcs",
   historicalPrice:priceInput===""?null:Number(priceInput),historicalPriceDate:priceInput===""?null:(dateInput||new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10))};for(const name of ["name","manufacturer","model","category","supplier","asin"])c[name]=field(name).value.trim();
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


window.BSResources?.init();
renderNotes();renderDrafts();renderTiles();navigate(location.hash.slice(1)||"home");
