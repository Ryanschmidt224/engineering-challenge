import { handleProjectWorkspace } from "./project-workspace-api.js";
import { accountUser } from "./accounts.js";
const json = (data, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
export async function handleProjectEngine(request, env) {
  const owner = await accountUser(request, env);
  if (owner?.role !== "admin")
    return json({ error: "Owner sign-in required" }, 401);
  const url = new URL(request.url);
  if (
    request.headers.get("origin") !== url.origin &&
    !["GET", "HEAD"].includes(request.method)
  )
    return json({ error: "Invalid request origin" }, 403);
  if (
    url.pathname === "/api/project-engine/environment" &&
    request.method === "GET"
  ) {
    const version = env.CF_VERSION_METADATA;
    if (!version?.id)
      return json({ error: "Deployment version metadata is unavailable" }, 503);
    return json({
      versionId: version.id,
      versionTag: version.tag || null,
      createdAt: version.timestamp || null,
    });
  }
  if (!env.WORKSHOP_DB)
    return json({ error: "Project D1 binding is not configured" }, 503);
  return handleProjectWorkspace(request, env, owner);
}
