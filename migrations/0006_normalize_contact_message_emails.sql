-- One-time cleanup: canonicalizes any emails stored before the
-- normalize-on-write fix (worker/api/public-contact.ts and the Resend
-- backfill handler both now store LOWER(TRIM(email)) going forward).
-- The Contacts directory query (worker/api/contacts.ts) is already
-- defensive against mixed-casing on its own, so this isn't strictly
-- required for correctness there -- but normalizing the actual stored
-- data is better hygiene than only ever compensating for it at read
-- time, and benefits any future feature that queries/matches on email
-- (search, mailto links, etc.).
--
-- Idempotent -- safe to run more than once; rows already canonical are
-- simply left unchanged (the WHERE clause means zero rows match on a
-- second run).
--
-- Run with: npx wrangler d1 execute kriyayogamission-admin-db --remote --file=migrations/0006_normalize_contact_message_emails.sql

UPDATE contact_messages
SET email = LOWER(TRIM(email))
WHERE email != LOWER(TRIM(email));
