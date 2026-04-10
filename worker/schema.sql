-- repo-radar D1 schema
-- Apply with: wrangler d1 execute repo-radar-db --file=worker/schema.sql
--
-- github_repo_id (GitHub's numeric repo ID) is used as the immutable identity
-- key so that data survives repo renames. repo_name is kept for display only.

CREATE TABLE IF NOT EXISTS traffic_snapshots (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  github_repo_id  INTEGER NOT NULL,
  repo_name       TEXT    NOT NULL,  -- display only; may change on rename
  date            TEXT    NOT NULL,  -- YYYY-MM-DD
  views_count     INTEGER NOT NULL DEFAULT 0,
  views_uniques   INTEGER NOT NULL DEFAULT 0,
  clones_count    INTEGER NOT NULL DEFAULT 0,
  clones_uniques  INTEGER NOT NULL DEFAULT 0,
  collected_at    TEXT    NOT NULL,  -- ISO8601
  UNIQUE(github_repo_id, date)
);

CREATE TABLE IF NOT EXISTS repo_metadata (
  github_repo_id    INTEGER PRIMARY KEY,
  repo_name         TEXT    NOT NULL,  -- display only; may change on rename
  stars_count       INTEGER NOT NULL DEFAULT 0,
  forks_count       INTEGER NOT NULL DEFAULT 0,
  open_issues_count INTEGER NOT NULL DEFAULT 0,
  last_pushed_at    TEXT,
  updated_at        TEXT,
  description       TEXT,
  language          TEXT,
  homepage          TEXT,
  html_url          TEXT,
  snapshot_at       TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS referrers (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  github_repo_id INTEGER NOT NULL,
  repo_name      TEXT    NOT NULL,  -- display only; may change on rename
  referrer       TEXT    NOT NULL,
  count          INTEGER NOT NULL DEFAULT 0,
  uniques        INTEGER NOT NULL DEFAULT 0,
  date           TEXT    NOT NULL,  -- YYYY-MM-DD (collection date)
  UNIQUE(github_repo_id, referrer, date)
);

CREATE INDEX IF NOT EXISTS idx_traffic_repo_date ON traffic_snapshots(github_repo_id, date);
CREATE INDEX IF NOT EXISTS idx_referrers_repo_date ON referrers(github_repo_id, date);
