// Knowledge tiles and their links. Same conventions as the Workshop API:
// owner session, same-origin mutations, revision checks for stale tabs,
// archive instead of delete.
import {isAdmin} from "./auth.js";
import {initializeWorkshop} from "./workshop-db.js";
import {validateTile, validateLink} from "../../assets/knowledge-model.js";
import {validId} from "../../assets/family-model.js";
import {resolveTargets, describeTargets, contextTargets, key} from "./knowledge-targets.js";

const headers = {"cache-control": "private, no-store", "x-content-type-options": "nosniff"};
const json = (data, status = 200) => Response.json(data, {status, headers});
const conflict = () =>
  json({error: "This record changed in another tab. Your draft is preserved.", code: "KNOWLEDGE_CONFLICT"}, 409);
const tables = {tile: "knowledge_tiles", link: "knowledge_links"};

function parseTile(row) {
  return row && {...row, sources: JSON.parse(row.sources)};
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

async function saveLink(env, db, input) {
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
  const target = (await resolveTargets(env, db, [link])).get(key(link));
  if (target.state !== "available") throw Error("Choose something that exists and is not archived.");
  // A project part's project comes from the part itself, never from the request.
  const project = link.target_type === "use" ? target.project_id : link.target_project_id;
  const result = await db
    .prepare(
      `INSERT INTO knowledge_links(id,tile_id,target_type,target_id,target_project_id,target_label,relation,note,created_at)
 SELECT ?,?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM knowledge_links WHERE id=?)`,
    )
    .bind(link.id, link.tile_id, link.target_type, link.target_id, project, target.name, link.relation, link.note, new Date().toISOString(), link.id)
    .run();
  return result.meta.changes ? db.prepare("SELECT * FROM knowledge_links WHERE id=?").bind(link.id).first() : null;
}

// Tiles that apply to something, with the explicit links that make them apply.
// One entry per tile; archived tiles and removed links are left out.
async function relatedTiles(db, type, id) {
  const targets = await contextTargets(db, type, id);
  if (targets === null) throw Error("Unknown context.");
  if (!targets.length) return [];
  const clauses = targets.map(() => "(l.target_type=? AND l.target_id=?)").join(" OR ");
  const rows = (
    await db
      .prepare(
        `SELECT l.target_type,l.target_id,l.relation,l.note,t.* FROM knowledge_links l JOIN knowledge_tiles t ON t.id=l.tile_id
 WHERE l.archived=0 AND t.archived=0 AND (${clauses}) ORDER BY t.title COLLATE NOCASE`,
      )
      .bind(...targets.flatMap((target) => [target.target_type, target.target_id]))
      .all()
  ).results;
  const tiles = new Map();
  for (const row of rows) {
    const {target_type, target_id, relation, note, ...tile} = row;
    if (!tiles.has(tile.id)) tiles.set(tile.id, {...parseTile(tile), via: []});
    tiles.get(tile.id).via.push({target_type, target_id, relation, note});
  }
  return [...tiles.values()];
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
    const url = new URL(request.url);
    if (url.searchParams.has("related")) {
      const id = url.searchParams.get("id");
      if (!validId(id)) return json({error: "Invalid ID"}, 400);
      try {
        return json({tiles: await relatedTiles(db, url.searchParams.get("related"), id)});
      } catch (error) {
        return json({error: error.message}, 400);
      }
    }
    const snapshot = await knowledgeSnapshot(db);
    return json({tiles: snapshot.tiles, links: await describeTargets(env, db, snapshot.links)});
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

    const record = input.entity === "tile" ? await saveTile(db, input) : await saveLink(env, db, input);
    if (!record) return conflict();
    if (input.entity === "link") return json({record: (await describeTargets(env, db, [record]))[0]});
    return json({record});
  } catch (error) {
    const message = String(error?.message || error);
    if (/UNIQUE constraint/.test(message))
      return json({error: "This tile already has that link.", code: "KNOWLEDGE_DUPLICATE"}, 409);
    if (/Unexpected token|JSON/.test(message)) return json({error: "Invalid request."}, 400);
    if (/FOREIGN KEY/.test(message)) return json({error: "The tile for this link no longer exists."}, 400);
    if (/CHECK constraint/.test(message)) return json({error: "A required value is missing or too long."}, 400);
    return json({error: message.slice(0, 300)}, 400);
  }
}
