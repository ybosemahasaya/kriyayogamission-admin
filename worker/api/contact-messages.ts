import { errorResponse, json } from "../lib/http";
import { CONTACT_MESSAGE_STATUSES, isContactMessageStatus } from "../../shared/contact-messages";
import type { ContactMessageStatusCounts, ContactMessageListResponse } from "../../shared/contact-messages";
import type { ContactMessageRow, Env } from "../types";
import { contactMessageRowToDTO } from "../types";

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
