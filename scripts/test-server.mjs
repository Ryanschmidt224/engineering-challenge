// Internal QA only: real Worker handlers with disposable SQLite/R2 fixtures.
// This file is not imported or served by the deployed Cloudflare Worker.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import worker from "../worker.js";
import { accountUser } from "../functions/api/accounts.js";
import { initializeProjectEngine } from "../functions/api/project-engine-migrations.js";
import { commandBody } from "../functions/api/project-workspace-api.js";
import { proveProjectCommands } from "../tests/helpers/project-command-proof.mjs";
import { TestD1 } from "../tests/helpers/d1.mjs";
import { TestR2 } from "../tests/helpers/r2.mjs";
import { provisionTestAccount } from "../tests/helpers/accounts.mjs";

const root = process.cwd(),
  port = Number(process.env.PORT) || 4173;
const mime = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
};
async function asset(request) {
  const url = new URL(request.url);
  let name;
  try {
    name = decodeURIComponent(url.pathname);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  if (name === "/") name = "/index.html";
  // Fixed test-only prefix, never included in the production asset upload.
  const proof =
    /^\/__test__\/proof\/project-(?:engine|recovery|assembly)-proof\.(?:html|js)$/.test(
      name,
    );
  const path = resolve(
    root,
    proof ? "tests/proof/" + name.split("/").at(-1) : "." + name,
  );
  if (
    !path.startsWith(root + sep) ||
    !mime[extname(path)] ||
    /\/(?:tests|scripts|\.git|\.openai)\//.test(name)
  )
    return new Response("Not found", { status: 404 });
  try {
    return new Response(await readFile(path), {
      headers: {
        "content-type": mime[extname(path)],
        "cache-control": "no-store",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
async function commandProof(request, bound) {
  const owner = await accountUser(request, bound);
  if (owner?.role !== "admin")
    return new Response("Owner required", { status: 401 });
  if (
    request.method !== "POST" ||
    request.headers.get("origin") !== new URL(request.url).origin
  )
    return new Response("Invalid origin or method", { status: 403 });
  try {
    const body = await commandBody(request, 2048);
    if (body.expectedRevision !== null) throw Error("Use a new proof ID");
    await initializeProjectEngine(bound.WORKSHOP_DB);
    return Response.json(
      await proveProjectCommands(bound.WORKSHOP_DB, owner.id, body.operationId),
    );
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
let env, cookie;
const active = new Map(),
  retired = new Set();
async function reset(role = "admin") {
  const previous = env;
  if (previous) {
    if (active.get(previous)) retired.add(previous);
    else previous.WORKSHOP_DB.close();
  }
  env = {
    PHOTOS: new TestR2(),
    WORKSHOP_DB: new TestD1(),
    admin_password: "disposable-test-server-secret",
    ASSETS: { fetch: asset },
  };
  const origin = "http://127.0.0.1:" + port;
  const login = await provisionTestAccount(
    new Request(origin + "/api/accounts", {
      method: "POST",
      headers: { origin },
      body: JSON.stringify({
        action: "register",
        email: "owner@example.test",
        password: "disposable-test-password",
      }),
    }),
    env,
    { role },
  );
  cookie = login.headers.get("set-cookie").split(";")[0];
  return cookie;
}
await reset();
const server = createServer(async (req, res) => {
  try {
    const origin = "http://127.0.0.1:" + port,
      url = new URL(req.url, origin);
    if (url.pathname === "/__test__/ready") {
      res.writeHead(200);
      res.end("ready");
      return;
    }
    if (url.pathname === "/__test__/reset" && req.method === "POST") {
      const token = await reset(
        url.searchParams.get("role") === "member" ? "member" : "admin",
      );
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ cookie: token }));
      return;
    }
    if (url.pathname === "/__test__/owner") {
      res.writeHead(302, {
        "set-cookie": cookie + "; Path=/; HttpOnly; SameSite=Strict",
        location: "/workshop.html",
      });
      res.end();
      return;
    }
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 12 * 1024 * 1024) {
        res.writeHead(413);
        res.end("Too large");
        return;
      }
      chunks.push(chunk);
    }
    const request = new Request(url, {
      method: req.method,
      headers: req.headers,
      ...(!["GET", "HEAD"].includes(req.method)
        ? { body: Buffer.concat(chunks) }
        : {}),
    });
    const bound = env;
    active.set(bound, (active.get(bound) || 0) + 1);
    try {
      const response =
        url.pathname === "/__test__/command-proof"
          ? await commandProof(request, bound)
          : await worker.fetch(request, bound, {
              waitUntil: (promise) => promise.catch(console.error),
            });
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } finally {
      const remaining = active.get(bound) - 1;
      if (remaining) active.set(bound, remaining);
      else {
        active.delete(bound);
        if (retired.delete(bound)) bound.WORKSHOP_DB.close();
      }
    }
  } catch (error) {
    console.error(error);
    res.writeHead(500);
    res.end("Internal test-server error");
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log("Disposable Worker test server listening on " + port),
);
process.on("SIGTERM", () =>
  server.close(() => {
    env.WORKSHOP_DB.close();
    process.exit(0);
  }),
);
