export type AnalyticsRange = "7d" | "30d" | "90d";

export interface AnalyticsMetric {
  current: number;
  previous: number;
}

export interface AnalyticsSummary {
  totalUsers: AnalyticsMetric;
  newUsers: AnalyticsMetric;
  sessions: AnalyticsMetric;
  engagementRate: AnalyticsMetric;
  averageSessionDuration: AnalyticsMetric;
  conversions: AnalyticsMetric;
}

export interface AnalyticsTimeseriesPoint {
  date: string; // YYYYMMDD, as GA4 returns it
  activeUsers: number;
  sessions: number;
}

export interface AnalyticsTopPage {
  path: string;
  title: string;
  views: number;
  avgDuration: number;
}

export interface AnalyticsChannel {
  channel: string;
  sessions: number;
  users: number;
}

export interface AnalyticsDevice {
  device: string;
  sessions: number;
}

export interface AnalyticsSegment {
  segment: string;
  users: number;
}

export interface AnalyticsCountry {
  country: string;
  sessions: number;
  users: number;
}

export interface AnalyticsDTO {
  range: AnalyticsRange;
  /** Lifetime total users, independent of the selected range tab --
   * bounded by GA4's own data-retention window (see ALL_TIME_START_DATE
   * in worker/api/analytics.ts), not necessarily since property creation. */
  allTimeUsers: number;
  summary: AnalyticsSummary;
  timeseries: AnalyticsTimeseriesPoint[];
  topPages: AnalyticsTopPage[];
  channels: AnalyticsChannel[];
  devices: AnalyticsDevice[];
  newVsReturning: AnalyticsSegment[];
  geo: AnalyticsCountry[];
}

export interface AnalyticsRealtimeDTO {
  activeUsers: number;
}
