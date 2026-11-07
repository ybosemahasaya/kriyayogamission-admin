-- Phase: persist contact-form submissions (previously email-only, no
-- record -- see "contact-form-log" in docs/admin-panel-architecture.html).
-- Run with: npx wrangler d1 execute kriyayogamission-admin-db --file=migrations/0004_create_contact_messages.sql
-- (local dev: add --local; remote/production: add --remote)
--
-- This targets the admin panel's own D1 database. Never point these
-- commands at any database belonging to the public kriyayogamission site.

CREATE TABLE IF NOT EXISTS contact_messages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  -- 'new' -> 'read' -> 'replied', set by an admin from the UI.
  status TEXT NOT NULL DEFAULT 'new',
  -- Whether the Resend API call (made by the public site's own Worker)
  -- reported success. Written at insert time as 0 (pessimistic default --
  -- see worker/api/public-contact.ts), then best-effort updated to 1 via
  -- a follow-up PATCH once the public site's Resend call actually
  -- completes. If that follow-up never arrives (admin Worker briefly
  -- down, etc.) this just stays 0 even though the email secretly sent --
  -- a minor inaccuracy, acceptable since the row's mere existence is the
  -- actual safety net this table exists for, not this flag.
  email_sent INTEGER NOT NULL DEFAULT 0,
  -- Resend's own email id, for cross-referencing against Resend's
  -- dashboard/API later (e.g. a future per-message delivery-status
  -- lookup). Null until the follow-up PATCH arrives.
  resend_message_id TEXT,
  source_ip TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON contact_messages (status);
CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON contact_messages (created_at);
