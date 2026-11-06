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

export interface SearchConsolePage {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SearchConsoleDevice {
  device: string;
  clicks: number;
  impressions: number;
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

export interface SearchConsoleDTO {
  range: AnalyticsRange;
  summary: SearchConsoleSummary;
  brandedKeywords: SearchConsoleKeywordGroup;
  nonBrandedKeywords: SearchConsoleKeywordGroup;
  topPages: SearchConsolePage[];
  devices: SearchConsoleDevice[];
}
