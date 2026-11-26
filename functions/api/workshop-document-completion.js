import { sha256 } from "./project-archive.js";
// Only a newly confirmed completion needs a byte read. Ordinary later product
// saves keep the immutable attachment reference without downloading it again.
export async function verifyDocumentCompletion(env, productId, next, previous) {
  const upload = next.documentUpload,
    prior = previous?.documentUpload;
  if (
    !upload ||
    upload.status !== "saved" ||
    (prior?.status === "saved" &&
      prior.id === upload.id &&
      prior.sha256 === upload.sha256)
  )
    return;
  const attachment = await env.WORKSHOP_DB.prepare(
    "SELECT product_id,r2_key,archived,title FROM workshop_attachments WHERE id=?",
  )
    .bind(upload.id)
    .first();
  if (
    !attachment ||
    attachment.product_id !== productId ||
    attachment.archived ||
    attachment.title !== upload.name
  )
    throw Error(
      "The technical document is not saved on this product yet. Retry its upload.",
    );
  const object = await env.PHOTOS?.get(attachment.r2_key);
  if (
    !object ||
    object.size > 5 * 1024 * 1024 ||
    (await sha256(new Uint8Array(await object.arrayBuffer()))) !== upload.sha256
  )
    throw Error(
      "The technical document could not be verified. Retry its upload.",
    );
}
