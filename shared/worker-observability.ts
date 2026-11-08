/** DTOs for the "Recent exceptions & slow requests" section on each
 * Worker Logs tab -- Cloudflare Workers Observability (tail-based
 * tracing), the feature this project went through 5 rounds of live
 * trial-and-error (plus one round of actually reading Cloudflare's
 * official docs, which should have been step one) to find the real
 * schema for. See worker/api/worker-observability.ts for the full saga
 * and the confirmed request shape.
 *
 * Deliberately ONE query per Worker, not three: a single `view: "events"`
 * query over a 7-day window returns up to 100 recent events, and both
 * "exceptions" (outcome != "ok") and "slowest requests" (sorted by
 * wallTimeMs) are derived from that SAME result set server-side, rather
 * than risking three separate unverified filter/orderBy combinations.
 */

export interface ObservabilityEvent {
  /** Unix ms. */
  timestamp: number;
  level: string;
  message: string;
  path: string | null;
  method: string | null;
  status: number | null;
  /** Cloudflare's own outcome strings: "ok" | "exception" |
   * "exceededCpu" | "canceled" | etc. -- passed through verbatim, same
   * reasoning as every other Cloudflare status/outcome string in this
   * project. */
  outcome: string | null;
  wallTimeMs: number | null;
  cpuTimeMs: number | null;
  requestId: string | null;
}

export interface ObservabilitySeriesPoint {
  /** Cloudflare's own bucket label, already a readable string (e.g.
   * "2026-11-08 09:12:00") -- passed through verbatim rather than
   * reparsed, same reasoning as every other Cloudflare-formatted string
   * in this project. */
  time: string;
  count: number;
  errors: number;
}

export interface WorkerObservabilitySummaryDTO {
  scriptName: string;
  recentExceptions: ObservabilityEvent[];
  slowestRequests: ObservabilityEvent[];
  recentEvents: ObservabilityEvent[];
  /** Time-bucketed request/error counts across the FULL queried window
   * -- not capped at 100 like the arrays above, since this comes from
   * Cloudflare's own server-side aggregation (the `series` field on its
   * response), not from summing the raw event sample. This is what
   * powers the dashboard's time-series panels. */
  series: ObservabilitySeriesPoint[];
  /** Totals from that same server-side aggregation -- accurate counts
   * for the whole window, unlike `recentEvents.length` which is capped
   * at the sample size. Used for the dashboard's stat tiles. */
  totalRequests: number;
  totalErrors: number;
}
