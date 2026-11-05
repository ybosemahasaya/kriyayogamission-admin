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

export interface SearchConsoleDTO {
  range: AnalyticsRange;
  summary: SearchConsoleSummary;
  topQueries: SearchConsoleQuery[];
  topPages: SearchConsolePage[];
  devices: SearchConsoleDevice[];
}
