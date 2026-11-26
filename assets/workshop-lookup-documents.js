import "./photo-markup.js";
import { node, actions, button } from "./workshop-ui.js";
import { fileDropTarget } from "./file-selection.js";
export { requireLookupIdentity } from "./workshop-lookup-provenance.js";
const pending = new Map();
export const lookupDocument = (id) => pending.get(id) || null;
export const identityRequired = (record) =>
  !!record.lookup_provenance?.identityRequired;
export function clearLookupDocuments(id) {
  pending.delete(id);
}
const digest = async (file) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", await file.arrayBuffer()),
    ),
    (v) => v.toString(16).padStart(2, "0"),
  ).join("");
export async function documentPayload(id) {
  const entry = pending.get(id);
  if (!entry) return null;
  if (entry.savedId) return { attachmentId: entry.savedId };
  const bytes = new Uint8Array(await entry.file.arrayBuffer());
  let raw = "";
  for (let i = 0; i < bytes.length; i += 8192)
    raw += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return {
    name: entry.file.name,
    type:
      entry.file.type ||
      (/\.pdf$/i.test(entry.file.name) ? "application/pdf" : "text/plain"),
    data: btoa(raw),
  };
}
export async function prepareLookupDocument(record) {
  const entry = pending.get(record.id);
  if (!entry) return;
  if (entry.savedId) {
    const upload = record.lookup_provenance?.documentUpload;
    if (upload?.status === "pending" && upload.id === entry.savedId)
      upload.status = "saved";
    return;
  }
  const sha256 = await digest(entry.file),
    prior = record.lookup_provenance?.documentUpload;
  if (
    prior?.status === "pending" &&
    prior.name === entry.file.name &&
    prior.sha256 === sha256
  )
    entry.uploadId = prior.id;
  for (const evidence of Object.values(record.lookup_provenance?.fields || {}))
    if (evidence.document?.sha256 === sha256)
      evidence.document.id = entry.uploadId;
  record.lookup_provenance = {
    ...(record.lookup_provenance || {}),
    documentUpload: {
      id: entry.uploadId,
      name: entry.file.name,
      sha256,
      status: "pending",
    },
  };
}
export async function saveLookupDocument(id) {
  const entry = pending.get(id);
  if (!entry || entry.savedId) return false;
  if (entry.uploaded) return true;
  try {
    const response = await fetch(
      "/api/workshop/file?owner=product&id=" + encodeURIComponent(id),
      {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "x-file-name": encodeURIComponent(entry.file.name),
          "x-upload-id": entry.uploadId,
        },
        body: entry.file,
      },
    );
    const data = await response.json();
    if (!response.ok) throw Error(data.error || "Try again.");
    entry.uploaded = true;
    return true;
  } catch (error) {
    throw Error(
      "Product saved, but document upload is unconfirmed. Retry document upload; the same file identity will be reused. " +
        error.message,
    );
  }
}
export function lookupDocumentField(
  id,
  onChange = () => {},
  saved = [],
  record = {},
) {
  const root = node("div"),
    label = node("strong", "Datasheet or technical document (optional)"),
    input = node("input"),
    status = node("p", "", "muted");
  input.type = "file";
  input.hidden = true;
  input.accept = ".pdf,.txt,.csv,image/png,image/jpeg,image/webp";
  input.setAttribute("aria-label", "Datasheet or technical document");
  const describe = () => {
    const entry = pending.get(id),
      prior = record.lookup_provenance?.documentUpload;
    status.textContent = entry?.savedId
      ? "Using saved document: " + entry.title
      : entry
        ? entry.file.name +
          " — saved to this Workshop product when you Save product."
        : prior?.status === "pending"
          ? "Product saved; document upload is unconfirmed. Reselect " +
            prior.name +
            " to retry with the same upload identity."
          : "Optional PDF, text, CSV or image; up to 5 MB. Used as a source for template fields.";
  };
  const choose = (files) => {
    const file = files[0];
    if (!file) return;
    if (
      !file.size ||
      file.size > 5 * 1024 * 1024 ||
      !/\.(pdf|txt|csv|png|jpe?g|webp)$/i.test(file.name)
    ) {
      status.textContent =
        "Choose a PDF, text, CSV, PNG, JPG or WebP file up to 5 MB.";
      return;
    }
    pending.set(id, {
      file,
      tag: crypto.randomUUID(),
      uploadId: crypto.randomUUID(),
    });
    describe();
    onChange();
  };
  if (saved.length) {
    const select = node("select", "", "field");
    select.setAttribute("aria-label", "Use saved technical document");
    for (const file of [
      { id: "", title: "No saved document selected" },
      ...saved,
    ]) {
      const option = node("option", file.title);
      option.value = file.id;
      select.append(option);
    }
    select.value = pending.get(id)?.savedId || "";
    select.onchange = () => {
      const file = saved.find((v) => v.id === select.value);
      if (file)
        pending.set(id, {
          savedId: file.id,
          title: file.title,
          tag: crypto.randomUUID(),
        });
      else pending.delete(id);
      describe();
      onChange();
    };
    root.append(select);
  }
  input.onchange = () => {
    choose([...input.files]);
    input.value = "";
  };
  const drop = fileDropTarget(choose, {
    multiple: false,
    label: "Drop datasheet or paste a file",
    text: "Drop a document or paste a copied image/file",
  });
  const controls = actions(
    button("Add document", () => input.click()),
    drop,
    button(
      "Remove selected document",
      () => {
        pending.delete(id);
        describe();
        onChange();
      },
      "button--quiet",
    ),
  );
  if (record.lookup_provenance?.documentUpload?.status === "pending") {
    const forget = button(
      "Forget unconfirmed document",
      () => {
        pending.delete(id);
        input.value = "";
        record.lookup_provenance.documentUpload = null;
        forget.hidden = true;
        describe();
        onChange({ forgotten: true });
      },
      "button--quiet",
    );
    controls.append(forget);
    root.append(
      node(
        "p",
        "Forgetting clears the unfinished upload requirement when you Save product. It does not delete saved files or AI source evidence.",
        "muted",
      ),
    );
  }
  controls.classList.add("bs-photo-upload-row");
  root.append(label, controls, input, status);
  describe();
  return root;
}
