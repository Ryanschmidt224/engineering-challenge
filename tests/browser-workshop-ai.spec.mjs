import { test, expect } from "@playwright/test";
test.describe.configure({ mode: "serial" });
test.beforeEach(async ({ request, context, page }, testInfo) => {
  const { cookie } = await (
      await request.post(
        "/__test__/reset" +
          (testInfo.title.startsWith("forgetting") ? "?engine=1" : ""),
      )
    ).json(),
    at = cookie.indexOf("=");
  await context.addCookies([
    {
      name: cookie.slice(0, at),
      value: cookie.slice(at + 1),
      url: "http://127.0.0.1:4173",
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
  await page.goto("/workshop.html?family=f-resistor");
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  await page
    .getByLabel("Show fields usually filled in for a project", { exact: true })
    .check();
  await page.getByLabel("Product name", { exact: true }).fill("Resistor");
  await page
    .getByLabel("Manufacturer part number", { exact: true })
    .fill("EX-10K");
});
const suggestion = {
  draft: {
    name: "Exact resistor",
    manufacturer: "Example",
    partNumber: "EX-10K",
    supplierUrl: "https://example.com/product",
    caution: "Check test conditions",
    notes: "Manufacturer datasheet",
  },
  research: {
    specs: [
      { name: "Resistance", value: "10000", unit: "Ω", conditions: "25°C" },
      { name: "Power rating", value: "0.25", unit: "W" },
      { name: "Unknown rating", value: "60", unit: "V" },
    ],
  },
  sources: ["https://example.com/datasheet"],
  lookupUsage: { estimatedUsd: 0.001 },
};
// Mock the explicit template protocol, not the retained legacy research response.
function contract(data, body) {
  const fields = (data.research?.specs || []).flatMap((spec) => {
    const id =
      spec.name === "Resistance"
        ? body.templateFieldIds.includes("f-resistor-resistance")
          ? "f-resistor-resistance"
          : body.templateFieldIds[0]
        : spec.name === "Power rating"
          ? "f-resistor-power-rating"
          : spec.name === "Vgs(th) (Max) @ Id"
            ? "f-n-channel-mosfet-dk-threshold"
            : spec.name === "Rds On (Max) @ Id, Vgs"
              ? "f-n-channel-mosfet-dk-on-resistance"
              : null;
    if (!id) return [];
    const text = body.familyId === "f-n-channel-mosfet";
    return [
      {
        fieldId: id,
        label: spec.name,
        value: text
          ? [[spec.value, spec.unit].filter(Boolean).join(" "), spec.conditions]
              .filter(Boolean)
              .join(" · ")
          : Number(spec.value),
        unit: text ? "" : spec.unit || "",
        conditions: spec.conditions || "",
        sourceUrl: "https://example.com/datasheet",
        document: null,
      },
    ];
  });
  return {
    contract: "workshop-template-v1",
    template: {
      id: body.familyId,
      revision: body.expectedFamilyRevision,
      fieldIds: body.templateFieldIds,
    },
    identity: data.draft,
    fields,
    caution: data.draft?.caution,
    lookupUsage: data.lookupUsage,
  };
}
test("AI suggestions map to stable family fields, preserve filled values, and save only on explicit Save", async ({
  page,
}) => {
  await expect(page.getByRole("button", {name:"Find with AI",exact:true})).toBeDisabled();
  await page.getByLabel("Search hint",{exact:true}).fill("   ");
  await expect(page.getByRole("button", {name:"Find with AI",exact:true})).toBeDisabled();
  await page.getByLabel("Resistance (Ω)", { exact: true }).fill("12000");
  let calls = 0;
  await page.route("**/api/workshop-lookup", (route) => {
    calls++;
    expect(route.request().postDataJSON()).toMatchObject({
      partNumber: "EX-10K",
      partName: "Resistor",
    });
    return route.fulfill({
      json: contract(suggestion, route.request().postDataJSON()),
    });
  });
  await page.getByLabel("Search hint", {exact:true}).fill("Exact manufacturer datasheet");
  await page.getByRole("button", { name: "Find with AI", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Apply selected suggestions",
      exact: true,
    }),
  ).toBeVisible();
  expect(calls).toBe(1);
  await expect(
    page.getByLabel("Destination for Resistance", { exact: true }),
  ).toHaveValue("");
  await expect(
    page.getByLabel("Destination for Power rating", { exact: true }),
  ).toHaveValue("f-resistor-power-rating");
  await expect(
    page.getByLabel("Destination for Unknown rating", { exact: true }),
  ).toHaveCount(0);
  expect(
    (await (await page.request.get("/api/workshop")).json()).products,
  ).toHaveLength(0);
  await page
    .getByRole("button", { name: "Apply selected suggestions", exact: true })
    .click();
  await expect(page.getByLabel("Resistance (Ω)", { exact: true })).toHaveValue(
    "12000",
  );
  await expect(
    page.getByLabel("Power rating (W)", { exact: true }),
  ).toHaveValue("0.25");
  await expect(page.getByLabel("Manufacturer", { exact: true })).toHaveValue(
    "Example",
  );
  await expect(page.getByLabel("Product name", { exact: true })).toHaveValue(
    "Resistor",
  );
  expect(
    (await (await page.request.get("/api/workshop")).json()).products,
  ).toHaveLength(0);
  await page.getByRole("button", { name: "Save product", exact: true }).click();
  await expect(page.locator("#workshop-status")).toHaveText("Saved.");
  const product = (await (await page.request.get("/api/workshop")).json())
    .products[0];
  expect(product.field_values["f-resistor-resistance"]).toBe(12000);
  expect(product.field_values["f-resistor-power-rating"]).toBe(0.25);
  expect(
    product.lookup_provenance.fields["f-resistor-power-rating"].sourceUrl,
  ).toBe("https://example.com/datasheet");
});
test("failed and stale lookup results leave the draft intact and allow retry", async ({
  page,
}) => {
  await page.route("**/api/workshop-lookup", (route) =>
    route.fulfill({ status: 503, json: { error: "AI lookup is paused." } }),
  );
  await page.getByLabel("Search hint", {exact:true}).fill("Exact manufacturer datasheet");
  await page.getByRole("button", { name: "Find with AI", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "AI lookup is paused." }),
  ).toBeVisible();
  await expect(page.getByLabel("Product name", { exact: true })).toHaveValue(
    "Resistor",
  );
  await page.unroute("**/api/workshop-lookup");
  await page.route("**/api/workshop-lookup", (route) =>
    route.fulfill({
      json: contract(suggestion, route.request().postDataJSON()),
    }),
  );
  await page.getByLabel("Search hint", {exact:true}).fill("Exact manufacturer datasheet");
  await page.getByRole("button", { name: "Find with AI", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Apply selected suggestions",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel("Product name", { exact: true }).fill("My edited name");
  await page
    .getByRole("button", { name: "Apply selected suggestions", exact: true })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Product details changed since lookup" }),
  ).toBeVisible();
  await expect(page.getByLabel("Manufacturer", { exact: true })).toHaveValue(
    "",
  );
});
test("duplicate ratings require a choice; explicit replacement and discard are controlled", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("Resistance (Ω)", { exact: true }).fill("12000");
  const response = structuredClone(suggestion);
  response.research.specs = [
    { name: "Resistance", value: "10000", unit: "Ω", conditions: "25°C" },
    { name: "Resistance", value: "11000", unit: "Ω", conditions: "85°C" },
  ];
  await page.route("**/api/workshop-lookup", (route) =>
    route.fulfill({ json: contract(response, route.request().postDataJSON()) }),
  );
  await page.getByLabel("Search hint", {exact:true}).fill("Exact manufacturer datasheet");
  await page.getByRole("button", { name: "Find with AI", exact: true }).click();
  const destinations = page.getByLabel("Destination for Resistance", {
    exact: true,
  });
  await expect(destinations).toHaveCount(2);
  for (const destination of await destinations.all())
    await expect(destination).toHaveValue("");
  await destinations.first().selectOption("f-resistor-resistance");
  await destinations.last().selectOption("f-resistor-resistance");
  await page
    .getByRole("button", { name: "Apply selected suggestions", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Choose only one suggestion" }),
  ).toBeVisible();
  await expect(page.getByLabel("Resistance (Ω)", { exact: true })).toHaveValue(
    "12000",
  );
  await page
    .getByRole("button", { name: "Discard suggestions", exact: true })
    .click();
  await expect(page.getByLabel("Resistance (Ω)", { exact: true })).toHaveValue(
    "12000",
  );
  await page.getByLabel("Search hint", {exact:true}).fill("Exact manufacturer datasheet");
  await page.getByRole("button", { name: "Find with AI", exact: true }).click();
  await destinations.first().selectOption("f-resistor-resistance");
  await page
    .getByRole("button", { name: "Apply selected suggestions", exact: true })
    .click();
  await expect(page.getByLabel("Resistance (Ω)", { exact: true })).toHaveValue(
    "10000",
  );
  expect(await page.locator("#workshop-detail").innerText()).not.toContain(
    "Append research",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("MOSFET template keeps source units and test conditions with conditional ratings", async ({
  page,
}) => {
  page.once("dialog", (dialog) => dialog.accept());
  await page.goto("/workshop.html?family=f-n-channel-mosfet");
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  await page.getByLabel("Product name", { exact: true }).fill("2N7000");
  await page
    .getByLabel("Manufacturer part number", { exact: true })
    .fill("2N7000");
  const response = {
    draft: {
      name: "2N7000",
      manufacturer: "Fixture maker",
      partNumber: "2N7000",
      supplierUrl: "https://example.com/product",
    },
    research: {
      specs: [
        {
          name: "Vgs(th) (Max) @ Id",
          value: "3",
          unit: "V",
          conditions: "Id = 1 mA",
        },
        {
          name: "Rds On (Max) @ Id, Vgs",
          value: "5",
          unit: "Ω",
          conditions: "Id = 500 mA, Vgs = 10 V",
        },
      ],
    },
    sources: [],
  };
  await page.route("**/api/workshop-lookup", (route) =>
    route.fulfill({ json: contract(response, route.request().postDataJSON()) }),
  );
  await page.getByLabel("Search hint", {exact:true}).fill("Exact manufacturer datasheet");
  await page.getByRole("button", { name: "Find with AI", exact: true }).click();
  await page
    .getByRole("button", { name: "Apply selected suggestions", exact: true })
    .click();
  await expect(
    page.getByLabel("Vgs(th) (Max) @ Id", { exact: true }),
  ).toHaveValue("3 V · Id = 1 mA");
  await expect(
    page.getByLabel("Rds On (Max) @ Id, Vgs", { exact: true }),
  ).toHaveValue("5 Ω · Id = 500 mA, Vgs = 10 V");
  await page.getByRole("button", { name: "Save product", exact: true }).click();
  await expect(page.locator("#workshop-status")).toHaveText("Saved.");
  const product = (await (await page.request.get("/api/workshop")).json())
    .products[0];
  expect(product.field_values["f-n-channel-mosfet-dk-threshold"]).toBe(
    "3 V · Id = 1 mA",
  );
  expect(product.field_values["f-n-channel-mosfet-dk-on-resistance"]).toBe(
    "5 Ω · Id = 500 mA, Vgs = 10 V",
  );
});

test("lookup sits between identity/specifications, saves an optional document and can reuse it", async ({
  page,
}, testInfo) => {
  await page.screenshot({path:testInfo.outputPath("lookup-layout.png"),fullPage:true});
  const panels = await page
    .locator("#workshop-detail form > .panel")
    .evaluateAll((nodes) =>
      nodes.map((n) => n.querySelector("h3")?.textContent),
    );
  expect(panels.indexOf("Find product specs with AI")).toBeGreaterThan(
    panels.indexOf("Product identity"),
  );
  expect(panels.indexOf("Find product specs with AI")).toBeLessThan(
    panels.indexOf("Specifications"),
  );
  const bytes = Buffer.from("%PDF-1.7\nSynthetic datasheet");
  await page
    .getByLabel("Datasheet or technical document", { exact: true })
    .setInputFiles({
      name: "resistor.pdf",
      mimeType: "application/pdf",
      buffer: bytes,
    });
  let payload;
  await page.route("**/api/workshop-lookup", (route) => {
    payload = route.request().postDataJSON();
    return route.fulfill({
      json: contract(suggestion, route.request().postDataJSON()),
    });
  });
  await page.getByLabel("Search hint", {exact:true}).fill("Exact manufacturer datasheet");
  await page.getByRole("button", { name: "Find with AI", exact: true }).click();
  await page
    .getByRole("button", { name: "Apply selected suggestions", exact: true })
    .click();
  expect(payload.document.data).toBe(bytes.toString("base64"));
  expect(payload.templateFieldIds).toContain("f-resistor-resistance");
  await expect(page.getByLabel("Order URL", { exact: true })).toHaveValue(
    "https://example.com/product",
  );
  await page.getByRole("button", { name: "Save product", exact: true }).click();
  await expect(page.locator("#workshop-status")).toHaveText("Saved.");
  const data = await (await page.request.get("/api/workshop")).json();
  const attachment = data.attachments.find((f) => f.title === "resistor.pdf");
  expect(attachment.product_id).toBe(data.products[0].id);
  const saved = await page.request.get(
    "/api/workshop/file?id=" + attachment.id,
  );
  expect(await saved.body()).toEqual(bytes);
  await page
    .getByRole("button", { name: "Edit product", exact: true })
    .first()
    .click();
  await expect(page.getByLabel("Use saved technical document", {exact:true})).toHaveCount(0);
  await page.getByLabel("Search hint", {exact:true}).fill("Exact manufacturer datasheet");
  await page.getByRole("button", { name: "Find with AI", exact: true }).click();
  expect(payload.productId).toBe(attachment.product_id);
  expect(payload.document).toBeNull();
});
test("incomplete AI identity cannot be applied", async ({ page }) => {
  await page.route("**/api/workshop-lookup", (route) =>
    route.fulfill({
      json: contract(
        {
          draft: { name: "Resistor", partNumber: "EX-10K" },
          research: { specs: [] },
        },
        route.request().postDataJSON(),
      ),
    }),
  );
  await page.getByLabel("Search hint", {exact:true}).fill("Exact manufacturer datasheet");
  await page.getByRole("button", { name: "Find with AI", exact: true }).click();
  await page
    .getByRole("button", { name: "Apply selected suggestions", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "require Product name" }),
  ).toBeVisible();
  expect(
    (await (await page.request.get("/api/workshop")).json()).products,
  ).toHaveLength(0);
});

test("document drag/drop and native paste use shared controls; failed upload retains a retryable draft", async ({
  page,
}) => {
  const drop = page.getByRole("textbox", {
    name: "Drop datasheet or paste a file",
    exact: true,
  });
  await drop.evaluate((el) => {
    const transfer = new DataTransfer();
    transfer.items.add(
      new File(["%PDF-1.7\nDrop source"], "drop.pdf", {
        type: "application/pdf",
      }),
    );
    el.dispatchEvent(
      new DragEvent("drop", { bubbles: true, dataTransfer: transfer }),
    );
  });
  await expect(
    page.getByText(
      "drop.pdf — saved to this Workshop product when you Save product.",
      { exact: true },
    ),
  ).toBeVisible();
  await drop.evaluate((el) => {
    const transfer = new DataTransfer();
    transfer.items.add(
      new File(["%PDF-1.7\nPaste source"], "paste.pdf", {
        type: "application/pdf",
      }),
    );
    el.dispatchEvent(
      new ClipboardEvent("paste", { bubbles: true, clipboardData: transfer }),
    );
  });
  await expect(
    page.getByText(
      "paste.pdf — saved to this Workshop product when you Save product.",
      { exact: true },
    ),
  ).toBeVisible();
  let failed = false;
  await page.route("**/api/workshop/file?owner=product*", async (route) => {
    if (!failed) {
      failed = true;
      const response = await route.fetch();
      expect(response.ok()).toBe(true);
      return route.fulfill({
        status: 503,
        json: { error: "Synthetic lost upload response" },
      });
    }
    return route.continue();
  });
  await page.getByRole("button", { name: "Save product", exact: true }).click();
  await expect(page.locator("#workshop-status")).toContainText(
    "Product saved, but document upload is unconfirmed",
  );
  await page
    .getByRole("button", { name: "Retry document upload", exact: true })
    .click();
  await expect(page.locator("#workshop-status")).toHaveText("Saved.");
  const data = await (await page.request.get("/api/workshop")).json();
  expect(data.products).toHaveLength(1);
  expect(data.attachments.filter((f) => f.title === "paste.pdf")).toHaveLength(
    1,
  );
});

test("replacing a source document invalidates earlier AI suggestions", async ({
  page,
}) => {
  const input = page.getByLabel("Datasheet or technical document", {
    exact: true,
  });
  await input.setInputFiles({
    name: "first.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.7\nFirst"),
  });
  await page.route("**/api/workshop-lookup", (route) =>
    route.fulfill({
      json: contract(suggestion, route.request().postDataJSON()),
    }),
  );
  await page.getByLabel("Search hint", {exact:true}).fill("Exact manufacturer datasheet");
  await page.getByRole("button", { name: "Find with AI", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Apply selected suggestions",
      exact: true,
    }),
  ).toBeVisible();
  await input.setInputFiles({
    name: "second.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.7\nSecond"),
  });
  await page
    .getByRole("button", { name: "Apply selected suggestions", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "source document changed" }),
  ).toBeVisible();
  await expect(page.getByLabel("Resistance (Ω)", { exact: true })).toHaveValue(
    "",
  );
});

test("lookup can fill all template terms even when empty project-use fields are collapsed", async ({
  page,
}) => {
  const familyId = crypto.randomUUID(),
    fieldId = crypto.randomUUID();
  const created = await page.request.post("/api/workshop", {
    headers: { origin: "http://127.0.0.1:4173" },
    data: {
      entity: "family",
      expectedRevision: null,
      record: {
        id: familyId,
        name: "AI custom resistor",
        kind: "part",
        description: "",
        notes: "",
        fields: [
          {
            id: fieldId,
            label: "Resistance",
            unit: "Ω",
            type: "number",
            choices: [],
            filled_on_use: true,
          },
        ],
      },
    },
  });
  expect(created.ok(), await created.text()).toBe(true);
  page.once("dialog", (dialog) => dialog.accept());
  await page.goto("/workshop.html?family=" + familyId);
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  await page.getByLabel("Product name", { exact: true }).fill("Resistor");
  await page
    .getByLabel("Manufacturer part number", { exact: true })
    .fill("EX-10K");
  await expect(page.getByLabel("Resistance (Ω)", { exact: true })).toHaveCount(
    0,
  );
  await page.route("**/api/workshop-lookup", (route) => {
    expect(route.request().postDataJSON().templateFieldIds).toContain(fieldId);
    return route.fulfill({
      json: contract(
        { ...suggestion, research: { specs: [suggestion.research.specs[0]] } },
        route.request().postDataJSON(),
      ),
    });
  });
  await page.getByLabel("Search hint", {exact:true}).fill("Exact manufacturer datasheet");
  await page.getByRole("button", { name: "Find with AI", exact: true }).click();
  await page
    .getByRole("button", { name: "Apply selected suggestions", exact: true })
    .click();
  await expect(page.getByLabel("Resistance (Ω)", { exact: true })).toHaveValue(
    "10000",
  );
});

test("applied numeric evidence is visible after reload and identity stays required", async ({
  page,
}) => {
  await page.route("**/api/workshop-lookup", (route) => {
    const value = contract(suggestion, route.request().postDataJSON());
    value.fields.find(
      (f) => f.fieldId === "f-resistor-power-rating",
    ).conditions = "70°C";
    return route.fulfill({ json: value });
  });
  await page.getByLabel("Search hint", {exact:true}).fill("Exact manufacturer datasheet");
  await page.getByRole("button", { name: "Find with AI", exact: true }).click();
  await page
    .getByRole("button", { name: "Apply selected suggestions", exact: true })
    .click();
  await page.getByRole("button", { name: "Save product", exact: true }).click();
  await expect(page.locator("#workshop-status")).toHaveText("Saved.");
  await page.reload();
  const evidence = page
    .getByText("AI source", { exact: true })
    .last();
  await evidence.click();
  await expect(
    page.getByText("Conditions: 70°C", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Source", exact: true }).last(),
  ).toHaveAttribute("href", "https://example.com/datasheet");
  await page
    .getByRole("button", { name: "Edit product", exact: true })
    .first()
    .click();
  await page.getByLabel("Manufacturer", { exact: true }).fill("");
  await page.getByRole("button", { name: "Save product", exact: true }).click();
  await expect(page.locator("#workshop-status")).toContainText(
    "AI-assisted products require",
  );
  const product = (await (await page.request.get("/api/workshop")).json())
    .products[0];
  expect(product.manufacturer).toBe("Example");
  expect(
    product.lookup_provenance.fields["f-resistor-power-rating"].value,
  ).toBe(0.25);
});

test("pending document status survives reload and a lost completion response is reconciled", async ({
  page,
}) => {
  const bytes = Buffer.from("%PDF-1.7\nPending source");
  await page
    .getByLabel("Datasheet or technical document", { exact: true })
    .setInputFiles({
      name: "pending.pdf",
      mimeType: "application/pdf",
      buffer: bytes,
    });
  let blocked = true;
  await page.route("**/api/workshop/file?owner=product*", (route) =>
    blocked
      ? route.fulfill({
          status: 503,
          json: { error: "Fixture upload failure" },
        })
      : route.continue(),
  );
  await page.getByRole("button", { name: "Save product", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Retry document upload", exact: true }),
  ).toBeVisible();
  let snapshot = await (await page.request.get("/api/workshop")).json();
  const id = snapshot.products[0].lookup_provenance.documentUpload.id;
  expect(snapshot.products[0].lookup_provenance.documentUpload.status).toBe(
    "pending",
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page.reload();
  await expect(
    page.getByText(/Product saved; document upload is unconfirmed/).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edit product", exact: true })
    .first()
    .click();
  await page
    .getByLabel("Datasheet or technical document", { exact: true })
    .setInputFiles({
      name: "pending.pdf",
      mimeType: "application/pdf",
      buffer: bytes,
    });
  blocked = false;
  let lost = false;
  await page.route("**/api/workshop", async (route) => {
    const body = route.request().postDataJSON();
    if (
      route.request().method() === "POST" &&
      body?.record?.lookup_provenance?.documentUpload?.status === "saved" &&
      !lost
    ) {
      lost = true;
      const response = await route.fetch();
      expect(response.ok()).toBe(true);
      return route.fulfill({
        status: 503,
        json: { error: "Fixture lost completion response" },
      });
    }
    return route.continue();
  });
  await page.getByRole("button", { name: "Save product", exact: true }).click();
  await expect(page.locator("#workshop-status")).toHaveText("Saved.");
  snapshot = await (await page.request.get("/api/workshop")).json();
  expect(snapshot.products).toHaveLength(1);
  expect(snapshot.products[0].lookup_provenance.documentUpload).toMatchObject({
    id,
    status: "saved",
  });
  expect(
    snapshot.attachments.filter((a) => a.title === "pending.pdf"),
  ).toHaveLength(1);
  expect(snapshot.attachments.find((a) => a.title === "pending.pdf").id).toBe(
    id,
  );
});

test("an uploaded document can finish a pending save after reload without reselecting local bytes", async ({
  page,
}) => {
  const bytes = Buffer.from("%PDF-1.7\nSaved retry source");
  await page
    .getByLabel("Datasheet or technical document", { exact: true })
    .setInputFiles({
      name: "saved-retry.pdf",
      mimeType: "application/pdf",
      buffer: bytes,
    });
  let uploads = 0;
  await page.route("**/api/workshop/file?owner=product*", async (route) => {
    uploads++;
    const response = await route.fetch();
    expect(response.ok()).toBe(true);
    return route.fulfill({
      status: 503,
      json: { error: "Lost upload response" },
    });
  });
  await page.getByRole("button", { name: "Save product", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Retry document upload", exact: true }),
  ).toBeVisible();
  const first = await (await page.request.get("/api/workshop")).json(),
    id = first.products[0].lookup_provenance.documentUpload.id;
  expect(first.attachments[0].id).toBe(id);
  page.once("dialog", (dialog) => dialog.accept());
  await page.reload();
  await page
    .getByRole("button", { name: "Edit product", exact: true })
    .first()
    .click();
  await expect(page.getByLabel("Use saved technical document", {exact:true})).toHaveCount(0);
  await page.getByRole("button", { name: "Save product", exact: true }).click();
  await expect(page.locator("#workshop-status")).toHaveText("Saved.");
  expect(uploads).toBe(1);
  const done = await (await page.request.get("/api/workshop")).json();
  expect(done.products[0].lookup_provenance.documentUpload.status).toBe(
    "saved",
  );
  expect(done.attachments).toHaveLength(1);
});

for (const reload of [false, true])
  test(
    "forgetting an unconfirmed document unblocks project copy" +
      (reload ? " after reopening" : ""),
    async ({ page }) => {
      await page
        .getByLabel("Datasheet or technical document", { exact: true })
        .setInputFiles({
          name: "never-uploaded.pdf",
          mimeType: "application/pdf",
          buffer: Buffer.from("%PDF-1.7\nLost file fixture"),
        });
      await page.route("**/api/workshop/file?owner=product*", (route) =>
        route.fulfill({
          status: 503,
          json: { error: "Fixture upload unavailable" },
        }),
      );
      await page
        .getByRole("button", { name: "Save product", exact: true })
        .click();
      await expect(
        page.getByRole("button", {
          name: "Retry document upload",
          exact: true,
        }),
      ).toBeVisible();
      if (reload) {
        page.once("dialog", (d) => d.accept());
        await page.reload();
        await page
          .getByRole("button", { name: "Edit product", exact: true })
          .first()
          .click();
      }
      await page
        .getByRole("button", {
          name: "Forget unconfirmed document",
          exact: true,
        })
        .click();
      await expect(
        page.getByRole("button", {
          name: "Retry document upload",
          exact: true,
        }),
      ).toHaveCount(0);
      await page
        .getByRole("button", { name: "Save product", exact: true })
        .click();
      await expect(page.locator("#workshop-status")).toHaveText("Saved.");
      const data = await (await page.request.get("/api/workshop")).json(),
        product = data.products[0],
        family = data.families.find((f) => f.id === product.family_id);
      expect(product.lookup_provenance.documentUpload).toBeUndefined();
      expect(data.attachments).toHaveLength(0);
      const projectId = crypto.randomUUID(),
        origin = "http://127.0.0.1:4173",
        create = await page.request.post(
          "/api/project-engine/projects/" + projectId,
          {
            headers: { origin },
            data: {
              operationId: crypto.randomUUID(),
              expectedRevision: null,
              name: "Forget document proof",
            },
          },
        );
      expect(create.ok(), await create.text()).toBe(true);
      const project = await create.json(),
        admit = await page.request.post(
          "/api/project-engine/projects/" + projectId + "/workshop-items",
          {
            headers: { origin },
            data: {
              operationId: crypto.randomUUID(),
              expectedRevision: project.revision,
              name: "Usable resistor",
              parentId: null,
              selection: {
                familyId: family.id,
                productId: product.id,
                expectedFamilyRevision: family.revision,
                expectedProductRevision: product.revision,
              },
              requirements: {},
            },
          },
        );
      expect(admit.ok(), await admit.text()).toBe(true);
    },
  );
