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
