// One owner boundary for every application API.
import { isAdmin } from "./auth.js";

const json = (body, status) =>
  Response.json(body, {
    status,
    headers: {
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });

export async function guardPrivateApi(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return null;
  if (url.pathname === "/api/accounts" || url.pathname === "/api/auth")
    return null;
  if (!(await isAdmin(request, env))) {
    return json(
      { error: "Owner sign-in required", code: "OWNER_REQUIRED" },
      401,
    );
  }
  if (
    !["GET", "HEAD"].includes(request.method) &&
    request.headers.get("origin") !== url.origin
  ) {
    return json(
      { error: "Invalid request origin", code: "INVALID_ORIGIN" },
      403,
    );
  }
  if (
    url.pathname === "/api/workshop-lookup" &&
    env.AI_LOOKUP_ENABLED !== "1"
  ) {
    return json(
      {
        error: "AI lookup is paused. You can still enter details manually.",
        code: "AI_PAUSED",
      },
      503,
    );
  }
  return null;
}
