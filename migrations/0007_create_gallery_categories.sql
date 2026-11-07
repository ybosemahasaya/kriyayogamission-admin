-- Makes gallery categories admin-editable instead of a fixed, hardcoded
-- list (see "categories-fixed-or-editable" in docs/admin-panel-architecture.html
-- -- this is that Phase 2 addition, now built).
--
-- Run with: npx wrangler d1 execute kriyayogamission-admin-db --file=migrations/0007_create_gallery_categories.sql
-- (local dev: add --local; remote/production: add --remote)

CREATE TABLE IF NOT EXISTS gallery_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gallery_categories_display_order ON gallery_categories (display_order);

-- Seed with the 3 categories that already exist today, so existing
-- gallery_images rows (whose `category` column stores one of these exact
-- names as plain text) keep working without any backfill. The slug/order
-- here matches what the public site's Gallery.astro already hardcodes as
-- its default tab order and ADMIN_CATEGORY_SLUG map -- both get replaced
-- with a dynamic fetch against this table, but the values themselves are
-- carried over unchanged so nothing visually shifts on first deploy.
INSERT OR IGNORE INTO gallery_categories (id, name, slug, display_order, created_at) VALUES
  ('cat-kriya-yoga-mission', 'Kriya Yoga Mission', 'kriya-yoga-mission', 0, '2026-11-08T00:00:00.000Z'),
  ('cat-gurudev', 'Gurudev', 'gurudev', 1, '2026-11-08T00:00:00.000Z'),
  ('cat-guru-purnima-2026', 'Guru Purnima 2026', 'guru-purnima-2026', 2, '2026-11-08T00:00:00.000Z');
