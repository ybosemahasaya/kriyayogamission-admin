import type {
  SearchConsoleActiveFilters,
  SearchConsoleDimensionBreakdown,
  SearchConsoleDimensionRow,
  SearchConsoleDTO,
  SearchConsoleKeywordGroup,
  SearchConsoleQuery,
  SearchConsoleTextFilter,
} from "../../shared/search-console";
import { aggregateQueryStats } from "../../shared/search-console";
import { isBrandedQuery } from "../../shared/brand-terms";
import type { AnalyticsRange } from "../../shared/analytics";
import { querySearchAnalytics, type GscDimensionFilter, type GscFilterOperator, type GscRow } from "../lib/gsc-client";
import { getGoogleAccessToken, resolveGoogleCredentials, SEARCH_CONSOLE_READONLY_SCOPE, type GoogleCredentials } from "../lib/google-auth";
import { errorResponse, json } from "../lib/http";
import type { Env } from "../types";

// GSC's own max is 25,000 -- 250 is already generous for a single-site
// keyword-ranking breakdown and keeps the response small. Rows come back
// sorted by clicks descending, so this is "the top 250 keywords by
// clicks", not an arbitrary slice.
const KEYWORD_ROW_LIMIT = 250;

// Pages/countries/devices/search-appearance tabs don't need the same
// headroom queries do -- a small site rarely has more than a couple
// dozen distinct values for any of these. No pagination UI exists yet
// (see SearchConsolePage.tsx), so this is "enough to not feel clipped,"
// not an attempt at completeness the way KEYWORD_ROW_LIMIT is.
const DIMENSION_ROW_LIMIT = 100;

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

function toDimensionRows(rows: GscRow[] | undefined): SearchConsoleDimensionRow[] {
  return (rows ?? []).map((row) => ({
    label: row.keys?.[0] ?? "",
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position,
  }));
}

function parseTextFilter(params: URLSearchParams, key: string): SearchConsoleTextFilter | null {
  const value = params.get(key);
  if (!value) return null;
  const opParam = params.get(`${key}Op`);
  const operator: GscFilterOperator = opParam === "notContains" || opParam === "equals" ? opParam : "contains";
  return { value, operator };
}

/** Mirrors Search Console's own "+ Add filter" picker: Query/Page support
 * contains / not-contains / exact, Country/Device are plain exact-match
 * selects (that's all GSC itself offers for those two dimensions). */
function buildFilters(params: URLSearchParams): { filters: GscDimensionFilter[]; active: SearchConsoleActiveFilters } {
  const filters: GscDimensionFilter[] = [];
  const queryFilter = parseTextFilter(params, "query");
  const pageFilter = parseTextFilter(params, "page");
  const country = params.get("country");
  const device = params.get("device");

  if (queryFilter) filters.push({ dimension: "query", operator: queryFilter.operator, expression: queryFilter.value });
  if (pageFilter) filters.push({ dimension: "page", operator: pageFilter.operator, expression: pageFilter.value });
  if (country) filters.push({ dimension: "country", operator: "equals", expression: country });
  if (device) filters.push({ dimension: "device", operator: "equals", expression: device });

  return {
    filters,
    active: { query: queryFilter, page: pageFilter, country: country || null, device: device || null },
  };
}

function toKeywordGroup(queries: SearchConsoleQuery[]): SearchConsoleKeywordGroup {
  return { ...aggregateQueryStats(queries), queries };
}

export async function handleSearchConsoleRequest(request: Request, env: Env): Promise<Response> {
  const creds = requireCredentials(env);
  if (!creds) return errorResponse("Search Console is not configured yet.", 503);

  const url = new URL(request.url);
  const range = parseRange(url.searchParams.get("range"));
  const { current, previous } = buildDateWindows(range);
  const { filters, active } = buildFilters(url.searchParams);
  const accessToken = await getGoogleAccessToken(creds.auth, SEARCH_CONSOLE_READONLY_SCOPE);

  const [
    currentTotalsRes,
    previousTotalsRes,
    queriesRes,
    pagesRes,
    countriesRes,
    devicesRes,
    searchAppearanceRes,
    availableCountriesRes,
  ] = await Promise.all([
    querySearchAnalytics(creds.siteUrl, accessToken, { ...current, filters, rowLimit: 1 }),
    querySearchAnalytics(creds.siteUrl, accessToken, { ...previous, filters, rowLimit: 1 }),
    querySearchAnalytics(creds.siteUrl, accessToken, { ...current, filters, dimensions: ["query"], rowLimit: KEYWORD_ROW_LIMIT }),
    querySearchAnalytics(creds.siteUrl, accessToken, { ...current, filters, dimensions: ["page"], rowLimit: DIMENSION_ROW_LIMIT }),
    querySearchAnalytics(creds.siteUrl, accessToken, { ...current, filters, dimensions: ["country"], rowLimit: DIMENSION_ROW_LIMIT }),
    querySearchAnalytics(creds.siteUrl, accessToken, { ...current, filters, dimensions: ["device"], rowLimit: DIMENSION_ROW_LIMIT }),
    querySearchAnalytics(creds.siteUrl, accessToken, {
      ...current,
      filters,
      dimensions: ["searchAppearance"],
      rowLimit: DIMENSION_ROW_LIMIT,
    }),
    // Deliberately unfiltered -- this only feeds the Country filter's
    // <select> options, which should list every country this site has
    // ever shown up in for the range, not just the ones matching
    // whatever filter is already applied (otherwise picking a filter
    // could make other filter options disappear out from under the admin).
    querySearchAnalytics(creds.siteUrl, accessToken, { ...current, dimensions: ["country"], rowLimit: DIMENSION_ROW_LIMIT }),
  ]);

  const currentTotals = totals(currentTotalsRes.rows);
  const previousTotals = totals(previousTotalsRes.rows);
  const metric = (key: keyof typeof currentTotals) => ({ current: currentTotals[key], previous: previousTotals[key] });

  const allQueries: SearchConsoleQuery[] = (queriesRes.rows ?? []).map((row) => ({
    query: row.keys?.[0] ?? "",
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position,
  }));

  const brandedKeywords = toKeywordGroup(allQueries.filter((q) => isBrandedQuery(q.query)));
  const nonBrandedKeywords = toKeywordGroup(allQueries.filter((q) => !isBrandedQuery(q.query)));

  const dimensions: SearchConsoleDimensionBreakdown = {
    queries: toDimensionRows(queriesRes.rows),
    pages: toDimensionRows(pagesRes.rows),
    countries: toDimensionRows(countriesRes.rows),
    devices: toDimensionRows(devicesRes.rows),
    searchAppearance: toDimensionRows(searchAppearanceRes.rows),
  };

  const availableCountries = (availableCountriesRes.rows ?? [])
    .map((row) => row.keys?.[0])
    .filter((code): code is string => Boolean(code));

  const payload: SearchConsoleDTO = {
    range,
    summary: {
      clicks: metric("clicks"),
      impressions: metric("impressions"),
      ctr: metric("ctr"),
      position: metric("position"),
    },
    brandedKeywords,
    nonBrandedKeywords,
    dimensions,
    activeFilters: active,
    availableCountries,
  };

  return json(payload);
}
