export async function workshopRequest(path, method = "GET", body) {
  const response = await fetch(path, {method, credentials: "same-origin", cache: "no-store",
    ...(body === undefined ? {} : {headers: {"content-type": "application/json"}, body: JSON.stringify(body)})});
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "Workshop request failed (" + response.status + ")");
    error.status = response.status; error.code = data.code; throw error;
  }
  return data;
}
export function saveWorkshopRecord(kind, draft, payload, method) {
  const path = kind === "items" ? "/api/workshop-items" : "/api/workshop-layouts";
  return workshopRequest(path + "?id=" + draft.id, method || (draft.revision ? "PUT" : "POST"),
    {id: draft.id, expectedRevision: draft.revision || null, ...payload});
}
export async function uploadWorkshopFile(file) {
  const response = await fetch("/api/workshop-files", {method: "POST", credentials: "same-origin", headers: {"x-file-name": encodeURIComponent(file.name)}, body: file});
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(data.error || "File upload failed");
  return data.attachment;
}
