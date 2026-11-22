import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker.js";
import {guardPrivateApi} from "../functions/api/private-access.js";
import {provisionTestAccount} from "./helpers/accounts.mjs";

const origin = "https://private.example.test";
class Bucket {
  objects = new Map();
  async put(key, value) { this.objects.set(key, value); return {etag: crypto.randomUUID()}; }
  async get(key) {
    const value = this.objects.get(key);
    return value === undefined ? null : {text: async () => value, json: async () => JSON.parse(value)};
  }
}
const request = (path, {method = "GET", cookie, requestOrigin = origin, body} = {}) => new Request(origin + path, {
  method,
  headers: {origin: requestOrigin, ...(cookie ? {cookie} : {}), "content-type": "application/json"},
  ...(body ? {body: JSON.stringify(body)} : {})
});
async function fixture(role = "admin") {
  const env = {PHOTOS: new Bucket(), admin_password: "private-boundary-fixture-secret"};
  const provisioned = await provisionTestAccount(request("/api/accounts", {
    method: "POST", body: {action: "register", email: role + "@example.test", password: "synthetic-owner-password"}
  }), env, {role});
  return {env, cookie: provisioned.headers.get("set-cookie").split(";")[0]};
}

const protectedRoutes = [
  "projects", "numbering", "proposals", "my-build", "build-confusion", "project-tasks",
  "tree", "wires", "commonparts", "purchased-parts", "personal-workshop", "workshop-photo",
  "workshop-reference", "workshop-templates", "workshop-lookup", "workshop-image-import",
  "part-files", "part-pages", "harness", "workspace", "unstructured-notes", "investigations",
  "assembly-archive", "project-milestones", "recipe-files", "photo-annotations", "part-code",
  "project/archive", "project/staging", "project/backups", "drawings", "components",
  "components/photo", "components/extract", "photos", "photo", "unknown-route"
];

test("every application API rejects unauthenticated reads and writes before dispatch", async () => {
  let assetRequests = 0;
  const env = {ASSETS: {fetch() { assetRequests++; throw Error("API fell through to static assets"); }}};
  for (const route of protectedRoutes) {
    for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
      const response = await worker.fetch(request("/api/" + route, {method}), env, {});
      assert.equal(response.status, 401, method + " " + route);
      assert.equal((await response.json()).code, "OWNER_REQUIRED");
      assert.match(response.headers.get("cache-control"), /no-store/);
    }
  }
  assert.equal(assetRequests, 0);
});

test("existing ordinary accounts cannot use the private APIs", async () => {
  const {env, cookie} = await fixture("member");
  for (const route of protectedRoutes) {
    assert.equal((await worker.fetch(request("/api/" + route, {cookie}), env, {})).status, 401, route);
  }
});

test("owner reads are allowed, mutation origins are checked, and unknown APIs stay JSON", async () => {
  const {env, cookie} = await fixture();
  assert.equal(await guardPrivateApi(request("/api/tree", {cookie}), env), null);
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const response = await worker.fetch(request("/api/tree?project=launcher", {
      method, cookie, requestOrigin: "https://outsider.example.test"
    }), env, {});
    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, "INVALID_ORIGIN");
  }
  const unknown = await worker.fetch(request("/api/unknown-route", {cookie}), env, {});
  assert.equal(unknown.status, 404);
  assert.match(unknown.headers.get("content-type"), /application\/json/);
});

test("both paid AI routes are paused even for the owner and never contact a provider", async t => {
  const {env, cookie} = await fixture();
  env.OPENAI_API_KEY = "synthetic-test-key";
  let providerCalls = 0;
  t.mock.method(globalThis, "fetch", async () => { providerCalls++; throw Error("Unexpected provider call"); });
  for (const path of ["/api/workshop-lookup", "/api/components/extract"]) {
    const response = await worker.fetch(request(path, {method: "POST", cookie, body: {partNumber: "ABC"}}), env, {});
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, "AI_PAUSED");
  }
  assert.equal(providerCalls, 0);
});

test("sign-in remains available while public signup stays closed", async () => {
  const {env, cookie} = await fixture();
  const status = await worker.fetch(request("/api/accounts", {cookie}), env, {});
  assert.equal((await status.json()).user.role, "admin");
  const before = env.PHOTOS.objects.size;
  const signup = await worker.fetch(request("/api/accounts", {
    method: "POST", body: {action: "register", email: "outsider@example.test", password: "synthetic-other-password"}
  }), env, {});
  assert.equal(signup.status, 410);
  assert.equal(env.PHOTOS.objects.size, before);
});
