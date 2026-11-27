// Historical tile rows remain part of Workshop exports. No runtime writer.
export async function knowledgeSnapshot(db) {
  const [tiles, links] = await db.batch([
    db.prepare("SELECT * FROM knowledge_tiles ORDER BY title COLLATE NOCASE"),
    db.prepare("SELECT * FROM knowledge_links ORDER BY created_at"),
  ]);
  return {
    tiles: tiles.results.map((row) => ({
      ...row,
      sources: JSON.parse(row.sources),
    })),
    links: links.results,
  };
}
