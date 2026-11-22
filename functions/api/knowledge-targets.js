// Resolve what a Knowledge link points at. Targets live in different places
// (D1 Workshop and Knowledge tables, the R2 project catalog, R2 project
// records), so each kind has its own small lookup. A target that no longer
// exists is reported as missing with its last known label; an archived one as
// archived. Nothing disappears silently.
import {readCatalog} from "./projects.js";

const placeholders = (values) => values.map(() => "?").join(",");

async function rowsById(db, sql, ids) {
  if (!ids.length) return new Map();
  const result = await db.prepare(sql.replace("%IDS%", placeholders(ids))).bind(...ids).all();
  return new Map(result.results.map((row) => [row.id, row]));
}

async function projectRecords(env, project) {
  const object = await env.PHOTOS?.get("investigations/" + project + ".json");
  if (!object) return [];
  const saved = JSON.parse(await object.text());
  return Array.isArray(saved.records) ? saved.records : [];
}

// Look up many targets at once. Returns a Map keyed by "type:project:id".
export async function resolveTargets(env, db, wanted) {
  const ids = (type) => [...new Set(wanted.filter((target) => target.target_type === type).map((target) => target.target_id))];
  const [tiles, families, products, uses] = await Promise.all([
    rowsById(db, "SELECT id,title AS name,archived FROM knowledge_tiles WHERE id IN (%IDS%)", ids("tile")),
    rowsById(db, "SELECT id,name,archived FROM workshop_families WHERE id IN (%IDS%)", ids("family")),
    rowsById(db, "SELECT id,name,family_id,archived FROM workshop_products WHERE id IN (%IDS%)", ids("product")),
    rowsById(
      db,
      `SELECT u.id,COALESCE(NULLIF(u.purpose,''),f.name) AS name,u.project_id,u.product_id,u.family_id,u.archived
 FROM workshop_uses u JOIN workshop_families f ON f.id=u.family_id WHERE u.id IN (%IDS%)`,
      ids("use"),
    ),
  ]);

  const needsCatalog = wanted.some((target) => ["project", "use", "record"].includes(target.target_type));
  const projects = new Map();
  if (needsCatalog && env.PHOTOS) {
    for (const project of (await readCatalog(env)).projects) projects.set(project.id, project);
  }
  const records = new Map();
  for (const project of new Set(wanted.filter((target) => target.target_type === "record").map((target) => target.target_project_id))) {
    if (projects.has(project)) records.set(project, await projectRecords(env, project));
  }

  const found = new Map();
  for (const target of wanted) {
    let row = null;
    let archived = false;
    let project = null;
    switch (target.target_type) {
      case "tile":
        row = tiles.get(target.target_id);
        break;
      case "family":
        row = families.get(target.target_id);
        break;
      case "product":
        row = products.get(target.target_id);
        break;
      case "use":
        row = uses.get(target.target_id);
        project = row && projects.get(row.project_id);
        if (row && (!project || project.archived)) archived = true;
        break;
      case "project": {
        const entry = projects.get(target.target_id);
        row = entry && {name: entry.name, archived: entry.archived ? 1 : 0};
        break;
      }
      case "record": {
        const entry = (records.get(target.target_project_id) || []).find((record) => record.id === target.target_id);
        row = entry && {name: entry.title || "Untitled record", archived: entry.lifecycle && entry.lifecycle !== "active" ? 1 : 0};
        project = projects.get(target.target_project_id);
        break;
      }
    }
    const state = !row ? "missing" : row.archived || archived ? "archived" : "available";
    found.set(key(target), {
      name: row?.name || "",
      state,
      project_id: row?.project_id || target.target_project_id || null,
      project_name: project?.name || "",
      row,
    });
  }
  return found;
}

export const key = (target) => [target.target_type, target.target_project_id || "", target.target_id].join(":");

export async function describeTargets(env, db, links) {
  const found = await resolveTargets(env, db, links);
  return links.map((link) => {
    const target = found.get(key(link));
    return {
      ...link,
      target_name: target.name || link.target_label,
      target_state: target.state,
      target_project_name: target.project_name,
    };
  });
}

// The targets whose knowledge applies to something. For a project part that
// is the part itself, its selected product and its family; for a product,
// the product and its family. Explicit links only: no graph traversal.
export async function contextTargets(db, type, id) {
  if (type === "family" || type === "project" || type === "tile") return [{target_type: type, target_id: id, via: type}];
  if (type === "product") {
    const product = await db.prepare("SELECT id,family_id FROM workshop_products WHERE id=?").bind(id).first();
    if (!product) return [];
    return [
      {target_type: "product", target_id: id, via: "product"},
      {target_type: "family", target_id: product.family_id, via: "family"},
    ];
  }
  if (type === "use") {
    const use = await db.prepare("SELECT id,product_id,family_id FROM workshop_uses WHERE id=?").bind(id).first();
    if (!use) return [];
    return [
      {target_type: "use", target_id: id, via: "use"},
      ...(use.product_id ? [{target_type: "product", target_id: use.product_id, via: "product"}] : []),
      {target_type: "family", target_id: use.family_id, via: "family"},
    ];
  }
  return null;
}
