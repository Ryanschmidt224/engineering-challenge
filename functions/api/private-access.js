// Temporary containment while the existing login is replaced by Cloudflare
// Access. Keep one boundary in front of every API, including legacy routes.
import {isAdmin} from "./auth.js";

const paidRoutes = new Set(["/api/workshop-lookup", "/api/components/extract"]);
const json = (body, status) => Response.json(body, {
  status,
  headers: {"cache-control": "private, no-store", "x-content-type-options": "nosniff"}
});

export async function guardPrivateApi(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return null;
  if (url.pathname === "/api/accounts" || url.pathname === "/api/auth") return null;
  if (!await isAdmin(request, env)) {
    return json({error: "Owner sign-in required", code: "OWNER_REQUIRED"}, 401);
  }
  if (!["GET", "HEAD"].includes(request.method) && request.headers.get("origin") !== url.origin) {
    return json({error: "Invalid request origin", code: "INVALID_ORIGIN"}, 403);
  }
  if (paidRoutes.has(url.pathname)) {
    return json({error: "AI lookup is paused while its global spending limit is implemented. You can still enter details manually.", code: "AI_PAUSED"}, 503);
  }
  return null;
}
