// One-time, lossless retirement of Practice. Record and attachment IDs stay put.
export async function upgradePracticeRecords(env, project, object, saved, original) {
  if (!Array.isArray(saved.records) || !saved.records.some(record => record.category === "practice")) return {object, saved};
  const backupKey = "record-migrations/" + project + "/practice-to-notes-" + crypto.randomUUID() + ".json";
  const backup = await env.PHOTOS.put(backupKey, original, {onlyIf: {etagDoesNotMatch: "*"}});
  if (!backup || await (await env.PHOTOS.get(backupKey))?.text() !== original) throw Error("Record upgrade backup could not be verified");
  const converted = {...saved, revision: crypto.randomUUID(), records: saved.records.map(record => record.category !== "practice" ? record : {
    ...record, category: "note", entries: (record.entries || []).map(entry => ({...entry,
      descriptor: entry.descriptor || ({attempt: "What did you practice?", lesson: "What did you learn?"})[entry.type] || "Practice note"
    }))
  })};
  const result = await env.PHOTOS.put("investigations/" + project + ".json", JSON.stringify(converted), {onlyIf: {etagMatches: object.etag}});
  if (result === null) throw Error("Records changed during upgrade; retry to read the latest version");
  return {object: {etag: result.etag}, saved: converted};
}
