// One bounded record makes admission atomic across email, client and global
// limits. No request is allowed to check a password before its reservation is
// durable. A blocked request never extends the window or changes credentials.
export const LOGIN_LIMIT_KEY = "login-protection/v1.json";
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_IDENTITY_LIMIT = 10;
export const LOGIN_GLOBAL_LIMIT = 60;
const maxBytes = 16 * 1024;
const encoder = new TextEncoder();
const unavailable = () => ({
  status: 503,
  code: "LOGIN_PROTECTION_UNAVAILABLE",
  retryAfter: 5,
  error:
    "Sign-in protection is temporarily unavailable. Wait a few seconds and try again.",
});

function validCounts(counts, total) {
  if (!counts || typeof counts !== "object" || Array.isArray(counts))
    return false;
  const entries = Object.entries(counts);
  return (
    entries.length <= LOGIN_GLOBAL_LIMIT &&
    entries.every(
      ([key, count]) =>
        /^[a-f0-9]{64}$/.test(key) &&
        Number.isInteger(count) &&
        count > 0 &&
        count <= LOGIN_IDENTITY_LIMIT,
    ) &&
    entries.reduce((sum, [, count]) => sum + count, 0) === total
  );
}
function validState(state, now) {
  return (
    state?.version === 1 &&
    Number.isSafeInteger(state.startedAt) &&
    state.startedAt >= 0 &&
    state.startedAt <= now + 60000 &&
    Number.isInteger(state.attempts) &&
    state.attempts >= 0 &&
    state.attempts <= LOGIN_GLOBAL_LIMIT &&
    validCounts(state.clients, state.attempts) &&
    validCounts(state.accounts, state.attempts)
  );
}
async function identities(request, secret, email) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const hash = async (value) =>
    Array.from(
      new Uint8Array(
        await crypto.subtle.sign("HMAC", key, encoder.encode(value)),
      ),
      (byte) => byte.toString(16).padStart(2, "0"),
    ).join("");
  // Cloudflare supplies this at the edge. Never trust X-Forwarded-For or an
  // application-supplied identifier. Missing IPs share a restrictive fallback.
  const client =
    request.headers.get("cf-connecting-ip")?.trim().toLowerCase() || "unknown";
  return Promise.all([
    hash("building-schmidt-login-client\0" + client.slice(0, 64)),
    hash("building-schmidt-login-account\0" + email.toLowerCase().trim()),
  ]);
}
export async function reserveLoginAttempt(
  request,
  env,
  email,
  now = Date.now(),
) {
  try {
    if (
      !Number.isSafeInteger(now) ||
      now < 0 ||
      !env.PHOTOS ||
      !env.admin_password
    )
      return unavailable();
    const [client, account] = await identities(
      request,
      env.admin_password,
      email,
    );
    for (let attempt = 0; attempt < 4; attempt++) {
      const object = await env.PHOTOS.get(LOGIN_LIMIT_KEY);
      let state;
      if (object) {
        if (!object.etag || object.size > maxBytes) return unavailable();
        const text = await object.text();
        if (encoder.encode(text).length > maxBytes) return unavailable();
        state = JSON.parse(text);
        if (!validState(state, now)) return unavailable();
      }
      if (!state || now >= state.startedAt + LOGIN_WINDOW_MS)
        state = {
          version: 1,
          startedAt: now,
          attempts: 0,
          clients: {},
          accounts: {},
        };
      if (
        state.attempts >= LOGIN_GLOBAL_LIMIT ||
        (state.clients[client] || 0) >= LOGIN_IDENTITY_LIMIT ||
        (state.accounts[account] || 0) >= LOGIN_IDENTITY_LIMIT
      ) {
        const retryAfter = Math.max(
          1,
          Math.ceil((state.startedAt + LOGIN_WINDOW_MS - now) / 1000),
        );
        const minutes = Math.ceil(retryAfter / 60);
        return {
          status: 429,
          code: "LOGIN_RATE_LIMITED",
          retryAfter,
          error:
            "Too many sign-in attempts. Try again in " +
            minutes +
            (minutes === 1 ? " minute." : " minutes."),
        };
      }
      state.attempts++;
      state.clients[client] = (state.clients[client] || 0) + 1;
      state.accounts[account] = (state.accounts[account] || 0) + 1;
      const saved = await env.PHOTOS.put(
        LOGIN_LIMIT_KEY,
        JSON.stringify(state),
        {
          onlyIf: object
            ? { etagMatches: object.etag }
            : { etagDoesNotMatch: "*" },
          httpMetadata: { contentType: "application/json" },
        },
      );
      if (saved?.etag) return null;
    }
  } catch {
    // Storage faults, contention and uncertain write replies fail closed. Never
    // log credential input or return private provider diagnostics to the client.
  }
  return unavailable();
}
