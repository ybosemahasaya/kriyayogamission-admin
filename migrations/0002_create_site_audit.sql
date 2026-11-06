-- Phase 2 schema for the Mini Site Audit feature (see "mini-site-audit"
-- roadmap item in docs/admin-panel-architecture.html).
-- Run with: npx wrangler d1 execute kriyayogamission-admin-db --file=migrations/0002_create_site_audit.sql
-- (local dev: add --local; remote/production: add --remote)

CREATE TABLE IF NOT EXISTS site_audit_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL DEFAULT 'running', -- running | complete | failed
  pages_crawled INTEGER NOT NULL DEFAULT 0,
  health_score INTEGER,
  error_count INTEGER NOT NULL DEFAULT 0,
  warning_count INTEGER NOT NULL DEFAULT 0,
  notice_count INTEGER NOT NULL DEFAULT 0,
  triggered_by TEXT
);

CREATE TABLE IF NOT EXISTS site_audit_pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL REFERENCES site_audit_runs(id),
  url TEXT NOT NULL,
  status_code INTEGER,
  title TEXT,
  meta_description TEXT,
  h1_count INTEGER NOT NULL DEFAULT 0,
  issue_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS site_audit_issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL REFERENCES site_audit_runs(id),
  page_id INTEGER REFERENCES site_audit_pages(id), -- NULL = site-wide issue
  severity TEXT NOT NULL, -- error | warning | notice
  check_type TEXT NOT NULL,
  message TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_site_audit_pages_run_id ON site_audit_pages (run_id);
CREATE INDEX IF NOT EXISTS idx_site_audit_issues_run_id ON site_audit_issues (run_id);
CREATE INDEX IF NOT EXISTS idx_site_audit_runs_started_at ON site_audit_runs (started_at DESC);
