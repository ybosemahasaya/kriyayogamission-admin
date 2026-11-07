import { errorResponse, json } from "../lib/http";
import { CONTACT_MESSAGE_STATUSES, isContactMessageStatus } from "../../shared/contact-messages";
import type {
  ContactMessageBackfillResult,
  ContactMessageStatusCounts,
  ContactMessageListResponse,
} from "../../shared/contact-messages";
import { parseContactNotificationHtml } from "../lib/contact-html-parser";
import { getSentEmailContent, listAllSentEmails, ResendApiError } from "../lib/resend-client";
import type { ContactMessageRow, Env } from "../types";
import { contactMessageRowToDTO } from "../types";

// Must match the exact subject string literal in the public site's
// worker.js (handleContactForm) -- this is how the backfill below
// recognizes which Resend sends are contact-form notifications versus
// anything else that account might ever send.
const CONTACT_NOTIFICATION_SUBJECT = "New Inquiry for - Kriya Yoga Mission";

// Sanity cap on how many NEW (not-already-present) emails one backfill
// run will fetch full content for and insert -- each one is a separate
// Resend API call, so this bounds both run time and Resend rate-limit
// exposure. Comfortably above what a small nonprofit site's contact form
// realistically accumulates between backfill runs; re-run the action
// again if a single run reports hitting this cap.
const MAX_BACKFILL_PER_RUN = 300;

function requireDb(env: Env): Response | null {
  if (!env.DB) {
    return errorResponse(
      "Contact message storage is not provisioned yet. Run migrations/0004_create_contact_messages.sql " +
        "against this project's D1 database (see docs/admin-panel-architecture.html).",
      503,
    );
  }
  return null;
}

/** Admin-facing CRUD, behind Cloudflare Access -- list/triage/delete
 * contact-form submissions. For the public, unauthenticated write side
 * (what the public site's worker.js actually posts to), see
 * worker/api/public-contact.ts. */
export async function handleContactMessagesRequest(
  request: Request,
  env: Env,
  id: string | null,
): Promise<Response> {
  const bindingError = requireDb(env);
  if (bindingError) return bindingError;

  switch (request.method) {
    case "GET":
      return id ? getOne(env, id) : listAll(request, env);
    case "PATCH":
      return id ? updateStatus(request, env, id) : errorResponse("Missing message id", 400);
    case "DELETE":
      return id ? remove(env, id) : errorResponse("Missing message id", 400);
    default:
      return errorResponse("Method not allowed", 405);
  }
}

async function listAll(request: Request, env: Env): Promise<Response> {
  const statusFilter = new URL(request.url).searchParams.get("status");
  if (statusFilter && !isContactMessageStatus(statusFilter)) {
    return errorResponse(`status must be one of: ${CONTACT_MESSAGE_STATUSES.join(", ")}`);
  }

  const { results } = statusFilter
    ? await env.DB!.prepare("SELECT * FROM contact_messages WHERE status = ? ORDER BY created_at DESC")
        .bind(statusFilter)
        .all<ContactMessageRow>()
    : await env.DB!.prepare("SELECT * FROM contact_messages ORDER BY created_at DESC").all<ContactMessageRow>();

  // Counts always reflect ALL messages (not the current filter) so tab
  // badges stay stable regardless of which tab is active -- same
  // reasoning as the Keyword Rankings tab counts on the Search Console
  // page always showing each group's own total.
  const { results: countRows } = await env.DB!.prepare(
    "SELECT status, COUNT(*) AS n FROM contact_messages GROUP BY status",
  ).all<{ status: string; n: number }>();
  const counts: ContactMessageStatusCounts = { new: 0, read: 0, replied: 0 };
  for (const row of countRows) {
    if (isContactMessageStatus(row.status)) counts[row.status] = row.n;
  }

  const response: ContactMessageListResponse = { messages: results.map(contactMessageRowToDTO), counts };
  return json(response);
}

async function getOne(env: Env, id: string): Promise<Response> {
  const row = await env.DB!.prepare("SELECT * FROM contact_messages WHERE id = ?")
    .bind(id)
    .first<ContactMessageRow>();
  if (!row) return errorResponse("Message not found", 404);
  return json(contactMessageRowToDTO(row));
}

async function updateStatus(request: Request, env: Env, id: string): Promise<Response> {
  const body = await request.json<{ status?: unknown }>();
  if (!isContactMessageStatus(body.status)) {
    return errorResponse(`status must be one of: ${CONTACT_MESSAGE_STATUSES.join(", ")}`);
  }

  const result = await env.DB!.prepare("UPDATE contact_messages SET status = ? WHERE id = ?")
    .bind(body.status, id)
    .run();
  if (result.meta.changes === 0) return errorResponse("Message not found", 404);
  return getOne(env, id);
}

async function remove(env: Env, id: string): Promise<Response> {
  const result = await env.DB!.prepare("DELETE FROM contact_messages WHERE id = ?").bind(id).run();
  if (result.meta.changes === 0) return errorResponse("Message not found", 404);
  return new Response(null, { status: 204 });
}

/**
 * One-time (but idempotent -- safe to re-run) backfill: finds every
 * historical contact-form notification email in Resend's send history
 * that predates this feature, reconstructs the original submission from
 * the email's own HTML body, and inserts it as a real contact_messages
 * row. Admin-triggered (POST /api/contact-messages/backfill-from-resend,
 * behind Cloudflare Access same as the rest of this file) rather than
 * automatic, since it's a deliberate one-off action, not something that
 * should silently re-run on every page load.
 *
 * Each already-imported email is recognized by resend_message_id and
 * skipped (not duplicated) on subsequent runs -- so clicking the button
 * twice, or running it again after a future gap, is always safe.
 */
export async function handleContactMessagesBackfillRequest(env: Env): Promise<Response> {
  const bindingError = requireDb(env);
  if (bindingError) return bindingError;
  if (!env.RESEND_API_KEY_ADMINPANEL) {
    return errorResponse("Backfill needs RESEND_API_KEY_ADMINPANEL configured on this Worker first.", 503);
  }

  let emails;
  try {
    ({ emails } = await listAllSentEmails(env.RESEND_API_KEY_ADMINPANEL));
  } catch (err) {
    if (err instanceof ResendApiError) return errorResponse(err.message, 502);
    throw err;
  }

  const candidates = emails.filter((e) => e.subject === CONTACT_NOTIFICATION_SUBJECT);
  const nonMatching = emails.filter((e) => e.subject !== CONTACT_NOTIFICATION_SUBJECT);
  const nonMatchingSubjectSamples = [...new Set(nonMatching.map((e) => e.subject))].slice(0, 10);

  const { results: existingRows } = await env.DB!.prepare(
    "SELECT resend_message_id FROM contact_messages WHERE resend_message_id IS NOT NULL",
  ).all<{ resend_message_id: string }>();
  const existingIds = new Set(existingRows.map((r) => r.resend_message_id));

  let imported = 0;
  let alreadyPresent = 0;
  let skipped = 0;
  let processedNew = 0;

  for (const candidate of candidates) {
    if (existingIds.has(candidate.id)) {
      alreadyPresent++;
      continue;
    }
    if (processedNew >= MAX_BACKFILL_PER_RUN) {
      skipped++; // hit the per-run cap -- re-running later will pick these up
      continue;
    }
    processedNew++;

    let detail;
    try {
      detail = await getSentEmailContent(env.RESEND_API_KEY_ADMINPANEL, candidate.id);
    } catch {
      skipped++;
      continue;
    }

    const parsed = parseContactNotificationHtml(detail.html ?? "");
    if (!parsed) {
      skipped++; // doesn't match our known template -- not a contact-form email, or an older template version
      continue;
    }

    const id = crypto.randomUUID();
    // status defaults to 'read' (not 'new') and source_ip is NULL --
    // these were already seen via the original email, and Resend never
    // knew the visitor's IP. See migrations/0005's comment. Email is
    // lowercased for the same reason as the live ingest path in
    // worker/api/public-contact.ts -- it's the Contacts directory's dedup
    // key, so it must be stored canonically.
    const normalizedEmail = parsed.email.toLowerCase();
    await env.DB!.prepare(
      `INSERT INTO contact_messages
        (id, name, email, phone, address, message, status, email_sent, resend_message_id, source_ip, created_at, backfilled)
       VALUES (?, ?, ?, ?, ?, ?, 'read', 1, ?, NULL, ?, 1)`,
    )
      .bind(id, parsed.name, normalizedEmail, parsed.phone, parsed.address, parsed.message, candidate.id, candidate.created_at)
      .run();
    imported++;
  }

  const result: ContactMessageBackfillResult = {
    imported,
    alreadyPresent,
    skipped,
    totalEmailsInResendAccount: emails.length,
    excludedBySubject: nonMatching.length,
    nonMatchingSubjectSamples,
  };
  return json(result);
}
