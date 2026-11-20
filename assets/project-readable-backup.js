/* Render a project archive as a standalone, printable HTML document. */
window.BSReadableBackup = (() => {
 const escape = value => String(value).replace(/[&<>"']/g, char => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
 })[char]);
 const imageTypes = new Set(["image/jpeg","image/png","image/gif","image/webp","image/avif"]);
 const sections = {
  "project-profile":"Project summary and settings", "assembly-status":"Assembly status",
  "project-settings":"Project settings", "photo-annotations":"Photo markup",
  "photo-renders":"Edited photos", "change-proposals":"Change suggestions", trees:"Feature tree", components:"Parts", "assembly-pages":"Assemblies",
  workspaces:"Assembly workspaces", "part-workspaces":"Part workspaces",
  investigations:"Project History", "unstructured-notes":"Unstructured notes",
  "project-numbering":"Part numbering", libraries:"Reference libraries"
 };
 const label = key => key.replace(/([a-z])([A-Z])/g,"$1 $2").replace(/[_-]/g," ");
 function build(archive, title) {
  const files = new Map(archive.objects.map((object,index) => [object.key,"file-"+index]));
  const decode = data => new TextDecoder().decode(Uint8Array.from(atob(data),char=>char.charCodeAt(0)));
  function render(value) {
   if (value === null || value === undefined) return "—";
   if (typeof value === "string" && files.has(value)) return '<a href="#'+files.get(value)+'">'+escape(value)+'</a>';
   if (Array.isArray(value)) return value.length ? "<ol>"+value.map(item=>"<li>"+render(item)+"</li>").join("")+"</ol>" : "—";
   if (typeof value === "object") return "<dl>"+Object.entries(value).map(([key,item])=>
    "<dt>"+escape(label(key))+"</dt><dd>"+render(item)+"</dd>").join("")+"</dl>";
   return escape(value);
  }
  const records = [], attachments = [];
  for (const object of archive.objects) {
   const key = object.key;
   const [folder,...path] = key.split("/");
   const filename = object.customMetadata?.filename || object.customMetadata?.name || path.at(-1) || key;
   const heading = sections[folder] || label(folder);
   const id = files.get(key);
   if (key.endsWith(".json") && folder !== "recipe-files" && folder !== "part-files") {
    const raw = decode(object.data);
    let body;
    try { body = render(JSON.parse(raw)); }
    catch { body = "<pre>"+escape(raw)+"</pre>"; }
    records.push('<section id="'+id+'"><h2>'+escape(heading)+'</h2><p class="path">'+escape(key)+'</p>'+body+'</section>');
   } else {
    const caption = object.customMetadata?.caption;
    const data = escape(object.data);
    const preview = imageTypes.has(object.contentType)
     ? '<img loading="lazy" alt="'+escape(caption||filename)+'" src="data:'+object.contentType+';base64,'+data+'">'
     : "";
    attachments.push('<figure id="'+id+'">'+preview+'<figcaption><a download="'+escape(filename)+
     '" href="data:application/octet-stream;base64,'+data+'">'+escape(filename)+'</a>'+
     (caption?"<p>"+escape(caption)+"</p>":"")+'<div class="path">'+escape(key)+'</div></figcaption></figure>');
   }
  }
  const name = escape(title||archive.projectId);
  return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
   '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data:; base-uri \'none\'; form-action \'none\'">'+
   '<title>'+name+' · Project backup</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:960px;margin:32px auto;padding:0 20px;color:#20302a}'+
   'section,figure{border-top:1px solid #cad5ce;margin:24px 0;padding-top:12px}h2{margin-bottom:4px}dt{font-weight:650}dd{margin:0 0 8px 16px;white-space:pre-wrap}'+
   'li{margin-bottom:6px}img{display:block;max-width:100%;max-height:500px;margin-bottom:8px}.path{color:#53655c;font-size:.85rem}'+
   'dd,li,.path,pre{overflow-wrap:anywhere}pre{white-space:pre-wrap}a{color:#17674f}@media print{body{margin:0}img{break-inside:avoid}}</style>'+
   '<h1>'+name+'</h1><p>Project backup · '+escape(archive.exportedAt)+'</p>'+
   (attachments.length?'<p><a href="#attachments">Jump to files and photos</a></p>':'')+records.join("")+
   (attachments.length?'<h2 id="attachments">Files and photos</h2>'+attachments.join(""):'')+'</html>';
 }
 return {build};
})();
