/**
 * Email send metrics for the admin dashboard -- "how many emails have we
 * sent today/this month/total", sourced directly from Resend's own API
 * (GET /emails, see worker/lib/resend-client.ts) rather than re-deriving
 * it from our own D1 rows. Resend is the actual system of record for
 * "did an email get sent" (it's the one that talks to mail servers); our
 * D1 table only knows "did the public site's fetch() to Resend's API
 * report success", which is a different, narrower question -- see
 * attemptedButNeverReachedResend below for exactly that gap.
 */
export interface EmailDailyCount {
  /** YYYY-MM-DD, UTC. */
  date: string;
  count: number;
}

export interface EmailMetricsDTO {
  totalSent: number;
  sentToday: number;
  sentThisMonth: number;
  /** Last 14 days, oldest first, zero-filled for days with no sends --
   * enough to draw a small trend chart without the query getting
   * expensive to page through. */
  dailyBreakdown: EmailDailyCount[];
  /** Resend's own `last_event` per email (sent/delivered/bounced/
   * complained/opened/clicked/...), counted across all emails the
   * pagination loop below was willing to fetch. This is the actual
   * answer to "did people get these emails", not just "did we call
   * Resend's API ok". */
  byLastEvent: Record<string, number>;
  /** Contact-form submissions where the public site's own fetch() to
   * Resend's API never even succeeded (network error, Resend outage,
   * bad API key, etc.) -- these never became a Resend email at all, so
   * they'd be invisible to everything above. Sourced from our own D1
   * contact_messages table, not Resend. This is the exact scenario the
   * "contact-form-log" roadmap item was written to catch. */
  attemptedButNeverReachedResend: number;
  /** True if the Resend pagination loop hit its safety cap (see
   * MAX_PAGES in worker/lib/resend-client.ts) before exhausting
   * `has_more` -- meaning totals above are a lower bound, not exact.
   * Expected to stay false for a long time at this site's actual send
   * volume; flagged honestly rather than silently under-reporting. */
  partial: boolean;
}
