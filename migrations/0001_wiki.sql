-- Wiki-style content and moderation. Apply to a Cloudflare D1 database.
CREATE TABLE IF NOT EXISTS wiki_pages (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  current_revision_id TEXT,
  protected INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS wiki_revisions (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES wiki_pages(id),
  parent_revision_id TEXT,
  author_id TEXT NOT NULL,
  body TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL CHECK(status IN ('pending','published','rejected','reverted')),
  reviewed_by TEXT,
  reviewed_at TEXT
);
CREATE INDEX IF NOT EXISTS wiki_revisions_page ON wiki_revisions(page_id,created_at DESC);
CREATE INDEX IF NOT EXISTS wiki_revisions_pending ON wiki_revisions(status,created_at);
CREATE TABLE IF NOT EXISTS wiki_editors (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('temporary','registered','moderator','admin')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  disabled INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS wiki_audit (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  page_id TEXT,
  revision_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
