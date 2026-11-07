import { errorResponse, json } from "../lib/http";
import type { ContactDirectoryEntry, ContactDirectoryResponse } from "../../shared/contacts";
import type { Env } from "../types";

interface ContactDirectoryRow {
  email: string;
  name: string;
  phone: string;
  address: string;
  message_count: number;
  first_contacted_at: string;
  last_contacted_at: string;
}

/**
 * GET /api/contacts -- a deduplicated "who has contacted us" view derived
 * from contact_messages (see shared/contacts.ts for why this is computed
 * fresh rather than a separately maintained table). Email is the
 * directory's true primary key, not name -- two different people can
 * share a name, but each email is one contact. Grouped on
 * LOWER(TRIM(email)) rather than the raw column so that
 * "John@Example.com" and "john@example.com " always resolve to the same
 * contact: both the live ingest path (worker/api/public-contact.ts) and
 * the Resend backfill now store emails pre-normalized, but this stays
 * defensive against any rows that predate that fix. SQLite's window
 * function then picks each email's MOST RECENT row for name/phone/
 * address, since a plain MAX(column) would only give the max of each
 * column independently, not "all three columns from the same latest row".
 */
export async function handleContactsRequest(env: Env): Promise<Response> {
  if (!env.DB) {
    return errorResponse(
      "Contact message storage is not provisioned yet. Run migrations/0004_create_contact_messages.sql " +
        "against this project's D1 database (see docs/admin-panel-architecture.html).",
      503,
    );
  }

  const { results } = await env.DB.prepare(
    `WITH normalized AS (
       SELECT LOWER(TRIM(email)) AS email_key, name, phone, address, created_at
       FROM contact_messages
     ),
     latest AS (
       SELECT email_key, name, phone, address, created_at,
              ROW_NUMBER() OVER (PARTITION BY email_key ORDER BY created_at DESC) AS rn
       FROM normalized
     ),
     counts AS (
       SELECT email_key, COUNT(*) AS message_count,
              MIN(created_at) AS first_contacted_at, MAX(created_at) AS last_contacted_at
       FROM normalized
       GROUP BY email_key
     )
     SELECT latest.email_key AS email, latest.name, latest.phone, latest.address,
            counts.message_count, counts.first_contacted_at, counts.last_contacted_at
     FROM latest
     JOIN counts ON counts.email_key = latest.email_key
     WHERE latest.rn = 1
     ORDER BY counts.last_contacted_at DESC`,
  ).all<ContactDirectoryRow>();

  const contacts: ContactDirectoryEntry[] = results.map((row) => ({
    email: row.email,
    name: row.name,
    phone: row.phone,
    address: row.address,
    messageCount: row.message_count,
    firstContactedAt: row.first_contacted_at,
    lastContactedAt: row.last_contacted_at,
  }));

  const response: ContactDirectoryResponse = { contacts };
  return json(response);
}
