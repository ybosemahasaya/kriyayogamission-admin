import { errorResponse, json } from "../lib/http";
import type { CreateContactMessageRequest, UpdateContactMessageEmailStatusRequest } from "../../shared/contact-messages";
import type { Env } from "../types";
import { contactMessageRowToDTO } from "../types";
import type { ContactMessageRow } from "../types";

/**
 * Public, UNAUTHENTICATED-by-Access write endpoint for the public site's
 * own worker.js to call -- NOT meant to be reachable by random visitors,
 * guarded instead by a shared-secret bearer token (CONTACT_INGEST_TOKEN).
 * Mirrors worker/api/public-gallery.ts's "no Access, but scoped/safe"
 * shape, just for writes instead of reads. See worker/types.ts for why a
 * token instead of Access/Service Tokens.
 *
 * Needs its own Cloudflare Access bypass rule added in the dashboard
 * (same mechanism already used for /images/* and /api/public/gallery)
 * before this works in production -- see docs/admin-panel-architecture.html.
 */
export async function handlePublicContactRequest(request: Request, env: Env, id: string | null): Promise<Response> {
  if (!env.DB) {
    return errorResponse("Contact message storage is not provisioned yet.", 503);
  }

  const authError = requireIngestToken(request, env);
  if (authError) return authError;

  if (request.method === "POST" && !id) return create(request, env);
  if (request.method === "PATCH" && id) return updateEmailStatus(request, env, id);
  return errorResponse("Not found", 404);
}

function requireIngestToken(request: Request, env: Env): Response | null {
  if (!env.CONTACT_INGEST_TOKEN) {
    // Fail closed, not open -- an unset token must never mean "anyone can
    // write", it means this feature isn't configured yet.
    return errorResponse("Contact ingest is not configured yet.", 503);
  }
  const header = request.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  if (token !== env.CONTACT_INGEST_TOKEN) {
    return errorResponse("Unauthorized", 401);
  }
  return null;
}

async function create(request: Request, env: Env): Promise<Response> {
  const body = await request.json<Partial<CreateContactMessageRequest>>().catch(() => null);
  const name = (body?.name ?? "").trim();
  const email = (body?.email ?? "").trim();
  const message = (body?.message ?? "").trim();
  const phone = (body?.phone ?? "").trim();
  const address = (body?.address ?? "").trim();

  if (!name || !email || !message) {
    return errorResponse("name, email, and message are required");
  }

  const id = crypto.randomUUID();
  // Prefer the visitor's own IP, explicitly forwarded by the public
  // site's Worker -- see CreateContactMessageRequest.sourceIp. Falling
  // back to this request's own header only matters for local
  // testing/curl, where there's no upstream Worker forwarding it.
  const sourceIp = body?.sourceIp || request.headers.get("CF-Connecting-IP");
  const now = new Date().toISOString();

  // Written with email_sent=0 up front -- this row is the durable record
  // regardless of whether the caller's own Resend call (made separately,
  // before or after this request) succeeds. See migrations/0004.
  await env.DB!.prepare(
    `INSERT INTO contact_messages
      (id, name, email, phone, address, message, status, email_sent, resend_message_id, source_ip, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'new', 0, NULL, ?, ?)`,
  )
    .bind(id, name, email, phone, address, message, sourceIp, now)
    .run();

  return json({ id }, { status: 201 });
}

async function updateEmailStatus(request: Request, env: Env, id: string): Promise<Response> {
  const body = await request.json<Partial<UpdateContactMessageEmailStatusRequest>>().catch(() => null);
  if (typeof body?.emailSent !== "boolean") {
    return errorResponse("emailSent (boolean) is required");
  }

  const result = await env.DB!.prepare(
    "UPDATE contact_messages SET email_sent = ?, resend_message_id = ? WHERE id = ?",
  )
    .bind(body.emailSent ? 1 : 0, body.resendMessageId ?? null, id)
    .run();

  // Best-effort by design (see shared/contact-messages.ts) -- a missing
  // row here just means the message was deleted between the two calls,
  // not an error worth surfacing loudly to the caller.
  if (result.meta.changes === 0) return json({ updated: false });

  const row = await env.DB!.prepare("SELECT * FROM contact_messages WHERE id = ?")
    .bind(id)
    .first<ContactMessageRow>();
  return json({ updated: true, message: row ? contactMessageRowToDTO(row) : null });
}
