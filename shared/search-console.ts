import type { AnalyticsMetric, AnalyticsRange } from "./analytics";

export interface SearchConsoleSummary {
  clicks: AnalyticsMetric;
  impressions: AnalyticsMetric;
  ctr: AnalyticsMetric;
  position: AnalyticsMetric;
}

export interface SearchConsoleQuery {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/** One keyword-ranking bucket (branded or non-branded) -- the query list
 * plus pre-aggregated totals so the UI doesn't have to re-sum a
 * potentially long list on every render. */
export interface SearchConsoleKeywordGroup {
  keywordCount: number;
  totalClicks: number;
  totalImpressions: number;
  avgPosition: number;
  queries: SearchConsoleQuery[];
}

/** Generic row shape shared by every dimension breakdown (queries, pages,
 * countries, devices, search appearance) -- GSC itself reports the exact
 * same four metrics for all of them, so one shape covers all five tabs
 * instead of a near-duplicate interface per dimension. */
export interface SearchConsoleDimensionRow {
  label: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SearchConsoleDimensionBreakdown {
  queries: SearchConsoleDimensionRow[];
  pages: SearchConsoleDimensionRow[];
  countries: SearchConsoleDimensionRow[];
  devices: SearchConsoleDimensionRow[];
  searchAppearance: SearchConsoleDimensionRow[];
}

/** "Queries containing X" / "not containing" / exact match -- the same
 * three choices Search Console's own filter picker offers (its 4th
 * option, regex, isn't supported here yet). */
export type SearchConsoleFilterOperator = "contains" | "notContains" | "equals";

export interface SearchConsoleTextFilter {
  value: string;
  operator: SearchConsoleFilterOperator;
}

/** What filters were actually applied, echoed back so the UI can render
 * removable filter chips without re-deriving state from the URL. */
export interface SearchConsoleActiveFilters {
  query: SearchConsoleTextFilter | null;
  page: SearchConsoleTextFilter | null;
  country: string | null;
  device: string | null;
}

export interface SearchConsoleDTO {
  range: AnalyticsRange;
  summary: SearchConsoleSummary;
  brandedKeywords: SearchConsoleKeywordGroup;
  nonBrandedKeywords: SearchConsoleKeywordGroup;
  dimensions: SearchConsoleDimensionBreakdown;
  activeFilters: SearchConsoleActiveFilters;
  /** Every country code seen in the UNFILTERED current-range data, for
   * populating the Country filter's <select> -- fetched once per
   * range change, independent of whatever filters are currently
   * applied, so the option list doesn't shrink out from under the user
   * as they filter. */
  availableCountries: string[];
}

/** Shared by the backend (building brandedKeywords/nonBrandedKeywords
 * from a GSC response) and the frontend (recomputing the same totals
 * live as the admin types into the Keyword Rankings filter) -- one
 * weighted-average implementation instead of two that could drift. */
export function aggregateQueryStats(queries: SearchConsoleQuery[]): {
  keywordCount: number;
  totalClicks: number;
  totalImpressions: number;
  avgPosition: number;
} {
  const totalClicks = queries.reduce((sum, q) => sum + q.clicks, 0);
  const totalImpressions = queries.reduce((sum, q) => sum + q.impressions, 0);
  const avgPosition = totalImpressions
    ? queries.reduce((sum, q) => sum + q.position * q.impressions, 0) / totalImpressions
    : 0;
  return { keywordCount: queries.length, totalClicks, totalImpressions, avgPosition };
}
