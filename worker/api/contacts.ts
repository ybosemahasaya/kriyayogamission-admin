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
 * fresh rather than a separately maintained table). SQLite's window
 * functions pick each email's MOST RECENT row for name/phone/address,
 * since a plain MAX(column) would only give the max of each column
 * independently, not "all three columns from the same latest row".
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
    `WITH latest AS (
       SELECT email, name, phone, address, created_at,
              ROW_NUMBER() OVER (PARTITION BY email ORDER BY created_at DESC) AS rn
       FROM contact_messages
     ),
     counts AS (
       SELECT email, COUNT(*) AS message_count,
              MIN(created_at) AS first_contacted_at, MAX(created_at) AS last_contacted_at
       FROM contact_messages
       GROUP BY email
     )
     SELECT latest.email, latest.name, latest.phone, latest.address,
            counts.message_count, counts.first_contacted_at, counts.last_contacted_at
     FROM latest
     JOIN counts ON counts.email = latest.email
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
