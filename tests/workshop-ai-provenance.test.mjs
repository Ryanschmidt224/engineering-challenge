import { handleProjectWorkspace } from "../functions/api/project-workspace-api.js";
import { TestR2 } from "./helpers/r2.mjs";
import { engineOrigin } from "./helpers/project-engine.mjs";
import { normalizeLookupProvenance } from "../assets/workshop-lookup-provenance.js";
import { DatabaseSync } from "node:sqlite";
import { restoreCatalog } from "../scripts/workshop-backup.mjs";
import { sha256 as hashBytes } from "../functions/api/project-archive.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { TestD1 } from "./helpers/d1.mjs";
import {
  initializeWorkshop,
  saveWorkshopEntity,
  workshopSnapshot,
} from "../functions/api/workshop-db.js";
import { templateLookupResult } from "../functions/api/workshop-template-result.js";
import { engineFixture } from "./helpers/project-engine.mjs";
const field = {
  id: "power",
  label: "Power rating",
  unit: "W",
  type: "number",
  choices: [],
};
const identity = {
  name: "Exact resistor",
  manufacturer: "Example",
  partNumber: "EX1",
  supplierUrl: "https://example.com/ex1",
};
test("template result requires exact field IDs, compatible types/units, and per-value evidence", async () => {
  const result = await templateLookupResult(
    {
      ...identity,
      specs: [
        {
          fieldId: "power",
          value: "0.25",
          unit: "W",
          conditions: "70°C",
          sourceUrl: "https://example.com/ds",
        },
        {
          name: "Power rating",
          value: 999,
          unit: "W",
          sourceUrl: "https://example.com/ds",
        },
        { fieldId: "other", value: 2, unit: "W" },
        {
          fieldId: "power",
          value: 250,
          unit: "mW",
          sourceUrl: "https://example.com/ds",
        },
        { fieldId: "power", value: 0.5, unit: "W" },
      ],
    },
    { family: { id: "f", revision: 1 }, fields: [field] },
    { partNumber: "EX1", manufacturer: "Example" },
    null,
  );
  assert.equal(result.contract, "workshop-template-v1");
  assert.deepEqual(result.fields, [
    {
      fieldId: "power",
      label: "Power rating",
      unit: "W",
      value: 0.25,
      conditions: "70°C",
      sourceUrl: "https://example.com/ds",
      document: null,
    },
  ]);
  await assert.rejects(
    templateLookupResult(
      { ...identity, manufacturer: "Another" },
      { family: { id: "f", revision: 1 }, fields: [] },
      { manufacturer: "Example" },
    ),
    /manufacturer/,
  );
  const document = { name: "ds.txt", data: btoa("Verified fixture source") };
  const fromDocument = await templateLookupResult(
    {
      ...identity,
      specs: [
        { fieldId: "power", value: 0, unit: "W", sourceType: "document" },
      ],
    },
    { family: { id: "f", revision: 1 }, fields: [field] },
    { document },
    null,
  );
  assert.match(fromDocument.fields[0].document.sha256, /^[a-f0-9]{64}$/);
  assert.equal(fromDocument.fields[0].value, 0);
  const fromWeb = await templateLookupResult(
    {
      ...identity,
      specs: [
        {
          fieldId: "power",
          value: 1,
          unit: "W",
          sourceType: "url",
          sourceUrl: "https://example.com/web",
        },
      ],
    },
    { family: { id: "f", revision: 1 }, fields: [field] },
    { document },
    null,
  );
  assert.equal(fromWeb.fields[0].document, null);
});
test("AI provenance survives product reopen, identity validation cannot be bypassed by omitting metadata, and manual edits clear only stale attribution", async (t) => {
  const db = new TestD1();
  t.after(() => db.close());
  const env = { WORKSHOP_DB: db };
  await initializeWorkshop(db);
  const record = {
    id: "evidence-product",
    family_id: "f-resistor",
    name: "Exact resistor",
    manufacturer: "Example",
    mpn: "EX1",
    supplier_links: [{ url: "https://example.com/ex1" }],
    notes: "",
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
          sourceUrl: "https://example.com/ds",
        },
      },
    },
  };
  const save = (r, revision) =>
    saveWorkshopEntity(null, env, {
      entity: "product",
      record: r,
      expectedRevision: revision,
      expectedFamilyRevision: 2,
    });
  const created = await save(record, null);
  assert.equal(
    created.lookup_provenance.fields["f-resistor-power-rating"].conditions,
    "70°C",
  );
  const snapshot = await workshopSnapshot(db),
    restored = new DatabaseSync(":memory:");
  try {
    restoreCatalog(
      { ...snapshot, knowledge_tiles: [], knowledge_links: [] },
      restored,
    );
    const row = restored
      .prepare("SELECT lookup_provenance FROM workshop_products WHERE id=?")
      .get(record.id);
    assert.deepEqual(
      JSON.parse(row.lookup_provenance),
      created.lookup_provenance,
    );
  } finally {
    restored.close();
  }
  const reopened = (await workshopSnapshot(db)).products[0];
  const renamed = normalizeLookupProvenance(reopened, [
    { id: "f-resistor-power-rating", label: "Rated power", unit: "W" },
  ]);
  assert.equal(renamed.fields["f-resistor-power-rating"].conditions, "70°C");
  await assert.rejects(
    save(
      {
        ...record,
        id: "false-completion",
        lookup_provenance: {
          ...record.lookup_provenance,
          documentUpload: {
            id: crypto.randomUUID(),
            name: "missing.pdf",
            sha256: "b".repeat(64),
            status: "saved",
          },
        },
      },
      null,
    ),
    /not saved on this product/,
  );

  assert.deepEqual(reopened.lookup_provenance, created.lookup_provenance);
  const omitted = { ...reopened, manufacturer: "" };
  delete omitted.lookup_provenance;
  await assert.rejects(
    save(omitted, reopened.revision),
    /AI-assisted products require/,
  );
  const edited = await save(
    { ...reopened, field_values: { "f-resistor-power-rating": 0.5 } },
    reopened.revision,
  );
  assert.deepEqual(edited.lookup_provenance.fields, {});
  assert.equal(edited.lookup_provenance.identityRequired, true);
  const manual = await save(
    {
      ...record,
      id: "manual",
      manufacturer: "",
      mpn: "",
      supplier_links: [],
      lookup_provenance: undefined,
    },
    null,
  );
  assert.deepEqual(manual.lookup_provenance, {});
});
test("project copy freezes source conditions and source-document bytes independently of Workshop edits", async () => {
  const f = await engineFixture();
  try {
    await initializeWorkshop(f.db);
    f.db.sqlite.exec(
      "INSERT INTO workshop_families(id,name) VALUES('bearings','Bearings'); INSERT INTO workshop_fields(id,family_id,label,unit,type) VALUES('bore','bearings','Bore','mm','number'); INSERT INTO workshop_products(id,family_id,name,field_values) VALUES('bearing-a','bearings','Bearing A','{\"bore\":8}');",
    );
    await f.env.PHOTOS.put("catalog/bearing-photo", new Uint8Array([1, 2, 3]));
    await f.db
      .prepare(
        "INSERT INTO workshop_attachments(id,product_id,title,kind,r2_key,media_type,size) VALUES(?,?,?,?,?,?,?)",
      )
      .bind(
        "bearing-photo",
        "bearing-a",
        "Bearing photo",
        "document",
        "catalog/bearing-photo",
        "application/pdf",
        3,
      )
      .run();
    const selection = {
        familyId: "bearings",
        productId: "bearing-a",
        expectedFamilyRevision: 1,
        expectedProductRevision: 1,
      },
      sha256 = await hashBytes(new Uint8Array([1, 2, 3])),
      e = {
        value: 8,
        label: "Bore",
        unit: "mm",
        conditions: "20°C",
        sourceUrl: "https://example.com/bearing",
        document: { id: "bearing-photo", name: "Bearing photo", sha256 },
      };
    await f.db
      .prepare("UPDATE workshop_products SET lookup_provenance=? WHERE id=?")
      .bind(
        JSON.stringify({
          version: 1,
          identityRequired: true,
          appliedAt: new Date().toISOString(),
          fields: { bore: e },
        }),
        "bearing-a",
      )
      .run();
    const added = await f.call("/workshop-items", "POST", {
      name: "Support",
      parentId: null,
      selection,
      requirements: {},
    });
    assert.equal(added.status, 200, JSON.stringify(added));
    let state = (await f.call("/state")).result,
      copy = state.selections[0].snapshot.fields.find(
        (row) => row.id === "bore",
      ).evidence;
    assert.equal(copy.conditions, "20°C");
    assert.equal(copy.document.fileId, state.files[0].id);
    assert.equal(copy.document.id, undefined);
    const targetDb = new TestD1(),
      target = { WORKSHOP_DB: targetDb, PHOTOS: new TestR2() };
    try {
      const exported = await handleProjectWorkspace(
        new Request(
          engineOrigin +
            "/api/project-engine/projects/" +
            f.projectId +
            "/export",
        ),
        f.env,
        f.owner,
      );
      const restored = await handleProjectWorkspace(
        new Request(
          engineOrigin +
            "/api/project-engine/projects/" +
            f.projectId +
            "/import",
          {
            method: "POST",
            headers: {
              origin: engineOrigin,
              "x-operation-id": crypto.randomUUID(),
              "x-project-revision": "new",
            },
            body: await exported.text(),
          },
        ),
        target,
        f.owner,
      );
      assert.equal(restored.status, 200, await restored.clone().text());
      const recovered = await (
          await handleProjectWorkspace(
            new Request(
              engineOrigin +
                "/api/project-engine/projects/" +
                f.projectId +
                "/state",
            ),
            target,
            f.owner,
          )
        ).json(),
        evidence = recovered.selections[0].snapshot.fields.find(
          (row) => row.id === "bore",
        ).evidence;
      assert.deepEqual(evidence, copy);
      const file = recovered.files.find(
        (file) => file.id === evidence.document.fileId,
      );
      assert.ok(file);
      assert.equal(
        await hashBytes(
          new Uint8Array(
            await (await target.PHOTOS.get(file.r2_key)).arrayBuffer(),
          ),
        ),
        evidence.document.sha256,
      );
    } finally {
      targetDb.close();
    }

    await f.db
      .prepare("UPDATE workshop_products SET lookup_provenance=? WHERE id=?")
      .bind("{}", "bearing-a")
      .run();
    state = (await f.call("/state")).result;
    assert.equal(
      state.selections[0].snapshot.fields.find((row) => row.id === "bore")
        .evidence.conditions,
      "20°C",
    );
  } finally {
    f.db.close();
  }
});

test("only an explicit pending-document removal clears its descriptor and preserves source evidence", () => {
  const document = {
    id: crypto.randomUUID(),
    name: "lost.pdf",
    sha256: "a".repeat(64),
    status: "pending",
  };
  const record = {
    name: "Resistor",
    manufacturer: "Example",
    mpn: "EX1",
    supplier_links: [{ url: "https://example.com/product" }],
    field_values: { power: 1 },
    lookup_provenance: {
      identityRequired: true,
      appliedAt: new Date().toISOString(),
      fields: {
        power: {
          label: "Power rating",
          unit: "W",
          value: 1,
          conditions: "25°C",
          sourceUrl: "https://example.com/ds",
        },
      },
      documentUpload: document,
    },
  };
  const prior = structuredClone(record),
    forgotten = structuredClone(record);
  forgotten.lookup_provenance.documentUpload = null;
  const normalized = normalizeLookupProvenance(forgotten, [field], prior);
  assert.equal(normalized.documentUpload, undefined);
  assert.deepEqual(
    normalized.fields.power,
    normalizeLookupProvenance(prior, [field]).fields.power,
  );
  const omitted = structuredClone(record);
  delete omitted.lookup_provenance.documentUpload;
  assert.deepEqual(
    normalizeLookupProvenance(omitted, [field], prior).documentUpload,
    document,
  );
  prior.lookup_provenance.documentUpload.status = "saved";
  assert.throws(
    () => normalizeLookupProvenance(forgotten, [field], prior),
    /Only an unconfirmed/,
  );
  assert.throws(
    () => normalizeLookupProvenance(forgotten, [field], {}),
    /Only an unconfirmed/,
  );
});
