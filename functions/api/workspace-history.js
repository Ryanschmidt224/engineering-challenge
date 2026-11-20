// Keep recent revisions in the editable record. Older pages contain only versions
// that have already been committed. Concurrent writers therefore spill the same page.
const pageSize = 10;
const recentLimit = 20;

export function historyKey(workspaceKey, cursor) {
 if (!/^[0-9a-f]{64}$/.test(cursor)) throw Error("Invalid history page");
 const [collection, project, record] = workspaceKey.split("/");
 return "workspace-history/" + project + "/" + collection + "/" + record + "/" + cursor + ".json";
}

export async function retainHistory(bucket, key, previous, snapshot) {
 const history = (Array.isArray(previous.history) ? previous.history : []).map(({instructions, procedures, notes, ...entry}) => entry);
 if (snapshot) history.push(snapshot);
 let olderHistory = previous.olderHistory || null;
 while (history.length > recentLimit) {
  const payload = JSON.stringify({history: history.splice(0, pageSize), olderHistory});
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  olderHistory = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
  // A failed conditional write means another writer already stored these exact bytes.
  await bucket.put(historyKey(key, olderHistory), payload, {onlyIf: {etagDoesNotMatch: "*"}});
 }
 return {history, olderHistory};
}
