import {WORKSHOP_PREFIX, validWorkshopId, workshopAccess, workshopJson, readBoundedBody} from "./workshop-store.js";
const extensions = new Set(["jpg", "jpeg", "png", "webp", "gif", "heic", "heif", "pdf", "dwg", "dxf", "sldprt", "sldasm", "step", "stp", "stl", "iges", "igs", "3mf", "zip", "csv", "txt"]);
export async function handleWorkshopFiles(request, env) {
  const denied = await workshopAccess(request, env); if (denied) return denied;
  if (request.method === "GET") {
    const id = new URL(request.url).searchParams.get("id");
    if (!validWorkshopId(id)) return workshopJson({error: "Invalid file ID"}, 400);
    const object = await env.PHOTOS.get(WORKSHOP_PREFIX + "files/" + id);
    if (!object) return workshopJson({error: "File not found"}, 404);
    const type = object.httpMetadata?.contentType || "application/octet-stream";
    const inline = ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(type);
    return new Response(object.body, {headers: {"content-type": type, "content-disposition": (inline ? "inline" : "attachment") + "; filename*=UTF-8''" + encodeURIComponent(object.customMetadata?.filename || "download"),
      "cache-control": "private, no-store", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; sandbox"}});
  }
  if (request.method !== "POST") return workshopJson({error: "Method not allowed"}, 405);
  let name;
  try {name = decodeURIComponent(request.headers.get("x-file-name") || "");} catch {return workshopJson({error: "Invalid filename"}, 400);}
  if (!name || name.length > 180 || /[\\/\x00-\x1f]/.test(name)) return workshopJson({error: "Invalid filename"}, 400);
  const extension = name.split(".").at(-1).toLowerCase();
  if (!extensions.has(extension)) return workshopJson({error: "Use an image, PDF, CAD, text, CSV or ZIP file"}, 415);
  let bytes;
  try {bytes = await readBoundedBody(request, 10 * 1024 * 1024);} catch {return workshopJson({error: "Files must be 10 MB or smaller"}, 413);}
  if (!bytes.length) return workshopJson({error: "Choose a nonempty file"}, 400);
  const signature = String.fromCharCode(...bytes.slice(0, 12));
  let mediaType = "application/octet-stream";
  if (["jpg", "jpeg"].includes(extension) && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) mediaType = "image/jpeg";
  else if (extension === "png" && signature.startsWith("\x89PNG\r\n\x1a\n")) mediaType = "image/png";
  else if (extension === "gif" && /^GIF8[79]a/.test(signature)) mediaType = "image/gif";
  else if (extension === "webp" && signature.startsWith("RIFF") && signature.slice(8) === "WEBP") mediaType = "image/webp";
  else if (["jpg", "jpeg", "png", "gif", "webp"].includes(extension)) return workshopJson({error: "Image contents do not match its filename"}, 415);
  const id = crypto.randomUUID();
  const saved = await env.PHOTOS.put(WORKSHOP_PREFIX + "files/" + id, bytes, {onlyIf: {etagDoesNotMatch: "*"}, httpMetadata: {contentType: mediaType}, customMetadata: {filename: name}});
  if (saved === null) return workshopJson({error: "File ID collision. Try the upload again."}, 409);
  return workshopJson({attachment: {fileId: id, label: name, mediaType, size: bytes.length, purpose: mediaType.startsWith("image/") ? "photo" : "document"}}, 201);
}
