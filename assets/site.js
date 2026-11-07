
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
function navigate(page){const route=page.match(/^([a-z]+)\/(?:assembly|workspace)\/([^/]+)$/);if(route)page=route[1];if(page==="challenge"||page==="workshop")page="launcher";if(page==="community")page="learn";if(!document.getElementById(page))page="home";document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===page));document.querySelectorAll("nav button").forEach(b=>b.classList.toggle("active",b.dataset.nav===page));if(!route||location.hash.slice(1)!==route[0])location.hash=page;window.scrollTo({top:0,behavior:"instant"});if(page==="learn")renderTiles()}
document.addEventListener("click",e=>{const nav=e.target.closest("[data-nav]");if(nav){e.preventDefault();navigate(nav.dataset.nav)}const topic=e.target.closest("[data-topic]");if(topic)openTile(topic.dataset.topic);const project=e.target.closest("[data-project]");if(project)navigate(project.dataset.project)});
window.addEventListener("hashchange",()=>{const hash=location.hash.slice(1)||"home";navigate(hash);const match=hash.match(/^([a-z]+)\/(?:assembly|workspace)\/([^/]+)$/);if(match){const root=document.querySelector('[data-assembly-tree="'+match[1]+'"]');root?.dispatchEvent(new CustomEvent("openassembly",{detail:decodeURIComponent(match[2])}))}});
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

let adminAuthenticated=false;
const photoToken=()=>adminAuthenticated?"session":"";
const adminButton=document.getElementById("adminLoginButton"),adminDialog=document.getElementById("adminDialog"),adminForm=document.getElementById("adminLoginForm"),adminStatus=document.getElementById("adminLoginStatus");
function refreshAdminUI(){adminButton.textContent=adminAuthenticated?"Log out":"Admin login";document.querySelectorAll(".photo-admin,.component-section").forEach(el=>{el.querySelectorAll(".photo-upload,.component-save").forEach(control=>control.hidden=!adminAuthenticated);el.querySelectorAll(".component-extract").forEach(control=>control.hidden=false)});}
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
async function render(){try{const res=await fetch("/api/photos?project="+encodeURIComponent(project));const data=await res.json();if(!res.ok){status.textContent=data.error||"Photos unavailable.";grid.replaceChildren();return}grid.replaceChildren();for(const p of data.photos){const card=document.createElement("div");card.className="photo-card";const link=document.createElement("a");link.href=p.url;link.target="_blank";link.rel="noopener noreferrer";const img=document.createElement("img");img.src=p.url;img.alt=p.caption||p.name;img.loading="lazy";link.append(img);card.append(link);if(p.caption){const label=document.createElement("p");label.textContent=p.caption;card.append(label)}if(photoToken()){const del=document.createElement("button");del.className="btn photo-delete";del.textContent="Delete";del.addEventListener("click",async()=>{if(!confirm("Delete this photo from the website?"))return;const res=await fetch("/api/photos?id="+encodeURIComponent(p.id),{method:"DELETE",headers:{authorization:"Bearer "+photoToken()}});const data=await res.json();if(!res.ok){say(data.error||"Delete failed");return}await render()});card.append(del)}grid.append(card)}if(root.closest(".assembly-main-tile")){let active=0;const cards=[...grid.children];const update=()=>cards.forEach((c,i)=>c.hidden=i!==active);update();if(cards.length>1){for(const [dir,mark] of [[-1,"‹"],[1,"›"]]){const arrow=document.createElement("button");arrow.type="button";arrow.className="assembly-main-arrow "+(dir<0?"previous":"next");arrow.textContent=mark;arrow.setAttribute("aria-label",dir<0?"Previous photo":"Next photo");arrow.onclick=()=>{active=(active+dir+cards.length)%cards.length;update()};grid.append(arrow)}}}status.textContent=data.photos.length?data.photos.length+" photo"+(data.photos.length===1?"":"s"):(data.truncated?"More photos available.":"No photos yet.")}catch(e){status.textContent="Photos unavailable. Check the Cloudflare R2 setup."}}
async function uploadSelected(){const file=selectedFile;if(!file){say("Choose a photo first.");return}if(!adminAuthenticated){say("Log in using Admin login at the top of the website.");return}if(file.size>10*1024*1024){say("Choose a photo under 10 MB.");return}zone.setAttribute("aria-busy","true");say("Uploading…");try{const res=await fetch("/api/photos",{method:"POST",headers:{"authorization":"Bearer "+photoToken(),"content-type":file.type||"application/octet-stream","x-photo-project":project,"x-photo-caption":encodeURIComponent(caption.value).slice(0,600),"x-photo-name":encodeURIComponent(file.name).slice(0,300)},body:file});const data=await res.json();if(!res.ok){if(res.status===401){adminAuthenticated=false;refreshAdminUI()}say(res.status===401?"Session expired. Log in again using Admin login.":data.error||"Upload failed.");return}fileInput.value="";selectedFile=null;preview.classList.add("hide");if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=null;caption.value="";await render();say("Photo uploaded.")}catch(e){say("Upload failed. Check your connection and Cloudflare setup.")}finally{zone.removeAttribute("aria-busy")}}
render()})}
setupPhotos();


// Project assembly trees are public; editing requires administrator login.
const assemblySelections={};
function setupAssemblyTrees(){
 document.querySelectorAll("[data-assembly-tree]").forEach(root=>{
  const project=root.dataset.assemblyTree,view=document.getElementById(project),nodesEl=root.querySelector(".assembly-tree-nodes"),status=root.querySelector(".assembly-tree-status"),controls=root.querySelector(".assembly-edit");
  const title=view.querySelector(".assembly-main h1")?.textContent||"Project";let nodes=[],selected=null,expanded=new Set([null]);
  const detail=view.querySelector(".assembly-detail"),main=view.querySelector(".assembly-main"),detailStatus=detail.querySelector(".assembly-detail-status");
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
  workspace.innerHTML='<button type="button" class="btn workspace-back">← Assembly overview</button><div class="workspace-heading"><div class="workspace-cover"><span>No photo yet</span></div><div><h1 class="workspace-title"></h1><p class="muted">Workspace</p></div></div><section class="workspace-panels"><article><h2>Work instructions</h2><textarea class="field workspace-instructions" placeholder="Add build steps, tools, measurements and checks…" rows="8"></textarea></article><article><h2>Pictures</h2><div class="workspace-picture-list">Photos uploaded to this assembly appear in the overview.</div></article><article><h2>Recipes / procedures</h2><textarea class="field workspace-procedures" placeholder="Add settings, recipes and procedures…" rows="5"></textarea></article><article><h2>Notes</h2><textarea class="field workspace-notes" placeholder="Add notes…" rows="5"></textarea></article><div class="workspace-actions"><button type="button" class="btn primary workspace-save">Save workspace</button><span class="workspace-status" role="status"></span></div></section>';
  detail.after(workspace);
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
    workspaceStatus.textContent="";
   }catch(e){workspaceStatus.textContent=e.message}
  }
  workspace.querySelector(".workspace-save").onclick=async()=>{
   if(!adminAuthenticated){workspaceStatus.textContent="Use Admin login at the top of the website to save.";return}
   const button=workspace.querySelector(".workspace-save"),url=workspaceUrl(),data={};
   for(const name of workspaceFields)data[name]=workspace.querySelector(".workspace-"+name).value;
   button.disabled=true;workspaceStatus.textContent="Saving…";
   try{const res=await fetch(url,{method:"PUT",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify(data)});const result=await res.json();if(!res.ok)throw Error(result.error||"Save failed (HTTP "+res.status+")");workspaceStatus.textContent="Saved."}
   catch(e){workspaceStatus.textContent=e.message}finally{button.disabled=false}
  };
  function openWorkspace(){history.pushState(null,"","#"+project+"/workspace/"+encodeURIComponent(selected??"__root__"));showAssemblyPage();window.scrollTo(0,0)}
  workspace.querySelector(".workspace-back").onclick=()=>{history.pushState(null,"",selected===null?"#"+project:"#"+project+"/assembly/"+encodeURIComponent(selected));showAssemblyPage();window.scrollTo(0,0)};
  async function showAssemblyPage(){
   const version=++detailVersion;
   const isAssembly=selected!==null;
   const bom=main.querySelector(".component-section")||detail.querySelector(".component-section");
   if(bom){if(isAssembly)detail.querySelector(".assembly-content-tiles").append(bom);else (main.querySelector(".assembly-unified-body")||main).append(bom)}
   const inWorkspace=workspaceRoute();workspace.classList.toggle("hide",!inWorkspace);detail.classList.toggle("hide",!isAssembly||inWorkspace);main.classList.toggle("hide",isAssembly);if(inWorkspace){workspace.querySelector(".workspace-title").textContent=selected===null?title:(nodes.find(n=>n.id===selected)?.name||"Assembly");loadWorkspaceCover();loadWorkspace();return;}
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
   zone.ondragover=e=>{e.preventDefault();zone.classList.add("drag-over")};
   zone.ondragleave=()=>zone.classList.remove("drag-over");
   zone.ondrop=e=>{e.preventDefault();zone.classList.remove("drag-over");upload(e.dataTransfer.files?.[0])};
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
   const sorted=[...children].sort((a,b)=>{const depth=n=>{const seen=new Set();const walk=id=>{if(seen.has(id))return 0;seen.add(id);const x=nodes.find(n=>n.id===id);return x?.dependsOn?.length?1+Math.max(...x.dependsOn.map(walk)):0};return walk(n.id)};return depth(a)-depth(b)});
   for(const n of sorted){
    const tile=document.createElement("article");tile.className="assembly-tile";
    const cover=document.createElement("div");cover.className="assembly-tile-cover";cover.textContent="▧";const overlay=document.createElement("span");overlay.className="assembly-tile-overlay";overlay.textContent=n.name;cover.append(overlay);tile.append(cover);fetch("/api/photos?project="+project+"&assembly="+encodeURIComponent(n.id)).then(r=>r.json()).then(data=>{if(!tile.isConnected||!data.photos?.length)return;const img=document.createElement("img");img.src=data.photos[0].url;img.alt="";cover.replaceChildren(img,overlay)}).catch(()=>{});
    const stage=document.createElement("span");stage.className="assembly-tile-stage";stage.textContent=n.stage==="integration"?"Integration":n.dependsOn?.length?"Dependent":"";
    const button=document.createElement("button");button.type="button";button.className="assembly-tile-title";button.textContent=n.name;const openAssembly=()=>{selected=n.id;expanded.add(n.parentId);render();history.pushState(null,"","#"+project+"/assembly/"+encodeURIComponent(n.id));notify();window.scrollTo(0,0)};button.onclick=openAssembly;cover.setAttribute("role","button");cover.tabIndex=0;cover.setAttribute("aria-label","Open "+n.name);cover.onclick=openAssembly;cover.title="Open "+n.name+" overview";cover.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openAssembly()}};
    tile.append(stage,button);
    if(n.dependsOn?.length){const deps=document.createElement("p");deps.className="assembly-tile-deps";deps.textContent="Requires: "+n.dependsOn.map(id=>nodes.find(x=>x.id===id)?.name||"Unknown").join(", ");tile.append(deps)}
    if(adminAuthenticated){const edit=document.createElement("button");edit.type="button";edit.className="btn assembly-tile-edit";edit.textContent="Order";edit.onclick=async()=>{const options=nodes.filter(x=>x.id!==n.id);const help=options.map((x,i)=>(i+1)+". "+x.name).join("\\n");const answer=prompt("Enter prerequisite assembly numbers, separated by commas. Leave blank for independent work.\\n"+help,(n.dependsOn||[]).map(id=>options.findIndex(x=>x.id===id)+1).join(","));if(answer===null)return;const indices=answer.trim()?answer.split(",").map(v=>Number(v.trim())-1):[];if(indices.some(i=>!Number.isInteger(i)||i<0||i>=options.length)){status.textContent="Invalid prerequisite numbers.";return}const deps=[...new Set(indices.map(i=>options[i].id))];const stage=prompt("Work type: independent, sequential, or integration",n.stage||"independent");if(stage===null)return;try{await save(nodes.map(x=>x.id===n.id?{...x,dependsOn:deps,stage:stage.trim().toLowerCase()}:x))}catch(e){status.textContent=e.message}};tile.append(edit)}
    if(adminAuthenticated){
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
  root.addEventListener("openassembly",e=>{const id=e.detail;if(id==="__root__"){selected=null;render();notify();return}if(!nodes.some(n=>n.id===id))return;selected=id;let cursor=nodes.find(n=>n.id===id);while(cursor){expanded.add(cursor.parentId);cursor=nodes.find(n=>n.id===cursor.parentId)}render();notify()});
  const validSelection=()=>selected===null||nodes.some(n=>n.id===selected);
  const notify=()=>{showAssemblyPage();renderTiles();assemblySelections[project]=selected;view.querySelectorAll(".component-section").forEach(section=>section.dispatchEvent(new Event("assemblychange")));};
  async function load(){try{const r=await fetch("/api/tree?project="+project),data=await r.json();if(!r.ok)throw Error(data.error);nodes=data.nodes||[];if(!validSelection())selected=null;const deepLink=decodeURIComponent(location.hash.slice(1)).match(new RegExp("^"+project+"/(?:assembly|workspace)/([^/]+)$"));if(deepLink&&nodes.some(n=>n.id===deepLink[1]))selected=deepLink[1];render();notify()}catch(e){status.textContent="Feature tree unavailable: "+e.message}}
  async function save(next){const r=await fetch("/api/tree?project="+project,{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({nodes:next})});const data=await r.json();if(!r.ok)throw Error(data.error||"Save failed");nodes=next;render();notify()}
  function render(){nodesEl.replaceChildren();controls.classList.toggle("hide",!adminAuthenticated);const row=(node,depth)=>{
   const id=node?.id??null,children=nodes.filter(n=>n.parentId===id),el=document.createElement("div");el.className="assembly-node"+(selected===id?" selected":"");el.style.paddingLeft=(depth*17+3)+"px";
   const expand=document.createElement("button");expand.type="button";expand.className="assembly-expander";expand.textContent=children.length?(expanded.has(id)?"▾":"▸"):" ";expand.setAttribute("aria-label",expanded.has(id)?"Collapse":"Expand");expand.onclick=()=>{expanded.has(id)?expanded.delete(id):expanded.add(id);render()};
   const name=document.createElement("button");name.type="button";name.className="assembly-name";name.textContent=node?"📦  "+node.name:"🟨  "+title;name.onclick=()=>{selected=id;render();notify()};
   el.append(expand,name);nodesEl.append(el);
   if(expanded.has(id))children.forEach(child=>row(child,depth+1));
  };row(null,0);status.textContent="";renderTiles()}
  root.querySelector(".assembly-add").onclick=async()=>{const name=prompt("New subassembly name");if(!name?.trim())return;const id=crypto.randomUUID();try{await save([...nodes,{id,name:name.trim(),parentId:selected}]);expanded.add(selected);selected=id;render();notify()}catch(e){status.textContent=e.message}};
  root.querySelector(".assembly-rename").onclick=async()=>{if(selected===null){status.textContent="Select a subassembly to rename.";return}const node=nodes.find(n=>n.id===selected),name=prompt("Rename subassembly",node.name);if(!name?.trim())return;try{await save(nodes.map(n=>n.id===selected?{...n,name:name.trim()}:n))}catch(e){status.textContent=e.message}};
  root.querySelector(".assembly-remove").onclick=async()=>{if(selected===null){status.textContent="Select a subassembly to delete.";return}const node=nodes.find(n=>n.id===selected);if(!confirm("Delete "+node.name+" and its nested subassemblies? Existing BOM components will remain in the project but may become unassigned."))return;const removed=new Set([selected]);let changed=true;while(changed){changed=false;for(const n of nodes)if(removed.has(n.parentId)&&!removed.has(n.id)){removed.add(n.id);changed=true}}try{await save(nodes.filter(n=>!removed.has(n.id)));selected=null;render();notify()}catch(e){status.textContent=e.message}};
  load();
 })
}
setupAssemblyTrees();

function setupComponents(){
 document.querySelectorAll("[data-components]").forEach(root=>{
 const project=root.dataset.components,list=root.querySelector(".component-list"),status=root.querySelector(".component-status"),review=root.querySelector(".component-review"),specs=root.querySelector(".component-specs");

 const field=name=>root.querySelector(".component-"+name);
 const say=message=>{status.textContent=message;status.hidden=false;status.style.display="block";status.setAttribute("aria-live","polite");};
 function specRow(name="",value="",source="explicit"){
  const row=document.createElement("div");row.className="row component-spec-row";
  const a=document.createElement("input"),b=document.createElement("input"),c=document.createElement("select"),del=document.createElement("button");
  a.className=b.className="field";a.placeholder="Specification";b.placeholder="Value";a.value=name;b.value=value;
  for(const opt of ["explicit","inferred"]){const el=document.createElement("option");el.value=opt;el.textContent=opt==="explicit"?"Stated in listing":"Inferred";c.append(el)}c.value=source;
  del.className="btn";del.type="button";del.textContent="Remove";del.onclick=()=>row.remove();row.append(a,b,c,del);specs.append(row)
 }
 async function refresh(){
  try{const res=await fetch("/api/components?project="+project),data=await res.json();if(!res.ok)throw Error(data.error);
  list.replaceChildren();
  const selected=assemblySelections[project]??null;const visible=data.components.filter(c=>(c.assemblyId??null)===selected);
  if(!visible.length){list.textContent="No components yet.";return}
  const table=document.createElement("table"),head=document.createElement("tr");
  for(const label of ["Component","Qty","Model","Supplier","Specifications"]){const th=document.createElement("th");th.textContent=label;head.append(th)}table.append(head);
  for(const c of visible){const tr=document.createElement("tr");const cells=[c.name,c.quantity||1,[c.manufacturer,c.model].filter(Boolean).join(" · "),[c.supplier,c.asin].filter(Boolean).join(" · "),c.specifications.map(s=>s.name+": "+s.value+(s.source==="inferred"?" (inferred)":"")).join("; ")];for(const v of cells){const td=document.createElement("td");td.textContent=v;tr.append(td)}
  if(photoToken()){const td=document.createElement("td"),btn=document.createElement("button");btn.className="btn";btn.textContent="Delete";btn.onclick=async()=>{if(!confirm("Delete component?"))return;const res=await fetch("/api/components?project="+project+"&id="+encodeURIComponent(c.id),{method:"DELETE",headers:{authorization:"Bearer "+photoToken()}});if(res.ok)refresh();else say("Delete failed.")};td.append(btn);tr.append(td)}
  table.append(tr)}list.append(table)
  }catch(e){list.textContent="Components unavailable."}
 }
 const importPanel=root.querySelector(".component-admin");
 if(!field("extract")||!field("description")||!field("add-spec")||!field("save")){say("Component editor is incomplete. Please refresh the page.");return;}
 if(importPanel){const manual=document.createElement("button");manual.type="button";manual.className="btn component-manual";manual.textContent="Add component manually";manual.onclick=()=>{review.classList.remove("hide");say("Enter component details below, then save to this tile.")};field("extract").after(manual)}
 const extractionButton=field("extract");
 extractionButton.addEventListener("click",()=>{if(!adminAuthenticated)say("Please use Admin login at the top of the page before extracting.");},true);
 field("extract").onclick=async()=>{
  const description=field("description").value.trim();if(!description){say("Paste a product description.");return}
  if(!adminAuthenticated){say("Log in using Admin login at the top of the website.");return}
  field("extract").disabled=true;say("Extracting specifications…");
  try{const res=await fetch("/api/components/extract",{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({description})});const raw=await res.text();let data;try{data=JSON.parse(raw)}catch{throw Error("Server returned an unexpected response (HTTP "+res.status+"). Check the Worker deployment.")}if(!res.ok)throw Error(data.error||"Extraction failed (HTTP "+res.status+")");
   const c=data.component;if(!c||typeof c!=="object")throw Error("The extraction service returned no component data");for(const name of ["name","manufacturer","model","category","supplier","asin"])field(name).value=c[name]||"";
   specs.replaceChildren();for(const s of c.specifications||[])specRow(s.name,s.value,s.source);review.classList.remove("hide");say("Review and correct the fields before saving.")
  }catch(e){review.classList.remove("hide");say((e.message||"Extraction unavailable")+". Enter the component fields manually below, then save.")}finally{field("extract").disabled=false}
 };
 field("add-spec").onclick=()=>specRow();
 field("save").onclick=async()=>{
  const c={assemblyId:assemblySelections[project]??null,quantity:Math.max(1,Math.floor(Number(field("quantity")?.value)||1))};for(const name of ["name","manufacturer","model","category","supplier","asin"])c[name]=field(name).value.trim();
  c.specifications=[...specs.querySelectorAll(".component-spec-row")].map(row=>({name:row.children[0].value.trim(),value:row.children[1].value.trim(),source:row.children[2].value})).filter(s=>s.name&&s.value);
  if(!c.name){say("Component name is required.");return}
  field("save").disabled=true;try{const res=await fetch("/api/components?project="+project,{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+photoToken()},body:JSON.stringify(c)}),data=await res.json();if(!res.ok)throw Error(data.error||"Save failed");review.classList.add("hide");field("description").value="";if(field("quantity"))field("quantity").value="1";say("Component saved.");await refresh()}catch(e){say(e.message)}finally{field("save").disabled=false}
 };
 root.addEventListener("assemblychange",()=>{review.classList.add("hide");field("description").value="";specs.replaceChildren();refresh()});
 refresh();
 })
}
setupComponents();


renderNotes();renderDrafts();renderTiles();navigate(location.hash.slice(1)||"home");
