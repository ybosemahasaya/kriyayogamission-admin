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

/** Which Cloudflare protection mechanism handled the request --
 * "botFight" (free Bot Fight Mode), "waf" (managed WAF rules),
 * "linkMaze" (anti-scraper honeypot links), "rateLimit", etc. This is
 * the actual zone-specific threat-intel signal: not just "how many
 * threats" but "what kind, stopped by what." */
export interface FirewallSourceCount {
  source: string;
  count: number;
}

export interface EdgeAnalyticsDTO {
  range: EdgeAnalyticsRange;
  summary: EdgeAnalyticsSummary;
  daily: EdgeAnalyticsDailyPoint[];
  /** Breakdown of WAF/firewall events by the action Cloudflare took
   * (block, challenge, managed_challenge, log, skip, etc.). Computed
   * client-side in the Worker from a raw firewallEventsAdaptive sample
   * -- see worker/api/edge-analytics.ts for why: the server-side GROUP
   * BY variant (firewallEventsAdaptiveGroups) turned out to be blocked
   * on this zone's Free plan even though the raw/ungrouped dataset
   * isn't, confirmed live 2026-11-08. */
  firewallActions: FirewallActionCount[];
  firewallTopPaths: FirewallPathCount[];
  firewallTopCountries: FirewallCountryCount[];
  firewallBySource: FirewallSourceCount[];
  /** How many raw events the above breakdown was computed from -- an
   * "Adaptive" dataset is sampled, not exhaustive, so this number is
   * the honest caveat that belongs next to any firewall count: fine for
   * "what's trending," not a compliance-grade total. */
  firewallSampleSize: number;
  /** Non-null when the firewallEventsAdaptive query failed on its own
   * (token permission, transient API error, etc.) -- surfaced verbatim
   * so the cause is visible instead of blanking the entire page over
   * one dataset. The core KPIs/chart above still load fine when this is
   * set. */
  firewallError: string | null;
}
