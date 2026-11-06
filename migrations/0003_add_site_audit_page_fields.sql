-- Phase 2 schema extension for Statistics + AI Search tabs (see the
-- mini-site-audit roadmap item in docs/admin-panel-architecture.html).
-- Run with: npx wrangler d1 execute kriyayogamission-admin-db --file=migrations/0003_add_site_audit_page_fields.sql
-- (local dev: add --local; remote/production: add --remote)

ALTER TABLE site_audit_pages ADD COLUMN canonical_href TEXT;
ALTER TABLE site_audit_pages ADD COLUMN has_structured_data INTEGER NOT NULL DEFAULT 0;
