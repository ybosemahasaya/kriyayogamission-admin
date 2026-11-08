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

export interface WorkerObservabilitySummaryDTO {
  scriptName: string;
  recentExceptions: ObservabilityEvent[];
  slowestRequests: ObservabilityEvent[];
  recentEvents: ObservabilityEvent[];
}
