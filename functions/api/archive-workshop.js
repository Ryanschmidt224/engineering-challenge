import {workshopDocumentation, workshopItemLookup, workshopLinkId, workshopSourcing} from "./workshop-linked-part.js";
import {resolveFunctionalPart} from "./functional-part-model.js";
import {workshopHostAllowed} from "./workshop-image-import.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const pdfLimit = 8 * 1024 * 1024;

async function downloadPdf(href, budget) {
 const deadline = Math.min(5000, budget.deadline - Date.now());
 if (deadline <= 0) throw Error("Document download time limit reached");
 const signal = AbortSignal.timeout(deadline);
 let url = new URL(href);
 for (let hop = 0; hop <= 3; hop++) {
  if (url.protocol !== "https:" || url.username || url.password || url.port || !workshopHostAllowed(url.hostname))
   throw Error("Open the original link online");
  if (budget.requests <= 0) throw Error("Document download request limit reached");
  budget.requests--;
  const response = await fetch(url.href, {redirect:"manual", credentials:"omit", signal, headers:{Accept:"application/pdf"}});
  const reader = response.body?.getReader();
  try {
   if ([301,302,303,307,308].includes(response.status) && response.headers.has("location")) {
    url = new URL(response.headers.get("location"), url);
    continue;
   }
   if (!response.ok || !reader) throw Error("Publisher did not return the document");
   if (Number(response.headers.get("content-length")) > pdfLimit) throw Error("PDF exceeds 8 MiB");
   const chunks = [];
   let size = 0;
   while (true) {
    const {done, value} = await reader.read();
    if (done) break;
    size += value.length;
    if (size > pdfLimit) throw Error("PDF exceeds 8 MiB");
    chunks.push(value);
    if (chunks.length === 1 && size >= 5 && decoder.decode(value.subarray(0,5)) !== "%PDF-")
     throw Error("Publisher link opens a web page or another file type");
   }
   const bytes = new Uint8Array(size);
   let at = 0;
   for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.length; }
   if (decoder.decode(bytes.subarray(0,5)) !== "%PDF-") throw Error("Publisher did not return a PDF");
   return bytes;
  } finally {
   if (reader) await reader.cancel().catch(()=>{});
  }
 }
 throw Error("Too many publisher redirects");
}

// Collect references from the same bytes saved in this archive, including older workspaces.
export function workshopDependencies(bucket, project, ownerId) {
 const refs = new Map(), unreadable = [];
 const prefix = "workshop-dependencies/" + project + "/";
 const owner = /^u[a-f0-9]{32}$/.test(ownerId || "") ? {id:ownerId} : null;
 const lookup = workshopItemLookup(null, {PHOTOS:bucket}, async () => owner);

 function remember(part, key) {
  const id = workshopLinkId(part);
  if (!id) return;
  if (!refs.has(id)) refs.set(id, {part, uses:new Set(), docs:new Map()});
  const ref = refs.get(id);
  ref.uses.add(key);
  if (part.id) {
   ref.part = part;
   for (const doc of workshopDocumentation(part)) ref.docs.set(doc.url, doc);
  }
 }
 function collect(key, bytes) {
  const components = key === "components/" + project + ".json";
  if (!components && !/^(?:part-workspaces|workspaces|workspace-history)\//.test(key)) return;
  try {
   const record = JSON.parse(decoder.decode(bytes));
   if (components) {
    for (const part of record) remember(resolveFunctionalPart(part), part.id);
   } else {
    for (const version of [record, ...(record.history || [])]) {
     for (const id of [...(version.resources?.parts || []), ...(version.resources?.tools || [])])
      remember({projectDetails:{workshopReferenceId:id}}, key);
    }
   }
  } catch { unreadable.push(key); } // The original bytes are still in the archive.
 }

 async function finish(append, roomFor) {
  if (!refs.size && !unreadable.length) return;
  const items = [], media = new Map();
  function asset(source, type, label) {
   if (!media.has(source)) media.set(source, {type, references:[], number:media.size+1});
   const reference = {label};
   if (type === "pdf") reference.url = source;
   media.get(source).references.push(reference);
   return reference;
  }
  for (const [id, ref] of refs) {
   const source = await lookup(ref.part);
   const item = source?.item || ref.part;
   const entry = {
    reference:id, name:item.name || id, usedBy:[...ref.uses],
    source:source ? "Workshop at export" : "Workshop item unavailable. Saved project information follows.",
    description:item.subtitle || item.description || "", featureTreeDescription:item.featureTreeDescription || item.projectDetails?.workshopTreeDescription || "",
    manufacturer:item.manufacturer || "", manufacturerPartNumber:item.model || "",
    specification:item.spec || "", specifications:item.specRecords?.length ? item.specRecords : (item.specifications || []),
    supplier:item.supplier || "", sourcing:source ? workshopSourcing(item) : (item.workshopSourcing || {}),
    documents:[], photos:[]
   };
   if (source) entry.manufacturerPartNumber = item.partNumber || item.model || "";
   for (const doc of workshopDocumentation(item)) ref.docs.set(doc.url, doc);
   for (const doc of ref.docs.values()) entry.documents.push(asset(doc.url, "pdf", doc.label));
   if (source && id.startsWith("my:") && source.photoKey) entry.photos.push(asset(source.photoKey, "photo", "Product photo"));
   if (source && id.startsWith("workshop:")) {
    for (const photo of item.photos || []) {
     if (/^[a-f0-9-]{36}$/i.test(photo.id || ""))
      entry.photos.push(asset("workshop-reference-photos/" + photo.id, "photo", photo.caption || "Product photo"));
    }
   }
   items.push(entry);
  }
  const manifest = {version:1, items};
  if (unreadable.length) manifest.unreadableProjectRecords = unreadable;
  // Reserve space for the index and its download statuses before adding optional binaries.
  let reserve = encoder.encode(JSON.stringify(manifest)).length;
  for (const file of media.values()) reserve += 256 * file.references.length;
  const budget = {requests:20, deadline:Date.now()+20000};
  for (const [source, file] of media) {
   let status;
   if (!roomFor(reserve+1, 2)) status = {offlineStatus:"Archive limit reached"};
   else if (file.type === "pdf") {
    let bytes;
    try { bytes = await downloadPdf(source, budget); }
    catch (error) { status = {offlineStatus:error.name === "TimeoutError" ? "Publisher timed out" : String(error.message).slice(0,120)}; }
    if (bytes) {
     if (roomFor(reserve+bytes.length, 2)) {
      const key = prefix+"files/document-"+file.number+".pdf";
      const filename = new URL(source).pathname.split("/").pop();
      const name = filename && /^[a-z0-9_. -]+\.pdf$/i.test(filename) ? filename : "document-"+file.number+".pdf";
      await append(key, bytes, "application/pdf", {filename:name});
      status = {offlineFile:key};
     } else status = {offlineStatus:"Archive limit reached"};
    }
   } else {
    const object = await bucket.get(source);
    const type = object?.httpMetadata?.contentType;
    const ext = {"image/png":"png","image/jpeg":"jpg","image/webp":"webp"}[type];
    if (!object || !ext) status = {offlineStatus:"Workshop photo unavailable"};
    else if (object.size > 24*1024*1024 || !roomFor(reserve+object.size, 2)) status = {offlineStatus:"Archive limit reached"};
    else {
     const key = prefix+"files/photo-"+file.number+"."+ext;
     await append(key, new Uint8Array(await object.arrayBuffer()), type, {filename:"photo-"+file.number+"."+ext});
     status = {offlineFile:key};
    }
   }
   for (const ref of file.references) Object.assign(ref, status);
  }
  await append(prefix+"index.json", encoder.encode(JSON.stringify(manifest)), "application/json");
 }
 return {collect, finish};
}
