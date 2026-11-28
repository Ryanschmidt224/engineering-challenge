import { handleProjectEngine } from "./functions/api/project-engine.js";
import { runNightlyBackups } from "./functions/api/scheduled-backups.js";
import { isAdmin } from "./functions/api/auth.js";
import { guardPrivateApi } from "./functions/api/private-access.js";
import { apiDispatch } from "./functions/api/api-routes.js";
import { secureResponse } from "./functions/security-headers.js";
const retired = new Set([
  "/api/knowledge",
  "/api/project-engine/proof",
  "/api/projects",
  "/api/numbering",
  "/api/tree",
  "/api/wires",
  "/api/harness",
  "/api/workspace",
  "/api/components",
  "/api/components/photo",
  "/api/components/extract",
  "/api/part-files",
  "/api/project-files",
  "/api/part-pages",
  "/api/part-code",
  "/api/unstructured-notes",
  "/api/investigations",
  "/api/assembly-archive",
  "/api/project-milestones",
  "/api/recipe-files",
  "/api/photo-annotations",
  "/api/project/archive",
  "/api/project/staging",
  "/api/project/backups",
  "/api/drawings",
  "/api/photos",
  "/api/photo",
  "/api/commonparts",
  "/api/purchased-parts",
  "/api/personal-workshop",
  "/api/workshop-photo",
  "/api/workshop-reference",
  "/api/workshop-templates",
  "/api/workshop-image-import",
]);
const application = {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
    try {
      if (path === "/" || path === "/index.html")
        return Response.redirect(new URL("/project.html", request.url), 302);
      const enginePage = [
        "/project",
        "/project/",
        "/project.html",
        "/website-settings.html",
      ].includes(path);
      if (enginePage && !(await isAdmin(request, env))) {
        const url = new URL(request.url);
        url.pathname = "/project-signin.html";
        url.search = "";
        const page = await env.ASSETS.fetch(
          new Request(url, { method: "GET" }),
        );
        return new Response(page.body, {
          status: 401,
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
          },
        });
      }
      const denied = await guardPrivateApi(request, env);
      if (denied) return denied;
      if (retired.has(path))
        return Response.json(
          {
            error: "The previous project system has been retired.",
            code: "LEGACY_RETIRED",
          },
          { status: 410, headers: { "cache-control": "private, no-store" } },
        );
      if (path.startsWith("/api/project-engine/"))
        return await handleProjectEngine(request, env);
      const handler = apiDispatch.get(path);
      if (handler) return await handler(request, env, ctx);
      if (path.startsWith("/api/"))
        return Response.json(
          { error: "API route not found" },
          { status: 404, headers: { "cache-control": "no-store" } },
        );
      return await env.ASSETS.fetch(request);
    } catch (error) {
      // Return a structured, non-sensitive error for account failures.
      const diagnosticId = crypto.randomUUID();
      console.error("Request failed", diagnosticId, path, error);
      if (path === "/api/accounts")
        return new Response(
          JSON.stringify({
            error:
              "The account service encountered an unexpected error. Contact the site administrator with this reference if it persists.",
            code: "ACCOUNT_UNEXPECTED_ERROR",
            reference: diagnosticId,
          }),
          {
            status: 500,
            headers: {
              "content-type": "application/json",
              "cache-control": "no-store",
            },
          },
        );
      return new Response("Internal server error", { status: 500 });
    }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runNightlyBackups(env, new Date(event.scheduledTime)));
  },
};

export default {
  async fetch(request, env, ctx) {
    return secureResponse(await application.fetch(request, env, ctx));
  },
  scheduled: application.scheduled,
};
