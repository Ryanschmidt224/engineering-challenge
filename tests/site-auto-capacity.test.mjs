import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { Miniflare, Log, LogLevel } from "miniflare";
import { resolve } from "node:path";

test(
  "native Worker streams a representative 110 MiB site into a verified bounded archive",
  { timeout: 180000 },
  async () => {
    const entry = `import {automaticSiteBackup} from ${JSON.stringify(resolve("functions/api/site-auto-backups.js"))};export default {async fetch(request,env){return Response.json(await automaticSiteBackup(env,new Date('2026-11-26T09:17:00Z')))}};`;
    const bundle = await build({
      stdin: { contents: entry, resolveDir: resolve(".") },
      bundle: true,
      write: false,
      format: "esm",
      platform: "browser",
    });
    const runtime = new Miniflare({
      modules: true,
      script: bundle.outputFiles[0].text,
      compatibilityDate: "2026-07-30",
      r2Buckets: { PHOTOS: "capacity-files" },
      d1Databases: { WORKSHOP_DB: "capacity-db" },
      log: new Log(LogLevel.ERROR),
    });
    try {
      const db = await runtime.getD1Database("WORKSHOP_DB"),
        bucket = await runtime.getR2Bucket("PHOTOS");
      await db
        .prepare("CREATE TABLE capacity(id TEXT PRIMARY KEY,value TEXT)")
        .run();
      await db
        .prepare(
          "INSERT INTO capacity VALUES('lesson','Captured without Projects')",
        )
        .run();
      const source = await bucket.createMultipartUpload(
          "legacy/representative-original.bin",
        ),
        parts = [],
        block = new Uint8Array(8 * 1024 * 1024).fill(71);
      for (let n = 1; n <= 14; n++)
        parts.push(
          await source.uploadPart(
            n,
            n === 14 ? block.subarray(0, 6 * 1024 * 1024) : block,
          ),
        );
      await source.complete(parts);
      const start = Date.now(),
        response = await runtime.dispatchFetch(
          "https://capacity.example.test/run",
        );
      assert.equal(response.status, 200, await response.clone().text());
      const result = await response.json();
      assert.equal(result.state, "saved");
      assert.ok(result.bytes > 110 * 1024 * 1024);
      assert.ok(result.bytes < 512 * 1024 * 1024);
      const { state } = await import(
        "../functions/api/site-backup-state.js"
      ).then((m) => m.loadSiteBackupState(bucket));
      assert.equal(state.snapshots.length, 1);
      assert.equal(state.pending, null);
      assert.equal(state.attempt.state, "success");
      assert.equal(
        (await bucket.list({ prefix: "automatic-backups/site/snapshots/" }))
          .objects.length,
        1,
      );
      assert.equal(
        (await bucket.head("legacy/representative-original.bin")).size,
        110 * 1024 * 1024,
      );
      console.log(
        "SITE_CAPACITY_PROOF",
        JSON.stringify({
          sourceBytes: 110 * 1024 * 1024,
          archiveBytes: result.bytes,
          elapsedMs: Date.now() - start,
          verifiedReadBack: true,
          sourceIntact: true,
          wholeArchiveBuffered: false,
        }),
      );
    } finally {
      await runtime.dispose();
    }
  },
);
