import { listAllSentEmails, ResendApiError } from "../lib/resend-client";
import { errorResponse, json } from "../lib/http";
import type { Env } from "../types";
import type { EmailDailyCount, EmailMetricsDTO } from "../../shared/email-metrics";

const DAILY_BREAKDOWN_DAYS = 14;

export async function handleEmailMetricsRequest(env: Env): Promise<Response> {
  if (!env.RESEND_API_KEY) {
    return errorResponse(
      "Email metrics aren't configured yet. Set RESEND_API_KEY via `wrangler secret put` on this project.",
      503,
    );
  }

  let emails;
  let partial: boolean;
  try {
    ({ emails, partial } = await listAllSentEmails(env.RESEND_API_KEY));
  } catch (err) {
    if (err instanceof ResendApiError) return errorResponse(err.message, 502);
    throw err;
  }

  const now = new Date();
  const todayKey = dateKey(now);
  const monthKey = todayKey.slice(0, 7); // YYYY-MM

  let sentToday = 0;
  let sentThisMonth = 0;
  const byDay = new Map<string, number>();
  const byLastEvent: Record<string, number> = {};

  for (const email of emails) {
    const createdAt = new Date(email.created_at);
    if (Number.isNaN(createdAt.getTime())) continue; // defensive -- skip unparseable rows rather than crash the whole report
    const key = dateKey(createdAt);

    if (key === todayKey) sentToday++;
    if (key.slice(0, 7) === monthKey) sentThisMonth++;
    byDay.set(key, (byDay.get(key) ?? 0) + 1);

    const event = email.last_event || "unknown";
    byLastEvent[event] = (byLastEvent[event] ?? 0) + 1;
  }

  const dailyBreakdown = buildZeroFilledDailyBreakdown(byDay, now, DAILY_BREAKDOWN_DAYS);

  const attemptedButNeverReachedResend = env.DB
    ? ((
        await env.DB.prepare("SELECT COUNT(*) AS n FROM contact_messages WHERE email_sent = 0").first<{
          n: number;
        }>()
      )?.n ?? 0)
    : 0;

  const dto: EmailMetricsDTO = {
    totalSent: emails.length,
    sentToday,
    sentThisMonth,
    dailyBreakdown,
    byLastEvent,
    attemptedButNeverReachedResend,
    partial,
  };
  return json(dto);
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD, UTC
}

function buildZeroFilledDailyBreakdown(byDay: Map<string, number>, now: Date, days: number): EmailDailyCount[] {
  const breakdown: EmailDailyCount[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const key = dateKey(d);
    breakdown.push({ date: key, count: byDay.get(key) ?? 0 });
  }
  return breakdown;
}
