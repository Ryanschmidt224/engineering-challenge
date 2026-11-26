// Operator utility: verify a downloaded Workshop export and restore its catalog
// into an isolated SQLite database. Never connects to production or deletes data.
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";
import {
  allSchemaStatements,
  latestSchemaVersion,
} from "../functions/api/workshop-migrations.js";
import {
  validateFamilyFields,
  validateFamilyValues,
  isWebUrl,
} from "../assets/family-model.js";
import { validateTile, validateLink } from "../assets/knowledge-model.js";

const names = [
  "categories",
  "families",
  "fields",
  "products",
  "uses",
  "attachments",
];
const jsonColumns = new Set([
  "choices",
  "supplier_links",
  "field_values",
  "project_state",
  "sources",
  "lookup_provenance",
]);
// Export format 2 adds Knowledge. Format 1 files (no Knowledge) still restore.
const knowledgeNames = ["knowledge_tiles", "knowledge_links"];
export const supportedVersions = [1, 2];
export function restoreCatalog(catalog, db, version = 2) {
  if (!catalog || names.some((name) => !Array.isArray(catalog[name])))
    throw Error("Incomplete catalog");
  if (
    version >= 2 &&
    knowledgeNames.some((name) => !Array.isArray(catalog[name]))
  )
    throw Error("Incomplete catalog: Knowledge is missing");
  if (version < 2 && knowledgeNames.some((name) => name in catalog))
    throw Error("Unexpected Knowledge records in a format 1 backup");
  if (
    db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'workshop_%'",
      )
      .get()
  )
    throw Error("Restore requires an empty destination database");
  db.exec("PRAGMA foreign_keys=ON; BEGIN");
  try {
    for (const sql of allSchemaStatements()) db.exec(sql);
    for (const name of names) {
      const table = "workshop_" + name,
        columns = new Set(
          db
            .prepare("PRAGMA table_info(" + table + ")")
            .all()
            .map((row) => row.name),
        );
      let rows = catalog[name];
      if (name === "categories") {
        rows = [];
        const pending = [...catalog.categories],
          seen = new Set();
        while (pending.length) {
          const index = pending.findIndex(
            (row) => !row.parent_id || seen.has(row.parent_id),
          );
          if (index < 0) throw Error("Missing or circular category parent");
          const [row] = pending.splice(index, 1);
          rows.push(row);
          seen.add(row.id);
        }
      }
      for (const row of rows) {
        const keys = Object.keys(row);
        if (keys.some((key) => !columns.has(key)))
          throw Error("Unknown catalog column");
        db.prepare(
          `INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?")})`,
        ).run(
          ...keys.map((key) =>
            jsonColumns.has(key) ? JSON.stringify(row[key]) : row[key],
          ),
        );
      }
    }
    for (const family of catalog.families) {
      const fields = catalog.fields.filter(
        (field) => field.family_id === family.id,
      );
      validateFamilyFields(fields);
      for (const record of [...catalog.products, ...catalog.uses].filter(
        (record) => record.family_id === family.id,
      ))
        validateFamilyValues(fields, record.field_values);
    }
    for (const file of catalog.attachments)
      if (file.url && !isWebUrl(file.url))
        throw Error("Unsafe attachment link");
    if (version >= 2)
      for (const name of knowledgeNames) {
        const columns = new Set(
          db
            .prepare("PRAGMA table_info(" + name + ")")
            .all()
            .map((row) => row.name),
        );
        for (const row of catalog[name]) {
          if (name === "knowledge_tiles") validateTile(row);
          else validateLink(row);
          const keys = Object.keys(row);
          if (keys.some((key) => !columns.has(key)))
            throw Error("Unknown Knowledge column");
          db.prepare(
            `INSERT INTO ${name} (${keys.join(",")}) VALUES (${keys.map(() => "?")})`,
          ).run(
            ...keys.map((key) =>
              jsonColumns.has(key) ? JSON.stringify(row[key]) : row[key],
            ),
          );
        }
      }
    if (db.prepare("PRAGMA foreign_key_check").all().length)
      throw Error("Broken catalog references");
    db.prepare(
      "INSERT INTO workshop_meta(key,value) VALUES('schema',?),('seed','1')",
    ).run(String(latestSchemaVersion));
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

// Lines are consumed incrementally. Each file is hashed as chunks arrive, so a
// large export need not fit in memory. A missing trailer is a failed backup.
export async function verifyWorkshopBackup(
  lines,
  { onChunk = async () => {} } = {},
) {
  let header = false,
    catalog = null,
    complete = false,
    current = null,
    count = 0,
    total = 0;
  const files = new Map();
  for await (const raw of lines) {
    if (!raw.trim()) continue;
    if (complete) throw Error("Unexpected records after backup trailer");
    const line = JSON.parse(raw);
    if (!header) {
      if (
        line.type !== "header" ||
        line.format !== "buildingschmidt-workshop" ||
        !supportedVersions.includes(line.version)
      )
        throw Error("Unsupported backup header");
      header = line.version;
      continue;
    }
    if (!catalog) {
      if (line.type !== "catalog") throw Error("Missing catalog");
      catalog = line.data;
      const db = new DatabaseSync(":memory:");
      try {
        restoreCatalog(catalog, db, header);
      } finally {
        db.close();
      }
      continue;
    }
    if (line.type === "file") {
      if (
        current ||
        files.has(line.key) ||
        !/^workshop-v2\/files\/[a-f0-9-]{36}$/i.test(line.key) ||
        !Number.isInteger(line.size) ||
        line.size < 1 ||
        line.size > 10 * 1024 * 1024 ||
        !/^[a-f0-9]{64}$/.test(line.sha256)
      )
        throw Error("Invalid or duplicate backup file");
      current = { ...line, offset: 0, hash: createHash("sha256") };
      continue;
    }
    if (line.type === "data") {
      if (
        !current ||
        line.key !== current.key ||
        line.offset !== current.offset ||
        typeof line.data !== "string" ||
        line.data.length > 262144 ||
        !line.data.length ||
        line.data.length % 4 ||
        !/^[A-Za-z0-9+/]*={0,2}$/.test(line.data)
      )
        throw Error("Invalid backup chunk");
      const bytes = Buffer.from(line.data, "base64");
      if (bytes.toString("base64") !== line.data)
        throw Error("Invalid chunk encoding");
      current.offset += bytes.length;
      if (current.offset > current.size)
        throw Error("File exceeds declared size");
      current.hash.update(bytes);
      await onChunk(current.key, line.offset, bytes);
      continue;
    }
    if (line.type === "file-end") {
      if (
        !current ||
        line.key !== current.key ||
        current.offset !== current.size ||
        current.hash.digest("hex") !== current.sha256
      )
        throw Error("File length or checksum mismatch");
      files.set(current.key, current.size);
      count++;
      total += current.size;
      current = null;
      continue;
    }
    if (line.type === "complete") {
      if (current || line.fileCount !== count || line.totalBytes !== total)
        throw Error("Backup totals do not match");
      for (const file of catalog.attachments)
        if (
          file.r2_key &&
          (!files.has(file.r2_key) || files.get(file.r2_key) !== file.size)
        )
          throw Error("Attachment bytes are missing or the wrong size");
      complete = true;
      continue;
    }
    throw Error("Unexpected backup record");
  }
  if (!complete) throw Error("Backup is incomplete (no verified trailer)");
  return { catalog, fileCount: count, totalBytes: total };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  if (process.argv.length !== 3) {
    console.error(
      "Usage: node scripts/workshop-backup.mjs downloaded-workshop.ndjson",
    );
    process.exitCode = 1;
  } else
    try {
      const result = await verifyWorkshopBackup(
        createInterface({
          input: createReadStream(process.argv[2]),
          crlfDelay: Infinity,
        }),
      );
      console.log(
        JSON.stringify({
          verified: true,
          files: result.fileCount,
          bytes: result.totalBytes,
          records: Object.fromEntries(
            [...names, ...knowledgeNames]
              .filter((name) => Array.isArray(result.catalog[name]))
              .map((name) => [name, result.catalog[name].length]),
          ),
        }),
      );
    } catch (error) {
      console.error("Backup verification failed: " + error.message);
      process.exitCode = 1;
    }
}
