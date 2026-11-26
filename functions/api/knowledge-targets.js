// Info Bits resolve against the current D1 app. Missing historical targets keep
// their saved labels; no retired R2 project reader is needed to render a tile.
import { projectEngineSchemaReady } from "./project-engine-migrations.js";
const rows = async (db, sql, ...values) =>
  (
    await db
      .prepare(sql)
      .bind(...values)
      .all()
  ).results;
export const key = (t) =>
  [t.target_type, t.target_project_id || "", t.target_id].join(":");
const projectFence = `p.owner_id=? AND p.restore_job_id IS NULL AND NOT EXISTS(SELECT 1 FROM engine_project_deletions d WHERE d.project_id=p.id)`;
export async function resolveTargets(env, db, wanted, actorId) {
  const found = new Map();
  const ids = (type) =>
    JSON.stringify([
      ...new Set(
        wanted.filter((t) => t.target_type === type).map((t) => t.target_id),
      ),
    ]);
  const catalog = new Map();
  for (const [type, table, name] of [
    ["tile", "knowledge_tiles", "title"],
    ["family", "workshop_families", "name"],
    ["product", "workshop_products", "name"],
  ]) {
    const result = await rows(
      db,
      `SELECT *,${name} AS name FROM ${table} WHERE id IN (SELECT value FROM json_each(?))`,
      ids(type),
    );
    catalog.set(type, new Map(result.map((row) => [row.id, row])));
  }
  const projects = new Map(),
    scoped = new Map();
  if (
    wanted.some((t) => ["project", "use", "record"].includes(t.target_type)) &&
    actorId &&
    (await projectEngineSchemaReady(db))
  ) {
    const projectIds = [
      ...new Set(
        wanted
          .map((t) =>
            t.target_type === "project" ? t.target_id : t.target_project_id,
          )
          .filter(Boolean),
      ),
    ];
    for (const row of await rows(
      db,
      `SELECT p.id,p.name FROM engine_projects p WHERE ${projectFence} AND p.id IN (SELECT value FROM json_each(?))`,
      actorId,
      JSON.stringify(projectIds),
    ))
      projects.set(row.id, row);
    for (const type of ["use", "record"]) {
      const pairs = wanted
        .filter(
          (t) => t.target_type === type && projects.has(t.target_project_id),
        )
        .map((t) => ({ project: t.target_project_id, id: t.target_id }));
      if (!pairs.length) continue;
      const table = type === "use" ? "engine_items" : "engine_records",
        item = type === "use" ? "t.id" : "t.item_id",
        name =
          type === "use"
            ? "t.name"
            : "COALESCE(NULLIF(t.title,''),'Untitled record')",
        stepJoin =
          type === "record"
            ? "LEFT JOIN engine_steps g ON g.project_id=t.project_id AND g.id=t.step_id"
            : "",
        retired = type === "record" ? " OR g.retired_at IS NOT NULL" : "";
      const result = await rows(
        db,
        `SELECT t.*,${name} AS name,${item} AS item_id,(NOT EXISTS(SELECT 1 FROM engine_occurrences o WHERE o.project_id=t.project_id AND o.item_id=${item} AND o.removed_at IS NULL)${retired}) AS archived FROM ${table} t ${stepJoin} WHERE EXISTS(SELECT 1 FROM json_each(?) j WHERE json_extract(j.value,'$.project')=t.project_id AND json_extract(j.value,'$.id')=t.id)`,
        JSON.stringify(pairs),
      );
      scoped.set(
        type,
        new Map(result.map((row) => [[row.project_id, row.id].join(":"), row])),
      );
    }
  }
  for (const target of wanted) {
    let row = catalog.get(target.target_type)?.get(target.target_id),
      project = null;
    if (target.target_type === "project") row = projects.get(target.target_id);
    if (
      ["use", "record"].includes(target.target_type) &&
      projects.has(target.target_project_id)
    ) {
      project = projects.get(target.target_project_id);
      row = scoped
        .get(target.target_type)
        ?.get([project.id, target.target_id].join(":"));
    }
    found.set(key(target), {
      name: row?.name || "",
      state: !row ? "missing" : row.archived ? "archived" : "available",
      project_id: project?.id || null,
      project_name: project?.name || "",
      row,
    });
  }
  return found;
}
export async function describeTargets(env, db, links, actorId) {
  const found = await resolveTargets(env, db, links, actorId);
  return links.map((link) => {
    const target = found.get(key(link));
    return {
      ...link,
      target_name: target.name || link.target_label,
      target_state: target.state,
      target_project_name: target.project_name,
      target_item_id: target.row?.item_id || null,
    };
  });
}
export async function contextTargets(db, type, id) {
  if (["family", "project", "tile"].includes(type))
    return [{ target_type: type, target_id: id, via: type }];
  if (type === "product") {
    const product = await db
      .prepare("SELECT id,family_id FROM workshop_products WHERE id=?")
      .bind(id)
      .first();
    return product
      ? [
          { target_type: "product", target_id: id, via: "product" },
          {
            target_type: "family",
            target_id: product.family_id,
            via: "family",
          },
        ]
      : [];
  }
  return null;
}
