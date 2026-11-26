import { test } from "node:test";
import assert from "node:assert/strict";

const defaults = {
  owners: ["Ryan"],
  tags: ["Electronics"],
  defaultOwner: "Ryan",
  revision: 1,
};
test("settings deduplicate only in-flight reads, recover after failure and protect a newer save", async () => {
  const original = globalThis.fetch;
  const requests = [];
  globalThis.fetch = () =>
    new Promise((resolve, reject) => requests.push({ resolve, reject }));
  try {
    const client = await import(
      "../assets/website-settings-client.js?cache-regression"
    );
    const first = client.loadWebsiteSettings();
    assert.equal(client.loadWebsiteSettings(), first);
    requests[0].resolve(Response.json(defaults));
    await first;
    const second = client.loadWebsiteSettings();
    assert.equal(requests.length, 2);
    requests[1].reject(Error("offline"));
    await assert.rejects(second, /offline/);
    assert.equal(client.websiteSettings().revision, 1);
    const third = client.loadWebsiteSettings();
    assert.equal(requests.length, 3);
    const saved = {
      ...defaults,
      revision: 2,
      owners: ["Wes"],
      defaultOwner: "Wes",
    };
    client.settingsSaved(saved);
    requests[2].resolve(Response.json(defaults));
    await third;
    assert.equal(client.websiteSettings(), saved);
    assert.deepEqual(client.ownerChoices(["Ryan"]), ["Wes", "Ryan"]);
    const next = client.loadWebsiteSettings();
    requests[3].resolve(Response.json({ ...saved, revision: 3 }));
    await next;
    assert.equal(client.websiteSettings().revision, 3);
  } finally {
    globalThis.fetch = original;
  }
});
