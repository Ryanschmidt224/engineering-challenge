import { createHash } from "node:crypto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { TestD1 } from "./helpers/d1.mjs";
import { TestR2 } from "./helpers/r2.mjs";
import { siteBackupEntries } from "../functions/api/site-data-backup.js";
import { backupHash } from "../assets/site-data-backup-model.js";

async function archive(entries) {
  let digest = "";
  const lines = [];
  for (const entry of entries) {
    const line = JSON.stringify(entry);
    digest = await backupHash(digest, line);
    lines.push(line);
  }
  lines.push(JSON.stringify({ type: "complete", sha256: digest }));
  return lines.join("\n") + "\n";
}
test("offline verifier rejects invalid archive protocols even when the outer checksum is recomputed", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "bs-verifier-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const db = new TestD1();
  t.after(() => db.close());
  const PHOTOS = new TestR2();
  await db
    .prepare("CREATE TABLE content(id INTEGER PRIMARY KEY,value TEXT)")
    .run();
  await db
    .prepare("INSERT INTO content VALUES(?,?)")
    .bind(1, "Power supply Ω")
    .run();
  await PHOTOS.put("photos/Ω.png", "sample bytes");
  await PHOTOS.put("empty-file", new Uint8Array());
  for (const object of PHOTOS.objects.values())
    object.etag = createHash("md5").update(object.bytes).digest("hex");
  const entries = [];
  for await (const entry of siteBackupEntries({ WORKSHOP_DB: db, PHOTOS }))
    entries.push(entry);
  const verify = async (text, name) => {
    const path = join(directory, name + ".bsbackup"),
      extract = join(directory, name + "-extract");
    await writeFile(path, text);
    const result = spawnSync(
      "python",
      ["scripts/verify-site-backup.py", path, "--extract", extract],
      { encoding: "utf8" },
    );
    return { ...result, extract };
  };
  const valid = await verify(await archive(entries), "valid");
  assert.equal(valid.status, 0, valid.stderr);
  assert.match(valid.stdout, /1 database rows and 2 stored objects/);
  const index = (type) => entries.findIndex((entry) => entry.type === type),
    edit = (type, patch) => {
      const copy = structuredClone(entries);
      Object.assign(copy[index(type)], patch);
      return copy;
    };
  const cases = [
    ["no-manifest", entries.slice(1)],
    ["unsupported-version", edit("manifest", { version: 2 })],
    ["wrong-format", edit("manifest", { format: "other-backup" })],
    ["unsafe-exclusion", edit("manifest", { excludedPrefixes: ["users/"] })],
    ["duplicate-manifest", [entries[0], ...entries]],
    ["missing-schema", entries.filter((entry) => entry.type !== "schema")],
    [
      "duplicate-schema",
      [...entries.slice(0, 2), entries[1], ...entries.slice(2)],
    ],
    [
      "unknown-record",
      [...entries.slice(0, -1), { type: "unexpected" }, entries.at(-1)],
    ],
    ["undeclared-table", edit("row", { table: "not_in_schema" })],
    [
      "invalid-row",
      edit("row", { value: { id: 1, value: { nested: "not a SQL scalar" } } }),
    ],
    ["missing-verified", entries.slice(0, -1)],
    ["duplicate-verified", [...entries, entries.at(-1)]],
    ["wrong-database-hash", edit("verified", { databaseHash: "0".repeat(64) })],
    [
      "wrong-inventory-hash",
      edit("verified", { objectInventoryHash: "0".repeat(64) }),
    ],
    ["wrong-file-count", edit("verified", { files: 99 })],
    [
      "row-after-objects",
      [...entries.slice(0, -1), entries[index("row")], entries.at(-1)],
    ],
    ["negative-size", edit("object", { size: -1 })],
    [
      "same-size-content-corruption",
      edit("bytes", { data: Buffer.from("tamper bytes").toString("base64") }),
    ],
    ["missing-bytes-data", edit("bytes", { data: undefined })],
    ["missing-end-key", edit("end_object", { key: undefined })],
    ["missing-end-size", edit("end_object", { size: undefined })],
    [
      "object-overrun",
      [
        ...entries.slice(0, index("object") + 1),
        { type: "bytes", data: "YQ==" },
        ...entries.slice(index("object") + 1),
      ],
    ],
    [
      "duplicate-object",
      [...entries.slice(0, -1), entries[index("object")], entries.at(-1)],
    ],
    [
      "bytes-without-object",
      [
        ...entries.slice(0, 3),
        { type: "bytes", data: "YQ==" },
        ...entries.slice(3),
      ],
    ],
    ["wrong-end-key", edit("end_object", { key: "other-key" })],
    [
      "unfinished-object",
      entries.filter((entry, i) => i !== index("end_object")),
    ],
  ];
  for (const [name, records] of cases)
    await t.test(name, async () => {
      const result = await verify(await archive(records), name);
      assert.notEqual(result.status, 0, "Accepted " + name);
      if (name === "same-size-content-corruption")
        assert.match(result.stderr, /Object content checksum mismatch/);
      await assert.rejects(access(result.extract));
    });
  const missing = await verify(
    await archive(edit("bytes", { data: undefined })),
    "missing-field-message",
  );
  assert.match(missing.stderr, /Object bytes require a base64 data string/);
  assert.doesNotMatch(missing.stderr, /KeyError/);
  for (const etag of ["0".repeat(32) + "-2", "legacy-opaque-etag"]) {
    const copy = structuredClone(entries);
    copy[index("object")].etag = etag;
    let inventoryHash = "";
    for (const record of copy.filter((record) => record.type === "object")) {
      const { type, ...meta } = record;
      inventoryHash = await backupHash(inventoryHash, JSON.stringify(meta));
    }
    copy.at(-1).objectInventoryHash = inventoryHash;
    const result = await verify(await archive(copy), "non-md5-" + etag);
    assert.equal(result.status, 0, result.stderr);
  }
  const duplicate = (await archive(entries)).replace(
    '\"version\":1',
    '\"version\":1,\"version\":1',
  );
  const duplicateResult = await verify(duplicate, "duplicate-json");
  assert.notEqual(duplicateResult.status, 0);
  assert.match(duplicateResult.stderr, /Duplicate JSON property/);
  await assert.rejects(access(duplicateResult.extract));
  for (const [name, text] of [
    ["completion-only", '{"type":"complete","sha256":""}\n'],
    ["truncated-line", (await archive(entries)).trimEnd()],
    ["after-completion", (await archive(entries)) + "{}\n"],
  ])
    await t.test(name, async () => {
      const result = await verify(text, name);
      assert.notEqual(result.status, 0, "Accepted " + name);
      await assert.rejects(access(result.extract));
    });
});
