/** DTOs for the "Admin API health" widget on the Edge Analytics page --
 * self-hosted request observability for THIS admin panel's own Worker,
 * sourced from Cloudflare Workers Analytics Engine (see
 * worker/lib/api-metrics.ts for how data points get written, and
 * worker/lib/analytics-engine-client.ts for how they're queried back
 * out via Cloudflare's Analytics Engine SQL API).
 *
 * Deliberately a DIFFERENT thing from everything else in Edge
 * Analytics: those widgets are all about the PUBLIC site's zone
 * (kriyayogamission.org) via Cloudflare's own logs. This one is about
 * THIS admin panel's own API requests -- something Cloudflare has no
 * way of knowing about on its own, which is exactly what Analytics
 * Engine is for (custom app-level events, not zone-wide traffic).
 */

export interface ApiRouteMetric {
  method: string;
  path: string;
  requests: number;
  errors: number;
  avgLatencyMs: number;
  maxLatencyMs: number;
}

/** One day's requests/errors -- same shape family as
 * EdgeAnalyticsDailyPoint, kept as its own type rather than reused
 * since the two track genuinely different things (this admin panel's
 * own API vs. the public site's zone-wide edge traffic). */
export interface ApiDailyPoint {
  date: string;
  requests: number;
  errors: number;
}

export interface ApiStatusBucket {
  /** "2xx" | "3xx" | "4xx" | "5xx" */
  bucket: string;
  count: number;
}

export interface ApiMetricsSummaryDTO {
  totalRequests: number;
  totalErrors: number;
  avgLatencyMs: number;
  maxLatencyMs: number;
  byRoute: ApiRouteMetric[];
  daily: ApiDailyPoint[];
  statusBuckets: ApiStatusBucket[];
}
