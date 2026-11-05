import type { SearchConsoleDevice, SearchConsoleDTO, SearchConsolePage, SearchConsoleQuery } from "../../shared/search-console";
import type { AnalyticsRange } from "../../shared/analytics";
import { querySearchAnalytics, type GscRow } from "../lib/gsc-client";
import { getGoogleAccessToken, resolveGoogleCredentials, SEARCH_CONSOLE_READONLY_SCOPE, type GoogleCredentials } from "../lib/google-auth";
import { errorResponse, json } from "../lib/http";
import type { Env } from "../types";

const RANGE_DAYS: Record<AnalyticsRange, number> = { "7d": 7, "30d": 30, "90d": 90 };

// Search Console's data is finalized ~2-3 days behind real-time (a
// Google platform lag, not something we control) -- asking for "today"
// or "yesterday" routinely comes back empty/partial. Anchoring the
// whole window 3 days back avoids that gap entirely.
const DATA_LAG_DAYS = 3;

function parseRange(value: string | null): AnalyticsRange {
  if (value === "30d" || value === "90d") return value;
  return "7d";
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function subDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() - days);
  return copy;
}

function buildDateWindows(range: AnalyticsRange) {
  const days = RANGE_DAYS[range];
  const anchor = subDays(new Date(), DATA_LAG_DAYS);
  const currentEnd = anchor;
  const currentStart = subDays(anchor, days - 1);
  const previousEnd = subDays(currentStart, 1);
  const previousStart = subDays(previousEnd, days - 1);
  return {
    current: { startDate: isoDate(currentStart), endDate: isoDate(currentEnd) },
    previous: { startDate: isoDate(previousStart), endDate: isoDate(previousEnd) },
  };
}

interface Credentials {
  siteUrl: string;
  auth: GoogleCredentials;
}

function requireCredentials(env: Env): Credentials | null {
  if (!env.GSC_SITE_URL) return null;
  const auth = resolveGoogleCredentials(env);
  if (!auth) return null;
  return { siteUrl: env.GSC_SITE_URL, auth };
}

function totals(rows: GscRow[] | undefined): { clicks: number; impressions: number; ctr: number; position: number } {
  const list = rows ?? [];
  const clicks = list.reduce((sum, row) => sum + row.clicks, 0);
  const impressions = list.reduce((sum, row) => sum + row.impressions, 0);
  // Weighted average position/CTR across rows, not a naive mean of
  // per-row values -- a query with 1 impression shouldn't count as
  // heavily as one with 10,000.
  const position = impressions ? list.reduce((sum, row) => sum + row.position * row.impressions, 0) / impressions : 0;
  const ctr = impressions ? clicks / impressions : 0;
  return { clicks, impressions, ctr, position };
}

export async function handleSearchConsoleRequest(request: Request, env: Env): Promise<Response> {
  const creds = requireCredentials(env);
  if (!creds) return errorResponse("Search Console is not configured yet.", 503);

  const range = parseRange(new URL(request.url).searchParams.get("range"));
  const { current, previous } = buildDateWindows(range);
  const accessToken = await getGoogleAccessToken(creds.auth, SEARCH_CONSOLE_READONLY_SCOPE);

  const [currentTotalsRes, previousTotalsRes, queriesRes, pagesRes, devicesRes] = await Promise.all([
    querySearchAnalytics(creds.siteUrl, accessToken, { ...current, rowLimit: 1 }),
    querySearchAnalytics(creds.siteUrl, accessToken, { ...previous, rowLimit: 1 }),
    querySearchAnalytics(creds.siteUrl, accessToken, { ...current, dimensions: ["query"], rowLimit: 10 }),
    querySearchAnalytics(creds.siteUrl, accessToken, { ...current, dimensions: ["page"], rowLimit: 10 }),
    querySearchAnalytics(creds.siteUrl, accessToken, { ...current, dimensions: ["device"], rowLimit: 10 }),
  ]);

  const currentTotals = totals(currentTotalsRes.rows);
  const previousTotals = totals(previousTotalsRes.rows);
  const metric = (key: keyof typeof currentTotals) => ({ current: currentTotals[key], previous: previousTotals[key] });

  const topQueries: SearchConsoleQuery[] = (queriesRes.rows ?? []).map((row) => ({
    query: row.keys?.[0] ?? "",
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position,
  }));

  const topPages: SearchConsolePage[] = (pagesRes.rows ?? []).map((row) => ({
    page: row.keys?.[0] ?? "",
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position,
  }));

  const devices: SearchConsoleDevice[] = (devicesRes.rows ?? []).map((row) => ({
    device: row.keys?.[0] ?? "",
    clicks: row.clicks,
    impressions: row.impressions,
  }));

  const payload: SearchConsoleDTO = {
    range,
    summary: {
      clicks: metric("clicks"),
      impressions: metric("impressions"),
      ctr: metric("ctr"),
      position: metric("position"),
    },
    topQueries,
    topPages,
    devices,
  };

  return json(payload);
}
