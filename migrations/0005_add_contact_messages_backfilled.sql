-- Adds a marker so the UI can distinguish organically-captured submissions
-- from ones reconstructed after the fact from Resend's send history (see
-- worker/api/contact-messages.ts's backfill handler). Backfilled rows
-- necessarily lack some fidelity the original flow would have had (no
-- source_ip, created_at is Resend's send timestamp rather than the exact
-- form-submit moment, status defaults to 'read' rather than 'new' since
-- these were already seen via the original email) -- flagging this
-- honestly in the UI beats pretending they're indistinguishable from
-- freshly-captured rows.
--
-- Run with: npx wrangler d1 execute kriyayogamission-admin-db --remote --file=migrations/0005_add_contact_messages_backfilled.sql

ALTER TABLE contact_messages ADD COLUMN backfilled INTEGER NOT NULL DEFAULT 0;
