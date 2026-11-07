/**
 * Contact-form submission persisted to D1 -- see "contact-form-log" in
 * docs/admin-panel-architecture.html. Closes the gap where a Resend
 * outage/bounce/spam-filter meant an inquiry vanished with zero record.
 */
export type ContactMessageStatus = "new" | "read" | "replied";

export const CONTACT_MESSAGE_STATUSES: ContactMessageStatus[] = ["new", "read", "replied"];

export function isContactMessageStatus(value: unknown): value is ContactMessageStatus {
  return typeof value === "string" && (CONTACT_MESSAGE_STATUSES as string[]).includes(value);
}

export interface ContactMessageDTO {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  message: string;
  status: ContactMessageStatus;
  /** Did the public site's own Resend call report success. Best-effort --
   * see migrations/0004_create_contact_messages.sql for why this can lag
   * or stay stale in rare cases. */
  emailSent: boolean;
  resendMessageId: string | null;
  createdAt: string;
  /** True for rows reconstructed after the fact from Resend's send
   * history (see worker/api/contact-messages.ts's backfill handler),
   * rather than captured live by the public site's own ingest call.
   * Backfilled rows necessarily have reduced fidelity -- no source_ip,
   * createdAt is Resend's send timestamp rather than the exact
   * form-submit moment, status defaults to 'read' rather than 'new'. */
  backfilled: boolean;
}

/** Result of a POST /api/contact-messages/backfill-from-resend run --
 * idempotent, safe to call more than once (already-imported rows are
 * matched by resendMessageId and counted as alreadyPresent, not
 * duplicated). */
export interface ContactMessageBackfillResult {
  imported: number;
  alreadyPresent: number;
  skipped: number;
  /** Total emails Resend returned for this account, regardless of
   * subject -- lets an admin sanity-check "Resend shows N sent, why did
   * fewer import" without needing to go dig through the Resend
   * dashboard themselves. */
  totalEmailsInResendAccount: number;
  /** How many of those were excluded before parsing even started,
   * because their subject didn't match CONTACT_NOTIFICATION_SUBJECT --
   * e.g. other transactional emails ever sent from the same Resend
   * account, or a contact-form notification sent under an older/
   * different subject line. */
  excludedBySubject: number;
  /** Up to 10 distinct non-matching subjects actually seen, so a mismatch
   * (e.g. a subject that changed slightly at some point) is visible
   * without needing direct Resend dashboard access. */
  nonMatchingSubjectSamples: string[];
}

/** Counts by status, always present (0 if none), so the admin UI can
 * render tab badges without a second round trip or client-side tallying. */
export type ContactMessageStatusCounts = Record<ContactMessageStatus, number>;

export interface ContactMessageListResponse {
  messages: ContactMessageDTO[];
  counts: ContactMessageStatusCounts;
}

/** Body the PUBLIC site's worker.js posts to create a durable record of a
 * submission -- independent of whether the Resend notification email
 * ultimately succeeds. See worker/api/public-contact.ts.
 *
 * sourceIp is explicit rather than inferred from the request's own
 * CF-Connecting-IP header, because this request comes from the PUBLIC
 * SITE's Worker (a Cloudflare-to-Cloudflare call), not from the original
 * visitor's browser -- without this field, source_ip would silently
 * record the public site's own Worker egress IP instead of the
 * visitor's. */
export interface CreateContactMessageRequest {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  message: string;
  sourceIp?: string;
}

/** Body the public site's worker.js posts AFTER its Resend call completes,
 * to best-effort backfill whether the notification actually sent. */
export interface UpdateContactMessageEmailStatusRequest {
  emailSent: boolean;
  resendMessageId?: string;
}
