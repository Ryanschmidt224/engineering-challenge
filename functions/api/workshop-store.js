import {isAdmin} from "./auth.js";
import {validateItem, validateStock, templateFromItem, definition} from "../../assets/workshop-base-model.js";

export const WORKSHOP_PREFIX = "private-workshop/v1/";
export const validWorkshopId = id => typeof id === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id);
export const workshopJson = (value, status = 200) => Response.json(value, {status, headers: {"cache-control": "private, no-store", "x-content-type-options": "nosniff"}});
export async function workshopAccess(request, env) {
  if (!await isAdmin(request, env)) return workshopJson({error: "Owner sign-in required"}, 401);
  if (!["GET", "HEAD"].includes(request.method) && request.headers.get("origin") !== new URL(request.url).origin)
    return workshopJson({error: "Invalid request origin"}, 403);
  if (!env.PHOTOS) return workshopJson({error: "Workshop storage unavailable"}, 503);
  return null;
}
export async function readBoundedBody(request, max) {
  if (Number(request.headers.get("content-length")) > max) throw new Error("Request is too large");
  const reader = request.body?.getReader(); if (!reader) return new Uint8Array();
  const chunks = []; let total = 0;
  try {
    while (true) {
      const {done, value} = await reader.read(); if (done) break;
      total += value.byteLength;
      if (total > max) {await reader.cancel(); throw new Error("Request is too large");}
      chunks.push(value);
    }
  } finally {reader.releaseLock();}
  const bytes = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.byteLength;}
  return bytes;
}
export async function listWorkshopObjects(env, suffix) {
  const objects = []; let cursor;
  do {
    const page = await env.PHOTOS.list({prefix: WORKSHOP_PREFIX + suffix, cursor, limit: 500, include: ["customMetadata", "httpMetadata"]});
    objects.push(...page.objects);
    if (objects.length > 3000) throw Error("Workshop listing limit reached; export storage directly before continuing.");
    if (!page.truncated) break;
    if (!page.cursor || page.cursor === cursor) throw Error("Workshop listing was incomplete. Try again.");
    cursor = page.cursor;
  } while (true);
  return objects;
}
export const workshopKey = (kind, id) => WORKSHOP_PREFIX + kind + "/" + id + ".json";
export async function getWorkshopRecord(env, id) {
  if (!validWorkshopId(id)) return null;
  const object = await env.PHOTOS.get(workshopKey("items", id));
  const record = object ? await object.json() : null;
  return record?.archivedAt ? null : record;
}
function cleanRecord(input, kind, id) {
  if (kind === "layouts") {
    const layout = input.layout;
    if (!layout || layout.schemaVersion !== 1 || typeof layout.category !== "string" || layout.category.length > 100) throw Error("Invalid template");
    const snapshot = templateFromItem({identity: {category: layout.category}, fields: layout.fields}, layout.name);
    return {layout: snapshot};
  }
  const item = input.item;
  if (!item || item.id !== id || !item.identity || !Array.isArray(item.fields) || !Array.isArray(item.offers) || !Array.isArray(item.attachments) ||
      !item.values || Array.isArray(item.values) || typeof item.notes !== "string") throw Error("Invalid Workshop item");
  const identityKeys = new Set(["name", "description", "category", "manufacturer", "mpn", "model", "isTool"]);
  if (Object.entries(item.identity).some(([key, value]) => !identityKeys.has(key) || (key === "isTool" ? typeof value !== "boolean" : typeof value !== "string" || value.length > (key === "description" ? 2000 : 180))))
    throw Error("Invalid item identity");
  if (item.notes.length > 12000 || item.offers.length > 30 || item.attachments.length > 60) throw Error("This item has too many details");
  validateItem(item); validateStock(input.stock);
  return {item: {schemaVersion: 1, id, identity: item.identity, fields: item.fields.map(definition), values: item.values,
    offers: item.offers, attachments: item.attachments, notes: item.notes}, stock: input.stock || null};
}
export async function handleWorkshopRecords(request, env, kind) {
  const denied = await workshopAccess(request, env); if (denied) return denied;
  const url = new URL(request.url), id = url.searchParams.get("id");
  if (id !== null && !validWorkshopId(id)) return workshopJson({error: "Invalid Workshop ID"}, 400);
  if (request.method === "GET") {
    if (id) {
      const object = await env.PHOTOS.get(workshopKey(kind, id)), record = object ? await object.json() : null;
      return record && (!record.archivedAt || url.searchParams.has("includeArchived")) ? workshopJson({record}) : workshopJson({error: "Record not found"}, 404);
    }
    const records = []; let bytes = 0;
    for (const object of await listWorkshopObjects(env, kind + "/")) {
      bytes += object.size || 0;
      if (bytes > 8 * 1024 * 1024) return workshopJson({error: "Workshop list is too large. Export before reorganizing records."}, 413);
      const stored = await env.PHOTOS.get(object.key); if (!stored) continue;
      const record = await stored.json();
      if (!record.archivedAt || url.searchParams.has("includeArchived")) records.push(record);
    }
    records.sort((a, b) => String(a.item?.identity.name || a.layout?.name).localeCompare(String(b.item?.identity.name || b.layout?.name)));
    return workshopJson({records});
  }
  if (!["POST", "PUT", "DELETE", "PATCH"].includes(request.method)) return workshopJson({error: "Method not allowed"}, 405);
  let input;
  try {input = JSON.parse(new TextDecoder().decode(await readBoundedBody(request, 128 * 1024)));}
  catch (error) {return workshopJson({error: error.message === "Request is too large" ? error.message : "Invalid JSON request"}, error.message === "Request is too large" ? 413 : 400);}
  const recordId = id || input?.id;
  if (!validWorkshopId(recordId) || !input || !Object.hasOwn(input, "expectedRevision")) return workshopJson({error: "Provide a valid ID and the revision you opened"}, 400);
  const key = workshopKey(kind, recordId), object = await env.PHOTOS.get(key), previous = object ? await object.json() : null;
  const creating = request.method === "POST";
  if (creating ? previous || input.expectedRevision !== null : !previous || input.expectedRevision !== previous.revision)
    return workshopJson({error: "This record changed or was removed. Your draft has not been saved.", code: "WORKSHOP_CONFLICT", current: previous}, 409);
  if (!creating && previous.archivedAt && !(request.method === "PATCH" && input.restore === true)) return workshopJson({error: "Restore the archived record before editing"}, 409);
  let payload;
  try {
    payload = ["DELETE", "PATCH"].includes(request.method) ? {...previous} : cleanRecord(input, kind, recordId);
    if (request.method === "PATCH" && input.restore !== true) throw Error("Only restore is supported");
    if (kind === "items" && !["DELETE", "PATCH"].includes(request.method)) {
      for (const attachment of payload.item.attachments) if (attachment.fileId && !await env.PHOTOS.head(WORKSHOP_PREFIX + "files/" + attachment.fileId)) throw Error("An uploaded file is missing. Upload it again before saving.");
    }
  } catch (error) {return workshopJson({error: String(error.message || "Invalid record")}, 400);}
  const record = {...payload, id: recordId, revision: crypto.randomUUID(), createdAt: previous?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(), archivedAt: request.method === "DELETE" ? new Date().toISOString() : null};
  const saved = await env.PHOTOS.put(key, JSON.stringify(record), {onlyIf: object ? {etagMatches: object.etag} : {etagDoesNotMatch: "*"}, httpMetadata: {contentType: "application/json"}});
  if (saved === null) return workshopJson({error: "Another tab saved this record first. Your draft is intact.", code: "WORKSHOP_CONFLICT"}, 409);
  return workshopJson({record}, creating ? 201 : 200);
}
