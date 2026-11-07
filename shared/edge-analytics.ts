/** DTOs for the "Edge Analytics" dashboard card -- Cloudflare's own
 * GraphQL Analytics API, queried read-only for the PUBLIC site's zone
 * (kriyayogamission.org). See docs/admin-panel-architecture.html Phase 3,
 * "cloudflare-web-analytics": this surfaces server-side truth GA4
 * structurally cannot see (bot/WAF-blocked requests never run GA4's JS,
 * cached edge responses often never hit an origin at all).
 *
 * Deliberately NOT the same thing as Cloudflare Workers Analytics Engine
 * -- that product only sees traffic that actually executes Worker code,
 * which excludes anything blocked/cached at the edge. This dataset comes
 * from Cloudflare's own zone-wide edge logs instead, which is why it can
 * see what Analytics Engine and GA4 both structurally cannot.
 */

export type EdgeAnalyticsRange = "7d" | "30d";

export interface EdgeAnalyticsDailyPoint {
  /** ISO date, "YYYY-MM-DD". */
  date: string;
  requests: number;
  cachedRequests: number;
  bytes: number;
  threats: number;
  uniques: number;
}

export interface EdgeAnalyticsSummary {
  totalRequests: number;
  cachedRequests: number;
  /** 0..1 -- cachedRequests / totalRequests for the selected range. */
  cacheHitRatio: number;
  totalBytes: number;
  totalThreats: number;
  totalUniques: number;
}

export interface FirewallActionCount {
  action: string;
  count: number;
}

export interface FirewallPathCount {
  path: string;
  count: number;
}

export interface FirewallCountryCount {
  country: string;
  count: number;
}

export interface EdgeAnalyticsDTO {
  range: EdgeAnalyticsRange;
  summary: EdgeAnalyticsSummary;
  daily: EdgeAnalyticsDailyPoint[];
  /** Breakdown of WAF/firewall events by the action Cloudflare took
   * (block, challenge, managed_challenge, log, skip, etc.). */
  firewallActions: FirewallActionCount[];
  firewallTopPaths: FirewallPathCount[];
  firewallTopCountries: FirewallCountryCount[];
}
