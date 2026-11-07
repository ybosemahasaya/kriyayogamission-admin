/**
 * Thin wrapper over Resend's "List Sent Emails" API
 * (GET https://api.resend.com/emails), used for the admin dashboard's
 * email-send metrics. See shared/email-metrics.ts for why this pulls
 * from Resend directly instead of re-deriving counts from our own D1
 * rows -- Resend is the actual system of record for "was this email
 * sent and what happened to it".
 */

export interface ResendEmailListItem {
  id: string;
  created_at: string;
  last_event: string;
  to: string[];
  from: string;
  subject: string;
}

interface ResendEmailListResponse {
  data: ResendEmailListItem[];
  has_more: boolean;
}

// 100 is Resend's documented max page size. 20 pages = up to 2000 emails,
// comfortably above anything this site is likely to send for a long time;
// see shared/email-metrics.ts's `partial` field for what happens if this
// is ever not enough.
const PAGE_SIZE = 100;
const MAX_PAGES = 20;

export class ResendApiError extends Error {}

export interface ResendEmailDetail {
  id: string;
  subject: string;
  created_at: string;
  html?: string;
  text?: string;
}

/**
 * GET /emails/:id -- unlike the list endpoint, this includes the actual
 * HTML/text body, which is what the contact-form backfill
 * (worker/lib/contact-html-parser.ts) needs to reconstruct a historical
 * submission's name/email/phone/address/message.
 */
export async function getSentEmailContent(apiKey: string, emailId: string): Promise<ResendEmailDetail> {
  const res = await fetch(`https://api.resend.com/emails/${emailId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ResendApiError(`Resend retrieve-email request failed (${res.status}): ${body}`);
  }
  return (await res.json()) as ResendEmailDetail;
}

/**
 * Pages through every sent email Resend knows about for this account,
 * oldest-call-first isn't guaranteed by their API (cursor order is
 * implementation detail), so callers should treat the result as an
 * unordered set and sort/bucket it themselves.
 */
export async function listAllSentEmails(
  apiKey: string,
): Promise<{ emails: ResendEmailListItem[]; partial: boolean }> {
  const emails: ResendEmailListItem[] = [];
  let after: string | undefined;
  let partial = false;

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL("https://api.resend.com/emails");
    url.searchParams.set("limit", String(PAGE_SIZE));
    if (after) url.searchParams.set("after", after);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new ResendApiError(`Resend list-emails request failed (${res.status}): ${body}`);
    }

    const body = (await res.json()) as ResendEmailListResponse;
    emails.push(...body.data);

    if (!body.has_more || body.data.length === 0) {
      return { emails, partial: false };
    }
    after = body.data[body.data.length - 1]?.id;
    if (!after) break; // defensive -- shouldn't happen if has_more was true
    if (page === MAX_PAGES - 1) partial = true;
  }

  return { emails, partial };
}
