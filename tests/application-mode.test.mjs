import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../worker.js";
import { TestR2 } from "./helpers/r2.mjs";
import { TestD1 } from "./helpers/d1.mjs";
import { provisionTestAccount } from "./helpers/accounts.mjs";
const origin = "https://mode.example.test";
test("explicit application mode uses the owner guard and does not initialize project storage", async (t) => {
  const env = {
    WORKSHOP_DB: new TestD1(),
    PHOTOS: new TestR2(),
    admin_password: "synthetic-mode-secret",
  };
  t.after(() => env.WORKSHOP_DB.close());
  const request = (method = "GET", cookie) =>
    new Request(origin + "/api/application-mode", {
      method,
      headers: { origin, ...(cookie ? { cookie } : {}) },
    });
  assert.equal((await worker.fetch(request(), env, {})).status, 401);
  const login = await provisionTestAccount(
    new Request(origin + "/api/accounts", {
      method: "POST",
      headers: { origin },
      body: JSON.stringify({
        action: "register",
        email: "mode-owner@example.test",
        password: "synthetic-mode-password",
      }),
    }),
    env,
    { role: "admin" },
  );
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const tables = async () =>
    (
      await env.WORKSHOP_DB.prepare(
        "SELECT name FROM sqlite_master ORDER BY name",
      ).all()
    ).results;
  const before = await tables();
  for (const active of [false, true, false]) {
    env.NEW_PROJECT_ENGINE = active ? "1" : undefined;
    const response = await worker.fetch(request("GET", cookie), env, {});
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { projectEngine: active });
    assert.match(response.headers.get("cache-control"), /no-store/);
  }
  assert.deepEqual(await tables(), before);
  assert.equal(
    (await worker.fetch(request("POST", cookie), env, {})).status,
    405,
  );
  const member = await provisionTestAccount(
    new Request(origin + "/api/accounts", {
      method: "POST",
      headers: { origin },
      body: JSON.stringify({
        action: "register",
        email: "mode-member@example.test",
        password: "synthetic-member-password",
      }),
    }),
    env,
    { role: "member" },
  );
  assert.equal(
    (
      await worker.fetch(
        request("GET", member.headers.get("set-cookie").split(";")[0]),
        env,
        {},
      )
    ).status,
    401,
  );
});
