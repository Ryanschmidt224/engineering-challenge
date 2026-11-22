// Provision synthetic accounts directly in the test bucket. Production signup
// is closed; tests must not reopen it just to obtain an authenticated fixture.
import {handleAccounts} from "../../functions/api/accounts.js";

export async function provisionTestAccount(request, env, {role = "member"} = {}) {
  const input = await request.json();
  if (input.action !== "register" || !input.email?.endsWith(".test")) {
    throw Error("Account fixtures require a synthetic .test registration request");
  }
  const email = input.email.toLowerCase().trim();
  const id = "u" + crypto.randomUUID().replaceAll("-", "");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordKey = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(input.password), "PBKDF2", false, ["deriveBits"]
  );
  const hash = await crypto.subtle.deriveBits(
    {name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256"}, passwordKey, 256
  );
  const emailHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(email));
  await env.PHOTOS.put("users/" + id + ".json", JSON.stringify({
    id, email, role, displayName: input.displayName || email.split("@")[0],
    salt: Buffer.from(salt).toString("base64url"),
    passwordHash: Buffer.from(hash).toString("base64url"),
    sessionVersion: crypto.randomUUID()
  }));
  await env.PHOTOS.put("user-email/" + Buffer.from(emailHash).toString("base64url") + ".json", JSON.stringify({id}));
  const login = await handleAccounts(new Request(request.url, {
    method: "POST", headers: request.headers,
    body: JSON.stringify({action: "login", email, password: input.password})
  }), env);
  if (!login.ok) throw Error("Fixture login failed: " + await login.text());
  return new Response(login.body, {status: 201, headers: login.headers});
}
