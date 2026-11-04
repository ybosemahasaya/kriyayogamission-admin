-- Phase 1 schema for the gallery_images table.
-- Run with: npx wrangler d1 execute kriyayogamission-admin-db --file=migrations/0001_create_gallery_images.sql
-- (local dev: add --local; remote/production: add --remote)
--
-- This targets a D1 database created fresh for THIS project. Never point
-- these commands at any database belonging to the public kriyayogamission
-- site.

CREATE TABLE IF NOT EXISTS gallery_images (
  id TEXT PRIMARY KEY,
  r2_key TEXT NOT NULL,
  alt_text TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  uploaded_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_gallery_images_category ON gallery_images (category);
CREATE INDEX IF NOT EXISTS idx_gallery_images_display_order ON gallery_images (display_order);
