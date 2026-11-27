import { isAdmin } from "./auth.js";
import {
  loadSiteBackupState,
  siteBackupSummary,
  snapshotKey,
} from "./site-backup-state.js";
export async function handleAutomaticSiteBackups(request, env) {
  const headers = {
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff",
  };
  if (!(await isAdmin(request, env)))
    return Response.json(
      { error: "Owner sign-in required" },
      { status: 401, headers },
    );
  if (request.method !== "GET")
    return Response.json(
      { error: "Use a GET request." },
      { status: 405, headers: { ...headers, allow: "GET" } },
    );
  try {
    const { state } = await loadSiteBackupState(env.PHOTOS),
      id = new URL(request.url).searchParams.get("id");
    if (id === null)
      return Response.json(siteBackupSummary(state), { headers });
    let key;
    try {
      key = snapshotKey(id);
    } catch {
      return Response.json(
        { error: "Invalid backup ID." },
        { status: 400, headers },
      );
    }
    const snapshot = state.snapshots.find((s) => s.id === id);
    if (!snapshot)
      return Response.json(
        { error: "Backup is no longer retained." },
        { status: 404, headers },
      );
    const object = await env.PHOTOS.get(key, {
      onlyIf: { etagMatches: snapshot.etag },
    });
    if (
      !object?.body ||
      object.etag !== snapshot.etag ||
      object.size !== snapshot.bytes
    )
      return Response.json(
        {
          error:
            "This backup could not be confirmed. Use another retained copy or Backup all data.",
        },
        { status: 409, headers },
      );
    return new Response(object.body, {
      headers: {
        ...headers,
        "content-type": "application/x-ndjson",
        "content-disposition": `attachment; filename="BuildingSchmidt-Automatic-${id}.bsbackup"`,
      },
    });
  } catch (error) {
    console.error("Whole-site backup catalogue unavailable", error);
    return Response.json(
      {
        error:
          "Whole-site backup status is unavailable. Protection is unconfirmed.",
      },
      { status: 503, headers },
    );
  }
}
