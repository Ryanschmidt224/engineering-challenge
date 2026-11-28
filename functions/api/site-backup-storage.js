import {
  SITE_BACKUP_PART_BYTES as PART,
  SITE_BACKUP_MAX_BYTES,
  backupError,
} from "./site-backup-state.js";
const hex = (bytes) =>
  [...new Uint8Array(bytes)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
async function advance(previous, part) {
  const digest = hex(await crypto.subtle.digest("SHA-256", part));
  return hex(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(previous + digest),
    ),
  );
}
// Normalize transport chunks to fixed 8 MiB blocks, never buffering the archive.
export async function* backupBlocks(iterable) {
  let block = new Uint8Array(PART),
    used = 0;
  for await (const chunk of iterable) {
    for (let at = 0; at < chunk.byteLength;) {
      const size = Math.min(PART - used, chunk.byteLength - at);
      block.set(chunk.subarray(at, at + size), used);
      used += size;
      at += size;
      if (used === PART) {
        yield block;
        block = new Uint8Array(PART);
        used = 0;
      }
    }
  }
  if (used) yield block.subarray(0, used);
}
export async function storeSiteBackup(
  bucket,
  key,
  entries,
  { guard, remember },
) {
  let upload = null,
    size = 0,
    digest = "",
    parts = [];
  try {
    for await (const block of backupBlocks(entries)) {
      size += block.byteLength;
      if (size > SITE_BACKUP_MAX_BYTES) throw backupError("SIZE_LIMIT");
      await guard();
      if (!upload) {
        upload = await bucket.createMultipartUpload(key, {
          httpMetadata: { contentType: "application/x-ndjson" },
        });
        // No part is uploaded until its recovery identity is durable.
        await remember({ key, uploadId: upload.uploadId });
      }
      digest = await advance(digest, block);
      parts.push(await upload.uploadPart(parts.length + 1, block));
    }
    if (!upload) throw backupError("EMPTY_ARCHIVE");
    await guard();
    await upload.complete(parts);
    return { bytes: size, digest };
  } catch (error) {
    if (upload) await upload.abort().catch(() => {});
    throw error;
  }
}
export async function verifySiteBackup(bucket, key, expected, guard) {
  const object = await bucket.get(key);
  if (!object?.body || object.size !== expected.bytes)
    throw backupError("VERIFY_FAILED");
  let size = 0,
    digest = "";
  const reader = object.body.getReader();
  async function* chunks() {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        yield value;
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }
  for await (const block of backupBlocks(chunks())) {
    await guard();
    size += block.byteLength;
    digest = await advance(digest, block);
  }
  if (size !== expected.bytes || digest !== expected.digest)
    throw backupError("VERIFY_FAILED");
  return object.etag;
}
export async function abortPendingSiteUpload(bucket, pending) {
  if (!pending || (await bucket.head(pending.key))) return;
  try {
    await bucket.resumeMultipartUpload(pending.key, pending.uploadId).abort();
  } catch (error) {
    if (!/\(10024\)|NoSuchUpload/.test(String(error.message))) throw error;
  }
}
