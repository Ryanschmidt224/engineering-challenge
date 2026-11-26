import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { build } from "esbuild";
import { Miniflare, Log, LogLevel } from "miniflare";
test(
  "native D1 upgrades Workshop v3 once, preserves existing products, and retains evidence across cold restarts",
  { timeout: 90000 },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), "bs-workshop-evidence-")),
      root = resolve(".");
    const bundle = await build({
      stdin: {
        contents: `import {migrateWorkshop,migrations} from ${JSON.stringify(root + "/functions/api/workshop-migrations.js")}; import {initializeWorkshop,workshopSnapshot,saveWorkshopEntity} from ${JSON.stringify(root + "/functions/api/workshop-db.js")}; export default {async fetch(request,env){if(new URL(request.url).pathname==='/v3'){await migrateWorkshop(env.DB,migrations.filter(m=>m.version<=3));return Response.json({ok:true});} await initializeWorkshop(env.DB); if(request.method==='POST')return Response.json(await saveWorkshopEntity(null,{WORKSHOP_DB:env.DB},await request.json()));return Response.json(await workshopSnapshot(env.DB));}};`,
        resolveDir: root,
      },
      bundle: true,
      write: false,
      format: "esm",
      platform: "browser",
    });
    const options = {
      modules: true,
      script: bundle.outputFiles[0].text,
      compatibilityDate: "2026-07-30",
      d1Databases: { DB: "workshop-evidence" },
      d1Persist: directory,
      log: new Log(LogLevel.ERROR),
    };
    let runtime = new Miniflare(options);
    try {
      assert.equal(
        (await runtime.dispatchFetch("https://fixture.test/v3")).status,
        200,
      );
      let db = await runtime.getD1Database("DB");
      await db
        .prepare(
          "INSERT INTO workshop_products(id,family_id,name,field_values) VALUES(?,?,?,?)",
        )
        .bind("existing", "f-resistor", "Owner product", "{}")
        .run();
      let snapshot = await (
        await runtime.dispatchFetch("https://fixture.test/")
      ).json();
      assert.equal(snapshot.products[0].name, "Owner product");
      assert.deepEqual(snapshot.products[0].lookup_provenance, {});
      const record = {
        ...snapshot.products[0],
        manufacturer: "Example",
        mpn: "EX1",
        supplier_links: [{ url: "https://example.com/product" }],
        field_values: { "f-resistor-power-rating": 0.25 },
        lookup_provenance: {
          version: 1,
          identityRequired: true,
          appliedAt: new Date().toISOString(),
          fields: {
            "f-resistor-power-rating": {
              label: "Power rating",
              unit: "W",
              value: 0.25,
              conditions: "70°C",
              sourceUrl: "https://example.com/datasheet",
            },
          },
        },
      };
      const response = await runtime.dispatchFetch("https://fixture.test/", {
        method: "POST",
        body: JSON.stringify({
          entity: "product",
          record,
          expectedRevision: 1,
          expectedFamilyRevision: 2,
        }),
      });
      assert.equal(response.status, 200, await response.clone().text());
      await runtime.dispose();
      runtime = new Miniflare(options);
      snapshot = await (
        await runtime.dispatchFetch("https://fixture.test/")
      ).json();
      assert.equal(
        snapshot.products[0].lookup_provenance.fields["f-resistor-power-rating"]
          .conditions,
        "70°C",
      );
      db = await runtime.getD1Database("DB");
      assert.equal(
        (
          await db
            .prepare("SELECT value FROM workshop_meta WHERE key='schema'")
            .first()
        ).value,
        "4",
      );
      assert.equal(
        (await db.prepare("PRAGMA foreign_key_check").all()).results.length,
        0,
      );
    } finally {
      await runtime.dispose();
      await rm(directory, { recursive: true, force: true });
    }
  },
);
