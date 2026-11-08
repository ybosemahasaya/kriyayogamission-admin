/** DTOs for the "Worker Logs" page's two Public Site tabs.
 *
 * Saga so far (see worker/api/worker-logs.ts for the full story): this
 * started as Cloudflare's built-in Workers Logs/Observability, then a
 * GraphQL dataset guess that didn't exist, then a confirmed-real
 * GraphQL dataset that turned out to have no per-script filter or
 * dimension at all (schema introspection proved it, not a guess) --
 * making it structurally unable to tell three Workers apart. The
 * working answer: the public site's OWN Worker now writes its own
 * Analytics Engine data (added directly to that repo, with explicit
 * sign-off -- see worker.js there), which this admin panel reads via
 * the exact same Analytics Engine SQL API client already proven
 * working for the Admin Panel's own metrics (worker/lib/api-metrics.ts).
 *
 * The "Admin Panel" tab needs NO new DTO here -- it just renders the
 * existing ApiObservabilitySection component (shared/api-observability.ts),
 * since that data source already works perfectly. Only Production/Dev
 * need this page's own backend call.
 */

export const WORKER_TARGETS = [
  { key: "admin", label: "Admin Panel", scriptName: "kriyayogamission-admin" },
  { key: "production", label: "Public Site (Production)", scriptName: "kriyayogamission" },
  { key: "dev", label: "Public Site (Dev)", scriptName: "kriyayogamission-dev" },
] as const;

export type WorkerTargetKey = (typeof WORKER_TARGETS)[number]["key"];

/** The two tabs backed by worker/api/worker-logs.ts -- excludes "admin",
 * which renders ApiObservabilitySection directly on the frontend
 * instead of calling this page's API at all. */
export type PublicSiteTargetKey = Exclude<WorkerTargetKey, "admin">;

export interface PublicSitePathViews {
  path: string;
  views: number;
}

export interface PublicSiteDailyPoint {
  date: string;
  views: number;
}

export interface ContactFunnelOutcome {
  /** Matches the literal outcome strings worker.js writes:
   * "success" | "validation_failed" | "bot_caught" |
   * "resend_network_error" | "resend_api_error" | "bad_request". */
  outcome: string;
  count: number;
}

export interface PublicSiteLogsSummaryDTO {
  label: string;
  totalPageViews: number;
  avgLatencyMs: number;
  byPath: PublicSitePathViews[];
  daily: PublicSiteDailyPoint[];
  contactFunnel: ContactFunnelOutcome[];
  totalContactSubmissions: number;
}
