import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { build } from "esbuild";
import { Miniflare, Log, LogLevel } from "miniflare";
import { provisionTestAccount } from "./helpers/accounts.mjs";
import {
  backupDataLines,
  siteBackupReader,
} from "../assets/site-data-backup-model.js";

const origin = "https://isolated-recovery.example.test";
const checksum = (bytes) => createHash("sha256").update(bytes).digest("hex");
const quote = (name) => '"' + name.replaceAll('"', '""') + '"';

for (const automaticMode of [false, true])
  test(
    (automaticMode ? "automatic" : "manual") +
      " whole-site backup reconstructs independent D1/R2 stores and a working authenticated application",
    { timeout: 180000 },
    async () => {
      const root = await mkdtemp(join(tmpdir(), "bs-whole-site-recovery-"));
      // The extra route exists only in this disposable test bundle; production
      // worker.js is unchanged. It invokes the real nightly backup implementation.
      const entry = `import worker from ${JSON.stringify(resolve("worker.js"))};import {runScheduledProjectBackups} from ${JSON.stringify(resolve("functions/api/automatic-backup-status.js"))};import {automaticSiteBackup} from ${JSON.stringify(resolve("functions/api/site-auto-backups.js"))};export default {async fetch(request,env,ctx){if(new URL(request.url).pathname==='/__recovery_test__/site')return Response.json(await automaticSiteBackup(env,new Date(new URL(request.url).searchParams.get('date')||'2026-11-26T09:17:00Z')));if(new URL(request.url).pathname==='/__recovery_test__/nightly')return Response.json(await runScheduledProjectBackups(env,new Date(new URL(request.url).searchParams.get('date')||'2026-11-26T09:17:00Z')));return worker.fetch(request,env,ctx);}};`;
      const bundled = await build({
        stdin: { contents: entry, resolveDir: resolve(".") },
        bundle: true,
        write: false,
        format: "esm",
        platform: "browser",
      });
      // The signing secret is deployment configuration, supplied independently of
      // the data archive. These values and every stored record are synthetic.
      const secret = "synthetic-isolated-recovery-secret";
      const options = (side) => ({
        modules: true,
        script: bundled.outputFiles[0].text,
        compatibilityDate: "2026-07-30",
        bindings: { admin_password: secret },
        d1Databases: { WORKSHOP_DB: "recovery-" + side },
        r2Buckets: { PHOTOS: "recovery-" + side },
        d1Persist: join(root, side, "d1"),
        r2Persist: join(root, side, "r2"),
        log: new Log(LogLevel.ERROR),
      });
      const source = new Miniflare(options("source"));
      let target = new Miniflare(options("target"));
      try {
        const sourceDB = await source.getD1Database("WORKSHOP_DB"),
          sourceBucket = await source.getR2Bucket("PHOTOS");
        await sourceDB
          .prepare(
            "CREATE TABLE recovery_scalar_probe(id INTEGER PRIMARY KEY,n REAL,t TEXT,b BLOB,nullable TEXT)",
          )
          .run();
        await sourceDB
          .prepare("INSERT INTO recovery_scalar_probe VALUES(?,?,?,?,?)")
          .bind(
            1,
            1.25,
            "Recovery 'quoted'; Ω\nsecond line",
            new Uint8Array([0, 255, 13, 10]),
            null,
          )
          .run();
        await sourceBucket.put(
          "legacy/recovery-fixture.bin",
          new Uint8Array(1024 * 1024 + 31).fill(37),
          {
            httpMetadata: {
              contentType: "application/octet-stream",
              cacheExpiry: new Date("2030-01-01T00:00:00Z"),
            },
            customMetadata: { purpose: "synthetic legacy file" },
          },
        );
        const login = await provisionTestAccount(
          new Request(origin + "/api/accounts", {
            method: "POST",
            headers: { origin },
            body: JSON.stringify({
              action: "register",
              email: "owner@recovery.example.test",
              password: "synthetic-recovery-password",
              displayName: "Recovery owner",
            }),
          }),
          { PHOTOS: sourceBucket, admin_password: secret },
          { role: "admin" },
        );
        const cookie = login.headers.get("set-cookie").split(";")[0];
        const raw = (runtime, path, options = {}) =>
          runtime.dispatchFetch(origin + path, {
            ...options,
            headers: { origin, cookie, ...options.headers },
          });
        const json = async (runtime, path, method = "GET", data) => {
          const response = await raw(runtime, path, {
            method,
            ...(data === undefined
              ? {}
              : {
                  body: JSON.stringify(data),
                  headers: { "content-type": "application/json" },
                }),
          });
          assert.ok(response.ok, path + ": " + (await response.clone().text()));
          return response.json();
        };
        const catalog = await json(source, "/api/workshop");
        const family = catalog.families.find(
            (row) => row.id === "f-dc-power-supply",
          ),
          voltage = catalog.fields.find(
            (row) =>
              row.family_id === family.id && row.label === "Output voltage",
          );
        const productId = crypto.randomUUID();
        await json(source, "/api/workshop", "POST", {
          entity: "product",
          expectedRevision: null,
          expectedFamilyRevision: family.revision,
          record: {
            id: productId,
            family_id: family.id,
            name: "Recovery supply",
            manufacturer: "Fixture maker",
            mpn: "RESTORE-24",
            supplier_links: [{ url: "https://example.com/recovery-supply" }],
            notes: "Synthetic catalog record",
            field_values: { [voltage.id]: 24 },
            lookup_provenance: {
              version: 1,
              identityRequired: true,
              appliedAt: new Date().toISOString(),
              fields: {
                [voltage.id]: {
                  value: 24,
                  label: voltage.label,
                  unit: voltage.unit,
                  conditions: "25°C, no load",
                  sourceUrl: "https://example.com/recovery-supply-datasheet",
                },
              },
            },
          },
        });
        const documentBytes = new TextEncoder().encode(
          "%PDF-1.7\nSynthetic recovery datasheet\n",
        );
        const document = await raw(
          source,
          "/api/workshop/file?owner=product&id=" + productId,
          {
            method: "POST",
            body: documentBytes,
            headers: {
              "x-file-name": "recovery-datasheet.pdf",
              "x-upload-id": crypto.randomUUID(),
            },
          },
        );
        assert.equal(document.status, 201, await document.clone().text());
        const documentId = (await document.json()).id;
        // Seed retained pre-notebook data directly: the retired API is no writer.
        const historicalTileId = crypto.randomUUID();
        await sourceDB
          .prepare(
            "INSERT INTO knowledge_tiles(id,type,status,title,summary,body,sources,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            historicalTileId,
            "concept",
            "draft",
            "Recovery note",
            "Keep supply current limited.",
            "Use a fixture; record Ω and measurements.",
            "[]",
            "2026-11-26",
            "2026-11-26",
          )
          .run();
        assert.equal((await raw(source, "/api/knowledge")).status, 410);
        const lessonId = crypto.randomUUID(),
          lessonPhotoId = crypto.randomUUID();
        const lesson = {
          id: lessonId,
          happened: "Recovery lesson",
          steps: [],
          resolution: { text: "Verified recovery", quality: "yes" },
        };
        await json(source, "/api/lessons-learned", "POST", {
          record: lesson,
          expectedRevision: null,
          operationId: crypto.randomUUID(),
        });
        const lessonBytes = new Uint8Array([
          137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 1, 2, 3,
        ]);
        const photo = await raw(
          source,
          "/api/lessons-learned/photo?bit=" + lessonId,
          {
            method: "POST",
            headers: {
              "x-file-name": "lesson.png",
              "x-upload-id": lessonPhotoId,
            },
            body: lessonBytes,
          },
        );
        assert.equal(photo.status, 201, await photo.clone().text());
        lesson.steps = [
          {
            id: crypto.randomUUID(),
            question: "Can it be restored?",
            hypothesis: "Exact bytes",
            result: "Save all storage namespaces.",
            photos: [lessonPhotoId],
          },
        ];
        await json(source, "/api/lessons-learned", "POST", {
          record: lesson,
          expectedRevision: 1,
          operationId: crypto.randomUUID(),
        });
        const projectId = crypto.randomUUID(),
          base = "/api/project-engine/projects/" + projectId;
        let revision = null;
        const command = async (path, data, method = "POST") => {
          const result = await json(source, base + path, method, {
            operationId: crypto.randomUUID(),
            expectedRevision: revision,
            ...data,
          });
          revision = result.revision;
          return result;
        };
        await command("", {
          name: "Whole-site recovery fixture",
          owner_name: "Wes",
        });
        const item = await command("/items", {
          details: {
            name: "Specific supply",
            short_name: "Power supply",
            fields: { name_linked: false, purpose: "Recovery exercise" },
          },
        });
        const step = await command("/items/" + item.itemId + "/steps", {
          title: "Fit board",
          body: "Use fixture; preserve exact notes.",
        });
        await command("/items/" + item.itemId + "/records", {
          stepId: step.stepId,
          record: {
            type: "note",
            title: "Bench observation",
            fields: {
              text: "Passed initial check.\nKeep this historical record.",
            },
          },
        });
        const initialItem = (await json(source, base + "/state")).items[0];
        const savedRevision = await command(
          "/items/" + item.itemId + "/revisions",
          {
            details: {
              name: "Specific supply revised",
              short_name: "Power supply",
              part_number: initialItem.part_number,
              kind: "part",
              source: "custom",
              fields: {
                name_linked: false,
                purpose: "Recovery exercise, revised",
              },
            },
            entryDetails: {
              whatChanged: "Preserve tested configuration",
              whyChanged: "Exercise history recovery",
            },
          },
        );
        const prepared = await command("/files/prepare", {
          name: "recovery-photo.png",
          content_type: "image/png",
        });
        const image = Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
          "base64",
        );
        let response = await raw(
          source,
          base + "/files/" + prepared.fileId + "/bytes",
          {
            method: "PUT",
            body: image,
            headers: {
              "x-operation-id": crypto.randomUUID(),
              "x-project-revision": revision,
            },
          },
        );
        assert.equal(response.status, 200, await response.clone().text());
        await command("/files/" + prepared.fileId + "/admit", {
          role: "support",
        });
        await command("/media", {
          fileId: prepared.fileId,
          caption: "Recovery photo",
        });
        const settings = await json(source, "/api/project-engine/settings");
        await json(source, "/api/project-engine/settings", "PATCH", {
          expectedRevision: settings.revision,
          value: {
            tags: ["Electronics", "Recovery"],
            owners: ["Ryan", "Wes", "Wyatt", "Alex"],
            defaultOwner: "Alex",
          },
        });
        const nightly = await json(
          source,
          "/__recovery_test__/nightly",
          "POST",
          {},
        );
        assert.equal(nightly.state, "success");
        assert.equal(nightly.counts.saved, 1);
        if (automaticMode) {
          await json(source, "/__recovery_test__/site", "POST", {});
          lesson.happened = "Recovery lesson after notebook-only edit";
          await json(source, "/api/lessons-learned", "POST", {
            record: lesson,
            expectedRevision: 2,
            operationId: crypto.randomUUID(),
          });
          await json(
            source,
            "/__recovery_test__/site?date=2026-11-27T09:17:00Z",
            "POST",
            {},
          );
          const workshop = await json(source, "/api/workshop"),
            product = workshop.products.find((p) => p.id === productId);
          await json(source, "/api/workshop", "POST", {
            entity: "product",
            expectedRevision: product.revision,
            expectedFamilyRevision: workshop.families.find(
              (f) => f.id === product.family_id,
            ).revision,
            record: { ...product, notes: "Workshop-only update captured" },
          });
          await json(
            source,
            "/__recovery_test__/site?date=2026-11-28T09:17:00Z",
            "POST",
            {},
          );
          assert.equal(
            (await json(source, base + "/state")).project.revision,
            revision,
          );
          assert.equal(
            (await json(source, "/api/automatic-site-backups")).snapshots
              .length,
            3,
          );
        }
        const paths = [
          "/api/accounts",
          "/api/workshop",
          ...(!automaticMode ? ["/api/backup-status"] : []),
          "/api/lessons-learned",
          "/api/project-engine/settings",
          "/api/project-engine/projects",
          base + "/state",
          base + "/history",
          base + "/history/" + savedRevision.eventId,
          ...(!automaticMode ? [base + "/automatic-backups"] : []),
        ];
        const before = new Map();
        for (const path of paths) before.set(path, await json(source, path));
        const snapshot = before.get(base + "/state");
        assert.equal(snapshot.records.length, 1);
        assert.equal(snapshot.steps.length, 1);
        assert.equal(snapshot.media.length, 1);
        assert.equal(snapshot.items[0].revision_level, 2);
        assert.ok(
          (
            await sourceDB
              .prepare("SELECT COUNT(*) AS n FROM engine_configurations")
              .first()
          ).n >= 2,
        );
        const backupPath = join(
            root,
            "BuildingSchmidtDataBackup-test.bsbackup",
          ),
          chunks = [];
        const fetcher = (path, options) => raw(source, path, options);
        if (automaticMode) {
          const index = await json(source, "/api/automatic-site-backups");
          const download = await raw(
            source,
            "/api/automatic-site-backups?id=" + index.snapshots[0].id,
          );
          assert.equal(download.status, 200);
          chunks.push(Buffer.from(await download.arrayBuffer()));
        } else
          for await (const bytes of backupDataLines(siteBackupReader(fetcher)))
            chunks.push(Buffer.from(bytes));
        await writeFile(backupPath, Buffer.concat(chunks));
        const extraction = join(root, "extracted"),
          verified = spawnSync(
            "python",
            [
              "scripts/verify-site-backup.py",
              backupPath,
              "--extract",
              extraction,
            ],
            { encoding: "utf8" },
          );
        assert.equal(verified.status, 0, verified.stderr);
        const objects = JSON.parse(
          await readFile(join(extraction, "objects.json"), "utf8"),
        );
        if (automaticMode)
          assert.ok(
            !objects.some((object) =>
              object.key.startsWith("automatic-backups/"),
            ),
          );
        let targetDB = await target.getD1Database("WORKSHOP_DB"),
          targetBucket = await target.getR2Bucket("PHOTOS");
        assert.equal(
          (
            await targetDB
              .prepare(
                "SELECT COUNT(*) AS n FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name NOT GLOB '_cf_*' AND name NOT GLOB '__cf_*'",
              )
              .first()
          ).n,
          0,
        );
        assert.equal((await targetBucket.list()).objects.length, 0);
        assert.equal(
          (await raw(target, "/api/project-engine/projects")).status,
          401,
        );
        const split = spawnSync(
          "python",
          ["tests/helpers/recovery-sql.py", join(extraction, "database.sql")],
          { encoding: "utf8" },
        );
        assert.equal(split.status, 0, split.stderr);
        const statements = JSON.parse(split.stdout);
        await targetDB.batch([
          targetDB.prepare("PRAGMA defer_foreign_keys=ON"),
          ...statements.map((sql) => targetDB.prepare(sql)),
        ]);
        for (const object of objects) {
          const bytes = await readFile(join(extraction, object.localFile)),
            httpMetadata = { ...object.httpMetadata };
          if (httpMetadata.cacheExpiry)
            httpMetadata.cacheExpiry = new Date(httpMetadata.cacheExpiry);
          await targetBucket.put(object.key, bytes, {
            httpMetadata,
            customMetadata: object.customMetadata,
          });
        }
        await target.dispose();
        target = new Miniflare(options("target"));
        targetDB = await target.getD1Database("WORKSHOP_DB");
        targetBucket = await target.getR2Bucket("PHOTOS");
        assert.deepEqual(
          (await targetDB.prepare("PRAGMA foreign_key_check").all()).results,
          [],
        );
        // Workshop collections have explicit sort_order fields, but its API does
        // not promise physical insertion order. Compare those collections by ID.
        const comparable = (path, value) =>
          path === "/api/backup-status"
            ? { ...value, observedAt: undefined }
            : path === "/api/workshop"
              ? Object.fromEntries(
                  Object.entries(value).map(([key, rows]) => [
                    key,
                    Array.isArray(rows)
                      ? [...rows].sort((a, b) => a.id.localeCompare(b.id))
                      : rows,
                  ]),
                )
              : value;
        for (const [path, value] of before)
          assert.deepEqual(
            comparable(path, await json(target, path)),
            comparable(path, value),
            path,
          );
        assert.deepEqual(
          await targetDB
            .prepare("SELECT * FROM knowledge_tiles WHERE id=?")
            .bind(historicalTileId)
            .first(),
          await sourceDB
            .prepare("SELECT * FROM knowledge_tiles WHERE id=?")
            .bind(historicalTileId)
            .first(),
          "retired tile evidence survives restart and independent reconstruction",
        );
        assert.equal((await raw(target, "/api/knowledge")).status, 410);
        const restoredLessonPhoto = await raw(
          target,
          "/api/lessons-learned/photo?id=" + lessonPhotoId,
        );
        assert.equal(restoredLessonPhoto.status, 200);
        assert.deepEqual(
          new Uint8Array(await restoredLessonPhoto.arrayBuffer()),
          lessonBytes,
        );
        assert.equal(
          (
            await raw(target, "/api/project-engine/projects", {
              headers: { cookie: "" },
            })
          ).status,
          401,
        );
        const schema = (
          await sourceDB
            .prepare(
              "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT GLOB '_cf_*' AND name NOT GLOB '__cf_*' ORDER BY name",
            )
            .all()
        ).results;
        let rows = 0;
        for (const { name } of schema) {
          const expected = (
              await sourceDB.prepare("SELECT * FROM " + quote(name)).all()
            ).results,
            actual = (
              await targetDB.prepare("SELECT * FROM " + quote(name)).all()
            ).results;
          const sorted = (values) =>
            values
              .map((row) =>
                JSON.stringify(
                  Object.fromEntries(
                    Object.entries(row).map(([key, value]) => [
                      key,
                      value instanceof ArrayBuffer
                        ? { blob: [...new Uint8Array(value)] }
                        : value,
                    ]),
                  ),
                ),
              )
              .sort();
          assert.deepEqual(sorted(actual), sorted(expected), name);
          rows += expected.length;
        }
        for (const object of objects) {
          const expected = await readFile(join(extraction, object.localFile)),
            actual = await targetBucket.get(object.key);
          assert.ok(actual, object.key);
          assert.equal(
            checksum(Buffer.from(await actual.arrayBuffer())),
            checksum(expected),
            object.key,
          );
          assert.deepEqual(
            JSON.parse(JSON.stringify(actual.httpMetadata)),
            object.httpMetadata,
          );
          assert.deepEqual(actual.customMetadata, object.customMetadata);
        }
        response = await raw(
          target,
          base + "/files/" + prepared.fileId + "?inline=1",
        );
        assert.equal(response.status, 200);
        assert.equal(
          checksum(Buffer.from(await response.arrayBuffer())),
          checksum(image),
        );
        response = await raw(target, "/api/workshop/file?id=" + documentId);
        assert.equal(response.status, 200);
        assert.equal(
          checksum(Buffer.from(await response.arrayBuffer())),
          checksum(documentBytes),
        );
        if (!automaticMode) {
          const backups = await json(target, base + "/automatic-backups");
          assert.equal(backups.backups.length, 1);
          response = await raw(
            target,
            base + "/automatic-backups?id=" + backups.backups[0].id,
          );
          assert.equal(response.status, 200);
          const nightlyBytes = await response.text();
          assert.equal(
            JSON.parse(nightlyBytes.split("\n")[0]).manifest.project.id,
            projectId,
          );
          assert.equal(
            JSON.parse(nightlyBytes.trimEnd().split("\n").at(-1)).type,
            "complete",
          );
        } else
          assert.equal(
            (await json(target, base + "/automatic-backups")).backups.length,
            0,
          );
        const nextNight = await json(
          target,
          "/__recovery_test__/nightly?date=2026-11-27T09:17:00Z",
          "POST",
          {},
        );
        assert.equal(nextNight.state, "success");
        assert.equal(
          automaticMode ? nextNight.counts.saved : nextNight.counts.unchanged,
          1,
        );
        assert.equal(
          (await json(target, "/api/backup-status")).lastSuccess.scheduledFor,
          "2026-11-27T09:17:00.000Z",
        );
        if (automaticMode) {
          assert.equal(
            (await json(target, "/api/automatic-site-backups")).health,
            "never",
          );
          // Resume after a terminated writer with real native R2 multipart parts.
          const staleId = "2026-11-25T09-17-00Z-" + crypto.randomUUID(),
            staleKey =
              "automatic-backups/site/snapshots/" + staleId + ".bsbackup";
          const abandoned = await targetBucket.createMultipartUpload(staleKey);
          const abandonedPart = await abandoned.uploadPart(
            1,
            new Uint8Array(8 * 1024 * 1024).fill(19),
          );
          await targetBucket.put(
            "automatic-backups/site/index.json",
            JSON.stringify({
              version: 1,
              snapshots: [],
              pending: { key: staleKey, uploadId: abandoned.uploadId },
              attempt: {
                id: staleId,
                state: "running",
                scheduledFor: "2026-11-25T09:17:00.000Z",
                startedAt: "2026-11-25T09:17:00.000Z",
                expiresAt: "2026-11-25T09:37:00.000Z",
                finishedAt: null,
                error: null,
              },
            }),
          );
          assert.equal(
            (
              await json(
                target,
                "/__recovery_test__/site?date=2026-11-29T09:17:00Z",
                "POST",
                {},
              )
            ).state,
            "saved",
          );
          await assert.rejects(
            abandoned.complete([abandonedPart]),
            /10024|upload.*(exist|abort)/i,
          );
        }
        const account = await json(target, "/api/accounts", "POST", {
          action: "login",
          email: "owner@recovery.example.test",
          password: "synthetic-recovery-password",
        });
        assert.equal(account.user.role, "admin");
        const current = await json(target, base + "/state");
        await json(target, base, "PATCH", {
          operationId: crypto.randomUUID(),
          expectedRevision: current.project.revision,
          name: "Restored independent copy",
        });
        assert.equal(
          (await json(source, base + "/state")).project.name,
          "Whole-site recovery fixture",
        );
        await targetBucket.put("recovery-proof/target-only", "isolated target");
        assert.equal(
          await sourceBucket.get("recovery-proof/target-only"),
          null,
        );
        console.log(
          "ISOLATED_RESTORE_PROOF " +
            JSON.stringify({
              mode: automaticMode ? "automatic" : "manual",
              environment: "local-workerd-D1-R2",
              tables: schema.length,
              rows,
              objects: objects.length,
              applicationRoutes: paths.length,
              foreignKeyErrors: 0,
              coldRestart: true,
              independentWrites: true,
              photoAndDatasheetDownloads: true,
              freshOwnerLogin: true,
              numberedHistory: true,
              automaticBackupDownload: true,
              legacyObject: true,
              binaryAndUnicodeRows: true,
            }),
        );
      } finally {
        await source.dispose();
        await target.dispose();
        await rm(root, { recursive: true, force: true });
      }
    },
  );
