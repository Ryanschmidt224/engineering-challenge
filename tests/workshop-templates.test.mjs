import test from "node:test";
import assert from "node:assert/strict";
import {onRequest as templates} from "../functions/api/workshop-templates.js";
import {provisionTestAccount} from "./helpers/accounts.mjs";

const origin = "https://templates.example.test";
const storageKey = "workshop-templates/v1.json";
class Bucket {
  objects = new Map();
  beforeTemplateWrite = null;
  async get(key) {
    const record = this.objects.get(key);
    return record ? {etag: record.etag, text: async () => record.value, json: async () => JSON.parse(record.value)} : null;
  }
  async put(key, value, options = {}) {
    if (key === storageKey && this.beforeTemplateWrite) {
      const callback = this.beforeTemplateWrite; this.beforeTemplateWrite = null;
      await callback();
    }
    const previous = this.objects.get(key);
    if (options.onlyIf?.etagMatches && options.onlyIf.etagMatches !== previous?.etag) return null;
    if (options.onlyIf?.etagDoesNotMatch === "*" && previous) return null;
    const etag = crypto.randomUUID();
    this.objects.set(key, {value, etag});
    return {etag};
  }
}
const request = (method, body, cookie = "") => new Request(origin + "/api/workshop-templates", {
  method, headers: {origin, cookie, "content-type": "application/json"},
  ...(body ? {body: JSON.stringify(body)} : {})
});
async function fixture(role = "admin") {
  const env = {PHOTOS: new Bucket(), admin_password: "template-fixture-secret"};
  const account = await provisionTestAccount(new Request(origin + "/api/accounts", {
    method: "POST", headers: {origin},
    body: JSON.stringify({action: "register", email: role + "@example.test", password: "template-fixture-password"})
  }), env, {role});
  const cookie = account.headers.get("set-cookie").split(";")[0];
  const call = (method, body) => templates({env, request: request(method, body, cookie)});
  const create = async (name = "Supply") => {
    const response = await call("POST", {name, category: "electronics", tableLayout: {sections: {}}, genericFields: [], productSections: []});
    assert.equal(response.status, 200);
    return (await response.json()).template;
  };
  return {env, call, create};
}

test("template edits and deletion reject stale or missing editor revisions", async () => {
  const {call, create} = await fixture();
  const initial = await create();
  const response = await call("PUT", {...initial, name: "Updated supply", expectedRevision: initial.revision});
  assert.equal(response.status, 200);
  const current = (await response.json()).template;
  assert.notEqual(current.revision, initial.revision);
  for (const method of ["PUT", "DELETE"]) {
    assert.equal((await call(method, {...initial, expectedRevision: initial.revision})).status, 409);
    assert.equal((await call(method, initial)).status, 409);
  }
  const saved = (await (await call("GET")).json()).templates;
  assert.equal(saved[0].name, "Updated supply");
  assert.equal((await call("DELETE", {id: current.id, expectedRevision: current.revision})).status, 200);
  assert.deepEqual((await (await call("GET")).json()).templates, []);
});

test("a collection-write race cannot turn a stale template save into a successful overwrite", async () => {
  const {env, call, create} = await fixture();
  const initial = await create();
  env.PHOTOS.beforeTemplateWrite = async () => {
    const items = await (await env.PHOTOS.get(storageKey)).json();
    items[initial.id] = {...initial, name: "Other tab", revision: "other-tab-revision"};
    await env.PHOTOS.put(storageKey, JSON.stringify(items));
  };
  const response = await call("PUT", {...initial, name: "Stale save", expectedRevision: initial.revision});
  assert.equal(response.status, 409);
  assert.equal((await (await call("GET")).json()).templates[0].name, "Other tab");
});

test("template definitions strip item values and never modify existing Workshop items", async () => {
  const {env, call} = await fixture();
  const item = JSON.stringify({"workshop:test": {name: "Existing part", spec: "24 V"}});
  await env.PHOTOS.put("workshop-reference-overrides/v1.json", item);
  const response = await call("POST", {
    name: "Supply", category: "electronics", tableLayout: {sections: {}}, genericFields: [],
    productSections: [{id: "ratings", title: "Ratings", fields: [
      {id: "voltage", label: "Output voltage", type: "number", scope: "workshop", unit: "V", value: "24"}
    ]}]
  });
  assert.equal(response.status, 200);
  const saved = (await response.json()).template;
  assert.equal(saved.productSections[0].fields[0].value, "");
  assert.equal(await (await env.PHOTOS.get("workshop-reference-overrides/v1.json")).text(), item);
});

test("ordinary accounts cannot create or delete master templates", async () => {
  const {env, call} = await fixture("member");
  assert.equal((await call("POST", {name: "Forbidden"})).status, 403);
  assert.equal((await call("DELETE", {id: "tpl-" + crypto.randomUUID()})).status, 403);
  assert.equal(await env.PHOTOS.get(storageKey), null);
});
