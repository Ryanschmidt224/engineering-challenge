// Lessons Learned API. Same conventions as functions/api/knowledge.js:
// owner session, same-origin mutations, revision checks for stale tabs,
// archive instead of delete.
//
//   GET   /api/lessons-learned                 -> { bits, photos }
//   POST  /api/lessons-learned                 { record, expectedRevision }  save (create when expectedRevision is null)
//   PATCH /api/lessons-learned                 { id, archived, expectedRevision }  archive / restore
//   POST  /api/lessons-learned/photo?bit=<id>  raw image bytes; headers x-file-name, x-upload-id (UUID, makes retries safe)
//   GET   /api/lessons-learned/photo?id=<id>   the image
import { accountUser } from "./accounts.js";
import { initializeWorkshop } from "./workshop-db.js";
import { readWorkshopBytes } from "./family-workshop-files.js";
import { sha256 } from "./binary-data.js";
import { validId } from "../../assets/family-model.js";
import {
  validateBit,
  searchTextOf,
  titleOf,
} from "../../assets/lessons-model.js";

const headers = {
  "cache-control": "private, no-store",
  "x-content-type-options": "nosniff",
};
const json = (data, status = 200) => Response.json(data, { status, headers });
const conflict = () =>
  json(
    {
      error: "This lesson changed in another tab. Your draft is preserved.",
      code: "LESSON_CONFLICT",
    },
    409,
  );
const photoPrefix = "lessons/photos/";
const uuid = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;
const imageTypes = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
};

function parseBit(row) {
  return (
    row && {
      id: row.id,
      happened: row.happened,
      steps: JSON.parse(row.steps),
      resolution:
        row.resolution === null
          ? null
          : { text: row.resolution, quality: row.quality },
      revision: row.revision,
      archived: row.archived,
      aliases: JSON.parse(row.aliases || "[]"),
      created_at: row.created_at,
      updated_at: row.updated_at,
    }
  );
}

export async function lessonsSnapshot(db, { archived = false } = {}) {
  const [bits, photos] = await db.batch([
    db
      .prepare(
        "SELECT * FROM lessons WHERE archived=? ORDER BY updated_at DESC",
      )
      .bind(archived ? 1 : 0),
    db.prepare(
      "SELECT id,bit_id,title,media_type,size,created_at FROM lesson_photos WHERE archived=0 ORDER BY created_at",
    ),
  ]);
  return { bits: bits.results.map(parseBit), photos: photos.results };
}

async function access(request, env) {
  const owner = await accountUser(request, env);
  if (owner?.role !== "admin")
    return json({ error: "Owner sign-in required" }, 401);
  if (
    !["GET", "HEAD"].includes(request.method) &&
    request.headers.get("origin") !== new URL(request.url).origin
  )
    return json({ error: "Invalid request origin" }, 403);
  if (!env.WORKSHOP_DB)
    return json(
      {
        error: "Workshop database is not configured",
        code: "WORKSHOP_SETUP_REQUIRED",
      },
      503,
    );
  await initializeWorkshop(env.WORKSHOP_DB);
  return null;
}

async function saveBit(db, input, operationId, operationHash) {
  const bit = validateBit(input.record);
  const now = new Date().toISOString();
  const photoIds = bit.steps.flatMap((s) => s.photos);
  const values = [
    bit.happened,
    JSON.stringify(bit.steps),
    bit.resolution ? bit.resolution.text : null,
    bit.resolution ? bit.resolution.quality : null,
    searchTextOf(bit),
  ];

  if (input.expectedRevision === null) {
    // A brand-new bit cannot reference photos: photos need a saved bit first.
    if (photoIds.length) throw Error("Save the lesson before adding photos.");
    const result = await db
      .prepare(
        `INSERT INTO lessons(id,happened,steps,resolution,quality,search_text,created_at,updated_at,last_operation_id,last_operation_hash)
 SELECT ?,?,?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM lessons WHERE id=?)`,
      )
      .bind(bit.id, ...values, now, now, operationId, operationHash, bit.id)
      .run();
    if (!result.meta.changes) return null;
  } else {
    const previous = await db
      .prepare("SELECT * FROM lessons WHERE id=? AND archived=0")
      .bind(bit.id)
      .first();
    if (!previous || previous.revision !== input.expectedRevision) return null;
    const aliases = new Set(JSON.parse(previous.aliases || "[]"));
    if (titleOf(previous) && titleOf(previous) !== titleOf(bit))
      aliases.add(titleOf(previous));
    // Every referenced photo must be a live photo of this lesson.
    const live = new Set(
      (
        await db
          .prepare("SELECT id FROM lesson_photos WHERE bit_id=? AND archived=0")
          .bind(bit.id)
          .all()
      ).results.map((row) => row.id),
    );
    if (photoIds.some((id) => !live.has(id)))
      throw Error(
        "A photo is missing. Remove it from the step and add it again.",
      );
    // One transaction: the update, then archiving photos no step uses any
    // more. The second statement only acts if the first one won the revision
    // race (the unique winning operation ID). Bytes stay in R2.
    const [updated] = await db.batch([
      db
        .prepare(
          `UPDATE lessons SET happened=?,steps=?,resolution=?,quality=?,search_text=?,updated_at=?,aliases=?,last_operation_id=?,last_operation_hash=?,revision=revision+1
 WHERE id=? AND revision=? AND archived=0`,
        )
        .bind(
          ...values,
          now,
          JSON.stringify([...aliases]),
          operationId,
          operationHash,
          bit.id,
          input.expectedRevision,
        ),
      db
        .prepare(
          `UPDATE lesson_photos SET archived=1
 WHERE bit_id=? AND archived=0 AND id NOT IN (SELECT value FROM json_each(?))
 AND EXISTS(SELECT 1 FROM lessons WHERE id=? AND last_operation_id=?)`,
        )
        .bind(bit.id, JSON.stringify(photoIds), bit.id, operationId),
    ]);
    if (!updated.meta.changes) return null;
  }
  return parseBit(
    await db.prepare("SELECT * FROM lessons WHERE id=?").bind(bit.id).first(),
  );
}

export async function handleLessons(request, env) {
  const denied = await access(request, env);
  if (denied) return denied;
  const db = env.WORKSHOP_DB;

  if (request.method === "GET") {
    const archived = new URL(request.url).searchParams.get("archived") === "1";
    return json(await lessonsSnapshot(db, { archived }));
  }
  if (!["POST", "PATCH"].includes(request.method))
    return json({ error: "Method not allowed" }, 405);

  let input;
  try {
    const raw = await request.text();
    if (raw.length > 256 * 1024)
      return json({ error: "Lesson is too large" }, 413);
    input = JSON.parse(raw);
    const rev = input?.expectedRevision;
    if (rev !== null && (!Number.isInteger(rev) || rev < 1))
      throw Error("Provide the revision you opened, or null for a new lesson.");

    const operationId = input.operationId || crypto.randomUUID();
    if (!uuid.test(operationId)) throw Error("Invalid save operation.");
    const operationHash = await sha256(
      new TextEncoder().encode(
        JSON.stringify({
          method: request.method,
          record: input.record,
          id: input.id,
          archived: input.archived,
          expectedRevision: rev,
        }),
      ),
    );
    const existing = await db
      .prepare("SELECT * FROM lessons WHERE id=?")
      .bind(input.record?.id || input.id || "")
      .first();
    if (existing?.last_operation_id === operationId) {
      if (existing.last_operation_hash !== operationHash) return conflict();
      return json({ record: parseBit(existing) });
    }
    if (request.method === "PATCH") {
      if (
        !validId(input.id) ||
        typeof input.archived !== "boolean" ||
        rev === null
      )
        throw Error("Invalid archive request.");
      const result = await db
        .prepare(
          "UPDATE lessons SET archived=?,updated_at=?,last_operation_id=?,last_operation_hash=?,revision=revision+1 WHERE id=? AND revision=?",
        )
        .bind(
          input.archived ? 1 : 0,
          new Date().toISOString(),
          operationId,
          operationHash,
          input.id,
          rev,
        )
        .run();
      if (!result.meta.changes) return conflict();
      return json({
        record: parseBit(
          await db
            .prepare("SELECT * FROM lessons WHERE id=?")
            .bind(input.id)
            .first(),
        ),
      });
    }

    const record = await saveBit(db, input, operationId, operationHash);
    return record ? json({ record }, rev === null ? 201 : 200) : conflict();
  } catch (error) {
    return json({ error: error.message }, 400);
  }
}

export async function handleLessonPhoto(request, env) {
  const denied = await access(request, env);
  if (denied) return denied;
  if (!env.PHOTOS)
    return json({ error: "Photo storage is not configured" }, 503);
  const db = env.WORKSHOP_DB;
  const url = new URL(request.url);

  if (request.method === "GET") {
    const id = url.searchParams.get("id");
    if (!validId(id)) return json({ error: "Invalid photo ID" }, 400);
    // Archived photos stay readable: an old backup or an undo may still show them.
    const record = await db
      .prepare("SELECT r2_key,media_type FROM lesson_photos WHERE id=?")
      .bind(id)
      .first();
    if (!record) return json({ error: "Photo not found" }, 404);
    const object = await env.PHOTOS.get(record.r2_key);
    if (!object) return json({ error: "Photo bytes are missing" }, 404);
    return new Response(object.body, {
      headers: {
        "content-type": record.media_type,
        "content-disposition": "inline",
        "cache-control": "private, max-age=86400, immutable",
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'; sandbox",
      },
    });
  }
  if (request.method !== "POST")
    return json({ error: "Method not allowed" }, 405);

  const bitId = url.searchParams.get("bit");
  if (!validId(bitId)) return json({ error: "Invalid lesson ID" }, 400);
  if (
    !(await db
      .prepare("SELECT id FROM lessons WHERE id=? AND archived=0")
      .bind(bitId)
      .first())
  )
    return json({ error: "Save the lesson before adding photos" }, 404);

  let name;
  try {
    name = decodeURIComponent(request.headers.get("x-file-name") || "");
  } catch {
    return json({ error: "Invalid filename" }, 400);
  }
  if (!name || name.length > 180 || /[\\/\x00-\x1f]/.test(name))
    return json({ error: "Invalid filename" }, 400);
  const mediaType = imageTypes[name.split(".").at(-1).toLowerCase()];
  if (!mediaType)
    return json({ error: "Choose a JPG, PNG, GIF or WebP photo" }, 415);
  const photoId = request.headers.get("x-upload-id");
  if (!uuid.test(photoId || ""))
    return json({ error: "Invalid upload ID" }, 400);

  let bytes;
  try {
    bytes = await readWorkshopBytes(request);
  } catch (error) {
    return json({ error: error.message }, 413);
  }
  const head = String.fromCharCode(...bytes.subarray(0, 12));
  const matches =
    (mediaType === "image/jpeg" &&
      bytes[0] === 255 &&
      bytes[1] === 216 &&
      bytes[2] === 255) ||
    (mediaType === "image/png" && head.startsWith("\x89PNG\r\n\x1a\n")) ||
    (mediaType === "image/gif" && /^GIF8[79]a/.test(head)) ||
    (mediaType === "image/webp" &&
      head.startsWith("RIFF") &&
      head.slice(8) === "WEBP");
  if (!matches)
    return json({ error: "Photo contents do not match its filename" }, 415);

  const hash = await sha256(bytes);
  const key = photoPrefix + photoId;
  const prior = await db
    .prepare("SELECT * FROM lesson_photos WHERE id=?")
    .bind(photoId)
    .first();
  if (prior) {
    // A retry of an upload whose response was lost: same bit, same bytes.
    if (prior.bit_id !== bitId || prior.sha256 !== hash || prior.archived)
      return json(
        { error: "This upload ID belongs to a different photo" },
        409,
      );
    return json({ id: photoId, title: prior.title }, 201);
  }
  // Bytes first, then the record: a failure leaves an orphan object (kept by
  // whole-site backups), never a record pointing at missing bytes.
  const saved = await env.PHOTOS.put(key, bytes, {
    onlyIf: { etagDoesNotMatch: "*" },
    httpMetadata: { contentType: mediaType },
    customMetadata: { filename: name, bit: bitId },
  });
  if (saved === null) {
    const existing = await env.PHOTOS.get(key);
    if (
      !existing ||
      existing.customMetadata?.bit !== bitId ||
      existing.size !== bytes.length ||
      (await sha256(new Uint8Array(await existing.arrayBuffer()))) !== hash
    )
      return json({ error: "Upload ID collision. Try again." }, 409);
  }
  await db
    .prepare(
      `INSERT OR IGNORE INTO lesson_photos(id,bit_id,title,r2_key,media_type,size,sha256,created_at)
 VALUES(?,?,?,?,?,?,?,?)`,
    )
    .bind(
      photoId,
      bitId,
      name,
      key,
      mediaType,
      bytes.length,
      hash,
      new Date().toISOString(),
    )
    .run();
  const confirmed = await db
    .prepare("SELECT * FROM lesson_photos WHERE id=?")
    .bind(photoId)
    .first();
  if (
    !confirmed ||
    confirmed.bit_id !== bitId ||
    confirmed.sha256 !== hash ||
    confirmed.archived
  )
    return json({ error: "Upload ID collision. Try again." }, 409);
  return json({ id: photoId, title: confirmed.title }, 201);
}
