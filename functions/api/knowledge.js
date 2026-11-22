// Knowledge tiles and their links. Same conventions as the Workshop API:
// owner session, same-origin mutations, revision checks for stale tabs,
// archive instead of delete.
import {isAdmin} from "./auth.js";
import {initializeWorkshop} from "./workshop-db.js";
import {validateTile, validateLink} from "../../assets/knowledge-model.js";
import {validId} from "../../assets/family-model.js";

const headers = {"cache-control": "private, no-store", "x-content-type-options": "nosniff"};
const json = (data, status = 200) => Response.json(data, {status, headers});
const conflict = () =>
  json({error: "This record changed in another tab. Your draft is preserved.", code: "KNOWLEDGE_CONFLICT"}, 409);
const tables = {tile: "knowledge_tiles", link: "knowledge_links"};

function parseTile(row) {
  return row && {...row, sources: JSON.parse(row.sources)};
}

// Resolve link targets to their current label and state. A target that no
// longer exists is reported as missing (with its last known label), an
// archived one as archived. Nothing is hidden silently.
async function describeTargets(db, links) {
  const familyIds = [...new Set(links.filter((link) => link.target_type === "family").map((link) => link.target_id))];
  const families = new Map();
  if (familyIds.length) {
    const rows = (
      await db
        .prepare(`SELECT id,name,archived FROM workshop_families WHERE id IN (${familyIds.map(() => "?").join(",")})`)
        .bind(...familyIds)
        .all()
    ).results;
    for (const row of rows) families.set(row.id, row);
  }
  return links.map((link) => {
    const family = link.target_type === "family" ? families.get(link.target_id) : null;
    const state = !family ? "missing" : family.archived ? "archived" : "available";
    return {...link, target_name: family?.name || link.target_label, target_state: state};
  });
}

export async function knowledgeSnapshot(db) {
  const [tiles, links] = await db.batch([
    db.prepare("SELECT * FROM knowledge_tiles ORDER BY title COLLATE NOCASE"),
    db.prepare("SELECT * FROM knowledge_links ORDER BY created_at"),
  ]);
  return {tiles: tiles.results.map(parseTile), links: links.results};
}

async function saveTile(db, input) {
  const tile = validateTile(input.record);
  const now = new Date().toISOString();
  const values = [tile.type, tile.title, tile.summary, tile.body, tile.status, JSON.stringify(tile.sources)];
  const result =
    input.expectedRevision === null
      ? await db
          .prepare(
            `INSERT INTO knowledge_tiles(id,type,title,summary,body,status,sources,created_at,updated_at)
 SELECT ?,?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM knowledge_tiles WHERE id=?)`,
          )
          .bind(tile.id, ...values, now, now, tile.id)
          .run()
      : await db
          .prepare(
            `UPDATE knowledge_tiles SET type=?,title=?,summary=?,body=?,status=?,sources=?,updated_at=?,revision=revision+1
 WHERE id=? AND revision=?`,
          )
          .bind(...values, now, tile.id, input.expectedRevision)
          .run();
  if (!result.meta.changes) return null;
  return parseTile(await db.prepare("SELECT * FROM knowledge_tiles WHERE id=?").bind(tile.id).first());
}

async function saveLink(db, input) {
  const link = validateLink(input.record);
  if (input.expectedRevision !== null) {
    // Only the relation and note of an existing link can change; a different
    // target is a different link.
    const result = await db
      .prepare("UPDATE knowledge_links SET relation=?,note=?,revision=revision+1 WHERE id=? AND tile_id=? AND revision=?")
      .bind(link.relation, link.note, link.id, link.tile_id, input.expectedRevision)
      .run();
    return result.meta.changes ? db.prepare("SELECT * FROM knowledge_links WHERE id=?").bind(link.id).first() : null;
  }
  const tile = await db.prepare("SELECT id FROM knowledge_tiles WHERE id=?").bind(link.tile_id).first();
  if (!tile) throw Error("Save the tile before adding links.");
  const family = await db.prepare("SELECT name FROM workshop_families WHERE id=? AND archived=0").bind(link.target_id).first();
  if (!family) throw Error("Choose an active Workshop family.");
  const result = await db
    .prepare(
      `INSERT INTO knowledge_links(id,tile_id,target_type,target_id,target_label,relation,note,created_at)
 SELECT ?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM knowledge_links WHERE id=?)`,
    )
    .bind(link.id, link.tile_id, link.target_type, link.target_id, family.name, link.relation, link.note, new Date().toISOString(), link.id)
    .run();
  return result.meta.changes ? db.prepare("SELECT * FROM knowledge_links WHERE id=?").bind(link.id).first() : null;
}

function checkRevision(value) {
  if (value !== null && (!Number.isInteger(value) || value < 1)) throw Error("Provide the revision you opened, or null for a new record.");
}

export async function handleKnowledge(request, env) {
  if (!(await isAdmin(request, env))) return json({error: "Owner sign-in required"}, 401);
  if (!["GET", "HEAD"].includes(request.method) && request.headers.get("origin") !== new URL(request.url).origin)
    return json({error: "Invalid request origin"}, 403);
  if (!env.WORKSHOP_DB) return json({error: "Workshop database is not configured", code: "WORKSHOP_SETUP_REQUIRED"}, 503);
  const db = env.WORKSHOP_DB;
  await initializeWorkshop(db);

  if (request.method === "GET") {
    const snapshot = await knowledgeSnapshot(db);
    return json({tiles: snapshot.tiles, links: await describeTargets(db, snapshot.links)});
  }
  if (!["POST", "PATCH"].includes(request.method)) return json({error: "Method not allowed"}, 405);

  let input;
  try {
    const raw = await request.text();
    if (raw.length > 64 * 1024) return json({error: "Record is too large"}, 413);
    input = JSON.parse(raw);
    if (!input || !tables[input.entity]) throw Error("Invalid knowledge request.");
    checkRevision(input.expectedRevision);

    if (request.method === "PATCH") {
      // Archiving a tile does not touch its links (so restoring it does not
      // resurrect links that were removed on purpose), nor any target.
      if (!validId(input.id) || typeof input.archived !== "boolean" || input.expectedRevision === null)
        throw Error("Invalid archive request.");
      const result = await db
        .prepare(`UPDATE ${tables[input.entity]} SET archived=?,revision=revision+1 WHERE id=? AND revision=?`)
        .bind(input.archived ? 1 : 0, input.id, input.expectedRevision)
        .run();
      return result.meta.changes ? json({ok: true}) : conflict();
    }

    const record = input.entity === "tile" ? await saveTile(db, input) : await saveLink(db, input);
    if (!record) return conflict();
    if (input.entity === "link") return json({record: (await describeTargets(db, [record]))[0]});
    return json({record});
  } catch (error) {
    const message = String(error?.message || error);
    if (/UNIQUE constraint/.test(message))
      return json({error: "This tile already has that link.", code: "KNOWLEDGE_DUPLICATE"}, 409);
    if (/FOREIGN KEY/.test(message)) return json({error: "The tile for this link no longer exists."}, 400);
    if (/CHECK constraint/.test(message)) return json({error: "A required value is missing or too long."}, 400);
    return json({error: message.slice(0, 300)}, 400);
  }
}
