// First-party account sessions; users own private projects, not the global admin password.
import { reserveLoginAttempt } from "./login-attempt-limits.js";
const encoder = new TextEncoder(),
  decoder = new TextDecoder();
const b64 = (bytes) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const unb64 = (s) =>
  Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
    c.charCodeAt(0),
  );
const json = (v, status = 200, headers = {}) =>
  new Response(JSON.stringify(v), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...headers,
    },
  });
const cookie = (value, age) =>
  "bs_user=" +
  value +
  "; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=" +
  age;
const key = (env) =>
  crypto.subtle.importKey(
    "raw",
    encoder.encode(env.admin_password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
const userKey = (id) => "users/" + id + ".json";
const emailKey = async (mail) =>
  "user-email/" +
  b64(
    new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(mail))),
  ) +
  ".json";
export async function accountUser(request, env) {
  if (!env.admin_password || !env.PHOTOS) return null;
  const value = request.headers
    .get("cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("bs_user="))
    ?.slice(8);
  if (!value) return null;
  const [encoded, signature, ...rest] = value.split(".");
  if (!encoded || !signature || rest.length) return null;
  try {
    if (
      !(await crypto.subtle.verify(
        "HMAC",
        await key(env),
        unb64(signature),
        encoder.encode(encoded),
      ))
    )
      return null;
    const claims = JSON.parse(decoder.decode(unb64(encoded)));
    if (
      !/^u[a-f0-9]{32}$/.test(claims.uid) ||
      !Number.isFinite(claims.exp) ||
      claims.exp < Date.now() ||
      claims.exp > Date.now() + 31 * 86400000
    )
      return null;
    const object = await env.PHOTOS.get(userKey(claims.uid));
    if (!object) return null;
    const user = JSON.parse(await object.text());
    if (user.disabled || user.sessionVersion !== claims.version) return null;
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role === "admin" ? "admin" : "member",
    };
  } catch {
    return null;
  }
}
async function createSession(user, env) {
  const payload = b64(
    encoder.encode(
      JSON.stringify({
        uid: user.id,
        exp: Date.now() + 30 * 86400000,
        version: user.sessionVersion,
      }),
    ),
  );
  const signature = b64(
    new Uint8Array(
      await crypto.subtle.sign("HMAC", await key(env), encoder.encode(payload)),
    ),
  );
  return payload + "." + signature;
}
async function passwordHash(password, salt) {
  const imported = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: unb64(salt), iterations: 100000, hash: "SHA-256" },
    imported,
    256,
  );
  return b64(new Uint8Array(derived));
}
function equal(a, b) {
  if (a.length !== b.length) return false;
  let different = 0;
  for (let i = 0; i < a.length; i++)
    different |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return different === 0;
}
export async function handleAccounts(request, env) {
  if (!env.PHOTOS || !env.admin_password)
    return json(
      {
        error: "Account service temporarily unavailable",
        code: "ACCOUNT_STORAGE_UNAVAILABLE",
      },
      503,
    );
  if (request.method === "GET")
    return json({ user: await accountUser(request, env) });
  if (!["POST", "DELETE"].includes(request.method))
    return json({ error: "Method not allowed" }, 405);
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return json({ error: "Invalid request origin" }, 403);
  if (request.method === "DELETE")
    return json({ user: null }, 200, { "set-cookie": cookie("", 0) });
  const body = await request.json().catch(() => null);
  if (body?.action === "register")
    return json(
      {
        error:
          "BuildingSchmidt is a private application. Public registration is closed.",
        code: "REGISTRATION_CLOSED",
      },
      410,
    );
  if (body?.action !== "login")
    return json(
      { error: "Invalid account action", code: "INVALID_ACCOUNT_ACTION" },
      400,
    );
  const email = String(body?.email || "")
      .toLowerCase()
      .trim(),
    password = body?.password;
  if (
    !/^[^\s@]{1,80}@[^\s@]{1,120}\.[^\s@]{2,30}$/.test(email) ||
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 256
  )
    return json(
      {
        error:
          "Enter a valid email and a password between 12 and 256 characters",
        code: "INVALID_LOGIN",
      },
      400,
    );
  const blocked = await reserveLoginAttempt(request, env, email);
  if (blocked)
    return json(
      {
        error: blocked.error,
        code: blocked.code,
        retryAfter: blocked.retryAfter,
      },
      blocked.status,
      { "retry-after": String(blocked.retryAfter) },
    );
  const emailObject = await env.PHOTOS.get(await emailKey(email));
  if (!emailObject) return json({ error: "Invalid email or password" }, 401);
  const { id } = JSON.parse(await emailObject.text()),
    object = await env.PHOTOS.get(userKey(id));
  if (!object) return json({ error: "Invalid email or password" }, 401);
  const user = JSON.parse(await object.text());
  if (
    user.disabled ||
    !equal(await passwordHash(password, user.salt), user.passwordHash)
  )
    return json({ error: "Invalid email or password" }, 401);
  return json(
    {
      user: {
        id: user.id,
        email,
        displayName: user.displayName,
        role: user.role === "admin" ? "admin" : "member",
      },
    },
    200,
    { "set-cookie": cookie(await createSession(user, env), 30 * 86400) },
  );
}

export async function onRequest({ request, env }) {
  try {
    return await handleAccounts(request, env);
  } catch (error) {
    const reference = crypto.randomUUID();
    // Logs retain diagnostic detail; the public response never exposes credentials.
    console.error(
      "Account API failure",
      reference,
      error?.stack || String(error),
    );
    return json(
      {
        error:
          "The account service encountered an unexpected error. Contact the website administrator with the reference number.",
        code: "ACCOUNT_UNEXPECTED_ERROR",
        reference,
      },
      500,
    );
  }
}
