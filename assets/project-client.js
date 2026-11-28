import { requestResult } from "./request-result.js";
// One preview API client. A transport retry keeps the exact operation and token;
// edited content receives a new operation. Conflicts never retry automatically.
export function createProjectClient({ fetcher = fetch } = {}) {
  let state = null,
    loadSequence = 0;
  const pending = new Map(),
    uploads = new WeakMap();
  async function request(path, options = {}, valid) {
    return requestResult(
      "/api/project-engine/projects" + path,
      {
        credentials: "same-origin",
        cache: "no-store",
        ...options,
      },
      { fetcher, ...(valid ? { valid } : {}) },
    );
  }

  async function load(projectId) {
    const sequence = ++loadSequence,
      result = await request("/" + projectId + "/state");
    if (sequence === loadSequence) state = result;
    return result;
  }
  async function write(
    projectId,
    path,
    method,
    data = {},
    expectedRevision = state?.project.revision ?? null,
  ) {
    const key = JSON.stringify([
      projectId,
      path,
      method,
      data,
      expectedRevision,
    ]);
    let entry = pending.get(key);
    let body = entry?.body;
    if (!body) {
      body = { ...data, expectedRevision, operationId: crypto.randomUUID() };
      entry = { body, confirmed: false, running: null };
      pending.set(key, entry);
    }
    if (entry.running) return entry.running;
    const task = async () => {
      const result = await request(
        "/" + projectId + path,
        {
          method,
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
        (value) => typeof value?.revision === "string" && !!value.revision,
      );
      entry.confirmed = true;
      loadSequence++;
      if (
        state?.project.id === projectId &&
        (state.project.revision === expectedRevision ||
          state.project.revision === result.revision)
      )
        state.project.revision = result.revision;
      return result;
    };
    entry.running = task();
    try {
      return await entry.running;
    } finally {
      entry.running = null;
    }
  }
  // Only call after the UI has successfully consumed the saved state. Uncertain
  // operations remain replayable; a failed refresh must not acknowledge them.
  function acknowledge(projectId) {
    for (const [key, entry] of pending)
      if (JSON.parse(key)[0] === projectId && entry.confirmed && !entry.running)
        pending.delete(key);
  }
  async function upload(
    projectId,
    file,
    {
      itemId = null,
      occurrenceId = null,
      expectedRevision = state?.project.revision ?? null,
    } = {},
  ) {
    const key = JSON.stringify([
      projectId,
      itemId,
      occurrenceId,
      expectedRevision,
    ]);
    let jobs = uploads.get(file);
    if (!jobs) {
      jobs = new Map();
      uploads.set(file, jobs);
    }
    let job = jobs.get(key);
    if (!job) {
      job = { operationId: crypto.randomUUID() };
      jobs.set(key, job);
    }
    if (job.result) return job.result;
    if (job.running) return job.running;
    const run = async () => {
      job.prepared ||= await write(
        projectId,
        "/files/prepare",
        "POST",
        {
          name: file.name,
          content_type: file.type || "application/octet-stream",
        },
        expectedRevision,
      );
      const prepared = job.prepared,
        revision = prepared.revision,
        options = {
          method: "PUT",
          headers: {
            "x-operation-id": job.operationId,
            "x-project-revision": revision,
          },
          body: file,
        };
      // Retain phase and IDs after a lost admission response. The same file/draft
      // retry must replay admission, not attempt new bytes on an already ready file.
      if (!job.bytes) {
        try {
          await request(
            "/" + projectId + "/files/" + prepared.fileId + "/bytes",
            options,
          );
        } catch (error) {
          if (error.status) throw error;
          await request(
            "/" + projectId + "/files/" + prepared.fileId + "/bytes",
            options,
          );
        }
        job.bytes = true;
      }
      job.result = await write(
        projectId,
        "/files/" + prepared.fileId + "/admit",
        "POST",
        {
          role: itemId ? "engineering" : "support",
          ...(itemId
            ? { itemId, ...(occurrenceId ? { occurrenceId } : {}) }
            : {}),
        },
        revision,
      );
      return job.result;
    };
    job.running = run();
    try {
      return await job.running;
    } finally {
      job.running = null;
    }
  }
  return {
    request,
    load,
    write,
    upload,
    acknowledge,
    get state() {
      return state;
    },
  };
}
